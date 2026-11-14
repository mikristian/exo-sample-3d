#!/usr/bin/env python3
"""Single-slot, resource-aware training scheduler on the Jarvis Mac.

The primary Mac triggers this via authenticated SSH. Only one dispatcher may
run on Jarvis; geometry -> seam -> validation are sequential stages, never
parallel Python workers. Each trainer holds the shared compute lock and has
its own memory-pressure safety monitor. The Parquet importer is independent.
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys

from remote_garmentcode_seam_offload import atomic_status
from garmentcode_full_source_snapshot import full_source_snapshot

STATUS_BY_STAGE={'geometry':'geometry-offload-status.json',
                 'seam':'seam-offload-status.json',
                 'deep_geometry':'geometry-offload-status.json',
                 'deep_seam':'seam-offload-status.json',
                 'validation':'seam-model-selection-status.json'}


def read_stage_state(training,name):
    """A successful check may have deferred training due to low memory."""
    try:
        doc=json.loads((training/STATUS_BY_STAGE[name]).read_text())
        if isinstance(doc,dict) and isinstance(doc.get('state'),str):
            return doc['state']
    except (ValueError,OSError):pass
    return 'unreported'


def verified_final_source_audit(root,snapshot):
    """Require importer's independent 40-source *deep hash* audit first.

    Otherwise a newly committed final archive marker might start training
    while the source importer is still hashing the original 148GB Parquets.
    """
    if not snapshot.get('complete'):
        return False
    try:
        doc=json.loads((root/'full-dataset-audit.json').read_text())
        return bool(doc.get('allDataSaved') is True
            and doc.get('deepHashVerified') is True
            and doc.get('datasetSourceBatches')==40
            and doc.get('completeBatches')==40
            and doc.get('fullParquetFileCount')==40
            and doc.get('verifiedOriginalSewingSpecifications')==snapshot.get('verifiedArchivedPatterns')
            and not doc.get('incomplete'))
    except (OSError,ValueError,TypeError):
        return False


def stage_commands(root,python=sys.executable):
    tools=Path(__file__).resolve().parent
    return [
        ('geometry',[python,str(tools/'remote_garmentcode_geometry_offload.py'),
                     '--root',str(root),'--first-target','60000',
                     '--increment','10000','--epochs','45']),
        ('seam',[python,str(tools/'remote_garmentcode_seam_offload.py'),
                 '--root',str(root),'--first-target','30000',
                 '--increment','10000','--epochs','18']),
        ('deep_geometry',[python,str(tools/'remote_garmentcode_geometry_offload.py'),
                     '--root',str(root),'--deep-pass','--epochs','32']),
        ('deep_seam',[python,str(tools/'remote_garmentcode_seam_offload.py'),
                 '--root',str(root),'--deep-pass','--epochs','32']),
        ('validation',[python,str(tools/'remote_garmentcode_seam_select.py'),
                       '--root',str(root),'--max-garments','100']),
    ]


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    args=parser.parse_args(argv)
    root=args.root.resolve()
    if not (root/'data/pattern-index.sqlite3').is_file():
        print('Original Expansion volume unavailable; no training jobs started')
        return 0
    lock=Path.home()/'Library/Caches/exo-jarvis-training-dispatch.lock'
    lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('a+') as fh:
        try:fcntl.flock(fh,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print('Remote dispatcher already running; skip duplicate',flush=True)
            return 0
        try:os.nice(15)
        except OSError:pass
        status=root/'training/remote-compute-dispatch-status.json'
        # Source-first policy: finish the complete 40-batch ORIGINAL archive
        # before allocating Jarvis CPU/swap to full-corpus model optimization.
        # Partial increment checkpoints are preserved; no further partial
        # training may stall the only source importer or be mistaken for 100%.
        snapshot=full_source_snapshot(root/'data/pattern-index.sqlite3')
        if not snapshot['complete']:
            atomic_status(status,'waiting_for_full_source_archive',
                schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',
                **snapshot)
            print('Original 40 source batches incomplete; preserve importer capacity',flush=True)
            return 0
        if not verified_final_source_audit(root,snapshot):
            atomic_status(status,'waiting_for_independent_deep_source_audit',
                schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',**snapshot)
            print('All 40 batches indexed; waiting for importer SHA-256 audit of original Parquets and archives',flush=True)
            return 0
        env={**os.environ,'OPENBLAS_NUM_THREADS':'1',
             'VECLIB_MAXIMUM_THREADS':'1','OMP_NUM_THREADS':'1',
             'MKL_NUM_THREADS':'1'}
        completed=[]
        for name,command in stage_commands(root):
            if not Path(command[1]).is_file():
                completed.append({'stage':name,'state':'script_missing'})
                atomic_status(status,'waiting_for_stage',
                    schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',
                    stage=name,completedStages=completed)
                return 1
            atomic_status(status,'running_stage',schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',
                          stage=name,completedStages=completed)
            try:
                # Parent timeout must exceed the child watchdog timeout.
                # Otherwise killing only the parent could orphan an active
                # trainer while its exclusive compute lock was released.
                max_duration=21900 if name.startswith('deep_') else 11100
                stage=subprocess.run(command,env=env,timeout=max_duration,
                                     stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                outcome={'stage':name,'state':'checked' if stage.returncode==0 else 'failed',
                         'reportedWorkerState':read_stage_state(root/'training',name),
                         'exitCode':stage.returncode,'output':stage.stdout[-600:],
                         'error':stage.stderr[-600:]}
            except (OSError,subprocess.TimeoutExpired) as error:
                outcome={'stage':name,'state':'failed','error':str(error)[-600:]}
            completed.append(outcome)
            # An exit code of zero can still mean a worker deferred for memory
            # pressure or unavailable checkpoints. Do not advance the pipeline.
            worker_state=outcome.get('reportedWorkerState')
            successful_states={'geometry':{'trained','full_dataset_already_trained'},
                               'seam':{'trained','full_dataset_already_trained'},
                               'deep_geometry':{'deep_trained','deep_already_trained'},
                               'deep_seam':{'deep_trained','deep_already_trained'},
                               'validation':{'completed'}}
            if (outcome['state']!='checked' or
                worker_state not in successful_states[name]):
                atomic_status(status,'waiting_for_stage',
                    schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',
                    stage=name,completedStages=completed)
                return 1 if outcome['state']=='failed' else 0
        atomic_status(status,'finished',schema='exo.garmentcodedata-v2.jarvis-dispatch.v1',
                      completedStages=completed)
        print('Jarvis serial training checks finished; importer untouched',flush=True)
        return 0


if __name__=='__main__':raise SystemExit(main())

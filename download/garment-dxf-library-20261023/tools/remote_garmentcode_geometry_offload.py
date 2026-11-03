#!/usr/bin/env python3
"""Sequential, lower-priority geometry retraining on the Intel Jarvis Mac.

The original source importer has priority. Geometry optimization is queued
behind the separate seam trainer, never simultaneous. Each completed 10K
increment creates a distinct SHA-verified learning checkpoint + embeddings.
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import sys
import numpy as np

from train_garmentcode_geometry import load_initial_checkpoint

from remote_garmentcode_seam_offload import hardware_health,atomic_status as _write_status
from garmentcode_full_source_snapshot import full_source_snapshot


def atomic_status(file,phase,**fields):
    return _write_status(file,phase,
        schema='exo.garmentcodedata-v2.jarvis-geometry-offload.v1',**fields)


def geometry_hardware_health():
    """A geometry encoder needs far less RAM than millions of seam pairs.

    Geometry is smaller than the seam trainer, but the original source
    importer is also active and must retain spare swap. Stay conservative
    across reconnects, even when macOS reports ample physical free RAM.
    The watchdog is a second defense, not a substitute for admission checks.
    """
    report=hardware_health()
    memory=report['memoryFreePct']
    swap=report['swapUsedMiB']
    free_swap=report.get('swapFreeMiB')
    standard=bool(memory is not None and memory>=45
        and swap is not None and swap<=3200
        and free_swap is not None and free_swap>=1024
        and report['fiveMinuteLoad']<=4.0)
    report['resourceReady']=standard
    report['resourceTier']='standard' if standard else 'deferred'
    report['requirements']='geometry: >=45% free RAM, >=1024 MiB free swap, used swap <=3200 MiB, load <=4; with active watchdog'
    return report


def geometry_emergency_pressure(report):
    """Abort geometry child before it can exhaust source-importer headroom."""
    ram=report.get('memoryFreePct')
    swap_free=report.get('swapFreeMiB')
    return (ram is None or ram<35 or swap_free is None or swap_free<400)


def run_geometry_with_watchdog(command,env,interval=20,timeout=10800):
    """Stop only the independent geometry subprocess if RAM/swap collapses.

    The physical Expansion source importer and its supervisor must NEVER be
    signaled by this function. They have separate PID/process groups.
    """
    with subprocess.Popen(command,env=env,stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE,text=True,
                          start_new_session=True) as child:
        elapsed=0
        while True:
            try:
                out,err=child.communicate(timeout=min(interval,timeout-elapsed))
                if child.returncode:
                    raise RuntimeError(err[-1600:] or f'Geometry trainer exited {child.returncode}')
                return out,err
            except subprocess.TimeoutExpired:
                elapsed+=interval
                report=hardware_health()
                if elapsed>=timeout or geometry_emergency_pressure(report):
                    try:os.killpg(child.pid,signal.SIGTERM)
                    except ProcessLookupError:pass
                    try:child.communicate(timeout=10)
                    except subprocess.TimeoutExpired:
                        try:os.killpg(child.pid,signal.SIGKILL)
                        except ProcessLookupError:pass
                        child.communicate()
                    cause='timeout' if elapsed>=timeout else 'critical RAM/swap pressure'
                    raise RuntimeError('Geometry-only child stopped for safety: '+cause)


def valid_geometry_checkpoint(folder,expected_count=None,source_ids=None,deep=False):
    """Verify finished weights and exact embedded source evidence before reuse."""
    try:
        metadata=json.loads((folder/'training-manifest.json').read_text())
        count=metadata['trainingExamplesVerified']
        if (metadata.get('schema')!='exo.garmentcodedata-v2.geometry-training.v1'
            or type(count) is not int or count<=0
            or (expected_count is not None and count!=expected_count)):
            return False
        load_initial_checkpoint(folder/'geometry-encoder-v1.npz')
        with np.load(folder/'source-embeddings-v1.npz',allow_pickle=False) as arrays:
            ids=arrays['sourceIds']; embeddings=arrays['embeddings']
            if (ids.ndim!=1 or len(ids)!=count or embeddings.shape!=(count,16)
                or not np.isfinite(embeddings).all()):return False
            names=set(map(str,ids))
            if len(names)!=count or (source_ids is not None and names!=source_ids):return False
        metrics=metadata.get('metrics',{})
        if deep and (metrics.get('fullDatasetOptimization') is not True
                     or metrics.get('optimizerTrainingExamples')!=count
                     or metrics.get('heldoutMetricsIndependent') is not False):return False
        return True
    except (OSError,ValueError,KeyError,TypeError,EOFError,IndexError):
        return False


def indexed_source_ids(root):
    with sqlite3.connect(root/'data/pattern-index.sqlite3',timeout=30) as db:
        return {f'{body}/{batch:02d}/{element}' for body,batch,element in
                db.execute('SELECT body,batch,element FROM patterns')}


def determine_next_training(root:Path,first_target=60000,increment=10000):
    """The floor uses *completed* original archival JSON, not index guesses."""
    with sqlite3.connect(root/'data/pattern-index.sqlite3',timeout=15) as db:
        rows=db.execute('SELECT specification_count FROM archived_batches').fetchall()
    available=sum(n for (n,) in rows)
    done=0
    previous=None
    for manifest in (root/'training').glob('remote-geometry-*/training-manifest.json'):
        try:
            data=json.loads(manifest.read_text())
            if data['schema']!='exo.garmentcodedata-v2.geometry-training.v1':continue
            count=data['trainingExamplesVerified']
            model=manifest.parent/'geometry-encoder-v1.npz'
            if isinstance(count,int) and count>done and valid_geometry_checkpoint(manifest.parent):
                done=count;previous=model
        except (ValueError,KeyError,OSError):continue
    goal=max(first_target,done+increment)
    return available,done,goal,previous


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--first-target',type=int,default=60000)
    parser.add_argument('--increment',type=int,default=10000)
    parser.add_argument('--epochs',type=int,default=45)
    parser.add_argument('--deep-pass',action='store_true',
        help='Second fine-tune on every original, starting from finished full-corpus geometry weights')
    args=parser.parse_args(argv)
    root=args.root.resolve()
    if not (root/'data/pattern-index.sqlite3').is_file():
        print('Original Expansion volume unavailable; no training files written')
        return 0
    training=root/'training'
    status=training/'geometry-offload-status.json'
    lock=Path.home()/'Library/Caches/exo-jarvis-geometry-seam-compute.lock'
    lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('a+') as fh:
        try:fcntl.flock(fh,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            atomic_status(status,'waiting_for_other_training_job',
                reason='Shared Jarvis geometry/seam compute lock is occupied')
            return 0
        # The currently running seam job was launched before cross-model lock
        # deployment. Until that version exits, still refuse concurrent use.
        existing=subprocess.run(['/usr/bin/pgrep','-f',
            'train_garmentcode_seams_streaming.py --root'],capture_output=True)
        if existing.returncode==0:
            atomic_status(status,'waiting_for_seam_training',nextTarget=args.first_target)
            return 0
        evaluation=subprocess.run(['/usr/bin/pgrep','-f',
            'suggest_garmentcode_seams.py --checkpoint'],capture_output=True)
        if evaluation.returncode==0:
            atomic_status(status,'waiting_for_seam_evaluation',nextTarget=args.first_target)
            return 0
        try:
            available,done,goal,previous=determine_next_training(root,args.first_target,args.increment)
            source_snapshot=full_source_snapshot(root/'data/pattern-index.sqlite3')
        except (ValueError,sqlite3.DatabaseError,OSError) as error:
            atomic_status(status,'waiting_for_index',error=str(error)[:500])
            return 0
        if source_snapshot['complete']:
            # Once every original default/random source batch is indexed,
            # converge to ONE full-corpus checkpoint, not another 10K sample.
            goal=available
            if (done>=available and not args.deep_pass and
                valid_geometry_checkpoint(training/f'remote-geometry-full-{available}',available,
                                          indexed_source_ids(root))):
                atomic_status(status,'full_dataset_already_trained',
                    archivedOriginalPatterns=available,trainedGarments=done,
                    archivedSourceBatches=source_snapshot['archivedBatches'])
                return 0
        if args.deep_pass and not source_snapshot['complete']:
            atomic_status(status,'waiting_for_full_source_archive',
                availablePatterns=available,**source_snapshot)
            return 0
        if available<goal:
            atomic_status(status,'waiting_for_more_archives',availablePatterns=available,
                          previouslyTrained=done,nextTarget=goal)
            return 0
        resources=geometry_hardware_health()
        if not resources['resourceReady']:
            atomic_status(status,'waiting_for_idle_resources',availablePatterns=available,
                          previouslyTrained=done,nextTarget=goal,**resources)
            return 0
        initial=previous or training/'geometry-50k-initial-checkpoint.npz'
        if args.deep_pass:
            initial=training/f'remote-geometry-full-{available}'/'geometry-encoder-v1.npz'
        if not initial.is_file() or (args.deep_pass and not
            valid_geometry_checkpoint(initial.parent,available,indexed_source_ids(root))):
            atomic_status(status,'waiting_for_initial_geometry_weights',
                availablePatterns=available,expectedCheckpoint=str(initial))
            return 0
        output=training/(f'remote-geometry-deep-{goal}' if args.deep_pass else
                         f'remote-geometry-full-{goal}' if source_snapshot['complete']
                         else f'remote-geometry-{goal//1000}k')
        if valid_geometry_checkpoint(output,goal,
                indexed_source_ids(root) if source_snapshot['complete'] else None,
                deep=args.deep_pass):
            atomic_status(status,'deep_already_trained' if args.deep_pass else 'already_trained',
                trainedGarments=goal,
                checkpoint=str(output/'geometry-encoder-v1.npz'))
            return 0
        atomic_status(status,'training',availablePatterns=available,
            previouslyTrained=done,targetMinimum=goal,checkpointFolder=str(output),
            fullOriginalDataset=source_snapshot['complete'],
            secondDeepPass=args.deep_pass,
            archivedSourceBatches=source_snapshot['archivedBatches'],**resources)
        try:os.nice(15)
        except OSError:pass
        command=[sys.executable,str(Path(__file__).with_name('train_garmentcode_geometry.py')),
                 '--root',str(root/'data'),'--archive-root',str(root),
                 '--output',str(output),'--minimum-samples',str(goal),
                 '--resume-from',str(initial),'--epochs',str(args.epochs),
                 '--learning-rate','0.00015' if args.deep_pass else '0.0005']
        if args.deep_pass:
            command.append('--train-on-all-verified')
        env={**os.environ,'OPENBLAS_NUM_THREADS':'1',
             'VECLIB_MAXIMUM_THREADS':'1','OMP_NUM_THREADS':'1'}
        try:
            # Larger second 100K+ training pass may take longer on the 8 GiB
            # Intel Mac. The watchdog keeps checking free RAM/swap every 20s.
            run_geometry_with_watchdog(command,env,
                timeout=21600 if args.deep_pass else 10800)
            manifest=json.loads((output/'training-manifest.json').read_text())
            count=manifest['trainingExamplesVerified']
            if count<goal or count>available:
                raise ValueError(f'Invalid trained actual JSON count {count} from {available} archived')
            if not (output/'source-embeddings-v1.npz').is_file():
                raise RuntimeError('Missing full source embeddings for finished geometry model')
            atomic_status(status,'deep_trained' if args.deep_pass else 'trained',
                availablePatterns=available,
                trainedGarments=count,metrics=manifest['metrics'],
                checkpoint=str(output/'geometry-encoder-v1.npz'))
            return 0
        except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired) as error:
            atomic_status(status,'retry_training',availablePatterns=available,
                previouslyTrained=done,nextTarget=goal,error=str(error)[-1600:])
            return 1


if __name__=='__main__':raise SystemExit(main())

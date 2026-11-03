#!/usr/bin/env python3
"""Resource-gated training supervisor on the SECOND, 8 GiB Jarvis Mac.

Operate on read-only original archived JSON and a separate training folder;
the existing Parquet source importer continues as the only writer to source
index. Uses disk-backed features, one-process lock, nice 15 and preflight
memory/load/swap checks so the source importer keeps priority.
"""
from __future__ import annotations

import argparse
from datetime import datetime,timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import hashlib
import numpy as np
from garmentcode_full_source_snapshot import full_source_snapshot
from train_garmentcode_seams import FEATURE_NAMES


def hardware_health():
    load5=os.getloadavg()[1]
    cpus=os.cpu_count() or 1
    free_pct=None
    used_swap=None
    free_swap=None
    try:
        pressure=subprocess.run(['/usr/bin/memory_pressure','-Q'],
            capture_output=True,text=True,check=True,timeout=10)
        match=re.search(r'System-wide memory free percentage:\s*([0-9]+)',pressure.stdout)
        if match:free_pct=int(match.group(1))
    except (OSError,ValueError,subprocess.SubprocessError):pass
    try:
        swap=subprocess.run(['/usr/sbin/sysctl','vm.swapusage'],
            capture_output=True,text=True,check=True,timeout=5)
        match=re.search(r'used\s*=\s*([0-9.]+)M',swap.stdout)
        if match:used_swap=float(match.group(1))
        match=re.search(r'free\s*=\s*([0-9.]+)M',swap.stdout)
        if match:free_swap=float(match.group(1))
    except (OSError,ValueError,subprocess.SubprocessError):pass
    # Prior model runs leave swap occupied long after memory is recovered.
    # For *disk-backed*, single-threaded seam training, require both 42% RAM
    # free AND >=1 GiB spare swap; used swap alone is not a reliable pressure
    # signal. Preserve source importer priority via OS nice + CPU load gate.
    # Unknown RAM/swap values always fail closed.
    healthy=(free_pct is not None and free_pct>=42
             and used_swap is not None and used_swap<=3072
             and free_swap is not None and free_swap>=1024
             and load5<=min(4.0,cpus*0.5))
    return {'resourceReady':healthy,'memoryFreePct':free_pct,
            'swapUsedMiB':used_swap,'swapFreeMiB':free_swap,
            'fiveMinuteLoad':round(load5,2),
            'logicalCPUs':cpus,
            'requirements':'disk-backed seam: memory >=42% free, >=1024 MiB free swap, <=3072 MiB (3 GiB) used swap, load5 <=4.0; active memory-pressure monitor'}


def severe_memory_pressure(resource):
    """Emergency-only stop. Do not stop for stale swap pages or CPU load.

    This leaves safety headroom for the source importer if another process
    consumes RAM after a large seam training process has started.
    """
    memory=resource.get('memoryFreePct')
    spare_swap=resource.get('swapFreeMiB')
    return (memory is not None and memory<20) or \
           (spare_swap is not None and spare_swap<384)


def run_with_memory_watchdog(cmd,env,interval=20,timeout=10800):
    """Run ONLY the seam child in its own killable process group.

    The original source Parquet importer/supervisor is a separate process and
    is never sent a signal by this training watchdog.
    """
    with subprocess.Popen(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,
                          start_new_session=True) as child:
        elapsed=0
        while True:
            try:
                output,error=child.communicate(timeout=min(interval,timeout-elapsed))
                if child.returncode:
                    raise RuntimeError(error[-1600:] or f'Trainer exited {child.returncode}')
                return output,error
            except subprocess.TimeoutExpired:
                elapsed+=interval
                memory=hardware_health()
                if elapsed>=timeout or severe_memory_pressure(memory):
                    try:os.killpg(child.pid,signal.SIGTERM)
                    except ProcessLookupError:pass
                    try:child.communicate(timeout=10)
                    except subprocess.TimeoutExpired:
                        try:os.killpg(child.pid,signal.SIGKILL)
                        except ProcessLookupError:pass
                        child.communicate()
                    raise RuntimeError('Remote seam fit stopped for safety: '
                        +('training timeout' if elapsed>=timeout else 'critical memory pressure'))


def clean_interrupted_feature_cache(output):
    """Delete only orphaned, task-owned scratch arrays; never source archives.

    Call only while the compute lock is held and no child seam worker exists.
    Keep model weights, manifests and verification reports untouched.
    """
    if not output.is_dir():return 0
    removed=0
    for path in output.glob('.seam-features-*'):
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
            removed+=1
    return removed


def best_previous_weights(training,completed):
    """Use only a completed, locally selected seam checkpoint as warm-start."""
    selected=training/'best-seam-model.json'
    if selected.is_file():
        try:
            data=json.loads(selected.read_text())
            path=Path(data['checkpoint']).resolve()
            count=data['trainedGarments']
            if (data.get('schema')=='exo.garmentcodedata-v2.seam-model-selection.v1'
                and count in completed and count>0
                and path.parent.parent==training.resolve()
                and path.name=='seam-compatibility-v1.npz'
                and valid_seam_checkpoint(path.parent,count)):
                return path
        except (KeyError,OSError,ValueError,TypeError):pass
    return None


def valid_seam_checkpoint(folder,expected_count=None,source_fingerprint=None,deep=False):
    """Reject partial manifests, corrupt weights and mismatched source evidence."""
    try:
        meta=json.loads((folder/'training-manifest.json').read_text())
        count=meta['verifiedGarmentsRead']
        fingerprint=meta['verifiedSourceIDsXorSha256']
        if (meta.get('schema')!='exo.garmentcodedata-v2.seam-compatibility.v1'
            or type(count) is not int or count<=0
            or not isinstance(fingerprint,str) or re.fullmatch('[0-9a-f]{64}',fingerprint) is None
            or (expected_count is not None and count!=expected_count)
            or (source_fingerprint is not None and fingerprint!=source_fingerprint)
            or type(meta.get('actualPairExamples')) is not int or meta['actualPairExamples']<=0):
            return False
        with np.load(folder/'seam-compatibility-v1.npz',allow_pickle=False) as arrays:
            if tuple(arrays['featureNames'])!=tuple(FEATURE_NAMES):return False
            dims=len(FEATURE_NAMES)
            expected={'mean':(dims,),'std':(dims,), 'w1':(dims,32),
                      'b1':(32,), 'w2':(32,1),'b2':(1,)}
            for name,shape in expected.items():
                arr=arrays[name]
                if arr.shape!=shape or not np.isfinite(arr).all():return False
                if name=='std' and (arr<=0).any():return False
        metrics=meta.get('metrics',{})
        if deep and (metrics.get('fullDatasetOptimization') is not True
                     or metrics.get('optimizerPairCount')!=meta['actualPairExamples']
                     or metrics.get('heldoutMetricsIndependent') is not False):return False
        return True
    except (OSError,ValueError,KeyError,TypeError,EOFError,IndexError):
        return False


def indexed_source_fingerprint(root):
    digest=0
    with sqlite3.connect(root/'data/pattern-index.sqlite3',timeout=30) as db:
        for body,batch,element in db.execute('SELECT body,batch,element FROM patterns'):
            digest ^= int.from_bytes(hashlib.sha256(
                f'{body}/{batch:02d}/{element}'.encode()).digest(),'big')
    return f'{digest:064x}'


def atomic_status(file,phase,schema='exo.garmentcodedata-v2.jarvis-seam-offload.v1',**fields):
    file.parent.mkdir(parents=True,exist_ok=True)
    obj={'schema':schema,
         'checkedAt':datetime.now(timezone.utc).isoformat(),
         'state':phase,**fields}
    tmp=file.with_suffix('.tmp')
    tmp.write_text(json.dumps(obj,indent=2)+'\n')
    os.replace(tmp,file)
    print(json.dumps(obj),flush=True)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True,help='Original /Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2')
    parser.add_argument('--first-target',type=int,default=30000)
    parser.add_argument('--increment',type=int,default=10000)
    parser.add_argument('--epochs',type=int,default=18)
    parser.add_argument('--deep-pass',action='store_true',
        help='Second validated fine-tuning on all original source JSONs, initialized from the full-corpus seam checkpoint')
    parser.add_argument('--test-limit',type=int,default=0,help='Run an isolated small-scale check without changing 30K target')
    args=parser.parse_args(argv)
    root=args.root.resolve()
    training=root/'training'
    status=training/'seam-offload-status.json'
    if args.first_target<1000 or args.increment<1000 or args.epochs<1:
        parser.error('Invalid training target or epochs')
    if not (root/'data/pattern-index.sqlite3').is_file():
        # When disk is disconnected avoid accidentally creating an empty
        # /Volumes/Expansion mountpoint on the system volume.
        print('Original Expansion dataset drive is not mounted',file=sys.stderr)
        return 0

    lock=Path.home()/'Library/Caches/exo-jarvis-seam-offload.lock'
    lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('a+') as fh:
        try:fcntl.flock(fh,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print('Existing seam offload worker still running; do not duplicate it')
            return 0
        # Share a compute lock with the separate queued geometry trainer, so
        # future Jarvis jobs never compete with each other on this 8 GiB Mac.
        # The first 30K seam worker predates this lock: geometry also checks
        # its process explicitly until that worker finishes.
        shared=lock.with_name('exo-jarvis-geometry-seam-compute.lock').open('a+')
        try:fcntl.flock(shared,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            shared.close()
            atomic_status(status,'waiting_for_other_training_job',
                reason='Shared Jarvis geometry/seam compute lock is occupied')
            print('Jarvis geometry training occupies the compute slot; defer seam training')
            return 0
        geometry=subprocess.run(['/usr/bin/pgrep','-f',
            'train_garmentcode_geometry.py --root'],capture_output=True)
        if geometry.returncode==0:
            shared.close()
            atomic_status(status,'waiting_for_geometry_training')
            print('Geometry source training still active; defer seam training')
            return 0
        evaluation=subprocess.run(['/usr/bin/pgrep','-f',
            'suggest_garmentcode_seams.py --checkpoint'],capture_output=True)
        if evaluation.returncode==0:
            shared.close()
            atomic_status(status,'waiting_for_seam_evaluation')
            print('Seam benchmark running; defer another large training pass')
            return 0
        with sqlite3.connect(root/'data/pattern-index.sqlite3',timeout=15) as db:
            rows=db.execute('SELECT body,batch,specification_count FROM archived_batches').fetchall()
        available=sum(row[2] for row in rows)
        completed=[]
        for path in training.glob('remote-seam-*/training-manifest.json'):
            if path.parent.name.startswith('remote-seam-smoke-'):
                continue
            try:
                record=json.loads(path.read_text())
                if record['schema']=='exo.garmentcodedata-v2.seam-compatibility.v1':
                    if valid_seam_checkpoint(path.parent):
                        completed.append(record['verifiedGarmentsRead'])
            except (ValueError,KeyError,OSError):pass
        done=max(completed,default=0)
        target=args.test_limit or max(args.first_target,done+args.increment)
        previous=best_previous_weights(training,completed)
        snapshot=full_source_snapshot(root/'data/pattern-index.sqlite3')
        if snapshot['complete'] and not args.test_limit:
            target=available
            if (done>=available and not args.deep_pass and
                valid_seam_checkpoint(training/f'remote-seam-full-{available}',available,
                                      indexed_source_fingerprint(root))):
                atomic_status(status,'full_dataset_already_trained',
                    archivedOriginalPatterns=available,trainedGarments=done,
                    archivedSourceBatches=snapshot['archivedBatches'])
                return 0
        if args.deep_pass and not snapshot['complete']:
            atomic_status(status,'waiting_for_full_source_archive',
                          availablePatterns=available,**snapshot)
            return 0
        if args.deep_pass and not args.test_limit:
            # Deep learning must resume from the verified first full-corpus
            # model, NOT from the selected 40K baseline or an older version.
            previous=training/f'remote-seam-full-{available}'/'seam-compatibility-v1.npz'
            if not valid_seam_checkpoint(previous.parent,available,
                                         indexed_source_fingerprint(root)):
                atomic_status(status,'waiting_for_initial_full_seam_checkpoint',
                              availablePatterns=available,requiredCheckpoint=str(previous))
                return 0
        if available<target:
            atomic_status(status,'waiting_for_more_archives',availablePatterns=available,
                completedBatches=len(rows),alreadyTrained=done,nextTrainingTarget=target)
            return 0
        resources=hardware_health()
        if not resources['resourceReady']:
            atomic_status(status,'waiting_for_idle_resources',availablePatterns=available,
                alreadyTrained=done,nextTrainingTarget=target,**resources)
            return 0
        output=training/(f'remote-seam-smoke-{target}' if args.test_limit else
            f'remote-seam-deep-{target}' if args.deep_pass else
            f'remote-seam-full-{target}' if snapshot['complete'] else f'remote-seam-{target//1000}k')
        # Never overwrite the last completed model when new training fails.
        if valid_seam_checkpoint(output,target,
                indexed_source_fingerprint(root) if snapshot['complete'] and not args.test_limit else None,
                deep=args.deep_pass):
            atomic_status(status,'deep_already_trained' if args.deep_pass else 'already_trained',
                trainedGarments=target,
                checkpoint=str(output/'seam-compatibility-v1.npz'))
            return 0
        # Earlier stopped runs might have left their >GB memmap files behind.
        # With both resource locks held and no seam child running, those are
        # safe to reclaim before new extraction. Never remove checkpoints.
        clean_interrupted_feature_cache(output)
        # Protect importer CPU priority. OpenBLAS explicitly single threaded.
        try:os.nice(15)
        except OSError:pass
        cmd=[sys.executable,str(Path(__file__).with_name('train_garmentcode_seams_streaming.py')),
             '--root',str(root/'data'),'--archive-root',str(root),
             '--output',str(output),'--max-patterns',str(target),
             '--epochs',str(args.epochs)]
        if previous and not args.test_limit:
            cmd.extend(['--resume-from',str(previous),'--learning-rate',
                        '0.0002' if args.deep_pass else '0.0005'])
        if args.deep_pass:
            cmd.append('--train-on-all-verified')
        atomic_status(status,'training',availablePatterns=available,
            alreadyTrained=done,nextTrainingTarget=target,
            checkpointFolder=str(output),
            fullOriginalDataset=snapshot['complete'],
            secondDeepPass=args.deep_pass,
            archivedSourceBatches=snapshot['archivedBatches'],
            continuedFromCheckpoint=str(previous) if previous and not args.test_limit else None,
            **resources)
        env={**os.environ,'OPENBLAS_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1',
             'MKL_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
        try:
            run_with_memory_watchdog(cmd,env,
                timeout=21600 if args.deep_pass else 10800)
            manifest=json.loads((output/'training-manifest.json').read_text())
            if manifest['verifiedGarmentsRead']!=target:
                raise RuntimeError('Training count did not meet target; checkpoint cannot be trusted')
            atomic_status(status,'deep_trained' if args.deep_pass else 'trained',
                availablePatterns=available,
                trainedGarments=target,metrics=manifest['metrics'],
                checkpoint=str(output/'seam-compatibility-v1.npz'))
            return 0
        except (OSError,RuntimeError,ValueError,subprocess.TimeoutExpired) as error:
            clean_interrupted_feature_cache(output)
            atomic_status(status,'retry_training',availablePatterns=available,
                alreadyTrained=done,nextTrainingTarget=target,error=str(error)[-1600:])
            return 1


if __name__=='__main__':sys.exit(main())

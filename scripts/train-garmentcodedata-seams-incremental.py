#!/usr/bin/env python3
"""Incrementally train EXO's verified seam-ranking research model.

Runs on the primary Mac; never touches the remote import writer. Waits until
the geometry archive-sync job has cached whole SHA-256 verified sewing JSON
TAR batches. Builds new models in versioned 10k-size steps; previous weights
and reports remain untouched. Evaluates model *promotion* on grouped
validation garments, reserving the test split for independent reporting.
"""
from __future__ import annotations

import argparse
from datetime import datetime,timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

from garmentcode_training_resources import resource_health


ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2'
TOOLS=ROOT/'download/garment-dxf-library-20261023/tools'


def source_hash(path):
    digest=hashlib.sha256()
    with path.open('rb') as fh:
        for block in iter(lambda:fh.read(1024*1024),b''):
            digest.update(block)
    return digest.hexdigest()


def available_verified_sources(root):
    """Count complete archive JSONs, NOT just unmaterialized SQLite rows."""
    cache=root/'training/remote-archive-cache'
    with sqlite3.connect(root/'pattern-index.sqlite3',timeout=10) as db:
        rows=db.execute('SELECT body,batch,archive_sha256,archive_bytes,specification_count FROM archived_batches ORDER BY body,batch').fetchall()
        index_count=db.execute('SELECT count(*) FROM patterns').fetchone()[0]
    count=0;verified=0;missing=[]
    for body,batch,sha,size,specs in rows:
        if body not in ('default','random') or not isinstance(batch,int) or batch<0:
            raise ValueError('Unexpected source archive identity in SQLite')
        file=cache/'archives'/body/f'batch-{batch:02d}-specifications.tar.gz'
        if file.is_file() and file.stat().st_size==size and source_hash(file)==sha:
            count+=specs;verified+=1
        else:missing.append(f'{body}/{batch:02d}')
    return {'verifiedSourcePatterns':count,'indexedPatterns':index_count,
            'cachedVerifiedBatches':verified,'missingBatches':missing}


def existing_checkpoints(root):
    versions=[]
    for folder in sorted((root/'training').glob('seam-compatibility-*')):
        manifest=folder/'training-manifest.json'
        model=folder/'seam-compatibility-v1.npz'
        if not manifest.is_file() or not model.is_file():continue
        try:
            data=json.loads(manifest.read_text())
            count=data['verifiedGarmentsRead']
            if data.get('schema')!='exo.garmentcodedata-v2.seam-compatibility.v1' or not isinstance(count,int):continue
            versions.append((count,model))
        except (ValueError,KeyError,OSError):continue
    return sorted(versions)


def status(path,state,**kwargs):
    path.parent.mkdir(parents=True,exist_ok=True)
    payload={'schema':'exo.garmentcodedata-v2.incremental-seam-training.v1',
             'checkedAt':datetime.now(timezone.utc).isoformat(),'state':state,**kwargs}
    temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload,indent=2)+'\n')
    os.replace(temporary,path)
    print(json.dumps(payload),flush=True)
    return payload


def validation_result(root,model,count=100):
    checkpoint=Path(model)
    cmd=[sys.executable,str(TOOLS/'suggest_garmentcode_seams.py'),
         '--checkpoint',str(checkpoint),'--root',str(root),
         '--archive-root',str(root/'training/remote-archive-cache'),
         '--evaluate-test','--evaluate-split','validation','--max-garments',str(count)]
    result=subprocess.run(cmd,capture_output=True,text=True,timeout=600,check=True,
                          env={**os.environ,'OPENBLAS_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1'})
    return json.loads(result.stdout)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=DATA)
    parser.add_argument('--first-target',type=int,default=30000)
    parser.add_argument('--increment',type=int,default=10000)
    parser.add_argument('--epochs',type=int,default=24)
    parser.add_argument('--dry-run',action='store_true',help='Validate available sources and next size without training')
    args=parser.parse_args(argv)
    if args.increment<1000 or args.first_target<1000 or args.epochs<1:
        parser.error('Invalid pattern increment or epochs')
    root=args.root.expanduser().resolve()
    training=root/'training'
    training.mkdir(parents=True,exist_ok=True)
    state=training/'seam-auto-training-status.json'
    with (training/'seam-auto-train.lock').open('a+') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print('Seam training already active; no second training writer')
            return 0
        checked=available_verified_sources(root)
        saved=existing_checkpoints(root)
        prior_count,prior_model=saved[-1] if saved else (0,None)
        target=max(args.first_target,prior_count+args.increment)
        if checked['verifiedSourcePatterns']<target:
            status(state,'waiting_for_more_archives',**checked,
                   trainedGarments=prior_count,nextTrainingTarget=target)
            return 0
        output=training/f'seam-compatibility-{target//1000}k'
        if args.dry_run:
            status(state,'ready_to_train',**checked,
                   trainedGarments=prior_count,nextTrainingTarget=target,
                   nextCheckpoint=str(output))
            return 0
        resources=resource_health(root)
        if not resources['resourceReady']:
            status(state,'waiting_for_idle_resources',**checked,**resources,
                   trainedGarments=prior_count,nextTrainingTarget=target)
            return 0
        # Versioned output; never overwrite the checkpoint currently used in
        # the application or any prior training experiment.
        status(state,'training',**checked,
               trainedGarments=prior_count,nextTrainingTarget=target,
               nextCheckpoint=str(output))
        command=[sys.executable,str(TOOLS/'train_garmentcode_seams.py'),
                 '--root',str(root),'--archive-root',str(training/'remote-archive-cache'),
                 '--max-patterns',str(target),'--epochs',str(args.epochs),
                 '--output',str(output)]
        environment={**os.environ,'OPENBLAS_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1'}
        try:
            result=subprocess.run(command,capture_output=True,text=True,
                env=environment,timeout=1800)
            if result.returncode:
                raise RuntimeError(result.stderr[-2000:] or f'Trainer exit {result.returncode}')
            manifest=json.loads((output/'training-manifest.json').read_text())
            if manifest['verifiedGarmentsRead']<target:
                raise RuntimeError(f'Trainer saved only {manifest["verifiedGarmentsRead"]} of {target} required verified garments')
            candidate=validation_result(root,output/'seam-compatibility-v1.npz')
            baseline=validation_result(root,prior_model) if prior_model else None
            current_score=candidate['top1PartnerRecall']
            previous_score=baseline['top1PartnerRecall'] if baseline else -1
            improved=current_score>previous_score
            comparison={'candidate':candidate,'previous':baseline,
                        'candidateCheckpoint':str(output/'seam-compatibility-v1.npz'),
                        'previousCheckpoint':str(prior_model) if prior_model else None,
                        'selectedBy':'top1PartnerRecall on fixed, garment-disjoint validation split',
                        'improvedOverPrevious':improved}
            (output/'validation-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
            selection=training/'best-seam-model.json'
            if improved or not selection.is_file():
                # Keep a usable pointer to the best *validated* prior model
                # even when the latest size-based training run regresses.
                selected_model=(output/'seam-compatibility-v1.npz') if improved else prior_model
                selected_count=target if improved else prior_count
                selected_score=current_score if improved else previous_score
                if selected_model is not None:
                    temporary=selection.with_suffix('.tmp')
                    temporary.write_text(json.dumps({'checkpoint':str(selected_model),
                        'trainedGarments':selected_count,
                        'validationTop1PartnerRecall':selected_score},indent=2)+'\n')
                    os.replace(temporary,selection)
            status(state,'trained_and_selected' if improved else 'trained_not_selected',**checked,
                   trainedGarments=target,nextTrainingTarget=target+args.increment,
                   candidateValidationTop1=current_score,
                   previousValidationTop1=previous_score,
                   checkpoint=str(output/'seam-compatibility-v1.npz'))
            return 0
        except (OSError,RuntimeError,subprocess.TimeoutExpired,subprocess.CalledProcessError,ValueError,KeyError) as error:
            status(state,'retry_training',**checked,trainedGarments=prior_count,
                   nextTrainingTarget=target,error=str(error)[-1500:])
            return 1


if __name__=='__main__':sys.exit(main())

#!/usr/bin/env python3
"""Memory-bounded, disk-backed seam trainer for the remote Jarvis Mac.

Reads SHA256-verified original JSON TAR files and streams derived features to
temporary binary arrays, keeping at most one small feature buffer resident.
Optimizes in mini-batches, with independent garment-disjoint validation/test.
No source pattern, original Parquet, or importer metadata is ever modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile

os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
os.environ.setdefault('VECLIB_MAXIMUM_THREADS','1')
import numpy as np

from garmentcode_checkpoint_io import atomic_json,atomic_npz
from train_garmentcode_geometry import verified_documents
from train_garmentcode_seams import (
    FEATURE_NAMES,_auc,_average_precision,_predict,
    examples_for_garment,
)
from suggest_garmentcode_seams import load_model


def stream_pairs(root,archive_root,staging,max_patterns,progress=None,flush_examples=16000):
    """Stream per-garment extracted pairs to bounded binary files.

    The source index must list completed, SHA256-verified archived batches;
    `verified_documents` additionally re-hashes each JSON specification.
    """
    paths={name:staging/(name+'.bin') for name in ('x','y','split')}
    pending_x=[];pending_y=[];pending_split=[]
    count=used=positive=examples=0
    source_ids_xor=0

    def flush(fh):
        nonlocal examples
        if not pending_y:return
        np.stack(pending_x).astype(np.float32).tofile(fh['x'])
        np.asarray(pending_y,dtype=np.uint8).tofile(fh['y'])
        np.asarray(pending_split,dtype=np.uint8).tofile(fh['split'])
        examples+=len(pending_y)
        pending_x.clear();pending_y.clear();pending_split.clear()

    with paths['x'].open('wb') as fx, paths['y'].open('wb') as fy, paths['split'].open('wb') as fs:
        files={'x':fx,'y':fy,'split':fs}
        for source_id,group,doc in verified_documents(root,archive_root):
            count+=1
            # Order-independent, bounded-memory fingerprint for *every*
            # SHA-verified original JSON, including patterns with no usable
            # sewn edges. It can be independently compared with the complete
            # SQLite source catalog to prove corpus coverage beyond counts.
            source_ids_xor^=int.from_bytes(hashlib.sha256(source_id.encode()).digest(),'big')
            split=int.from_bytes(hashlib.sha256(group.encode()).digest()[:4],'big')%10
            seed=int.from_bytes(hashlib.sha256(source_id.encode()).digest()[:8],'big')
            features,labels=examples_for_garment(doc,np.random.default_rng(seed))
            if features:
                used+=1
                pending_x.extend(features)
                pending_y.extend(labels)
                pending_split.extend([split]*len(labels))
                positive+=sum(labels)
            if len(pending_y)>=flush_examples:
                flush(files)
            if progress and count%1000==0:
                progress({'phase':'extracting','verifiedGarmentsRead':count,
                          'pairExamples':examples+len(pending_y),'positives':positive})
            if max_patterns and count>=max_patterns:break
        flush(files)
    if used<50 or examples<=0:
        raise ValueError('Insufficient verified garments with true sewn edges')
    x=np.memmap(paths['x'],mode='r',dtype=np.float32,shape=(examples,len(FEATURE_NAMES)))
    y=np.memmap(paths['y'],mode='r',dtype=np.uint8,shape=(examples,))
    split=np.memmap(paths['split'],mode='r',dtype=np.uint8,shape=(examples,))
    return x,y,split,{'verifiedGarmentsRead':count,'garmentsWithUsableStitches':used,
                       'actualPairExamples':examples,'positivePairs':positive,
                       'negativePairs':examples-positive,
                       'verifiedSourceIDsXorSha256':f'{source_ids_xor:064x}'}


def warm_start_weights(checkpoint,mean,std):
    """Rebase a validated seam MLP to the new train-only feature statistics.

    On unclipped features this preserves the function of the saved model;
    the [-10,10] clip can slightly alter extreme outlier predictions.
    """
    saved=load_model(checkpoint)
    old_mean=saved['mean'];old_std=saved['std']
    result={name:saved[name].copy() for name in ('w1','b1','w2','b2')}
    # (x-mean)/std -> (x-old_mean)/old_std through first layer.
    result['b1']+=((mean-old_mean)/old_std)@result['w1']
    result['w1']*=(std/old_std)[:,None]
    if not all(np.isfinite(v).all() for v in result.values()):
        raise ValueError('Non-finite warm-start weights after normalization rebase')
    return result


def train_streaming(x,y,split,epochs=24,seed=42,batch_size=384,progress=None,
                    initial_checkpoint=None,learning_rate=0.001,train_on_all=False):
    """Mini-batch neural fit without allocating a normalized full-dataset copy."""
    rng=np.random.default_rng(seed)
    train=np.flatnonzero(split<8)
    val=np.flatnonzero(split==8)
    test=np.flatnonzero(split==9)
    if min(len(train),len(val),len(test))<10:
        raise ValueError('Insufficient garment-disjoint train/validation/test pairs')
    if train_on_all:
        # Only the separate SECOND refit uses every verified edge candidate
        # for gradient updates. The initial checkpoint retains true holdouts.
        train=np.arange(len(y))

    # Stable train-only normalization in bounded chunks; avoid x[train] copies.
    total=np.zeros(x.shape[1],dtype=np.float64)
    square=np.zeros(x.shape[1],dtype=np.float64)
    for block in np.array_split(train,max(1,math.ceil(len(train)/25000))):
        data=np.asarray(x[block],dtype=np.float64)
        total+=data.sum(axis=0)
        square+=np.square(data).sum(axis=0)
    mean=(total/len(train)).astype(np.float32)
    std=np.maximum(np.sqrt(np.maximum(square/len(train)-(total/len(train))**2,0)),0.02).astype(np.float32)

    def scaled(index):
        return np.clip((np.asarray(x[index],dtype=np.float32)-mean)/std,-10,10)

    def rank_scores(index,w):
        result=[]
        for block in np.array_split(index,max(1,math.ceil(len(index)/20000))):
            _,p=_predict(scaled(block),w)
            result.append(p.ravel())
        return np.concatenate(result)

    if not 0<learning_rate<=0.01:
        raise ValueError('Learning rate must be positive and <=0.01')
    if initial_checkpoint is not None:
        weights=warm_start_weights(initial_checkpoint,mean,std)
    else:
        weights={'w1':(rng.normal(size=(x.shape[1],32))/math.sqrt(x.shape[1])).astype(np.float32),
                 'b1':np.zeros(32,dtype=np.float32),
                 'w2':(rng.normal(size=(32,1))/math.sqrt(32)).astype(np.float32),
                 'b2':np.zeros(1,dtype=np.float32)}
    m={k:np.zeros_like(v) for k,v in weights.items()}
    s={k:np.zeros_like(v) for k,v in weights.items()}
    initial_ap=(_average_precision(np.asarray(y[val]),rank_scores(val,weights))
                if initial_checkpoint is not None else None)
    best={k:v.copy() for k,v in weights.items()} if initial_checkpoint is not None else None
    best_ap=initial_ap if initial_ap is not None else -1.0
    bad=0;step=0;history=[]
    for epoch in range(epochs):
        order=rng.permutation(train)
        for block in np.array_split(order,max(1,math.ceil(len(order)/batch_size))):
            data=scaled(block)
            label=np.asarray(y[block],dtype=np.float32)[:,None]
            hidden,pred=_predict(data,weights)
            delta=(pred-label)/len(block)
            grads={'w2':hidden.T@delta,'b2':delta.sum(0)}
            dh=(delta@weights['w2'].T)*(1-hidden**2)
            grads['w1']=data.T@dh;grads['b1']=dh.sum(0)
            step+=1
            for key,grad in grads.items():
                clipped=np.clip(grad,-2,2)
                m[key]=0.9*m[key]+0.1*clipped
                s[key]=0.999*s[key]+0.001*grad*grad
                weights[key]-=learning_rate*(m[key]/(1-0.9**step))/(np.sqrt(s[key]/(1-0.999**step))+1e-7)
        score=_average_precision(np.asarray(y[val]),rank_scores(val,weights))
        history.append({'epoch':epoch+1,'validationAveragePrecision':round(score,6)})
        if progress:progress({'phase':'optimizing','epoch':epoch+1,'maxEpochs':epochs,
                              'validationAveragePrecision':round(score,6)})
        if train_on_all:
            # Former holdouts now participate in training. Diagnostic scores
            # cannot determine independent early stopping; save final epoch.
            best_ap=score;best={k:v.copy() for k,v in weights.items()};bad=0
        elif score>best_ap+1e-4:
            best_ap=score;best={k:v.copy() for k,v in weights.items()};bad=0
        else:bad+=1
        if not train_on_all and bad>=10:break
    weights=best
    probs=rank_scores(test,weights)
    ground_truth=np.asarray(y[test])
    length_scores=-np.asarray(x[test,2])
    metrics={
        'trainingPairCount':len(train),'validationPairCount':len(val),'testPairCount':len(test),
        'trainingEpochs':len(history),
        'positiveTestFraction':round(float(ground_truth.mean()),6),
        'validationAveragePrecision':round(best_ap,6),
        'testAveragePrecision':round(_average_precision(ground_truth,probs),6),
        'testROCAUC':round(_auc(ground_truth,probs),6),
        'chordLengthBaselineAveragePrecision':round(_average_precision(ground_truth,length_scores),6),
        'chordLengthBaselineROCAUC':round(_auc(ground_truth,length_scores),6),
    }
    metrics.update({'fullDatasetOptimization':bool(train_on_all),
                    'optimizerPairCount':len(train),
                    'heldoutMetricsIndependent':not train_on_all,
                    'evaluationNote':('IN-SAMPLE diagnostics after fitting every source edge example; use the first full-corpus model for independent validation/test scores'
                        if train_on_all else 'Garment-disjoint validation/test excluded from gradient training')})
    if initial_checkpoint is not None:
        metrics.update({'initialValidationAveragePrecision':round(initial_ap,6),
                        'fineTuneLearningRate':learning_rate,
                        'warmStartOptimization':'weights restored; Adam moments restarted; initial checkpoint retained if validation fails to improve'})
    return weights,mean,std,metrics,history


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--archive-root',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--max-patterns',type=int,default=30000)
    parser.add_argument('--epochs',type=int,default=24)
    parser.add_argument('--resume-from',type=Path,help='Verified seam checkpoint for feature-normalized weight warm-start')
    parser.add_argument('--learning-rate',type=float,default=0.001)
    parser.add_argument('--train-on-all-verified',action='store_true',
                        help='Second pass only: train on all verified edge pairs; diagnostic scores are no longer held-out')
    args=parser.parse_args(argv)
    root=args.root.resolve();archive_root=args.archive_root.resolve();output=args.output.resolve()
    output.mkdir(parents=True,exist_ok=True)
    def progress(update):
        atomic_json(output/'training-progress.json',
            {'schema':'exo.garmentcodedata-v2.disk-backed-seam-training-progress.v1',**update})
    progress({'phase':'starting','maxGarments':args.max_patterns})
    with tempfile.TemporaryDirectory(prefix='.seam-features-',dir=output) as temp:
        x,y,split,count=stream_pairs(root,archive_root,Path(temp),args.max_patterns,progress)
        progress({'phase':'training','epoch':0,'maxEpochs':args.epochs,**count})
        weights,mean,std,metrics,history=train_streaming(x,y,split,args.epochs,progress=progress,
            initial_checkpoint=args.resume_from,learning_rate=args.learning_rate,
            train_on_all=args.train_on_all_verified)
    # Put the manifest after the full validated model exists. These writes
    # never touch the remote source/index or existing previous checkpoints.
    atomic_npz(output/'seam-compatibility-v1.npz',**weights,mean=mean,std=std,
               featureNames=np.asarray(FEATURE_NAMES))
    manifest={
        'schema':'exo.garmentcodedata-v2.seam-compatibility.v1',
        'modelType':'within-garment sewn-edge compatibility classifier',
        **count,'numberOfFeatures':len(FEATURE_NAMES),
        'trainingBackend':'disk-backed-verified-original-json, bounded batches',
        'splitMethod':'SHA256(source element) grouped at entire garment level',
        'negativeSampling':'4 non-stitched candidate pairs per true seam, mostly length-matched hard negatives',
        'limitations':'Research-only edge pairing. Unstitched candidates are not proof of impossible seams. No production CAD, DXF or auto-sewing certification.',
        'source':'Korosteleva et al., ETH GarmentCodeData v2 (2024)',
        'sourceDOI':'https://doi.org/10.3929/ethz-b-000690432','license':'CC BY 4.0',
        'metrics':metrics,'validationHistory':history,
        'continuedFromCheckpoint':str(args.resume_from.resolve()) if args.resume_from else None,
    }
    atomic_json(output/'training-manifest.json',manifest)
    progress({'phase':'completed','verifiedGarmentsRead':count['verifiedGarmentsRead'],'metrics':metrics})
    print(json.dumps({k:v for k,v in manifest.items() if k!='validationHistory'},indent=2))
    return manifest


if __name__=='__main__':main()

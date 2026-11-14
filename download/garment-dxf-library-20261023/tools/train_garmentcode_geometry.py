#!/usr/bin/env python3
"""Train EXO's first *geometry-feature* encoder from verified sewing JSON.

This is a small self-supervised masked-feature reconstruction model, NOT a
generative pattern CAD model and NOT factory-approved DXF training. A model
trained on a subset must never claim to have seen all indexed examples.

Examples:
  python3 tools/train_garmentcode_geometry.py --root garmentcodedata-v2
  python3 tools/train_garmentcode_geometry.py --root garmentcodedata-v2 \
    --archive-root ~/ExpansionCloud/EXO-ClothCraft/GarmentCodeData-v2 \
    --minimum-samples 50000

Requires only numpy, standard-library sqlite3, and source JSONs or archived
JSON tarballs from a verified source. Source inputs remain read-only.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sqlite3
import tarfile
from pathlib import Path

import numpy as np
from garmentcode_checkpoint_io import atomic_json, atomic_npz


FEATURE_NAMES = [
    'log_panels','log_stitches','log_vertices','log_edges','log_curved_edges',
    'log_total_panel_area','log_total_perimeter','log_total_bbox_area',
    'log_total_x_span','log_total_y_span','log_3d_translation_x_span',
    'log_3d_translation_y_span','log_3d_translation_z_span',
    'mean_vertices_per_panel','std_vertices_per_panel',
    'mean_edges_per_panel','std_edges_per_panel',
    'mean_panel_width','std_panel_width','mean_panel_height','std_panel_height',
    'mean_panel_area','std_panel_area',
    'mean_panel_perimeter','std_panel_perimeter',
    'mean_log_aspect_ratio','std_log_aspect_ratio',
    'mean_bbox_occupancy','std_bbox_occupancy',
    'curved_edge_fraction','stitches_per_panel','vertices_per_edge',
    'arm_panel_fraction','leg_panel_fraction','body_panel_fraction',
    'mean_translation_z','std_translation_z',
    'mean_log_panel_area','std_log_panel_area',
]


def _number(value):
    try:
        x=float(value)
        return x if math.isfinite(x) else 0.0
    except (ValueError, TypeError):
        return 0.0


def _log(value):
    return math.log1p(max(0.0, min(float(value), 1e12)))


def features_from_specification(document):
    """Numeric shape, connectivity and stitch features; no garment ID leakage."""
    pattern=document['pattern']
    panels=pattern['panels']
    if not isinstance(panels, dict) or not panels:
        raise ValueError('No garment panels')
    stitches=pattern.get('stitches') or []
    count=len(panels)
    per_panel=[]
    labels={'arm':0,'leg':0,'body':0}
    translation=[]
    total_edges=total_vertices=total_curves=0
    total_area=total_length=total_bbox=0.0
    all_x=[];all_y=[]
    for panel in panels.values():
        vertices=panel.get('vertices') or []
        edges=panel.get('edges') or []
        if len(vertices)<3 or len(edges)<3:
            raise ValueError('Insufficient panel vertices/edges')
        pts=np.asarray(vertices,dtype=np.float64)
        if pts.ndim!=2 or pts.shape[1]!=2 or not np.isfinite(pts).all():
            raise ValueError('Invalid panel vertices')
        x=pts[:,0];y=pts[:,1]
        w=float(x.max()-x.min());h=float(y.max()-y.min())
        area=abs(float(np.dot(x,np.roll(y,-1))-np.dot(y,np.roll(x,-1))))*0.5
        bbox=w*h
        # Gather edge indices first, then compute all chord lengths in one
        # NumPy operation. Individual tiny np.linalg.norm calls per edge were
        # disproportionately expensive on the 8 GiB Intel offload Mac.
        endpoint_pairs=[]
        curved=0
        for edge in edges:
            ends=edge.get('endpoints') or []
            if len(ends)!=2 or any(not isinstance(j,int) or j<0 or j>=len(pts) for j in ends):
                raise ValueError('Invalid sewing edge topology')
            endpoint_pairs.append(ends)
            curved+=int(bool(edge.get('curvature')))
        pair_indices=np.asarray(endpoint_pairs,dtype=np.int64)
        segment_vectors=pts[pair_indices[:,0]]-pts[pair_indices[:,1]]
        length=float(np.linalg.norm(segment_vectors,axis=1).sum())
        total_edges+=len(edges);total_vertices+=len(pts);total_curves+=curved
        total_area+=area;total_length+=length;total_bbox+=bbox
        all_x.extend((float(x.min()),float(x.max())))
        all_y.extend((float(y.min()),float(y.max())))
        label=str(panel.get('label','')).lower()
        if label in labels:labels[label]+=1
        trans=panel.get('translation') or [0,0,0]
        if not isinstance(trans,(list,tuple)) or len(trans)<3:trans=[0,0,0]
        translation.append([_number(v) for v in trans[:3]])
        per_panel.append((len(pts),len(edges),w,h,area,length,
                          math.log(max(1e-6,w)/max(1e-6,h)),
                          min(1.0, area/max(bbox,1e-6)),math.log1p(max(area,0))))
    vals=np.asarray(per_panel,dtype=np.float64)
    shifts=np.asarray(translation,dtype=np.float64)
    means=vals.mean(axis=0);stds=vals.std(axis=0)
    feature=[
        _log(count),_log(len(stitches)),_log(total_vertices),_log(total_edges),
        _log(total_curves),_log(total_area),_log(total_length),_log(total_bbox),
        _log(max(all_x)-min(all_x)),_log(max(all_y)-min(all_y)),
        *(_log(np.ptp(shifts[:,axis])) for axis in range(3)),
        means[0],stds[0],means[1],stds[1],
        _log(means[2]),_log(stds[2]),_log(means[3]),_log(stds[3]),
        _log(means[4]),_log(stds[4]),_log(means[5]),_log(stds[5]),
        means[6],stds[6],means[7],stds[7],
        total_curves/max(total_edges,1),len(stitches)/count,
        total_vertices/max(total_edges,1),
        labels['arm']/count,labels['leg']/count,labels['body']/count,
        shifts[:,2].mean(),shifts[:,2].std(),
        means[8],stds[8]
    ]
    if len(feature)!=len(FEATURE_NAMES):
        raise RuntimeError('Feature vector definition mismatch')
    return np.asarray(feature,dtype=np.float32)


def records_from_index(db):
    rows=db.execute('SELECT body,batch,element,sha256,source_path FROM patterns ORDER BY body,batch,element')
    return {row[4]:(row[0],row[1],row[2],row[3]) for row in rows}


def verified_documents(root,archive_root=None):
    """Yield SHA-verified original sewing JSON documents for geometry tasks.

    Caller can learn panel topology or seam connectivity from the actual
    original JSON, never just from a metadata row in the EXO catalog.
    """
    db=sqlite3.connect(root/'pattern-index.sqlite3',timeout=30)
    try:
        indexed=records_from_index(db)
        archives={(b,n):(Path(p),digest,size,cnt) for b,n,p,digest,size,cnt in
                  db.execute('SELECT body,batch,cloud_path,archive_sha256,archive_bytes,specification_count FROM archived_batches')}
    finally:
        db.close()
    consumed=set()
    def validate(path,data):
        if path not in indexed or path in consumed:return None
        entry=indexed[path]
        if hashlib.sha256(data).hexdigest()!=entry[3]:
            raise ValueError(f'Incorrect source specification SHA-256: {path}')
        doc=json.loads(data)
        if not isinstance(doc,dict) or not isinstance(doc.get('pattern'),dict):
            raise ValueError('Invalid original sewing specification')
        consumed.add(path)
        return (f'{entry[0]}/{entry[1]:02d}/{entry[2]}',entry[2],doc)

    for file in sorted((root/'specifications').rglob('*_specification.json')):
        path=file.relative_to(root).as_posix()
        item=validate(path,file.read_bytes())
        if item is not None:yield item

    if archive_root is None:return
    for (body,batch),(path,digest,size,expected_count) in sorted(archives.items()):
        source=archive_root/'archives'/body/f'batch-{batch:02d}-specifications.tar.gz'
        if not source.exists():
            continue
        if source.stat().st_size!=size:
            raise ValueError(f'Archive size mismatch: {source}')
        sha=hashlib.sha256()
        with source.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024*1024),b''):
                sha.update(chunk)
        if sha.hexdigest()!=digest:
            raise ValueError(f'Archive failed SHA-256 verification: {source}')
        checked=0
        with tarfile.open(source,mode='r:gz') as archive:
            for member in archive:
                if not member.isfile() or member.size>2_000_000:
                    raise ValueError(f'Invalid tar member in {source}: {member.name}')
                path=member.name
                if path not in indexed or indexed[path][:2]!=(body,batch):
                    raise ValueError(f'Unexpected tar member: {path}')
                checked+=1
                item=validate(path,archive.extractfile(member).read())
                if item is not None:yield item
        if checked!=expected_count:
            raise ValueError(f'Archive source count mismatch: {source}: {checked} vs {expected_count}')


def verified_examples(root,archive_root=None):
    """Yield actual verified geometry features from original sewing JSONs."""
    for sample_id,group,document in verified_documents(root,archive_root):
        yield sample_id,group,features_from_specification(document)


def _forward(x,weights):
    a=np.tanh(x@weights['w1']+weights['b1'])
    z=np.tanh(a@weights['w2']+weights['b2'])
    c=np.tanh(z@weights['w3']+weights['b3'])
    pred=c@weights['w4']+weights['b4']
    return a,z,c,pred


def load_initial_checkpoint(path):
    """Load only known NumPy arrays; reject incompatible/invalid checkpoints."""
    with np.load(path, allow_pickle=False) as saved:
        if list(saved['featureNames']) != FEATURE_NAMES:
            raise ValueError('Checkpoint feature order differs from current geometry extractor')
        dims=[len(FEATURE_NAMES),64,16,64,len(FEATURE_NAMES)]
        weights={}
        for i in range(1,5):
            for key,shape in ((f'w{i}',(dims[i-1],dims[i])),(f'b{i}',(dims[i],))):
                arr=np.asarray(saved[key],dtype=np.float32)
                if arr.shape!=shape or not np.isfinite(arr).all():
                    raise ValueError(f'Invalid checkpoint tensor: {key}')
                weights[key]=arr.copy()
        mean=np.asarray(saved['mean'],dtype=np.float32)
        std=np.asarray(saved['std'],dtype=np.float32)
        if mean.shape!=(dims[0],) or std.shape!=(dims[0],) or (std<=0).any():
            raise ValueError('Invalid checkpoint feature normalization')
        return weights,mean,std


def train(x,group_ids,epochs=70,seed=42,initial_checkpoint=None,learning_rate=0.0015,
          progress_callback=None,train_on_all=False):
    """Masked-geometry training; optionally fine-tune saved weights with fresh Adam.

    The validation mask and grouped holdout remain fixed at the original seed.
    The prior optimizer moments were not serialized, so this is *weight-level*
    continuation, not an exact interruption recovery of the Adam trajectory.
    """
    rng=np.random.default_rng(seed)
    # All variants of the same element share a split; reduces leakage when
    # random- and default-body versions of one design enter future archives.
    splits=np.array([int.from_bytes(hashlib.sha256(k.encode()).digest()[:4],'big')%10 for k in group_ids])
    train_idx=np.flatnonzero(splits<8)
    val_idx=np.flatnonzero(splits==8)
    test_idx=np.flatnonzero(splits==9)
    if min(len(train_idx),len(val_idx),len(test_idx))<10:
        raise ValueError('Insufficient unique source pattern groups for honest train/val/test split')
    # First full-corpus checkpoint retains strictly untouched validation/test
    # examples. The optional SECOND pass then refits all originals, including
    # those former holdouts; its metrics are in-sample diagnostics only.
    optimize_idx=np.arange(len(x)) if train_on_all else train_idx
    mu=x[optimize_idx].mean(axis=0)
    sd=np.maximum(x[optimize_idx].std(axis=0),0.01)
    scaled=np.clip((x-mu)/sd,-8,8).astype(np.float32)
    d=x.shape[1]
    dims=[d,64,16,64,d]
    if initial_checkpoint is not None:
        weights,old_mu,old_sd=load_initial_checkpoint(initial_checkpoint)
        # Keep the first layer functionally equivalent under new train-only
        # normalization (important once additional archived batches arrive).
        weights['b1']+=((mu-old_mu)/old_sd)@weights['w1']
        weights['w1']*=((sd/old_sd)[:,None])
    else:
        weights={f'w{i}':(rng.normal(size=(dims[i-1],dims[i]))*math.sqrt(1.0/dims[i-1])).astype(np.float32) for i in range(1,5)}
        weights.update({f'b{i}':np.zeros(dims[i],dtype=np.float32) for i in range(1,5)})
    adam_m={k:np.zeros_like(v) for k,v in weights.items()}
    adam_v={k:np.zeros_like(v) for k,v in weights.items()}
    val_mask=(np.random.default_rng(seed+20).random(scaled[val_idx].shape)<0.35).astype(np.float32)
    test_mask=(np.random.default_rng(seed+21).random(scaled[test_idx].shape)<0.35).astype(np.float32)
    def score(idx,mask):
        _,_,_,pred=_forward(scaled[idx]*(1-mask),weights)
        return float(np.mean((pred-scaled[idx])**2 * mask)/max(float(mask.mean()),0.01))
    def baseline(idx,mask):
        return float(np.mean(scaled[idx]**2*mask)/max(float(mask.mean()),0.01))
    initial_val=score(val_idx,val_mask) if initial_checkpoint is not None else None
    initial_test=score(test_idx,test_mask) if initial_checkpoint is not None else None
    best={k:v.copy() for k,v in weights.items()} if initial_checkpoint is not None else None
    best_val=initial_val if initial_val is not None else float('inf')
    bad_epochs=0;steps=0;history=[]
    for epoch in range(epochs):
        order=rng.permutation(optimize_idx)
        loss=0.0; batches=0
        for block in np.array_split(order,max(1,math.ceil(len(order)/128))):
            target=scaled[block]
            mask=(rng.random(target.shape)<0.35).astype(np.float32)
            input_x=target*(1-mask)
            a,z,c,pred=_forward(input_x,weights)
            diff=pred-target
            mult=0.3+0.7*mask
            loss+=float(np.mean((diff**2)*mult));batches+=1
            derivative=(2.0/(len(block)*d))*diff*mult
            grads={}
            grads['w4']=c.T@derivative;grads['b4']=derivative.sum(axis=0)
            gc=(derivative@weights['w4'].T)*(1-c*c)
            grads['w3']=z.T@gc;grads['b3']=gc.sum(axis=0)
            gz=(gc@weights['w3'].T)*(1-z*z)
            grads['w2']=a.T@gz;grads['b2']=gz.sum(axis=0)
            ga=(gz@weights['w2'].T)*(1-a*a)
            grads['w1']=input_x.T@ga;grads['b1']=ga.sum(axis=0)
            steps+=1
            for key in weights:
                grad=np.clip(grads[key],-1,1)
                adam_m[key]=0.9*adam_m[key]+0.1*grad
                adam_v[key]=0.999*adam_v[key]+0.001*grad*grad
                corrected_m=adam_m[key]/(1-0.9**steps)
                corrected_v=adam_v[key]/(1-0.999**steps)
                weights[key]-=learning_rate*corrected_m/(np.sqrt(corrected_v)+1e-7)
        val=score(val_idx,val_mask)
        history.append({'epoch':epoch+1,'maskedValidationMSE':round(val,6),
                        'trainLoss':round(loss/max(1,batches),6)})
        if progress_callback:
            progress_callback({'phase':'optimizing','epoch':epoch+1,'maxEpochs':epochs,
                'maskedValidationMSE':round(val,6),
                'averageTrainLoss':round(loss/max(1,batches),6),
                'trainingExamples':len(optimize_idx),'validationExamples':len(val_idx),
                'testExamples':len(test_idx)})
        if train_on_all:
            # No untouched validation examples remain, so do not pretend to
            # perform independent early stopping in the all-example refit.
            best={k:v.copy() for k,v in weights.items()};best_val=val
        elif val<best_val-0.0001:
            best_val=val;best={k:v.copy() for k,v in weights.items()};bad_epochs=0
        else:bad_epochs+=1
        if not train_on_all and bad_epochs>=12:break
    weights=best
    _,embeddings,_,_= _forward(scaled,weights)
    test_loss=score(test_idx,test_mask)
    test_base=baseline(test_idx,test_mask)
    summary={'train':len(optimize_idx),'validation':len(val_idx),'test':len(test_idx),
             'epochs':len(history),'validationMaskedMSE':round(best_val,6),
             'testMaskedMSE':round(test_loss,6),
             'untrainedMeanBaselineTestMSE':round(test_base,6),
             'testImprovementOverBaselinePct':round(100*(1-test_loss/max(test_base,1e-8)),2),
             'encoderDimensions':int(embeddings.shape[1]),
             'splitMethod':'SHA256(source element name) modulo 10 (80/10/10)'}
    summary.update({'fullDatasetOptimization':bool(train_on_all),
                    'optimizerTrainingExamples':len(optimize_idx),
                    'heldoutMetricsIndependent':not train_on_all,
                    'evaluationNote':('IN-SAMPLE diagnostics after refitting on every original; use first full-corpus checkpoint for true heldout metrics'
                        if train_on_all else 'Garment-disjoint validation/test examples excluded from optimizer')})
    if initial_checkpoint is not None:
        summary.update({'initialValidationMaskedMSE':round(initial_val,6),
                        'initialTestMaskedMSE':round(initial_test,6),
                        'fineTuneLearningRate':learning_rate,
                        'optimization':'Adam moments restarted from zero; loaded model weights retained if validation does not improve'})
    return weights,mu,sd,embeddings,summary,history


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True,help='Directory containing local pattern-index.sqlite3')
    parser.add_argument('--archive-root',type=Path,help='ExpansionCloud/GarmentCodeData-v2 directory with archives/{body}/batch-XX tar.gz')
    parser.add_argument('--output',type=Path,help='Checkpoint directory (default inside ignored local data root)')
    parser.add_argument('--minimum-samples',type=int,default=100,help='Fail honestly when required number of verified source JSONs is not available')
    parser.add_argument('--epochs',type=int,default=70)
    parser.add_argument('--resume-from',type=Path,help='Fine-tune the verified geometry checkpoint (weights, not optimizer moments)')
    parser.add_argument('--learning-rate',type=float,default=0.0015)
    parser.add_argument('--train-on-all-verified',action='store_true',
                        help='Second pass only: fit on every original, retaining first-pass checkpoint for independent test scores')
    args=parser.parse_args(argv)
    root=args.root.expanduser().resolve()
    archive_root=args.archive_root.expanduser().resolve() if args.archive_root else None
    output=(args.output.expanduser().resolve() if args.output else root/'training/geometry-encoder-v1')
    output.mkdir(parents=True,exist_ok=True)
    def report_progress(info):
        atomic_json(output/'training-progress.json',
            {'schema':'exo.garmentcodedata-v2.geometry-progress.v1',**info})
    report_progress({'phase':'verifying_original_sources','verifiedPatterns':0,
                     'requiredMinimum':args.minimum_samples})
    ids=[];groups=[];rows=[]
    for sample_id,group,features in verified_examples(root,archive_root):
        ids.append(sample_id);groups.append(group);rows.append(features)
        if len(ids)%1000==0:
            report_progress({'phase':'verifying_original_sources','verifiedPatterns':len(ids),
                'requiredMinimum':args.minimum_samples})
    count=len(rows)
    if count<args.minimum_samples:
        raise RuntimeError(f'Only {count} verified source pattern JSONs accessible; need {args.minimum_samples}. Metadata entries alone are NOT training examples. Reconnect the Expansion Mac and pass --archive-root.')
    x=np.stack(rows)
    if not 0<args.learning_rate<=0.01:
        parser.error('--learning-rate must be positive and <= 0.01')
    checkpoint=args.resume_from.expanduser().resolve() if args.resume_from else None
    report_progress({'phase':'optimizing','verifiedPatterns':count,
        'epoch':0,'maxEpochs':args.epochs})
    weights,mu,sd,embeddings,summary,history=train(x,groups,epochs=args.epochs,
        initial_checkpoint=checkpoint,learning_rate=args.learning_rate,
        progress_callback=report_progress,train_on_all=args.train_on_all_verified)
    report_progress({'phase':'saving_checkpoint','verifiedPatterns':count,
        'metrics':summary})
    atomic_npz(output/'geometry-encoder-v1.npz',**weights,mean=mu,std=sd,
                        featureNames=np.asarray(FEATURE_NAMES),
                        architecture=np.asarray(['masked-feature-mlp-64-16-64']))
    atomic_npz(output/'source-embeddings-v1.npz',
                        sourceIds=np.asarray(ids),embeddings=embeddings.astype(np.float32))
    manifest={
        'schema':'exo.garmentcodedata-v2.geometry-training.v1',
        'modelType':'self-supervised masked geometry feature encoder',
        'limitations':'Feature-level similarity and structure analysis only; not DXF generation, parametric pattern drafting, fit validation, or factory approval',
        'trainingExamplesVerified':count,
        'numberOfSourceFeatures':len(FEATURE_NAMES),
        'totalIndexedCatalogEntriesNotNecessarilyTrained':None,
        'source':'Korosteleva et al. GarmentCodeData v2, ETH Zurich (2024)',
        'sourceDOI':'https://doi.org/10.3929/ethz-b-000690432',
        'license':'CC BY 4.0',
        'archiveRoot':str(archive_root) if archive_root else None,
        'continuedFromCheckpoint':str(checkpoint) if checkpoint else None,
        'checkpoint':str(output/'geometry-encoder-v1.npz'),
        'embeddings':str(output/'source-embeddings-v1.npz'),
        'metrics':summary,'trainingCurve':history,
    }
    with sqlite3.connect(root/'pattern-index.sqlite3') as db:
        manifest['totalIndexedCatalogEntriesNotNecessarilyTrained']=db.execute('SELECT count(*) FROM patterns').fetchone()[0]
    atomic_json(output/'training-manifest.json',manifest)
    report_progress({'phase':'completed','verifiedPatterns':count,
        'metrics':summary})
    print(json.dumps({k:v for k,v in manifest.items() if k!='trainingCurve'},indent=2))
    return manifest


if __name__=='__main__':main()

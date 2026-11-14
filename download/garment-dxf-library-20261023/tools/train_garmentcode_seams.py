#!/usr/bin/env python3
"""Learn EXO seam-edge compatibility from verified GarmentCodeData sewing JSON.

Train on the original panel-edge pairs in `pattern.stitches`, using length,
curvature, panel geometry and relative edge location. Test is *held out by
entire garment*, not by individual seam pairs. Negatives are synthesized only
from non-stitched pairs inside each garment; this is a ranking/compatibility
research baseline, not a production auto-sew model.

Uses NumPy only. Model checkpoints are local to the ignored training folder.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path

os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import numpy as np
from garmentcode_checkpoint_io import atomic_json, atomic_npz

from train_garmentcode_geometry import verified_documents
from garmentcode_checkpoint_io import atomic_json


FEATURE_NAMES=(
    'log_min_chord','log_max_chord','abs_log_chord_ratio','relative_chord_difference',
    'both_curved','one_curved','neither_curved','angle_parallel_abs_dot',
    'same_panel','same_body_label','arm_fraction','leg_fraction','body_fraction',
    'log_min_panel_area','log_max_panel_area','abs_log_panel_area_ratio',
    'log_min_panel_perimeter','log_max_panel_perimeter',
    'min_panel_edge_fraction','max_panel_edge_fraction',
    'min_normalized_edge_position','max_normalized_edge_position',
    'position_difference','midpoint_bbox_distance','normalized_panel_center_distance',
    'log_translation_xy_distance','log_translation_z_difference',
    'edge_count_ratio','log_min_panel_edge_count','log_max_panel_edge_count',
    'reciprocal_panel_areas','relative_panel_width','relative_panel_height'
)


def _safe_number(x):
    try:
        y=float(x)
        return y if math.isfinite(y) else 0.0
    except (TypeError,ValueError):
        return 0.0


def collect_edge_records(document):
    """Expose local edge topology without memorizing source file/panel names."""
    pattern=document.get('pattern') or {}
    panels=pattern.get('panels') or {}
    records={}
    for panel_name,panel in panels.items():
        vertices=np.asarray(panel.get('vertices',[]),dtype=np.float64)
        edges=panel.get('edges',[])
        if vertices.ndim!=2 or vertices.shape[1]!=2 or not np.isfinite(vertices).all() or len(vertices)<3:
            continue
        bbmin=vertices.min(axis=0);bbmax=vertices.max(axis=0)
        size=np.maximum(bbmax-bbmin,1e-4)
        area=0.5*abs(float(np.dot(vertices[:,0],np.roll(vertices[:,1],-1))-
                           np.dot(vertices[:,1],np.roll(vertices[:,0],-1))))
        panel_edges=[];usable=[]
        for index,edge in enumerate(edges):
            endpoints=edge.get('endpoints',[])
            if len(endpoints)!=2 or any(not isinstance(k,int) or not 0<=k<len(vertices) for k in endpoints):
                continue
            a,b=vertices[endpoints]
            vec=b-a
            chord=float(np.linalg.norm(vec))
            if chord<=0.00001:continue
            panel_edges.append(chord)
            usable.append((index,edge,a,b,vec,chord))
        if not panel_edges:continue
        perimeter=sum(panel_edges)
        trans=panel.get('translation') or [0,0,0]
        if not isinstance(trans,(list,tuple)) or len(trans)<3:trans=[0,0,0]
        trans=np.asarray([_safe_number(v) for v in trans[:3]],dtype=np.float64)
        label=str(panel.get('label','')).lower()
        for index,edge,a,b,vec,chord in usable:
            middle=(a+b)/2
            records[(panel_name,index)]={
                'length':chord,'curved':bool(edge.get('curvature')),
                'direction':vec/chord,'position':(index+0.5)/max(1,len(edges)),
                'midpoint_norm':(middle-bbmin)/size,
                'label':label,'panel':panel_name,
                'area':max(area,1e-6),'perimeter':max(perimeter,1e-6),
                'edge_fraction':chord/max(perimeter,1e-6),
                'count':len(edges),'width':size[0],'height':size[1],
                'center':(bbmin+bbmax)/2,'translation':trans,
            }
    return records


def pair_features(a,b):
    length1,length2=sorted((a['length'],b['length']))
    area1,area2=sorted((a['area'],b['area']))
    perimeter1,perimeter2=sorted((a['perimeter'],b['perimeter']))
    frac1,frac2=sorted((a['edge_fraction'],b['edge_fraction']))
    position1,position2=sorted((a['position'],b['position']))
    count1,count2=sorted((a['count'],b['count']))
    two_labels=[a['label'],b['label']]
    delta=a['translation']-b['translation']
    feature=[
        math.log1p(length1),math.log1p(length2),abs(math.log(length1/length2)),
        abs(length1-length2)/max(length2,1e-6),
        float(a['curved'] and b['curved']),float(a['curved']!=b['curved']),
        float(not (a['curved'] or b['curved'])),
        abs(float(np.dot(a['direction'],b['direction']))),
        float(a['panel']==b['panel']),float(a['label']==b['label']),
        two_labels.count('arm')/2,two_labels.count('leg')/2,two_labels.count('body')/2,
        math.log1p(area1),math.log1p(area2),abs(math.log(area1/area2)),
        math.log1p(perimeter1),math.log1p(perimeter2),frac1,frac2,
        position1,position2,abs(position1-position2),
        float(np.linalg.norm(a['midpoint_norm']-b['midpoint_norm'])),
        float(np.linalg.norm(a['center']-b['center']))/max(math.sqrt(area2),1e-4),
        math.log1p(float(np.linalg.norm(delta[:2]))),math.log1p(abs(float(delta[2]))),
        count1/count2,math.log1p(count1),math.log1p(count2),
        1/max(area1+area2,1),
        abs(float(a['width']-b['width']))/max(a['width'],b['width']),
        abs(float(a['height']-b['height']))/max(a['height'],b['height'])
    ]
    if len(feature)!=len(FEATURE_NAMES):
        raise AssertionError('Feature count mismatch')
    return np.asarray(feature,dtype=np.float32)


def _canonical_pair(a,b):
    return tuple(sorted((a,b)))


def examples_for_garment(document,rng,negative_ratio=4):
    """Sample hard and random negatives not in ground-truth stitches."""
    records=collect_edge_records(document)
    stitches=(document.get('pattern') or {}).get('stitches') or []
    positives=set()
    for item in stitches:
        if not isinstance(item,list) or len(item)!=2:continue
        try:
            a=(item[0]['panel'],item[0]['edge'])
            b=(item[1]['panel'],item[1]['edge'])
            if a in records and b in records and a!=b:
                positives.add(_canonical_pair(a,b))
        except (KeyError,TypeError,IndexError):
            continue
    if len(records)<2 or not positives:
        return [],[]
    keys=sorted(records)
    lengths=np.asarray([records[key]['length'] for key in keys])
    edges_by_length=np.argsort(lengths)
    positions={int(edge_i):rank for rank,edge_i in enumerate(edges_by_length)}
    index={key:i for i,key in enumerate(keys)}
    used=set(positives)
    features=[];labels=[]
    for a,b in sorted(positives):
        features.append(pair_features(records[a],records[b]));labels.append(1)
        for neg in range(negative_ratio):
            # Match candidate length closely for most negatives; otherwise
            # the classifier could solve the task by chord mismatch alone.
            anchor=a if neg%2==0 else b
            anchor_i=index[anchor]
            rank=positions[anchor_i]
            found=False
            for trial in range(30):
                if neg<negative_ratio-1:
                    near=int(np.clip(rank+rng.integers(-12,13),0,len(keys)-1))
                    other=keys[int(edges_by_length[near])]
                else:
                    other=keys[int(rng.integers(len(keys)))]
                if other==anchor:continue
                pair=_canonical_pair(anchor,other)
                if pair in used:continue
                used.add(pair)
                features.append(pair_features(records[pair[0]],records[pair[1]]))
                labels.append(0)
                found=True;break
            if not found:continue
    return features,labels


def _auc(y,p):
    """ROC AUC from ranks; ties count as 1/2."""
    order=np.argsort(p,kind='mergesort')
    sorted_p=np.asarray(p)[order]
    sorted_y=np.asarray(y)[order]
    positive=int(np.sum(sorted_y));negative=len(sorted_y)-positive
    if not positive or not negative:return 0.5
    ranks=np.empty(len(p),dtype=np.float64)
    idx=0
    while idx<len(p):
        end=idx+1
        while end<len(p) and sorted_p[end]==sorted_p[idx]:end+=1
        ranks[idx:end]=(idx+end+1)/2
        idx=end
    return float((ranks[sorted_y==1].sum()-positive*(positive+1)/2)/(positive*negative))


def _average_precision(y,p):
    order=np.argsort(-np.asarray(p),kind='mergesort')
    labels=np.asarray(y)[order]
    positives=int(labels.sum())
    if not positives:return 0.0
    precision=np.cumsum(labels)/np.arange(1,len(labels)+1)
    return float((precision*labels).sum()/positives)


def _sigmoid(z):
    return 1/(1+np.exp(-np.clip(z,-20,20)))


def _predict(x,w):
    hidden=np.tanh(x@w['w1']+w['b1'])
    return hidden,_sigmoid(hidden@w['w2']+w['b2'])


def train_seams(x,y,split,epochs=65,seed=42,progress_callback=None):
    """Train only on garment-disjoint train set; choose epoch on validation AP."""
    rng=np.random.default_rng(seed)
    train=np.flatnonzero(split<8);val=np.flatnonzero(split==8);test=np.flatnonzero(split==9)
    if min(len(train),len(val),len(test))<10:raise ValueError('Insufficient garment-held-out examples')
    mean=x[train].mean(0);std=np.maximum(x[train].std(0),0.02)
    inputs=np.clip((x-mean)/std,-10,10).astype(np.float32)
    weights={'w1':(rng.normal(size=(x.shape[1],32))/math.sqrt(x.shape[1])).astype(np.float32),
             'b1':np.zeros(32,dtype=np.float32),
             'w2':(rng.normal(size=(32,1))/math.sqrt(32)).astype(np.float32),
             'b2':np.zeros(1,dtype=np.float32)}
    moments={k:np.zeros_like(v) for k,v in weights.items()}
    squares={k:np.zeros_like(v) for k,v in weights.items()}
    best=None;best_ap=-1;bad=0;step=0;history=[]
    for epoch in range(epochs):
        order=rng.permutation(train)
        for block in np.array_split(order,max(1,math.ceil(len(order)/384))):
            inputs_b=inputs[block];label_b=y[block,None]
            hidden,pred=_predict(inputs_b,weights)
            delta=(pred-label_b)/len(block)
            grads={'w2':hidden.T@delta,'b2':delta.sum(0)}
            dh=(delta@weights['w2'].T)*(1-hidden**2)
            grads['w1']=inputs_b.T@dh;grads['b1']=dh.sum(0)
            step+=1
            for k,g in grads.items():
                moments[k]=0.9*moments[k]+0.1*np.clip(g,-2,2)
                squares[k]=0.999*squares[k]+0.001*(g*g)
                weights[k]-=0.001*(moments[k]/(1-0.9**step))/(np.sqrt(squares[k]/(1-0.999**step))+1e-7)
        _,val_p=_predict(inputs[val],weights)
        ap=_average_precision(y[val],val_p.ravel())
        history.append({'epoch':epoch+1,'validationAveragePrecision':round(ap,6)})
        if progress_callback:
            progress_callback({'phase':'training','epoch':epoch+1,
                               'maxEpochs':epochs,'validationAveragePrecision':round(ap,6)})
        if ap>best_ap+1e-4:
            best_ap=ap;best={k:v.copy() for k,v in weights.items()};bad=0
        else:bad+=1
        if bad>=10:break
    weights=best
    _,test_p=_predict(inputs[test],weights)
    test_p=test_p.ravel()
    # Chord-length similarity is the most common non-learning baseline.
    length_score=-x[test,2]
    result={
        'trainingPairCount':len(train),'validationPairCount':len(val),'testPairCount':len(test),
        'positiveTestFraction':round(float(y[test].mean()),6),
        'trainingEpochs':len(history),
        'validationAveragePrecision':round(best_ap,6),
        'testAveragePrecision':round(_average_precision(y[test],test_p),6),
        'testROCAUC':round(_auc(y[test],test_p),6),
        'chordLengthBaselineAveragePrecision':round(_average_precision(y[test],length_score),6),
        'chordLengthBaselineROCAUC':round(_auc(y[test],length_score),6),
    }
    return weights,mean,std,result,history


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--archive-root',type=Path)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--max-patterns',type=int,default=0,help='Optional deterministic smaller smoke test')
    parser.add_argument('--epochs',type=int,default=65)
    args=parser.parse_args(argv)
    root=args.root.resolve()
    output=(args.output or root/'training/seam-compatibility-v1').resolve()
    output.mkdir(parents=True,exist_ok=True)
    progress_file=output/'training-progress.json'
    def report_progress(payload):
        atomic_json(progress_file,{'schema':'exo.garmentcodedata-v2.seam-training-progress.v1',**payload})
    report_progress({'phase':'feature_extraction','verifiedGarmentsRead':0,'pairExamples':0})
    all_features=[];all_labels=[];all_splits=[]
    count=0;used=0;candidate_count=Counter()
    for source_id,group,doc in verified_documents(root,args.archive_root):
        count+=1
        # The document ID sets both the train/test split and negative-sampling
        # seed to avoid dependence on directory order or repeated retraining.
        digest=hashlib.sha256(group.encode()).digest()
        split=int.from_bytes(digest[:4],'big')%10
        seed=int.from_bytes(hashlib.sha256(source_id.encode()).digest()[:8],'big')
        features,labels=examples_for_garment(doc,np.random.default_rng(seed))
        if features:
            used+=1
            all_features.extend(features);all_labels.extend(labels)
            all_splits.extend([split]*len(labels))
            candidate_count[split]+=len(labels)
        if count%1000==0:
            report_progress({'phase':'feature_extraction',
                             'verifiedGarmentsRead':count,'pairExamples':len(all_labels),
                             'verifiedGarmentsWithStitches':used})
        if args.max_patterns and count>=args.max_patterns:break
    if used<50:raise ValueError('Need >=50 verified garments containing usable stitch links')
    x=np.stack(all_features)
    y=np.asarray(all_labels,dtype=np.float32)
    split=np.asarray(all_splits,dtype=np.uint8)
    report_progress({'phase':'training','verifiedGarmentsRead':count,
                     'pairExamples':len(y),'epoch':0,'maxEpochs':args.epochs})
    weights,mean,std,metrics,history=train_seams(x,y,split,epochs=args.epochs,
        progress_callback=report_progress)
    atomic_npz(output/'seam-compatibility-v1.npz',**weights,mean=mean,std=std,
                        featureNames=np.asarray(FEATURE_NAMES))
    manifest={
        'schema':'exo.garmentcodedata-v2.seam-compatibility.v1',
        'modelType':'within-garment sewn-edge compatibility classifier',
        'verifiedGarmentsRead':count,'garmentsWithUsableStitches':used,
        'numberOfFeatures':len(FEATURE_NAMES),
        'actualPairExamples':len(y),'positivePairs':int(y.sum()),
        'negativePairs':int(len(y)-y.sum()),
        'splitMethod':'SHA256(source element) grouped at entire garment level',
        'negativeSampling':'4 non-stitched candidate pairs per true seam, mostly length-matched hard negatives',
        'limitations':'Candidate ranking research baseline, sampled nonsewn negatives are not evidence of impossible seams. No automatic sewing, DXF, grading, or factory approval.',
        'source':'Korosteleva et al., ETH GarmentCodeData v2 (2024)',
        'license':'CC BY 4.0','sourceDOI':'https://doi.org/10.3929/ethz-b-000690432',
        'metrics':metrics,'validationHistory':history
    }
    atomic_json(output/'training-manifest.json',manifest)
    report_progress({'phase':'completed','verifiedGarmentsRead':count,
                     'pairExamples':len(y),'metrics':metrics})
    print(json.dumps({k:v for k,v in manifest.items() if k!='validationHistory'},indent=2))


if __name__=='__main__':main()

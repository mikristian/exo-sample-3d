#!/usr/bin/env python3
"""Rank candidate seam partners using EXO's learned edge-compatibility model.

Scores are relative rankings on a source garment's panel edges, not calibrated
probabilities and not automatic sewing operations. A held-out exhaustive-edge
benchmark is available via --evaluate-test on SHA256-disjoint garments.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from train_garmentcode_geometry import verified_documents
from train_garmentcode_seams import (
    FEATURE_NAMES, _sigmoid, collect_edge_records, pair_features,
)


def load_model(path):
    with np.load(path,allow_pickle=False) as weights:
        if list(weights['featureNames'])!=list(FEATURE_NAMES):
            raise ValueError('Model is incompatible with the current seam feature extractor')
        expected={'w1':(len(FEATURE_NAMES),32),'b1':(32,),
                  'w2':(32,1),'b2':(1,),
                  'mean':(len(FEATURE_NAMES),),'std':(len(FEATURE_NAMES),)}
        tensors={}
        for key,shape in expected.items():
            matrix=np.asarray(weights[key],dtype=np.float32)
            if matrix.shape!=shape or not np.isfinite(matrix).all():
                raise ValueError(f'Incompatible or non-finite model tensor: {key}')
            tensors[key]=matrix.copy()
        if (tensors['std']<=0).any():
            raise ValueError('Invalid model normalization')
    return tensors


def rank_matches(document,panel,edge,model,top_k=10,include_existing=True):
    records=collect_edge_records(document)
    anchor=(panel,edge)
    if anchor not in records:
        raise ValueError(f'Unknown panel edge: {panel!r} {edge}')
    forbidden=set()
    if not include_existing:
        for stitch in (document.get('pattern') or {}).get('stitches') or []:
            if not isinstance(stitch,list) or len(stitch)!=2:continue
            try:
                pair=[(ref['panel'],ref['edge']) for ref in stitch]
                if pair[0]==anchor:forbidden.add(pair[1])
                if pair[1]==anchor:forbidden.add(pair[0])
            except (KeyError,TypeError):continue
    candidates=[item for item in sorted(records) if item!=anchor and item not in forbidden]
    if not candidates:return []
    x=np.stack([pair_features(records[anchor],records[key]) for key in candidates])
    norm=np.clip((x-model['mean'])/model['std'],-10,10)
    hidden=np.tanh(norm@model['w1']+model['b1'])
    scores=_sigmoid(hidden@model['w2']+model['b2']).ravel()
    order=np.argsort(-scores,kind='stable')[:max(1,top_k)]
    return [
        {'panel':candidates[i][0],'edge':int(candidates[i][1]),
         'rankingScore':round(float(scores[i]),6),
         'chordLength':round(float(records[candidates[i]]['length']),4)}
        for i in order
    ]


def evaluate_test_set(root,archive_root,checkpoint,max_garments=60,evaluation_split='test'):
    """Rank every edge against ALL other edges on grouped unseen garments.

    Use validation for selecting which model to deploy. Keep `test` separate
    for final reporting, to avoid repeated model-selection leakage.
    """
    if evaluation_split not in ('validation','test'):
        raise ValueError('Evaluation split must be validation or test')
    split_id=8 if evaluation_split=='validation' else 9
    model=load_model(checkpoint)
    total=0; top1=0; top5=0; baseline_top1=0; recall_sum=0
    garments=0;candidate_counts=[]
    for source_id,group,document in verified_documents(root,archive_root):
        split=int.from_bytes(hashlib.sha256(group.encode()).digest()[:4],'big')%10
        if split!=split_id:continue
        records=collect_edge_records(document)
        if len(records)<3:continue
        truth={}
        for pair in (document.get('pattern') or {}).get('stitches') or []:
            if not isinstance(pair,list) or len(pair)!=2:continue
            try:
                a=(pair[0]['panel'],pair[0]['edge'])
                b=(pair[1]['panel'],pair[1]['edge'])
            except (KeyError,TypeError):continue
            if a in records and b in records and a!=b:
                truth.setdefault(a,set()).add(b)
                truth.setdefault(b,set()).add(a)
        if not truth:continue
        for a,partners in sorted(truth.items()):
            candidates=[i for i in sorted(records) if i!=a]
            features=np.stack([pair_features(records[a],records[b]) for b in candidates])
            norm=np.clip((features-model['mean'])/model['std'],-10,10)
            h=np.tanh(norm@model['w1']+model['b1'])
            score=_sigmoid(h@model['w2']+model['b2']).ravel()
            predicted=np.argsort(-score,kind='stable')
            chord=np.argsort(features[:,2],kind='stable')
            true_ids={i for i,b in enumerate(candidates) if b in partners}
            if not true_ids:continue
            total+=1
            top1+=int(int(predicted[0]) in true_ids)
            baseline_top1+=int(int(chord[0]) in true_ids)
            top5+=int(bool(true_ids.intersection(predicted[:5].tolist())))
            rank=next(i+1 for i,p in enumerate(predicted) if int(p) in true_ids)
            recall_sum+=1/rank
            candidate_counts.append(len(candidates))
        garments+=1
        if max_garments and garments>=max_garments:break
    if not total:raise ValueError('No held-out stitched anchors evaluated')
    return {
        'evaluationSplit':evaluation_split,
        'unseenGarmentsEvaluated':garments,
        'heldOutSeamAnchors':total,
        'meanPotentialPartnerCount':round(float(np.mean(candidate_counts)),2),
        'top1PartnerRecall':round(top1/total,6),
        'top5PartnerRecall':round(top5/total,6),
        'meanReciprocalRank':round(recall_sum/total,6),
        'edgeLengthOnlyTop1Recall':round(baseline_top1/total,6),
        'caveat':'Ground truth comes from procedural GarmentCodeData stitches. Candidate ranking is not a validated real-world sewing decision.'
    }


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint',type=Path,required=True)
    parser.add_argument('--source-json',type=Path)
    parser.add_argument('--panel')
    parser.add_argument('--edge',type=int)
    parser.add_argument('--top-k',type=int,default=10)
    parser.add_argument('--exclude-already-stitched',action='store_true')
    parser.add_argument('--evaluate-test',action='store_true')
    parser.add_argument('--evaluate-split',choices=['validation','test'],default='test')
    parser.add_argument('--root',type=Path)
    parser.add_argument('--archive-root',type=Path)
    parser.add_argument('--max-garments',type=int,default=60)
    args=parser.parse_args(argv)
    if args.evaluate_test:
        if not args.root:parser.error('--evaluate-test requires --root')
        result=evaluate_test_set(args.root,args.archive_root,args.checkpoint,args.max_garments,args.evaluate_split)
    else:
        if not args.source_json or not args.panel or args.edge is None:
            parser.error('Provide --source-json --panel --edge, or --evaluate-test')
        document=json.loads(args.source_json.read_text())
        result={'source':str(args.source_json),'anchor':{'panel':args.panel,'edge':args.edge},
                'candidates':rank_matches(document,args.panel,args.edge,
                    load_model(args.checkpoint),args.top_k,not args.exclude_already_stitched),
                'scoreType':'relative pairwise ranking (NOT calibrated probability)'}
    print(json.dumps(result,indent=2))
    return result


if __name__=='__main__':main()

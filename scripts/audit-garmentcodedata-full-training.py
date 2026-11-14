#!/usr/bin/env python3
"""Prove EXO geometry/seam model coverage against the original source index.

Geometry must contain embeddings for every unique original source ID. The
seam manifest must report reading every SHA-verified JSON and include the
order-independent 256-bit XOR of SHA256(source ID) over every original,
including those without valid sewn-edge training labels. Train/validation/
test are garment-disjoint; not every example updates model weights.
"""
from __future__ import annotations

import argparse
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

import numpy as np


ROOT=Path(__file__).resolve().parents[1]/'download/garment-dxf-library-20261023/garmentcodedata-v2'
TOOLS=Path(__file__).resolve().parents[1]/'download/garment-dxf-library-20261023/tools'
if str(TOOLS) not in sys.path:
    sys.path.insert(0,str(TOOLS))
from train_garmentcode_geometry import FEATURE_NAMES as GEOMETRY_FEATURE_NAMES
from train_garmentcode_seams import FEATURE_NAMES as SEAM_FEATURE_NAMES


def valid_model_checkpoint(path,model):
    """Require a compatible, finite model, not merely a checkpoint filename."""
    features=GEOMETRY_FEATURE_NAMES if model=='geometry' else SEAM_FEATURE_NAMES
    count=len(features)
    shapes=({'w1':(count,64),'b1':(64,), 'w2':(64,16),'b2':(16,),
             'w3':(16,64),'b3':(64,), 'w4':(64,count),'b4':(count,),
             'mean':(count,), 'std':(count,)} if model=='geometry' else
            {'w1':(count,32),'b1':(32,), 'w2':(32,1),'b2':(1,),
             'mean':(count,), 'std':(count,)})
    try:
        with np.load(path,allow_pickle=False) as saved:
            if list(saved['featureNames'])!=list(features):
                return False
            for key,shape in shapes.items():
                tensor=saved[key]
                if tensor.shape!=shape or not np.issubdtype(tensor.dtype,np.number) or not np.isfinite(tensor).all():
                    return False
            if (saved['std']<=0).any():
                return False
        return True
    except (OSError,ValueError,KeyError,TypeError):
        return False


def catalog_ids(root):
    with sqlite3.connect(root/'pattern-index.sqlite3',timeout=30) as db:
        names={f'{body}/{batch:02d}/{element}' for body,batch,element in
               db.execute('SELECT body,batch,element FROM patterns')}
        rows=db.execute('SELECT body,batch,specification_count FROM archived_batches').fetchall()
    unique={body:len({batch for b,batch,_ in rows if b==body}) for body in ('default','random')}
    actual_batches={(body,batch) for body,batch,_ in rows}
    return names,sum(count for _,_,count in rows),unique,actual_batches


def source_id_fingerprint(names):
    # Commutative, order-independent fingerprint, not a cryptographic
    # provenance signature. Combined with original archive SHA checks.
    x=0
    for name in names:
        x^=int.from_bytes(hashlib.sha256(name.encode()).digest(),'big')
    return f'{x:064x}'


def latest_manifest(training,prefix):
    options=[]
    for manifest in training.glob(f'{prefix}-*/training-manifest.json'):
        try:
            # Deep checkpoints have in-sample training diagnostics. They must
            # never substitute for a first-pass held-out evaluation here.
            if manifest.parent.name.startswith(f'{prefix}-deep-'):
                continue
            data=json.loads(manifest.read_text())
            count=data['trainingExamplesVerified'] if prefix=='remote-geometry' else data['verifiedGarmentsRead']
            if manifest.parent.name.startswith('remote-seam-smoke-'):
                continue
            if not isinstance(count,int) or count<=0:continue
            options.append((count,manifest,data))
        except (KeyError,ValueError,OSError,TypeError):continue
    return max(options,key=lambda item:(item[0],item[1].stat().st_mtime)) if options else None


def audit(root):
    names,archived,body_batches,actual_batches=catalog_ids(root)
    expected=len(names)
    expected_batches={(body,batch) for body in ('default','random') for batch in range(20)}
    all_archived=(archived==expected and actual_batches==expected_batches
                  and expected>=100000)
    training=root/'training'
    result={'schema':'exo.garmentcodedata-v2.full-training-coverage.v1',
            'checkedAt':datetime.now(timezone.utc).isoformat(),
            'indexedOriginalPatterns':expected,
            'archivedOriginalPatterns':archived,
            'archivedBatchesByBody':body_batches,
            'allOriginalSourceBatchesArchived':all_archived,
            'modelSplitPolicy':'80% training weights, 10% validation, 10% held-out test; all originals must be read/encoded',
            'geometry':{'status':'missing'},'seam':{'status':'missing'}}
    geom=latest_manifest(training,'remote-geometry')
    if geom:
        count,manifest,data=geom
        model=manifest.parent/'geometry-encoder-v1.npz'
        embeddings=manifest.parent/'source-embeddings-v1.npz'
        entry={'sourcePatternsRead':count,'manifest':str(manifest),
               'sourceEmbeddings':str(embeddings),'status':'not_fully_verified'}
        model_valid=valid_model_checkpoint(model,'geometry')
        entry['modelCheckpointValid']=model_valid
        if model_valid and embeddings.is_file():
            try:
                with np.load(embeddings,allow_pickle=False) as arrays:
                    ids=arrays['sourceIds'];vectors=arrays['embeddings']
                    learned=set(map(str,ids))
                    valid=(len(ids)==count and len(learned)==count
                           and vectors.shape==(count,16)
                           and np.isfinite(vectors).all())
                entry.update({'distinctEmbeddedSourceIDs':len(learned),
                              'embeddingsFinite':bool(valid),
                              'matchesEveryIndexedSource':bool(valid and count==expected and learned==names)})
                entry['status']='all_sources_encoded' if entry['matchesEveryIndexedSource'] else 'partial_source_coverage'
            except (OSError,ValueError,KeyError,TypeError):
                entry['status']='invalid_embeddings'
        result['geometry']=entry
    seam=latest_manifest(training,'remote-seam')
    if seam:
        count,manifest,data=seam
        fingerprint=data.get('verifiedSourceIDsXorSha256')
        ids_match=(isinstance(fingerprint,str) and re.fullmatch('[0-9a-f]{64}',fingerprint)
                   and fingerprint==source_id_fingerprint(names))
        model=manifest.parent/'seam-compatibility-v1.npz'
        model_valid=valid_model_checkpoint(model,'seam')
        match=(model_valid and count==expected and ids_match)
        result['seam']={'sourcePatternsRead':count,'manifest':str(manifest),
            'modelCheckpointValid':model_valid,
            'garmentsWithUsableStitches':data.get('garmentsWithUsableStitches'),
            'hasSourceIdFingerprint':fingerprint is not None,
            'matchesEveryIndexedSource':bool(match),
            'status':'all_sources_examined' if match else 'partial_or_unverified_coverage'}
    result['allSourcePatternsCoveredByBothModels']=(all_archived and
        result['geometry'].get('matchesEveryIndexedSource',False) and
        result['seam'].get('matchesEveryIndexedSource',False))
    # Distinguish a first complete training pass from the explicitly requested
    # second deep pass. A second pass must have its *own* completed checkpoint,
    # full source ID/embedding coverage and correct source fingerprints.
    deep_geometry=training/f'remote-geometry-deep-{expected}'
    deep_seam=training/f'remote-seam-deep-{expected}'
    deep={'geometry':{'status':'missing'},'seam':{'status':'missing'}}
    deep_manifest=deep_geometry/'training-manifest.json'
    if deep_manifest.is_file():
        try:
            metadata=json.loads(deep_manifest.read_text())
            count=metadata['trainingExamplesVerified']
            metrics=metadata.get('metrics',{})
            with np.load(deep_geometry/'source-embeddings-v1.npz',allow_pickle=False) as arrays:
                ids=list(map(str,arrays['sourceIds']))
                matrix=arrays['embeddings']
                good=(count==expected and len(ids)==expected
                      and len(set(ids))==expected and set(ids)==names
                      and matrix.shape==(expected,16) and np.isfinite(matrix).all()
                      and metrics.get('fullDatasetOptimization') is True
                      and metrics.get('optimizerTrainingExamples')==expected
                      and metrics.get('heldoutMetricsIndependent') is False
                      and valid_model_checkpoint(deep_geometry/'geometry-encoder-v1.npz','geometry'))
            deep['geometry']={'status':'all_sources_encoded' if good else 'incomplete',
                              'sourcePatternsRead':count,'verified':bool(good)}
        except (OSError,KeyError,ValueError,TypeError):
            deep['geometry']={'status':'invalid_checkpoint','verified':False}
    seam_manifest=deep_seam/'training-manifest.json'
    if seam_manifest.is_file():
        try:
            metadata=json.loads(seam_manifest.read_text())
            metrics=metadata.get('metrics',{})
            good=(metadata['verifiedGarmentsRead']==expected
                  and metadata['verifiedSourceIDsXorSha256']==source_id_fingerprint(names)
                  and metrics.get('fullDatasetOptimization') is True
                  and metrics.get('optimizerPairCount')==metadata.get('actualPairExamples')
                  and metrics.get('heldoutMetricsIndependent') is False
                  and valid_model_checkpoint(deep_seam/'seam-compatibility-v1.npz','seam'))
            deep['seam']={'status':'all_sources_examined' if good else 'incomplete',
                          'sourcePatternsRead':metadata['verifiedGarmentsRead'],
                          'verified':bool(good)}
        except (OSError,KeyError,ValueError,TypeError):
            deep['seam']={'status':'invalid_checkpoint','verified':False}
    result['secondDeepPass']=deep
    result['allSourcePatternsDeepTrained']=(
        result['allSourcePatternsCoveredByBothModels'] and
        deep['geometry'].get('verified',False) and
        deep['seam'].get('verified',False))
    return result


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--require-complete',action='store_true')
    parser.add_argument('--require-deep',action='store_true',
                        help='Exit nonzero until both second-pass models cover all source IDs')
    args=parser.parse_args(argv)
    root=args.root.resolve()
    result=audit(root)
    out=root/'training/full-training-coverage.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    tmp=out.with_suffix('.tmp')
    tmp.write_text(json.dumps(result,indent=2)+'\n')
    os.replace(tmp,out)
    print(json.dumps(result,indent=2))
    return int((args.require_complete and not result['allSourcePatternsCoveredByBothModels'])
               or (args.require_deep and not result['allSourcePatternsDeepTrained']))


if __name__=='__main__':raise SystemExit(main())

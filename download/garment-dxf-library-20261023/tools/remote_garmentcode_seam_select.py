#!/usr/bin/env python3
"""Select a finished Jarvis seam model using only held-out VALIDATION garments.

Never optimize against the held-out test set, modify a CAD pattern, or run
concurrently with remote geometry/seam model optimization. The earlier model
stays selected when new training fails to improve exhaustive edge ranking.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import json
from pathlib import Path
import re

from garmentcode_checkpoint_io import atomic_json
from suggest_garmentcode_seams import evaluate_test_set, load_model


SCHEMA='exo.garmentcodedata-v2.seam-model-selection.v1'


def completed_models(training):
    """Return only fully serialized/compatible versioned source models."""
    found=[]
    for path in training.glob('remote-seam-*/training-manifest.json'):
        folder=path.parent
        # The second deep pass fits all original examples, including former
        # heldouts. Do NOT promote it using a validation score from data that
        # it has now seen; retain it as an unranked optional checkpoint.
        if not re.fullmatch(r'remote-seam-(?:\d+k|full-\d+)',folder.name):
            continue
        checkpoint=folder/'seam-compatibility-v1.npz'
        if not checkpoint.is_file():continue
        try:
            document=json.loads(path.read_text())
            count=document['verifiedGarmentsRead']
            if (document['schema']!='exo.garmentcodedata-v2.seam-compatibility.v1'
                or not isinstance(count,int) or count<1000
                or folder.name not in (f'remote-seam-{count//1000}k',
                                       f'remote-seam-full-{count}')):
                continue
            load_model(checkpoint)
        except (OSError,KeyError,ValueError):continue
        found.append((count,checkpoint))
    return sorted(found,key=lambda item:(item[0],str(item[1])))


def pick_model(current,previous):
    """Select on exhaustive validation top-one recall, MRR for exact ties."""
    if previous is None:return True
    if current['top1PartnerRecall']>previous['top1PartnerRecall']:
        return True
    if current['top1PartnerRecall']<previous['top1PartnerRecall']:
        return False
    return current['meanReciprocalRank']>previous['meanReciprocalRank']


def best_prior_on_validation(prior_models, evaluate):
    """First-run baseline: find the best *validated* earlier checkpoint.

    Never assume the largest older model is best. Compare all prior completed
    model versions on exactly the same held-out validation garment examples.
    """
    winner=None;winning_score=None;all_scores=[]
    for count,checkpoint in prior_models:
        metric=evaluate(checkpoint)
        all_scores.append({'trainedGarments':count,'checkpoint':str(checkpoint),
                           'validation':metric})
        if pick_model(metric,winning_score):
            winner=(count,checkpoint);winning_score=metric
    return winner,winning_score,all_scores


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--max-garments',type=int,default=100)
    args=parser.parse_args(argv)
    if not 10<=args.max_garments<=500:
        parser.error('Validation sample count must be 10 to 500 garments')
    root=args.root.expanduser().resolve()
    training=root/'training'
    status=training/'seam-model-selection-status.json'
    if not (root/'data/pattern-index.sqlite3').is_file():
        print('Original source volume absent; no model selected')
        return 0
    lock=Path.home()/'Library/Caches/exo-jarvis-geometry-seam-compute.lock'
    lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('a+') as fh:
        try:fcntl.flock(fh,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print('Training occupies Jarvis compute slot; skip validation until later')
            return 0
        models=completed_models(training)
        if not models:
            atomic_json(status,{'schema':SCHEMA,'state':'waiting_for_trained_models'})
            return 0
        count,model=models[-1]
        selected=training/'best-seam-model.json'
        previous_model=None
        previous_count=0
        if selected.is_file():
            try:
                record=json.loads(selected.read_text())
                previous_count=record['trainedGarments']
                previous_model=Path(record['checkpoint'])
                if (previous_model.resolve().parent.parent!=training
                    or not previous_model.is_file()
                    or previous_count>count):
                    raise ValueError('Invalid prior model selection')
                load_model(previous_model)
            except (ValueError,KeyError,OSError):
                previous_model=None;previous_count=0
        # Skip repeated selection, including when an older model already won
        # the same comparison. On first run evaluate ALL earlier versions.
        if previous_model is not None and status.is_file():
            try:
                previous_status=json.loads(status.read_text())
                previous_selection=json.loads(selected.read_text())
                if (previous_status.get('state')=='completed'
                    and previous_status.get('candidateGarments')==count
                    and previous_status.get('selectedGarments')==previous_count
                    and previous_status.get('candidateCheckpoint')==str(model)
                    and previous_selection.get('maxValidationGarments')==args.max_garments):
                    print(f'Newest {count}-garment candidate already compared on validation')
                    return 0
            except (ValueError,OSError,KeyError):pass
        # A fixed garment-grouped validation split. No test split is read for
        # model selection; both candidates get identical original JSONs.
        comparison={'schema':SCHEMA,'checkedAt':datetime.now(timezone.utc).isoformat(),
                    'candidateGarments':count,
                    'validationSampleLimit':args.max_garments,
                    'selectionMetric':'validation exhaustive top-one true sewn partner recall; MRR tie-break',
                    'candidateCheckpoint':str(model)}
        atomic_json(status,{'schema':SCHEMA,'state':'validating',
                            'candidateGarments':count})
        def evaluate(checkpoint):
            return evaluate_test_set(root/'data',root,checkpoint,
                                     args.max_garments,'validation')
        # Preserve identical original source ordering and split for ALL
        # model comparisons, never consult test-heldout metrics to select.
        prior_history=[]
        if previous_model is None:
            winner,previous,prior_history=best_prior_on_validation(models[:-1],evaluate)
            if winner:previous_count,previous_model=winner
        else:
            previous=evaluate(previous_model)
        current=evaluate(model)
        improved=pick_model(current,previous)
        comparison.update({'candidate':current,'previous':previous,
                           'previousVersionsEvaluated':prior_history,
                           'previousCheckpoint':str(previous_model) if previous_model else None,
                           'candidateSelected':improved})
        atomic_json(model.parent/'validation-comparison.json',comparison)
        if improved:
            chosen=model;chosen_count=count;chosen_eval=current
        else:
            chosen=previous_model;chosen_count=previous_count;chosen_eval=previous
        atomic_json(selected,{'schema':SCHEMA,'checkpoint':str(chosen),
            'trainedGarments':chosen_count,'validationTop1PartnerRecall':chosen_eval['top1PartnerRecall'],
            'meanReciprocalRank':chosen_eval['meanReciprocalRank'],
            'maxValidationGarments':args.max_garments,
            'selectionSource':'garment-disjoint validation only, not final test set'})
        atomic_json(status,{'schema':SCHEMA,'state':'completed',
            'candidateGarments':count,'candidateCheckpoint':str(model),
            'selectedGarments':chosen_count,
            'candidateValidationTop1':current['top1PartnerRecall'],
            'previousValidationTop1':previous['top1PartnerRecall'] if previous else None})
        print(json.dumps({'candidateGarments':count,'selectedGarments':chosen_count,
                          'candidateSelected':improved,'validation':current}))
        return 0


if __name__=='__main__':raise SystemExit(main())

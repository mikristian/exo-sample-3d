#!/usr/bin/env python3
"""Research-only neural contour decoder for one verified GarmentCodeData topology family.

NumPy denoising autoencoder. Train/validation/test split on distinct source IDs.
Decoder generates numerical vertices and relative Bezier controls; original panel
edge indices and stitch graph are retained. No claim of fit or manufacturing QA.
"""
import argparse
import copy
import hashlib
import json
import math
import sqlite3
from collections import defaultdict
from pathlib import Path

import numpy as np

DEFAULT_ROOT = Path(__file__).resolve().parents[1] / 'garmentcodedata-v2'
DEFAULT_OUTPUT = DEFAULT_ROOT / 'training' / 'contour-decoder-research-20261102'


def source_records(root):
    with sqlite3.connect(f'file:{root / "pattern-index.sqlite3"}?mode=ro', uri=True) as db:
        rows = db.execute('SELECT body,batch,element,source_path,sha256 FROM patterns ORDER BY body,batch,element').fetchall()
    for body, batch, element, rel, sha in rows:
        if not isinstance(rel, str) or Path(rel).is_absolute() or '..' in Path(rel).parts:
            continue
        path = (root / rel).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != sha:
            continue
        try:
            doc = json.loads(raw)
            if len(doc['pattern']['panels']) != 4:
                continue
            yield f'{body}/{batch:02d}/{element}', doc
        except (ValueError, TypeError, KeyError):
            continue


def family_key(doc):
    pattern = doc['pattern']
    panels = pattern['panels']
    try:
        topology = []
        for name, panel in sorted(panels.items()):
            edges = panel['edges']
            if len(panel['vertices']) != len(edges) or len(edges) < 3:
                return None
            ekey = []
            for edge in edges:
                c = edge.get('curvature') or {}
                typ = c.get('type', 'line')
                if typ not in ('line', 'quadratic', 'cubic'):
                    return None
                if typ == 'quadratic' and len(c.get('params', [])) != 1:
                    return None
                if typ == 'cubic' and len(c.get('params', [])) != 2:
                    return None
                ekey.append((tuple(edge['endpoints']), typ))
            topology.append((name, len(panel['vertices']), tuple(ekey)))
        stitch_key = tuple(sorted(tuple(sorted((side['panel'], int(side['edge'])) for side in pair)) for pair in pattern.get('stitches', [])))
        return json.dumps([topology, stitch_key], separators=(',', ':'))
    except (KeyError, ValueError, TypeError):
        return None


def pack(doc, names):
    vec = []
    for name in names:
        panel = doc['pattern']['panels'][name]
        for vertex in panel['vertices']:
            vec.extend(vertex)
        for edge in panel['edges']:
            curve = edge.get('curvature') or {}
            for param in curve.get('params', []):
                vec.extend(param)
    x = np.asarray(vec, dtype=np.float64)
    if not np.isfinite(x).all() or max(abs(x), default=0) > 10000:
        raise ValueError('Unusable contour geometry')
    return x


def unpack(template, names, vector):
    result = copy.deepcopy(template)
    it = iter(np.asarray(vector, dtype=np.float64).tolist())
    for name in names:
        panel = result['pattern']['panels'][name]
        for point in panel['vertices']:
            point[:] = [next(it), next(it)]
        for edge in panel['edges']:
            for param in (edge.get('curvature') or {}).get('params', []):
                param[:] = [next(it), next(it)]
    return result


def datasets(root, min_family=16):
    groups = defaultdict(list)
    for source_id, doc in source_records(root):
        key = family_key(doc)
        if key is not None:
            groups[key].append((source_id, doc))
    eligible = [group for group in groups.values() if len(group) >= min_family]
    if not eligible:
        raise ValueError(f'No verified four-panel topology family has {min_family} local sources')
    # Largest exact topology signature; deterministic tie break by smallest source ID.
    group = sorted(eligible, key=lambda g: (-len(g), g[0][0]))[0]
    names = sorted(group[0][1]['pattern']['panels'])
    cleaned = []
    for source_id, doc in group:
        try:
            cleaned.append((source_id, doc, pack(doc, names)))
        except (TypeError, ValueError):
            pass
    if len(cleaned) < min_family:
        raise ValueError('Insufficient numeric contour examples')
    return sorted(cleaned, key=lambda row: row[0]), names


def initialize(nfeatures, hidden, latent, seed):
    rng = np.random.default_rng(seed)
    return { 'W1': rng.normal(0, 1 / math.sqrt(nfeatures), (nfeatures, hidden)), 'b1': np.zeros(hidden),
             'W2': rng.normal(0, 1 / math.sqrt(hidden), (hidden, latent)), 'b2': np.zeros(latent),
             'W3': rng.normal(0, 1 / math.sqrt(latent), (latent, hidden)), 'b3': np.zeros(hidden),
             'W4': rng.normal(0, 1 / math.sqrt(hidden), (hidden, nfeatures)), 'b4': np.zeros(nfeatures)}


def forward(x, weights):
    h1 = np.tanh(x @ weights['W1'] + weights['b1'])
    z = np.tanh(h1 @ weights['W2'] + weights['b2'])
    h3 = np.tanh(z @ weights['W3'] + weights['b3'])
    y = h3 @ weights['W4'] + weights['b4']
    return h1, z, h3, y


def gradients(x, target, weights):
    h1, z, h3, y = forward(x, weights)
    delta = 2 * (y - target) / (x.shape[0] * x.shape[1])
    result = {'W4': h3.T @ delta, 'b4': delta.sum(axis=0)}
    d = (delta @ weights['W4'].T) * (1 - h3**2)
    result['W3'] = z.T @ d; result['b3'] = d.sum(axis=0)
    d = (d @ weights['W3'].T) * (1 - z**2)
    result['W2'] = h1.T @ d; result['b2'] = d.sum(axis=0)
    d = (d @ weights['W2'].T) * (1 - h1**2)
    result['W1'] = x.T @ d; result['b1'] = d.sum(axis=0)
    return result


def train_arrays(samples, seed=17, epochs=400, hidden=48, latent=12, noise=0.045):
    rng = np.random.default_rng(seed)
    # IDs are distinct garments, grouped/partitioned by deterministic SHA hash.
    partition = sorted(range(len(samples)), key=lambda i: hashlib.sha256((str(seed) + ':' + samples[i][0]).encode()).hexdigest())
    count = len(samples)
    ntest = max(3, round(count * .2)); nval = max(3, round(count * .2))
    subsets = {'test': partition[:ntest], 'val': partition[ntest:ntest + nval], 'train': partition[ntest + nval:]}
    if len(subsets['train']) < 8:
        raise ValueError('Fewer than eight training samples')
    vectors = np.stack([s[2] for s in samples]); mu = vectors[subsets['train']].mean(axis=0)
    sigma = np.maximum(vectors[subsets['train']].std(axis=0), 1e-3)
    normalized = np.clip((vectors - mu) / sigma, -15, 15)
    w = initialize(vectors.shape[1], hidden, latent, seed)
    moments = {k: np.zeros_like(v) for k, v in w.items()}; squared = {k: np.zeros_like(v) for k,v in w.items()}
    best = float('inf'); best_w = None; best_epoch = 0
    for epoch in range(1, epochs + 1):
        ix = rng.permutation(subsets['train'])
        for start in range(0, len(ix), 16):
            ids = ix[start:start+16]
            x = normalized[ids] + rng.normal(0, noise, (len(ids), vectors.shape[1]))
            gs = gradients(x, normalized[ids], w)
            for key in w:
                g = np.clip(gs[key] + (1e-5 * w[key] if key.startswith('W') else 0), -5, 5)
                moments[key] = .9 * moments[key] + .1 * g
                squared[key] = .999 * squared[key] + .001 * g**2
                t = epoch * math.ceil(len(ix)/16) + start//16
                w[key] -= .004 * (moments[key]/(1-.9**t))/(np.sqrt(squared[key]/(1-.999**t))+1e-8)
        _, _, _, yval = forward(normalized[subsets['val']], w)
        vloss = float(np.mean((yval - normalized[subsets['val']])**2))
        if vloss < best:
            best, best_w, best_epoch = vloss, {key: val.copy() for key,val in w.items()}, epoch
    w = best_w
    report = {'seed':seed,'epochsRequested':epochs,'bestEpoch':best_epoch,'familySize':len(samples), 'featureCount':vectors.shape[1],
              'splits':{split:[samples[i][0] for i in ids] for split,ids in subsets.items()},
              'normalizedMse':{},'vertexControlRmseCm':{}}
    for split, ids in subsets.items():
        _, _, _, predictions = forward(normalized[ids],w)
        report['normalizedMse'][split] = float(np.mean((predictions-normalized[ids])**2))
        report['vertexControlRmseCm'][split] = float(np.sqrt(np.mean(((predictions-normalized[ids])*sigma)**2)))
    return w, mu, sigma, report


def geometry_valid(doc):
    for panel in doc['pattern']['panels'].values():
        pts = np.asarray(panel['vertices'])
        if not np.isfinite(pts).all() or len(np.unique(np.round(pts,5),axis=0)) != len(pts):
            return False
        if abs(np.dot(pts[:,0],np.roll(pts[:,1],-1))-np.dot(pts[:,1],np.roll(pts[:,0],-1))) < 1e-3:
            return False
        for edge in panel['edges']:
            a,b = edge['endpoints']
            if np.linalg.norm(pts[a]-pts[b]) < .01:
                return False
    return True


def evaluate_generation(samples, names, weights, mu, sigma, report, strength=.12):
    """Evaluate model samples on held-out garments, without selecting a checkpoint."""
    indexed = {sid: (doc, vector) for sid, doc, vector in samples}
    training = np.stack([indexed[sid][1] for sid in report['splits']['train']])
    values = []
    valid = 0
    nearest_train = []
    for sid in report['splits']['test']:
        doc, source = indexed[sid]
        generated, metrics = generate(doc, weights, mu, sigma, names, 41, strength)
        vector = pack(generated, names)
        valid += int(metrics['basicGeometryValid'])
        values.append(metrics['inputReconstructionAndGenerationRmseCm'])
        nearest_train.append(float(np.min(np.sqrt(np.mean((training-vector)**2, axis=1)))))
    return {'heldOutGeneratedCount':len(values), 'strength':strength,
            'basicGeometryValidityRate':valid/len(values),
            'meanGeneratedDistanceFromInputCm':float(np.mean(values)),
            'meanNearestTrainingContourDistanceCm':float(np.mean(nearest_train)),
            'generatedOutputIdenticalToSourceCount':sum(x < 1e-8 for x in values),
            'note':'Basic polygon checks only; no EXO seam matching, fit, or physical validation.'}


def generate(doc, weights, mu, sigma, names, seed, strength):
    if strength < 0 or strength > 1:
        raise ValueError('strength must be in [0,1]')
    x = pack(doc, names)
    nx = np.clip((x-mu)/sigma,-15,15)[None,:]
    h1,z,_,_ = forward(nx,weights)
    rng = np.random.default_rng(seed)
    direction = rng.normal(size=z.shape)
    direction /= np.maximum(np.linalg.norm(direction,axis=1,keepdims=True),1e-9)
    z2 = np.clip(z + strength * np.sqrt(z.shape[1]) * direction, -.999, .999)
    hidden = np.tanh(z2 @ weights['W3']+weights['b3'])
    vector = ((hidden @ weights['W4']+weights['b4'])[0] * sigma + mu)
    generated = unpack(doc,names,vector)
    displacement = float(np.sqrt(np.mean((vector-x)**2)))
    return generated, {'inputReconstructionAndGenerationRmseCm':displacement,'latentDistance':float(np.linalg.norm(z2-z)),'basicGeometryValid':geometry_valid(generated)}


def save(output, weights, mu, sigma, report, names, template, family):
    output.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(output/'model.npz', **weights, mean=mu, scale=sigma)
    meta = {'modelType':'numpy-denoising-autoencoder-contour-v1','trained':True,'familyKeySha256':hashlib.sha256(family.encode()).hexdigest(),
            'panelOrder':names,'template':template,'metrics':report,'noManufacturingOrFitApproval':True,
            'architecture':{'hidden':len(weights['b1']),'latent':len(weights['b2'])},
            'dataset':'GarmentCodeData v2 verified local source specifications',
            'note':'Single exact four-panel topology family; held-out split at garment level. Generated contours require independent downstream EXO QA.'}
    (output/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    return meta


def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='command',required=True)
    train=sub.add_parser('train'); train.add_argument('--root',type=Path,default=DEFAULT_ROOT); train.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    train.add_argument('--seed',type=int,default=17); train.add_argument('--epochs',type=int,default=400); train.add_argument('--min-family',type=int,default=16)
    gen=sub.add_parser('generate'); gen.add_argument('--root',type=Path,default=DEFAULT_ROOT); gen.add_argument('--checkpoint',type=Path,default=DEFAULT_OUTPUT/'model.npz')
    gen.add_argument('--source-id',required=True); gen.add_argument('--seed',type=int,default=17); gen.add_argument('--strength',type=float,default=.12)
    args=ap.parse_args(); root=args.root.resolve()
    try:
        if args.command=='train':
            samples,names=datasets(root,args.min_family)
            weights,mu,sigma,report=train_arrays(samples,args.seed,args.epochs)
            report['generationAudit'] = evaluate_generation(samples,names,weights,mu,sigma,report)
            family=family_key(samples[0][1]); meta=save(args.output,weights,mu,sigma,report,names,samples[0][1],family)
            print(json.dumps({'ok':True,'checkpoint':str(args.output/'model.npz'),'manifest':str(args.output/'manifest.json'),'metrics':report,
                              'familyKeySha256':meta['familyKeySha256']}))
        else:
            ck=args.checkpoint.resolve(); meta=json.loads((ck.parent/'manifest.json').read_text())
            if ck.name != 'model.npz' or not meta.get('trained'):
                raise ValueError('Invalid checkpoint manifest')
            if not __import__('re').fullmatch(r'[A-Za-z0-9_-]+/\d{2}/[A-Za-z0-9_-]+',args.source_id):
                raise ValueError('Invalid source ID')
            found=next(((sid,doc) for sid,doc in source_records(root) if sid==args.source_id),None)
            if found is None:raise ValueError('Verified local source unavailable')
            sid,doc=found
            if hashlib.sha256(family_key(doc).encode()).hexdigest()!=meta['familyKeySha256']:
                raise ValueError('Source topology/seam family does not match trained checkpoint')
            body,batch,element=sid.split('/')
            with sqlite3.connect(f'file:{root / "pattern-index.sqlite3"}?mode=ro',uri=True) as db:
                source_hash=db.execute('SELECT sha256 FROM patterns WHERE body=? AND batch=? AND element=?',
                                       (body,int(batch),element)).fetchone()[0]
            with np.load(ck,allow_pickle=False) as saved:
                weights={k:saved[k] for k in ('W1','b1','W2','b2','W3','b3','W4','b4')};mu=saved['mean']; sigma=saved['scale']
            output,diagnostics=generate(doc,weights,mu,sigma,meta['panelOrder'],args.seed,args.strength)
            print(json.dumps({'ok':True,'sourceId':sid,'sourceSha256':source_hash,
                              'checkpointHash':hashlib.sha256(ck.read_bytes()).hexdigest(),
                              'sourceVerified':True,'generatedCandidateSourceVerified':False,
                              'generatedSpec':output,'model':'numpy-denoising-autoencoder-contour-v1',
                              'metrics':diagnostics,'exoQaPassed':False,'fitValidated':False,'gradingValidated':False,'factoryApproved':False}))
    except (OSError,ValueError,KeyError,TypeError,sqlite3.Error) as exc:
        print(json.dumps({'ok':False,'error':str(exc)}));raise SystemExit(1)


if __name__=='__main__':main()

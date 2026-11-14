#!/usr/bin/env python3
"""Mirror only COMPLETE and SHA256-checked Jarvis-trained seam models.

Nothing is copied from the source importer; the training agent writes its own
manifest last after checkpoint serialization. The primary Mac validates both
digest and tensor schema before exposing a mirrored checkpoint to EXO.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

import numpy as np


ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2/training'
REMOTE='/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/training'
QUERY=r'''import hashlib,json,pathlib
root=pathlib.Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2/training')
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as stream:
  for block in iter(lambda:stream.read(1048576),b''):h.update(block)
 return h.hexdigest()
records=[]
for manifest in sorted(root.glob('remote-seam-*/training-manifest.json')):
 model=manifest.parent/'seam-compatibility-v1.npz'
 if not model.is_file():continue
 try:
  data=json.loads(manifest.read_text())
  count=data['verifiedGarmentsRead']
  if data.get('schema')!='exo.garmentcodedata-v2.seam-compatibility.v1':continue
  if manifest.parent.name not in (f'remote-seam-{count//1000}k',
       f'remote-seam-full-{count}',f'remote-seam-deep-{count}'):
   continue
  records.append({'directory':manifest.parent.name,'trainedGarments':count,
       'manifestSha256':digest(manifest),'modelSha256':digest(model)})
 except (ValueError,KeyError,OSError):continue
selected=None
selection=root/'best-seam-model.json'
if selection.is_file():
 try:
  candidate=json.loads(selection.read_text())
  name=pathlib.Path(candidate['checkpoint']).parent.name
  count=candidate['trainedGarments']
  expected=root/name/'seam-compatibility-v1.npz'
  if (candidate.get('schema')=='exo.garmentcodedata-v2.seam-model-selection.v1'
      and pathlib.Path(candidate['checkpoint']).resolve()==expected.resolve()
      and candidate.get('selectionSource','').startswith('garment-disjoint validation')
      and any(row['directory']==name and row['trainedGarments']==count for row in records)):
   selected={'directory':name,'trainedGarments':count,
     'validationTop1PartnerRecall':candidate['validationTop1PartnerRecall']}
 except (ValueError,KeyError,OSError,TypeError):pass
print(json.dumps({'models':records,'selected':selected}))
'''


def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()


def validate_npz(file):
    with np.load(file,allow_pickle=False) as model:
        keys={'w1':(33,32),'b1':(32,), 'w2':(32,1),'b2':(1,),
              'mean':(33,), 'std':(33,), 'featureNames':(33,)}
        if not set(keys).issubset(model.files):raise ValueError('Missing model tensors')
        for name,shape in keys.items():
            if model[name].shape!=shape:raise ValueError(f'Invalid tensor shape {name}')
            if name!='featureNames' and not np.isfinite(model[name]).all():
                raise ValueError(f'Non-finite tensor: {name}')
        if (model['std']<=0).any():raise ValueError('Invalid model normalization')


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--host',default='100.82.90.101')
    p.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    args=p.parse_args(argv)
    if not re.fullmatch('[A-Za-z0-9.-]{1,253}',args.host) or not re.fullmatch('[A-Za-z0-9._-]{1,253}',args.ssh_alias):
        p.error('Invalid SSH host')
    options=['-o',f'HostName={args.host}','-o','BatchMode=yes',
             '-o','ConnectTimeout=8','-o','ServerAliveInterval=8']
    try:
        # While the low-priority trainer is extracting and optimizing, there
        # is no completed new checkpoint to copy. Skip probing Expansion's
        # busy external filesystem; this keeps the model mirror lightweight
        # and avoids transient SSH/file-I/O timeouts on the Intel host.
        running=subprocess.run(['/usr/bin/ssh',*options,args.ssh_alias,
            '/usr/bin/pgrep -f "remote_garmentcode_seam_offload.py --root"'],
            capture_output=True,text=True,timeout=25)
        if running.returncode==0:
            print('Jarvis model still training; keep existing EXO checkpoints and check again')
            return 0
        # The primary Mac can be heavily swapped and Expansion may be busy
        # scanning multi-GiB Parquets. Slow reads are not evidence of broken
        # models; leave a bounded but generous interval before retrying.
        query=subprocess.run(['/usr/bin/ssh',*options,args.ssh_alias,'/usr/bin/python3','-'],
            input=QUERY,capture_output=True,text=True,timeout=120)
        if query.returncode:
            raise OSError(query.stderr[-600:])
        listing=json.loads(query.stdout)
        remote=listing['models']
        if not isinstance(remote,list) or len(remote)>20:
            raise ValueError('Unexpected remote model listing')
        synced=[]
        for entry in remote:
            name=entry['directory'];count=entry['trainedGarments']
            if (not re.fullmatch(r'remote-seam-(?:\d+k|full-\d+|deep-\d+)',name)
                or not isinstance(count,int) or count<1000
                or name not in (f'remote-seam-{count//1000}k',
                                f'remote-seam-full-{count}',f'remote-seam-deep-{count}')):
                raise ValueError('Unexpected remote checkpoint identity')
            dest=LOCAL/name
            model_path=dest/'seam-compatibility-v1.npz'
            manifest_path=dest/'training-manifest.json'
            if (model_path.is_file() and manifest_path.is_file()
                and sha256(model_path)==entry['modelSha256']
                and sha256(manifest_path)==entry['manifestSha256']):
                synced.append({'model':name,'trainedGarments':count,'state':'already_verified'})
                continue
            dest.mkdir(parents=True,exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='.remote-model-',dir=dest) as work:
                staged=Path(work)
                for filename,expected in [('seam-compatibility-v1.npz',entry['modelSha256']),
                                           ('training-manifest.json',entry['manifestSha256'])]:
                    if not re.fullmatch(r'[0-9a-f]{64}',expected):
                        raise ValueError('Invalid checkpoint digest')
                    subprocess.run(['/usr/bin/scp',*options,
                        f'{args.ssh_alias}:{REMOTE}/{name}/{filename}',
                        str(staged/filename)],check=True,timeout=120)
                    if sha256(staged/filename)!=expected:
                        raise ValueError(f'Jarvis model digest mismatch: {filename}')
                doc=json.loads((staged/'training-manifest.json').read_text())
                if doc.get('verifiedGarmentsRead')!=count or doc.get('schema')!='exo.garmentcodedata-v2.seam-compatibility.v1':
                    raise ValueError('Remote model manifest did not match expected source count')
                validate_npz(staged/'seam-compatibility-v1.npz')
                os.replace(staged/'seam-compatibility-v1.npz',model_path)
                os.replace(staged/'training-manifest.json',manifest_path)
                synced.append({'model':name,'trainedGarments':count,'state':'mirrored_verified'})
        LOCAL.mkdir(parents=True,exist_ok=True)
        # Mirror the validated model pointer only when the selected complete
        # checkpoint has passed our independent SHA-256 and tensor checks.
        chosen=listing.get('selected')
        if chosen:
            name=chosen['directory'];count=chosen['trainedGarments']
            trusted=next((entry for entry in remote if entry['directory']==name
                          and entry['trainedGarments']==count),None)
            if trusted:
                dest=LOCAL/name
                weight=dest/'seam-compatibility-v1.npz'
                manifest=dest/'training-manifest.json'
                if (weight.is_file() and manifest.is_file()
                    and sha256(weight)==trusted['modelSha256']
                    and sha256(manifest)==trusted['manifestSha256']):
                    pointer=LOCAL/'best-seam-model.json'
                    tmp_pointer=pointer.with_suffix('.tmp')
                    tmp_pointer.write_text(json.dumps({
                        'schema':'exo.garmentcodedata-v2.seam-model-selection.v1',
                        'checkpoint':str(weight),'trainedGarments':count,
                        'validationTop1PartnerRecall':chosen['validationTop1PartnerRecall'],
                        'selectionSource':'garment-disjoint validation; research pattern ranking only'
                    },indent=2)+'\n')
                    os.replace(tmp_pointer,pointer)
        state=LOCAL/'seam-offload-mirror-status.json'
        tmp=state.with_suffix('.tmp')
        tmp.write_text(json.dumps({'schema':'exo.garmentcodedata-v2.remote-seam-mirror.v1',
            'synced':synced},indent=2)+'\n')
        os.replace(tmp,state)
        print(json.dumps(synced))
        return 0
    except (OSError,ValueError,KeyError,subprocess.TimeoutExpired,
            subprocess.CalledProcessError,json.JSONDecodeError) as error:
        print(f'Jarvis checkpoint mirror retry: {error}',file=sys.stderr)
        return 1


if __name__=='__main__':sys.exit(main())

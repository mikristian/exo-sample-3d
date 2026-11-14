"""Independent alpha-atlas WALK motion QA. Reject same stride pose copied
into every phase (can happen if sampling an 8-second walk at whole seconds).
Render in a proof-only CC0 pipeline; does not endorse runway gait quality.
"""
from pathlib import Path
import json,hashlib,sys
from PIL import Image,ImageChops,ImageStat

repo=Path(__file__).resolve().parents[2]
root=repo/'website/clothcraft/assets/fashion-avatars/rendered-cc0-proof-20261102'
m=json.loads((root/'manifest.json').read_text())
assert m['sourceKind']=='original-cc0' and m['license']=='CC0' and m['renderedOnly'] is True
results=[]
for gender,source in m['models'].items():
 img=Image.open(root/source['atlas']).convert('RGBA')
 cols=source['columns'];rows=source['rows'];w=source['width'];h=source['height']
 assert img.size==(w*cols,h*rows)
 angles=[]
 for row in range(rows):
  frames=[img.crop((col*w,row*h,(col+1)*w,(row+1)*h)) for col in range(cols)]
  alpha=[f.getchannel('A') for f in frames]
  distinct=len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})
  mean_changes=[]
  for i in range(1,cols):
   difference=ImageChops.difference(alpha[0],alpha[i]);mean_changes.append(ImageStat.Stat(difference).mean[0])
  max_alpha=max(mean_changes) if mean_changes else 0
  nonempty=sum(1 for a in alpha if a.getbbox() is not None)
  angle={'angle':source['directions'][row],'distinctPhaseImages':distinct,
         'maxMeanAlphaDifferenceFromPhaseZero':round(max_alpha,4),'framesWithVisibleAvatar':nonempty}
  assert nonempty==cols,angle
  assert distinct>=4,f'Frame atlas is static gait: {gender} angle {source["directions"][row]}, distinct={distinct}'
  assert max_alpha>=.20,f'Frame atlas has imperceptible silhouette motion: {gender} angle {source["directions"][row]}, max alpha diff {max_alpha:.4f}'
  angles.append(angle)
 results.append({'gender':gender,'width':w,'height':h,'phaseFrames':cols,'directions':angles})
print('EXO_RENDERED_FRAME_ACTUAL_MOTION',json.dumps({'status':'PASS','scope':'images vary across one walk cycle only, no high-end artistic signoff','models':results},indent=2))

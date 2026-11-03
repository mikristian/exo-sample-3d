"""Non-destructive coverage adjustment for an ORIGINAL rigidly skinned EXO dress.
Not physical cloth: expand pleated skirt 20-32mm radially from its authored
waist centre to reduce leg intersections during the verified skinned walk.
Outputs NEW distinct GLB, no mutation to existing approved files.
"""
import pathlib,json,struct,math,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
P=ROOT/'website/clothcraft/assets/fashion-avatars/garment-v1'
src=P/'EXO_feminine_clothed_motionfixed_clearfit_hem.glb'
out=P/'EXO_feminine_clothed_motionfixed_coverage.glb'
b=src.read_bytes();jl=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jl]);pos=20+((jl+3)//4)*4+8
raw=bytearray(b[pos:]);node=next((n for n in g['nodes'] if n.get('name')=='EXO Dress Skirt / Skinned Pleats'),None)
if not node:raise RuntimeError('Missing source skirt')
accessors=[]
for p in g['meshes'][node['mesh']]['primitives']:
 acc=g['accessors'][p['attributes']['POSITION']]
 if acc['type']!='VEC3' or acc['componentType']!=5126:raise RuntimeError('Need float vec3')
 view=g['bufferViews'][acc['bufferView']];start=view['byteOffset']+acc.get('byteOffset',0);stride=view.get('byteStride',12)
 bounds=[[],[],[]]
 for i in range(acc['count']):
  o=start+i*stride;x,y,z=struct.unpack_from('<fff',raw,o)
  t=max(0,min(1,(1.07-y)/.57));rz=z-.095
  r=math.hypot(x,rz)
  expansion=.020+.012*t
  xnew=x+expansion*x/max(r,1e-9);znew=z+expansion*rz/max(r,1e-9)
  struct.pack_into('<fff',raw,o,xnew,y,znew)
  for j,v in enumerate((xnew,y,znew)):bounds[j].append(v)
 acc['min']=[min(a) for a in bounds];acc['max']=[max(a) for a in bounds];accessors.append(acc['count'])
g.setdefault('extras',{})['exoPleatedSkirtClearanceStudy20261102']={
  'sourceSha256':hashlib.sha256(b).hexdigest(),
  'geometry':'20mm radial ease at waistband to 32mm at hem; unchanged skinning, rest pose body and original orbit',
  'physicalFabric':False,
  'garment':node['name']}
js=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4);raw+=b'\0'*((-len(raw))%4)
output=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(raw))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(raw),0x004e4942)+raw
if out.exists() and out.read_bytes()!=output:raise RuntimeError('Refuse replacing a previously staged coverage asset')
out.write_bytes(output)
print(json.dumps({'src':src.name,'out':out.name,'positionVertices':accessors,'sha256':hashlib.sha256(output).hexdigest(),
'reason':'prevent sampled thigh/pleat clipping without changing existing globe'},indent=2))

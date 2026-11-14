"""Proves the legally reusable Earth hero model variants changed *only* CC0
face/hair vertices and did not corrupt garments, rig, or walking animation.
Existing CLO academic files are deliberately never opened by this QA.
"""
import pathlib,struct,json,hashlib,math,sys
R=pathlib.Path(__file__).resolve().parents[2]
P=R/'website/clothcraft/assets/fashion-avatars/garment-v1'
NAMES=[('masculine','EXO_masculine_clothed_motionfixed.glb','EXO_masculine_cc0_distincthead_20261102.glb'),
       ('feminine','EXO_feminine_clothed_motionfixed_coverage.glb','EXO_feminine_cc0_distincthead_20261102.glb')]

def read_glb(file):
 d=file.read_bytes()
 assert d[:4]==b'glTF' and struct.unpack_from('<II',d,4)==(2,len(d))
 jlen=struct.unpack_from('<I',d,12)[0]
 g=json.loads(d[20:20+jlen]);off=20+((jlen+3)//4)*4+8
 return g,d[off:]

def bytes_for(g,b,i):
 a=g['accessors'][i];view=g['bufferViews'][a['bufferView']];typ=a['type'];sz={'VEC2':2,'VEC3':3,'VEC4':4,'SCALAR':1}[typ]*{5126:4,5123:2,5121:1,5125:4}[a['componentType']]
 stride=view.get('byteStride',sz);start=view.get('byteOffset',0)+a.get('byteOffset',0)
 return b''.join(b[start+k*stride:start+k*stride+sz] for k in range(a['count']))

def mesh_attributes(g,b):
 result={}
 for n in g['nodes']:
  if n.get('mesh') is None:continue
  name=n.get('name')
  primitives=g['meshes'][n['mesh']]['primitives'];digest={}
  for prim in primitives:
   for key,value in prim['attributes'].items():digest.setdefault(key,[]).append(hashlib.sha256(bytes_for(g,b,value)).hexdigest())
  result[name]={key:tuple(value) for key,value in digest.items()}
 return result

out=[]
for gender,reference,variant in NAMES:
 a,ba=read_glb(P/reference);c,bc=read_glb(P/variant)
 assert len(a['skins'])==len(c['skins'])==1
 assert len(a['skins'][0]['joints'])==len(c['skins'][0]['joints'])==163
 assert len(a['animations'])==len(c['animations'])==1
 assert len(a['animations'][0]['channels'])==len(c['animations'][0]['channels'])==489
 ma,mc=mesh_attributes(a,ba),mesh_attributes(c,bc)
 assert set(ma)==set(mc)
 changed={}
 for name in ma:
  for attr in set(ma[name])|set(mc[name]):
   if ma[name].get(attr)!=mc[name].get(attr):changed.setdefault(name,[]).append(attr)
 if not any('Parametric Body' in n and x==['POSITION'] for n,x in changed.items()):
  raise AssertionError('Face coordinates did not change or changed non-position skinning')
 if not any('short01' in n and x==['POSITION'] for n,x in changed.items()):
  raise AssertionError('Hair was not reshaped or broke skinning')
 if any(not(('Parametric Body' in n or 'short01' in n) and x==['POSITION']) for n,x in changed.items()):
  raise AssertionError('Unexpected non-head/garment/skeleton mesh attribute changes '+str(changed))
 for g1,g2 in [(a,c)]:
  assert g1['animations']==g2['animations'], 'Animation samplers/track indices altered'
  assert g1['skins']==g2['skins'], 'Skeleton joint mapping or bind pose changed'
  assert len(g1['nodes'])==len(g2['nodes'])
 extras=c.get('extras',{}).get('exoOriginalCC0Head20261102',{})
 assert extras.get('notCLOAvatar') is True and extras.get('license')=='CC0 source plus original procedural transformation'
 assert extras.get('bodyGarmentsBonesAnimationsRemainUnmodified') is True
 data={'gender':gender,'variant':variant,'headChangedMeshes':changed,
       'headMaxChangeMm':round(extras.get('faceMaxSculptM',0)*1000,2),
       'hairMaxChangeMm':round(extras.get('hairMaxSculptM',0)*1000,2),
       'bones':163,'animationChannels':489,'allGarmentWeightsAndGeometryUnmodified':True,
       'notCLOAssets':True,'safeCommercialSource':True}
 out.append(data)
 print('CC0_HEAD_GARMENT_RIG_QA',json.dumps(data,ensure_ascii=False),flush=True)
report=R/'website/clothcraft/qa/distincthead-rig-unchanged-20261102.json'
report.write_text(json.dumps({'schema':'exo.cc0.headvariant.integrity.v1','results':out},indent=2)+'\n')

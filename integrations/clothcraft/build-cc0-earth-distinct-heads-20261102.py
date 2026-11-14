"""Create ORIGINAL CC0 EXO face/hair variants for existing ClothCraft Earth orbit.

Important: These are NOT CLO heads nor derivatives of CLO assets. Website is
commercial, while this Mac's CLO session is Academic. Source geometry is from
CC0 MakeHuman Community; we change facial/head geometry and existing hair
without moving garments, changing 163 rig bind, glTF animation or site orbit.

All edits are confined to the head/hairstyle POSITIONS. The source is retained.
"""
import json,struct,pathlib,hashlib,math,copy
ROOT=pathlib.Path(__file__).resolve().parents[2]
P=ROOT/'website/clothcraft/assets/fashion-avatars/garment-v1'
SOURCES=[('masculine','EXO_masculine_clothed_motionfixed.glb','EXO_masculine_cc0_distincthead_20261102.glb'),
 ('feminine','EXO_feminine_clothed_motionfixed_coverage.glb','EXO_feminine_cc0_distincthead_20261102.glb')]

def glb_read(file):
 b=file.read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<II',b,4)==(2,len(b))
 off=12;g=None;blob=None
 while off<len(b):
  ln,typ=struct.unpack_from('<II',b,off);off+=8
  if typ==0x4e4f534a:g=json.loads(b[off:off+ln])
  if typ==0x004e4942:blob=bytearray(b[off:off+ln])
  off+=ln
 assert g is not None and blob is not None
 return g,blob

def glb_write(g,blob):
 body=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf8');body+=b' '*((-len(body))%4)
 blob+=b'\0'*((-len(blob))%4)
 return b'glTF'+struct.pack('<II',2,12+8+len(body)+8+len(blob))+struct.pack('<II',len(body),0x4e4f534a)+body+struct.pack('<II',len(blob),0x004e4942)+blob

def gaussian(v,center,radius):return math.exp(-((v-center)/radius)**2)

def update_positions(g,blob,mesh,func,visited):
 new_count=0;max_disp=0
 for prim in g['meshes'][mesh]['primitives']:
  ai=prim['attributes']['POSITION']
  if ai in visited:continue
  visited.add(ai)
  a=g['accessors'][ai];view=g['bufferViews'][a['bufferView']]
  assert a['type']=='VEC3' and a['componentType']==5126 and not a.get('sparse')
  start=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',12)
  bounds=[[],[],[]]
  for i in range(a['count']):
   off=start+i*stride;point=struct.unpack_from('<fff',blob,off)
   moved=func(*point)
   d=math.dist(point,moved)
   max_disp=max(max_disp,d)
   new_count+=d>1e-7
   struct.pack_into('<fff',blob,off,*moved)
   for j,v in enumerate(moved):bounds[j].append(v)
  a['min']=[min(v) for v in bounds];a['max']=[max(v) for v in bounds]
 return new_count,max_disp

for gender,filename,target in SOURCES:
 source=P/filename;g,blob=glb_read(source)
 assert len(g.get('skins',[]))==1 and len(g['skins'][0]['joints'])==163
 assert len(g.get('animations',[]))==1 and len(g['animations'][0]['channels'])==489
 body=next(n for n in g['nodes'] if n.get('name')=='EXO Adult 01 - Parametric Body')
 hair=next(n for n in g['nodes'] if n.get('name','').endswith('short01'))
 assert body.get('skin')==0 and hair.get('skin')==0
 h0={'masculine':1.66,'feminine':1.53}[gender]
 def sculpt_face(x,y,z):
  # The original CC0 MakeHuman rest mesh is Y-up, with face toward +Z.
  face=gaussian(max(z,.0),.12,.13)
  head=gaussian(y,h0,.083)
  cheek=gaussian(y,h0+.002,.035)*gaussian(abs(x),.061,.034)*face
  jaw=gaussian(y,h0-.07,.043)*gaussian(abs(x),.070,.041)*face
  chin=gaussian(y,h0-.092,.028)*gaussian(x,0,.041)*face
  nose=gaussian(y,h0+.01,.029)*gaussian(x,0,.023)*gaussian(z,.143,.046)
  if gender=='masculine':
   xx=x+(x*.075*cheek)-(x*.075*jaw)
   yy=y+.003*cheek-.004*chin
   zz=z+.008*cheek+.008*nose+.004*chin
  else:
   xx=x+(x*.065*cheek)-(x*.105*jaw)
   yy=y-.002*cheek
   zz=z+.006*cheek+.004*nose+.006*chin
  return (xx,yy,zz)
 def style_hair(x,y,z):
  if gender=='masculine':
   return (x*1.012,y+.002*gaussian(y,h0+.07,.05),z-.003*gaussian(y,h0+.06,.09))
  # Widen the original layered haircut into a shoulder-length silhouette.
  # All existing per-vertex head weights are retained for head motion.
  down=gaussian(y,h0-.07,.082)
  side=gaussian(abs(x),.067,.043)
  return (x*(1+.15*down),y-.026*down*side,z-.007*down)
 visited=set()
 bm,bd=update_positions(g,blob,body['mesh'],sculpt_face,visited)
 hm,hd=update_positions(g,blob,hair['mesh'],style_hair,visited)
 if bm<90 or hm<50 or bd>.03 or hd>.05:raise RuntimeError('Head sculpt out of expected safe geometry range')
 mat_ix=g['meshes'][hair['mesh']]['primitives'][0].get('material')
 if mat_ix is not None:
  material=g['materials'][mat_ix]
  color=material.setdefault('pbrMetallicRoughness',{})
  color['baseColorFactor']=[.12,.09,.085,1] if gender=='masculine' else [.16,.10,.077,1]
  color['roughnessFactor']=.84
 g.setdefault('extras',{})['exoOriginalCC0Head20261102']={
  'source':'MakeHuman Community CC0 EXO parametric body and hair (not CLO)',
  'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'bodyHeadVertexChanges':bm,'hairVertexChanges':hm,
  'faceMaxSculptM':round(bd,6),'hairMaxSculptM':round(hd,6),
  'license':'CC0 source plus original procedural transformation',
  'bodyGarmentsBonesAnimationsRemainUnmodified':True,
  'riggedWalkQuality':'experimental; slow v6 biomechanical walk has not passed professional animator review',
  'notCLOAvatar':True,
 }
 result=glb_write(g,blob)
 output=P/target
 if output.exists() and output.read_bytes()!=result:raise RuntimeError('Existing distinct-head GLB changed, will not overwrite')
 output.write_bytes(result)
 print('EXO_CC0_DISTINCT_HEAD',json.dumps({'gender':gender,'source':filename,'output':target,'bytes':len(result),
  'sha256':hashlib.sha256(result).hexdigest(),'headVertsChanged':bm,'hairVertsChanged':hm,'maxHeadChangeMm':round(bd*1000,2),
  'maxHairChangeMm':round(hd*1000,2),'boneCount':163,'clipChannels':489}),flush=True)

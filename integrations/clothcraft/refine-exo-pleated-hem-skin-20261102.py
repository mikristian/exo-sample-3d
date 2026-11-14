"""Increase skirt hem response by mapping its pre-existing thigh influence to
EXO's actually animated upperleg02 joints, preserving pelvis weights and fabric
geometry. This is skinning, not physical fabric simulation; output distinct GLB.
"""
import pathlib,json,struct,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
P=ROOT/'website/clothcraft/assets/fashion-avatars/garment-v1'
src=P/'EXO_feminine_clothed_motionfixed_clearfit.glb'
out=P/'EXO_feminine_clothed_motionfixed_clearfit_hem.glb'
b=src.read_bytes();jl=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jl]);off=20+((jl+3)//4)*4+8;data=bytearray(b[off:]);
if len(g.get('skins',[]))!=1:raise RuntimeError('Expected one shared 163 bone rig')
name=[g['nodes'][j]['name'] for j in g['skins'][0]['joints']]
byname={value:index for index,value in enumerate(name)}
if len(name)!=163:raise RuntimeError('Not EXO 163-bone rig')
changes={byname['upperleg01.L']:byname['upperleg02.L'],byname['upperleg01.R']:byname['upperleg02.R']}
meshes=[n for n in g['nodes'] if n.get('name')=='EXO Dress Skirt / Skinned Pleats']
if len(meshes)!=1:raise RuntimeError('Missing exclusive dress skirt mesh')
mesh=g['meshes'][meshes[0]['mesh']]
modified=0
for p in mesh['primitives']:
 joint=g['accessors'][p['attributes']['JOINTS_0']];view=g['bufferViews'][joint['bufferView']]
 if joint['componentType']!=5121 or joint['type']!='VEC4':raise RuntimeError('Unexpected joint bytes')
 start=view.get('byteOffset',0)+joint.get('byteOffset',0)
 stride=view.get('byteStride',4)
 for i in range(joint['count']):
  for v in range(4):
   pos=start+i*stride+v
   old=data[pos]
   if old in changes:data[pos]=changes[old];modified+=1
if modified<350:raise RuntimeError('Skirt bone influences not correctly mapped')
g.setdefault('extras',{})['exoSkirtHemSkinRefinement20261102']={
 'reason':'Use existing animated upperleg02 joint influence rather than static upperleg01 rest joint',
 'status':'Experimental joint skinning; no dynamic fabric solver',
 'modifiedJointReferences':modified,'originalSha256':hashlib.sha256(b).hexdigest()}
js=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4);data+=b'\0'*((-len(data))%4)
finished=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
if out.exists() and out.read_bytes()!=finished:raise RuntimeError('Refuse changing already published garment variant')
out.write_bytes(finished)
print(json.dumps({'output':str(out),'modifiedBoneInfluences':modified,'sha256':hashlib.sha256(finished).hexdigest(),'meshSkinStatus':'experimental, rigged clothing (not cloth dynamics)'},indent=2))

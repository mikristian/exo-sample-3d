"""Transplant an independently verified 163-bone EXO walk clip onto skinned
CC0/MakeHuman clothed assets using exact skeleton names. Never edits source.

Why: Blender 5 rig action datablock interchange can silently export 489 *static*
rotation tracks even though root travel animates. This code copies the real
source per-bone glTF animation samplers and keeps the clothed target's real
PBR garment mesh, armature/skin and skinning weights intact.

The source root translation is converted to an IN-PLACE walk: removes forward
motion on orbital website path but keeps vertical root movement. This does
not create physics garment cloth nor claim runway-grade motion quality.
"""
import json,struct,hashlib,pathlib,copy,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'../exo-avatar-research-20261102/runway_v6_sole_compensated/EXO_Runway_Walk_v6_SoleContactSafetyMargin.glb'
DEST=ROOT/'website/clothcraft/assets/fashion-avatars/garment-v1'
ENTRIES=[('masculine','EXO_masculine_clothed_experimental.glb','EXO_masculine_clothed_motionfixed.glb'),
         ('feminine','EXO_feminine_clothed_clearfit.glb','EXO_feminine_clothed_motionfixed_clearfit.glb')]

def read_glb(path):
 b=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',b)
 if magic!=b'glTF' or version!=2 or total!=len(b):raise ValueError('Invalid glTF 2 binary '+str(path))
 pos=12;json_chunk=None;bin_chunk=None
 while pos<len(b):
  size,kind=struct.unpack_from('<II',b,pos);pos+=8
  chunk=b[pos:pos+size];pos+=size
  if kind==0x4E4F534A:json_chunk=json.loads(chunk)
  if kind==0x004E4942:bin_chunk=chunk
 if json_chunk is None or bin_chunk is None:raise ValueError('Missing GLB chunks '+str(path))
 return json_chunk,bin_chunk

def write_glb(dest,content,data):
 obj=json.dumps(content,ensure_ascii=False,separators=(',',':')).encode('utf8')
 obj+=b' '*((-len(obj))%4)
 data+=b'\0'*((-len(data))%4)
 out=b'glTF'+struct.pack('<II',2,12+8+len(obj)+8+len(data))+struct.pack('<II',len(obj),0x4E4F534A)+obj+struct.pack('<II',len(data),0x004E4942)+data
 if dest.exists():
  if hashlib.sha256(dest.read_bytes()).digest()!=hashlib.sha256(out).digest():raise RuntimeError('Existing produced model differs; refuse overwrite '+str(dest))
 else:dest.write_bytes(out)
 return len(out),hashlib.sha256(out).hexdigest()

base,source_bytes=read_glb(SOURCE)
src_animation=base['animations'][0]
for kind,input_file,output_file in ENTRIES:
 target,raw=read_glb(DEST/input_file)
 target=copy.deepcopy(target)
 src_names={base['nodes'][n]['name']:n for n in base['skins'][0]['joints']}
 tgt_names={target['nodes'][n]['name']:n for n in target['skins'][0]['joints']}
 if len(src_names)!=163 or len(tgt_names)!=163 or set(src_names)!=set(tgt_names):
  raise RuntimeError('Complete 163-bone EXO rigs must share EXACT names; no unvalidated retarget')
 if len(base.get('animations',[]))<1 or len(target.get('skins',[]))<1:
  raise RuntimeError('Missing source walk or target body skin')
 new_data=bytearray(raw)
 new_data.extend(b'\0'*((-len(new_data))%4))
 new_accessors={}
 new_buffer_views={}
 def remap_accessor(i):
  if i in new_accessors:return new_accessors[i]
  accessor=copy.deepcopy(base['accessors'][i]);idx=accessor['bufferView'];view=base['bufferViews'][idx]
  if view.get('buffer',0)!=0 or accessor.get('sparse'):raise RuntimeError('Interleaved/sparse glTF animation accessor unsupported')
  if idx not in new_buffer_views:
   start=view.get('byteOffset',0);size=view['byteLength']
   cursor=len(new_data);new_data.extend(source_bytes[start:start+size]);new_data.extend(b'\0'*((-len(new_data))%4))
   cloned=copy.deepcopy(view);cloned['buffer']=0;cloned['byteOffset']=cursor
   new_buffer_views[idx]=len(target['bufferViews']);target['bufferViews'].append(cloned)
  accessor['bufferView']=new_buffer_views[idx]
  new_accessors[i]=len(target['accessors']);target['accessors'].append(accessor)
  return new_accessors[i]
 samplers=[]
 for entry in src_animation['samplers']:
  sampler=copy.deepcopy(entry)
  sampler['input']=remap_accessor(entry['input']);sampler['output']=remap_accessor(entry['output'])
  samplers.append(sampler)
 channels=[]
 for ch in src_animation['channels']:
  name=base['nodes'][ch['target']['node']]['name']
  if name not in tgt_names:raise RuntimeError('Unmapped animated bone '+name)
  dup=copy.deepcopy(ch);dup['target']['node']=tgt_names[name]
  channels.append(dup)
 if len(channels)<480:raise RuntimeError('Incomplete target animation')
 # Source movement direction is local Z; orbit carrier performs travel.
 # Preserve the source bone root's vertical balance/soft sole correction.
 root_channels=[ch for ch in channels if target['nodes'][ch['target']['node']]['name']=='root' and ch['target']['path']=='translation']
 if len(root_channels)!=1:raise RuntimeError('Root translation track missing')
 ch=root_channels[0];acc=target['accessors'][samplers[ch['sampler']]['output']]
 bv=target['bufferViews'][acc['bufferView']];off=bv['byteOffset']+acc.get('byteOffset',0)
 if acc['componentType']!=5126 or acc['type']!='VEC3':raise RuntimeError('Unrecognized root translation track encoding')
 first=struct.unpack_from('<fff',new_data,off)
 last=struct.unpack_from('<fff',new_data,off+(acc['count']-1)*12)
 for index in range(acc['count']):
  p=off+12*index;current=struct.unpack_from('<fff',new_data,p)
  struct.pack_into('<fff',new_data,p,first[0],current[1],first[2])
 # Flat X/Z root animation key sample, preserve vertical root bob.
 target['animations']=[{'name':'Walk_Experimental_Clothed_InPlace','samplers':samplers,'channels':channels}]
 target['buffers'][0]['byteLength']=len(new_data)
 target.setdefault('extras',{})['exoClothcraftMotion20261102']={
  'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  'originalTargetSha256':hashlib.sha256((DEST/input_file).read_bytes()).hexdigest(),
  'status':'experimental skeletal walk, garments skin to rig, no dynamic fabric simulation',
  'inPlaceRootTravel':True,
  'originalRootDeltaMeters':[round(last[j]-first[j],4) for j in range(3)],
 }
 out=DEST/output_file
 size,digest=write_glb(out,target,bytes(new_data))
 print(json.dumps({'kind':kind,'source':str(SOURCE),'output':str(out),'bytes':size,'sha256':digest,'bones':len(src_names),'channels':len(channels),'oldRootTravelMeters':[round(last[j]-first[j],4) for j in range(3)],'motionQuality':'experimental, not certified'},indent=2))

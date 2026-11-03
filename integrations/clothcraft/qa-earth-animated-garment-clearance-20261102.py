"""Independent Blender-reimport sampled clearance of the FINAL glTF animated
clothed avatars. Estimates garment vs body clipping using nearest-body-face
normals; not proof of physically simulated fabric or zero polygon intersections.
"""
import bpy,json,sys,pathlib,collections,os
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[2]
ASSETS=ROOT/'website/clothcraft/assets/fashion-avatars/garment-v1'
DEST=ROOT/'website/clothcraft/qa'/os.environ.get('EXO_CLEARANCE_REPORT','animated-clothes-clearance-20261102.json')
files={'masculine':os.environ.get('EXO_MALE_ASSET','EXO_masculine_clothed_motionfixed.glb'),
       'feminine':os.environ.get('EXO_FEMALE_ASSET','EXO_feminine_clothed_motionfixed_clearfit_hem.glb')}
report={'scope':'2026-11-02 current Earth header clothed visual GLBs','method':'Blender GLB import, animation at 1/7/13/19/25/37/49/73 frames, nearest visible body normal signed gap; negative values estimate body intersection','certifiedFabricSimulation':False,'models':[]}
for label,file in files.items():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ASSETS/file))
 bodies=[o for o in bpy.data.objects if o.type=='MESH' and len(o.data.vertices)>13000 and 'Parametric' in o.name]
 if len(bodies)!=1:raise RuntimeError('Cannot identify exclusive body surface '+str([(o.name,len(o.data.vertices)) for o in bodies]))
 body=bodies[0]
 garments=[o for o in bpy.data.objects if o.type=='MESH' and any(k in o.name.lower() for k in ('jean','shirt','dress','skirt'))]
 if len(garments)!=2:raise RuntimeError('No two clothing pieces '+str([o.name for o in garments]))
 model={'id':label,'file':file,'bodyVertices':len(body.data.vertices),'garments':[]}
 for g in garments:
  series=[]
  for frame in [1,7,13,19,25,37,49,73]:
   bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   be=body.evaluated_get(dg);ge=g.evaluated_get(dg)
   bm=be.to_mesh();gm=ge.to_mesh()
   bv=[be.matrix_world@v.co for v in bm.vertices]
   polys=[tuple(p.vertices) for p in bm.polygons]
   bvh=BVHTree.FromPolygons(bv,polys,all_triangles=False)
   gaps=[];stride=max(1,len(gm.vertices)//550)
   for v in list(gm.vertices)[::stride]:
    p=ge.matrix_world@v.co
    nearest,normal,idx,dist=bvh.find_nearest(p)
    if nearest is None:continue
    gaps.append((p-nearest).dot(normal))
   ge.to_mesh_clear();be.to_mesh_clear()
   if not gaps:raise RuntimeError('No garment-body mesh contact samples')
   series.append({'frame':frame,'samples':len(gaps),'minSignedClearanceMm':round(1000*min(gaps),3),
     'insideOver2Mm':sum(d<-.002 for d in gaps),'insideOver5Mm':sum(d<-.005 for d in gaps),
     'medianSignedClearanceMm':round(1000*sorted(gaps)[len(gaps)//2],3)})
  model['garments'].append({'name':g.name,'frames':series,
    'worstClearanceMm':min(v['minSignedClearanceMm'] for v in series),
    'totalInsideOver5Mm':sum(v['insideOver5Mm'] for v in series)})
 report['models'].append(model)
 print('CLOTH_ANIMATED_CLEARANCE',label,[(g['name'],g['worstClearanceMm'],g['totalInsideOver5Mm']) for g in model['garments']],flush=True)
DEST.write_text(json.dumps(report,indent=2)+'\n')

// Controlled one-way staging of EXO-generated MakeHuman/MPFB CC0 fitting bodies.
// This is not a generic filesystem importer and never consumes arbitrary user paths.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const sourceRoot=path.resolve(project,'../exo-avatar-research-20261102')
const destRoot=path.join(project,'public/avatars/exo')
const fixtures=[
  {id:'exo-feminine-01',dir:'pilot',label:'EXO Feminine 01'},
  {id:'exo-masculine-01',dir:'pilot-masculine',label:'EXO Masculine 01'},
  {id:'exo-shape-01',dir:'pilot-variation',label:'EXO Body Variation 01'},
]
const checksum = data=>crypto.createHash('sha256').update(data).digest('hex')
function transformCollision(src){
  const lines=src.toString('utf8').split(/\r?\n/)
  let verts=0,faces=0
  const converted=lines.map(line=>{
    if(line.startsWith('v ')){
      const coords=line.trim().split(/\s+/).slice(1).map(Number)
      if(coords.length!==3||!coords.every(Number.isFinite))throw Error('Invalid native OBJ vertex')
      verts++
      // Blender Z-up to Three/Rust Y-up, a proper X-axis -90-degree rotation.
      return `v ${coords[0].toFixed(9)} ${coords[2].toFixed(9)} ${(-coords[1]).toFixed(9)}`
    }
    if(line.startsWith('f ')){
      if(!/^f \d+ \d+ \d+$/.test(line))throw Error('Only triangulated native mesh accepted')
      faces++
    }
    return line
  })
  if(verts!==13380||faces!==26756)throw Error(`Unexpected base topology ${verts}/${faces}`)
  return {data:Buffer.from(['# EXO MPFB CC0 collision mesh, Y-up metres; source hash in manifest',...converted].join('\n')),vertices:verts,triangles:faces}
}
if(!fs.existsSync(path.join(sourceRoot,'EXO_AVATAR_PILOT_MANIFEST.json')))
  throw Error('EXO avatar research artifacts are missing; do not create mock fitting bodies')
const pilot=JSON.parse(fs.readFileSync(path.join(sourceRoot,'EXO_AVATAR_PILOT_MANIFEST.json'),'utf8'))
fs.mkdirSync(destRoot,{recursive:true})
const published=[]
for(const f of fixtures){
  const record=pilot.assets.find(a=>a.folder===f.dir)
  if(!record)throw Error('Missing source pilot '+f.dir)
  const srcGlb=path.join(sourceRoot,f.dir,'exo_adult_01_visual.glb')
  const srcObj=path.join(sourceRoot,f.dir,'exo_adult_01_collision.obj')
  const glb=fs.readFileSync(srcGlb)
  const obj=fs.readFileSync(srcObj)
  if(checksum(glb)!==record.files['exo_adult_01_visual.glb']?.sha256||
     checksum(obj)!==record.files['exo_adult_01_collision.obj']?.sha256)
    throw Error(`Provenance mismatch for ${f.id}`)
  const rotated=transformCollision(obj)
  const destGlb=path.join(destRoot,`${f.id}.glb`)
  const destObj=path.join(destRoot,`${f.id}.obj`)
  fs.writeFileSync(destGlb,glb)
  fs.writeFileSync(destObj,rotated.data)
  published.push({id:f.id,label:f.label,visual:`/avatars/exo/${f.id}.glb`,collider:`avatars/exo/${f.id}.obj`,
    visualSha256:checksum(glb),colliderSha256:checksum(rotated.data),sourceObjSha256:checksum(obj),
    vertices:rotated.vertices,triangles:rotated.triangles,sourceLicense:'MakeHuman system CC0 assets',
    physicsStatus:'native-collider-path-registered-not-certified',
    shapeParameters:record.morph_values})
}
fs.writeFileSync(path.join(destRoot,'manifest.json'),JSON.stringify({schema:'exo.avatar.library.v1',
  geometryAxes:'Y-up metres (X,Y,Z) from original (X,Z,-Y)',assets:published},null,2)+'\n')
console.log('EXO_NATIVE_AVATAR_ASSETS_READY',published.map(p=>({id:p.id,triangles:p.triangles,colliderSha256:p.colliderSha256})))

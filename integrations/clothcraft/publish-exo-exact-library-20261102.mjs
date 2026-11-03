// Publish *immutable* newly named CC0 precision-collider research models,
// never overwrite the first-generation physical body files or saved projects.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const source=path.resolve(root,'../exo-avatar-research-20261102/visual_collider_exact')
const manifest=JSON.parse(fs.readFileSync(path.join(source,'exact_library_manifest.json'),'utf8'))
if(manifest.schema!=='exo.av.bake.exact.v1'||!Array.isArray(manifest.assets)||manifest.assets.length!==3)
  throw Error('Missing authenticated EXO Blender precision-body manifest')
const destination=path.join(root,'public/avatars/exo')
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
const published=[]
for(const entry of manifest.assets){
  if(!/^exo-(feminine|masculine|shape)-02-exact$/.test(entry.id)||
     entry.visual!==entry.id+'.glb'||entry.collider!==entry.id+'.obj')
    throw Error('Unknown precision-body fixture or path')
  const files=[['visual',entry.visual,'visualSha256'],['collider',entry.collider,'colliderSha256']]
  for(const [kind,filename,key] of files){
    const src=path.join(source,filename),dest=path.join(destination,filename)
    const sourceBytes=fs.readFileSync(src)
    if(sourceBytes.length<100_000||sha256(sourceBytes)!==entry[key])throw Error('Baked '+kind+' source digest mismatch')
    if(fs.existsSync(dest)&&sha256(fs.readFileSync(dest))!==entry[key])
      throw Error('An existing published '+kind+' fixture differs; refuse overwrite')
    fs.writeFileSync(dest,sourceBytes)
  }
  published.push({id:entry.id,label:'EXO '+entry.id.split('-')[1]+' · precision body',
    visual:'/avatars/exo/'+entry.visual,collider:'avatars/exo/'+entry.collider,
    rigBones:entry.rigBones,colliderVertices:entry.colliderVertices,colliderTriangles:entry.colliderTriangles,
    heightM:entry.heightM,visualSha256:entry.visualSha256,colliderSha256:entry.colliderSha256,
    fitCertified:false,alignmentMillimeters:'TEST_IN_BROWSER'})
}
const json=path.join(destination,'exact-library-manifest.json')
fs.writeFileSync(json,JSON.stringify({schema:'exo.avatar.exact.v1',published,license:'CC0 MakeHuman',
  disclaimer:'Rigged static appearance/collider alignment is not calibrated garment fit or animated collider synchronization'},null,2)+'\n')
console.log('EXO_EXACT_LIBRARY_PUBLISHED',JSON.stringify(published.map(v=>({id:v.id,heightM:v.heightM}))))

// Published as a DISTINCT native collider identity, despite exact-matched
// duplicate body geometry, so save/reopen does not silently change hairstyles.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const research=path.resolve(root,'../exo-avatar-research-20261102/visual_collider_exact')
const p=JSON.parse(fs.readFileSync(path.join(research,'hybrid_exact_manifest.json'),'utf8'))
const exact=JSON.parse(fs.readFileSync(path.join(research,'exact_library_manifest.json'),'utf8')).assets.find(x=>x.id==='exo-masculine-02-exact')
if(p.id!=='exo-masculine-03-hybrid'||p.bodyVerts!==13380||p.bones!==163||!exact)throw Error('Invalid hybrid build provenance')
const glb=fs.readFileSync(path.join(research,p.id+'.glb'))
const obj=fs.readFileSync(path.join(research,exact.collider))
const digest=b=>createHash('sha256').update(b).digest('hex')
if(digest(glb)!==p.visualSha256||digest(obj)!==exact.colliderSha256)throw Error('Visual or physical source SHA256 changed')
const out=path.join(root,'public/avatars/exo')
for(const [file,bytes] of [[p.id+'.glb',glb],[p.id+'.obj',obj]]){
 const target=path.join(out,file)
 if(fs.existsSync(target)&&digest(fs.readFileSync(target))!==digest(bytes))throw Error('Existing generated model has conflicting immutable bytes')
 fs.writeFileSync(target,bytes)
}
fs.writeFileSync(path.join(out,'hybrid-precision-manifest.json'),JSON.stringify({id:p.id,source:p.source,
 collider:p.id+'.obj',visual:p.id+'.glb',bodySurfaceReference:exact.id,
 visualSha256:digest(glb),colliderSha256:digest(obj),faceAndHairPhotorealistic:false,
 material:'MakeHuman CC0 and original procedural hair fibers',fitCertified:false},null,2)+'\n')
console.log('EXO_HYBRID_IMMUTABLE_STAGED',p.id,'visualMB',(glb.length/1048576).toFixed(2),'body',digest(obj).slice(0,20))

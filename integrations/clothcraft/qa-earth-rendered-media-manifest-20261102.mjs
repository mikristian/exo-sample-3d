/**
 * Verifies the ORIGIN of frame-only 3D Earth avatar proofs, not the visual quality.
 * It refuses unexpected model files and unsigned/misidentified source assets.
 * Usage: node integrations/clothcraft/qa-earth-rendered-media-manifest-20261102.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {assessExoRenderedEarthMedia20261102} from '../../src/core/exoAvatarRenderedMediaRights20261102.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const media=path.join(repo,'website/clothcraft/assets/fashion-avatars/rendered-cc0-proof-20261102')
const manifest=JSON.parse(fs.readFileSync(path.join(media,'manifest.json'),'utf8'))
assert.deepEqual(Object.keys(manifest.models||{}).sort(),['feminine','masculine'])
const hash=data=>createHash('sha256').update(data).digest('hex')
const atlasFiles=[]
const evidence=[]

for(const label of ['masculine','feminine']){
 const model=manifest.models[label]
 assert.ok(model&&typeof model==='object',`Missing ${label} model`)
 assert.equal(model.framesPerDirection,manifest.framesPerDirection)
 assert.equal(model.rows,4)
 assert.equal(model.columns,8)
 assert.deepEqual(model.directions,[0,90,180,270])
 assert.equal(model.alphaFrames.length,32)
 assert.deepEqual(model.alphaExtrema,[0,255])
 const atlas=String(model.atlas||'')
 assert.match(atlas,/^\.\/[-\w]+\.webp$/)
 const filename=path.resolve(media,atlas)
 assert.equal(path.dirname(filename),media,'Atlas path must stay inside proof media folder')
 const bytes=fs.readFileSync(filename)
 assert.equal(bytes.toString('ascii',0,4),'RIFF')
 assert.equal(bytes.toString('ascii',8,12),'WEBP')
 assert.ok(bytes.length<12*1024*1024,'Proof atlas unexpectedly large')
 assert.equal(hash(bytes),model.atlasSha256,'Image hash must match generated manifest')
 const expectedSource=`EXO_${label}_cc0_distincthead_20261102.glb`
 assert.equal(model.source,`../garment-v1/${expectedSource}`)
 const source=path.resolve(media,model.source)
 assert.equal(source,path.join(repo,'website/clothcraft/assets/fashion-avatars/garment-v1',expectedSource))
 assert.equal(hash(fs.readFileSync(source)),model.sourceSha256,'Original CC0 character hash changed')
 atlasFiles.push(atlas)
 evidence.push({model:label,frameCount:32,viewDirections:model.directions,
   imageBytes:bytes.length,imageSha256:model.atlasSha256,
   origin:expectedSource,sourceVerified:true})
}

const rights=assessExoRenderedEarthMedia20261102({
  sourceKind:manifest.sourceKind,
  license:manifest.license,
  sourceIsCommerciallyAuthorized:manifest.commercialSourceAuthorized,
  renderedOnly:manifest.renderedOnly,
  framesPerDirection:manifest.framesPerDirection,
  directions:manifest.directions,
  atlasFiles,
})
assert.equal(rights.allowed,true,rights.issues.join('; '))
const files=fs.readdirSync(media)
assert.ok(files.every(name=>name==='manifest.json'||/^(feminine|masculine)\.webp$/.test(name)),
  'Frame-only media folder must not contain GLB, CLO models or unrelated assets')
console.log('EXO_EARTH_RENDERED_MEDIA_PROVENANCE',JSON.stringify({rights:rights.allowed,
  rendersOnly:true,noCloAcademicContent:true,noRaw3DModels:true,models:evidence},null,2))

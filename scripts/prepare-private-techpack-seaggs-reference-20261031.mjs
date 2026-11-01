#!/usr/bin/env node
// LOCAL OPT-IN: source is an untracked, user-owned private T-shirt demo JSON.
// This script contains no purchased imagery and never writes to public/.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const repo=path.resolve(import.meta.dirname,'..')
const input=path.join(repo,'integrations/clothcraft/output/techpacks',
  'MIKRISTIAN_SEAGGS_TSHIRT_MEDIA_OBJECTS_TRANSPARENT_PRIVATE_20261031.json')
if(!fs.existsSync(input))throw Error('Private SEAGGS T-shirt example missing; import your owned reference manually.')
const data=JSON.parse(fs.readFileSync(input,'utf8'))
const record=data?.draft?.workspace?.assets?.find(asset=>asset.id==='seaggs-private-transparent-20261031')
const dataUrl=record?.dataUrl
if(typeof dataUrl!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl))
  throw Error('Verified private transparency-derived raster is missing')
const bytes=Buffer.from(dataUrl.slice('data:image/png;base64,'.length),'base64')
if(bytes.length<100||bytes.length>=240000)throw Error('Private reference invalid or above import limit')
const dir=path.join(repo,'dist/private-mockups')
fs.mkdirSync(dir,{recursive:true})
const destination=path.join(dir,'seaggs-tshirt-private-transparent.png')
fs.writeFileSync(destination,bytes,{mode:0o600})
console.log('PREPARED_USER_PRIVATE_REFERENCE',path.relative(repo,destination),bytes.length,
  crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20))
for(const view of ['front','back']){
  const vectorSource=path.join(repo,'research/techpack-library/seaggs-v2-private',`tshirt-${view}.svg`)
  if(!fs.existsSync(vectorSource))continue
  const vector=fs.readFileSync(vectorSource,'utf8').trim()
  if(vector.length<100||Buffer.byteLength(vector)>285000||!vector.startsWith('<svg')||
     !/<path\b/i.test(vector)||/<(?:script|foreignObject|image|iframe)\b|\bon\w+\s*=|\b(?:href|src)\s*=|url\s*\(/i.test(vector))
    throw Error('Private SVG must be standalone path-only vector artwork, under 285 KB')
  const out=path.join(dir,`seaggs-tshirt-${view}-vector.svg`)
  fs.writeFileSync(out,vector,{mode:0o600})
  console.log('PREPARED_USER_PRIVATE_SVG',path.relative(repo,out),Buffer.byteLength(vector))
}

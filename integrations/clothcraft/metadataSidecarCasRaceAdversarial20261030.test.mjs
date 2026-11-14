import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {atomicMetadataSidecar20261030 as write} from './atomicMetadataSidecar20261030.mjs'

test('CAS recheck-to-rename race permits overwriting competing writer (characterization)',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-sidecar-cas-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const file=path.join(dir,'metadata.json')
 fs.writeFileSync(file,'{"version":"old"}')
 const expected=createHash('sha256').update(fs.readFileSync(file)).digest('hex')
 const originalRename=fs.renameSync
 let injected=false
 try {
  fs.renameSync=function(from,to){
   if(to===file&&!injected){injected=true;fs.writeFileSync(file,'{"version":"competing"}')}
   return originalRename.call(fs,from,to)
  }
  const receipt=write(file,{version:'writer'}, {expectedSha256:expected})
  assert.ok(injected)
  assert.ok(receipt.sha256)
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{version:'writer'})
 }finally{fs.renameSync=originalRename}
})

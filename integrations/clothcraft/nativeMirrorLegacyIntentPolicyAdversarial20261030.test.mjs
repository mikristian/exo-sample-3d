import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'

test('legacy intent lacking an authored history policy cannot silently promote newer Rust state',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-legacy-intent-policy-'))
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
 const mirror=path.join(dir,'garment.json')
 const old={template:{name:'old',panels:[]}}
 const next={template:{name:'new',panels:[]}}
 const before=JSON.stringify(old)
 fs.writeFileSync(mirror,before)
 fs.writeFileSync(mirror+'.native',JSON.stringify(next))
 fs.writeFileSync(mirror+'.native-mirror-intent-v1.json',JSON.stringify({version:1,
   previousNativeSha256:createHash('sha256').update(before).digest('hex')}))
 assert.throws(()=>recoverNativeMirror20261030(mirror),/LEGACY_INTENT_REQUIRES_REVIEW/)
 assert.deepEqual(JSON.parse(fs.readFileSync(mirror,'utf8')),old)
 assert.equal(fs.existsSync(mirror+'.native.undo-v1.json'),false)
 assert.equal(fs.existsSync(mirror+'.native-mirror-intent-v1.json'),true)
})

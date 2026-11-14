import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'

test('crashed recovery claimant plus surviving legacy intent requires manual review',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'exo-claim-intent-'))
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
 const mirror=path.join(directory,'project.json')
 const original={template:{panels:[],name:'old'}}
 fs.writeFileSync(mirror,JSON.stringify(original))
 fs.writeFileSync(mirror+'.native',JSON.stringify(original))
 fs.writeFileSync(mirror+'.native-mirror-intent-v1.json',JSON.stringify({version:1,previousNativeSha256:null}))
 fs.writeFileSync(mirror+'.native-mirror-recovering-v1.json',JSON.stringify({pid:2147483647,instanceId:'crashed',transactionId:'recovering'}))
 assert.throws(()=>recoverNativeMirror20261030(mirror),/NATIVE_MIRROR_RECOVERY_ALREADY_ACTIVE/)
 assert.deepEqual(JSON.parse(fs.readFileSync(mirror,'utf8')),original)
 assert.equal(fs.existsSync(mirror+'.native-mirror-intent-v1.json'),true)
})

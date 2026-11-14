import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'

test('dead orphan recovery claim is safely cleaned only with no owner and no intent',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'exo-orphan-recovery-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  const mirror=path.join(directory,'project.json')
  fs.writeFileSync(`${mirror}.native-mirror-recovering-v1.json`,JSON.stringify({pid:2147483647,instanceId:'dead',transactionId:'old'}))
  assert.deepEqual(recoverNativeMirror20261030(mirror),{recovered:false})
  assert.equal(fs.existsSync(`${mirror}.native-mirror-recovering-v1.json`),false)
})

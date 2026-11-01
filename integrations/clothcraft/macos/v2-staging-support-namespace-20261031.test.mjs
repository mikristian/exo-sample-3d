import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const swift=fs.readFileSync(path.join(root,'integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift'),'utf8')
const builder=fs.readFileSync(path.join(root,'integrations/clothcraft/macos/build-workspace-v2-app.sh'),'utf8')
const target=path.join(root,'integrations/clothcraft/output/release-candidates',
  'EXO-Invalid-Support-Namespace-Probe-20261031.app')

test('signed staged plist isolates the next candidate without changing production support',()=>{
  assert.match(swift,/guard staging else \{ return "EXO-ClothCraft-Studio-V2" \}/)
  assert.match(swift,/Bundle\.main\.object\(forInfoDictionaryKey: "EXOStagingSupportName"\)/)
  assert.match(swift,/EXO-ClothCraft-Studio-V2-Staging-\[A-Za-z0-9-\]/)
  assert.match(builder,/PlistBuddy -c "Add :EXOStagingSupportName string/)
  assert.match(builder,/EXO_STAGING_SUPPORT_NAME_INVALID/)
  assert.match(builder,/EXO_STAGING_SOURCE_FENCE_REQUIRED/)
  assert.match(swift,/staging \? 5485 : 5385/)
  assert.match(swift,/staging \? 5486 : 5386/)
})

for(const value of ['EXO-ClothCraft-Studio-V2','../EXO-ClothCraft-Studio-V2-Staging',
  'EXO-ClothCraft-Studio-V2-Staging-../../Production',
  'EXO-ClothCraft-Studio-V2-Staging-'+('a'.repeat(49))]){
  test('candidate builder rejects unsafe signed support namespace before any source/build writes',()=>{
    assert.equal(fs.existsSync(target),false)
    const command=spawnSync('/bin/bash',['integrations/clothcraft/macos/build-workspace-v2-app.sh'],{
      cwd:root,encoding:'utf8',timeout:6000,
      env:{...process.env,EXO_BUILD_STAGING:'1',EXO_DESKTOP_DEST:target,
        EXO_STAGING_SUPPORT_NAME:value,EXO_CANDIDATE_SOURCE_FENCE:''},
    })
    assert.equal(command.status,23,command.stderr)
    assert.match(command.stderr,/EXO_STAGING_SUPPORT_NAME_INVALID/)
    assert.equal(fs.existsSync(target),false)
  })
}

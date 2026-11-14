import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const buildScript='integrations/clothcraft/macos/build-workspace-v2-app.sh'
const swiftSource=fs.readFileSync(path.join(root,'integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift'),'utf8')
const packaging=fs.readFileSync(path.join(root,buildScript),'utf8')
const appBuilder=fs.readFileSync(path.join(root,'integrations/clothcraft/macos/build.sh'),'utf8')

test('compile-time staged app isolates its ports, application support and WebKit storage',()=>{
  assert.match(swiftSource,/#if EXO_V2_STAGED[\s\S]*?private let staging = true/)
  assert.match(swiftSource,/staging \? 5485 : 5385/)
  assert.match(swiftSource,/staging \? 5486 : 5386/)
  assert.match(swiftSource,/EXO-ClothCraft-Studio-V2-Staging/)
  assert.match(swiftSource,/staging \? \.nonPersistent\(\) : \.default\(\)/)
  assert.match(appBuilder,/SWIFT_STAGING_FLAGS=\(\)/)
  assert.match(appBuilder,/-D EXO_V2_STAGED/)
})

test('candidate builder rejects existing live-app destination before any service shutdown',()=>{
  const result=spawnSync('/bin/bash',[buildScript],{
    cwd:root,encoding:'utf8',timeout:5000,
    env:{...process.env,EXO_BUILD_STAGING:'1',
      EXO_DESKTOP_DEST:path.join(os.homedir(),'Applications/EXO ClothCraft Studio V2.app')},
  })
  assert.equal(result.status,12,JSON.stringify(result))
  assert.match(result.stderr,/EXO_STAGING_DESTINATION_REFUSED/)
})

test('candidate builder requires source fence before creating an app',()=>{
  const name='EXO-Source-Fence-Required-20261030.app'
  const target=path.join(root,'integrations/clothcraft/output/release-candidates',name)
  assert.equal(fs.existsSync(target),false)
  const result=spawnSync('/bin/bash',[buildScript],{
    cwd:root,encoding:'utf8',timeout:5000,
    env:{...process.env,EXO_BUILD_STAGING:'1',EXO_DESKTOP_DEST:target,
      EXO_CANDIDATE_SOURCE_FENCE:''},
  })
  assert.equal(result.status,14,JSON.stringify(result))
  assert.match(result.stderr,/EXO_STAGING_SOURCE_FENCE_REQUIRED/)
  assert.equal(fs.existsSync(target),false)
})

test('candidate packaging compiles a distinct app identity and bridge address',()=>{
  assert.match(packaging,/EXO_BUILD_BRIDGE_URL=http:\/\/127\.0\.0\.1:5485/)
  assert.match(packaging,/com\.mikristian\.exo\.clothcraft\.workspace\.v2\.candidate/)
  assert.match(packaging,/EXO_SWIFT_STAGING=1/)
  assert.match(packaging,/EXO_STAGING_BUILD_REFUSED/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRuntimeProvenance,runtimePaths} from '../runtime-provenance.mjs'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL} from '../workspaceBridgeProtocol20261030.mjs'
import {preflightReleaseAbi} from './v2-release-abi-gate-20261030.mjs'

test('disposable packaged web/Node/Rust manifest must equal mocked bridge runtime identity and ABI',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-abi-disposable-'))
 try{
  const resources=path.join(root,'Candidate.app','Contents','Resources')
  for(const relative of [...runtimePaths,'web/assets/app-a1b2c3d4.js','web/wasm/kernel.wasm']){
   const full=path.join(resources,relative)
   fs.mkdirSync(path.dirname(full),{recursive:true})
   fs.writeFileSync(full,relative==='web/index.html'
    ?'<script type="module" src="/assets/app-a1b2c3d4.js"></script>':`source:${relative}`)
  }
  const manifest=createRuntimeProvenance(resources,{builtAt:'2026-10-30T00:00:00.000Z'})
  fs.writeFileSync(path.join(resources,'runtime-provenance.json'),JSON.stringify(manifest))
  const healthy=()=>({ok:true,backend:'clothcraft-exo-local',workspaceBridgeProtocol:EXO_WORKSPACE_BRIDGE_PROTOCOL,
   runtimeProvenance:{verified:true,identity:manifest.identity},workspaceAuthIdentity:'b'.repeat(64),
   nativeReady:true,nativeSession:{loaded:true,nativeProcessRunning:true}})
  let contacts=0
  const probe=async health=>preflightReleaseAbi({app:path.join(root,'Candidate.app'),
   expectedIdentity:manifest.identity,bridgeHealthUrl:'http://127.0.0.1:5485/health',
   expectedWorkspaceAuthIdentity:'b'.repeat(64),
   fetchHealth:async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:5485/health')
    assert.equal(options.redirect,'error','Release health probes must never follow a local HTTP redirect')
    assert.ok(options.signal,'Release probe must be bounded')
    contacts++
    return {ok:true,json:async()=>health}
   }})
  assert.equal((await probe(healthy())).identity,manifest.identity)
  for(const mutate of [h=>h.runtimeProvenance.identity='c'.repeat(64),
   h=>h.workspaceBridgeProtocol='exo.workspace.bridge.v1',
   h=>h.nativeSession.nativeProcessRunning=false,
   h=>h.nativeReady=false]){
   const health=healthy();mutate(health)
   await assert.rejects(probe(health))
  }
  await assert.rejects(probe({...healthy(),workspaceAuthIdentity:'c'.repeat(64)}),/BRIDGE_AUTH_PROTOCOL_MISMATCH/)
  const prior=contacts
  fs.appendFileSync(path.join(resources,'web/assets/app-a1b2c3d4.js'),'modified')
  await assert.rejects(probe(healthy()),/BUNDLED_RESOURCE_FINGERPRINT_MISMATCH/)
  assert.equal(contacts,prior,'tampered bundle refused before bridge health lookup')
  assert.equal(fs.readFileSync(path.join(resources,'web/assets/app-a1b2c3d4.js'),'utf8'),
   'source:web/assets/app-a1b2c3d4.jsmodified','preflight made no filesystem mutations')
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})

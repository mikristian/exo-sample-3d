import test from 'node:test'
import assert from 'node:assert/strict'
import {checkReleaseAbi,ABI} from './v2-release-abi-gate-20261030.mjs'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL} from '../workspaceBridgeProtocol20261030.mjs'

test('live ABI health matcher requires exact pinned per-session auth identity',()=>{
 const id='a'.repeat(64)
 const input={resources:'/read-only-fixture',manifest:{schema:ABI,identity:id},verification:{verified:true,identity:id},expectedIdentity:id,
  expectedWorkspaceAuthIdentity:'f'.repeat(64),
  health:{ok:true,backend:'clothcraft-exo-local',workspaceBridgeProtocol:EXO_WORKSPACE_BRIDGE_PROTOCOL,
   runtimeProvenance:{verified:true,identity:id},workspaceAuthIdentity:'f'.repeat(64),nativeReady:true,
   nativeSession:{loaded:true,nativeProcessRunning:true}}}
 assert.equal(checkReleaseAbi(input).ok,true)
 input.health.workspaceAuthIdentity='0'.repeat(64)
 assert.equal(checkReleaseAbi(input).ok,false)
 input.health.workspaceAuthIdentity='f'.repeat(64)
 delete input.expectedWorkspaceAuthIdentity
 assert.equal(checkReleaseAbi(input).ok,false)
})

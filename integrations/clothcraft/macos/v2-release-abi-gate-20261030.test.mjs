import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {checkReleaseAbi,ABI,preflightReleaseAbi,preflightBundledReleaseAbi} from './v2-release-abi-gate-20261030.mjs'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL} from '../workspaceBridgeProtocol20261030.mjs'

const hash='a'.repeat(64)
const valid=()=>({resources:'/fixture',manifest:{schema:ABI,identity:hash},expectedIdentity:hash,
  expectedWorkspaceAuthIdentity:'b'.repeat(64),
  verification:{verified:true,identity:hash},health:{ok:true,backend:'clothcraft-exo-local',
    workspaceBridgeProtocol:EXO_WORKSPACE_BRIDGE_PROTOCOL,
    runtimeProvenance:{verified:true,identity:hash},workspaceAuthIdentity:'b'.repeat(64),
    nativeReady:true,nativeSession:{loaded:true,nativeProcessRunning:true,running:false}}})

test('a pinned verified bundle and matching live Node bridge pass ABI gate',()=>{
  assert.deepEqual(checkReleaseAbi(valid()),{ok:true,abi:ABI,identity:hash})
})
test('mixed web/Rust/bridge generations and unknown ABI fail closed',()=>{
  for(const change of [
    x=>x.manifest.identity='c'.repeat(64),x=>x.verification.identity='c'.repeat(64),
    x=>x.health.runtimeProvenance.identity='c'.repeat(64),
    x=>x.manifest.schema='exo.desktop.runtime-provenance.v2',
    x=>x.health.backend='different-service',x=>delete x.health.workspaceAuthIdentity,
    x=>delete x.health.workspaceBridgeProtocol,x=>x.health.workspaceBridgeProtocol='exo.workspace.bridge.v1',
    x=>x.health.nativeReady=false,x=>x.health.nativeSession=null,
    x=>delete x.expectedIdentity,x=>x.health.runtimeProvenance.verified=false,
    x=>x.health.nativeSession.loaded=false,
    x=>x.health.nativeSession.nativeProcessRunning=false,
    x=>delete x.expectedWorkspaceAuthIdentity,
    x=>x.health.workspaceAuthIdentity='f'.repeat(64),
  ]){const input=valid();change(input);assert.equal(checkReleaseAbi(input).ok,false)}
})
test('untrusted remote URLs and unauthorized ports never contact a bridge',async()=>{
  for(const url of ['http://example.com/health','http://127.0.0.1:5386/health',
    'http://localhost:5485/health','http://127.0.0.1:5485/workspace']){
    let calls=0
    await assert.rejects(preflightReleaseAbi({app:'/invalid',expectedIdentity:hash,
      bridgeHealthUrl:url,fetchHealth:()=>{calls++;throw Error('MUST_NOT_FETCH')}}))
    assert.equal(calls,0)
  }
})
test('offline bundle preflight refuses an unreviewed token before reading any app',()=>{
  assert.throws(()=>preflightBundledReleaseAbi({app:'/missing',expectedIdentity:'manual-token'}),/RELEASE_LOCK_REQUIRED/)
})
test('strict build gate is staging-only and preflight reports no install authorization',()=>{
  const fs=requireSource()
  assert.match(fs,/STRICT_RELEASE_REQUIRES_STAGING/)
  assert.match(fs,/v2-release-abi-gate-20261030\.mjs/)
  assert.match(fs,/--offline/)
})
function requireSource(){return readFileSync(new URL('./build-workspace-v2-app.sh',import.meta.url),'utf8')}

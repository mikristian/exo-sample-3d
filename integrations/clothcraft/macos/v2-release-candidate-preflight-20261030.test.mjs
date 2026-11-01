import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {assessCandidatePreflight} from './v2-release-candidate-preflight-20261030.mjs'

const GIB=1024**3
const stagingRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../output/release-candidates')
const stagingCandidate=path.join(stagingRoot,'EXO V2 Candidate.app')
const baseline={
  freeBytes:8*GIB,dirtyPaths:0,sourceCommit:'a'.repeat(40),
  installedPath:'/Users/test/Applications/EXO ClothCraft Studio V2.app',
  candidatePath:'/Users/test/Candidates/EXO V2 Candidate.app',
  activePorts:[],toolchainReady:true,sourceGateOk:true,closureReady:true,
}

test('isolated clean headroom and no port conflict qualify for staging only',()=>{
  const result=assessCandidatePreflight(baseline)
  assert.equal(result.ready,true)
  assert.deepEqual(result.issues,[])
  assert.ok(result.warnings.some(x=>x.code==='STAGING_ONLY'))
})

test('low disk and changing source refuse any release candidate',()=>{
  const result=assessCandidatePreflight({...baseline,freeBytes:1.15*GIB,dirtyPaths:3033})
  assert.equal(result.ready,false)
  assert.ok(result.issues.some(x=>x.code==='INSUFFICIENT_BUILD_HEADROOM'))
  assert.ok(result.issues.some(x=>x.code==='UNFROZEN_SOURCE'))
})

test('in-place destination is blocked even if other gates pass',()=>{
  const result=assessCandidatePreflight({...baseline,candidatePath:baseline.installedPath})
  assert.equal(result.ready,false)
  assert.ok(result.issues.some(x=>x.code==='TARGET_IS_LIVE_APP'))
})

test('same installed app cannot be used as an apparent isolated target',()=>{
  const result=assessCandidatePreflight({...baseline,
    candidatePath:'/Users/test/Applications/../Applications/EXO ClothCraft Studio V2.app'})
  assert.equal(result.ready,false)
  assert.ok(result.issues.some(x=>x.code==='TARGET_IS_LIVE_APP'))
})

test('live fixed ports block launching a separate unsigned candidate',()=>{
  const result=assessCandidatePreflight({...baseline,activePorts:[5385,5386]})
  assert.equal(result.ready,false)
  assert.ok(result.warnings.some(x=>x.code==='FIXED_PORT_CONFLICT'))
})

test('staging uses separate ports and an exact code fence authorizes dirty source',()=>{
  const result=assessCandidatePreflight({...baseline,dirtyPaths:3000,
    candidatePath:stagingCandidate,sourceFenceOk:true,stagingMode:true,activePorts:[5385,5386]})
  assert.equal(result.ready,true)
  assert.deepEqual(result.requiredPorts,[5485,5486])
  const occupied=assessCandidatePreflight({...baseline,
    candidatePath:stagingCandidate,stagingMode:true,sourceFenceOk:true,dirtyPaths:3000,activePorts:[5486]})
  assert.equal(occupied.ready,false)
  assert.ok(occupied.warnings.some(row=>row.code==='FIXED_PORT_CONFLICT'))
})

test('candidate staging requires 4 GiB even though standard build requires 2 GiB',()=>{
  const freeBytes=Math.floor(3.4*GIB)
  const staged=assessCandidatePreflight({...baseline,candidatePath:stagingCandidate,stagingMode:true,freeBytes})
  assert.equal(staged.ready,false)
  assert.equal(staged.minimumBuildFreeGiB,4)
  assert.ok(staged.issues.some(row=>row.code==='INSUFFICIENT_BUILD_HEADROOM'))
  const ordinary=assessCandidatePreflight({...baseline,freeBytes})
  assert.equal(ordinary.ready,true)
})

test('candidate source destination under a different parent is refused',()=>{
  const result=assessCandidatePreflight({...baseline,stagingMode:true,
    candidatePath:'/Users/test/Applications/injected-candidate.app'})
  assert.equal(result.ready,false)
  assert.ok(result.issues.some(x=>x.code==='UNSAFE_STAGING_DESTINATION'))
})

test('missing toolchain or unverified native source refuses promotion',()=>{
  const result=assessCandidatePreflight({...baseline,toolchainReady:false,sourceGateOk:false,closureReady:false})
  assert.equal(result.ready,false)
  assert.deepEqual(result.issues.map(x=>x.code),
    ['MISSING_TOOLCHAIN','NATIVE_SOURCE_PARITY_GATE','SERVICE_IMPORT_CLOSURE'])
})

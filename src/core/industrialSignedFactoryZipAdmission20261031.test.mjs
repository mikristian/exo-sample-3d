import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// All data and signatures are disposable local test fixtures, not external
// receiver attestation, a factory approval, or cutting authorization.
const project=createTeeTemplate()
const files=buildFactoryPackageFiles(project)
const archive=zipSync(files,{level:6})
const revision='disposable-concurrent-receiving-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,revision)
assert.equal(draft.status,'draft_for_external_review')
const options={
  sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')},
}
const noRelease=result=>{
  assert.equal(result.independentlyReceived,false)
  assert.equal(result.licensedReceiverCadAccepted,false)
  assert.equal(result.physicalNotchStationsCertified,false)
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.factoryCertified,false)
  assert.equal(result.bulkProductionAuthorized,false)
}

test('two active disposable garment receivers admit; third fails closed without a queue; capacity recovers',async()=>{
  const first=inspect(project,archive,options)
  const second=inspect(project,archive,options)
  const excess=await inspect(project,archive,options)
  assert.equal(excess.status,'BLOCKED')
  assert.equal(excess.issues[0].code,'ZIP_ISOLATED_CAPACITY')
  noRelease(excess)
  const admitted=await Promise.all([first,second])
  for(const result of admitted){
    assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
    assert.equal(result.rows.length,6*project.pieces.length)
    noRelease(result)
  }
  const recovered=await inspect(project,archive,options)
  assert.equal(recovered.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(recovered.issues))
  noRelease(recovered)
})

test('a burst of untrusted requests cannot queue more than two children',async()=>{
  const attempts=Array.from({length:10},()=>inspect(project,archive,options))
  const results=await Promise.all(attempts)
  assert.equal(results.filter(r=>r.status==='LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH').length,2)
  assert.equal(results.filter(r=>r.issues?.[0]?.code==='ZIP_ISOLATED_CAPACITY').length,8)
  for(const result of results)noRelease(result)
})

test('timed-out children free admission slots; forged factory approval still fails closed',async()=>{
  const first=inspect(project,archive,{...options,timeoutMs:1})
  const second=inspect(project,archive,{...options,timeoutMs:1})
  const refused=await inspect(project,archive,options)
  assert.equal(refused.issues[0].code,'ZIP_ISOLATED_CAPACITY')
  noRelease(refused)
  for(const result of await Promise.all([first,second])){
    assert.equal(result.issues[0].code,'ZIP_ISOLATED_TIMEOUT')
    noRelease(result)
  }
  const forged=zipSync({...files,
    'receiver-cad-acceptance.json':strToU8('{"licensedReceiverCadAccepted":true,"physicalCuttingAuthorized":true}')},
    {level:6})
  // A timeout settles immediately, but its slot is retained until the OS
  // confirms child exit. Wait for that bounded cleanup rather than assuming
  // SIGKILL and 'exit' are synchronous.
  let result
  for(let attempt=0;attempt<50;attempt++){
    result=await inspect(project,forged,options)
    if(result.issues?.[0]?.code!=='ZIP_ISOLATED_CAPACITY')break
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.notEqual(result.issues?.[0]?.code,'ZIP_ISOLATED_CAPACITY')
  assert.equal(result.status,'BLOCKED')
  noRelease(result)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,realpath,readdir,readFile,writeFile,unlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {withIndustrialReceivingRegistryVersionFloor20261029 as withFloor}
 from './industrialReceivingRegistryVersionFloor20261029.mjs'
import {sha256Bytes} from './sha256Bytes.js'

// Disposable two-size, two-fabric factory handoff context. The callbacks
// simulate inspection ONLY; no CAD receiver, cutter, or factory is contacted.
const garment={sizes:['S','M'],fabrics:['shell','lining'],
 cuttingAuthorized:false,factoryApproved:false}
async function fixture(run){
 const parent=await mkdtemp(join(tmpdir(),'exo-registry-history-garment-'))
 const stateRoot=join(parent,'private-receiving-state')
 try{
  await mkdir(stateRoot,{mode:0o700})
  const canonical=await realpath(stateRoot)
  const options={stateRoot,issuerAudience:'DISPOSABLE_TWO_SIZE_RECEIVER',
   ledgerNamespace:'GARMENT',trustedStateNamespaces:{GARMENT:canonical},
   registryRootSha256:'a'.repeat(64),registryVersion:7,
   issuerStatusSnapshotSha256:'b'.repeat(64)}
  return await run({stateRoot,options,garment})
 }finally{await rm(parent,{recursive:true,force:true})}
}
async function pathFor(root,suffix){
 const name=(await readdir(root)).find(x=>x.endsWith(suffix))
 assert.ok(name,'Expected private registry record '+suffix)
 return join(root,name)
}
const inspected=()=>({ok:true,cuttingAuthorized:false,factoryApproved:false})
const refuse=(result,code)=>{
 assert.equal(result.ok,false)
 assert.equal(result.code,code)
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.factoryApproved,false)
}
async function v7v8(options){
 assert.equal((await withFloor(options,inspected)).ok,true)
 const v8={...options,registryVersion:8,issuerStatusSnapshotSha256:'c'.repeat(64)}
 assert.equal((await withFloor(v8,inspected)).ok,true)
 return v8
}

test('witness retains legitimate noncontiguous registry versions and inspection-only status',async()=>{
 await fixture(async({options,garment,stateRoot})=>{
  assert.deepEqual(garment.sizes,['S','M'])
  assert.equal(garment.fabrics.length,2)
  assert.equal((await withFloor(options,inspected)).ok,true)
  const v11={...options,registryVersion:11,issuerStatusSnapshotSha256:'d'.repeat(64)}
  const result=await withFloor(v11,inspected)
  assert.equal(result.ok,true)
  assert.equal(result.cuttingAuthorized,false)
  const witness=JSON.parse(await readFile(
   await pathFor(stateRoot,'.issuer-registry-history-v11.json'),'utf8'))
  assert.deepEqual(witness.observations.map(x=>x.registryVersion),[7,11])
  assert.equal(witness.previousWitnessVersion,7)
  assert.match(witness.previousWitnessSha256,/^[a-f0-9]{64}$/)
  assert.equal((await withFloor(v11,inspected)).ok,true)
 })
})

test('first observed version 8 is a valid genesis, not an invented version 7',async()=>{
 await fixture(async({options,stateRoot})=>{
  const first={...options,registryVersion:8}
  assert.equal((await withFloor(first,inspected)).ok,true)
  const witness=JSON.parse(await readFile(
   await pathFor(stateRoot,'.issuer-registry-history-v8.json'),'utf8'))
  assert.deepEqual(witness.observations.map(x=>x.registryVersion),[8])
  assert.equal(witness.previousWitnessVersion,0)
 })
})

test('legacy v1 observations are baselined before a new v2 version is appended',async()=>{
 await fixture(async({options,stateRoot})=>{
  const scope=sha256Bytes(new TextEncoder().encode(
   options.issuerAudience+'\n'+options.ledgerNamespace))
  const legacy={format:'exo.receiving-issuer-registry-floor.v1',
   issuerAudience:options.issuerAudience,ledgerNamespace:options.ledgerNamespace,
   registryRootSha256:options.registryRootSha256,registryVersion:7,
   issuerStatusSnapshotSha256:options.issuerStatusSnapshotSha256}
  await writeFile(join(stateRoot,scope+'.issuer-registry-v7.json'),
   JSON.stringify(legacy)+'\n',{flag:'wx',mode:0o600})
  const v8={...options,registryVersion:8,issuerStatusSnapshotSha256:'c'.repeat(64)}
  refuse(await withFloor(v8,inspected),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_MIGRATION_REQUIRED')
  // This is a deliberately trusted maintenance action, never exposed by
  // the receiving-CAD challenge gate or auto-enabled for factory claims.
  assert.equal((await withFloor(
   {...options,allowLegacyHistoryBootstrap:true},inspected)).ok,true)
  assert.equal((await withFloor(v8,inspected)).ok,true)
  const witness=JSON.parse(await readFile(
   await pathFor(stateRoot,'.issuer-registry-history-v8.json'),'utf8'))
  assert.deepEqual(witness.observations.map(x=>x.registryVersion),[7,8])
  assert.equal(witness.previousWitnessVersion,7)
  await unlink(await pathFor(stateRoot,'.issuer-registry-v7.json'))
  refuse(await withFloor(v8,inspected),'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
 })
})

test('erased legacy-only witness cannot silently re-baseline during a claim',async()=>{
 await fixture(async({options,stateRoot})=>{
  const scope=sha256Bytes(new TextEncoder().encode(
   options.issuerAudience+'\n'+options.ledgerNamespace))
  const legacy={format:'exo.receiving-issuer-registry-floor.v1',
   issuerAudience:options.issuerAudience,ledgerNamespace:options.ledgerNamespace,
   registryRootSha256:options.registryRootSha256,registryVersion:7,
   issuerStatusSnapshotSha256:options.issuerStatusSnapshotSha256}
  await writeFile(join(stateRoot,scope+'.issuer-registry-v7.json'),
   JSON.stringify(legacy)+'\n',{flag:'wx',mode:0o600})
  assert.equal((await withFloor(
   {...options,allowLegacyHistoryBootstrap:true},inspected)).ok,true)
  await unlink(await pathFor(stateRoot,'.issuer-registry-history-v7.json'))
  let calls=0
  refuse(await withFloor(options,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_MIGRATION_REQUIRED')
  assert.equal(calls,0)
 })
})

test('deleting earlier v7 observation after v8 blocks subsequent inspected claim',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  await unlink(await pathFor(stateRoot,'.issuer-registry-v7.json'))
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

test('deleting older v7 witness after v8 blocks subsequent inspected claim',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  await unlink(await pathFor(stateRoot,'.issuer-registry-history-v7.json'))
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

test('deleting current v8 witness blocks claim instead of silent re-baselining',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  await unlink(await pathFor(stateRoot,'.issuer-registry-history-v8.json'))
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

test('erasing every witness cannot silently re-baseline v2 observations',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  await unlink(await pathFor(stateRoot,'.issuer-registry-history-v7.json'))
  await unlink(await pathFor(stateRoot,'.issuer-registry-history-v8.json'))
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

test('changing an older observation digest is detected even when v8 remains valid',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  const path=await pathFor(stateRoot,'.issuer-registry-v7.json')
  const row=JSON.parse(await readFile(path,'utf8'))
  row.issuerStatusSnapshotSha256='e'.repeat(64)
  await writeFile(path,JSON.stringify(row)+'\n',{mode:0o600})
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

test('deleting earlier observation during callback refuses success after inspection',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  let calls=0
  const result=await withFloor(v8,async()=>{
   calls++
   await unlink(await pathFor(stateRoot,'.issuer-registry-v7.json'))
   return inspected()
  })
  refuse(result,'RECEIVER_ISSUER_REGISTRY_STATE_CHANGED_DURING_CLAIM')
  assert.equal(calls,1)
 })
})

test('corrupting predecessor witness digest blocks current version',async()=>{
 await fixture(async({options,stateRoot})=>{
  const v8=await v7v8(options)
  const path=await pathFor(stateRoot,'.issuer-registry-history-v8.json')
  const row=JSON.parse(await readFile(path,'utf8'))
  row.previousWitnessSha256='f'.repeat(64)
  await writeFile(path,JSON.stringify(row)+'\n',{mode:0o600})
  let calls=0
  refuse(await withFloor(v8,()=>{calls++;return inspected()}),
   'RECEIVER_ISSUER_REGISTRY_HISTORY_CORRUPT')
  assert.equal(calls,0)
 })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryNotchHandoff20261030 as inspect} from './industrialSignedNotchReceivingGate20261030.mjs'

// All keys and garments are disposable local test fixtures. These signatures
// are NOT independent external approvals or physical sewn-sample evidence.
const project=createTeeTemplate()
const original=structuredClone(project)
const keys=generateKeyPairSync('ed25519'),attacker=generateKeyPairSync('ed25519')
const sourceRevision='disposable-reviewed-revision-1'
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
assert.equal(draft.status,'draft_for_external_review')
const approval={manifest:draft.manifest,sha256:draft.sha256,
  signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')}
const pin=key=>createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex')
const trustedKeyConfig={publicKey:keys.publicKey,pinnedSpkiSha256:pin(keys.publicKey)}
const options={approval,trustedKeyConfig,sourceRevision}
const files=buildFactoryPackageFiles(project)
const firstPath=`patterns/${project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-xs.dxf`
assert(files[firstPath])
const code=result=>result.issues.map(issue=>issue.code)
const blocked=(p,f,opts,expected)=>{
  const r=inspect(p,f,opts)
  assert.equal(r.status,'BLOCKED',JSON.stringify(r.issues))
  assert.equal(r.physicalCuttingAuthorized,false)
  assert.equal(r.factoryCertified,false)
  assert(code(r).some(c=>c.includes(expected)),`expected ${expected}, got ${code(r).join(', ')}`)
}
const bytes=text=>new TextEncoder().encode(text)
const altered=(path,edit)=>{
  const copy={...files},wire=new TextDecoder().decode(copy[path])
  const next=edit(wire)
  assert(next!==wire,`disposable mutation did not change ${path}`)
  copy[path]=bytes(next)
  const manifest=JSON.parse(new TextDecoder().decode(copy['manifest.json']))
  manifest.sha256[path]=createHash('sha256').update(copy[path]).digest('hex')
  copy['manifest.json']=bytes(JSON.stringify(manifest))
  return copy
}

test('all six disposable graded sizes and 24 piece-size rows match signed source and actual DXF, without CUT authorization',()=>{
  const r=inspect(project,files,options)
  assert.equal(r.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(r.issues))
  assert.equal(r.rows.length,6*4)
  assert(r.rows.every(row=>row.status==='PASS'&&row.expectedMarks===row.observedMarks))
  assert.equal(r.rows.reduce((n,row)=>n+row.expectedMarks,0),72)
  assert.equal(r.independentlyReceived,false)
  assert.equal(r.licensedReceiverCadAccepted,false)
  assert.equal(r.physicalNotchStationsCertified,false)
  assert.equal(r.physicalCuttingAuthorized,false)
  assert.equal(r.factoryCertified,false)
  assert.deepEqual(project,original)
})

test('missing/forged approval, missing or substituted pinned key, and revision mismatch fail closed',()=>{
  blocked(project,files,{...options,approval:null},'SIGNED_BASELINE_')
  blocked(project,files,{...options,trustedKeyConfig:null},'INDEPENDENT_PINNED_KEY_REQUIRED')
  blocked(project,files,{...options,sourceRevision:'unreviewed-revision'},'SOURCE_OR_GRADED_SIZE_IDENTITY_CHANGED')
  blocked(project,files,{...options,trustedKeyConfig:{publicKey:attacker.publicKey,pinnedSpkiSha256:pin(keys.publicKey)}},'TRUSTED_KEY_FINGERPRINT_MISMATCH')
  const forged={...approval,signatureBase64:sign(null,Buffer.from(draft.payload),attacker.privateKey).toString('base64')}
  blocked(project,files,{...options,approval:forged},'SIGNATURE_INVALID')
})

test('authored notch deletion, extra notch and altered graded size run invalidate signed denominator',()=>{
  const deleted=structuredClone(project)
  deleted.pieces[0].notches.splice(0,1)
  blocked(deleted,files,options,'SOURCE_OR_GRADED_SIZE_IDENTITY_CHANGED')
  const extra=structuredClone(project)
  extra.pieces[1].notches.push({id:'unreviewed-notch',edgeIndex:0,t:.35})
  blocked(extra,files,options,'SOURCE_OR_GRADED_SIZE_IDENTITY_CHANGED')
  const changed=structuredClone(project)
  changed.grading.sizes.pop()
  blocked(changed,files,options,'SOURCE_OR_GRADED_SIZE_IDENTITY_CHANGED')
})

test('rehashed tampering cannot conceal missing notch, unsupported notch entity, or station displacement',()=>{
  const wrongLayer=altered(firstPath,wire=>wire.replace('0\nLINE\n8\nNOTCH_FRONT\n','0\nLINE\n8\nNOTCH_GHOST\n'))
  blocked(project,wrongLayer,options,'SIGNED_NOTCH_MARK_COUNT_OR_DEPTH_MISMATCH')
  blocked(project,wrongLayer,options,'UNEXPECTED_NOTCH_LAYER')
  const unsupported=altered(firstPath,wire=>wire.replace('0\nLINE\n8\nNOTCH_FRONT\n','0\nPOINT\n8\nNOTCH_FRONT\n'))
  blocked(project,unsupported,options,'UNSUPPORTED_NOTCH_ENTITY_POINT')
  const relocated=altered(firstPath,wire=>wire.replace(/(0\nLINE\n8\nNOTCH_FRONT\n10\n)(-?\d+(?:\.\d+)?)(\n20\n-?\d+(?:\.\d+)?\n30\n0\n11\n)(-?\d+(?:\.\d+)?)/,
    (_,a,x,b,x2)=>`${a}${Number(x)+20}${b}${Number(x2)+20}`))
  blocked(project,relocated,options,'DXF_DIFFERS_FROM_SIGNED_SOURCE_REGENERATION')
})

test('unrehashed tampering, missing graded DXF and forged package inventory fail closed',()=>{
  const corrupt={...files,[firstPath]:bytes('0\nEOF\n')}
  blocked(project,corrupt,options,'PACKAGE_FILE_HASH_OR_SIZE_MISMATCH')
  const missing={...files}
  delete missing[firstPath]
  const m=JSON.parse(new TextDecoder().decode(missing['manifest.json']))
  m.files=m.files.filter(x=>x!==firstPath)
  delete m.sha256[firstPath]
  missing['manifest.json']=bytes(JSON.stringify(m))
  blocked(project,missing,options,'GRADED_DXF_SIZE_INVENTORY_MISMATCH')
  const fake={...files}
  const manifest=JSON.parse(new TextDecoder().decode(fake['manifest.json']))
  manifest.grading.sizes=['XS','M']
  fake['manifest.json']=bytes(JSON.stringify(manifest))
  blocked(project,fake,options,'PACKAGE_MANIFEST_INVENTORY_OR_IDENTITY_MISMATCH')
})

test('rehashed source, graded size-run, and readiness contradictions cannot accompany a green signed DXF report',()=>{
  for(const [path,edit] of [
    ['garment-source.json',wire=>wire.replace(/"name": "[^"]+"/,'"name": "Forged Tee"')],
    ['size-run.json',wire=>wire.replace('"XS"','"FORGED_SIZE"')],
    ['manufacturing-release-readiness.json',wire=>wire.replace('"factoryCuttingAuthorized": false','"factoryCuttingAuthorized": true')],
  ]){
    const tampered=altered(path,edit)
    blocked(project,tampered,options,'FACTORY_HANDOFF_SOURCE_OR_QA_CONTRADICTION')
  }
})

test('unsafe archive names, case-insensitive aliases, and oversized manifest refuse even with valid signed DXF',()=>{
  for(const name of ['../traversal.txt','README.TXT','patterns\\other.dxf']){
    const copy={...files,[name]:bytes('disposable')}
    const manifest=JSON.parse(new TextDecoder().decode(copy['manifest.json']))
    manifest.files=[...Object.keys(copy)].sort()
    manifest.sha256[name]=createHash('sha256').update(copy[name]).digest('hex')
    copy['manifest.json']=bytes(JSON.stringify(manifest))
    blocked(project,copy,options,'UNSAFE_OR_DUPLICATE_PACKAGE_PATH')
  }
  blocked(project,{...files,'manifest.json':bytes(' '.repeat(2_000_001))},options,'OVERSIZED_PACKAGE_MANIFEST')
})

test('rehashed fake sample approval and manufacturing notch/cut QA cannot accompany authenticated DXF',()=>{
  for(const path of ['factory-sample-approval-gate.json','industrial-notch-qa.json',
    'graded-sewn-interval-notch-qa.json','industrial-cutline-qa.json']){
    const forged=altered(path,wire=>{
      const obj=JSON.parse(wire)
      obj.factoryCertified=true
      obj.blockers=-1
      return JSON.stringify(obj)
    })
    blocked(project,forged,options,'FACTORY_HANDOFF_SOURCE_OR_QA_CONTRADICTION')
  }
})

test('self-hashed forged receiver approvals, extra manifest assertions and altered marker settings cannot be laundered into a signed preflight',()=>{
  const forged={...files,'receiver-cad-acceptance.json':bytes(JSON.stringify({
    licensedReceiverCadAccepted:true,physicalCuttingAuthorized:true,
    factoryCertified:true,receivingSoftware:'unverified-vendor',
  }))}
  const manifest=JSON.parse(new TextDecoder().decode(forged['manifest.json']))
  manifest.files=[...Object.keys(forged)].sort()
  manifest.sha256['receiver-cad-acceptance.json']=createHash('sha256').update(forged['receiver-cad-acceptance.json']).digest('hex')
  forged['manifest.json']=bytes(JSON.stringify(manifest))
  blocked(project,forged,options,'UNSUPPORTED_PACKAGE_FILE')

  const injected={...files}
  const injectedManifest=JSON.parse(new TextDecoder().decode(injected['manifest.json']))
  injectedManifest.receiverCadAcceptance={status:'ACCEPTED',licensedReceiverCadAccepted:true}
  injected['manifest.json']=bytes(JSON.stringify(injectedManifest))
  blocked(project,injected,options,'UNSUPPORTED_PACKAGE_MANIFEST_SCHEMA')

  const alteredMarker={...files}
  const alteredManifest=JSON.parse(new TextDecoder().decode(alteredMarker['manifest.json']))
  alteredManifest.marker.fabricWidthCm+=25
  alteredMarker['manifest.json']=bytes(JSON.stringify(alteredManifest))
  blocked(project,alteredMarker,options,'PACKAGE_MARKER_SETTINGS_MISMATCH')

  const fakeRecipient=altered('recipient-cad-acceptance-plan.json',wire=>{
    const obj=JSON.parse(wire)
    obj.status='LICENSED_RECEIVER_ACCEPTED'
    obj.actualCADRoundTripPerformed=true
    obj.sizes[0].destinationEvidence.actualFactoryCADImportPass=true
    return JSON.stringify(obj)
  })
  blocked(project,fakeRecipient,options,'FACTORY_HANDOFF_SOURCE_OR_QA_CONTRADICTION')

  const extraMarker={...files,'markers/forged.svg':bytes('<svg>fake receiver approved layout</svg>')}
  const extraManifest=JSON.parse(new TextDecoder().decode(extraMarker['manifest.json']))
  extraManifest.files=[...Object.keys(extraMarker)].sort()
  extraManifest.sha256['markers/forged.svg']=createHash('sha256').update(extraMarker['markers/forged.svg']).digest('hex')
  extraMarker['manifest.json']=bytes(JSON.stringify(extraManifest))
  blocked(project,extraMarker,options,'FACTORY_ARTIFACT_INVENTORY_DIFFERS_FROM_SIGNED_SOURCE')

  const markerPath=Object.keys(files).find(name=>name.startsWith('markers/')&&name.endsWith('-xl.svg'))
  assert(markerPath,'disposable package must include a non-base-size XL marker SVG')
  const changedMarker=altered(markerPath,wire=>wire.replace('<svg','<svg data-factory-accepted="true"'))
  blocked(project,changedMarker,options,'FACTORY_ARTIFACT_DIFFERS_FROM_SIGNED_SOURCE')
})

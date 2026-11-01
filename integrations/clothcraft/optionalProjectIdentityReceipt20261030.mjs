// Opt-in JS-side identity receipt. Never inject into Rust FittingProject:
// its serde decoder uses deny_unknown_fields.
import {createHash,randomUUID} from 'node:crypto'

const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const hash = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
// Binding receipt to the exact native source prevents a duplicate display
// name/IDs from silently inheriting metadata when the source differs.
export function nativeProjectSourceDigest(project) {
  if(!project || typeof project!=='object'||Array.isArray(project)||
      !project.template||!Array.isArray(project.template.panels))
    throw Error('INVALID_NATIVE_PROJECT_SOURCE')
  return sha(project.template)
}
export function createOptionalProjectIdentityReceipt(project,{projectId=randomUUID(),generation=0,sourceRevision=null}={}) {
  if(!uuid(projectId)||!Number.isSafeInteger(generation)||generation<0||
     !(sourceRevision===null||Number.isSafeInteger(sourceRevision)&&sourceRevision>=0))
    throw Error('INVALID_PROJECT_IDENTITY_INPUT')
  return {schemaVersion:1,projectId,generation,sourceRevision,sourceDigest:nativeProjectSourceDigest(project)}
}
export function verifyOptionalProjectIdentityReceipt(receipt,project,{expectedProjectId,expectedGeneration,expectedSourceRevision}={}) {
  // Legacy projects do not carry a receipt. Leave migration to an explicit
  // import/new-project action; absence cannot authorize inherited metadata.
  if(receipt===undefined||receipt===null)return {ok:false,reason:'MISSING_RECEIPT',legacy:true}
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
     Object.keys(receipt).sort().join(',')!=='generation,projectId,schemaVersion,sourceDigest,sourceRevision'||
     receipt.schemaVersion!==1||!uuid(receipt.projectId)||
     !Number.isSafeInteger(receipt.generation)||receipt.generation<0||
     !(receipt.sourceRevision===null||Number.isSafeInteger(receipt.sourceRevision)&&receipt.sourceRevision>=0)||
     !hash(receipt.sourceDigest))return {ok:false,reason:'INVALID_RECEIPT'}
  if(expectedProjectId!==undefined && receipt.projectId!==expectedProjectId)return {ok:false,reason:'PROJECT_ID_MISMATCH'}
  if(expectedGeneration!==undefined && receipt.generation!==expectedGeneration)return {ok:false,reason:'GENERATION_MISMATCH'}
  if(expectedSourceRevision!==undefined && receipt.sourceRevision!==expectedSourceRevision)return {ok:false,reason:'SOURCE_REVISION_MISMATCH'}
  try {
    if(receipt.sourceDigest!==nativeProjectSourceDigest(project))return {ok:false,reason:'SOURCE_DIGEST_MISMATCH'}
  }catch{return {ok:false,reason:'INVALID_NATIVE_PROJECT_SOURCE'}}
  return {ok:true,projectId:receipt.projectId,generation:receipt.generation}
}
// Reissue only after the caller has established that the same project owns a
// native mutation. An identical source can legitimately produce a new receipt
// generation; this does not establish a Rust-native identity.
export function advanceOptionalProjectIdentityReceipt(receipt,previousProject,nextProject,{sourceRevision=null}={}) {
  const existing=verifyOptionalProjectIdentityReceipt(receipt,previousProject)
  if(!existing.ok)throw Error('PROJECT_IDENTITY_PREVIOUS_SOURCE_MISMATCH')
  return createOptionalProjectIdentityReceipt(nextProject,{
    projectId:existing.projectId,generation:existing.generation+1,sourceRevision,
  })
}

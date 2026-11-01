// Separately signed source-to-native-artifact binding for local manufacturing
// review. A valid signature does NOT prove a licensed CAD import, actual native
// CAD/.RUL semantics, physical sewn samples or authorization to cut.
import {canonicalNativeGradeReviewJson20261027,
 sha256NativeGradeReview20261027,
 verifyNativeGradeIndependentReviewEvidence20261027}
 from './nativeGradeIndependentReviewEvidence20261027.js'

const FORMAT='exo.native-grade-source-artifact-manifest.v1'
const FIELDS=['format','sourceKeyId','sourceRevision','sourceTemplateSha256',
 'fullRuleSetSha256','pomSha256','nativeFilename','nativeSha256',
 'rulesFilename','rulesSha256','issuedAt','expiresAt']
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(value))
const exact=(value,keys)=>plain(value)&&Reflect.ownKeys(value).length===keys.length&&
 keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key)
  return d?.enumerable===true&&Object.hasOwn(d,'value')})
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,72}$/.test(value)
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&
 Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString()===value
const deny=(code,detail=code)=>({ok:false,code,detail,
 sourceManifestSignatureVerified:false,artifactBytesCrosschecked:false,
 independentlySignedEvidenceVerified:false,releaseReadyForIndependentAudit:false,
 nativeCadParsed:false,gradingRulesParsed:false,independentReceiverAuthenticated:false,
 receiverCadVerified:false,physicalTruthVerified:false,cuttingAuthorized:false,
 factoryApproved:false,manufacturingApproved:false})

/** Bind the exact signed source revision/template/rules/POM to native and RUL
 * file bytes, using a source-signing public key provisioned OUTSIDE the packet.
 * This is a local provenance-integrity check, never independent factory approval.
 */
export async function verifyIndustrialNativeSourceProvenance20261031({
 sourceRevision,sourceTemplate,fullRuleSet,pomDefinitions,evidence,trustedPublicKeys,
 artifactInventory,sourceManifest,sourceManifestSignatureBase64,
 trustedSourceKeys,expectedSourceKeyId,now=Date.now(),
}={}){
 try{
  if(!Number.isSafeInteger(sourceRevision)||sourceRevision<0||
   !plain(sourceTemplate)||!plain(fullRuleSet)||!Array.isArray(pomDefinitions)||
   !exact(sourceManifest,FIELDS)||sourceManifest.format!==FORMAT||
   !token(expectedSourceKeyId)||sourceManifest.sourceKeyId!==expectedSourceKeyId||
   sourceManifest.sourceRevision!==sourceRevision||
   !hex(sourceManifest.sourceTemplateSha256)||!hex(sourceManifest.fullRuleSetSha256)||
   !hex(sourceManifest.pomSha256)||!hex(sourceManifest.nativeSha256)||
   !hex(sourceManifest.rulesSha256)||!plain(artifactInventory)||
   !Number.isFinite(now)||!iso(sourceManifest.issuedAt)||!iso(sourceManifest.expiresAt))
   return deny('SOURCE_MANIFEST_INVALID')
  const issued=Date.parse(sourceManifest.issuedAt),expires=Date.parse(sourceManifest.expiresAt)
  if(issued>now||expires<=now||expires<=issued||expires-issued>30*86400000)
   return deny('SOURCE_MANIFEST_WINDOW_INVALID')
  const pins=await Promise.all([sha256NativeGradeReview20261027(sourceTemplate),
   sha256NativeGradeReview20261027(fullRuleSet),
   sha256NativeGradeReview20261027(pomDefinitions)])
  if(sourceManifest.sourceTemplateSha256!==pins[0]||
   sourceManifest.fullRuleSetSha256!==pins[1]||
   sourceManifest.pomSha256!==pins[2]||
   sourceManifest.nativeFilename!==artifactInventory.native?.filename||
   sourceManifest.rulesFilename!==artifactInventory.rules?.filename)
   return deny('SOURCE_MANIFEST_SOURCE_DRIFT')
  if(!plain(trustedSourceKeys))return deny('SOURCE_SIGNER_UNTRUSTED')
  const anchor=Object.getOwnPropertyDescriptor(trustedSourceKeys,expectedSourceKeyId)
  if(!anchor||!Object.hasOwn(anchor,'value')||
   !exact(anchor.value,['purpose','publicKey'])||
   anchor.value.purpose!=='native-grade-source'||
   anchor.value.publicKey?.type!=='public'||
   anchor.value.publicKey.algorithm?.name!=='Ed25519'||
   !anchor.value.publicKey.usages?.includes('verify'))
   return deny('SOURCE_SIGNER_UNTRUSTED')
  if(typeof sourceManifestSignatureBase64!=='string'||
   !/^[A-Za-z0-9+/]{86}==$/.test(sourceManifestSignatureBase64))
   return deny('SOURCE_MANIFEST_SIGNATURE_INVALID')
  const raw=atob(sourceManifestSignatureBase64)
  if(raw.length!==64||btoa(raw)!==sourceManifestSignatureBase64)
   return deny('SOURCE_MANIFEST_SIGNATURE_INVALID')
  const signature=Uint8Array.from(raw,c=>c.charCodeAt(0))
  const valid=await globalThis.crypto?.subtle?.verify('Ed25519',anchor.value.publicKey,
   signature,new TextEncoder().encode(canonicalNativeGradeReviewJson20261027(sourceManifest)))
  if(valid!==true)return deny('SOURCE_MANIFEST_SIGNATURE_INVALID')
  const review=await verifyNativeGradeIndependentReviewEvidence20261027({
   sourceRevision,sourceTemplate,fullRuleSet,pomDefinitions,evidence,trustedPublicKeys,
   artifactInventory,expectedSourceArtifactHashes:{
    nativeSha256:sourceManifest.nativeSha256,rulesSha256:sourceManifest.rulesSha256},
   now,
  })
  if(!review.ok)return deny(review.code,review.detail)
  if(review.artifactBytesCrosschecked!==true)return deny('SOURCE_ARTIFACT_BYTES_UNVERIFIED')
  return {...review,code:'SIGNED_SOURCE_AND_REVIEW_ARTIFACTS_CROSSCHECKED',
   sourceManifestSignatureVerified:true,sourceKeyId:expectedSourceKeyId,
   releaseReadyForIndependentAudit:false,independentReceiverAuthenticated:false,
   receiverCadVerified:false,physicalTruthVerified:false,cuttingAuthorized:false,
   factoryApproved:false,manufacturingApproved:false,
   note:'Separate source-signing key binds source revision/template/rules/POM hashes to actual supplied native and RUL bytes. Key-owner provenance, native CAD and grading-rule semantics, licensed receiving CAD, physical samples, cutting authorization and factory release remain unverified.'}
 }catch(error){return deny('SOURCE_PROVENANCE_INSPECTION_REFUSED',String(error?.message||error))}
}

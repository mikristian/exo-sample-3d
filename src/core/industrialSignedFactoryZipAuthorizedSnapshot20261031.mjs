/** Opt-in Node receiving boundary for one authorized, revision-coherent read.
 *
 * The principal comes from a trusted server-side request context, NEVER the
 * browser/ZIP. The backend must atomically authorize and read the source and
 * its approval in one transaction or equivalent version-pinned snapshot.
 * This preflight does not authorize cutting, factory release, or licensed CAD.
 */
import {createPublicKey,KeyObject} from 'node:crypto'
import {createTrustedFactoryZipReceivingBoundary20261031} from './industrialSignedFactoryZipTrustedBoundary20261031.mjs'
import {snapshotSignedFactoryReceivingJsonBounded20261031} from './industrialSignedFactoryZipIsolated20261030.mjs'

const own=(value,key)=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))throw Error('record object required')
  const descriptor=Object.getOwnPropertyDescriptor(value,key)
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error(`missing ${key}`)
  return descriptor.value
}
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)

/**
 * resolvePrincipal(): obtains the authenticated server principal from trusted
 * request-local context, with NO browser request argument.
 * resolveAuthorizedSnapshot({sourceId,principal}): checks tenant/subject access
 * and reads source+approval at one consistent revision. It MUST NOT perform
 * separate, independently versioned source and approval reads.
 */
export function createAuthorizedFactoryZipReceivingBoundary20261031(configuration){
  const resolvePrincipal=own(configuration,'resolvePrincipal')
  const resolveAuthorizedSnapshot=own(configuration,'resolveAuthorizedSnapshot')
  const trustedKeyConfig=own(configuration,'trustedKeyConfig')
  if(typeof resolvePrincipal!=='function'||typeof resolveAuthorizedSnapshot!=='function')
    throw Error('trusted principal and atomic authorized snapshot resolvers required')

  // Validate the signer/pin at construction, not after receiving an archive.
  createTrustedFactoryZipReceivingBoundary20261031({trustedKeyConfig,
    resolveSource:async()=>{throw Error('not callable')},
    resolveApproval:async()=>{throw Error('not callable')}})
  const supplied=own(trustedKeyConfig,'publicKey')
  const pinnedSpkiSha256=own(trustedKeyConfig,'pinnedSpkiSha256')
  const key=supplied instanceof KeyObject?supplied:createPublicKey(supplied)
  const stableTrust=Object.freeze({publicKey:key.export({format:'pem',type:'spki'}).toString(),
    pinnedSpkiSha256})

  return async function inspectAuthorizedFactoryZip(request){
    // Per-request closures prevent cross-request source/approval mixups under
    // concurrent inspections; the inner boundary snapshots ZIP bytes before
    // awaiting authentication or the authorized database transaction.
    let authorizedRecord
    const inspect=createTrustedFactoryZipReceivingBoundary20261031({trustedKeyConfig:stableTrust,
      resolveSource:async (sourceId,context)=>{
        const identity=await resolvePrincipal(context)
        context.signal.throwIfAborted()
        const subjectId=own(identity,'subjectId')
        const tenantId=own(identity,'tenantId')
        if(!id(subjectId)||!id(tenantId))throw Error('unauthenticated principal')
        const principal=Object.freeze({subjectId,tenantId})
        const record=await resolveAuthorizedSnapshot(Object.freeze({sourceId,principal}),context)
        context.signal.throwIfAborted()
        if(own(record,'authorized')!==true||own(record,'sourceId')!==sourceId||
          own(record,'tenantId')!==tenantId||own(record,'subjectId')!==subjectId)
          throw Error('source access not authorized')
        const sourceRevision=own(record,'sourceRevision')
        if(typeof sourceRevision!=='string'||!sourceRevision||sourceRevision.length>256||
          own(record,'approvalSourceRevision')!==sourceRevision||
          own(record,'approvalSourceId')!==sourceId||
          own(record,'approvalTenantId')!==tenantId)
          throw Error('inconsistent authorized source/approval snapshot')
        const project=own(record,'project')
        const approval=own(record,'approval')
        // Bound both record copies *before* the isolated verifier's async
        // admission path. structuredClone can invoke getters and allocate
        // oversized nested records before the receiver's own JSON budget.
        authorizedRecord=snapshotSignedFactoryReceivingJsonBounded20261031(project,approval)
        return {project:authorizedRecord.project,sourceRevision}
      },
      resolveApproval:async()=>{
        if(!authorizedRecord)throw Error('missing authorized snapshot')
        return authorizedRecord.approval
      }})
    return inspect(request)
  }
}

import {createHash,randomUUID} from 'node:crypto'

const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

// Preserve v1 identities solely for safe migration of existing sidecars.
export const legacyPropertyMetadataFingerprint=template=>sha({
 template:template?.name||'',panels:(template?.panels||[]).map(p=>p.id).sort(),
 fabrics:(template?.fabrics||[]).map(f=>f.id).sort(),
})

// This is the authored source of a project, excluding properties which ordinary
// construction, draping, fabrication and layout edits are expected to change.
// Names and stable panel/fabric memberships distinguish independent imports
// with equal IDs, while an explicit persisted binding survives later edits.
export const propertyMetadataFingerprint=template=>sha({
 version:2,format:template?.format||'',name:template?.name||'',
 panels:(template?.panels||[]).map(p=>({id:p.id,name:p.name||'',fabric:p.fabric||''}))
  .sort((a,b)=>a.id.localeCompare(b.id)),
 fabrics:(template?.fabrics||[]).map(f=>({id:f.id,name:f.name||''}))
  .sort((a,b)=>a.id.localeCompare(b.id)),
})

export function bindPropertyMetadata(previous,template,{fresh=false,reopen=false}={}){
 const identity=propertyMetadataFingerprint(template)
 if(!fresh&&previous?.version===2&&previous.identity===identity)
  return previous
 // A legacy sidecar is NOT native source-bound. A prior document with the
 // same panel IDs may have a different source/label; reopen alone cannot
 // authorize adopting its metadata into the newly persisted Rust project.
 if(!fresh&&reopen&&previous?.version===1&&
    previous.identity===legacyPropertyMetadataFingerprint(template))
  return {...previous,version:2,identity,
   metadataProjectId:previous.metadataProjectId||randomUUID()}
 // This is an auxiliary metadata ownership UUID, not a Rust-native project
 // UUID or a replacement for its immutable source/generation identity.
 // Every explicitly imported garment gets a new metadata namespace even when
 // its human-readable template matches an earlier garment byte-for-byte.
 return {version:2,identity,metadataProjectId:randomUUID(),panels:{},fabrics:{}}
}

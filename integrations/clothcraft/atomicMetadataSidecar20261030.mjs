// One durable, symlink-safe write for the auxiliary garment-property sidecar.
// This does not pretend the Rust native project and browser metadata already
// share an atomic cross-file journal. The CAS check serializes cooperative
// EXO writers through an exclusive lock; arbitrary uncooperative filesystem
// writers can still race the final rename and must not be trusted as peers.
import fs from 'node:fs'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
// Lock files survive process crashes intentionally. An operator must inspect
// the recorded owner and recover a stale lock explicitly; age/PID alone is
// insufficient to prove that another writer is no longer using the sidecar.
const lockOwner=identity=>JSON.stringify({format:'exo-sidecar-writer-v1',identity,
  pid:process.pid,startedAt:new Date().toISOString(),host:process.env.HOSTNAME||null})
const existing=file=>{
  try{
    const state=fs.lstatSync(file)
    if(!state.isFile()||state.isSymbolicLink())
      throw Error('METADATA_SIDECAR_UNTRUSTED_DESTINATION')
    return fs.readFileSync(file)
  }catch(e){if(e.code==='ENOENT')return null;throw e}
}

export function atomicMetadataSidecar20261030(file,value,{expectedSha256}={}) {
  if(!file||typeof file!=='string'||!value||typeof value!=='object'||Array.isArray(value))
    throw Error('INVALID_METADATA_SIDECAR_INPUT')
  const data=Buffer.from(JSON.stringify(value))
  if(!data.length||data.length>8*1024*1024)throw Error('METADATA_SIDECAR_TOO_LARGE')
  const directory=path.dirname(file)
  fs.mkdirSync(directory,{recursive:true})
  const ownerFile=file+'.writer-v1.lock'
  const ownerIdentity=randomUUID()
  const ownerBytes=lockOwner(ownerIdentity)
  const flags=fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|
    (fs.constants.O_NOFOLLOW??0)
  try {
    const fd=fs.openSync(ownerFile,flags,0o600)
    try{fs.writeFileSync(fd,ownerBytes);fs.fsyncSync(fd)}
    finally{fs.closeSync(fd)}
    const parent=fs.openSync(directory,'r')
    try{fs.fsyncSync(parent)}finally{fs.closeSync(parent)}
  }catch(error){
    if(error.code==='EEXIST')throw Error('METADATA_SIDECAR_BUSY')
    throw error
  }
  const temp=`${file}.tmp-${randomUUID()}`
  let created=false
  try {
    const before=existing(file)
    const beforeIdentity=before===null?null:sha(before)
    if(expectedSha256!==undefined&&expectedSha256!==beforeIdentity)
      throw Error('METADATA_SIDECAR_CONCURRENT_CHANGE')
    const fd=fs.openSync(temp,fs.constants.O_CREAT|fs.constants.O_WRONLY|
      fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW??0),0o600)
    created=true
    try{fs.writeFileSync(fd,data);fs.fsyncSync(fd)}
    finally{fs.closeSync(fd)}
    // Recheck identity after staging, immediately before atomic replacement:
    // another writer must not have silently changed the source while we fsync.
    const now=existing(file)
    if(expectedSha256!==undefined&&(now===null?null:sha(now))!==expectedSha256)
      throw Error('METADATA_SIDECAR_CONCURRENT_CHANGE')
    fs.renameSync(temp,file)
    created=false
    const parent=fs.openSync(directory,'r')
    try{fs.fsyncSync(parent)}finally{fs.closeSync(parent)}
    return Object.freeze({sha256:sha(data),previousSha256:beforeIdentity,bytes:data.length})
  } finally {
    if(created){try{fs.unlinkSync(temp)}catch{}}
    // Never unlink someone else's lock after an external replacement.
    try {
      if(fs.readFileSync(ownerFile,'utf8')===ownerBytes){
        fs.unlinkSync(ownerFile)
        const parent=fs.openSync(directory,'r')
        try{fs.fsyncSync(parent)}finally{fs.closeSync(parent)}
      }
    }catch(error){if(error.code!=='ENOENT')throw error}
  }
}

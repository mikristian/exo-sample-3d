#!/usr/bin/env node
// READ-ONLY release candidate gate. No builds, signatures, service calls or
// changes to a running app. Its output is a plan, not deployment approval.
import {execFileSync,spawnSync} from 'node:child_process'
import {statfsSync,existsSync,realpathSync,readFileSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {assessV2NativeSourcePreflight20261028} from './preflight-v2-native-source-20261028.mjs'
import {captureSourceFence,compareInputFingerprints} from './v2-source-freeze-20261030.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const GIB=1024**3
const buildMinimumBytes=2*GIB
const installedApp=path.join(os.homedir(),'Applications/EXO ClothCraft Studio V2.app')
const defaultCandidate=path.join(root,'integrations/clothcraft/output/release-candidates/EXO ClothCraft Studio V2 Candidate.app')

const normal = value=>{
  const absolute=path.resolve(value)
  // A candidate may not exist yet while its parent symlinks into Applications.
  // Resolve the nearest existing ancestor, not only an existing leaf.
  let ancestor=absolute
  const trailing=[]
  while(!existsSync(ancestor)){
    const parent=path.dirname(ancestor)
    if(parent===ancestor)break
    trailing.unshift(path.basename(ancestor))
    ancestor=parent
  }
  return path.join(realpathSync(ancestor),...trailing).replace(/\/$/,'')
}

export function assessCandidatePreflight({
  freeBytes,dirtyPaths,sourceCommit,installedPath=installedApp,candidatePath=defaultCandidate,
  activePorts=[],toolchainReady=true,sourceGateOk=true,sourceGateReason='',closureReady=true,
  sourceFenceOk=false,stagingMode=false
}){
  const issues=[]
  const warnings=[]
  const minimumBytes=stagingMode?4*GIB:buildMinimumBytes
  if(!Number.isSafeInteger(freeBytes)||freeBytes<minimumBytes)
    issues.push({code:'INSUFFICIENT_BUILD_HEADROOM',detail:`At least ${minimumBytes/GIB} GiB free for this ${stagingMode?'isolated full-app staging':'standard build'}; observed ${Number.isFinite(freeBytes)?(freeBytes/GIB).toFixed(2):'unknown'} GiB`})
  if(normal(installedPath)===normal(candidatePath))
    issues.push({code:'TARGET_IS_LIVE_APP',detail:'Release candidate destination is the existing user application; refuse in-place upgrades in this phase'})
  if(stagingMode){
    const allowed=normal(path.join(root,'integrations/clothcraft/output/release-candidates'))
    if(path.dirname(normal(candidatePath))!==allowed)
      issues.push({code:'UNSAFE_STAGING_DESTINATION',detail:'Staging destination must resolve inside the canonical release-candidates folder'})
  }
  if((!Number.isSafeInteger(dirtyPaths)||dirtyPaths>0)&&!sourceFenceOk)
    issues.push({code:'UNFROZEN_SOURCE',detail:`${dirtyPaths} modified/untracked paths; build requires an exact verified source-code fence or immutable checkout`})
  if(!sourceCommit||!(/^[0-9a-f]{7,40}$/i).test(sourceCommit))
    issues.push({code:'UNIDENTIFIED_SOURCE',detail:'No verifiable Git commit found'})
  if(!toolchainReady)
    issues.push({code:'MISSING_TOOLCHAIN',detail:'Required Node, Rust, Swift and codesign tools must be installed'})
  if(!sourceGateOk)
    issues.push({code:'NATIVE_SOURCE_PARITY_GATE',detail:
      sourceGateReason||'Pinned native source is not verified; never overwrite live Rust source to force a packaging match'})
  if(!closureReady)
    issues.push({code:'SERVICE_IMPORT_CLOSURE',detail:'Node bridge import dependencies are not proven complete'})
  const requiredPorts=stagingMode?[5485,5486]:[5385,5386]
  const conflicting=activePorts.filter(port=>requiredPorts.includes(port))
  if(conflicting.length)warnings.push({code:'FIXED_PORT_CONFLICT',detail:
    `${stagingMode?'Candidate 5485/5486':'Production 5385/5386'} needs unused ports; ${conflicting.join(',')} already listening`})
  warnings.push({code:'STAGING_ONLY',detail:
    'A successful preflight is not permission to stop, replace, restart or modify the installed V2 app or its saved projects'})
  return {
    schema:'exo.v2.release-candidate.preflight.v1',
    ready:issues.length===0&&conflicting.length===0,
    sourceCommit,sourceDirtyPaths:dirtyPaths,
    sourceFenceOk,stagingMode,requiredPorts,
    sourceFreeGiB:Number.isFinite(freeBytes)?Number((freeBytes/GIB).toFixed(2)):null,
    minimumBuildFreeGiB:minimumBytes/GIB,
    installedPath,candidatePath,
    issues,warnings,
  }
}

function checkExecutable(executable){
  if(executable==='node')return Boolean(process.execPath)
  const result=spawnSync('/usr/bin/which',[executable],{encoding:'utf8',timeout:3000})
  if(result.status===0)return true
  if(['cargo','rustc'].includes(executable)){
    // The signed EXO builder uses its own pinned Rust toolchain instead of the
    // caller's interactive PATH. Its stable compiler is the real prerequisite.
    return existsSync(path.join(root,
      'research/runtime/clothcraft-rust-toolchain/rustup/toolchains/stable-aarch64-apple-darwin/bin',
      executable))
  }
  return false
}

function commandText(command,args,maxBuffer=16*1024*1024){
  try{return execFileSync(command,args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer}).trim()}
  catch{return ''}
}

export function inspectLocalCandidatePreflight({candidatePath=defaultCandidate}={}){
  const stat=statfsSync(root)
  const freeBytes=Math.floor(stat.bavail*stat.bsize)
  const porcelain=commandText('git',['--no-optional-locks','status','--porcelain=v1','-z','--untracked-files=normal'])
  const dirtyPaths=porcelain?porcelain.split('\0').filter(Boolean).length:0
  const sourceCommit=commandText('git',['rev-parse','HEAD'])
  const toolchainReady=['node','rustc','cargo','swiftc','codesign'].every(checkExecutable)
  const listening=commandText('/usr/sbin/lsof',['-nP',
    '-iTCP:5385','-iTCP:5386','-iTCP:5485','-iTCP:5486','-sTCP:LISTEN'])
  const activePorts=[...new Set([...listening.matchAll(/\*?:(5385|5386|5485|5486)\s+\(LISTEN\)/g)].map(match=>Number(match[1])))]
  // Reuse the actual packaging gate's provenance/byte comparison. Its disk
  // condition is already evaluated above against real statfs data; pass the
  // threshold here solely to independently validate pinned Rust source.
  const nativeGate=assessV2NativeSourcePreflight20261028({
    root,availableBytes:buildMinimumBytes,
    useExisting:process.env.EXO_USE_EXISTING_EXO_SESSION_SOURCE==='1',
    approvedSourceSha256:process.env.EXO_APPROVED_NATIVE_SOURCE_SHA256||'',
  })
  const sourceGateOk=nativeGate.ok
  const closureReady=existsSync(path.join(root,'scripts/release/stage-desktop-node-module-closure.py'))
  let sourceFenceOk=false
  const fencePath=process.env.EXO_CANDIDATE_SOURCE_FENCE
  if(fencePath){
    try{
      const old=JSON.parse(readFileSync(path.resolve(fencePath),'utf8'))
      sourceFenceOk=compareInputFingerprints(old,captureSourceFence()).ok
    }catch{sourceFenceOk=false}
  }
  const assessed=assessCandidatePreflight({freeBytes,dirtyPaths,sourceCommit,candidatePath,
    activePorts,toolchainReady,sourceGateOk,sourceGateReason:nativeGate.reason,closureReady,
    sourceFenceOk,stagingMode:process.env.EXO_BUILD_STAGING==='1'})
  if(process.env.EXO_STRICT_RELEASE_MODE!=='1')return assessed
  const reviewed=process.env.EXO_REVIEWED_RELEASE_IDENTITY||''
  const eligible=process.env.EXO_BUILD_STAGING==='1' && /^[a-f0-9]{64}$/.test(reviewed)
  return {...assessed,ready:assessed.ready&&eligible,
    strictRelease:{enabled:true,reviewedIdentityPresent:eligible,installAuthorized:false},
    issues:eligible?assessed.issues:[...assessed.issues,{code:'STRICT_RELEASE_LOCK_REQUIRED',
      detail:'Strict release requires staging and an externally reviewed exact 64-character runtime SHA-256 lock'}]}
}

if(process.argv[1] && normal(process.argv[1])===fileURLToPath(import.meta.url)){
  const planned=process.argv[2]||defaultCandidate
  const result=inspectLocalCandidatePreflight({candidatePath:planned})
  console.log(JSON.stringify(result,null,2))
  if(!result.ready)process.exitCode=2
}

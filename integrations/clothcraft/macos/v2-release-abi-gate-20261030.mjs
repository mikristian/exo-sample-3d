#!/usr/bin/env node
// Read-only release installation preflight. The provenance manifest covers active
// Vite assets and the packaged Node/Rust executables; health binds the live bridge.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyRuntimeProvenance} from '../runtime-provenance.mjs'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL} from '../workspaceBridgeProtocol20261030.mjs'

const HEX=/^[a-f0-9]{64}$/
export const ABI='exo.desktop.runtime-provenance.v3'

export function preflightBundledReleaseAbi({app,expectedIdentity}) {
  if(!HEX.test(expectedIdentity||''))throw Error('RELEASE_LOCK_REQUIRED')
  const resources=path.join(app,'Contents','Resources')
  const manifest=JSON.parse(fs.readFileSync(path.join(resources,'runtime-provenance.json'),'utf8'))
  if(manifest.schema!==ABI || manifest.identity!==expectedIdentity)
    throw Error('RELEASE_LOCK_IDENTITY_MISMATCH')
  const verification=verifyRuntimeProvenance(resources)
  if(!verification.verified || verification.identity!==expectedIdentity)
    throw Error(`BUNDLED_RESOURCE_FINGERPRINT_MISMATCH:${verification.status}`)
  return Object.freeze({ok:true,abi:ABI,identity:expectedIdentity,scope:'bundled-resources-only'})
}

export function checkReleaseAbi({resources,manifest,verification,health,expectedIdentity,expectedWorkspaceAuthIdentity}) {
  const deny=(reason)=>Object.freeze({ok:false,reason})
  if(!resources || !manifest || manifest.schema!==ABI || !HEX.test(manifest.identity||''))
    return deny('UNRECOGNIZED_RELEASE_ABI')
  if(!HEX.test(expectedIdentity||'') || expectedIdentity!==manifest.identity)
    return deny('RELEASE_LOCK_IDENTITY_MISMATCH')
  if(verification?.verified!==true || verification.identity!==manifest.identity)
    return deny('BUNDLED_RESOURCE_FINGERPRINT_MISMATCH')
  if(!health || health.ok!==true || health.backend!=='clothcraft-exo-local')
    return deny('BRIDGE_PROTOCOL_MISMATCH')
  if(health.workspaceBridgeProtocol!==EXO_WORKSPACE_BRIDGE_PROTOCOL)
    return deny('BRIDGE_WORKSPACE_ABI_MISMATCH')
  const live=health.runtimeProvenance
  if(live?.verified!==true || live.identity!==manifest.identity)
    return deny('BRIDGE_RELEASE_IDENTITY_MISMATCH')
  if(!HEX.test(expectedWorkspaceAuthIdentity||'')||
     health.workspaceAuthIdentity!==expectedWorkspaceAuthIdentity)
    return deny('BRIDGE_AUTH_PROTOCOL_MISMATCH')
  if(health.nativeReady!==true || health.nativeSession?.loaded!==true ||
     health.nativeSession?.nativeProcessRunning!==true)
    return deny('RUST_SESSION_NOT_READY')
  return Object.freeze({ok:true,abi:ABI,identity:manifest.identity})
}

export async function preflightReleaseAbi({app,expectedIdentity,expectedWorkspaceAuthIdentity,bridgeHealthUrl,fetchHealth=fetch}) {
  // Only the explicitly selected local bridge is permitted. No daemon is launched.
  if(!HEX.test(expectedWorkspaceAuthIdentity||''))
    throw Error('WORKSPACE_AUTH_IDENTITY_LOCK_REQUIRED')
  const url=new URL(bridgeHealthUrl)
  if(url.protocol!=='http:' || url.hostname!=='127.0.0.1' ||
     !['5385','5485'].includes(url.port) || url.pathname!=='/health' || url.search || url.hash)
    throw Error('UNTRUSTED_BRIDGE_HEALTH_URL')
  const resources=path.join(app,'Contents','Resources')
  const manifest=JSON.parse(fs.readFileSync(path.join(resources,'runtime-provenance.json'),'utf8'))
  if(manifest.schema!==ABI || !HEX.test(expectedIdentity||'') || manifest.identity!==expectedIdentity)
    throw Error('RELEASE_LOCK_IDENTITY_MISMATCH')
  const verification=verifyRuntimeProvenance(resources)
  if(!verification.verified)throw Error(`BUNDLED_RESOURCE_FINGERPRINT_MISMATCH:${verification.status}`)
  const response=await fetchHealth(url.href,{redirect:'error',
    signal:AbortSignal.timeout(2500),headers:{accept:'application/json'}})
  if(!response.ok)throw Error(`BRIDGE_HEALTH_HTTP_${response.status}`)
  const health=await response.json()
  const result=checkReleaseAbi({resources,manifest,verification,health,expectedIdentity,expectedWorkspaceAuthIdentity})
  if(!result.ok)throw Error(result.reason)
  return result
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [app,expectedIdentity,bridgeHealthUrl,expectedWorkspaceAuthIdentity]=process.argv.slice(2)
  if(!app || !expectedIdentity || !bridgeHealthUrl) {
    console.error('Usage: node v2-release-abi-gate-20261030.mjs APP_PATH PINNED_SHA256 --offline | http://127.0.0.1:5485/health EXPECTED_AUTH_SHA256')
    process.exitCode=2
  } else {
    (bridgeHealthUrl==='--offline'
      ? Promise.resolve().then(()=>preflightBundledReleaseAbi({app,expectedIdentity}))
      : preflightReleaseAbi({app,expectedIdentity,bridgeHealthUrl,expectedWorkspaceAuthIdentity}))
      .then(result=>console.log(JSON.stringify(result)))
      .catch(error=>{console.error(`RELEASE_ABI_PREFLIGHT_REFUSED:${error.message}`);process.exitCode=1})
  }
}

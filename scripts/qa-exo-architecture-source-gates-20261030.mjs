#!/usr/bin/env node
// Source-only release checklist; never launches, kills, opens, or writes a
// user's EXO application, signed stage or garment workspace.
// Keep the group names and exact test inventories reviewable during releases.
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const commands=[
  ['native-transactions',[
    'integrations/clothcraft/nativeMirrorTransaction20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorOverlappingOwner20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorFullGraphContract20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorOwnerAdversarial20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorDeadClaimWithIntentAdversarial20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorLegacyIntentPolicyAdversarial20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorRustGeneration20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorIntegrity20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorJournalShapeRun57_20261030.test.mjs',
    'integrations/clothcraft/nativeMirrorLinkedHistoryRecoveryRun54_20261030.test.mjs',
    'integrations/clothcraft/workspaceDirectNativeCommitRecoveryRun53_20261030.test.mjs',
    'integrations/clothcraft/atomicMetadataSidecar20261030.test.mjs',
    'integrations/clothcraft/propertyMetadataIdentity20261030.test.mjs',
    'integrations/clothcraft/propertyMetadataNativeLegacyMigrationAdversarial20261030.test.mjs',
    'integrations/clothcraft/optionalProjectIdentityReceipt20261030.test.mjs',
    'integrations/clothcraft/nativeWorkspaceSummary20261030.test.mjs',
  ]],
  ['local-api-auth',[
    'integrations/clothcraft/agentUiAuthorization20261030.test.mjs',
    'integrations/clothcraft/localHostBoundary20261030.test.mjs',
    'integrations/clothcraft/agent-keys.test.mjs',
    'integrations/clothcraft/workspace-auth.test.mjs',
    'integrations/clothcraft/nativeEndpointAuthorization20261030.test.mjs',
    'src/core/nativeWorkspaceTransport.test.mjs',
  ]],
  ['ui-native-contracts',[
    'src/core/nativeWorkspaceCommandFacade20261030.test.mjs',
    'src/core/nativePatternPrintSnapshot20261030.test.mjs',
    'src/core/native3DSceneGeometryIdentity20261030.test.mjs',
    'src/core/appLinkedMirror20261030.test.mjs',
    'src/components/nativeHistoryIsolation20261030.test.mjs',
    'src/core/printPdfScaleIdentitySafety20261030.test.mjs',
    'src/core/printPdfPhysicalVector20261030.test.mjs',
    'src/core/printCalibration20261030.test.mjs',
    'scripts/appSourceOwnershipBudget20261030.test.mjs',
  ]],
  ['release-source-abi',[
    'integrations/clothcraft/runtime-provenance.test.mjs',
    'integrations/clothcraft/macos/v2-release-abi-gate-20261030.test.mjs',
    'integrations/clothcraft/macos/v2-release-abi-auth-identity-adversarial20261030.test.mjs',
    'integrations/clothcraft/macos/v2-release-provenance-bridge-integration-20261030.test.mjs',
    'integrations/clothcraft/macos/v2-release-candidate-preflight-20261030.test.mjs',
    'integrations/clothcraft/macos/v2-staging-isolation-20261030.test.mjs',
    'integrations/clothcraft/macos/v2-staging-support-namespace-20261031.test.mjs',
    'tools/rust-migration/architecture-boundary-gate-20261030.test.mjs',
  ]],
  ['bounded-performance',[
    'scripts/perf/nativeSnapshotSerialization.test.mjs',
  ]],
  ...(process.platform==='darwin' ? [['macos-staging-lifecycle',[
    'integrations/clothcraft/macos/v2-staging-watchdog-isolation-20261030.test.mjs',
    'integrations/clothcraft/macos/v2-swift-cold-start-contract-20261030.test.mjs',
  ]]] : []),
]

const reports=[]
for(const [name,files] of commands){
  const result=spawnSync(process.execPath,['--test',...files],{
    cwd:root,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024,
    env:{...process.env,EXO_STRICT_RELEASE_MODE:'0'},
  })
  const stdout=(result.stdout||'')+'\n'+(result.stderr||'')
  const extract=key=>Number(new RegExp(`(?:^|\\n)[ℹ#] ${key} (\\d+)`).exec(stdout)?.[1]??NaN)
  const row={name,exitCode:result.status??null,signal:result.signal??null,
    testFiles:files.length,passed:extract('pass'),failed:extract('fail'),
    stdoutBytes:Buffer.byteLength(stdout),error:result.error?.message??null}
  reports.push(row)
  console.error(`${name}: exit=${row.exitCode} tests=${row.passed} passed ${row.failed} failed`)
  if(row.exitCode!==0||!Number.isFinite(row.passed)||!Number.isFinite(row.failed)||row.failed!==0) {
    console.error(stdout.slice(-5000))
  }
}
const boundary=spawnSync(process.execPath,
  ['tools/rust-migration/architecture-boundary-gate-20261030.mjs'],
  {cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024})
let boundaries
try{boundaries=JSON.parse(boundary.stdout)}catch{boundaries={ok:false,parseFailure:true}}
let compiledNative=null
if(process.argv.includes('--compiled-native')) {
  const native=spawnSync(process.execPath,
    ['integrations/clothcraft/qa-architecture-live-native-contract-20261030.mjs'],{
      cwd:root,encoding:'utf8',timeout:90000,maxBuffer:1024*1024})
  let witness
  try{witness=JSON.parse(native.stdout)}catch{
    witness={ok:false,error:(native.stderr||native.stdout||'Compiled Rust witness did not produce JSON').slice(-1300)}
  }
  compiledNative={ok:native.status===0&&witness.ok===true,exitCode:native.status,
    compiledRust:witness.compiledRust===true,temporaryOnly:witness.tempOnly===true,
    checks:witness.checks||[],error:witness.error||native.error?.message||null}
}
const testPass=reports.every(r=>r.exitCode===0&&r.failed===0&&r.passed>0)
const ok=testPass&&boundary.status===0&&boundaries.ok===true&&
  (compiledNative===null||compiledNative.ok===true)
const result={schema:'exo.architecture.source-gates.v1',ok,
  sourceOnly:true,installedAppModified:false,
  claim:'Source tests only; neither installed V2 nor factory/CAD/physical fit certified',
  counts:{testsPassed:reports.reduce((sum,row)=>sum+(Number.isFinite(row.passed)?row.passed:0),0),
    testFailures:reports.reduce((sum,row)=>sum+(Number.isFinite(row.failed)?row.failed:0),0)},
  groups:reports,boundaries,compiledNative}
console.log(JSON.stringify(result,null,2))
if(!ok)process.exitCode=1

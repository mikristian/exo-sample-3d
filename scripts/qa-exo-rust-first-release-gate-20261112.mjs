#!/usr/bin/env node
/**
 * Read-only, fail-closed evidence collector for the Rust-first EXO build.
 * Does NOT package, sign, deploy, update the installed app or edit garments.
 *
 * node scripts/qa-exo-rust-first-release-gate-20261112.mjs
 * node scripts/qa-exo-rust-first-release-gate-20261112.mjs --require-ready
 */
import {spawnSync} from 'node:child_process'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
function run(script,args=[],timeout=30000){
  const out=spawnSync(process.execPath,[script,...args],{
    cwd:root,encoding:'utf8',timeout,maxBuffer:1024*1024*12,
  })
  return {ok:out.status===0,status:out.status,error:out.error?.message||null,
    stdout:out.stdout.trim(),stderr:out.stderr.trim()}
}
function parsed(result){
  try{return JSON.parse(result.stdout)}catch{return null}
}
const cases={
  moduleGraphSelfTest:run('scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs',['--self-test']),
  generatedRustTypeContract:run('scripts/qa-exo-rust-grade-command-contract-20261112.mjs',['--probe-native']),
  typedReactCommandAdapterTests:run('--test',['src/core/exoNativeGradeCommandV1.test.mjs']),
  scopedDraftVersusRustHistory:run('--test',['src/core/scopedNativeGradeHistory20261112.test.mjs']),
  gradingWasmParity:run('scripts/qa-rust-grading-kernel.mjs'),
  nativeRustGradingRoundTrip:run('scripts/qa-rust-grading-connected-migration-20261112.mjs'),
  draftingSewingManufacturingAcceptance:run('scripts/qa-exo-rust-first-multi-domain-20261112.mjs',[],90000),
  stagedNativeRustIntegrity:run('scripts/qa-exo-rust-first-staging-verify-20261112.mjs'),
  sixSizeNativePreviewContract:run('src/core/nativeSixSizeCommandContract20261028.test.mjs'),
  shippedArtifactIdentity:run('scripts/qa-rust-v2-shipping-audit-20261018.mjs'),
}
const released=parsed(cases.shippedArtifactIdentity)
const grade=parsed(cases.gradingWasmParity)
const roundTrip=parsed(cases.nativeRustGradingRoundTrip)
const domains=parsed(cases.draftingSewingManufacturingAcceptance)
const typed=parsed(cases.generatedRustTypeContract)
const baselineOk=Object.entries(cases).every(([name,item])=>item.ok)&&
  grade?.pass===true&&roundTrip?.pass===true&&domains?.pass===true&&
  domains?.verifiedSystems===7&&domains?.native?.coldOpen===true&&
  roundTrip?.nativeCommitted===true&&roundTrip?.durableCatalog===true&&
  roundTrip?.uiIntegrationVerified===false&&typed?.result==='PASS'&&
  released?.schema==='exo.rust-v2-release-audit.v1'
const mismatches=released?.artifacts?.filter(item=>item.status!=='current').map(x=>({id:x.id,status:x.status}))||[]

// Artifact identity is necessary but never sufficient. We intentionally do not
// guess that physical manufacturing, multi-garment simulator parity, signed
// native UI regression, and fail-safe rollback are qualified merely because
// the unit tests passed. Those require separately audited acceptance evidence.
const acceptance={
  nativeUiToRustDocumentRoundTrip:'not-run-in-this-gate',
  multiGarmentPhysicalSolverAcceptance:'not-run-in-this-gate',
  factoryDxfPlotterAcceptance:'not-run-in-this-gate',
  signedBundleAndRollback:'not-run-in-this-gate',
}
const report={
  schema:'exo.rust-first-phase-release-gate.v1',
  sourceAuditDate:'2026-11-12',
  baselineChecksPass:baselineOk,
  installedArtifactsMatchSource:released?.releaseReady===true,
  artifactMismatches:mismatches,
  acceptance,
  releaseReady:false,
  // A complete release proof has not been provided. Even if the existing
  // artifact mismatches are fixed, do not silently flip this to true.
  checkResults:Object.fromEntries(Object.entries(cases).map(([name,item])=>[name,{
    ok:item.ok,status:item.status,
    ...(name==='gradingWasmParity'?{fixtures:grade?.fixtures||null}:{}),
    ...(name==='nativeRustGradingRoundTrip'?{
      checkedCoordinates:roundTrip?.checkedCoordinates||null,
      nativeActivatedSizes:roundTrip?.nativeActivatedSizes||null,
      gradedNativeCutlines:roundTrip?.gradedNativeCutlines||null,
      uiIntegrationVerified:roundTrip?.uiIntegrationVerified===true,
    }:{}),
    ...(name==='draftingSewingManufacturingAcceptance'?{
      systems:domains?.verifiedSystems||null,
      nativeSeamSavedReopened:domains?.native?.coldOpen===true,
    }:{}),
    ...(name==='sixSizeNativePreviewContract'?{summary:item.stdout.slice(-900)}:{}),
    ...(item.error?{error:item.error}:{}),
    ...(item.stderr?{stderr:item.stderr.slice(-300)}:{}),
  }])),
  conclusion:baselineOk
    ? 'Baseline checks passed. The installed Rust artifacts and production acceptance gates are NOT yet release-qualified.'
    : 'One or more baseline checks failed; stop before modifying the installed application.',
}
console.log(JSON.stringify(report,null,2))
if(process.argv.includes('--require-ready')&&!report.releaseReady)process.exitCode=1
else if(!baselineOk)process.exitCode=1

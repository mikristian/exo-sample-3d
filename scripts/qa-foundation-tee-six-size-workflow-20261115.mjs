#!/usr/bin/env node
// End-to-end engineering acceptance for the ACTUAL four-piece EXO Foundation
// Tee across XS–XXL. Uses genuine EXO geometry/production exports, the
// source-built native C++ converter and an active Rust session in disposable
// storage. Does not imply physical fit or factory approval.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'
import {createTeeTemplate} from '../src/data/templates.js'
import {gradeProject} from '../src/core/grading.js'
import {seamLengthReport} from '../src/core/project.js'
import {measureProject,buildTechPack,measurementRunToCSV} from '../src/core/measurements.js'
import {projectToDxf} from '../src/core/dxf.js'
import {parseAccuMarkGradedDxfWire20261023} from '../src/core/accumarkGradedDxfRoundtripAudit20261023.js'
import {createWorkspace} from '../integrations/clothcraft/workspace.mjs'
import {nativeExport,paths} from '../integrations/clothcraft/bridge.mjs'
import {buildSixSizeTeeNativeCatalog20261115,SIX_SIZES_TEE_20261115 as SIZES} from '../integrations/clothcraft/sixSizeTeeNativeCatalog20261115.mjs'

const argv=new Set(process.argv.slice(2))
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'exo-six-size-foundation-tee-e2e-'))
const stages=[]
const add=(name,detail)=>stages.push({stage:name,status:'PASS',...detail})
const firstPartyGate=['physical fit sample','fabric wash/shrink measurement','independent AAMA/ASTM CAD receiver','neckband cut pattern','external cutter approval']
const report={schema:'exo.foundation-tee-six-size-acceptance.v1',
 artifact:'Foundation Tee production-development block',sizes:[...SIZES],
 fixturesAreIndependentDrafts:false,actualSourceFourPieceTee:true,
 physicalSampleCertified:false,industrialCadReceiverApproved:false,
 cutterReleaseApproved:false,fullWorkflowFactoryApproved:false,
 steps:stages,blockers:[...firstPartyGate]}
let workspace
let last
const send=async command=>{
 const reply=await workspace.request({revision:last?.revision,...command})
 assert.equal(reply.ok,true,`${command.op}: ${reply.error||'native Rust rejected request'}`)
 if(reply.data?.template)last=reply.data
 return reply.data
}
const reject=async command=>{
 const original=structuredClone(last)
 const reply=await workspace.request({revision:last.revision,...command})
 assert.equal(reply.ok,false,`${command.op}: invalid/stale command was accepted`)
 await send({op:'snapshot'})
 assert.equal(last.revision,original.revision,'Rejected command advanced authoritative Rust revision')
 assert.deepEqual(last.template,original.template,'Rejected command changed source pattern')
 return reply.error
}
async function main(){
 const bin=process.env.EXO_CLOTHCRAFT_SESSION_BIN,cli=process.env.EXO_NATIVE_CLI,repo=process.env.EXO_CLOTHCRAFT_REPO
 for(const [name,where] of Object.entries({EXO_CLOTHCRAFT_SESSION_BIN:bin,EXO_NATIVE_CLI:cli}))
  if(!where||!path.isAbsolute(where)||!fs.existsSync(where))throw Error(`Supply an existing absolute ${name} for an isolated, source-matched native test`)
 if(!repo||!fs.existsSync(path.join(repo,'Cargo.toml')))
  throw Error('Set EXO_CLOTHCRAFT_REPO to a pinned, separately sourced ClothCraft checkout')
 const probe=JSON.parse(execFileSync(bin,['--exo-capabilities'],{timeout:3000,encoding:'utf8'}).trim())
 assert.equal(probe.ok,true);assert.equal(probe.nativeProjectGenerationV1,true)
 report.nativeSessionSha256=hash(fs.readFileSync(bin))
 report.nativeCadSha256=hash(fs.readFileSync(cli))
 const src=createTeeTemplate()
 assert.equal(src.pieces.length,4);assert.equal(src.seams.length,14)
 assert.equal(src.productionSpec?.approvalStatus,'FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED')
 assert.deepEqual(src.grading?.sizes,SIZES)
 const group=new Map()
 for(const piece of src.pieces){
  for(const notch of piece.notches||[]){
   assert(notch.matchGroupId && notch.matchedSeamId,`Unlinked notch on ${piece.id}`)
   assert(src.seams.some(seam=>seam.id===notch.matchedSeamId),'Orphan seam ref')
   group.set(notch.matchGroupId,(group.get(notch.matchGroupId)||0)+1)
  }
 }
 assert([...group.values()].every(count=>count>=2),'Factory alignment notch lacks partner')
 add('source-tee',{patternPieces:src.pieces.length,seams:src.seams.length,pairedNotchGroups:group.size})
 const checked=[];let priorChest=-Infinity
 for(const size of SIZES){
  const draft=gradeProject(src,size)
  assert.equal(draft.previewSize,size)
  assert.deepEqual(draft.pieces.map(p=>p.id),src.pieces.map(p=>p.id))
  assert.deepEqual(draft.seams.map(s=>s.id),src.seams.map(s=>s.id))
  const mismatch=Math.max(0,...draft.seams.map(s=>seamLengthReport(draft,s).mismatchPercent))
  assert(Number.isFinite(mismatch)&&mismatch<0.5,`${size} source seam mismatch ${mismatch}%`)
  const measured=measureProject(draft)
  const get=id=>measured.find(m=>m.id===id)?.cm
  const chest=get('chest-half'),length=get('body-length')
  assert(Number.isFinite(chest)&&chest>priorChest,`${size} chest did not grade monotonically`)
  assert(Number.isFinite(length)&&length>0,`${size} has no body length`)
  priorChest=chest
  // Standard DXF has an explicit allowance layer. Manufacturing mode instead
  // places the physical allowance OUTLINE on CUT and stitchline on STITCH:
  // requiring SA_ there would reject an otherwise correctly labeled file.
  const construction=projectToDxf(draft,size)
  const wire=projectToDxf(draft,size,{cutlineMode:'manufacturing',requireGradedGeometry:true})
  const parsed=parseAccuMarkGradedDxfWire20261023(wire)
  assert.equal(parsed.ok,true,`${size} DXF parser refused result`)
  assert.equal(parsed.units,'4',`${size} DXF lost centimetre units`)
  assert(wire.includes(`GARMENT_STUDIO_SIZE ${size}`),`${size} DXF lost size`)
  for(const layer of ['CUT_','SA_','NOTCH_','GRAIN_'])assert(construction.includes(layer),`${size} construction DXF missing ${layer}`)
  for(const layer of ['CUT_','STITCH_','NOTCH_','GRAIN_'])assert(wire.includes(layer),`${size} manufacturing DXF missing ${layer}`)
  assert.doesNotMatch(wire,/NaN|Infinity/)
  checked.push({size,chestHalfCm:chest,bodyLengthCm:length,
   seamMismatchPercent:Number(mismatch.toFixed(5)),dxfSha256:hash(wire),
   dxfBytes:Buffer.byteLength(wire),constructionDxfSha256:hash(construction)})
 }
 const techPack=buildTechPack(src)
 assert.equal(techPack.patternPieces.length,4);assert.equal(techPack.construction.length,14)
 const pomCsv=measurementRunToCSV(src)
 assert(pomCsv.includes('Cuff circumference (sleeve flat)'))
 add('EXO-pattern-grade-and-export',{gradedSizes:checked.length,readings:checked,
  techPackPatternPieces:techPack.patternPieces.length,techPackConstructions:techPack.construction.length,
  pomCsvSha256:hash(pomCsv),receiverCertified:false})
 workspace=createWorkspace(fixtureRoot)
 const nativeOpened=await send({op:'open',document:src,initialPlacementPreset:'offbody-foundation-tee'})
 assert.deepEqual(nativeOpened.template.panels.map(p=>p.id),src.pieces.map(p=>p.id))
 assert.deepEqual(nativeOpened.template.seams.map(s=>s.id),src.seams.map(s=>s.id))
 assert(Array.isArray(nativeOpened.triangles)&&nativeOpened.triangles.length>1000)
 const originalNative=structuredClone(nativeOpened.template)
 add('Rust-4-panel-mesh',{initialPlacement:'opt-in-offbody-foundation-tee',nativePanels:nativeOpened.template.panels.length,
  nativeSeams:nativeOpened.template.seams.length,triangles:nativeOpened.triangles.length})
 const catalog=buildSixSizeTeeNativeCatalog20261115({project:src,
  baseTemplate:originalNative,exportNative:graded=>nativeExport(graded,paths().cli)})
 // Source-aware workspace enrichment now transfers numeric allowances and
 // notch stations. Raw C++ exports still omit them, and the native schema
 // still cannot represent EXO's double-notch distinction.
 assert(catalog.warnings.some(w=>/notch/i.test(w)),'Do not hide raw C++ notch interchange gap')
 assert(catalog.warnings.some(w=>/allowance/i.test(w)),'Do not hide raw C++ allowance interchange gap')
 const nativeAllowances=originalNative.panels.reduce((n,p)=>n+Object.keys(p.polygon.seam_allowances||{}).length,0)
 const nativeNotches=originalNative.panels.reduce((n,p)=>n+Object.values(p.polygon.notches||{}).flat().length,0)
 assert.equal(nativeAllowances,38,'Lost one or more source seam allowances in Rust workspace')
 assert.equal(nativeNotches,8,'Lost one or more source notch stations in Rust workspace')
 add('Rust-source-CUT-metadata',{nativeAllowances,nativeNotches,
  doubleNotchTypesPreserved:false,physicalCutReceiverApproved:false})
 const committed=await send({op:'grade-run-commit',gradeRun:catalog.gradeRun})
 assert.equal(committed.gradeRunPersisted,true)
 const status=await send({op:'grade-run-status'})
 assert.equal(status.persistedInProject,true)
 assert.deepEqual(status.catalog.sizes,SIZES)
 const sewing=await send({op:'grade-run-sewing-balance-audit'})
 assert.equal(sewing.format,'exo-native-six-size-sewn-balance-audit.v1')
 assert.deepEqual(sewing.sizes.map(x=>x.size),SIZES)
 assert.equal(sewing.factoryApproved,false)
 const sewSizes=[]
 for(const row of sewing.sizes){
  assert.equal(row.seams.length,14,`${row.size} lost Rust sewing connections`)
  const worst=Math.max(0,...row.seams.map(s=>Math.abs(s.mismatchM)))
  assert(Number.isFinite(worst)&&worst<0.005,`${row.size} Rust native seam disparity >= 5mm`)
  sewSizes.push({size:row.size,seams:row.seams.length,maxSeamMismatchMm:Number((worst*1000).toFixed(3))})
 }
 const cuts=await send({op:'grade-run-cutlines'})
 assert.deepEqual(cuts.sizes.map(x=>x.size),SIZES)
 assert.equal(cuts.manufacturerReady,false)
 assert.equal(cuts.cuttingAuthorized,false)
 add('Rust-six-size-sewing-and-cutlines',{sizes:sewSizes,cutlineSizes:cuts.sizes.length,
  sourceWarnings:catalog.warnings,manufacturingApproved:false})
 const invalid=await reject({op:'grade-run-sewing-balance-audit',revision:last.revision-1})
 assert.match(invalid,/stale|revision|expected/i)
 await send({op:'undo'})
 const undone=await send({op:'grade-run-status'})
 assert.equal(undone.persistedInProject,false)
 await send({op:'redo'})
 const redone=await send({op:'grade-run-status'})
 assert.equal(redone.persistedInProject,true)
 assert.deepEqual(redone.catalog.sizes,SIZES)
 add('Rust-Undo-Redo',{gradeCatalogRemovedByUndo:true,gradeCatalogRestoredByRedo:true,staleRevisionRejected:true})
 const previews=[]
 for(const size of SIZES){
  const view=await send({op:'grade-run-activate',size})
  assert.equal(view.activeGradedSize,size)
  assert.equal(view.template.panels.length,4)
  assert.equal(view.template.seams.length,14)
  assert(view.triangles?.length>1000,`${size} no 3D mesh`)
  assert(view.triangles.every(face=>face.length===3&&face.every(Number.isInteger)))
  const meshTriangles=view.triangles.length
  // Three real CPU steps against the original avatar mesh, no GPU shortcuts
  // or OGC bypass. A successful step is distinct from acceptable fabric fit.
  const physics={threeStepSmokeSucceeded:false,frames:[]}
  try{
   for(let frame=1;frame<=3;frame++){
    const stepped=await send({op:'step',steps:1})
    const m=stepped.metrics
    for(const k of ['max_seam_gap_m','extension_max_percent','extension_p95_percent','minimum_distance_m','time_s'])
     assert(Number.isFinite(m?.[k]),`${size} frame ${frame}: Rust physics did not return finite ${k}`)
    physics.frames.push({frame,timeMs:Number((m.time_s*1000).toFixed(3)),
     maxSeamGapMm:Number((m.max_seam_gap_m*1000).toFixed(3)),
     peakExtensionPercent:Number(m.extension_max_percent.toFixed(3)),
     p95ExtensionPercent:Number(m.extension_p95_percent.toFixed(3)),
     minimumDistanceMm:Number((m.minimum_distance_m*1000).toFixed(3))})
   }
   physics.threeStepSmokeSucceeded=true
  }catch(err){physics.error=String(err.message||err)}
  // Provisional engineering triage, NOT industrial fabric tolerances. An
  // actual physically measured material calibration is still required.
  physics.provisionalQualityGates={
   maxSeamGapMm:10,peakExtensionPercent:30,
   pass:physics.threeStepSmokeSucceeded&&physics.frames.every(f=>
    f.maxSeamGapMm<=10&&f.peakExtensionPercent<=30),
  }
  const restored=await send({op:'grade-run-restore'})
  assert.equal(restored.activeGradedSize,null)
  assert(isDeepStrictEqual(restored.template,originalNative),'Rust grade preview changed the authoring base')
  previews.push({size,triangles:meshTriangles,physics})
 }
 add('Rust-3D-six-size-preview',{previews,allSixMeshesCompiled:true,
  allSixThreeStepCpuSmokesPassed:previews.every(p=>p.physics.threeStepSmokeSucceeded),
  allSixProvisionalPhysicsQualityGatesPassed:previews.every(p=>p.physics.provisionalQualityGates.pass),
  fullMultiframePhysicalFitCertified:false})
 const saved=await send({op:'save'})
 assert.equal(saved.project.grade_run.gradedTemplates.length,6)
 const reopened=await send({op:'open',project:saved.project})
 assert.equal(reopened.gradeRunPersisted,true)
 assert(isDeepStrictEqual(reopened.template,originalNative))
 const after=await send({op:'grade-run-sewing-balance-audit'})
 assert.deepEqual(after.sizes,sewing.sizes,'Rust linked six-size seam evidence changed on reopen')
 const reopenedSaved=await send({op:'save'})
 assert.equal(reopenedSaved.project.grade_run.gradedTemplates.length,6)
 // A fresh Node workspace and new OS-level Rust child must independently
 // restore both the garment and its matching durable Undo/Redo journal.
 workspace.close()
 workspace=createWorkspace(fixtureRoot)
 last=null
 const cold=await send({op:'open',project:reopenedSaved.project})
 assert.equal(cold.gradeRunPersisted,true)
 assert(isDeepStrictEqual(cold.template,originalNative),'Cold Rust session changed original 2D pattern')
 assert.deepEqual((await send({op:'grade-run-sewing-balance-audit'})).sizes,sewing.sizes)
 await send({op:'undo'})
 assert.equal((await send({op:'grade-run-status'})).persistedInProject,false,'Cold Rust lost linked Undo history')
 await send({op:'redo'})
 assert.equal((await send({op:'grade-run-status'})).persistedInProject,true,'Cold Rust lost linked Redo history')
 const coldSaved=await send({op:'save'})
 assert.equal(coldSaved.project.grade_run.gradedTemplates.length,6)
 add('Rust-linked-save-and-reopen',{nativeProjectGeneration:coldSaved.project.native_commit?.generation,
  nativeGradeRunSurvived:true,exactSourceAndSeamAuditPreserved:true,
  separateRustChildColdReopenPassed:true,persistedUndoAfterColdReopen:true,
  persistedRedoAfterColdReopen:true})
 report.stepsPassed=stages.length
 report.allSixThreeStepCpuSmokesPassed=previews.every(x=>x.physics.threeStepSmokeSucceeded)
 report.provisionalPhysicsQualityGatesPassed=previews.every(x=>x.physics.provisionalQualityGates.pass)
 report.boundedEngineeringWorkflowPass=report.allSixThreeStepCpuSmokesPassed
 report.engineeringWorkflowPass=report.boundedEngineeringWorkflowPass
 report.productionAccuracyVerified=false
 report.nativeConversionLossIsBlocking=true
 if(!report.provisionalPhysicsQualityGatesPassed)
  report.blockers.push('Despite CPU steps succeeding, measured seam gap/stretch exceed provisional engineering quality limits: see per-size three-frame metrics')
 report.blockers.push('Generic C++ exporter omits physical notch and allowance metadata (workspace adapts numeric stations/allowances only); double-notch type and external receiving remain blocked')
 report.productionReleaseBlocked=true
}

try {
 await main()
} catch(error){
 report.lastCompletedStage=stages.at(-1)?.stage||'none'
 report.failure=String(error?.stack||error)
 report.engineeringWorkflowPass=false
 console.error('EXO_SIX_SIZE_TEE_ACCEPTANCE_FAILED',error?.message||error)
 process.exitCode=1
} finally {
 if(workspace)try{await workspace.close?.()}catch{}
 report.qualityClaim='ENGINEERING QA ONLY; physical fit, independent receiver DXF and factory certification not proven'
 const publicReport={...report,nativeSessionSha256:report.nativeSessionSha256,nativeCadSha256:report.nativeCadSha256}
 if(report.failure)publicReport.failure=report.failure.replaceAll(fixtureRoot,'<DISPOSABLE_TEST_DIR>')
 const json=JSON.stringify(publicReport,null,2)+'\n'
 if(process.env.EXO_SIX_SIZE_TEE_REPORT){
  const out=path.resolve(process.env.EXO_SIX_SIZE_TEE_REPORT)
  if(fs.existsSync(out))throw Error('Refusing to overwrite existing six-size tee report')
  fs.writeFileSync(out,json,{flag:'wx'})
 }
 console.log(json)
 if(!argv.has('--keep-scratch'))fs.rmSync(fixtureRoot,{recursive:true,force:true})
 else console.error('DISPOSABLE_TEST_ROOT',fixtureRoot)
 if((argv.has('--require-factory-approval')&&report.fullWorkflowFactoryApproved!==true)||
    (argv.has('--require-physical-fit')&&report.provisionalPhysicsQualityGatesPassed!==true)){
  console.error('FACTORY_GATE_REJECTED: physical, industrial and fabric acceptance still required')
  process.exitCode=2
 }
}

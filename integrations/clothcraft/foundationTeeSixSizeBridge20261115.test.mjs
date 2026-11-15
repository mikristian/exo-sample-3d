import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../../src/data/templates.js'
import {nativeExport,paths} from './bridge.mjs'
import {rebaseExactSameNativeProject20261115} from './workspace.mjs'
import {attachSourceTeeCutMetadata20261115} from './sourceTeeCutMetadata20261115.mjs'
import {stageFoundationTeeOffbody20261115} from './foundationTeeOffbodyStaging20261115.mjs'
import {buildSixSizeTeeNativeCatalog20261115,SIX_SIZES_TEE_20261115} from './sixSizeTeeNativeCatalog20261115.mjs'

const native=source=>nativeExport(source,process.env.EXO_NATIVE_CLI||paths().cli).template
const source=()=>createTeeTemplate()

test('source four-panel tee cut/stitch metadata transfers numeric allowances, notches and oriented pairs',()=>{
 const doc=source(),old=structuredClone(doc)
 const imported=native(doc)
 const result=attachSourceTeeCutMetadata20261115(doc,imported)
 assert.equal(result.applied,true)
 assert.equal(result.allowanceEdges,38)
 assert.equal(result.notchStations,8)
 assert.equal(result.pairedNotchSeams,4)
 assert.equal(result.doubleNotchStations,4)
 assert.deepEqual(doc,old)
 assert.equal(imported.panels[0].polygon.seam_allowances,undefined) // raw C++ export remains untouched
 assert.deepEqual(imported.seams[0].notches,[])
 for(const p of result.template.panels){
  assert.equal(Object.keys(p.polygon.seam_allowances).length,p.polygon.edges.length)
  for(const value of Object.values(p.polygon.seam_allowances)) assert(value>0&&value<=.04)
 }
 for(const pair of result.template.seams.filter(s=>s.notches.length)){
  const exo=doc.seams.find(s=>s.id===pair.id)
  assert.equal(pair.notches.length,1)
  const a=doc.pieces.find(p=>p.id===exo.a.pieceId).notches.find(n=>n.matchedSeamId===exo.id)
  const b=doc.pieces.find(p=>p.id===exo.b.pieceId).notches.find(n=>n.matchedSeamId===exo.id)
  assert(Math.abs(pair.notches[0][0]-a.t)<1e-12)
  assert(Math.abs(pair.notches[0][1]-(exo.reverseB?1-b.t:b.t))<1e-12)
 }
})

test('source CUT adapter rejects forgery, mismatched seam ID, stale and invalid notch metadata',()=>{
 const doc=source(),blank=native(doc)
 for(const tamper of [
  d=>d.productionSpec.approvalStatus='FACTORY_APPROVED',
  d=>d.pieces[0].notches[0].t=Infinity,
  d=>d.pieces[0].notches[0].matchedSeamId='MISSING',
  d=>d.seams[0].a.edgeIndex=999,
 ]){
  const bad=structuredClone(doc);tamper(bad)
  assert.throws(()=>attachSourceTeeCutMetadata20261115(bad,blank))
 }
 const hasNative=structuredClone(blank);hasNative.panels[0].polygon.seam_allowances={edge_0:.01}
 assert.throws(()=>attachSourceTeeCutMetadata20261115(doc,hasNative),/overwrite/)
})

test('opt-in off-body sleeve staging modifies only the initial arrangement and never original source',()=>{
 const doc=source(),before=structuredClone(doc)
 const result=stageFoundationTeeOffbody20261115(doc)
 assert.deepEqual(doc,before)
 assert.equal(result.optInRequired,true)
 assert.equal(result.verifiedPhysicalFit,false)
 for(const p of result.document.pieces){
  const old=before.pieces.find(o=>o.id===p.id)
  assert.deepEqual(p.points,old.points)
  assert.deepEqual(p.notches,old.notches)
  assert.deepEqual(p.edgeSeamAllowances,old.edgeSeamAllowances)
  assert.equal(p.arrangement3d.x,old.arrangement3d.x)
  assert.equal(p.arrangement3d.y,old.arrangement3d.y)
  if(p.id==='front'||p.id==='back')assert.deepEqual(p.arrangement3d,old.arrangement3d)
 }
 assert.equal(result.document.pieces.find(p=>p.id==='sleeve-left').arrangement3d.z,.22)
 assert.equal(result.document.pieces.find(p=>p.id==='sleeve-right').arrangement3d.z,-.22)
 const forged=source();forged.productionSpec.approvalStatus='APPROVED'
 assert.throws(()=>stageFoundationTeeOffbody20261115(forged),/unapproved/)
})

test('all six real EXO graded tee geometries are represented in one identity-stable Rust catalog',()=>{
 const doc=source(),base=attachSourceTeeCutMetadata20261115(doc,native(doc)).template
 const expected=structuredClone(base)
 const catalog=buildSixSizeTeeNativeCatalog20261115({project:doc,baseTemplate:base,
  exportNative:grade=>nativeExport(grade,process.env.EXO_NATIVE_CLI||paths().cli)})
 assert.deepEqual(catalog.gradeRun.sizes,SIX_SIZES_TEE_20261115)
 assert.equal(catalog.gradeRun.gradedTemplates.length,6)
 assert.deepEqual(catalog.gradeRun.gradedTemplates[2],expected)
 assert.equal(catalog.productionRelease.factoryApproved,false)
 assert.equal(catalog.productionRelease.fitAccepted,false)
 assert.deepEqual(base,expected)
 assert.equal(catalog.gradeRun.baseTemplate.seams.length,14)
 const widths=[]
 for(const template of catalog.gradeRun.gradedTemplates){
  assert.equal(template.panels.length,4);assert.equal(template.seams.length,14)
  assert.deepEqual(template.seams,expected.seams)
  const left=template.panels.find(p=>p.id==='front')
  widths.push(left.polygon.points[0][0])
 }
 assert.equal(new Set(widths).size,6,'Six sizes must not be identical geometry')
 const fake=source();fake.grading.sizes=['XS','M','XXL']
 assert.throws(()=>buildSixSizeTeeNativeCatalog20261115({project:fake,baseTemplate:base,
  exportNative:grade=>nativeExport(grade,process.env.EXO_NATIVE_CLI||paths().cli)}),/six distinct/)
})

test('same-project reopen only rebases exact identity to newer generation while preserving authoring fields',()=>{
 const original={native_commit:{project_id:'p1',schema_version:1,generation:2},template:{panels:[{id:'a'}]},grade_run:{sizes:['XS','M']},state:{time:0},mesh_signature:'h1'}
 const previous=structuredClone(original)
 const next=structuredClone(original);next.native_commit.generation=3;next.state={time:0.016};next.mesh_signature='h2'
 assert.deepEqual(rebaseExactSameNativeProject20261115(original,previous,next),next)
 const stale=structuredClone(original);stale.template.panels[0].id='different'
 assert.equal(rebaseExactSameNativeProject20261115(stale,previous,next),stale)
 const forged=structuredClone(next);forged.native_commit.project_id='other'
 assert.throws(()=>rebaseExactSameNativeProject20261115(original,previous,forged),/identity/)
 const regressed=structuredClone(next);regressed.native_commit.generation=1
 assert.throws(()=>rebaseExactSameNativeProject20261115(original,previous,regressed),/identity/)
 const authorChange=structuredClone(next);authorChange.grade_run.sizes.push('XXL')
 assert.throws(()=>rebaseExactSameNativeProject20261115(original,previous,authorChange),/authored fields/)
 assert.equal(rebaseExactSameNativeProject20261115(null,previous,next),null)
})

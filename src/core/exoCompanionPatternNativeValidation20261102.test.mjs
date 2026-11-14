import test from 'node:test'
import assert from 'node:assert/strict'
import {draftExoTextSketchPattern20261102 as draft} from './exoTextSketchPatternCandidate20261102.js'
import {prepareVerifiedNativeArchiveDraft,openVerifiedNativeArchiveDraft} from './exoNativeArchiveDraftImport20261102.js'
import {createExoCompanionPatternPreview20261102 as preview,buildExoCompanionPatternPreview20261102 as companionPreview} from './exoCompanionPatternPreview20261102.js'
import {projectToDxf} from './dxf.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'

for(const [family,prompt] of [
  ['tee','Create a boxy cropped crew neck T-shirt'],
  ['hoodie','Create an oversized cropped hoodie, body length 58 cm'],
  ['zip-hoodie','Create a zip-up hoodie'],
])test(`${family} companion proposal preserves curved boundaries, seam graph, native preflight and DXF`,()=>{
  const result=draft({prompt})
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.report.sourceTemplateId,family)
  assert.equal(result.status,'review_required')
  const source=result.project,unchanged=structuredClone(source)
  const shape=preview(source)
  assert.equal(shape.pieces.length,source.pieces.length)
  assert.equal(shape.seamCount,source.seams.length)
  assert.ok(shape.widthCm>0&&shape.heightCm>0)
  assert.ok(shape.pieces.every(p=>p.widthCm>0&&p.heightCm>0&&p.path.startsWith('M ')&&p.path.endsWith(' Z')))
  assert.ok(shape.pieces.some(p=>p.curveCount>0&&p.path.includes(' Q ')),'quadratic controls must survive SVG preview')
  const sorted=[...shape.pieces].sort((a,b)=>a.x-b.x)
  for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].x>=sorted[i-1].x+sorted[i-1].widthCm+3.999,'independent panels must not overlap')
  const prepared=prepareVerifiedNativeArchiveDraft(source)
  assert.equal(prepared.report.removed.length,0)
  assert.equal(prepared.report.removedSeams,0)
  assert.equal(prepared.document.pieces.length,source.pieces.length)
  assert.equal(prepared.document.seams.length,source.seams.length)
  const sourceSeams=source.seams.map(s=>s.id).sort()
  assert.deepEqual(prepared.document.seams.map(s=>s.id).sort(),sourceSeams)
  assert.equal(inspectIndustrialPatterns(prepared.document,{sizes:[source.grading.baseSize]}).status,'pass')
  const dxf=projectToDxf(source,source.grading.baseSize)
  assert.match(dxf,/\nSECTION\n/)
  assert.match(dxf,/\nPOLYLINE\n/)
  assert.ok(dxf.length>3000)
  assert.deepEqual(source,unchanged,'preview, DXF and native preflight cannot mutate the working source')
})

test('unreviewed companion proposal cannot cause native replacement before confirmed application',async()=>{
  const result=draft({prompt:'Create a crew neck T-shirt'})
  assert.equal(result.ok,true,result.reason)
  const events=[]
  // Exercise the same explicit user-confirmation boundary the companion must apply.
  const applyReviewed=async reviewed=>{
    if(!reviewed)return {ok:false,status:'review_required'}
    return openVerifiedNativeArchiveDraft(result.project,{
      bridgeOrigin:'http://127.0.0.1:5193',
      bridgeFetch:async()=>{events.push('convert');return {ok:true,json:async()=>({ok:true,template:{panels:result.project.pieces.map(()=>({})),seams:result.project.seams.map(()=>({}))}})}},
      requestProject:async action=>{events.push(action);return action==='capture'?{project:{name:'previous working garment'}}:{ok:true}},
      persistBackup:async()=>{events.push('backup');return {id:'persisted-previous-garment'}},
    })
  }
  assert.deepEqual(await applyReviewed(false),{ok:false,status:'review_required'})
  assert.deepEqual(events,[])
  const applied=await applyReviewed(true)
  assert.equal(applied.ok,true)
  assert.deepEqual(events,['convert','capture','backup','open'])
})

test('invalid curved geometry cannot produce a trusted preview and invalid seam graph cannot enter native editor',()=>{
  const result=draft({prompt:'Create a zip-up hoodie'})
  assert.equal(result.ok,true,result.reason)
  const corrupted=structuredClone(result.project)
  const curved=corrupted.pieces.find(p=>Object.keys(p.curves||{}).length)
  assert.ok(curved)
  curved.curves[Object.keys(curved.curves)[0]].cx=Infinity
  assert.throws(()=>preview(corrupted),/Invalid quadratic curve/)
  const safe=companionPreview(corrupted)
  assert.equal(safe.ok,false)
  assert.equal(safe.pieces.length,0)
  const broken=structuredClone(result.project)
  broken.seams[0].a.edgeIndex=10000
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(broken),/Pattern QA blocked/)
})

test('companion-facing SVG contract accommodates a complete 24-piece jeans construction',()=>{
  const result=draft({prompt:'Create classic straight-leg denim jeans'})
  assert.equal(result.ok,true,result.reason)
  const original=structuredClone(result.project)
  const shape=companionPreview(result.project)
  assert.equal(shape.ok,true,shape.reason)
  assert.equal(shape.pieces.length,24)
  assert.ok(shape.pieces.every(p=>p.viewBox===shape.viewBox&&p.svgPath===p.path))
  assert.deepEqual(result.project,original)
})

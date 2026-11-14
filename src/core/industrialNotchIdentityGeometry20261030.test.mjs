import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectGradedNotchPairs } from './industrialNotchQA.js'
import { quadraticArcLength } from './draftingPrecision.js'
import { inspectNotchArcPrecision } from './independentNotchArcOracle20261023.js'

// Disposable XS/M shell-and-lining garment, never a factory production record.
function garment({ curved = true } = {}) {
  const piece = id => ({
    id, points: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    ...(curved ? {curves:{0:{cx:2,cy:-6}}} : {}),
    notches:[{id:`${id}-notch`,edgeIndex:0,t:.4,matchGroupId:'pair',matchedSeamId:'sew'}],
  })
  return {pieces:[piece('shell'),piece('lining')],
    seams:[{id:'sew',a:{pieceId:'shell',edgeIndex:0},b:{pieceId:'lining',edgeIndex:0}}],
    grading:{sizes:['XS','M'],baseSize:'XS',widthPerSizeCm:0,lengthPerSizeCm:0}}
}

function report(project) { return inspectGradedNotchPairs(project) }
function has(report,code) { return report.issues.some(issue=>issue.code===code) }

test('disposable graded curved shell and lining preserve physical arclength station and source',()=>{
  const project=garment(),before=structuredClone(project),qa=report(project)
  const full=quadraticArcLength({x:0,y:0},{x:2,y:-6},{x:10,y:0})
  assert.equal(qa.status,'pass',JSON.stringify(qa.issues))
  assert.equal(qa.checks.length,2)
  assert(qa.checks.every(row=>Math.abs(row.fromStartAcm-full*.4)<1e-6&&row.offsetCm<1e-8))
  assert.equal(qa.factoryCertified,false)
  assert(project.pieces.every(piece=>inspectNotchArcPrecision(piece).status==='pass'))
  assert.deepEqual(project,before)
})

test('asymmetric curved paired notch drift is detected in both disposable grades',()=>{
  const project=garment()
  project.pieces[1].notches[0].t=.41
  const qa=report(project)
  const full=quadraticArcLength({x:0,y:0},{x:2,y:-6},{x:10,y:0})
  assert.equal(qa.status,'blocked')
  assert.equal(qa.checks.length,2)
  assert(qa.checks.every(row=>Math.abs(row.offsetCm-full*.01)<1e-6&&!row.pass))
  assert(qa.issues.every(issue=>issue.code==='NOTCH_SEAM_MISALIGNMENT'))
})

test('paired notches with absent IDs fail rather than matching undefined identifiers',()=>{
  const project=garment()
  for(const piece of project.pieces)delete piece.notches[0].id
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'INVALID_NOTCH_ID'))
  assert.equal(qa.factoryCertified,false)
})

test('duplicated notch IDs including unpaired manufacturing marks fail closed',()=>{
  const project=garment()
  project.pieces[0].notches.push({id:'shell-notch',edgeIndex:1,t:.2})
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'AMBIGUOUS_NOTCH_ID'))
})

test('identical invalid edge indices cannot yield zero-offset false acceptance',()=>{
  const project=garment()
  for(const piece of project.pieces)piece.notches[0].edgeIndex=-1
  project.seams[0].a.edgeIndex=-1
  project.seams[0].b.edgeIndex=-1
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'INVALID_NOTCH_EDGE'))
  assert.equal(qa.checks.length,0)
})

test('two coincident zero-length sewn edges cannot be considered aligned',()=>{
  const project=garment({curved:false})
  for(const piece of project.pieces)piece.points[1]={x:0,y:0}
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'INVALID_NOTCH_EDGE_GEOMETRY'))
  assert.equal(qa.checks.length,0)
})

test('malformed curved control geometry produces a blocker instead of throwing or passing',()=>{
  const project=garment()
  project.pieces[0].curves[0].cx=NaN
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'INVALID_NOTCH_EDGE_GEOMETRY'))
  assert.equal(qa.factoryCertified,false)
})

test('duplicate pattern piece identities block ambiguous graded notch lookup',()=>{
  const project=garment()
  project.pieces.push({...structuredClone(project.pieces[0]),notches:[]})
  const qa=report(project)
  assert.equal(qa.status,'blocked')
  assert(has(qa,'AMBIGUOUS_NOTCH_PIECE_ID'))
})

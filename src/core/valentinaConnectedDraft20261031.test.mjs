import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateValentinaConnectedDraft20261031 as draft, evaluateValentinaFormula20261031 as formula } from './valentinaConnectedDraft20261031.js'
import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'

const fixture = readFileSync(new URL('../../research/oss/pattern-cad/valentina-develop-fixtures/Basic_block_women-2016.val', import.meta.url),'utf8')
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`)
const at=(result,id)=>result.blocks[0].points.find(p=>p.id===String(id))

test('original Basic Block actual point ids produce directional, alongLine and normal geometry',()=>{
  const parsed=parseValentinaConstructionReference(fixture)
  const result=draft(parsed)
  near(at(result,1).x,0.79);near(at(result,1).y,1.06)
  near(at(result,2).x,0.79);near(at(result,2).y,-104.94)
  near(at(result,3).y,1.06-(92/10+11+1))
  near(at(result,4).y,1.06-(168/4-1))
  near(at(result,6).x,-1.21);near(at(result,6).y,at(result,4).y)
  assert.ok(result.blocks[0].order.indexOf('2')<result.blocks[0].order.indexOf('3'))
  assert.ok(result.diagnostics.some(d=>d.code==='UNSUPPORTED_TOOL'))
})

test('editing source increments and direct point formula propagates through original linked graph',()=>{
  const original=draft(fixture)
  const changed=draft(fixture,{increments:{'#L':'120','#BackCenterInTake':'5'}})
  near(at(changed,2).y,at(original,2).y-14)
  near(at(changed,6).x,at(original,6).x-3)
  near(at(changed,7).x,at(changed,6).x)
  const formulaChanged=draft(fixture,{formulaEdits:{'2':{length:'#L+5'}}})
  near(at(formulaChanged,2).y,at(original,2).y-5)
  near(at(formulaChanged,5).y,at(original,5).y)
})

test('numeric measurements can drive upstream source formulas',()=>{
  const text=fixture.replace('formula="92" name="#CG"','formula="bust_circ" name="#CG"')
  const smaller=draft(text,{measurements:{bust_circ:92}})
  const larger=draft(text,{measurements:{bust_circ:112}})
  near(at(larger,3).y,at(smaller,3).y-2)
  assert.ok(at(larger,10).x!==at(smaller,10).x)
})

test('cycle, unresolved tool and invalid expression failures are diagnosed and bounded',()=>{
  const base=parseValentinaConstructionReference(fixture)
  const selected=structuredClone(base)
  selected.blocks[0].nodes=selected.blocks[0].nodes.slice(0,6)
  selected.blocks[0].nodes[0].attributes.x='Line_Hemline_Neckline'
  const failure=draft(selected)
  assert.ok(failure.diagnostics.some(d=>d.code==='CYCLE'))
  assert.throws(()=>formula('2+globalThis.constructor',()=>0),/Unsupported|Trailing|unknown/i)
  assert.throws(()=>formula('1/0',()=>0),/out-of-bounds/)
  assert.throws(()=>draft(base,{maxPoints:0}),/budget/)
})

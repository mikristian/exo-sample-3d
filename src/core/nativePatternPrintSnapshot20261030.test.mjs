import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {selectNativePatternPrintSnapshot20261030 as select} from './nativePatternPrintSnapshot20261030.mjs'

const source = () => ({revision:7, template:{id:'garment-A',panels:[{id:'front',layout_rotation_degrees:90}]},
  panels:[{id:'front',layout:[0.1,0.2],boundaries:{outer:[0,1]}}],uv:[[0,0],[0.02,0]]})

test('immutable 2D millimetre DTO preserves revision and source identity without mutating Rust snapshot', () => {
  const input = source(), previous = structuredClone(input)
  const result = select(input)
  assert.deepEqual(result.linesMm, [[[100,200],[100,220]]])
  assert.equal(result.coordinateUnit,'mm')
  assert.equal(result.sourceCoordinateUnit,'m')
  assert.equal(result.cloth3DCoordinateUnit,'m')
  assert.equal(result.sourceRevision,7)
  assert.equal(result.sourceIdentity,'garment-A')
  assert.ok(Object.isFrozen(result.linesMm[0][0]))
  assert.throws(()=>result.linesMm[0][0].push(999), TypeError)
  assert.deepEqual(input, previous)
  input.uv[0][0]=500
  assert.equal(result.linesMm[0][0][0],100)
})

test('rejects absent/stale identity metadata and nonfinite pattern coordinates', () => {
  for(const mutate of [s=>{delete s.revision},s=>{s.revision=2.4},s=>{s.uv[1][0]=NaN},
    s=>{s.panels[0].boundaries.outer=[-1]},s=>{s.panels[0].layout=[Infinity,0]},
    s=>{s.template.panels=[]}]) {
    const input=source();mutate(input)
    assert.throws(()=>select(input))
  }
})

test('frontend print architecture gate shares the unit-aware selector across both export paths', () => {
  const component=readFileSync(new URL('../components/ClothCraftWorkspace.jsx',import.meta.url),'utf8')
  assert.match(component,/import \{selectNativePatternPrintSnapshot20261030\}/)
  assert.equal((component.match(/selectNativePatternPrintSnapshot20261030\(s\)/g)||[]).length,2)
  assert.doesNotMatch(component,/boardPoint\(s,index\)\.map\(n=>n\*1000\)/)
})

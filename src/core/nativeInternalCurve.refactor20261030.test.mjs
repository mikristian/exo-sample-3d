import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from './nativeInternalCurve.js'
import * as legacy from '../components/nativeInternalCurve.js'

test('component compatibility path exposes the identical core implementations', () => {
  assert.deepEqual(Object.keys(legacy).sort(), ['cubicPoint', 'initialInternalTangents', 'sampleInternalCurve'])
  for (const key of Object.keys(legacy)) assert.equal(legacy[key], core[key])
})

test('internal curve sampling preserves tangents, endpoint and invalid data handling', () => {
  assert.deepEqual(core.sampleInternalCurve([0,0],[2,0], [0,1],[0,1],4), [
    [0,0],[0.3125,0.28125],[1,0],[1.6875,-0.28125],[2,0]
  ])
  assert.deepEqual(core.sampleInternalCurve([1,2],[1,2]), [[1,2],[1,2]])
  assert.deepEqual(core.sampleInternalCurve([0,0],[1,1],[Number.NaN,0]), [])
  assert.deepEqual(core.initialInternalTangents([[0,0],[3,3],[9,3]]),
    [[1,1],[1.5,.5],[2,0]])
})

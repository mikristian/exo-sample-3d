import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'

test('factory marker rejects explicit fractional or out-of-range demand without changing source',()=>{
  for (const quantity of [0, 1.5, 100, -1, '2', NaN]) {
    const project=createTeeTemplate()
    project.pieces[0].cutQuantity=quantity
    const before=structuredClone(project)
    assert.throws(()=>buildFactoryPackageFiles(project),/Factory package refused: marker\/DXF physical CUT parity failed: INVALID_CUT_QUANTITY/)
    assert.deepEqual(project,before)
  }
})

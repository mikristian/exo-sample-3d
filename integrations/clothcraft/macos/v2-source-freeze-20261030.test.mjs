import test from 'node:test'
import assert from 'node:assert/strict'
import {fingerprintInputMap,compareInputFingerprints} from './v2-source-freeze-20261030.mjs'

test('content fence is deterministic irrespective of source inventory order',()=>{
  const first=fingerprintInputMap({'src/b.js':'export const b=2','src/a.js':'export const a=1'})
  const second=fingerprintInputMap({'src/a.js':'export const a=1','src/b.js':'export const b=2'})
  assert.equal(first.identity,second.identity)
  assert.deepEqual(compareInputFingerprints(first,second),{
    ok:true,code:'SOURCE_UNCHANGED',changed:[],
    referenceIdentity:first.identity,currentIdentity:second.identity,
  })
})

test('changed and newly introduced source files are reported',()=>{
  const start=fingerprintInputMap({'src/a.js':'export default 1'})
  const end=fingerprintInputMap({'src/a.js':'export default 2','src/new.js':'new code'})
  const result=compareInputFingerprints(start,end)
  assert.equal(result.ok,false)
  assert.deepEqual(result.changed,['src/a.js','src/new.js'])
})

test('removed source and a forged manifest identity are refused',()=>{
  const start=fingerprintInputMap({'src/a.js':'a','src/b.js':'b'})
  const end=fingerprintInputMap({'src/a.js':'a'})
  assert.deepEqual(compareInputFingerprints(start,end).changed,['src/b.js'])
  assert.equal(compareInputFingerprints({...start,identity:'0'.repeat(64)},start).code,
    'INVALID_SOURCE_FENCE')
})

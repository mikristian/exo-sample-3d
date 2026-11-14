import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nativeGradeStatusCommandV1,nativeGradeCutlinesCommandV1,
  nativeGradeActivateCommandV1,nativeGradeRestoreCommandV1,
} from './exoNativeGradeCommandV1.js'

test('typed grade requests match the native Rust JSON op and revision protocol',()=>{
  assert.deepEqual(nativeGradeActivateCommandV1(17,'XL'),
    {op:'grade-run-activate',revision:17,size:'XL'})
  assert.deepEqual(nativeGradeRestoreCommandV1(18),
    {op:'grade-run-restore',revision:18})
  assert.deepEqual(nativeGradeStatusCommandV1(0),
    {op:'grade-run-status',revision:0})
  assert.deepEqual(nativeGradeCutlinesCommandV1(0),
    {op:'grade-run-cutlines',revision:0})
  assert.equal(JSON.stringify(nativeGradeActivateCommandV1(0,'US16')),
    '{"op":"grade-run-activate","revision":0,"size":"US16"}')
})

test('requests reject unsafe revision or invalid size before crossing bridge',()=>{
  for(const revision of [-1,1.5,NaN,Infinity,2**53,undefined,'1']){
    assert.throws(()=>nativeGradeActivateCommandV1(revision,'XL'))
    assert.throws(()=>nativeGradeRestoreCommandV1(revision))
    assert.throws(()=>nativeGradeStatusCommandV1(revision))
  }
  for(const size of ['',null,12,'XL\u0000','a'.repeat(65)]){
    assert.throws(()=>nativeGradeActivateCommandV1(0,size))
  }
})

test('native command shapes are frozen and preserve exact input identity',()=>{
  const request=nativeGradeActivateCommandV1(3,'XS')
  assert.equal(Object.isFrozen(request),true)
  assert.equal(request.size,'XS')
  assert.equal(request.revision,3)
})

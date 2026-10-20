import test from 'node:test'
import assert from 'node:assert/strict'
import {samplePatternSewingGuideIndices as sample} from './patternSewingGuideSampling.js'

test('short and incomplete sewing guide collections preserve true endpoints',()=>{
  assert.deepEqual(sample(0),[])
  assert.deepEqual(sample(1),[0])
  assert.deepEqual(sample(2),[0,1])
  assert.deepEqual(sample(3),[0,1,2])
  assert.deepEqual(sample(10),Array.from({length:10},(_,i)=>i))
  for(const value of [-1,NaN,1.5,Infinity])assert.deepEqual(sample(value),[])
})

test('ambient guides are bounded, evenly spread and preserve terminal pairing',()=>{
  for(const count of [13,17,35,120,250]){
    const indices=sample(count)
    assert.equal(indices.length,12)
    assert.equal(indices[0],0)
    assert.equal(indices.at(-1),count-1)
    assert.equal(new Set(indices).size,indices.length)
    const gaps=indices.slice(1).map((n,i)=>n-indices[i])
    assert.ok(Math.max(...gaps)-Math.min(...gaps)<=1)
  }
})

test('highlighted guides retain more correspondence detail without repainting full dense seam',()=>{
  for(const count of [2,16,48,49,100,1000]){
    const indices=sample(count,{emphasized:true})
    assert.equal(indices.length,Math.min(count,48))
    assert.equal(indices[0],0)
    assert.equal(indices.at(-1),count-1)
    assert.ok(indices.every((index,i)=>Number.isInteger(index)&&index<count&&
      (i===0||index>indices[i-1])))
    assert.deepEqual(indices,sample(count,{emphasized:true}))
    assert.ok(indices.length>=sample(count).length)
  }
})

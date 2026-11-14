import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {evaluateValentina2DRequest20261031} from './valentinaEngineRoute20261031.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const dir=path.join(root,'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt')
const patternXml=fs.readFileSync(path.join(dir,'MaleShirt.val'),'utf8')
const measurementsXml=fs.readFileSync(path.join(dir,'MaleShirt.vit'),'utf8')
const trousersDir=path.join(root,'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/Trousers')

test('original Valentina MaleShirt via real executable yields changing source-based SVG',()=>{
  const one=evaluateValentina2DRequest20261031({patternXml,measurementsXml,format:'svg'})
  assert.equal(one.ok,true,one.reason)
  assert.equal(one.originEngine,'Valentina')
  assert.equal(one.engine,'Seamly2D')
  assert.equal(one.calculation,'original-seamly-executable-verified-valentina-source')
  assert.equal(one.manufacturingApproved,false)
  assert.equal(one.artifacts.length,1)
  assert.match(one.artifacts[0].content,/<svg\b/)
  const changed=measurementsXml.replace('name="bust_circ" value="102"','name="bust_circ" value="110"')
  const two=evaluateValentina2DRequest20261031({patternXml,measurementsXml:changed,format:'svg'})
  assert.equal(two.ok,true,two.reason)
  assert.notEqual(one.artifacts[0].sha256,two.artifacts[0].sha256)
  assert.notEqual(one.measurementsSha256,two.measurementsSha256)
})

test('original upstream Valentina MaleShirt DXF is a locally inspectable CUT draft',()=>{
  const r=evaluateValentina2DRequest20261031({patternXml,measurementsXml,format:'aama-r10',sourceUnit:'cm'})
  assert.equal(r.ok,true,r.reason)
  assert.equal(r.manufacturingApproved,false)
  assert.equal(r.artifacts.length,1)
  assert.ok(r.artifacts[0].name.endsWith('.dxf'))
  assert.match(r.artifacts[0].content,/SECTION\s*\n\s*2\s*\nENTITIES/)
  assert.ok(r.artifacts[0].localInspection.sourceCutPieces>0)
  assert.equal(r.artifacts[0].localInspection.externalReceivingCadApproved,false)
})

test('original Valentina Trousers plus authentic waist measurement produces upstream SVG geometry',()=>{
  const original=fs.readFileSync(path.join(trousersDir,'Trousers.val'),'utf8')
  const vit=fs.readFileSync(path.join(trousersDir,'trousers.vit'),'utf8')
  const result=evaluateValentina2DRequest20261031({patternXml:original,measurementsXml:vit,format:'svg'})
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.manufacturingApproved,false)
  assert.match(result.sourceMapping,/Trousers/)
  assert.ok(result.artifacts[0].sizeBytes>1000)
  const changed=vit.replace('name="waist_circ" value="84"','name="waist_circ" value="90"')
  const revised=evaluateValentina2DRequest20261031({patternXml:original,measurementsXml:changed,format:'svg'})
  assert.equal(revised.ok,true,revised.reason)
  assert.notEqual(revised.artifacts[0].sha256,result.artifacts[0].sha256)
})

test('unknown Valentina source, forged request, malformed measurement and undeclared DXF units fail',()=>{
  const cases=[
    {patternXml:patternXml.replace('MaleShirt.vit','different.vit'),measurementsXml,format:'svg'},
    {patternXml,measurementsXml:'<!DOCTYPE vit><vit/>',format:'svg'},
    {patternXml,measurementsXml,format:'aama-r10'},
    {patternXml,measurementsXml,format:'svg',extraSourcePath:'/etc/passwd'},
  ]
  for(const value of cases){
    const result=evaluateValentina2DRequest20261031(value)
    assert.equal(result.ok,false,JSON.stringify(result))
    assert.equal(result.manufacturingApproved,false)
  }
})

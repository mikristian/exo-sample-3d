import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyExoImportFile20261101 as classify,verifyExoPdfReference20261101 as verify} from './exoFileImportFormats20261101.js'

test('format routing clearly separates editable patterns and source references',()=>{
  assert.equal(classify('tech.ai').kind,'needs-conversion')
  assert.equal(classify('tech.PDF').editable,false)
  assert.equal(classify('pattern.SVG').editable,true)
  assert.equal(classify('pattern.dxf').kind,'pattern')
  assert.equal(classify('avatar.OBJ').kind,'mesh-reference')
  assert.equal(classify('avatar.glb').editable,false)
  assert.equal(classify('unknown.exe'),null)
})
test('PDF reference intake refuses invalid, truncated and oversized sources',()=>{
  const pdf=new TextEncoder().encode('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n')
  assert.equal(verify(pdf).referenceOnly,true)
  assert.equal(verify(pdf).editable,false)
  assert.throws(()=>verify(new Uint8Array([37,80,68,70])),/between/)
  assert.throws(()=>verify(new TextEncoder().encode('not a PDF document and no end %%EOF')),/header/)
  assert.throws(()=>verify(new TextEncoder().encode('%PDF-1.7\nnot complete')), /incomplete/)
  assert.throws(()=>verify(new Uint8Array(12*1024*1024+1)),/between/)
})

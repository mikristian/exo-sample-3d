import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {strFromU8,unzipSync,zipSync} from 'fflate'
import {buildTechPackHandoff20261031,inspectTechPackHandoffZip20261031} from './techPackFactoryPackage20261031.js'
import {createNikeTshirtExampleTechPack} from './techPackNikeTshirtExample20261031.js'
import {techPackSource} from './techPackWorkspaceModel.js'
const saved=JSON.parse(fs.readFileSync(new URL('../../public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json',import.meta.url)))
const sample=createNikeTshirtExampleTechPack({orientation:'portrait',paperSize:'Letter'},saved,{
 render:'data:image/webp;base64,AAAAAA==',
 logo:'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'})
const source=techPackSource(null,saved,true)
const draft={...sample.draftPatch,workspace:sample.workspace}
test('one-click draft ZIP contains 16-page HTML, actual editable XLSX and evidence inventory, never fake DXF or approval',()=>{
 const p=buildTechPackHandoff20261031({source,draft,workspace:sample.workspace,assets:sample.workspace.assets})
 assert.match(p.filename,/draft-review\.zip$/)
 assert.equal(p.patternCount,0)
 assert.equal(p.manifest.status,'draft-for-review')
 assert.equal(p.manifest.manufacturingApproved,false)
 const {files,manifest}=inspectTechPackHandoffZip20261031(p.zip)
 assert.equal(manifest.printPages,16)
 assert.ok(files['documents/editable-specifications.xlsx'])
 assert.ok(files['documents/editable-techpack.json'])
 assert.ok(files['documents/techpack-print.html'])
 assert.ok(files['documents/SAVE-PRINT-TO-PDF.txt'])
 assert.ok(files['references/asset-001.webp'])
 assert.ok(!Object.keys(files).some(path=>path.endsWith('.dxf')||path.endsWith('.pdf')))
 assert.match(strFromU8(files['documents/techpack-print.html']),/STYLE OVERVIEW/)
 assert.match(strFromU8(files['review/source-and-release-status.json']),/draft-for-review/)
 assert.equal(JSON.parse(strFromU8(files['documents/editable-techpack.json'])).workspace.pageOrder.length,16)
})
test('production release or unsupported DXF fails closed, without altering source',()=>{
 const prior=JSON.stringify(saved)
 const base={source,draft,workspace:sample.workspace,assets:sample.workspace.assets}
 assert.throws(()=>buildTechPackHandoff20261031({...base,release:true,releaseEvidence:{status:'released',verified:true,releaseId:'x',sourceRevision:String(source.revision)}}),/Factory RELEASE blocked/)
 assert.throws(()=>buildTechPackHandoff20261031({...base,includeVerifiedPatterns:true,project:{}}),/No verified manufacturing DXF available/)
 assert.throws(()=>buildTechPackHandoff20261031({...base,approvedPdf:new Uint8Array([1,2,3])}),/valid PDF/)
 assert.equal(JSON.stringify(saved),prior)
})
test('tampered ZIP file bytes are rejected using the manifest hashes',()=>{
 const bundle=buildTechPackHandoff20261031({source,draft,workspace:sample.workspace,assets:[]})
 const files=unzipSync(bundle.zip)
 files['documents/SAVE-PRINT-TO-PDF.txt']=new TextEncoder().encode('altered')
 assert.throws(()=>inspectTechPackHandoffZip20261031(zipSync(files)),/integrity failure/)
})
test('oversized compressible ZIP and path traversal are refused before extraction',()=>{
 const bomb=zipSync({'repeated.bin':new Uint8Array(12_000_001)},{level:6})
 assert.throws(()=>inspectTechPackHandoffZip20261031(bomb),/expansion|limit/)
 const traversal=zipSync({'../outside.txt':new TextEncoder().encode('x')})
 assert.throws(()=>inspectTechPackHandoffZip20261031(traversal),/entry name/)
})

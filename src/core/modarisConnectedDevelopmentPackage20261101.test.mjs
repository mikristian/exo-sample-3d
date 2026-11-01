import test from 'node:test'
import assert from 'node:assert/strict'
import {strFromU8,unzipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade} from './modarisSizeLinkedGrade20261027.js'
import {buildSizeRun} from './grading.js'
import {connectedSourceToManufacturingDxf} from './dxf.js'
import {sha256Bytes} from './sha256Bytes.js'
import {buildModarisConnectedDevelopmentFiles20261101,buildModarisConnectedDevelopmentZip20261101} from './modarisConnectedDevelopmentPackage20261101.js'

const sizes=['S','M','L']
const rule={mode:'small-large-incremental',sizes,baseSize:'M',steps:[{dx:.1,dy:0},{dx:.1,dy:0}]}
function linked(){
 const project=createTeeTemplate()
 const piece=id=>({...structuredClone(project.pieces[0]),id,name:id,
   points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,industrialGradeRule:structuredClone(rule)})),
   curves:{0:{cx:10,cy:-4}},edgeNames:['neck','side','hem','fold'],notches:[],internalLines:[],
   edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
 project.pieces=[piece('front'),piece('back')]
 project.seams=[];project.customMeasurements=[];project.grading={sizes,baseSize:'M'}
 return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},
   target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}

const json=(files,path)=>JSON.parse(strFromU8(files[path]))
test('connected archive preserves source, final linked grades, DXF bytes, marker PDF/SVG and verified hashes',()=>{
 const source=linked(),before=structuredClone(source)
 const files=buildModarisConnectedDevelopmentFiles20261101(source)
 const manifest=json(files,'manifest.json')
 assert.equal(manifest.factoryCertified,false)
 assert.deepEqual(manifest.files,Object.keys(files).sort())
 for(const [name,bytes] of Object.entries(files)){
  assert.ok(bytes instanceof Uint8Array,`invalid archive bytes: ${name}`)
  if(name!=='manifest.json')assert.equal(manifest.sha256[name],sha256Bytes(bytes),`checksum ${name}`)
 }
 assert.deepEqual(json(files,'source/garment-source.json'),source)
 assert.deepEqual(json(files,'source/linked-size-run.json'),buildSizeRun(source))
 assert.equal(json(files,'review-status.json').factoryCertified,false)
 assert.equal(json(files,'review-status.json').releaseStatus,'NOT_APPROVED_FOR_CUTTING_OR_BULK_PRODUCTION')
 assert.equal(json(files,'qa/marker-dxf-parity.json').ok,true)
 assert.equal(json(files,'qa/marker-plot-parity.json').ok,true)
 for(const size of sizes){
  assert.equal(strFromU8(files[`patterns/${size}.dxf`]),connectedSourceToManufacturingDxf(source,size))
  assert.match(strFromU8(files[`markers/${size}/main.svg`]),/<svg/)
  assert.match(strFromU8(files[`markers/${size}/main.pdf`]),/^%PDF/)
  assert.equal(json(files,'qa/industrial.json').factoryCertified,false)
 }
 const zipped=unzipSync(buildModarisConnectedDevelopmentZip20261101(source))
 assert.deepEqual(Object.keys(zipped).sort(),Object.keys(files).sort())
 for(const path of Object.keys(files))assert.deepEqual(zipped[path],files[path],`ZIP contents ${path}`)
 assert.deepEqual(source,before)
})

test('stale graph, reference-only source, unsafe names and invalid cut quantities all refuse development ZIP',()=>{
 const source=linked()
 const stale=structuredClone(source);stale.modarisSizeLinkedGrade.links[0].sourceBase.x++
 assert.throws(()=>buildModarisConnectedDevelopmentZip20261101(stale),/stale|source|grade/i)
 const reference=structuredClone(source);reference.patternSource={referenceOnly:true}
 assert.throws(()=>buildModarisConnectedDevelopmentZip20261101(reference),/reference-only/i)
 const unsafe=structuredClone(source);unsafe.grading.sizes[0]='../../evil'
 assert.throws(()=>buildModarisConnectedDevelopmentZip20261101(unsafe),/stale|size|source|grade/i)
 const quantity=structuredClone(source);quantity.pieces[0].cutQuantity=1.25
 assert.throws(()=>buildModarisConnectedDevelopmentZip20261101(quantity),/quantity|marker|refused/i)
})

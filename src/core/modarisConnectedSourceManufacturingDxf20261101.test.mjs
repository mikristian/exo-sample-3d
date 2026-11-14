import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade} from './modarisSizeLinkedGrade20261027.js'
import {buildSizeRun,gradeProject} from './grading.js'
import {connectedSourceToManufacturingDxf,projectToDxf} from './dxf.js'

const sizes=['XS','S','M','L','XL','XXL']
const rule={mode:'small-large-incremental',sizes,baseSize:'M',steps:sizes.slice(1).map((_,i)=>({dx:.2+i*.05,dy:.04}))}
function linked(){
 const project=createTeeTemplate()
 const piece=id=>({...structuredClone(project.pieces[0]),id,name:id,
  points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,industrialGradeRule:structuredClone(rule)})),
  curves:{0:{cx:10,cy:-4}},edgeNames:['neck','side','hem','fold'],
  notches:[],internalLines:[],edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
 project.pieces=[piece('front'),piece('back')]
 project.seams=[];project.grading={sizes,baseSize:'M'};project.customMeasurements=[]
 return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}
test('source-pinned final graph produces six matching CUT/STITCH DXFs without mutating source',()=>{
 const source=linked(),before=structuredClone(source),run=buildSizeRun(source)
 for(const size of sizes){
  const final=structuredClone(run[size]);delete final.modarisSizeLinkedGrade
  const expected=projectToDxf(final,size,{cutlineMode:'manufacturing',requireGradedGeometry:true})
  const actual=connectedSourceToManufacturingDxf(source,size)
  assert.equal(actual,expected)
  assert.match(actual,/CUT_BACK/)
  assert.match(actual,/STITCH_BACK/)
 }
 assert.deepEqual(source,before)
})
test('invalid connected source or detached grades cannot bypass production gate',()=>{
 const project=linked(),ordinary=gradeProject(project,'XXL')
 assert.throws(()=>projectToDxf(ordinary,'XXL',{cutlineMode:'manufacturing'}),/refused.*linked/i)
 assert.throws(()=>connectedSourceToManufacturingDxf(ordinary,'XXL'),/stale|source|grade/i)
 assert.throws(()=>connectedSourceToManufacturingDxf(project,'NOT_A_SIZE'),/unknown linked size/i)
 const tampered=structuredClone(project);tampered.modarisSizeLinkedGrade.links[0].sourceBase.x++
 assert.throws(()=>connectedSourceToManufacturingDxf(tampered,'XXL'),/stale|source|linked/i)
})

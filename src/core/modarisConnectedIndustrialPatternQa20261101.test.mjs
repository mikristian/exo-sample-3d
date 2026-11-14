import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade} from './modarisSizeLinkedGrade20261027.js'
import {buildSizeRun,gradeProject} from './grading.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {edgeRangeLength} from './project.js'

const sizes=['XS','S','M','L','XL','XXL']
const rule=(factor)=>({mode:'small-large-incremental',sizes,baseSize:'M',steps:
 [0.1,0.2,0.3,0.5,0.8].map(step=>({dx:step*factor,dy:step*.1*factor}))})
function fixture(){
 const project=createTeeTemplate()
 const piece=(id,first,other)=>({...structuredClone(project.pieces[0]),id,name:id,
  points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,
    industrialGradeRule:rule(i===0?first:other)})),
  curves:{0:{cx:10,cy:-4}},edgeNames:['neck','side','hem','fold'],
  notches:[],internalLines:[],edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
 project.pieces=[piece('front',4,3),piece('back',.5,.2)]
 project.seams=[{id:'neck-join',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:0}}]
 project.grading={sizes,baseSize:'M'}
 project.customMeasurements=[]
 return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},
  target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}

test('connected seam audit uses final linked curves, not ordinary graded target',()=>{
 const source=fixture(),original=structuredClone(source),run=buildSizeRun(source)
 const expected=run.XXL
 const finalB=expected.pieces.find(piece=>piece.id==='back')
 const ordinaryB=gradeProject(source,'XXL').pieces.find(piece=>piece.id==='back')
 const finalLength=edgeRangeLength(finalB,0,0,1)
 const ordinaryLength=edgeRangeLength(ordinaryB,0,0,1)
 assert.ok(Math.abs(finalLength-ordinaryLength)>1e-6,'fixture must distinguish connected versus ordinary seam length')
 const report=inspectIndustrialPatterns(source)
 const row=report.seamReports.find(row=>row.size==='XXL'&&row.seamId==='neck-join')
 assert.ok(row,'connected XXL seam must be audited')
 assert.ok(Math.abs(row.lengthB-finalLength)<1e-8,'seam report must use final linked target curve')
 assert.ok(Math.abs(row.lengthB-ordinaryLength)>1e-6)
 assert.deepEqual(source,original)
 assert.equal(report.factoryCertified,false)
})

test('stale connected graph yields blocked seam/POM audit rather than generic pass',()=>{
 const source=fixture()
 source.modarisSizeLinkedGrade.links[0].sourceBase.x+=1
 const before=structuredClone(source)
 const report=inspectIndustrialPatterns(source)
 assert.equal(report.status,'blocked')
 assert.ok(report.issues.some(issue=>issue.code==='GRADE_FAILURE'&&/Authoritative|stale/i.test(issue.message)))
 assert.equal(report.factoryCertified,false)
 assert.deepEqual(source,before)
})

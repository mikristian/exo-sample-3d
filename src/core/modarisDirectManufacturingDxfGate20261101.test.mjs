import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade} from './modarisSizeLinkedGrade20261027.js'
import {gradeProject,buildSizeRun} from './grading.js'
import {projectToDxf} from './dxf.js'

const sizes=['XS','S','M','L','XL','XXL']
const steps=[.15,.22,.33,.58,.92]
const rule=factor=>({mode:'small-large-incremental',sizes,baseSize:'M',
 steps:steps.map(step=>({dx:step*factor,dy:step*.2*factor}))})
function source(){
 const project=createTeeTemplate()
 const piece=(id,first,rest)=>({...structuredClone(project.pieces[0]),id,name:id,
  points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,
   industrialGradeRule:rule(i===0?first:rest)})),curves:{0:{cx:10,cy:-4}},
  edgeNames:['neck','side','hem','fold'],notches:[],internalLines:[],
  edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
 project.pieces=[piece('front',4,3),piece('back',.5,.2)]
 project.seams=[]
 project.grading={sizes,baseSize:'M'}
 project.customMeasurements=[]
 return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},
  target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}
const manufacturing=(project,size)=>projectToDxf(project,size,
 {cutlineMode:'manufacturing',requireGradedGeometry:true})

test('direct manufacturing DXF rejects stale saved connected graph',()=>{
 const project=source()
 project.modarisSizeLinkedGrade.links[0].sourceBase.x+=1
 const before=structuredClone(project)
 assert.throws(()=>manufacturing(gradeProject(project,'XXL'),'XXL'),/refused.*linked/i)
 assert.deepEqual(project,before)
})

test('direct manufacturing DXF rejects ordinary grade that omits final linked controls',()=>{
 const project=source()
 const ordinary=gradeProject(project,'XXL'),final=buildSizeRun(project).XXL
 assert.ok(Math.hypot(ordinary.pieces[1].curves[0].cx-final.pieces[1].curves[0].cx,
   ordinary.pieces[1].curves[0].cy-final.pieces[1].curves[0].cy)*10>30)
 assert.throws(()=>manufacturing(ordinary,'XXL'),/refused.*linked/i)
})

test('unlinked physical manufacturing DXF remains usable',()=>{
 const project=createTeeTemplate(),graded=gradeProject(project,'M')
 assert.match(manufacturing(graded,'M'),/EOF/)
})

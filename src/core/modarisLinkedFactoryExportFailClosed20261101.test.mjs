import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade,buildModarisSizeLinkedGradeRun} from './modarisSizeLinkedGrade20261027.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {buildSizeRun} from './grading.js'

const sizes=['XS','S','M','L','XL','XXL']
const rule={mode:'small-large-incremental',sizes,baseSize:'M',steps:[
 {dx:.2,dy:.02},{dx:.2,dy:.02},{dx:.2,dy:.02},{dx:.2,dy:.02},{dx:.2,dy:.02}]}

function linked(){
 const project=createTeeTemplate()
 const piece=(id)=>({...structuredClone(project.pieces[0]),id,name:id,
  points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,
    industrialGradeRule:structuredClone(rule)})),
  curves:{0:{cx:10,cy:-4}},edgeNames:['neck','side','hem','fold'],
  notches:[],internalLines:[],edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
 project.pieces=[piece('front'),piece('back')]
 project.seams=[]
 project.grading={sizes:[...sizes],baseSize:'M'}
 project.customMeasurements=[]
 return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},
   target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}

test('connected final curve source cannot silently export generic factory DXF/size-run',()=>{
 const project=linked(),before=structuredClone(project)
 assert.throws(()=>buildFactoryPackageFiles(project),/connected Modaris linked grade.*no authoritative manufacturing export path/)
 assert.deepEqual(project,before)
})

test('stale linked source is refused without mutating the authored graph',()=>{
 const project=linked()
 project.modarisSizeLinkedGrade.links[0].sourceBase.x+=1
 const before=structuredClone(project)
 assert.throws(()=>buildFactoryPackageFiles(project),/stale|source|linked|grade/i)
 assert.deepEqual(project,before)
})

test('shared size-run produces exactly the saved graph final linked geometry',()=>{
 const project=linked(),before=structuredClone(project)
 const expected=buildModarisSizeLinkedGradeRun(project).run
 assert.deepEqual(buildSizeRun(project),expected)
 assert.deepEqual(project,before)
})

test('shared size-run rejects stale linked provenance without mutation',()=>{
 const project=linked()
 project.modarisSizeLinkedGrade.links[0].sourceBase.x+=1
 const before=structuredClone(project)
 assert.throws(()=>buildSizeRun(project),/stale|source|linked|grade/i)
 assert.deepEqual(project,before)
})

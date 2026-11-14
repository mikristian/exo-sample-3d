import test from 'node:test'
import assert from 'node:assert/strict'
import {createModarisSizeLinkedGrade as create,reapplyModarisSizeLinkedGrade as reapply,buildModarisSizeLinkedGradeRun as build} from './modarisSizeLinkedGrade20261027.js'
import {assertFreshModarisSizeLinkedGradeProject20261027 as admit} from './modarisSizeLinkedGradePersistence20261027.js'
import {applyModarisSizeLinkedGradeMutation as mutate} from './modarisSizeLinkedGradeMutation20261027.js'
const sizes=['XS','S','M','L','XL','XXL']
const rule=n=>({mode:'small-large-incremental',sizes,baseSize:'M',steps:[.2,.4,.8,1.2,1.5].map(dx=>({dx:dx*n,dy:.1}))})
function fixture(){return {units:'cm',grading:{sizes,baseSize:'M'},pieces:['A','B','C'].map((id,k)=>({id,name:id,points:[[0,0],[20,0],[20,16+k*5],[0,16+k*5]].map(([x,y],i)=>({id:'p'+i,x,y,industrialGradeRule:rule(k+1)})),curves:{0:{cx:10,cy:-4}},edgeNames:['top','side','bottom','fold'],seamAllowance:1}))}}
const link=(a,b,point=0,curves=true,axis='both')=>({source:{pieceId:a,pointIndex:point},target:{pieceId:b,pointIndex:point},curves,axis})
for(const [name,change] of [
 ['partial-axis curve',p=>{p.modarisSizeLinkedGrade.links[0].curves=true}],
 ['mismatched curve edge',p=>{p.modarisSizeLinkedGrade.links[0].curves=true;p.pieces[1].curves={1:{cx:10,cy:-4}};p.modarisSizeLinkedGrade.links[0].targetTopology.curveEdges=['1']}],
 ['nonboolean curve',p=>{p.modarisSizeLinkedGrade.links[0].curves='false'}],
 ['invalid original rule',p=>{p.modarisSizeLinkedGrade.links[0].targetRule.steps[0].dx=999}],
])test('all graph entry points reject '+name+' without partial mutation',()=>{
 const p=create(fixture(),[link('A','B',0,false,name==='partial-axis curve'?'x':'both')]).project
 change(p)
 for(const action of [admit,reapply,build,x=>mutate(x,{...structuredClone(x),notes:'edit'})]){
  const before=structuredClone(p);assert.throws(()=>action(p));assert.deepEqual(p,before)
 }
})
test('creator refuses nonboolean curve flag rather than coercing strings',()=>assert.throws(()=>create(fixture(),[{...link('A','B'),curves:'false'}])))
test('multi-hop curve and point propagation is independent of link serialization across six sizes',()=>{
 const defs=[link('A','B'),link('B','C')]
 const a=create(fixture(),defs).project,b=create(fixture(),[...defs].reverse()).project
 for (const size of sizes) assert.deepEqual(build(a).run[size].pieces,build(b).run[size].pieces)
 for(const value of [2,3]){
  const before=structuredClone(a),draft=structuredClone(a);draft.pieces[0].points[0].industrialGradeRule=rule(value)
  const next=mutate(a,draft).project
  assert.deepEqual(a,before)
  assert.deepEqual(admit(JSON.parse(JSON.stringify(next))),next)
  const run=build(next).run
  for(const size of sizes){
   assert.deepEqual(run[size].pieces[0].curves,run[size].pieces[2].curves)
   assert.equal(run[size].pieces[0].points[0].x,run[size].pieces[2].points[0].x)
  }
  Object.assign(a,next)
 }
})
test('point-only links allow different curve inventories and opposite independent references',()=>{
 const p=fixture();p.pieces[1].curves={1:{cx:25,cy:8}}
 const next=create(p,[link('A','B',0,false),link('B','A',1,false)]).project
 assert.equal(Object.keys(build(admit(JSON.parse(JSON.stringify(next)))).run).length,6)
})

test('creation rejects unsafe original target snapshots before storing a graph',()=>{
 const p=fixture();p.pieces[1].points[0].industrialGradeRule=rule(999)
 const before=structuredClone(p);assert.throws(()=>create(p,[link('A','B')]),/unsafe saved target/);assert.deepEqual(p,before)
})

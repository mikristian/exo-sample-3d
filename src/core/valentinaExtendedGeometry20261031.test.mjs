import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateValentinaExtendedGeometry20261031, intersectValentinaLines20261031,
  projectValentinaPoint20261031, intersectValentinaCircles20261031, valentinaBisector20261031 } from './valentinaExtendedGeometry20261031.js'
import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'

test('line geometry, projection, circle intersections and degeneracy', () => {
  assert.deepEqual(intersectValentinaLines20261031({x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}),{x:2,y:2})
  assert.deepEqual(projectValentinaPoint20261031({x:4,y:5},{x:0,y:0},{x:6,y:0}),{x:4,y:0})
  assert.deepEqual(intersectValentinaCircles20261031({x:0,y:0},5,{x:8,y:0},5,1),{x:4,y:3})
  assert.deepEqual(intersectValentinaCircles20261031({x:0,y:0},5,{x:8,y:0},5,2),{x:4,y:-3})
  assert.throws(() => intersectValentinaLines20261031({x:0,y:0},{x:1,y:0},{x:0,y:2},{x:1,y:2}), /parallel/)
  assert.throws(() => projectValentinaPoint20261031({x:0,y:0},{x:1,y:1},{x:1,y:1}), /Degenerate/)
  assert.throws(() => intersectValentinaCircles20261031({x:0,y:0},1,{x:4,y:0},1), /do not intersect/)
})

const node = (id, type, attributes, name) => ({id:String(id),family:'point',type,name:name || 'P'+id,attributes:Object.fromEntries(Object.entries(attributes).map(([k,v])=>[k,String(v)]))})
const draft = {format:'exo-valentina-construction-reference.v1',unit:'cm', increments:[],blocks:[{
  id:'draw-1',name:'Test',nodes:[
    node(1,'single',{x:0,y:0},'A'),node(2,'single',{x:10,y:0},'B'),
    node(3,'single',{x:5,y:-5},'C'),node(4,'single',{x:5,y:5},'D'),
    node(5,'lineIntersect',{p1Line1:1,p2Line1:2,p1Line2:3,p2Line2:4},'Center'),
    node(6,'height',{basePoint:4,p1Line:1,p2Line:2},'Foot'),
    node(7,'alongLine',{firstPoint:5,secondPoint:2,length:2},'Dependent'),
    node(8,'pointOfIntersectionCircles',{c1Center:1,c1Radius:5,c2Center:2,c2Radius:5,crossPoint:1},'Circle'),
  ],
}]}

test('extended nodes feed existing downstream Valentina tools and propagate formula edits', () => {
  const before = evaluateValentinaExtendedGeometry20261031(draft)
  assert.equal(before.resolvedExtendedPointCount, 3)
  const pts = new Map(before.blocks[0].points.map(p=>[p.id,p]))
  assert.equal(pts.get('5').x,5)
  assert.equal(pts.get('6').y,0)
  assert.equal(pts.get('7').x,7)
  assert.equal(pts.get('8').x,5)
  const after = evaluateValentinaExtendedGeometry20261031(draft,{formulaEdits:{'2':{x:'9'}}})
  const changed = new Map(after.blocks[0].points.map(p=>[p.id,p]))
  assert.equal(changed.get('7').x,7)
  assert.equal(changed.get('8').x,4.5)
  assert.ok(changed.get('8').y > 0)
})

test('original Valentina fixture exposes supported extended nodes', () => {
  const path = new URL('../../research/oss/pattern-cad/valentina-develop-fixtures/Basic_block_women-2016.val', import.meta.url)
  const source = parseValentinaConstructionReference(readFileSync(path,'utf8'))
  assert.ok(source.blocks.some(b=>b.nodes.some(n=>n.type==='pointOfIntersectionCircles')))
  const draft = evaluateValentinaExtendedGeometry20261031(source)
  const circle = draft.blocks.flatMap(b=>b.points).find(p=>p.id==='39')
  // Reproducible numeric regression for actual source node A34. This fixes
  // our interpretation of original formulas; it is not an engine parity oracle.
  assert.ok(Math.abs(circle.x - (-19.81447158163143)) < 1e-7)
  assert.ok(Math.abs(circle.y - (-4.2561736503201635)) < 1e-7)
  assert.equal(draft.resolvedExtendedPointCount,1)
})

test('Valentina bisector geometry and graph propagation', () => {
  const origin={x:0,y:0}
  assert.deepEqual(valentinaBisector20261031({x:4,y:0},origin,{x:0,y:4},Math.sqrt(2)),{x:1,y:1})
  assert.throws(()=>valentinaBisector20261031({x:1,y:0},origin,{x:-1,y:0},5),/Opposite/)
  const input={format:'exo-valentina-construction-reference.v1',unit:'cm',increments:[],blocks:[{
    id:'draw-1',name:'Bisector',nodes:[node(1,'single',{x:4,y:0}),node(2,'single',{x:0,y:0}),
      node(3,'single',{x:0,y:4}),node(4,'bisector',{firstPoint:1,secondPoint:2,thirdPoint:3,length:Math.sqrt(2)}),
      node(5,'endLine',{basePoint:4,angle:0,length:2})]
  }]}
  const first = evaluateValentinaExtendedGeometry20261031(input)
  assert.equal(first.blocks[0].points.find(p=>p.id==='5').x,3)
  const edited = evaluateValentinaExtendedGeometry20261031(input,{formulaEdits:{'4':{length:String(2*Math.sqrt(2))}}})
  assert.equal(edited.blocks[0].points.find(p=>p.id==='5').x,4)
})

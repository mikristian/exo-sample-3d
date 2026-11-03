import test from 'node:test'
import assert from 'node:assert/strict'
import {buildExoFashionProductDevelopment20261102 as build} from './exoFashionProductDevelopment20261102.js'

const project = () => ({
  pieces:[{id:'front',name:'Front',fabricId:'main',cutQuantity:1,points:[
    {x:0,y:0},{x:40,y:0},{x:40,y:60},{x:0,y:60}
  ]}],
  grading:{baseSize:'M',sizes:['M']}, seams:[],
})

test('uses native geometry and marker for cost, does not mutate source project', () => {
  const garment = project()
  const before = JSON.stringify(garment)
  const result = build({project:garment,retailPrice:90,orderQuantity:50,
    fabricWidthsCm:{main:150},fabricCostPerMeter:{main:12},
    materials:[{id:'label',name:'Woven label',unit:'each',quantityPerUnit:2,costPerUnit:.5}],
    laborCostPerUnit:8,otherCostPerUnit:3})
  assert.equal(JSON.stringify(garment),before)
  assert.equal(result.geometry.pieceCount,1)
  assert.equal(result.markers[0].complete,true)
  assert.equal(result.markers[0].lengthMeters,.6)
  assert.equal(result.costing.totalCostPerUnit,19.2)
  assert.equal(result.costing.grossMarginPerUnit,70.8)
  assert.equal(result.costing.orderCost,960)
  assert.equal(result.handoff.approvedForCutting,false)
})

test('missing prices yield unknown totals rather than zero-cost profit', () => {
  const result = build({project:project(), retailPrice:80})
  assert.equal(result.costing.totalCostPerUnit,null)
  assert.equal(result.costing.grossMarginPercent,null)
  assert.ok(result.costing.missingCosts.includes('fabric:main'))
  assert.ok(result.costing.missingCosts.includes('labor'))
})

test('rejects malformed BOM, nonfinite prices and oversized marker demand', () => {
  const invalid = project()
  invalid.pieces[0].cutQuantity=501
  const result=build({project:invalid,retailPrice:Infinity,
    fabricWidthsCm:{main:150},materials:[{id:'x',name:'Zip',unit:'each',quantityPerUnit:1,costPerUnit:-5}]})
  assert.equal(result.ok,false)
  assert.ok(result.blockers.some(i=>i.code==='INVALID_BOM_ROW'))
  assert.ok(result.blockers.some(i=>i.code==='INVALID_RETAIL_PRICE'))
  assert.ok(result.blockers.some(i=>i.code==='MARKER_DEMAND_LIMIT'))
  assert.equal(result.markers.length,0)
})

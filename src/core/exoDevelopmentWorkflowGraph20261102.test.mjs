import test from 'node:test'
import assert from 'node:assert/strict'
import {buildExoDevelopmentWorkflowGraph20261102} from './exoDevelopmentWorkflowGraph20261102.js'

test('workflow reports missing evidence and explicitly retains production review',()=>{
  const graph=buildExoDevelopmentWorkflowGraph20261102({pieces:[]},{generatedAt:'2026-11-02T00:00:00.000Z'})
  assert.equal(graph.nodes.length,6)
  assert.equal(graph.nodes.find(node=>node.id==='pattern').status,'missing')
  assert.equal(graph.nodes.find(node=>node.id==='techpack').status,'missing')
  assert.equal(graph.nodes.find(node=>node.id==='cost').status,'incomplete')
  assert.equal(graph.productionApproved,false)
  assert.deepEqual(graph.nodes.find(node=>node.id==='qa').dependsOn,['cost','techpack'])
})

test('workflow preserves native blocker evidence instead of claiming approval',()=>{
  const report={
    blockers:[{scope:'geometry',code:'BAD_PATTERN',message:'Invalid geometry'}],
    warnings:[],bom:[{costPerUnit:4}],geometry:{pieceCount:1,QA:{status:'fail'}},
    costing:{currency:'USD',totalCostPerUnit:null,missingCosts:['labor']},
    handoff:{checklist:[{complete:false}]},
  }
  const graph=buildExoDevelopmentWorkflowGraph20261102(
    {name:'Jacket',pieces:[{id:'front'}],techPackStudio:{draft:{title:'Jacket'}}},
    {report,generatedAt:'2026-11-02T00:00:00.000Z'},
  )
  assert.equal(graph.nodes.find(node=>node.id==='pattern').status,'blocked')
  assert.equal(graph.nodes.find(node=>node.id==='pattern').issues[0].code,'BAD_PATTERN')
  assert.equal(graph.nodes.find(node=>node.id==='techpack').status,'review_required')
  assert.equal(graph.nodes.find(node=>node.id==='qa').status,'blocked')
  assert.equal(graph.productionApproved,false)
})

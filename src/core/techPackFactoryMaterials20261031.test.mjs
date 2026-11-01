import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateTechPackMaterialCost20261031,deriveTechPackFactoryMaterials20261031,
 reconcileTechPackFactoryMaterials20261031} from './techPackFactoryMaterials20261031.js'

const engineering={sourceRevision:4,patterns:[{id:'front',fabricId:'f1',cutCount:null,cutCountStatus:'unknown',sourceRef:{kind:'panel',id:'front',revision:4}}],
 seams:[{id:'s1',first:'front',second:'back',refsResolved:false,sourceRef:{kind:'seam',id:'s1',revision:4}}]}
const snapshot={revision:4,template:{fabrics:[{id:'f1',name:'Rib',properties:{gsm:220}}]}}

test('BOM carries source facts, authored overrides and unknown consumption',()=>{
 const result=deriveTechPackFactoryMaterials20261031({snapshot,engineering,
  draft:{bom:[{id:'f1',supplier:'My supplier',cost:'7.50'}],sewingOperations:[{seamId:'s1',stitchClass:'401',spi:12}]}})
 assert.equal(result.materials[0].gsm.value,220)
 assert.equal(result.materials[0].authored.supplier,'My supplier')
 assert.equal(result.materials[0].unitPrice.value,null)
 assert.equal(result.patternAssignments[0].quantity,null)
 assert.equal(result.operations[0].spi.value,12)
 assert.equal(result.operations[0].status,'unresolved-seam')
 assert.equal(result.manufacturingApproved,false)
})

test('cost needs compatible units and preserves estimation status',()=>{
 assert.equal(calculateTechPackMaterialCost20261031({consumption:{value:1.25,unit:'m',status:'estimate'},unitPrice:{value:4,perUnit:'m',status:'verified'},currency:'USD',wastePercent:10}).value,5.5)
 assert.equal(calculateTechPackMaterialCost20261031({consumption:{value:1.25,unit:'m'},unitPrice:{value:4,perUnit:'kg'},currency:'USD'}).value,null)
})

test('marker yield requires revision and explicit verified evidence',()=>{
 const markerEvidence={sourceRevision:4,verified:true,yieldPercent:80,markerId:'m1',size:'M',colorwayId:'white'}
 const before=deriveTechPackFactoryMaterials20261031({snapshot,engineering,markerEvidence})
 assert.equal(before.marker.yieldPercent.value,80)
 assert.equal(deriveTechPackFactoryMaterials20261031({snapshot,engineering:{...engineering,sourceRevision:5},markerEvidence}).marker.yieldPercent.value,null)
 before.materials[0].authored={supplier:'Reviewed supplier'}
 const after=reconcileTechPackFactoryMaterials20261031(before,{...before,sourceRevision:5})
 assert.equal(after.materials[0].authored.supplier,'Reviewed supplier')
 assert.equal(after.materials[0].stale,true)
 assert.equal(after.marker.yieldPercent.value,null)
})

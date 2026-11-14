import test from 'node:test'
import assert from 'node:assert/strict'
import {toggleTechPackLayerSelection,patchTechPackVectorLayer,duplicateTechPackVectorLayer,
  reorderTechPackVectorLayers,deleteTechPackVectorLayers,setTechPackLayoutLayerVisibility}
  from './techPackLayerOperations20261030.js'
const items=[{id:'a',name:'Rectangle',x:2,y:4,locked:false,hidden:false},
  {id:'b',name:'Label',x:30,y:25,locked:false,hidden:false},
  {id:'c',name:'Locked art',x:45,y:40,locked:true,hidden:false}]

test('click selects one layer; Shift/Cmd click adds and removes without duplicate IDs',()=>{
 assert.deepEqual(toggleTechPackLayerSelection([], 'a'),['a'])
 assert.deepEqual(toggleTechPackLayerSelection(['a'],'b',true),['a','b'])
 assert.deepEqual(toggleTechPackLayerSelection(['a','b'],'a',true),['b'])
 assert.deepEqual(toggleTechPackLayerSelection(['a','b'],'c'),['c'])
})
test('eye and lock controls immutably update only their layer',()=>{
 const hidden=patchTechPackVectorLayer(items,'a',{hidden:true})
 const locked=patchTechPackVectorLayer(hidden,'b',{locked:true})
 assert.equal(locked[0].hidden,true)
 assert.equal(locked[1].locked,true)
 assert.equal(items[0].hidden,false)
 assert.equal(items[1].locked,false)
})
test('duplicate creates a new selected layer adjacent to original and preserves source',()=>{
 const duplicated=duplicateTechPackVectorLayer(items,'a','new')
 assert.deepEqual(duplicated.layers.map(item=>item.id),['a','new','b','c'])
 assert.deepEqual(duplicated.selectedIds,['new'])
 assert.equal(duplicated.layers[1].x,14)
 assert.equal(items.length,3)
 assert.equal(duplicateTechPackVectorLayer(items,'a','a'),null)
})
test('forward/backward reorders selected layers without moving locked artwork',()=>{
 assert.deepEqual(reorderTechPackVectorLayers(items,['a'],'up').map(item=>item.id),['b','a','c'])
 assert.deepEqual(reorderTechPackVectorLayers(items,['b'],'down').map(item=>item.id),['b','a','c'])
 assert.deepEqual(reorderTechPackVectorLayers(items,['c'],'down').map(item=>item.id),['a','b','c'])
})
test('delete preserves locked layers and continues selecting undeleted locked rows',()=>{
 const result=deleteTechPackVectorLayers(items,['a','c'])
 assert.deepEqual(result.layers.map(item=>item.id),['b','c'])
 assert.deepEqual(result.selectedIds,['c'])
})
test('existing page/box/image layers hide and restore without mutating other pages',()=>{
 const original={hiddenObjects:{overview:['notes'],flats:['drawing']},pages:{overview:{title:'Overview'}}}
 const hidden=setTechPackLayoutLayerVisibility(original,'overview','header',false)
 assert.deepEqual(new Set(hidden.hiddenObjects.overview),new Set(['notes','header']))
 const restored=setTechPackLayoutLayerVisibility(hidden,'overview','header',true)
 assert.deepEqual(restored.hiddenObjects.overview,['notes'])
 assert.deepEqual(restored.hiddenObjects.flats,['drawing'])
 assert.deepEqual(original.hiddenObjects.overview,['notes'])
})

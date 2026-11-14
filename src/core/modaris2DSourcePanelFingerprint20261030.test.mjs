import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fingerprintNativePatternBindingsSource20261023 as fingerprint,
  createNativePatternConstraintSidecar20261023 as create,
  planNativePatternConstraintBindings20261023 as plan,
  serializeNativePatternConstraintSidecar20261023 as serialize,
  deserializeNativePatternConstraintSidecar20261023 as deserialize,
} from './nativePatternConstraintBindings20261023.js'

const polygon=(width=.4)=>({
  points:[[0,0],[width,0],[width,.3],[0,.3]],
  edges:['bottom','right','top','left'],
  curves:{bottom:[[.1,-.01],[.3,-.01]]},
})
const source=()=>({revision:31,template:{panels:[
  {id:'front',polygon:polygon()},
  {id:'__proto__',polygon:polygon(.28)},
]}})
const definition={
  measurements:{width:{valueMm:420}},
  bindings:[{id:'front-width',panelId:'front',pointIndex:1,
    mode:'along',a:0,b:1,distanceFormula:'width',dependsOn:[]}],
}

test('native source fingerprint includes a __proto__-named panel and its exact cubic geometry',()=>{
  const before=source(),changed=structuredClone(before)
  changed.template.panels[1].polygon.curves.bottom[0][1]-=.02
  assert.notEqual(fingerprint(before),fingerprint(changed),
    'A special panel identifier must not be omitted from the native source fingerprint')
  const reordered=structuredClone(before)
  reordered.template.panels.reverse()
  assert.equal(fingerprint(before),fingerprint(reordered),
    'Panel order is not a geometry edit and must not change the fingerprint')
})

test('a saved binding on another panel refuses a changed __proto__ panel before proposing any edits',()=>{
  const before=source(),made=create(before,definition)
  assert.equal(made.ok,true,made.reason)
  assert.equal(plan(before,made.sidecar).ok,true)
  const changed=structuredClone(before)
  changed.template.panels[1].polygon.points[2][0]+=.002
  const refused=plan(changed,made.sidecar)
  assert.equal(refused.ok,false)
  assert.match(refused.reason,/fingerprint|source geometry/i)
  assert.equal(refused.commands,undefined)
})

test('special panel ID remains a distinct editable native panel; duplicate IDs still reject',()=>{
  const before=source()
  const special=create(before,{measurements:{width:{valueMm:300}},bindings:[{
    id:'special-width',panelId:'__proto__',pointIndex:1,mode:'along',a:0,b:1,
    distanceFormula:'width',dependsOn:[],
  }]})
  assert.equal(special.ok,true,special.reason)
  const restored=deserialize(serialize(special.sidecar))
  assert.equal(restored.bindings[0].panelId,'__proto__')
  const proposed=plan(before,restored)
  assert.equal(proposed.ok,true,proposed.reason)
  assert.equal(proposed.commands[0].panel,'__proto__')
  const duplicated=structuredClone(before)
  duplicated.template.panels.push(structuredClone(duplicated.template.panels[1]))
  assert.equal(create(duplicated,definition).ok,false)
})

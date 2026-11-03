import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {inspectExoAvatarVisualCollider20261102} from './exoAvatarVisualColliderAlignment20261102.js'

test('source body bounds match native collider without scaling cosmetic hair',()=>{
  const physical=new THREE.Group(),actor=new THREE.Group()
  const body=new THREE.Mesh(new THREE.BoxGeometry(.4,1.7,.23))
  body.position.y=.85;physical.add(body)
  const skin=new THREE.Mesh(new THREE.BoxGeometry(.4,1.7,.23))
  skin.name='EXO_Adult_01_-_Parametric_Body';skin.position.y=.85;actor.add(skin)
  const hair=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.3))
  hair.name='short01';hair.position.y=1.8;actor.add(hair)
  const good=inspectExoAvatarVisualCollider20261102(THREE,actor,physical)
  assert.equal(good.matched,true)
  assert.ok(good.maxErrorM<1e-6)
  skin.position.x=.08
  assert.equal(inspectExoAvatarVisualCollider20261102(THREE,actor,physical).matched,false)
})

test('mismatched or missing native mesh never receives a visual-only fitting certification',()=>{
  assert.throws(()=>inspectExoAvatarVisualCollider20261102(THREE,new THREE.Group(),new THREE.Group()),/Native fitting/)
  const body=new THREE.Group()
  body.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.7,.23)))
  const actor=new THREE.Group()
  actor.add(new THREE.Mesh(new THREE.BoxGeometry(.04,.1,.02)))
  assert.equal(inspectExoAvatarVisualCollider20261102(THREE,actor,body).matched,false)
})

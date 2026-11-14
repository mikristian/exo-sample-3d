import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {styleExoAvatarHair20261102} from './exoAvatarHairStyling20261102.js'

test('color and silhouette hair controls do not change body mesh or collider',()=>{
  const root=new THREE.Group()
  const skin=new THREE.Mesh(new THREE.BoxGeometry(.4,1.6,.2),new THREE.MeshStandardMaterial({color:'white'}))
  skin.name='EXO Adult 01 - Parametric Body'
  const hair=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial({color:'white'}))
  hair.name='EXO Adult 01 - Parametric Body.short01'
  root.add(skin,hair)
  const originalBody=skin.geometry.getAttribute('position').array.slice()
  const result=styleExoAvatarHair20261102(THREE,root,{color:'#442211',visible:true,volume:1.15,length:1.2})
  assert.equal(result.hairMeshes,1)
  assert.deepEqual(skin.geometry.getAttribute('position').array,originalBody)
  assert.ok(hair.scale.x>1)
  assert.ok(hair.scale.y>1)
  assert.equal(hair.material.color.getHexString(),'442211')
  const hidden=styleExoAvatarHair20261102(THREE,root,{color:'#777777',visible:false,volume:1,length:1})
  assert.equal(hair.visible,false)
  assert.equal(hidden.hairMeshes,1)
  assert.equal(hair.scale.x,1)
  assert.equal(hair.scale.y,1)
  assert.deepEqual(skin.geometry.getAttribute('position').array,originalBody)
})

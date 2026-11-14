import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  inspectMetaHumanGlb20261029,fitImportedAvatarToNative20261029,
  canonicalImportedWalkBone20261029,
} from './metaHumanGlbBridge20261029.js'

function glb(scene) {
  const json = new TextEncoder().encode(JSON.stringify(scene))
  const padded = (json.length+3)&~3
  const buffer = new ArrayBuffer(20+padded)
  const dv = new DataView(buffer)
  dv.setUint32(0,0x46546c67,true)
  dv.setUint32(4,2,true)
  dv.setUint32(8,buffer.byteLength,true)
  dv.setUint32(12,padded,true)
  dv.setUint32(16,0x4e4f534a,true)
  new Uint8Array(buffer,20,json.length).set(json)
  new Uint8Array(buffer,20+json.length,padded-json.length).fill(0x20)
  return buffer
}
const body={asset:{version:'2.0'},nodes:[
  {name:'pelvis'},{name:'spine_01'},{name:'thigh_l'},{name:'thigh_r'},
  {name:'calf_l'},{name:'calf_r'}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],
  skins:[{joints:[0,1,2,3,4,5]}]}

test('read valid UE MetaHuman-like skinned GLB without exposing asset data',()=>{
  const metadata=inspectMetaHumanGlb20261029(glb(body))
  assert.equal(metadata.skinCount,1)
  assert.equal(metadata.meshCount,1)
  assert.equal(metadata.jointCount,6)
  assert.equal(metadata.metahumanRigLikely,true)
  assert.match(metadata.warnings.join(' '),/visual preview only/i)
  assert.equal(inspectMetaHumanGlb20261029(glb({...body,skins:[]})).skinCount,0)
})

test('reject corrupt, unsupported and geometry-free GLB files',()=>{
  assert.throws(()=>inspectMetaHumanGlb20261029(new ArrayBuffer(32)),/valid glTF/)
  assert.throws(()=>inspectMetaHumanGlb20261029(glb({...body,meshes:[]})),/body mesh/)
  assert.throws(()=>inspectMetaHumanGlb20261029(glb({...body,extensionsRequired:['KHR_draco_mesh_compression']})),/custom glTF extension/)
  const damaged=glb(body);new DataView(damaged).setUint32(8,999,true)
  assert.throws(()=>inspectMetaHumanGlb20261029(damaged),/valid glTF/)
})

test('normalize avatar to native collider dimensions without changing skeleton or geometry',()=>{
  const imported=new THREE.Group()
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,2,.25))
  mesh.position.set(2,1.5,3)
  imported.add(mesh)
  const native=new THREE.Group()
  const body=new THREE.Mesh(new THREE.BoxGeometry(.5,1.75,.3))
  body.position.set(0,.875,0)
  native.add(body)
  const geometry=mesh.geometry
  const result=fitImportedAvatarToNative20261029(THREE,imported,native)
  assert.ok(Math.abs(result.uniformScale-.875)<1e-6)
  assert.equal(mesh.geometry,geometry)
  const fitted=new THREE.Box3().setFromObject(imported)
  const goal=new THREE.Box3().setFromObject(native)
  assert.ok(Math.abs((fitted.max.y-fitted.min.y)-(goal.max.y-goal.min.y))<1e-6)
  assert.ok(Math.abs(fitted.min.y-goal.min.y)<1e-6)
  assert.ok(Math.abs(fitted.getCenter(new THREE.Vector3()).x)<1e-6)
})

test('visual preview can be displayed before the Rust collider snapshot loads',()=>{
  const imported=new THREE.Group()
  imported.add(new THREE.Mesh(new THREE.BoxGeometry(.45,1.8,.25)))
  const result=fitImportedAvatarToNative20261029(THREE,imported,new THREE.Group())
  assert.ok(Math.abs(result.targetHeightM-1.75)<1e-6)
  assert.ok(Math.abs(new THREE.Box3().setFromObject(imported).min.y)<1e-6)
})

test('recognize both MetaHuman and Mixamo torso/limb bone conventions',()=>{
  assert.equal(canonicalImportedWalkBone20261029('thigh_l'),'leftthigh')
  assert.equal(canonicalImportedWalkBone20261029('calf_r'),'rightleg')
  assert.equal(canonicalImportedWalkBone20261029('upperarm_l'),'leftarm')
  assert.equal(canonicalImportedWalkBone20261029('mixamorig:LeftUpLeg'),'leftupleg')
  assert.equal(canonicalImportedWalkBone20261029('FACIAL_C_FacialRoot'),null)
})

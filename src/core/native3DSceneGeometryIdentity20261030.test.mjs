import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {selectNative3DSceneGeometryIdentity20261030 as select} from './native3DSceneGeometryIdentity20261030.mjs'
test('immutable native 3D identity retains original metre units and revision',()=>{
 const source={revision:12,positions:[[0,0,0],[.1,0,0],[0,.2,0]],triangles:[[0,1,2]]}
 const before=structuredClone(source),result=select(source)
 assert.deepEqual(result,{format:'exo.native-3d-scene-identity.v1',sourceRevision:12,nativeCoordinateUnit:'m',vertexCount:3,triangleCount:1})
 assert.ok(Object.isFrozen(result));assert.deepEqual(source,before)
})
test('invalid revision, indexes, nonfinite coordinates and excessive arrays reject',()=>{
 const good={revision:1,positions:[[0,0,0]],triangles:[[0,0,0]]}
 for(const change of [s=>s.revision=-1,s=>s.positions[0][1]=NaN,s=>s.triangles=[[0,1,2]],s=>s.triangles=[[0,0,Infinity]],s=>s.positions=new Array(2_000_001)]){
  const s=structuredClone(good);change(s);assert.equal(select(s),null)
 }
})
test('architecture gate: scene renderer uses pure geometry identity without replacing physics geometry',()=>{
 const scene=readFileSync(new URL('../components/ClothCraftSceneV2.jsx',import.meta.url),'utf8')
 assert.match(scene,/selectNative3DSceneGeometryIdentity20261030\(snapshot\)/)
 assert.match(scene,/buildIndexedMesh\(world, triangleRange/)
 assert.match(scene,/native3dGeometryIdentityValid=String\(Boolean\(sceneIdentity\)\)/)
 assert.doesNotMatch(scene,/sceneIdentity\?\.triangleCount\?\?\(snapshot\.triangles/)
})

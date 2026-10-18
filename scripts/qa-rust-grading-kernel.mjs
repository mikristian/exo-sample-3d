import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {initializeRustGradingKernel,rustGradingKernelReady,rustGradingKernelStatus} from '../src/core/rustGradingKernel.js'
import {gradePointForPiece,gradeProject} from '../src/core/grading.js'

const points=[{x:-8,y:0},{x:8,y:0},{x:0,y:0},{x:3,y:0},{x:2,y:0,gradeRule:{enabled:true,dxPerSize:-2,dyPerSize:0}},{x:4,y:0,gradeRule:{enabled:true,dxPerSize:'bad',dyPerSize:-3}}]
const piece={id:'test',points}
const grading={sizes:['XS','M','XL'],baseSize:'M',widthPerSizeCm:3,lengthPerSizeCm:1.2}
const fixtures=[]
for(const size of ['XS','M','XL'])for(const point of points)fixtures.push({size,point,expected:gradePointForPiece(piece,grading,size,point)})
const bytes=readFileSync('public/wasm/exo_grading_kernel.wasm')
const exports=WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(item=>item.name)
for(const name of ['exo_grading_abi_version','exo_grade_point_x','exo_grade_point_y'])assert.ok(exports.includes(name),`missing ${name}`)
assert.equal(rustGradingKernelStatus().backend,'javascript-fallback')
assert.equal(await initializeRustGradingKernel({bytes}),true)
assert.ok(rustGradingKernelReady())
assert.equal(rustGradingKernelStatus().backend,'rust-wasm')
for(const {size,point,expected} of fixtures){
 const actual=gradePointForPiece(piece,grading,size,point)
 for(const key of ['x','y'])assert.ok(Math.abs(actual[key]-expected[key])<1e-10,`${size} ${key}: ${actual[key]} vs ${expected[key]}`)
}
const project={pieces:[piece],grading,productionSpec:{gradingModel:'seam-locked-affine-v1',referenceHalfChestCm:54,referenceBodyLengthCm:71},customMeasurements:[]}
assert.ok(Number.isFinite(gradeProject(project,'XL').pieces[0].points[0].x))
for(const height of [0,0.5,10,100]){
 const testPiece={points:[{x:-12,y:0},{x:12,y:height}]}
 for(const size of ['XS','XL']){
  const point={x:3,y:height/2,gradeRule:{enabled:true,dxPerSize:'invalid',dyPerSize:-4}}
  const offset=size==='XS'?-1:1
  const centerX=0
  const normalizedY=point.y/Math.max(1,height)
  const expected={x:point.x+Math.sign(point.x-centerX)*3*offset/2*(.55+.45*(1-normalizedY)),y:point.y-4*offset}
  const actual=gradePointForPiece(testPiece,grading,size,point)
  for(const key of ['x','y'])assert.ok(Math.abs(actual[key]-expected[key])<1e-10,`height=${height} ${size} ${key}`)
 }
}
console.log(JSON.stringify({pass:true,fixtures:fixtures.length+8,affine:true,wasmExports:exports}))

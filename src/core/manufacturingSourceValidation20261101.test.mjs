import test from 'node:test'
import assert from 'node:assert/strict'
import {assertManufacturingSource, manufacturingButtonholeSegment, coincidentContours} from './manufacturingSourceValidation20261101.js'
import {projectToDxf, parseDxfPatterns} from './dxf.js'
import {createTeeTemplate} from '../data/templates.js'
const poly = [[0,0],[10,0],[10,10],[0,10]].map(([x,y])=>({x,y}))
const project=()=>({pieces:[{id:'p',points:poly,seamAllowance:0,edgeSeamAllowances:{},buttonholes:[]}]})
test('strict authored values reject null, coercion, nonfinite and invalid edge keys',()=>{
 for(const value of [null,'',false,'1',NaN,Infinity,-1]) {
  const p=project();p.pieces[0].seamAllowance=value;assert.throws(()=>assertManufacturingSource(p))
  const q=project();q.pieces[0].edgeSeamAllowances={0:value};assert.throws(()=>assertManufacturingSource(q))
 }
 for(const key of ['-1','4','01','1.5','bad']) {const p=project();p.pieces[0].edgeSeamAllowances={[key]:1};assert.throws(()=>assertManufacturingSource(p))}
 assert.doesNotThrow(()=>assertManufacturingSource(project()))
})
test('short positive buttonhole is not silently enlarged; reverse and translated CUTs work',()=>{
 for(const polygon of [poly,[...poly].reverse(),poly.map(p=>({x:p.x+100,y:p.y-20}))]) {
  const shift=polygon[0].x===100?{x:100,y:-20}:{x:0,y:0}
  const {a,b}=manufacturingButtonholeSegment({x:5+shift.x,y:5+shift.y,lengthCm:.2,orientationDeg:33},polygon,'p')
  assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-.2)<1e-12)
 }
})
test('interior endpoints cannot bridge a concave gap; boundary contact fails closed',()=>{
 const u=[[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]].map(([x,y])=>({x,y}))
 assert.throws(()=>manufacturingButtonholeSegment({x:5,y:7,lengthCm:8},u,'p'),/crossing/)
 assert.throws(()=>manufacturingButtonholeSegment({x:5,y:0,lengthCm:2},poly,'p'),/crossing/)
})
test('coincidence allows cyclic and reversed contours but never same-area displacement',()=>{
 assert.equal(coincidentContours(poly,[...poly.slice(2),...poly.slice(0,2)]),true)
 assert.equal(coincidentContours(poly,[...poly].reverse()),true)
 assert.equal(coincidentContours(poly,poly.map(p=>({...p,x:p.x+.001}))),false)
})
test('reference importer rejects equal-area translated STITCH and duplicate STITCH',()=>{
 const p=createTeeTemplate();p.pieces=[{...p.pieces[0],points:poly,curves:{},notches:[],internalLines:[],buttonholes:[],seamAllowance:0,edgeSeamAllowances:{}}];p.seams=[]
 const wire=projectToDxf(p,'M',{cutlineMode:'manufacturing'})
 const token=p.pieces[0].name.toUpperCase()
 const start=wire.indexOf(`0\nPOLYLINE\n8\nSTITCH_${token}\n`), end=wire.indexOf(`0\nSEQEND\n8\nSTITCH_${token}`,start)+`0\nSEQEND\n8\nSTITCH_${token}`.length
 assert.ok(start>=0)
 const record=wire.slice(start,end)
 const shifted=record.replace(/\n10\n([^\n]+)/g,(_,x)=>'\n10\n'+(Number(x)+1))
 for(const bad of [wire.slice(0,start)+shifted+wire.slice(end),wire.slice(0,start)+record+'\n'+wire.slice(start)])
  assert.throws(()=>parseDxfPatterns(bad,{manufacturingImport:'cut-reference'}))
})

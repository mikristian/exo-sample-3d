import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {decodeVerifiedGarmentProject} from './exoDecodedGarmentProject20261102.js'
import {createDefaultProject} from '../data/defaultProject.js'
import {projectToDxf} from './dxf.js'

const base=()=>createDefaultProject()
const rect=()=>({vertices:[[0,0],[10,0],[10,10],[0,10]],edges:[{endpoints:[0,1]},{endpoints:[1,2]},{endpoints:[2,3]},{endpoints:[3,0]}],cut_quantity:2,fabric_group:'main'})
const source=()=>({ok:true,verified:true,sourceId:'default/00/rand_001',source:{sourceId:'default/00/rand_001',dataset:'GarmentCodeData v2',license:'CC-BY',sha256:'a'.repeat(64)},spec:{pattern:{panels:{Front:rect(),Back:rect()},stitches:[[{panel:'Front',edge:0},{panel:'Back',edge:0}]]},properties:{units_in_meter:100,curvature_coords:'relative',normalized_edge_loops:true}}})

test('verified source decodes to undo-ready, independent EXO pieces and source provenance',()=>{
  const input=source(),editor=base(),before=structuredClone(editor)
  const result=decodeVerifiedGarmentProject(input,editor)
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.project.pieces.length,2)
  assert.equal(result.project.seams.length,1)
  assert.equal(result.project.pieces[0].cutQuantity,2)
  assert.equal(result.project.pieces[0].fabricId,'main')
  assert.equal(result.project.patternGeneration.sourceId,input.sourceId)
  assert.equal(result.report.fitReady,false)
  assert.equal(result.report.gradeReady,false)
  assert.deepEqual(editor,before)
  assert.deepEqual(input,source())
  result.project.pieces[0].points[0].x=999
  assert.notEqual(editor.pieces[0].points[0].x,999)
})

test('fails closed on false provenance, missing edges, invalid sewing endpoints and unsupported cubic curves',()=>{
  for(const mutate of [
    p=>{p.verified=false},
    p=>{p.source.sourceId='different'},
    p=>{p.spec.pattern.panels.Front.edges.pop()},
    p=>{p.spec.pattern.stitches[0][0].edge=99},
    p=>{p.spec.pattern.panels.Front.edges[0].curvature={type:'cubic',params:[[0.2,0.1],[0.8,0.1]]}},
    p=>{p.spec.pattern.panels.Front.edges[0].endpoints=[0,2]},
    p=>{p.spec.properties.units_in_meter=1},
  ]) {const input=source();mutate(input);const result=decodeVerifiedGarmentProject(input,base());assert.equal(result.ok,false,result.reason)}
})

test('blocks a sewing length mismatch instead of applying unverified seam geometry',()=>{
  const input=source();input.spec.pattern.panels.Back.vertices[1][0]=14
  assert.equal(decodeVerifiedGarmentProject(input,base()).ok,false)
})

test('archive conversion excludes source garment measurements, notions, graphics and unrelated fabrics',()=>{
  const editor=base()
  editor.customMeasurements=[{id:'old-measurement',a:{x:0,y:0},b:{x:1,y:1}}]
  editor.fasteners=[{id:'old-fastener'}]
  editor.trims=[{id:'old-trim'}]
  editor.graphics=[{id:'old-art'}]
  editor.topstitches=[{id:'old-stitch'}]
  editor.bindings=[{id:'old-binding'}]
  editor.fabrics.legacy={id:'legacy',name:'Old lining'}
  editor.interchange={legacy:{id:'old-source'}}
  const snapshot=structuredClone(editor)
  const decoded=decodeVerifiedGarmentProject(source(),editor)
  assert.equal(decoded.ok,true,decoded.reason)
  for(const field of ['customMeasurements','fasteners','trims','graphics','topstitches','bindings'])assert.deepEqual(decoded.project[field],[],field)
  assert.equal(decoded.project.fabrics.legacy,undefined)
  assert.equal(decoded.project.interchange.legacy,undefined)
  assert.deepEqual(decoded.project.avatar,editor.avatar)
  assert.deepEqual(decoded.project.fabrics.main,editor.fabrics.main)
  assert.deepEqual(editor,snapshot)
})

test('real verified archive source decodes and exports original geometry when local corpus exists',t=>{
  const run=spawnSync('python3',['integrations/clothcraft/pattern-source-geometry-20261102.py'],{
    cwd:fileURLToPath(new URL('../../',import.meta.url)),
    input:JSON.stringify({sourceId:'default/00/rand_07SXFM3OXA'}),encoding:'utf8',timeout:15000,
  })
  assert.equal(run.error,undefined,run.error?.message)
  assert.equal(run.status,0,run.stderr)
  let packet
  try{packet=JSON.parse(run.stdout)}catch{assert.fail('Verified archive reader returned invalid JSON')}
  if(packet.error==='archive_index_unavailable'||packet.error==='source_specification_not_local'||packet.error==='source_not_indexed')return t.skip('Verified local corpus unavailable')
  assert.equal(packet.ok,true,packet.error)
  const decoded=decodeVerifiedGarmentProject(packet,base())
  assert.equal(decoded.ok,true,decoded.reason)
  assert.equal(decoded.project.pieces.length,4)
  assert.equal(decoded.project.seams.length,14)
  const dxf=projectToDxf(decoded.project,'M')
  assert.equal(typeof dxf,'string')
  assert.ok(dxf.length>1000)
})

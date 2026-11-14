import test from 'node:test'
import assert from 'node:assert/strict'
import {runInNewContext} from 'node:vm'
import {buildAccuMarkExplorerOrder20261024} from './accumarkExplorerProductionFoundation20261024.js'
import {buildAccuMarkCutRoomPlan} from './accumarkCutRoomPlan20261024.js'
import {buildIndustrialCadOrderHandoff20261028} from './industrialCadOrderHandoff20261028.mjs'
import {parseAccuMarkGradedDxfWire20261023} from './accumarkGradedDxfRoundtripAudit20261023.js'
import {sha256Bytes} from './sha256Bytes.js'
import {inspectIndustrialCadReturnedFileIntake20261031 as inspect} from './industrialCadReturnedFileIntake20261031.mjs'

const encoder=new TextEncoder()
const sha=bytes=>sha256Bytes(bytes)
const counts=wire=>{
 const parsed=parseAccuMarkGradedDxfWire20261023(wire)
 assert.equal(parsed.ok,true,JSON.stringify(parsed.issues))
 const result={cut:0,stitch:0,allowance:0,notch:0}
 for(const entity of parsed.entities){
  if(entity.layer?.startsWith('CUT_'))result.cut++
  if(entity.layer?.startsWith('STITCH_'))result.stitch++
  if(entity.layer?.startsWith('SA_'))result.allowance++
  if(entity.layer?.startsWith('NOTCH_'))result.notch++
 }
 return result
}
function garment(){
 const project={id:'disposable-returned-files',grading:{sizes:['S','M','L'],baseSize:'M',
  widthPerSizeCm:0,lengthPerSizeCm:0},pieces:[
  {id:'front',name:'Front',fabricId:'shell',cutQuantity:2,grainAngleDeg:0,seamAllowance:1,
   notches:[{edgeIndex:0,t:0.25,depthCm:0.3}],
   points:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}]},
  {id:'collar',name:'Collar',fabricId:'rib',cutQuantity:1,grainAngleDeg:0,seamAllowance:1,
   points:[{x:0,y:0},{x:7,y:0},{x:7,y:3},{x:0,y:3}]},
 ]}
 const quantitiesBySize={S:2,M:1,L:3}
 const explorer=buildAccuMarkExplorerOrder20261024(project,
  {styleId:'TEE-RETURNED',orderId:'ORDER-RETURNED',quantitiesBySize})
 assert.equal(explorer.ok,true)
 const plans={}
 for(const fabricId of ['shell','rib']){
  plans[fabricId]=buildAccuMarkCutRoomPlan(project,{fabricId,quantitiesBySize,
   fabricWidthCm:30,spacingCm:1,nap:true,maxPlyCount:2,
   rolls:[{rollId:`${fabricId}-ROLL`,batchId:`${fabricId}-BATCH`,fabricId,
    shade:'SHADE-1',nap:true,usableLengthCm:200,costPerMeter:20,widthCm:30}]})
  assert.equal(plans[fabricId].ok,true,JSON.stringify(plans[fabricId].issues))
 }
 const handoff=buildIndustrialCadOrderHandoff20261028(project,explorer,plans)
 assert.equal(handoff.ok,true,JSON.stringify(handoff.issues))
 const outboundWires=handoff.wiresBySize
 const evidence={format:'exo.receiving-CAD-reexport-evidence.v1',
  handoffManifestSha256:handoff.manifestSha256,
  receiverApplication:'LOCAL_FIXTURE',receiverVersion:'test-1',receiverSessionId:'disposable',
  reexportWiresBySize:{...outboundWires},
  importRecords:project.grading.sizes.map(size=>({size,imported:true,
   sourceSha256:sha(encoder.encode(outboundWires[size])),
   reexportSha256:sha(encoder.encode(outboundWires[size])),
   layerCounts:counts(outboundWires[size])}))}
 const packet={records:[],files:{}}
 for(const size of project.grading.sizes){
  const filename=`received/${size}.dxf`,bytes=encoder.encode(outboundWires[size])
  packet.records.push({size,filename,bytes:bytes.length,sha256:sha(bytes)})
  packet.files[filename]=bytes
 }
 return {project,explorer,plans,handoffPacket:{manifest:handoff.manifest,
  manifestSha256:handoff.manifestSha256},outboundWires,evidence,packet}
}
const run=v=>inspect(v.project,v.explorer,v.plans,v.handoffPacket,v.outboundWires,v.evidence,v.packet)
const blocked=(mutate,code)=>{
 const v=garment();mutate(v)
 const result=run(v)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(i=>i.code===code),JSON.stringify(result.issues))
 assert.equal(result.receiverCadVerified,false)
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.factoryApproved,false)
}

test('real three-size two-fabric DXF bytes are locally checked without manufacturing authority',()=>{
 const v=garment(),result=run(v)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.returnedDxfFileBytesVerified,true)
 assert.deepEqual(result.returnedDxfFiles.map(x=>x.size),['S','M','L'])
 assert(result.returnedDxfFiles.every(x=>x.bytes>200))
 assert.equal(result.independentReceiverAuthenticated,false)
 assert.equal(result.receiverCadVerified,false)
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.factoryApproved,false)
})

test('missing, empty, extra, and renamed returned files fail closed',()=>{
 blocked(v=>{delete v.packet.files['received/M.dxf']},'RETURNED_DXF_FILE_SET_INVALID')
 blocked(v=>{v.packet.files['received/M.dxf']=new Uint8Array()},'RETURNED_DXF_FILE_INVALID')
 blocked(v=>{v.packet.files['received/XL.dxf']=v.packet.files['received/M.dxf']},'RETURNED_DXF_FILE_SET_INVALID')
 blocked(v=>{v.packet.records[1].filename='../../outside.dxf'},'RETURNED_DXF_FILE_MANIFEST_INVALID')
})

test('rehashed metadata cannot substitute stale or modified actual DXF bytes',()=>{
 blocked(v=>{v.packet.files['received/M.dxf'][40]^=1},'RETURNED_DXF_FILE_CONTENT_DRIFT')
 blocked(v=>{v.packet.records[0].sha256='0'.repeat(64)},'RETURNED_DXF_FILE_CONTENT_DRIFT')
 blocked(v=>{v.packet.records[2].bytes+=1},'RETURNED_DXF_FILE_CONTENT_DRIFT')
 blocked(v=>{
  const bytes=v.packet.files['received/S.dxf']
  bytes[0]=0xff
  v.packet.records[0].sha256=sha(bytes)
 },'RETURNED_DXF_FILE_CONTENT_DRIFT')
})

test('accessor, fake byte lengths and shared-memory files cannot masquerade as returned artifacts',()=>{
 const v=garment();let invoked=0
 Object.defineProperty(v.packet.files,'received/S.dxf',{enumerable:true,get(){invoked++;return encoder.encode(v.outboundWires.S)}})
 const result=run(v)
 assert.equal(result.ok,false);assert.equal(invoked,0)
 assert(result.issues.some(i=>i.code==='RETURNED_DXF_FILE_INVALID'))
 const spoof=garment()
 Object.defineProperty(spoof.packet.files['received/S.dxf'],'byteLength',{value:1})
 const intact=run(spoof)
 assert.equal(intact.ok,true,JSON.stringify(intact.issues)) // Native length wins.
})

test('shared-backed and proxy typed arrays are rejected without granting CUT authority',()=>{
 if(typeof SharedArrayBuffer!=='undefined')blocked(v=>{
  const original=v.packet.files['received/S.dxf']
  const shared=new Uint8Array(new SharedArrayBuffer(original.length));shared.set(original)
  v.packet.files['received/S.dxf']=shared
 },'RETURNED_DXF_FILE_INVALID')
 if(typeof SharedArrayBuffer!=='undefined')blocked(v=>{
  const foreign=runInNewContext('new Uint8Array(new SharedArrayBuffer(length))',
   {length:v.packet.files['received/M.dxf'].length})
  foreign.set(v.packet.files['received/M.dxf'])
  v.packet.files['received/M.dxf']=foreign
 },'RETURNED_DXF_FILE_INVALID')
 blocked(v=>{
  v.packet.files['received/S.dxf']=new Proxy(v.packet.files['received/S.dxf'],{})
 },'RETURNED_DXF_FILE_INVALID')
})

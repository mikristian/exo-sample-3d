// Run: node integrations/clothcraft/position-501-thomas-pieces-20261025.mjs
// Source-preserving staged arrangement. Each of 24 panels is explicitly placed.
// This is an initial 3D arrangement, not a simulation or production fit certificate.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {planOrderedAssembly} from '../../src/core/backends/nativeOrderedAssembly20261025.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const dest=path.join(root,'docs/goals/evidence/501-reconstruction-20261025')
const bridge='http://127.0.0.1:5385/workspace'
const headers={'content-type':'application/json','origin':'http://127.0.0.1:5386'}
async function call(payload){const response=await fetch(bridge,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});const json=await response.json();assert(json.ok,`${payload.op}/${payload.command?.kind||''}: ${json.error}`);return json.data}
let snap=await call({op:'snapshot',avatar:true})
assert.equal(snap.avatarModel,'clo-thomas')
assert.equal(snap.template.panels.length,24)
const av=snap.avatar.positions
assert(av.length>35000)
const frame={}
const place=(i,x,y,z,ry=0,rx=0,rz=0)=>{const part=snap.template.panels[i];frame[part.id]={panel:part.id,placement:{translation:[x,y,z],rotation_degrees:[rx,ry,rz]}}}
// LEGS: orient left/right legs as distinct forward- and back-facing sections.
// Source native Pattern(u,-v) downward orientation is preserved.
place(0,-.241,1.077,.205)
place(1,.014,1.077,.226)
place(2,-.006,1.115,-.196,180)
place(3,.247,1.115,-.215,180)
// BACK YOKES: above rear rise, not through the seat; separated for OGC.
place(4,-.005,1.155,-.245,180)
place(5,.248,1.155,-.265,180)
// PATCH POCKETS: situated over upper rear seat with intentional local layer offsets.
place(6,-.112,.955,-.294,180)
place(7,.116,.955,-.310,180)
// FRONT SCOOP FACING + INNER POCKET BAGS: layered within the front hip.
place(8,-.222,1.055,.255)
place(9,.040,1.055,.275)
place(10,-.211,1.038,.295)
place(11,.035,1.038,.319)
// FIFTH COIN POCKET rides on the wearer's right front pocket.
place(12,.071,1.064,.355)
// WAISTBANDS ABOVE UPPER RISE. Separate front and rear strip, rotated back.
place(13,-.211,1.159,.310)
place(14,.228,1.169,-.329,180)
// BUTTON-FLY FACINGS on centre-front; layers kept non-coplanar.
place(15,-.042,1.058,.367)
place(16,.030,1.059,.391)
// SEVEN LOOPS: five distributed along the front, two at back quarters.
for(const [i,x,z] of [[17,-.209,.371],[18,-.108,.388],[19,-.004,.400],[20,.103,.387],[21,.208,.372],
    [22,-.130,-.390],[23,.138,-.407]])place(i,x,1.178,z,i>=22?180:0)
const placements=snap.template.panels.map(p=>frame[p.id])
assert.equal(placements.length,24)
assert.equal(new Set(placements.map(x=>x.panel)).size,24)
const proposed=planOrderedAssembly(snap,{placements})
assert(proposed.ok,JSON.stringify(proposed))
const backup=await call({op:'save'})
fs.writeFileSync(path.join(dest,'501-Thomas-before-all-panels-position-pass.json'),JSON.stringify(backup.project,null,2)+'\n')
const originalCut=snap.template.panels.map(p=>JSON.stringify(p.polygon))
let rev=snap.revision
const evidence=[]
for(let i=0;i<placements.length;i++){
 const v=placements[i]
 const after=await call({op:'edit',revision:rev,command:{kind:'Place',panel:v.panel,placement:v.placement}})
 rev=after.revision
 evidence.push({i,panel:v.panel,name:after.template.panels[i].name,location:v.placement.translation,orientation:v.placement.rotation_degrees})
 console.log('Positioned',i+1,'/',24,after.template.panels[i].name)
}
snap=await call({op:'snapshot',avatar:true})
assert.equal(snap.avatarModel,'clo-thomas')
assert.equal(snap.template.panels.length,24)
assert(snap.template.panels.every((p,i)=>JSON.stringify(p.polygon)===originalCut[i]),'CUT geometries must remain unchanged')
assert(snap.template.panels.every((p,i)=>JSON.stringify(p.placement)===JSON.stringify(placements[i].placement)))
assert.equal(snap.template.seams.length,6)
// Sewing readiness cannot be certified until all true sewing edges are matched.
const saved=await call({op:'save'})
fs.writeFileSync(path.join(dest,'501-Thomas-all-24-positioned-working.json'),JSON.stringify(saved.project,null,2)+'\n')
fs.writeFileSync(path.join(dest,'501-Thomas-all-24-placement-results.json'),JSON.stringify({timestamp:new Date().toISOString(),avatar:'clo-thomas',size:'W32 L32',panels:24,sourceCutsUnchanged:true,existingSeams:snap.template.seams.length,revision:rev,allPanels:evidence,simulationApproved:false,sewingReady:false,notes:['Anatomy-referenced staging, not validated sewn closure.','Existing six seams were preserved; source sewing topology and seam-length matching must be corrected before full fitting.','Pocket bags, waistbands, fly components and belt loops are layered but remain without physical attachment seams.']},null,2)+'\n')
console.log('SAVED',JSON.stringify({pieces:snap.template.panels.length,seams:snap.template.seams.length,revision:rev,sourceCutsUnchanged:true,simulationApproved:false},null,2))

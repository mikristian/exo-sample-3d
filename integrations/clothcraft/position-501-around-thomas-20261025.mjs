// Deliberately staged/inspectable initial arrangement; not a validated sewn fit.
import fs from 'node:fs'
import path from 'node:path'
import {planOrderedAssembly} from '../../src/core/backends/nativeOrderedAssembly20261025.mjs'
const folder='docs/goals/evidence/501-reconstruction-20261025'
const source=path.join(folder,'501-Thomas-installed-app-tested-20261025.json')
const project=JSON.parse(fs.readFileSync(source,'utf8'))
// World axes: X left/right, Y height, +Z front. Pattern local v points down.
// Upper panel local y rests near the Thomas waist (~1.06 m).
const placements=[
 [-.235,1.06,.239,0,0,0], [.017,1.06,.246,0,0,0],
 [-.006,1.17,-.243,0,180,0], [.244,1.17,-.249,0,180,0],
 [-.014,1.20,-.285,0,180,0], [.246,1.20,-.291,0,180,0],
 // Patch pockets ride over the upper back legs with layered Z clearance.
 [-.155,.920,-.330,0,180,0], [.160,.920,-.336,0,180,0],
 // Front pocket facings and bags are staged in front of front-leg cloth.
 [-.215,1.015,.298,0,0,0], [.045,1.015,.307,0,0,0],
 [-.208,1.007,.360,0,0,0], [.042,1.007,.370,0,0,0],
 // Coin pocket, two waistband halves, fly stack.
 [.105,1.030,.419,0,0,0],
 [-.204,1.137,.432,0,0,0], [.212,1.137,-.403,0,180,0],
 [.001,1.014,.483,0,0,0], [.066,1.014,.512,0,0,0],
 // Belt loops are parked at seven distinct waist stations around the body,
 // tangent to the surface; separated outward until the waistband is sewn.
 [-.205,1.159,.50,0,0,0], [-.105,1.159,.515,0,0,0],
 [.002,1.159,.526,0,0,0], [.109,1.159,.515,0,0,0],
 [.208,1.159,.50,0,0,0], [-.17,1.159,-.54,0,180,0], [.17,1.159,-.55,0,180,0]
]
const roles=['front-left-leg','front-right-leg','back-left-leg','back-right-leg','back-left-yoke','back-right-yoke','back-left-pocket','back-right-pocket','front-left-pocket-facing','front-right-pocket-facing','front-left-pocket-bag','front-right-pocket-bag','coin-pocket','front-waistband','back-waistband','fly-facing','fly-shield',...Array.from({length:7},(_,i)=>`belt-loop-${i+1}`)]
const proposals=project.template.panels.map((panel,i)=>({panel:panel.id,placement:{translation:placements[i].slice(0,3),rotation_degrees:placements[i].slice(3)}}))
const analysis=planOrderedAssembly({revision:0,template:project.template},{placements:proposals,pairs:[]})
if(!analysis.ok||proposals.length!==24)throw Error('Assembly preflight rejected placements: '+JSON.stringify(analysis))
const manifest={status:'initial 3D staging, sewing preflight required',avatar:'clo-thomas',expectedPieces:24,measuredFit:false,simulationApproved:false,
  warning:'3D cloth surfaces may still intersect Thomas or each other. Do not simulate unattended; native OGC must reject invalid initial contacts.',
  seamsExisting:project.template.seams.length,requiredBeforeSewing:['true leg/crotch seam edges','seam length matching','orient back panels','align back yokes','waistband shape around 3D waist','pockets/fly attachment'],
  pieces:project.template.panels.map((p,i)=>({order:i+1,panel:p.id,name:p.name,role:roles[i],placement:proposals[i].placement})),preflight:{placementCount:analysis.placementCount,warnings:analysis.warnings}}
fs.writeFileSync(path.join(folder,'501-Thomas-ordered-placement-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
const assembled=structuredClone(project)
for(let i=0;i<proposals.length;i++)assembled.template.panels[i].placement=proposals[i].placement
assembled.state=null;assembled.mesh_signature=null
fs.writeFileSync(path.join(folder,'501-Thomas-ordered-3d-staging-20261025.json'),JSON.stringify(assembled,null,2)+'\n')
console.log(JSON.stringify({ok:true,pieces:24,existingSeams:manifest.seamsExisting,status:manifest.status,output:path.join(folder,'501-Thomas-ordered-3d-staging-20261025.json')},null,2))

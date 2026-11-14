/**
 * Collect every independently reimported runway candidate without conflating
 * Blender live IK success with an actually usable exported GLB. Read only.
 *
 * Run: node integrations/clothcraft/qa-exo-runway-iteration-ledger-20261102.mjs
 * Optional: EXO_GAIT_RESEARCH_ROOT=../exo-avatar-research-20261102
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {inspectExoRunwayContactQuality20261102} from '../../src/core/exoRunwayContactQualityGate20261102.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const research=path.resolve(repo,process.env.EXO_GAIT_RESEARCH_ROOT||'../exo-avatar-research-20261102')
const files=[]
for(const folder of ['runway_v4_engineering','runway_v6_grounded_ik','runway_v6_motion_solver']){
 const directory=path.join(research,folder)
 if(!fs.existsSync(directory))continue
 for(const filename of fs.readdirSync(directory)){
  if(!/(reimport|audit|validation)[-_a-z0-9]*\.json$/i.test(filename))continue
  files.push(path.join(directory,filename))
 }
}
const records=[]
for(const file of files.sort()){
 try{
  const data=JSON.parse(fs.readFileSync(file,'utf8'))
  if(!data?.legs||!Number.isInteger(data.reimported_bones)||!Number.isInteger(data.frames))continue
  const result=inspectExoRunwayContactQuality20261102(data)
  records.push({source:path.relative(research,file),file:data.file??null,
   bones:data.reimported_bones,frames:data.frames,
   maxSlideMm:{left:data.legs.L?.max_stance_mm_per_frame??null,right:data.legs.R?.max_stance_mm_per_frame??null},
   groundMinMm:{left:1000*(data.legs.L?.ground_tip_z_min_m??NaN),right:1000*(data.legs.R?.ground_tip_z_min_m??NaN)},
   groundMaxMm:{left:1000*(data.legs.L?.ground_tip_z_max_m??NaN),right:1000*(data.legs.R?.ground_tip_z_max_m??NaN)},
   contactGate:result.passed?'PASS':'FAIL',failures:result.failed,
   visualAnimatorApproved:false,movingRustColliderVerified:false,
   releaseApproved:false})
 }catch(error){records.push({source:path.relative(research,file),parseError:String(error.message||error),releaseApproved:false})}
}
const sorted=records.sort((a,b)=>(a.contactGate==='PASS'?0:1)-(b.contactGate==='PASS'?0:1) ||
 Math.max(a.maxSlideMm?.left??Infinity,a.maxSlideMm?.right??Infinity)-Math.max(b.maxSlideMm?.left??Infinity,b.maxSlideMm?.right??Infinity))
console.log('EXO_RUNWAY_ITERATION_LEDGER',JSON.stringify({schema:'exo.gait.quality.v1',
  disclaimer:'Numerical motion QA is necessary but not sufficient; no clip is auto-promoted',
  researchRoot:research,candidates:sorted},null,2))

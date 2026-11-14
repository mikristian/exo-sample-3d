// Safe create-only staging of a measured original EXO/MakeHuman skeletal study.
// The glTF is NOT tagged as a professional catwalk, mocap or dynamic solver rig.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const research=path.resolve(repo,'../exo-avatar-research-20261102/runway_v6_sole_compensated')
const source=path.join(research,'EXO_Runway_Walk_v6_SoleContactSafetyMargin.glb')
const dest=path.join(repo,'public/avatars/exo/motions/EXO_Runway_Walk_v6_SoleContactSafetyMargin.glb')
const hash=b=>createHash('sha256').update(b).digest('hex')
const data=fs.readFileSync(source)
if(data.length<1000000||data.toString('utf8',0,4)!=='glTF')throw Error('Not the expected GLB')
if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(data))throw Error('Research GLB target already exists with conflicting content; refuse overwrite')
fs.writeFileSync(dest,data)
const soles=JSON.parse(fs.readFileSync(path.join(research,'sole_safety_margin_strict_qa.json'),'utf8'))
const record={schema:'exo.motion.research.v1',filename:path.basename(dest),sha256:hash(data),
 source:'../exo-avatar-research-20261102/runway_v6_sole_compensated/',
 motionSpeedMps:.24,sourceRigBones:163,frames:193,fps:24,
 bodyCalibrationY:{'exo-feminine-02-exact':-.007,'exo-masculine-02-exact':-.0065,
  'exo-shape-02-exact':-.0055,'exo-masculine-03-hybrid':-.0065},
 blenderSoleMeasurements:{L:soles.measurements.L,R:soles.measurements.R},
 limitations:['slow short-stride gait, not runway-speed','not visually animator approved','native Rust cloth collider is static during motion','only four calibrated body shapes tested in browser'],
 quality:'EXPERIMENTAL FOOT-CONTACT STUDY ONLY; CLO3D parity not verified',promotedToProduction:false}
fs.writeFileSync(path.join(repo,'public/avatars/exo/motions/EXO_Runway_Walk_v6_research_manifest.json'),JSON.stringify(record,null,2)+'\n')
console.log('EXO_SLOW_GAIT_RESEARCH_STAGED',JSON.stringify({filename:record.filename,sha256:record.sha256,bytes:data.length,limitation:record.quality}))

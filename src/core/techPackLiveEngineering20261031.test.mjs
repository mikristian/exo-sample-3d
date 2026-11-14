import test from 'node:test'
import assert from 'node:assert/strict'
import {deriveTechPackLiveEngineering20261031,reconcileTechPackLiveEngineering20261031} from './techPackLiveEngineering20261031.js'

const panel={id:'front',name:'Front',fabric:'shell',cutCount:2,polygon:{
  points:[[0,0],[.1,0],[.1,.2],[0,.2]],edges:['hem','side','neck','center'],
  seam_allowances:{hem:.01,side:.012},notches:{side:[{t:.3,depth_m:.004}]}}}
const snapshot={revision:11,template:{panels:[panel],seams:[{id:'joined',a:{panel:'front',edge:'side'},b:{panel:'missing',edge:'edge'}}],
  grading:{sizes:['S','M'],baseSize:'M'}}}

test('native panel model retains physical meters, actual metadata and unresolved factory specs',()=>{
 const result=deriveTechPackLiveEngineering20261031({snapshot,source:{pom:{M:[{id:'width',cm:34,toleranceCm:1}]}}})
 assert.equal(result.patterns[0].pointUnit,'m')
 assert.deepEqual(result.patterns[0].points[1],[.1,0])
 assert.equal(result.patterns[0].seamAllowances[0].width.value,.01)
 assert.equal(result.patterns[0].notches[0].depth.value,.004)
 assert.equal(result.patterns[0].grainlineStatus,'unknown')
 assert.equal(result.patterns[0].cutCount,2)
 assert.equal(result.seams[0].refsResolved,false)
 assert.equal(result.pom[0].actual.unit,'cm')
 assert.equal(result.grading.coverage,'incomplete')
 assert.equal(result.manufacturingApproved,false)
})

test('revision-bound merge retains authored fields and removed pieces marked stale',()=>{
 const old=deriveTechPackLiveEngineering20261031({snapshot})
 old.patterns[0].authored={cutInstruction:'review'}
 const newer=deriveTechPackLiveEngineering20261031({snapshot:{revision:12,template:{panels:[],seams:[]}}})
 const merged=reconcileTechPackLiveEngineering20261031(old,newer)
 assert.equal(merged.patterns[0].sourceMissing,true)
 assert.equal(merged.patterns[0].stale,true)
 assert.equal(merged.patterns[0].authored.cutInstruction,'review')
 assert.equal(merged.manufacturingApproved,false)
})

test('legacy source does not inherit native meters or cut quantities',()=>{
 const project={revision:3,pieces:[{id:'body',points:[{x:0,y:0},{x:10,y:0},{x:0,y:20}],seamAllowance:1}],seams:[]}
 const r=deriveTechPackLiveEngineering20261031({project,nativeMode:false})
 assert.equal(r.patterns[0].pointUnit,'cm')
 assert.equal(r.patterns[0].cutCount,null)
 assert.equal(r.patterns[0].seamAllowances[0].width.unit,'cm')
})

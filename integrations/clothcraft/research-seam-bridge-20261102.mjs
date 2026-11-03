// Read-only learned seam proposals. Existing source sewing remains untouched;
// predicted graph edges have not passed physical stitchline/fit validation.
import {spawn} from 'node:child_process'
import path from 'node:path'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'

const script=fileURLToPath(new URL('./seam-prediction-research-20261102.py',import.meta.url))
const dataset=()=>path.resolve(process.env.EXO_GARMENTCODEDATA_V2_ROOT||
  path.join(homedir(),'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/garmentcodedata-v2'))
let active=false

export async function suggestResearchSewing20261102({sourceId,limit=8}={}){
  if(typeof sourceId!=='string'||!/^[A-Za-z0-9_-]{1,64}\/\d{2}\/[A-Za-z0-9_-]{1,120}$/.test(sourceId)||
    !Number.isInteger(limit)||limit<1||limit>20)
    return {ok:false,code:'INVALID_SEAM_RESEARCH_QUERY',manufacturingApproved:false}
  if(active)return {ok:false,code:'SEAM_RESEARCH_BUSY',manufacturingApproved:false}
  active=true
  try{
    return await new Promise(resolve=>{
      const child=spawn('python3',[script,'--root',dataset(),'--source-id',sourceId,'--limit',String(limit)],{
        stdio:['ignore','pipe','pipe'],env:{...process.env,OPENBLAS_NUM_THREADS:'1'},
      })
      let stdout='',tooBig=false,settled=false
      const complete=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result)}
      const timer=setTimeout(()=>{child.kill('SIGKILL');complete({ok:false,code:'SEAM_RESEARCH_TIMEOUT',manufacturingApproved:false})},45000)
      child.stdout.on('data',chunk=>{stdout+=chunk.toString('utf8');if(stdout.length>1024*1024){tooBig=true;child.kill('SIGKILL')}})
      child.stderr.on('data',()=>{})
      child.on('error',()=>complete({ok:false,code:'SEAM_RESEARCH_PROCESS_FAILED',manufacturingApproved:false}))
      child.on('close',code=>{
        if(tooBig)return complete({ok:false,code:'SEAM_RESEARCH_RESPONSE_TOO_LARGE',manufacturingApproved:false})
        try{
          const result=JSON.parse(stdout)
          if(code!==0||result.ok!==true)return complete({ok:false,code:'SEAM_RESEARCH_SOURCE_REJECTED',reason:String(result.error||'Unavailable').slice(0,220),manufacturingApproved:false})
          if(result.schema!=='exo.seam-prediction-research.v1'||result.sourceId!==sourceId||
             result.sourceAnchorsPreserved!==true||!Array.isArray(result.proposals)||
             !Array.isArray(result.proposedDisjointGraph))
            return complete({ok:false,code:'INVALID_SEAM_RESEARCH_OUTPUT',manufacturingApproved:false})
          return complete({...result,manufacturingApproved:false,physicalFitVerified:false,gradingValidated:false,
            sewingGraphStatus:'provisional_unapproved'})
        }catch{return complete({ok:false,code:'INVALID_SEAM_RESEARCH_OUTPUT',manufacturingApproved:false})}
      })
    })
  }finally{active=false}
}

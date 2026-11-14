// Research inference only. The model is trained on a narrow verified topology
// family; all generated cutlines require EXO's independent seam/geometry QA.
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,existsSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const script=fileURLToPath(new URL('../../download/garment-dxf-library-20261023/tools/exo_contour_decoder_20261102.py',import.meta.url))
const root=()=>path.resolve(process.env.EXO_GARMENTCODEDATA_V2_ROOT||
  path.join(homedir(),'Chat On Steroids Workspace/exo-clothcraft-v2/download/garment-dxf-library-20261023/garmentcodedata-v2'))
let active=false

export async function runResearchContourDecoder20261102(request) {
  if(!request||typeof request!=='object'||Array.isArray(request)||
      Object.keys(request).some(key=>!['sourceId','seed','strength'].includes(key))||
      typeof request.sourceId!=='string'||
      !/^[A-Za-z0-9_-]{1,64}\/\d{2}\/[-A-Za-z0-9_]{1,120}$/.test(request.sourceId)||
      (request.seed!==undefined&&(!Number.isInteger(request.seed)||request.seed<0||request.seed>1000000))||
      (request.strength!==undefined&&(!Number.isFinite(request.strength)||request.strength<0.01||request.strength>0.35)))
    return {ok:false,code:'INVALID_RESEARCH_CONTOUR_REQUEST',manufacturingApproved:false}
  if(active)return {ok:false,code:'RESEARCH_INFERENCE_BUSY',manufacturingApproved:false}
  const dataset=root()
  const checkpoint=path.join(dataset,'training/contour-decoder-research-20261102/model.npz')
  const manifest=path.join(dataset,'training/contour-decoder-research-20261102/manifest.json')
  if(![script,checkpoint,manifest,path.join(dataset,'pattern-index.sqlite3')].every(existsSync))
    return {ok:false,code:'RESEARCH_MODEL_NOT_AVAILABLE',manufacturingApproved:false}
  let evidence
  try {
    const parsed=JSON.parse(readFileSync(manifest,'utf8'))
    if(parsed.trained!==true||parsed.modelType!=='numpy-denoising-autoencoder-contour-v1'||
       parsed.noManufacturingOrFitApproval!==true||!Array.isArray(parsed.metrics?.splits?.test)||
       parsed.metrics.splits.test.length<3||
       !Number.isFinite(parsed.metrics.vertexControlRmseCm?.test))throw Error('Incomplete model evidence')
    const bytes=readFileSync(checkpoint)
    if(bytes.length>2*1024*1024)throw Error('Oversized model')
    evidence={model:'numpy-denoising-autoencoder-contour-v1',
      checkpointSha256:createHash('sha256').update(bytes).digest('hex'),
      trainingGarments:parsed.metrics.splits.train.length,
      validationGarments:parsed.metrics.splits.val.length,
      heldOutTestGarments:parsed.metrics.splits.test.length,
      heldOutContourRmseCm:parsed.metrics.vertexControlRmseCm.test,
      topologyFamilySha256:parsed.familyKeySha256,
      factoryApproved:false,physicalFitVerified:false}
  }catch{return {ok:false,code:'INVALID_RESEARCH_MODEL_EVIDENCE',manufacturingApproved:false}}
  active=true
  try {
    return await new Promise(resolve=>{
      const args=[script,'generate','--root',dataset,'--checkpoint',checkpoint,'--source-id',request.sourceId,
        '--seed',String(request.seed??17),'--strength',String(request.strength??0.12)]
      const child=spawn('python3',args,{stdio:['ignore','pipe','pipe'],env:{...process.env,OPENBLAS_NUM_THREADS:'1'}})
      let stdout='',exceeded=false,finished=false
      const complete=result=>{if(finished)return;finished=true;clearTimeout(timer);resolve(result)}
      const timer=setTimeout(()=>{child.kill('SIGKILL');complete({ok:false,code:'RESEARCH_MODEL_TIMEOUT',manufacturingApproved:false})},45000)
      child.stdout.on('data',chunk=>{
        stdout+=chunk.toString('utf8')
        if(stdout.length>2*1024*1024){exceeded=true;child.kill('SIGKILL')}
      })
      child.stderr.on('data',()=>{})
      child.on('error',()=>complete({ok:false,code:'RESEARCH_MODEL_PROCESS_FAILED',manufacturingApproved:false}))
      child.on('close',code=>{
        if(exceeded)return complete({ok:false,code:'RESEARCH_MODEL_RESPONSE_TOO_LARGE',manufacturingApproved:false})
        try{
          const result=JSON.parse(stdout)
          if(code!==0||result.ok!==true)return complete({ok:false,code:'RESEARCH_MODEL_REJECTED_SOURCE',reason:String(result.error||'Source not supported').slice(0,250),manufacturingApproved:false})
          if(result.sourceId!==request.sourceId||!result.generatedSpec?.pattern?.panels||
             result.sourceVerified!==true||result.generatedCandidateSourceVerified!==false||
             !/^[a-f0-9]{64}$/i.test(result.sourceSha256||'')||
             result.checkpointHash!==evidence.checkpointSha256||
             result.exoQaPassed!==false||result.fitValidated!==false||result.factoryApproved!==false)
            return complete({ok:false,code:'INVALID_RESEARCH_MODEL_OUTPUT',manufacturingApproved:false})
          return complete({...result,researchModelEvidence:evidence,manufacturingApproved:false,
            physicalFitVerified:false,gradedProductionApproved:false})
        }catch{return complete({ok:false,code:'INVALID_RESEARCH_MODEL_OUTPUT',manufacturingApproved:false})}
      })
    })
  }finally{active=false}
}

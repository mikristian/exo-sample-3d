#!/usr/bin/env node
/** Read-only critical-path smoke scoreboard. Not a manufacturing release gate. */
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const argumentsList=process.argv.slice(2)
if(argumentsList.some(arg=>arg!=='--json')){
  process.stderr.write('Usage: node scripts/exo-30day-critical-gates-20261103.mjs [--json]\n')
  process.exit(2)
}

const gates=[
  {id:'AI_CONVERSATION',label:'Conversational pattern proposal and revision',args:['--test','src/core/exoCompanionPatternConversation20261102.test.mjs']},
  {id:'NATIVE_GRADING_FIXTURES',label:'Native grading and size correspondence unit fixtures',args:['--test','src/core/nativeGradeSizeCorrespondence20261028.test.mjs']},
  {id:'DXF_ROUNDTRIP',label:'Manufacturing DXF internal roundtrip tests',args:['--test','src/core/manufacturingDxfRoundtrip.test.mjs']},
  {id:'GRAINLINE_FAIL_CLOSED',label:'Factory grainline adversarial gate',args:['--test','docs/reports/EXO_MODARIS_2D_GRAINLINE_FACTORY_INTEGRITY_RUN106_20261101.gate.mjs']},
  {id:'FACTORY_PACKAGE',label:'Whole factory CUT and marker ZIP package',args:['scripts/check-factory.mjs']},
  {id:'MAC_RELEASE_PREFLIGHT',label:'Immutable staged macOS release preflight',args:['integrations/clothcraft/macos/v2-release-candidate-preflight-20261030.mjs'],requireReady:true},
]

const results=gates.map(gate=>{
  const run=spawnSync(process.execPath,gate.args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,env:{...process.env,EXO_AUDIT_READ_ONLY:'1'}})
  const output=((run.stdout||'')+'\n'+(run.stderr||'')).trim()
  let success=run.status===0 && !run.error
  let issue=run.error?.code||null
  if(gate.requireReady){
    try{
      const preflight=JSON.parse(run.stdout)
      success=preflight.ready===true && success
      if(!success)issue=(preflight.issues||[]).map(item=>item.code).join(', ')||'not-ready'
    }catch{success=false;issue=issue||'invalid-preflight-output'}
  }
  if(!success && !issue){
    const failed=output.match(/ℹ fail\s+(\d+)/)
    const factory=output.match(/Error: Factory package refused: ([^\n]+)/)
    issue=failed?`${failed[1]} failing tests`:factory?factory[1].slice(0,220):output.split('\n').filter(Boolean).at(-1)?.slice(0,180)||'gate exited nonzero'
  }
  return {id:gate.id,label:gate.label,status:success?'pass':'blocked',issue:success?null:issue,exitCode:run.status}
})

const score=results.filter(result=>result.status==='pass').length
const report={schema:'exo.v2.30day.critical-smoke.v1',checkedAt:new Date().toISOString(),
  scope:'Selected source-level tests and preflight only; not industrial readiness or whole-app completion',
  passed:score,total:results.length,results}
if(argumentsList.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n')
else{
  process.stdout.write(`EXO 30-day critical smoke gates: ${score}/${results.length} passing\n`)
  for(const gate of results)process.stdout.write(`${gate.status==='pass'?'PASS':'BLOCKED'}  ${gate.id}${gate.issue?' — '+gate.issue:''}\n`)
  process.stdout.write('This is not app completion, signed release approval, or physical manufacturing acceptance.\n')
}
if(score!==results.length)process.exitCode=1

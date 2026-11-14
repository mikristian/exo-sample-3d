#!/usr/bin/env node
/** Source-level, non-AI apparel CAD acceptance scoreboard. Read-only by design. */
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
if(process.argv.slice(2).some(arg=>arg!=='--json')){
  process.stderr.write('Usage: node scripts/exo-30day-manual-cad-gates-20261103.mjs [--json]\n')
  process.exit(2)
}
const gates=[
  ['TWO_D_ANCHORS','Manual 2D vector/anchor editing','src/core/vectorcraftAnchorPort.test.mjs'],
  ['CONSTRUCTION','Manual panels, darts, geometry guides','src/core/nativeConstructionGuides20261025.test.mjs','src/core/nativeDartPrecision20261023.test.mjs'],
  ['SEAM_TRUEING','Sewn seam geometry trueing','src/core/modarisSeamTrueing20261027.test.mjs'],
  ['GRADING','Native size correspondence and POM','src/core/nativeGradeSizeCorrespondence20261028.test.mjs','src/core/nativeGradingPOM20261025.test.mjs'],
  ['CAD_DXF','Internal manufacturing CAD DXF roundtrip','src/core/industrialCadRoundtripGate20261028.test.mjs','src/core/manufacturingDxfRoundtrip.test.mjs'],
  ['MARKER_CONSTRAINTS','Marker and fabric constraints','src/core/markerManufacturingConstraints20261028.test.mjs'],
  ['TECH_PACK','Pre-export technical pack safety','src/core/techPackPreExportReview.test.mjs'],
  ['SEAM_ALLOWANCE','Adversarial seam allowance manufacturing gate','docs/reports/EXO_MODARIS_2D_SEAM_ALLOWANCE_FAIL_CLOSED_RUN104_20261101.gate.mjs'],
  ['BUTTONHOLE','Adversarial buttonhole manufacturing gate','docs/reports/EXO_MODARIS_2D_BUTTONHOLE_FACTORY_SOURCE_RUN105_20261101.gate.mjs'],
  ['GRAINLINE','Physical CUT grainline manufacturing gate','docs/reports/EXO_MODARIS_2D_GRAINLINE_FACTORY_INTEGRITY_RUN106_20261101.gate.mjs'],
]
const run=(args)=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,
  env:{...process.env,EXO_AUDIT_READ_ONLY:'1'}})
const results=gates.map(([id,label,...files])=>{
  const child=run(['--test',...files])
  const log=(child.stdout||'')+'\n'+(child.stderr||'')
  const passing=child.status===0&&!child.error
  const summary=log.match(/ℹ tests\s+(\d+)[\s\S]*?ℹ pass\s+(\d+)[\s\S]*?ℹ fail\s+(\d+)/)
  return {id,label,status:passing?'pass':'blocked',testCount:summary?Number(summary[1]):null,
    testPassed:summary?Number(summary[2]):null,testFailed:summary?Number(summary[3]):null,
    error:passing?null:child.error?.code||log.match(/ℹ fail\s+(\d+)/)?.[0]||'Nonzero test result'}
})
{
  const child=run(['scripts/check-factory.mjs'])
  const log=(child.stdout||'')+'\n'+(child.stderr||'')
  const good=child.status===0&&!child.error
  results.push({id:'FACTORY_PACKAGE',label:'Full graded CUT marker and factory ZIP',status:good?'pass':'blocked',
    error:good?null:log.match(/Error: Factory package refused: ([^\n]+)/)?.[1]?.slice(0,240)||
      child.error?.code||'Factory package gate failed'})
}
{
  const child=run(['integrations/clothcraft/macos/v2-release-candidate-preflight-20261030.mjs'])
  let preflight=null
  try{preflight=JSON.parse(child.stdout)}catch{}
  const good=child.status===0&&!child.error&&preflight?.ready===true
  results.push({id:'MAC_RELEASE',label:'Native signed candidate source/release preflight',status:good?'pass':'blocked',
    error:good?null:preflight?.issues?.map(x=>x.code).join(', ')||child.error?.code||'Preflight failed'})
}
const passed=results.filter(x=>x.status==='pass').length
const report={schema:'exo.manual-cad.critical-smoke.v1',checkedAt:new Date().toISOString(),passed,total:results.length,
  limits:'Source/fixture tests and native preflight only; no UI gesture witness, third-party CAD receiving, physical fit or factory approval',results}
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n')
else{
  process.stdout.write('EXO non-AI manual CAD critical gates: '+passed+'/'+results.length+' passing\n')
  for(const r of results)process.stdout.write((r.status==='pass'?'PASS':'BLOCKED')+' '+r.id+(r.error?' — '+r.error:'')+'\n')
  process.stdout.write('Not equivalent to factory readiness or installed GUI feature acceptance.\n')
}
if(passed!==results.length)process.exitCode=1

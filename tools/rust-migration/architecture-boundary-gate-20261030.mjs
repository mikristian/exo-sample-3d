#!/usr/bin/env node
// Incremental architecture gate: existing debt is explicitly grandfathered,
// but new core->UI dependencies and new import cycles are rejected.
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildRuntimeOwnershipAudit} from './runtime-ownership-audit.mjs'
import {evaluateArchitectureGraph,loadApplicationSources} from './architecture-dependency-audit-20261030.mjs'

const inheritedCoreUi=new Set()
const inheritedCycles=new Set()
const edgeKey=row=>`${row.from} -> ${row.to}`
const cycleKey=members=>[...members].sort().join(' + ')

export function checkArchitectureBoundaries(report){
  const issues=[]
  for(const row of report.boundaries.coreToComponentsExamples){
    if(!inheritedCoreUi.has(edgeKey(row)))issues.push({
      code:'NEW_CORE_TO_UI_DEPENDENCY',detail:edgeKey(row)
    })
  }
  for(const members of report.cycles.largest){
    if(!inheritedCycles.has(cycleKey(members)))issues.push({
      code:'NEW_SYNCHRONOUS_IMPORT_CYCLE',detail:cycleKey(members)
    })
  }
  if(report.parseFailures.length)issues.push({
    code:'SOURCE_PARSE_FAILURE',detail:JSON.stringify(report.parseFailures.slice(0,3))
  })
  // The graph deliberately caps its examples. If its count exceeds the examples,
  // the gate cannot establish every edge or cycle and must fail closed.
  if(report.boundaries.coreToComponentsReferenceCount>report.boundaries.coreToComponentsExamples.length ||
     report.cycles.count>report.cycles.largest.length)
    issues.push({code:'INCOMPLETE_GRAPH_REPORT',detail:'Audit example limit cannot cover every architectural violation'})
  return {ok:issues.length===0,issues,remainingInherited: {
    coreToComponents:report.boundaries.coreToComponentsReferenceCount,
    cycles:report.cycles.count,
  }}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=evaluateArchitectureGraph(
    buildRuntimeOwnershipAudit(loadApplicationSources(),['src/main.jsx']),
    {limit:2000})
  const result=checkArchitectureBoundaries(report)
  console.log(JSON.stringify(result,null,2))
  if(!result.ok)process.exitCode=1
}

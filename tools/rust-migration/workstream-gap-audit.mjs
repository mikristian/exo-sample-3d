#!/usr/bin/env node
// Read-only migration ownership coverage. Mapping a file to a workstream is
// planning coverage, NOT Rust functional ownership or acceptance.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scopeMatches = (file, scope) => {
  if (scope.endsWith('/')) return file.startsWith(scope)
  if (!scope.includes('*')) return file === scope || file.startsWith(scope + '/')
  const [before, after, ...extra] = scope.split('*')
  if (extra.length || !file.startsWith(before) || !file.endsWith(after)) return false
  return !file.slice(before.length,file.length-after.length).includes('/')
}
export const subsystem = file => {
  const pieces = file.split('/')
  if (pieces[0] === 'src') return pieces.length >= 3 ? pieces.slice(0, 2).join('/') : 'src/root'
  if (pieces[0] === 'integrations') return pieces.slice(0, 2).join('/')
  return pieces[0] ?? '(root)'
}
export function summarizeCoverage(inventory, swarm) {
  if (swarm.workstreams.length !== 20) throw new Error('Expected 20 configured workstreams')
  const records = inventory.records.filter(r => r.category === 'production-code')
  const byId = new Map(swarm.workstreams.map(w => [w.id, {id:w.id, name:w.name,
    matchedFiles:0, matchedLines:0}]))
  const unassigned = [], overlapping = [], groups = new Map(), langs = new Map()
  for (const r of records) {
    const assigned = swarm.workstreams.filter(w => w.scope.some(s => scopeMatches(r.file,s))).map(w => w.id)
    for (const id of assigned) {
      const item = byId.get(id)
      item.matchedFiles++;item.matchedLines+=r.lines
    }
    if (assigned.length > 1) overlapping.push({file:r.file,workstreams:assigned,lines:r.lines})
    if (assigned.length) continue
    unassigned.push({file:r.file,language:r.lang,lines:r.lines,subsystem:subsystem(r.file)})
    const group = subsystem(r.file)
    const agg = groups.get(group)??{subsystem:group,files:0,lines:0}
    agg.files++;agg.lines+=r.lines;groups.set(group,agg)
    const lang = langs.get(r.lang)??{language:r.lang,files:0,lines:0}
    lang.files++;lang.lines+=r.lines;langs.set(r.lang,lang)
  }
  const totalLines=records.reduce((n,r)=>n+r.lines,0)
  const unassignedLines=unassigned.reduce((n,r)=>n+r.lines,0)
  const rank=(a,b)=>b.lines-a.lines || String(a.file??a.subsystem??a.language).localeCompare(String(b.file??b.subsystem??b.language))
  return {
    schema:1, scope:'first-party production files in the existing full-app audit only',
    note:'Workstream assignment is not Rust ownership. Generated, vendor and unverified external code remain excluded by upstream audit.',
    productionFiles:records.length, productionLines:totalLines,
    unassignedFiles:unassigned.length, unassignedLines,
    assignedFiles:records.length-unassigned.length,
    assignedLineSharePercent:totalLines?Number((100*(totalLines-unassignedLines)/totalLines).toFixed(2)):0,
    unmappedBySubsystem:[...groups.values()].sort(rank),
    unmappedByLanguage:[...langs.values()].sort(rank),
    topUnassigned:unassigned.sort(rank).slice(0,50),
    overlaps:overlapping.sort((a,b)=>b.lines-a.lines),
    zeroProductionCoverageWorkstreams:[...byId.values()].filter(w=>w.matchedFiles===0),
    workstreams:[...byId.values()],
  }
}
const calledDirectly = process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)
if (calledDirectly) {
  const root=resolve(fileURLToPath(new URL('../..',import.meta.url)))
  const report=JSON.parse(readFileSync(join(root,'docs/reports/exo-rust-full-app-ownership-inventory.json'),'utf8'))
  const swarm=JSON.parse(readFileSync(join(root,'docs/engineering/exo-rust-swarm-20.json'),'utf8'))
  const result=summarizeCoverage(report,swarm)
  if (process.argv.includes('--write')) {
    const dest=join(root,'docs/reports/exo-rust-W01-coverage-gap-20261021.json')
    if (existsSync(dest)) throw new Error('Refusing to overwrite existing report: '+dest)
    const disk=spawnSync('df',['-Pk',root],{encoding:'utf8'})
    const kb=Number(disk.stdout.trim().split('\n').at(-1)?.split(/\s+/)[3])
    if (disk.status!==0 || !Number.isFinite(kb) || kb<2*1024*1024)
      throw new Error('Below 2 GiB free: refusing report write')
    const queue=spawnSync(process.execPath,['scripts/rust-migration-autopilot.mjs','status'],
      {cwd:root,encoding:'utf8'})
    let state
    try {state=JSON.parse(queue.stdout)} catch {throw new Error('Cannot verify coordinator status')}
    if (queue.status!==0 || state.active?.length) throw new Error('Active migration coordinator: refusing report write')
    writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
    console.log(JSON.stringify({saved:dest,unassignedFiles:result.unassignedFiles,
      unassignedLines:result.unassignedLines,overlaps:result.overlaps.length}))
  } else console.log(JSON.stringify(result,null,2))
}

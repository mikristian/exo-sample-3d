#!/usr/bin/env node
// Conservative source inventory; Rust bridge imports do not establish Rust ownership.
// Enumerates tracked and non-ignored untracked files, without traversing vendor/build trees.
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

const root = resolve(import.meta.dirname, '../..')
const roots = ['src', 'native_app', 'native_cpp', 'native_backend',
  'integrations/clothcraft', 'integrations/clo_sdk', 'rust',
  'ppf_backend', 'techpack-studio/src', 'blender_bridge']
const toolingRoots = ['scripts', 'techpack-studio/scripts', 'tools/rust-migration']
const languages = {
  rs: 'rust', js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  cjs: 'javascript', ts: 'typescript', tsx: 'typescript',
  c: 'cpp', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp',
  hh: 'cpp', mm: 'objc', m: 'objc', swift: 'swift', py: 'python',
  sh: 'shell', css: 'style', scss: 'style', html: 'markup',
}
const under = (file, prefix) => file === prefix || file.startsWith(prefix + '/')
const isTest = file => /(^|\/)(test|tests|qa|fixtures?|__tests__)(\/|$)/i.test(file) ||
  /(^|\/)(qa[-_]|check[-_]|test[-_]|audit[-_])/.test(file) ||
  /(?:\.test\.|\.spec\.|_test\.|_qa\.)/.test(file)
const isGenerated = file => /(^|\/)(target|node_modules|dist|build|vendor|\.cache|\.git)(\/|$)/.test(file)
const matchScope = (file, scope) => {
  if (scope.endsWith('/')) return under(file, scope.slice(0, -1))
  if (!scope.includes('*')) return under(file, scope)
  const [before, after] = scope.split('*')
  return file.startsWith(before) && file.endsWith(after) &&
    file.length >= before.length + after.length
}
const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard',
  '-z', '--', ...roots, ...toolingRoots],
  {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024})
if (git.status !== 0) throw new Error('Source enumeration failed: ' + git.stderr)
const paths = [...new Set(git.stdout.split('\0').filter(Boolean))].sort()
const swarm = JSON.parse(readFileSync(join(root, 'docs/engineering/exo-rust-swarm-20.json'), 'utf8'))
const records = []
for (const file of paths) {
  if (isGenerated(file)) continue
  // git ls-files --cached includes staged/tracked files deleted from the worktree.
  if (!existsSync(join(root, file))) continue
  const lang = languages[file.split('.').at(-1).toLowerCase()]
  if (!lang) continue
  const stats = statSync(join(root, file))
  if (!stats.isFile() || stats.size > 2 * 1024 * 1024) continue
  const source = readFileSync(join(root, file), 'utf8')
  const lines = source.split(/\r?\n/).filter(s => s.trim() && !/^\s*(?:\/\/|#|\*)/.test(s)).length
  // These are reference patches, not compiled Rust ownership. Keep visible
  // separately so a migration cannot inflate ownership by saving patch files.
  const category = file.includes('/rust-patches/') ? 'reference-only' :
    toolingRoots.some(r => under(file,r)) ? 'automation-or-tooling' :
    isTest(file) ? 'qa-or-fixture' : ['style','markup'].includes(lang) ? 'ui-asset' : 'production-code'
  let parseErrors = null
  if (['javascript', 'typescript'].includes(lang)) {
    try { parseErrors = parseSync(file, source).errors.length } catch { parseErrors = -1 }
  }
  const workstreams = swarm.workstreams.filter(w => w.scope.some(s => matchScope(file,s))).map(w => w.id)
  records.push({file, lang, category, lines, parseErrors, workstreams,
    rustBridgeReferences: lang === 'javascript' ? (source.match(/rust[A-Z][A-Za-z0-9]*Kernel/g)||[]).length : 0})
}
const tally = rows => rows.reduce((acc,r) => {
  acc.files++; acc.lines += r.lines
  if (!acc.languages[r.lang]) acc.languages[r.lang] = {files:0,lines:0}
  acc.languages[r.lang].files++; acc.languages[r.lang].lines += r.lines
  return acc
}, {files:0,lines:0,languages:{}})
const production = records.filter(r=>r.category==='production-code')
const unmapped = production.filter(r=>r.workstreams.length===0)
const report = {
  schema:1, generatedAt:new Date().toISOString(),
  scope:{roots,toolingRoots,
    exclusions:['research/oss (upstream-derived, first-party ownership not established)',
      'integrations/clo-connect-licensed (vendor licensing and provenance unverified)',
      'ignored/generated/build/binary assets',
      'integrations/clothcraft/rust-patches (reference patches, not compiled production)'],
    caveat:'File extension and bridge import counts do not prove first-party Rust functional ownership.'},
  production:tally(production),
  uiAssets:tally(records.filter(r=>r.category==='ui-asset')),
  qaAndFixtures:tally(records.filter(r=>r.category==='qa-or-fixture')),
  automationAndTooling:tally(records.filter(r=>r.category==='automation-or-tooling')),
  referenceOnly:tally(records.filter(r=>r.category==='reference-only')),
  parseErrorFiles:records.filter(r=>r.parseErrors!==null && r.parseErrors!==0).map(r=>({file:r.file,errors:r.parseErrors})),
  workstreamCoverage:{mappedProductionFiles:production.length-unmapped.length,
    unmappedProductionFiles:unmapped.length,
    unmappedProductionLines:unmapped.reduce((n,r)=>n+r.lines,0),
    topUnmapped:[...unmapped].sort((a,b)=>b.lines-a.lines).slice(0,30).map(r=>({file:r.file,lang:r.lang,lines:r.lines}))},
  rustOwnership:{verifiedFunctionalRustPercentage:null,
    reason:'Requires first-party provenance, authoritative runtime call graphs and independent acceptance, not source extension share.',
    rustSourceLineSharePercent:production.length ?
      Number((100*production.filter(r=>r.lang==='rust').reduce((n,r)=>n+r.lines,0) /
        production.reduce((n,r)=>n+r.lines,0)).toFixed(2)) : null},
  records,
}
const summary = {production:report.production,uiAssets:report.uiAssets,
  qaAndFixtures:report.qaAndFixtures,automationAndTooling:report.automationAndTooling,
  referenceOnly:report.referenceOnly,
  parseErrorFiles:report.parseErrorFiles,workstreamCoverage:report.workstreamCoverage,
  rustOwnership:report.rustOwnership}
if (process.argv.includes('--write')) {
  const dest=join(root,'docs/reports/exo-rust-full-app-ownership-inventory.json')
  writeFileSync(dest,JSON.stringify(report,null,2)+'\n')
  summary.saved=relative(root,dest)
}
console.log(JSON.stringify(summary,null,2))

#!/usr/bin/env node
// Source-graph inventory for EXO architecture cleanup. Imports reveal possible
// dependencies; they do not establish runtime execution or Rust ownership.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRuntimeOwnershipAudit } from './runtime-ownership-audit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const code = /\.(?:[cm]?js|jsx|tsx?)$/i
const ignored = /(?:^|\/)(?:node_modules|dist|target|build|vendor|__tests__)(?:\/|$)/
const testOrQa = /(?:\.test\.|\.spec\.|(?:^|\/)(?:qa[-_]|check[-_]|test[-_]))/i
const runtimeKinds = new Set(['static-import', 're-export', 'commonjs-require'])
const lex = (a, b) => a.localeCompare(b)

export function evaluateArchitectureGraph(report, { limit = 20 } = {}) {
  const nodes = new Set(report.edges.flatMap(edge => [edge.from, edge.to].filter(Boolean)))
  const links = report.edges.filter(edge => edge.to && runtimeKinds.has(edge.kind))
  const outgoing = new Map([...nodes].map(node => [node, new Set()]))
  const incoming = new Map([...nodes].map(node => [node, new Set()]))
  for (const { from, to } of links) {
    outgoing.get(from).add(to)
    incoming.get(to).add(from)
  }
  const sorted = [...nodes].sort(lex)
  const indices = new Map(), lowlinks = new Map(), onStack = new Set(), stack = []
  let index = 0
  const components = []
  function visit(node) {
    indices.set(node, index)
    lowlinks.set(node, index++)
    stack.push(node)
    onStack.add(node)
    for (const to of [...outgoing.get(node)].sort(lex)) {
      if (!indices.has(to)) {
        visit(to)
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(to)))
      } else if (onStack.has(to)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(to)))
      }
    }
    if (lowlinks.get(node) === indices.get(node)) {
      const members = []
      let next
      do {
        next = stack.pop()
        onStack.delete(next)
        members.push(next)
      } while (next !== node)
      members.sort(lex)
      if (members.length > 1 || outgoing.get(node).has(node)) components.push(members)
    }
  }
  for (const node of sorted) if (!indices.has(node)) visit(node)
  components.sort((a, b) => b.length - a.length || lex(a[0], b[0]))
  const rank = direction => sorted.map(file => ({
    file, count: direction.get(file).size
  })).filter(row => row.count).sort((a, b) => b.count - a.count || lex(a.file, b.file)).slice(0, limit)
  const crossing = links.filter(edge =>
    edge.from.startsWith('src/core/') && edge.to.startsWith('src/components/'))
    .map(({ from, to, kind }) => ({ from, to, kind }))
    .sort((a, b) => lex(a.from, b.from) || lex(a.to, b.to))
  const componentCount = components.length
  const filesInCycles = new Set(components.flat()).size
  const unresolved = report.edges.filter(edge => edge.unresolved)
  return {
    schema: 1,
    scope: 'static JS/TS source imports in selected first-party application paths',
    limitations: [
      'Potential imports do not prove live execution; dynamic imports are excluded from synchronous cycle detection.',
      'Cycles are strongly connected components, not enumerations of every individual cycle.',
      'Unresolved references may include optional assets, generated modules or extensionless paths.',
      'This graph does not assess Rust/C++/Swift ownership or numerical feature parity.'
    ],
    sourceFiles: report.files,
    parsedFiles: report.parsedFiles,
    parseFailures: report.parseFailures,
    importReferences: report.edges.length,
    resolvedSynchronousReferences: links.length,
    potentialReachableFromBrowser: report.potentiallyReachableFiles.length,
    unresolvedRelativeReferences: unresolved.length,
    unresolvedExamples: unresolved.slice(0, limit).map(({ from, specifier }) => ({ from, specifier })),
    cycles: { count: componentCount, filesInCycles, largest: components.slice(0, limit) },
    coupling: { topIncoming: rank(incoming), topOutgoing: rank(outgoing) },
    boundaries: {
      coreToComponentsReferenceCount: crossing.length,
      coreToComponentsExamples: crossing.slice(0, limit)
    }
  }
}

export function loadApplicationSources(rootDir = root) {
  const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--',
    'src', 'integrations/clothcraft', 'techpack-studio/src'], {
    cwd: rootDir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  })
  if (git.status !== 0) throw new Error('git application inventory failed: ' + git.stderr)
  const sources = {}
  for (const path of [...new Set(git.stdout.split('\0').filter(Boolean))].sort(lex)) {
    if (!code.test(path) || ignored.test(path) || testOrQa.test(path)) continue
    try { sources[path] = readFileSync(resolve(rootDir, path), 'utf8') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return sources
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = 'src/main.jsx'
  const result = evaluateArchitectureGraph(buildRuntimeOwnershipAudit(loadApplicationSources(), [entry]))
  if (process.argv.includes('--write')) {
    const path = resolve(root, 'docs/reports/EXO_ARCHITECTURE_DEPENDENCIES_20261030.json')
    writeFileSync(path, JSON.stringify({ ...result, generatedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' })
    console.log(JSON.stringify({ saved: path, sourceFiles: result.sourceFiles,
      synchronousEdges: result.resolvedSynchronousReferences,
      cycles: result.cycles.count, coreToComponents: result.boundaries.coreToComponentsReferenceCount }))
  } else console.log(JSON.stringify(result, null, 2))
  if (result.parseFailures.length) process.exitCode = 1
}

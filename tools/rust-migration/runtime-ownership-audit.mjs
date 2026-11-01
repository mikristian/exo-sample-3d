#!/usr/bin/env node
// Static evidence about JS runtime references. A Rust wrapper reference is not
// proof of a Rust-owned function or an executed WASM code path.
import { parseSync } from 'oxc-parser'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourceExtensions = /\.(?:[cm]?js|jsx|tsx?|mjs)$/i
const bridgeName = /(?:^|\/)rust[A-Z][\w]*Kernel\.[cm]?js$/
const parseable = value => typeof value === 'string' ? value : null
const traversalIgnore = new Set(['parent', 'scope', 'comments', 'tokens'])

export function analyzeRuntimeSource(file, source) {
  const parsed = parseSync(file, source)
  const references = []
  const errors = parsed.errors.map(error => String(error.message ?? error))
  const add = (kind, specifier, offset) => {
    references.push({kind, specifier, offset, bridge: bridgeName.test(specifier ?? '')})
  }
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const item of node) walk(item); return }
    if (node.type === 'ImportDeclaration') add('static-import', parseable(node.source?.value), node.start)
    if (node.type === 'ExportNamedDeclaration' && node.source) add('re-export', parseable(node.source.value), node.start)
    if (node.type === 'ExportAllDeclaration') add('re-export', parseable(node.source?.value), node.start)
    if (node.type === 'ImportExpression') add('dynamic-import', parseable(node.source?.value), node.start)
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require')
      add('commonjs-require', parseable(node.arguments?.[0]?.value), node.start)
    for (const [key, value] of Object.entries(node)) {
      if (!traversalIgnore.has(key) && value && typeof value === 'object') walk(value)
    }
  }
  walk(parsed.program)
  return {file, parseErrors:errors, references:references.sort((a,b)=>a.offset-b.offset || a.kind.localeCompare(b.kind))}
}

export function resolveRelative(from, specifier, files) {
  if (!specifier?.startsWith('.')) return null
  const base=posix.normalize(posix.join(posix.dirname(from),specifier))
  if (base === '..' || base.startsWith('../') || base.startsWith('/')) return null
  for (const candidate of [base, ...['.js','.jsx','.mjs','.cjs','.ts','.tsx','/index.js','/index.ts'].map(ext=>base+ext)]) {
    if (files.has(candidate)) return candidate
  }
  return null
}

export function buildRuntimeOwnershipAudit(sources, entrypoints=[]) {
  const filenames = new Set(Object.keys(sources))
  const records = Object.keys(sources).sort().map(file => analyzeRuntimeSource(file,sources[file]))
  const byName = new Map(records.map(r=>[r.file,r]))
  const edges=[]
  for (const r of records) for (const ref of r.references) {
    const target=resolveRelative(r.file,ref.specifier,filenames)
    edges.push({from:r.file,kind:ref.kind,specifier:ref.specifier,to:target,
      unresolved:ref.specifier?.startsWith('.')===true && target===null,
      external:ref.specifier!==null && !ref.specifier.startsWith('.'),
      nonLiteral:ref.specifier===null,
      rustWrapper:target!==null && bridgeName.test(target)})
  }
  edges.sort((a,b)=>a.from.localeCompare(b.from)||a.kind.localeCompare(b.kind)||String(a.specifier).localeCompare(String(b.specifier)))
  const reachable=new Set(), pending=[...new Set(entrypoints)].sort()
  while (pending.length) {
    const file=pending.shift()
    if (!byName.has(file)||reachable.has(file)) continue
    reachable.add(file)
    for(const edge of edges) if (edge.from===file && edge.to && !reachable.has(edge.to)) pending.push(edge.to)
    pending.sort()
  }
  const parsedFiles=records.filter(r=>r.parseErrors.length===0).length
  return {schema:1,scope:'static JS/TS runtime source references',
    caveat:'Reachability is potential source reachability, not execution. Rust wrapper imports and WASM URLs cannot establish functional Rust ownership.',
    files:records.length,parsedFiles,parseFailures:records.filter(r=>r.parseErrors.length).map(r=>({file:r.file,errors:r.parseErrors})),
    requestedEntrypoints:[...new Set(entrypoints)].sort(),missingEntrypoints:[...new Set(entrypoints)].filter(f=>!byName.has(f)).sort(),
    potentiallyReachableFiles:[...reachable].sort(),
    rustWrapperReferences:edges.filter(e=>e.rustWrapper),unresolvedReferences:edges.filter(e=>e.unresolved),
    edges,verifiedFunctionalRustPercentage:null}
}

function listSources(root) {
  const result=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src','integrations/clothcraft','techpack-studio/src'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024})
  if(result.status!==0) throw new Error('git source inventory failed: '+result.stderr)
  const sources={}
  for(const file of [...new Set(result.stdout.split('\0').filter(Boolean))].sort()) {
    if (!sourceExtensions.test(file) || /(^|\/)(node_modules|dist|target|build|vendor)\//.test(file)) continue
    try {sources[file]=readFileSync(resolve(root,file),'utf8')} catch(e) {if(e.code!=='ENOENT')throw e}
  }
  return sources
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const entries=process.argv.slice(2).filter(arg=>!arg.startsWith('--'))
  const report=buildRuntimeOwnershipAudit(listSources(projectRoot), entries.length?entries:['src/main.jsx'])
  const {edges,potentiallyReachableFiles,rustWrapperReferences,unresolvedReferences,...summary}=report
  console.log(JSON.stringify({...summary,edgeCount:edges.length,
    potentiallyReachableFileCount:potentiallyReachableFiles.length,
    rustWrapperReferenceCount:rustWrapperReferences.length,
    unresolvedRelativeReferenceCount:unresolvedReferences.length},null,2))
  if(report.parseFailures.length || report.missingEntrypoints.length) process.exitCode=1
}

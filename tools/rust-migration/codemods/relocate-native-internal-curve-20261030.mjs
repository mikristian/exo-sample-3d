#!/usr/bin/env node
// Narrow Oxc-guarded codemod: print appearance is core code and must import
// its pure curve sampling from core rather than through the UI component folder.
import { parseSync } from 'oxc-parser'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const oldPath = '../components/nativeInternalCurve.js'
const newPath = './nativeInternalCurve.js'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const target = resolve(root, 'src/core/printPatternAppearance20261025.js')

export function rewriteNativeCurveImport(source) {
  const result = parseSync('src/core/printPatternAppearance20261025.js', source)
  if (result.errors.length) throw new Error('Cannot rewrite source with parser errors')
  const imports = result.program.body.filter(node => node.type === 'ImportDeclaration' &&
    node.source?.value === oldPath)
  if (!imports.length && result.program.body.some(node =>
    node.type === 'ImportDeclaration' && node.source?.value === newPath)) {
    return { source, changed: false, alreadyMigrated: true }
  }
  if (imports.length !== 1) throw new Error('Expected exactly one legacy internal curve import')
  const node = imports[0]
  if (!node.specifiers.some(spec => spec.imported?.name === 'sampleInternalCurve' ||
    (spec.type === 'ImportSpecifier' && spec.local?.name === 'sampleInternalCurve'))) {
    throw new Error('Unexpected old curve import API')
  }
  const start = node.source.start, end = node.source.end
  const original = source.slice(start, end)
  const quote = original[0]
  if (!['"', "'"].includes(quote) || original !== quote + oldPath + quote)
    throw new Error('Unexpected string literal in curve import')
  return { source: source.slice(0, start) + quote + newPath + quote + source.slice(end),
    changed: true, alreadyMigrated: false }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const before = readFileSync(target, 'utf8')
  const outcome = rewriteNativeCurveImport(before)
  if (process.argv.includes('--apply') && outcome.changed)
    writeFileSync(target, outcome.source)
  console.log(JSON.stringify({ target, changed: outcome.changed, alreadyMigrated: outcome.alreadyMigrated,
    applied: Boolean(process.argv.includes('--apply') && outcome.changed) }))
}

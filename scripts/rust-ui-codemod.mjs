#!/usr/bin/env node
// Deterministic JSX -> egui migration inventory and conservative source emitter.
// No language model, network, install, or modifications to the running app.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, resolve, extname, basename } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const root = resolve(import.meta.dirname, '..')
const argv = process.argv.slice(2)
const value = flag => argv[argv.indexOf(flag) + 1]
const emitDir = argv.includes('--emit') ? resolve(value('--emit') || '') : null
const asJson = argv.includes('--json')
const sources = argv.includes('--file') ? [resolve(value('--file'))] : walk(join(root, 'src'))
  .filter(path => ['.jsx', '.tsx'].includes(extname(path)))

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const path = join(directory, item.name)
    return item.isDirectory() ? walk(path) : item.isFile() ? [path] : []
  })
}
function ident(name) {
  return basename(name).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
}
function string(value) { return JSON.stringify(String(value)) }
function uiNode(node, indent = '        ') {
  if (!node) return { code: '', unsupported: [] }
  if (node.type === 'JSXText') {
    const text = node.value.replace(/\s+/g, ' ').trim()
    return { code: text ? `${indent}ui.label(${string(text)});\n` : '', unsupported: [] }
  }
  if (node.type === 'JSXExpressionContainer') {
    if (node.expression.type === 'StringLiteral' || node.expression.type === 'NumericLiteral') {
      return { code: `${indent}ui.label(${string(node.expression.value)});\n`, unsupported: [] }
    }
    return { code: '', unsupported: ['dynamic JSX expression'] }
  }
  if (node.type !== 'JSXElement' || node.openingElement.name.type !== 'JSXIdentifier') {
    return { code: '', unsupported: [node.type] }
  }
  const tag = node.openingElement.name.name
  const attrs = node.openingElement.attributes
  if (attrs.some(attr => attr.type !== 'JSXAttribute' || attr.value && attr.value.type !== 'StringLiteral')) {
    return { code: '', unsupported: [`${tag}: dynamic props/events`] }
  }
  const children = node.children.map(child => uiNode(child, indent + '    '))
  const unsupported = children.flatMap(child => child.unsupported)
  if (unsupported.length) return { code: '', unsupported }
  const content = children.map(child => child.code).join('')
  if (['div', 'section', 'main', 'article', 'header', 'footer', 'aside', 'nav', 'span'].includes(tag)) {
    return { code: `${indent}ui.vertical(|ui| {\n${content}${indent}});\n`, unsupported: [] }
  }
  if (['p', 'label', 'strong', 'b', 'em', 'small', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
    const text = node.children.map(child => child.type === 'JSXText' ? child.value.replace(/\s+/g, ' ').trim() : child.type === 'JSXExpressionContainer' && child.expression.type === 'StringLiteral' ? child.expression.value : null)
    if (text.some(part => part === null)) return { code: '', unsupported: [`${tag}: dynamic content`] }
    return { code: `${indent}ui.label(${string(text.filter(Boolean).join(' '))});\n`, unsupported: [] }
  }
  if (tag === 'button') {
    const text = node.children.map(child => child.type === 'JSXText' ? child.value.trim() : null)
    if (text.some(part => part === null)) return { code: '', unsupported: ['button: dynamic content'] }
    return { code: `${indent}ui.button(${string(text.join(' ').trim())});\n`, unsupported: [] }
  }
  return { code: '', unsupported: [`${tag}: unsupported UI element`] }
}

const rows = []
for (const path of sources) {
  const source = readFileSync(path, 'utf8')
  const row = { file: relative(root, path), jsxElements: 0, hooks: 0, eventHandlers: 0, jsxExpressions: 0, nativeDom: 0, convertible: false, blockers: [], generated: null }
  let ast
  try { ast = parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] }) }
  catch (error) { row.blockers.push(`parse: ${error.message}`); rows.push(row); continue }
  const roots = []
  const staticCandidates = []
  traverse(ast, {
    JSXElement(path) {
      row.jsxElements++
      if (!path.findParent(p => p.isJSXElement())) roots.push(path.node)
      if (uiNode(path.node).unsupported.length === 0) {
        const enclosingConvertible = path.findParent(p => p.isJSXElement() && uiNode(p.node).unsupported.length === 0)
        if (!enclosingConvertible) staticCandidates.push(path.node)
      }
    },
    JSXExpressionContainer() { row.jsxExpressions++ },
    JSXAttribute(path) { if (path.node.name?.name?.startsWith('on')) row.eventHandlers++ },
    CallExpression(path) {
      const callee = path.node.callee
      if (callee.type === 'Identifier' && /^use(State|Effect|Reducer|Memo|Callback|Ref|Context|LayoutEffect)$/.test(callee.name)) row.hooks++
    },
    MemberExpression(path) {
      const o = path.node.object
      if (o.type === 'Identifier' && ['window', 'document', 'localStorage', 'sessionStorage'].includes(o.name)) row.nativeDom++
    },
  })
  row.staticFragments = staticCandidates.length
  // Only emit a compilable Rust UI scaffold when there is exactly one fully static JSX root.
  if (roots.length === 1 && row.hooks === 0 && row.eventHandlers === 0 && row.nativeDom === 0) {
    const converted = uiNode(roots[0])
    row.blockers.push(...converted.unsupported)
    if (!row.blockers.length) {
      row.convertible = true
      row.generated = `// Generated from ${row.file}. Static egui UI only.\n` +
        `pub fn render(ui: &mut egui::Ui) {\n${converted.code}}\n`
    }
  } else {
    if (roots.length !== 1) row.blockers.push(`JSX roots: ${roots.length}`)
    if (row.hooks) row.blockers.push('React hooks/state')
    if (row.eventHandlers) row.blockers.push('event handlers')
    if (row.nativeDom) row.blockers.push('DOM/platform APIs')
  }
  row.fragments = staticCandidates.map((node, i) => {
    const converted = uiNode(node)
    return { name: `fragment_${i + 1}`, code: `// Generated static fragment from ${row.file}. Integration required.\n` +
      `pub fn fragment_${i + 1}(ui: &mut egui::Ui) {\n${converted.code}}\n` }
  })
  rows.push(row)
}
if (emitDir) {
  mkdirSync(emitDir, { recursive: true })
  for (const row of rows.filter(row => row.convertible || row.fragments?.length)) {
    const output = join(emitDir, `${ident(row.file)}.rs`)
    writeFileSync(output, row.generated ?? row.fragments.map(fragment => fragment.code).join('\n'))
    row.output = output
  }
}
const overview = {
  scanned: rows.length,
  eligibleStaticScaffolds: rows.filter(row => row.convertible).length,
  filesWithHooks: rows.filter(row => row.hooks > 0).length,
  filesWithEvents: rows.filter(row => row.eventHandlers > 0).length,
  filesUsingDom: rows.filter(row => row.nativeDom > 0).length,
  jsxElements: rows.reduce((sum, row) => sum + row.jsxElements, 0),
  staticFragmentsFound: rows.reduce((sum, row) => sum + row.staticFragments, 0),
  disclaimer: 'Static fragments only; integration and dynamic behavior translation remain necessary.',
}
if (asJson) console.log(JSON.stringify({ overview, files: rows.map(({ generated, fragments, ...row }) => row) }, null, 2))
else console.log(JSON.stringify(overview, null, 2))

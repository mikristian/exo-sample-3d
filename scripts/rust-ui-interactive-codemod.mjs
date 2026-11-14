#!/usr/bin/env node
// Safe JSX event/state -> native egui controls, leaving unsupported React behavior unchanged.
// This produces reviewable pieces, NOT an automatically integrated component or application.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const parse = require('@babel/parser').parse
const traverse = require('@babel/traverse').default
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const arg = flag => argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined
if (!arg('--file')) throw Error('Usage: node scripts/rust-ui-interactive-codemod.mjs --file source.jsx [--emit output_directory] [--json]')
const sourceFile = resolve(arg('--file'))
const source = readFileSync(sourceFile, 'utf8')
const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] })
const sanitize = value => value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(?=\d)/, '_')
const rustStr = value => JSON.stringify(String(value))
const name = sanitize(basename(sourceFile).replace(/\.[^.]+$/, ''))
const stateDeclarations = []
const controls = []
let inspected = 0
let rejected = 0

function jsxName(node) { return node?.type === 'JSXIdentifier' ? node.name : null }
function attribute(node, name) {
  return node.openingElement.attributes.find(a => a.type === 'JSXAttribute' && jsxName(a.name) === name)
}
function expression(attr) { return attr?.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null }
function initState(node) {
  if (node.type !== 'VariableDeclarator' || node.id.type !== 'ArrayPattern' || node.id.elements.length !== 2) return null
  const [variable, setter] = node.id.elements
  if (variable?.type !== 'Identifier' || setter?.type !== 'Identifier') return null
  const init = node.init
  const callee = init?.callee
  const hook = callee?.type === 'Identifier' && callee.name === 'useState' ||
    callee?.type === 'MemberExpression' && callee.object.name === 'React' && callee.property.name === 'useState'
  if (!hook || init.arguments.length !== 1 || !['BooleanLiteral', 'StringLiteral', 'NumericLiteral'].includes(init.arguments[0].type)) return null
  return { variable: variable.name, setter: setter.name, initial: init.arguments[0].value,
    type: init.arguments[0].type === 'BooleanLiteral' ? 'bool' : init.arguments[0].type === 'StringLiteral' ? 'string' : 'number', start: node.start }
}
function verifyBinding(nodePath, state) {
  // Do not pair similarly named states from different React components/scopes.
  const binding = nodePath.scope.getBinding(state.variable)
  return binding?.path?.node?.start === state.start
}
function parseSetterAction(expr, state) {
  if (expr?.type !== 'ArrowFunctionExpression' || expr.params.length !== 0) return null
  const call = expr.body
  if (call.type !== 'CallExpression' || call.callee.type !== 'Identifier' || call.callee.name !== state.setter || call.arguments.length !== 1) return null
  const next = call.arguments[0]
  if (next.type === 'BooleanLiteral' && state.type === 'bool' || next.type === 'StringLiteral' && state.type === 'string' ||
    next.type === 'NumericLiteral' && state.type === 'number') return { kind: 'set', value: next.value }
  if (state.type === 'bool' && next.type === 'UnaryExpression' && next.operator === '!' && next.argument.type === 'Identifier' && next.argument.name === state.variable) return { kind: 'toggle' }
  if (state.type === 'bool' && next.type === 'ArrowFunctionExpression' && next.params.length === 1 && next.params[0].type === 'Identifier' &&
      next.body.type === 'UnaryExpression' && next.body.operator === '!' && next.body.argument.type === 'Identifier' &&
      next.body.argument.name === next.params[0].name) return { kind: 'toggle' }
  return null
}
function parseInputAction(expr, state, field, numberMode = false) {
  if (expr?.type !== 'ArrowFunctionExpression' || expr.params.length !== 1 || expr.params[0].type !== 'Identifier') return false
  const event = expr.params[0].name
  const call = expr.body
  if (call.type !== 'CallExpression' || call.callee.type !== 'Identifier' || call.callee.name !== state.setter || call.arguments.length !== 1) return false
  const raw = call.arguments[0]
  const next = numberMode && raw?.type === 'CallExpression' && raw.callee.type === 'Identifier' && raw.callee.name === 'Number' && raw.arguments.length === 1
    ? raw.arguments[0] : numberMode ? null : raw
  if (!next) return false
  return next.type === 'MemberExpression' && !next.computed && next.property.name === field &&
    next.object.type === 'MemberExpression' && !next.object.computed && next.object.property.name === 'target' &&
    next.object.object.type === 'Identifier' && next.object.object.name === event
}
function textLabel(node) {
  const aria = attribute(node, 'aria-label')
  if (aria?.value?.type === 'StringLiteral') return aria.value.value
  const label = node.children.flatMap(child => {
    if (child.type === 'JSXText') return [child.value]
    if (child.type === 'JSXElement' && ['span', 'strong', 'small'].includes(jsxName(child.openingElement.name))) {
      return child.children.every(c => c.type === 'JSXText') ? [child.children.map(c => c.value).join(' ')] : []
    }
    return []
  }).join(' ').replace(/\s+/g, ' ').trim()
  return label || null
}
function safeAttributes(node, allowed) {
  // An ignored dynamic attribute could change visibility, disablement or behavior.
  return node.openingElement.attributes.every(a => {
    if (a.type !== 'JSXAttribute') return false
    const key = jsxName(a.name)
    if (allowed.includes(key)) return true
    if (['disabled', 'hidden', 'readOnly', 'value', 'checked', 'onClick', 'onChange', 'onKeyDown', 'onMouseEnter', 'onMouseLeave'].includes(key)) return false
    if (a.value?.type === 'JSXExpressionContainer') return false
    return ['className', 'type', 'role', 'title', 'aria-label', 'id', 'key', 'tabIndex'].includes(key)
  })
}
function propsForCallback(nodePath) {
  const fn = nodePath.getFunctionParent()
  if (!fn) return new Set()
  const params = fn.node.params
  const names = new Set()
  for (const p of params) {
    if (p.type === 'ObjectPattern') for (const prop of p.properties) {
      if (prop.type === 'ObjectProperty' && prop.value.type === 'Identifier' && prop.key.type === 'Identifier') names.add(prop.value.name)
    }
  }
  return names
}
function command(expr, nodePath) {
  let callback
  let args = []
  if (expr?.type === 'Identifier') callback = expr.name
  else if (expr?.type === 'ArrowFunctionExpression' && expr.params.length === 0 && expr.body.type === 'CallExpression' &&
    expr.body.callee.type === 'Identifier' && expr.body.arguments.every(a => a.type === 'StringLiteral')) {
    callback = expr.body.callee.name
    args = expr.body.arguments.map(a => a.value)
  }
  if (!callback || !/^on[A-Z]/.test(callback) || !propsForCallback(nodePath).has(callback)) return null
  return { callback, args }
}
function fieldName(state) {
  const snake = state.variable.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return sanitize(snake + '_' + state.start)
}
function visibility(path) {
  const stateFields = []
  let ancestor = path
  while ((ancestor = ancestor.parentPath)) {
    const node = ancestor.node
    if (node.type === 'ConditionalExpression') return null
    if (node.type !== 'LogicalExpression' || node.operator !== '&&') continue
    if (node.left.type === 'Identifier') {
      const match = stateDeclarations.find(s => s.type === 'bool' && s.variable === node.left.name && verifyBinding(path, s))
      if (!match) return null
      stateFields.push({ state: match, condition: `state.${fieldName(match)}` })
      continue
    }
    const left = node.left
    if (left.type !== 'BinaryExpression' || !['===', '!=='].includes(left.operator) || left.left.type !== 'Identifier' ||
      !['StringLiteral', 'BooleanLiteral'].includes(left.right.type)) return null
    const match = stateDeclarations.find(s => s.variable === left.left.name && verifyBinding(path, s) &&
      s.type === (left.right.type === 'StringLiteral' ? 'string' : 'bool'))
    if (!match) return null
    const rhs = left.right.type === 'BooleanLiteral' ? String(left.right.value) : rustStr(left.right.value)
    stateFields.push({ state: match, condition: `state.${fieldName(match)} ${left.operator === '===' ? '==' : '!='} ${rhs}` })
  }
  return stateFields
}
function selectOptions(node) {
  const options = []
  for (const child of node.children) {
    if (child.type === 'JSXText' && !child.value.trim()) continue
    if (child.type !== 'JSXElement' || jsxName(child.openingElement.name) !== 'option') return null
    if (!child.openingElement.attributes.every(a => a.type === 'JSXAttribute' &&
      ['value', 'key'].includes(jsxName(a.name)) && (!a.value || a.value.type === 'StringLiteral'))) return null
    if (!child.children.every(c => c.type === 'JSXText')) return null
    const label = child.children.map(c => c.value).join('').replace(/\s+/g, ' ').trim()
    const valueAttr = attribute(child, 'value')
    const value = valueAttr?.value?.type === 'StringLiteral' ? valueAttr.value.value : label
    if (!label || !value) return null
    options.push({ label, value })
  }
  return options.length >= 2 && options.length <= 64 ? options : null
}
function sliderBounds(node) {
  const vals = ['min', 'max', 'step'].map(key => {
    const attr = attribute(node, key)
    if (attr?.value?.type !== 'StringLiteral' || attr.value.value.trim() === '') return NaN
    return Number(attr.value.value)
  })
  if (!vals.every(Number.isFinite) || vals[0] >= vals[1] || vals[2] <= 0) return null
  return { min: vals[0], max: vals[1], step: vals[2] }
}
function rustFloat(value) { return Number.isInteger(value) ? Number(value).toFixed(1) : String(value) }

traverse(ast, {
  VariableDeclarator(path) {
    const state = initState(path.node)
    if (state) stateDeclarations.push(state)
  },
})
traverse(ast, {
  JSXElement(path) {
    const node = path.node
    const tag = jsxName(node.openingElement.name)
    if (tag !== 'button' && tag !== 'input' && tag !== 'select') return
    inspected++
    const visibilityStates = visibility(path)
    if (!visibilityStates) { rejected++; return }
    if (tag === 'select') {
      if (!safeAttributes(node, ['value', 'onChange'])) { rejected++; return }
      const current = expression(attribute(node, 'value'))
      const change = expression(attribute(node, 'onChange'))
      const options = selectOptions(node)
      if (current?.type !== 'Identifier' || !options) { rejected++; return }
      const state = stateDeclarations.find(s => s.type === 'string' && s.variable === current.name &&
        verifyBinding(path, s) && parseInputAction(change, s, 'value'))
      const labelParent = path.parentPath?.node?.type === 'JSXElement' && jsxName(path.parentPath.node.openingElement.name) === 'label' ? path.parentPath.node : null
      const label = attribute(node, 'aria-label')?.value?.value || (labelParent && textLabel(labelParent))
      if (!state || !label) { rejected++; return }
      controls.push({ kind: 'select', state, label, options, visibilityStates, start: node.start })
    } else if (tag === 'input') {
      const type = attribute(node, 'type')?.value
      const inputType = type?.type === 'StringLiteral' ? type.value : 'text'
      if (!['checkbox', 'text', 'search', 'range'].includes(inputType)) { rejected++; return }
      const inputProp = inputType === 'checkbox' ? 'checked' : 'value'
      if (!safeAttributes(node, [inputProp, 'onChange', 'placeholder', 'autoFocus', 'min', 'max', 'step'])) { rejected++; return }
      const checked = expression(attribute(node, inputProp))
      const change = expression(attribute(node, 'onChange'))
      if (checked?.type !== 'Identifier') { rejected++; return }
      const stateType = inputType === 'checkbox' ? 'bool' : inputType === 'range' ? 'number' : 'string'
      const bounds = inputType === 'range' ? sliderBounds(node) : null
      if (inputType === 'range' && !bounds) { rejected++; return }
      const state = stateDeclarations.find(s => s.type === stateType && s.variable === checked.name &&
        verifyBinding(path, s) && parseInputAction(change, s, inputType === 'checkbox' ? 'checked' : 'value', inputType === 'range'))
      if (!state) { rejected++; return }
      const labelParent = path.parentPath?.node?.type === 'JSXElement' && jsxName(path.parentPath.node.openingElement.name) === 'label' ? path.parentPath.node : null
      const label = attribute(node, 'aria-label')?.value?.value || (labelParent && textLabel(labelParent))
      if (!label) { rejected++; return }
      controls.push({ kind: inputType === 'checkbox' ? 'checkbox' : inputType === 'range' ? 'slider' : 'text-input',
        state, label, bounds, visibilityStates, start: node.start })
    } else {
      if (!safeAttributes(node, ['onClick', 'aria-pressed', 'aria-expanded'])) { rejected++; return }
      const click = expression(attribute(node, 'onClick'))
      const label = textLabel(node)
      if (!label || !click) { rejected++; return }
      let matched = false
      for (const state of stateDeclarations) {
        if (!verifyBinding(path, state)) continue
        const action = parseSetterAction(click, state)
        if (!action) continue
        const indicator = expression(attribute(node, 'aria-expanded')) || expression(attribute(node, 'aria-pressed'))
        if (indicator && (indicator.type !== 'Identifier' || indicator.name !== state.variable)) continue
        controls.push({ kind: 'state-button', state, label, action, selected: !!indicator, visibilityStates, start: node.start })
        matched = true
        break
      }
      if (!matched) {
        const action = command(click, path)
        if (action) { controls.push({ kind: 'command', label, action, visibilityStates, start: node.start }); matched = true }
      }
      if (!matched) rejected++
    }
  },
})
controls.sort((a, b) => a.start - b.start)
const fields = [...new Map(controls.flatMap(c => [...(c.state ? [c.state] : []), ...c.visibilityStates.map(g => g.state)]).map(s => [fieldName(s), s])).entries()]
const code = [
  `// Generated from ${relative(project, sourceFile)}. Only extracted controls; not a full UI conversion.`,
  '#[derive(Clone, Debug, PartialEq)]',
  'pub struct MigratedUiState {',
  ...fields.map(([field, state]) => `    pub ${field}: ${state.type === 'bool' ? 'bool' : state.type === 'string' ? 'String' : 'f64'},`),
  '}',
  'impl Default for MigratedUiState {',
  '    fn default() -> Self {',
  '        Self {',
  ...fields.map(([field, state]) => `            ${field}: ${state.type === 'bool' ? state.initial : state.type === 'string' ? `String::from(${rustStr(state.initial)})` : rustFloat(state.initial)},`),
  '        }',
  '    }',
  '}',
  '',
  '// Dispatch is an adapter to the verified native command system; no action is executed implicitly.',
  'pub trait UiCommandSink { fn dispatch(&mut self, command: &str, args: &[&str]); }',
  '',
  ...controls.flatMap((c, index) => {
    const body = []
    if (c.kind === 'checkbox') body.push(`    ui.checkbox(&mut state.${fieldName(c.state)}, ${rustStr(c.label)});`)
    if (c.kind === 'text-input') {
      body.push(`    ui.label(${rustStr(c.label)});`)
      body.push(`    ui.text_edit_singleline(&mut state.${fieldName(c.state)});`)
    }
    if (c.kind === 'select') {
      body.push(`    ui.label(${rustStr(c.label)});`)
      body.push(`    egui::ComboBox::from_id_salt(${rustStr('exo_' + name + '_' + c.start)})`)
      body.push(`        .selected_text(state.${fieldName(c.state)}.clone())`)
      body.push(`        .show_ui(ui, |ui| {`)
      for (const option of c.options) body.push(`            ui.selectable_value(&mut state.${fieldName(c.state)}, String::from(${rustStr(option.value)}), ${rustStr(option.label)});`)
      body.push('        });')
    }
    if (c.kind === 'slider') {
      body.push(`    ui.add(egui::Slider::new(&mut state.${fieldName(c.state)}, ${rustFloat(c.bounds.min)}..=${rustFloat(c.bounds.max)})`)
      body.push(`        .step_by(${rustFloat(c.bounds.step)}).text(${rustStr(c.label)}));`)
    }
    if (c.kind === 'state-button') {
      const widget = c.selected ? `ui.selectable_label(state.${fieldName(c.state)}, ${rustStr(c.label)})` : `ui.button(${rustStr(c.label)})`
      body.push(`    if ${widget}.clicked() {`)
      body.push(`        state.${fieldName(c.state)} = ${c.action.kind === 'toggle' ? `!state.${fieldName(c.state)}` : c.state.type === 'string' ? `String::from(${rustStr(c.action.value)})` : c.state.type === 'number' ? rustFloat(c.action.value) : c.action.value};`)
      body.push('    }')
    }
    if (c.kind === 'command') {
      body.push(`    if ui.button(${rustStr(c.label)}).clicked() {`)
      body.push(`        sink.dispatch(${rustStr(c.action.callback)}, &[${c.action.args.map(rustStr).join(', ')}]);`)
      body.push('    }')
    }
    // Explicitly gate controls that were under a simple Boolean `flag && <...>` branch.
    const guardedBody = c.visibilityStates.reduceRight((inner, gate) => [
      `    if ${gate.condition} {`,
      ...inner.map(line => '    ' + line),
      '    }',
    ], body)
    const signature = c.kind === 'command'
      ? 'ui: &mut egui::Ui, sink: &mut impl UiCommandSink'
      : 'ui: &mut egui::Ui, state: &mut MigratedUiState'
    // Commands inside conditional panels need state too, even though they don't mutate it.
    const withGates = c.kind === 'command' && c.visibilityStates.length
      ? 'ui: &mut egui::Ui, state: &MigratedUiState, sink: &mut impl UiCommandSink' : signature
    return [`/// JSX control offset ${c.start}: ${c.kind}. Wiring into native panel required.`, `pub fn render_control_${index + 1}(${withGates}) {`, ...guardedBody, '}', '']
  }),
].join('\n')
let output
if (arg('--emit') && controls.length) {
  const dir = resolve(arg('--emit'))
  mkdirSync(dir, { recursive: true })
  output = join(dir, name + '_interactive.rs')
  writeFileSync(output, code + '\n')
}
const summary = { file: relative(project, sourceFile), controls: controls.length,
  stateControls: controls.filter(c => c.kind !== 'command').length,
  textControls: controls.filter(c => c.kind === 'text-input').length,
  selectControls: controls.filter(c => c.kind === 'select').length,
  sliderControls: controls.filter(c => c.kind === 'slider').length,
  gatedControls: controls.filter(c => c.visibilityStates.length > 0).length,
  commandControls: controls.filter(c => c.kind === 'command').length,
  rejectedControls: rejected, inspectedControls: inspected, output,
  note: 'Supported simple Boolean state/checkbox and callback-dispatch controls only; visual parity and complete component lifecycle NOT established.' }
if (argv.includes('--json')) console.log(JSON.stringify(summary))
else console.log(JSON.stringify(summary, null, 2))

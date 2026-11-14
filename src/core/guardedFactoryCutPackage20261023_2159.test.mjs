import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {
  auditFactoryPackageCutSafety20261023_2159 as audit,
  buildGuardedFactoryPackageFiles20261023_2159 as guardedBuild,
} from './guardedFactoryCutPackage20261023_2159.mjs'

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const encoder = new TextEncoder()
const copyFiles = files => Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, new Uint8Array(bytes)]))
const patternNames = files => Object.keys(files).filter(path => /^patterns\/[^/]+\.dxf$/i.test(path)).sort()
// Synthetic receiving-side bytes, never produced by the guarded factory builder.
const cutDxf = rectangles => [
  '0','SECTION','2','ENTITIES',
  ...rectangles.flatMap(([layer,x0,y0,x1,y1]) => [
    '0','LWPOLYLINE','8',layer,'90','4','70','1',
    '10',String(x0),'20',String(y0),
    '10',String(x1),'20',String(y0),
    '10',String(x1),'20',String(y1),
    '10',String(x0),'20',String(y1),
  ]),
  '0','ENDSEC','0','EOF','',
].join('\n')

function overlapProject() {
  const base = createTeeTemplate()
  const makeRectangle = (id, name) => ({
    ...structuredClone(base.pieces[0]), id, name,
    points: [{x:0,y:0}, {x:20,y:0}, {x:20,y:20}, {x:0,y:20}],
    curves: {}, seamAllowance:6, edgeSeamAllowances:{},
    notches:[], internalLines:[], buttonholes:[],
  })
  return {...base, productionSpec:undefined, pieces:[makeRectangle('packing-a','Packing A'), makeRectangle('packing-b','Packing B')], seams:[]}
}

function rejected(result, label) {
  assert.equal(result.ok, false, `${label}: ${JSON.stringify(result)}`)
  assert.equal(result.manufacturingApproved, false, label)
}

test('six-size Foundation Tee package has six independently audited physical CUT files', () => {
  const project = createTeeTemplate()
  const original = structuredClone(project)
  assert.deepEqual(project.grading.sizes, sizes)
  const files = buildFactoryPackageFiles(project)
  assert.equal(patternNames(files).length, 6)
  const snapshot = copyFiles(files)
  const result = audit(files, sizes)
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.manufacturingApproved, false)
  assert.deepEqual(files, snapshot, 'audit preserves every input byte')
  assert.deepEqual(project, original, 'package building and audit preserve source project')
})

test('guarded builder preserves source and never grants manufacturing approval', () => {
  const project = createTeeTemplate()
  const snapshot = structuredClone(project)
  const files = guardedBuild(project)
  assert.ok(files && typeof files === 'object')
  assert.equal(patternNames(files).length, sizes.length)
  const readiness = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(files['manufacturing-release-readiness.json']))
  assert.equal(readiness.factoryCertified, false)
  assert.equal(readiness.factoryCuttingAuthorized, false)
  assert.equal(readiness.bulkProductionAuthorized, false)
  assert.deepEqual(project, snapshot)
})

test('two 20cm rectangles with 6cm allowances are rejected before any factory bytes exist', () => {
  const project = overlapProject()
  const snapshot = structuredClone(project)
  assert.throws(() => buildFactoryPackageFiles(project),
    /Factory package refused: unsafe physical CUT contours.*PHYSICAL_CUT_INTERIOR_OVERLAP/,
    'unguarded builder must fail closed before returning unsafe bytes')
  assert.throws(() => guardedBuild(project), error =>
    error?.code === 'UNSAFE_FACTORY_DXF' &&
    error.diagnostics?.some(issue => issue.code === 'FACTORY_PACKAGE_BUILD_FAILED'),
  'cannot expose unsafe factory package bytes')
  assert.deepEqual(project, snapshot)
})

test('receiving audit rejects independent disposable CUT overlap and containment bytes', () => {
  const source = buildFactoryPackageFiles(createTeeTemplate())
  const target = patternNames(source).find(path => path.endsWith('-xs.dxf'))
  assert.ok(target?.endsWith('-xs.dxf'))
  const cases = [
    [['CUT_XS_SHELL',0,0,20,20],['CUT_XS_LINING',10,10,30,30]],
    [['CUT_XS_SHELL',0,0,20,20],['CUT_XS_LINING',5,5,10,10]],
  ]
  for (const [index, contours] of cases.entries()) {
    const files = copyFiles(source)
    files[target] = encoder.encode(cutDxf(contours))
    const before = copyFiles(files)
    const result = audit(files, sizes)
    rejected(result, `synthetic unsafe CUT case ${index}`)
    assert.ok(result.diagnostics.some(issue => issue.code === 'PHYSICAL_CUT_INTERIOR_OVERLAP'),
      JSON.stringify(result.diagnostics))
    assert.equal(result.checks.find(check => check.path === target)?.physicalCutOk, false)
    assert.deepEqual(files, before, 'inspection must not modify synthetic factory bytes')
  }
})

test('receiving audit accepts disjoint disposable CUT contours without authorizing cutting', () => {
  const files = copyFiles(buildFactoryPackageFiles(createTeeTemplate()))
  const [target] = patternNames(files)
  files[target] = encoder.encode(cutDxf([
    ['CUT_XS_SHELL',0,0,20,20],['CUT_XS_LINING',25,0,45,20],
  ]))
  const result = audit(files, sizes)
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  assert.equal(result.manufacturingApproved, false)
  assert.equal(result.checks.find(check => check.path === target)?.contourCount, 2)
})

test('one missing size DXF blocks whole package', () => {
  const files = copyFiles(buildFactoryPackageFiles(createTeeTemplate()))
  const removed = patternNames(files).find(name => name.endsWith('-xl.dxf'))
  assert.ok(removed, 'fixture must contain XL DXF')
  delete files[removed]
  rejected(audit(files, sizes), 'missing XL')
})

test('malformed UTF-8 bytes block the entire package', () => {
  const files = copyFiles(buildFactoryPackageFiles(createTeeTemplate()))
  const [dxf] = patternNames(files)
  assert.ok(dxf)
  files[dxf] = Uint8Array.from([0xc3,0x28,0xff,0xfe])
  rejected(audit(files, sizes), 'malformed UTF-8')
})

test('zero physical CUT entities are rejected even when DXF envelope remains syntactically plausible', () => {
  const files = copyFiles(buildFactoryPackageFiles(createTeeTemplate()))
  const [dxf] = patternNames(files)
  const text = new TextDecoder('utf-8', {fatal:true}).decode(files[dxf])
  const withoutCut = text.replace(/CUT_/g, 'OTHER_')
  assert.notEqual(text, withoutCut, 'fixture must contain CUT entities')
  files[dxf] = encoder.encode(withoutCut)
  rejected(audit(files, sizes), 'zero physical CUT')
})

test('malformed DXF section envelope is rejected while remaining files stay intact', () => {
  const files = copyFiles(buildFactoryPackageFiles(createTeeTemplate()))
  const [dxf] = patternNames(files)
  const text = new TextDecoder('utf-8', {fatal:true}).decode(files[dxf])
  assert.match(text, /\bENDSEC\b/)
  const broken = text.replace(/\bENDSEC\b/, 'BROKEN_SECTION_TERMINATOR')
  files[dxf] = encoder.encode(broken)
  rejected(audit(files, sizes), 'malformed DXF envelope')
})

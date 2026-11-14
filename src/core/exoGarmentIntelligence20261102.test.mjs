import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseExoGarment20261102 } from './exoGarmentIntelligence20261102.js'
import { createDefaultProject } from '../data/defaultProject.js'

const codes = result => result.issues.map(issue => issue.code)

test('missing project and empty pattern produce prioritized actionable blockers', () => {
  const absent = diagnoseExoGarment20261102(null)
  assert.equal(absent.issues[0].code, 'project_missing')
  assert.equal(absent.productionReady, false)
  const empty = diagnoseExoGarment20261102({ pieces: [] })
  assert.ok(codes(empty).includes('pieces_missing'))
  assert.ok(empty.summary.blockingIssueCount > 0)
})

test('existing EXO default project is inspected without false missing sewing and grading claims or mutation', () => {
  const source = createDefaultProject()
  const original = structuredClone(source)
  const result = diagnoseExoGarment20261102(source)
  assert.equal(result.summary.pieceCount, 4)
  assert.equal(result.summary.seamCount, source.seams.length)
  assert.equal(result.summary.sizeCount, 6)
  for (const code of ['pieces_missing', 'seams_missing', 'grading_missing', 'invalid_seam_endpoint', 'invalid_notch']) assert.ok(!codes(result).includes(code), code)
  assert.ok(codes(result).includes('techpack_missing'))
  assert.equal(result.productionReady, false)
  assert.deepEqual(source, original)
})

test('invalid seam references, notch positions, per-edge allowances and fabric assignments are detected', () => {
  const source = createDefaultProject()
  source.pieces[0].fabricId = 'does-not-exist'
  source.pieces[0].notches[0].t = 1.2
  source.pieces[0].edgeSeamAllowances = { 400: 1, 2: -1 }
  source.seams[0].a.edgeIndex = 900
  source.pieces.push({ ...structuredClone(source.pieces[0]), id: 'front' })
  const result = diagnoseExoGarment20261102(source)
  for (const code of ['fabric_assignment_missing', 'invalid_notch', 'invalid_edge_allowance', 'invalid_seam_endpoint', 'duplicate_piece_id']) assert.ok(codes(result).includes(code), code)
  assert.equal(result.issues[0].severity, 'critical')
})

test('techpack and size diagnostics use native draft shape and report remaining evidence limits', () => {
  const source = createDefaultProject()
  source.grading = { sizes: ['S', 'S'], baseSize: 'M' }
  const draft = { kind: 'exo-native-techpack-v2', draft: { styleName: 'Test tee', sku: 'T-1', pom: { chest: 102 }, bom: [{ name: 'Cotton jersey' }], references: ['ref.png'] } }
  const result = diagnoseExoGarment20261102(source, draft)
  assert.ok(codes(result).includes('grading_sizes_invalid'))
  assert.ok(codes(result).includes('grading_base_missing'))
  for (const code of ['pom_missing', 'bom_missing', 'techpack_missing']) assert.ok(!codes(result).includes(code), code)
  for (const code of ['fit_unverified', 'fabric_testing_unverified', 'factory_release_unverified']) assert.ok(codes(result).includes(code), code)
  assert.equal(result.productionReady, false)
})

test('all complete metadata still requires independent physical and manufacturing review', () => {
  const source = createDefaultProject()
  const techPack = { draft: { styleName: 'Sample', sku: 'A-1', pom: [{ name: 'Chest', value: 98 }], bom: [{ name: 'Main fabric' }], references: ['sample'] } }
  const result = diagnoseExoGarment20261102(source, techPack)
  assert.equal(result.summary.blockingIssueCount, 0)
  assert.equal(result.status, 'review_required')
  assert.equal(result.productionReady, false)
  assert.match(result.caveat, /No simulation/)
})

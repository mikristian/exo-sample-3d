import test from 'node:test'
import assert from 'node:assert/strict'
import { planPrintPages20261025, createPrintPdf20261025, auditPrintLayout20261025 } from './printLayout20261025.js'

const read = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const shape = { id: 'graded-M-front', name: 'Front M', widthCm: 10, heightCm: 10, points: [[0,0],[10,0],[10,10],[0,10]] }

test('graded piece identity and non-100% print scale remain visible in each emitted PDF tile', () => {
  for (const scale of [50, 125, 150]) {
    const plan = planPrintPages20261025({ widthCm: 12, heightCm: 12, paper: 'A4', scale })
    const pdf = read(createPrintPdf20261025({ pieces: [shape], placements: { [shape.id]: { x: 1, y: 1 } }, plan, fabricId: 'shell-M', revision: 'grade-42', includeCalibrationPage: true }))
    const streams = [...pdf.matchAll(/stream\n([\s\S]*?)endstream/g)].map(match => match[1])
    assert.equal(streams.length, plan.pages.length + 1)
    assert.match(streams[0], /100 x 100 mm actual-size calibration/)
    assert.match(streams[0], new RegExp(`Pattern ${scale}% \\| Calibrator stays 100 mm`))
    for (const tile of streams.slice(1)) {
      assert.ok(tile.includes(`${scale / 100} 0 0 ${scale / 100} `), `scale ${scale}% must be encoded as pattern CTM`)
      assert.ok(tile.includes(`(shell-M | grade-42 | `), 'grade revision and fabric identity must be attached to every tile')
      assert.ok(tile.includes(`| ${scale}% | ruler`), 'scale must be labeled on the tile')
      assert.match(tile, /1 0 0 1 1 1 cm\n0 0 m\n10 0 l\n10 10 l\n0 10 l\nh S/)
    }
  }
})

test('print readiness audit and direct PDF exporter both fail closed on a missing graded piece', () => {
  const second = { ...shape, id: 'graded-L-front', name: 'Front L' }
  const pieces = [shape, second]
  const placements = { [shape.id]: { x: 1, y: 1 } }
  assert.match(auditPrintLayout20261025(pieces, placements, 20).join(' '), /Front L: unplaced/)
  const plan = planPrintPages20261025({ widthCm: 20, heightCm: 15, paper: 'A4' })
  assert.throws(
    () => createPrintPdf20261025({ pieces, placements, plan, revision: 'grade-42' }),
    /Cannot export PDF: unplaced pattern piece graded-L-front/
  )
  assert.throws(
    () => createPrintPdf20261025({ pieces: [shape, shape], placements: { [shape.id]: { x: 1, y: 1 } }, plan }),
    /Invalid or duplicate PDF pattern piece ID/
  )
  assert.throws(
    () => createPrintPdf20261025({ pieces: [shape], placements: { [shape.id]: { x: NaN, y: 1 } }, plan }),
    /Invalid marker placement/
  )
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { planPrintPages20261025, createPrintPdf20261025 } from './printLayout20261025.js'
import { makeMarkerCalibrationSheet20261024 } from './accumarkMarkerCalibrationSheet20261024.mjs'
import { markerToPdf } from './markerArtifacts.js'

const PT_PER_CM = 72 / 2.54
const near = (actual, expected, label, tolerance = .0002) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} PDF pt versus ${expected}`)
const pages = bytes => {
  const pdf = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const boxes = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]), Number(m[2])])
  const streams = [...pdf.matchAll(/stream\n([\s\S]*?)endstream/g)].map(m => m[1])
  assert.equal(boxes.length, streams.length, 'Each PDF page must contain a content stream')
  return boxes.map((box, index) => ({ box, stream: streams[index] }))
}

test('direct print PDF actual vector CTM, 100 x 100 mm square, page MediaBox and independent 100% pattern', () => {
  const plan = planPrintPages20261025({ widthCm: 12, heightCm: 12, paper: 'A4', scale: 100 })
  const shape = { id: 'square', points: [[0, 0], [10, 0], [10, 10], [0, 10]] }
  const [witness, tile] = pages(createPrintPdf20261025({ pieces: [shape], placements: { square: { x: 1, y: 1 } }, plan, includeCalibrationPage: true }))
  for (const [index, page] of [witness, tile].entries()) {
    near(page.box[0], 21 * PT_PER_CM, `page ${index} width`)
    near(page.box[1], 29.7 * PT_PER_CM, `page ${index} height`)
  }
  const transform = witness.stream.match(/([\d.]+) 0 0 (-[\d.]+) 0 ([\d.]+) cm\n/)
  assert.ok(transform, 'Calibration vector must carry a measurable centimeter-to-points transform')
  near(Number(transform[1]), PT_PER_CM, 'calibration X CTM')
  near(Number(transform[2]), -PT_PER_CM, 'calibration Y CTM')
  near(Number(transform[3]), 29.7 * PT_PER_CM, 'calibration Y origin')
  const square = witness.stream.match(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re S/)
  assert.ok(square, 'PDF must actually draw the vector calibration rectangle')
  near(Number(square[3]) * Number(transform[1]), 10 * PT_PER_CM, 'rectangle X=100mm')
  near(Number(square[4]) * Math.abs(Number(transform[2])), 10 * PT_PER_CM, 'rectangle Y=100mm')
  assert.match(witness.stream, /1\.2 12\.1 m 11\.2 12\.1 l S/, 'Independent X calibration vector')
  assert.match(witness.stream, /12 1\.8 m 12 11\.8 l S/, 'Independent Y calibration vector')
  const tileTransform = tile.stream.match(/([\d.]+) 0 0 (-[\d.]+) 0 ([\d.]+) cm/)
  assert.ok(tileTransform)
  near(Number(tileTransform[1]), PT_PER_CM, 'pattern PDF X CTM')
  near(Number(tileTransform[2]), -PT_PER_CM, 'pattern PDF Y CTM')
  assert.match(tile.stream, /1 0 0 1 0\.5 0\.5 cm/, '100% nested pattern transform')
  assert.match(tile.stream, /1 0 0 1 1 1 cm\n0 0 m\n10 0 l\n10 10 l\n0 10 l\nh S/, 'Real 10cm pattern vector path')
})

test('separate marker PDF sheet encodes 120mm media and independent X/Y 100mm vectors', () => {
  const [page] = pages(makeMarkerCalibrationSheet20261024({size:'M',fabricId:'main'}).pdf)
  near(page.box[0], 12 * PT_PER_CM, 'sheet MediaBox width')
  near(page.box[1], 12 * PT_PER_CM, 'sheet MediaBox height')
  const points = [...page.stream.matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S/g)]
  assert.ok(points.some(m => Math.abs(Number(m[3])-Number(m[1])-10*PT_PER_CM)<.0002 && Number(m[2])===Number(m[4])), '100mm horizontal PDF ink')
  assert.ok(points.some(m => Math.abs(Number(m[4])-Number(m[2])-10*PT_PER_CM)<.0002 && Number(m[1])===Number(m[3])), '100mm vertical PDF ink')
})

test('factory marker calibrated PDF has 100mm ruler in PDF points and true MediaBox', () => {
  const [page] = pages(markerToPdf({width:80,length:50,placements:[]}, {calibration:true}))
  near(page.box[0], 80 * PT_PER_CM, 'marker MediaBox width')
  near(page.box[1], 50 * PT_PER_CM, 'marker MediaBox height')
  const strokes = [...page.stream.matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S/g)]
  assert.ok(strokes.some(m => Math.abs(Number(m[3])-Number(m[1])-10*PT_PER_CM)<.0002 && Number(m[2])===Number(m[4])), 'Factory marker 100mm vector ruler')
})

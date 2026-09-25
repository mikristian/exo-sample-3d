import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'native_backend/fixtures/tee.native-sim.json')
const resultPath = path.join(root, 'native_backend/output/tee.native-result.json')

execFileSync('node', [path.join(root, 'scripts/export-native-sim-fixture.mjs'), 'tee', fixture], {
  cwd: root,
  stdio: 'pipe',
})
const input = JSON.parse(fs.readFileSync(fixture, 'utf8'))

const buildOutput = execFileSync(path.join(root, 'native_backend/scripts/build_garment_xpbd_cli.sh'), [], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim().split(/\r?\n/)
const binary = buildOutput.at(-1)
if (!binary || !fs.existsSync(binary)) throw new Error('Native garment XPBD binary was not produced')

const stdout = execFileSync(binary, [fixture, resultPath, '60'], {
  cwd: root,
  encoding: 'utf8',
})
const summary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1))
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))

if (result.backendId !== 'native-pbd-xpbd') throw new Error(`Unexpected native backend: ${result.backendId}`)
if (result.frames !== 60) throw new Error(`Expected 60 frames, got ${result.frames}`)
if (result.pieces?.length !== 4) throw new Error(`Expected 4 tee pieces, got ${result.pieces?.length}`)
if (result.stats?.particles !== input.particles.length) throw new Error(`Expected ${input.particles.length} particles, got ${result.stats?.particles}`)
if (result.stats?.constraints !== input.constraints.length) throw new Error(`Expected ${input.constraints.length} constraints, got ${result.stats?.constraints}`)
if (result.stats?.anchors !== input.anchors.length) throw new Error(`Expected ${input.anchors.length} fit anchors, got ${result.stats?.anchors}`)
if (result.stats?.finite !== true) throw new Error('Native garment result contains non-finite positions')
if (!(result.stats.averageConstraintError < 0.01)) throw new Error(`Native average constraint error too large: ${result.stats.averageConstraintError}`)
if (!(result.stats.maxConstraintError < 0.12)) throw new Error(`Native peak constraint error too large: ${result.stats.maxConstraintError}`)
if (!(result.stats.seamAverageDistance < 0.02)) throw new Error(`Native average seam gap too large: ${result.stats.seamAverageDistance}`)
if (!(result.stats.seamMaxDistance < 0.08)) throw new Error(`Native peak seam gap too large: ${result.stats.seamMaxDistance}`)

for (const piece of result.pieces) {
  if (!piece.id || !piece.vertices?.length || !piece.faces?.length) throw new Error(`Native result lost geometry for piece ${piece.id || '<missing id>'}`)
  if (!piece.vertices.flat().every(Number.isFinite)) throw new Error(`Native result contains non-finite vertices in ${piece.id}`)
}

const vertices = result.pieces.flatMap((piece) => piece.vertices)
const ys = vertices.map((vertex) => vertex[1])
const minY = Math.min(...ys)
const maxY = Math.max(...ys)
if (!(minY > 1.0 && minY < 1.15)) throw new Error(`Native tee body collision bounds regressed: minY=${minY}`)
if (!(maxY > 1.65 && maxY < 1.78)) throw new Error(`Native tee upper bound regressed: maxY=${maxY}`)

console.log(JSON.stringify({
  ...summary,
  errorsMm: {
    averageConstraint: Number((result.stats.averageConstraintError * 1000).toFixed(2)),
    peakConstraint: Number((result.stats.maxConstraintError * 1000).toFixed(2)),
    averageSeam: Number((result.stats.seamAverageDistance * 1000).toFixed(2)),
    peakSeam: Number((result.stats.seamMaxDistance * 1000).toFixed(2)),
  },
  bodyBoundsM: { minY: Number(minY.toFixed(3)), maxY: Number(maxY.toFixed(3)) },
}, null, 2))

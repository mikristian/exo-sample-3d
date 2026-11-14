import { unzipSync, strFromU8 } from 'fflate'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildFactoryPackageZip } from '../src/core/factoryPackage.js'

const project = createZipHoodieTemplate()
// Use fabric widths that can accommodate every physical CUT instance in the
// six-size run. The intentionally unplaceable 90 cm rib is checked separately.
project.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 110 } }
const archive = unzipSync(buildFactoryPackageZip(project))
const names = Object.keys(archive).sort()
const required = [
  'README.txt',
  'manifest.json',
  'factory-spec.html',
  'tech-pack.json',
  'pom-spec.csv',
  'materials-bom.csv',
  'pattern-pieces.csv',
  'construction-seams.csv',
  'marker-summary.csv',
  'trims-hardware.json',
  'size-run.json',
  'garment-source.json',
]
for (const name of required) if (!archive[name]) throw new Error(`Factory package missing ${name}`)
for (const size of project.grading.sizes) {
  const name = `patterns/foundation-zip-hoodie-${size.toLowerCase()}.dxf`
  const bytes = archive[name]
  if (!bytes) throw new Error(`Factory package missing ${size} DXF`)
  const dxf = strFromU8(bytes)
  if (/NaN|Infinity/.test(dxf) || !dxf.trim().endsWith('EOF')) throw new Error(`Invalid ${size} DXF in factory package`)
}
const techPack = JSON.parse(strFromU8(archive['tech-pack.json']))
if (techPack.markers.M.fabricWidthCm !== 165 || techPack.markers.M.gapCm !== 2) throw new Error('Factory package ignored configured marker settings')
if (techPack.markers.M.byFabric?.rib?.fabricWidthCm !== 110) throw new Error('Factory package ignored rib marker width override')
for (const size of project.grading.sizes) {
  for (const [fabricId, marker] of Object.entries(techPack.markers[size]?.byFabric || {})) {
    const expected = project.pieces.filter(piece => (piece.fabricId || 'main') === fabricId)
      .reduce((sum, piece) => sum + (piece.cutQuantity ?? 1), 0)
    if (marker.requestedPieces !== expected || marker.placedPieces !== expected || marker.unusedPieces !== 0 || marker.unplaced?.length) {
      throw new Error(`Incomplete factory marker for ${size}/${fabricId}: ${JSON.stringify(marker)}`)
    }
  }
}
const markerCsv = strFromU8(archive['marker-summary.csv'])
if (markerCsv.includes('needs >=')) throw new Error('Valid-width factory marker CSV unexpectedly reports overflow')
const html = strFromU8(archive['factory-spec.html'])
if (!html.includes('Point of Measurement') || !html.includes('Construction / Seam Diagnostics') || !html.includes(project.name)) throw new Error('Factory spec HTML is incomplete')
const manifest = JSON.parse(strFromU8(archive['manifest.json']))
if (manifest.files.length !== names.length) throw new Error(`Factory package manifest mismatch: ${manifest.files.length}/${names.length}`)
const tooNarrow = createZipHoodieTemplate()
tooNarrow.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 90 } }
let narrowError = null
try { buildFactoryPackageZip(tooNarrow) } catch (error) { narrowError = error }
if (!narrowError || !/Factory package refused: marker\/DXF physical CUT parity failed:/.test(narrowError.message) ||
    !/UNUSED_MARKER_PIECES \(XS\)/.test(narrowError.message) ||
    !/MISSING_INSTANCE \(XS\/rib-waistband\)/.test(narrowError.message)) {
  throw new Error(`Narrow rib factory package must fail closed on missing waistband: ${narrowError?.message || 'unexpected success'}`)
}
console.log(JSON.stringify({ files: names.length, sizes: project.grading.sizes, marker: techPack.markers.M }, null, 2))

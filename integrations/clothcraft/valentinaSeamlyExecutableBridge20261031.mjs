// Narrow, source-identified Valentina MaleShirt -> original Seamly2D executable bridge.
// The independent upstream Seamly2D male_shirt.sm2d is a genuine corresponding
// construction, rather than an XML tag substitution or generated outline.
// Valentina and Seamly2D source samples remain under their original GPL terms.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { evaluateSeamly2DPattern20261023 } from './seamly2dNativeEngine20261023.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const valentinaPattern = path.join(root, 'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt/MaleShirt.val')
const seamlyPattern = path.join(root, 'research/oss/pattern-cad/Seamly2D/src/app/share/samples/patterns/male_shirt.sm2d')
const EXPECTED_VALENTINA = '8bdbb6bacc320c12737b88403c6b050f2f26e08324f56fc8641c586a324b3ad5'
const EXPECTED_SEAMLY = 'a5638b7b983126f445dded9ad10fd0e75f1dbc974dba801d156eb4ec68a02c6a'
const TROUSERS_ZIP = '/Users/mikylecouto/Downloads/pattern-develop.zip'
const TROUSERS_MEMBER = 'valentina-develop/src/app/share/collection/Trousers/Trousers.val'
const TROUSERS_VIT_MEMBER = 'valentina-develop/src/app/share/collection/Trousers/trousers.vit'
const TROUSERS_SOURCE_SHA = 'f4616c6ba796cbd6cb186c35971bd5b554ce2b0db9eea57e34fce5bc3f22cd5c'
const TROUSERS_VIT_SHA = '20a54e7c8d1d1597563b8b11141a115cdd9026315c7b2ab67efcf8f90be2e34e'
const TROUSERS_SEAMLY_SHA = '8909525adf3d4e016dab3ea7ecf1e95ef138d035990ebbc0719297982d3773fc'
const TROUSERS_SEAMLY = path.join(root, 'research/oss/pattern-cad/Seamly2D/src/app/share/samples/patterns/trousers.sm2d')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const refuse = (code, reason) => ({ ok: false, code, reason, manufacturingApproved: false })
function zipMember(archive, member, cap) {
  const out = spawnSync('/usr/bin/unzip', ['-p', archive, member], { maxBuffer: cap + 1024, timeout: 30000 })
  if (out.error || out.status !== 0 || !out.stdout?.length || out.stdout.length > cap)
    throw new Error(`Unable to read expected archive member ${member}`)
  return out.stdout
}

/**
 * Execute only the known independently ported original MaleShirt construction.
 * All other .val patterns require an explicit, separately verified conversion.
 * The supplied .vit values are passed to the native calculator as .smis values.
 */
export function evaluateValentinaMaleShirtViaSeamly20261031({
  patternPath = valentinaPattern, measurementsPath,
  format = 'svg', outputRoot, executablePath,
} = {}) {
  let staging
  try {
    if (typeof patternPath !== 'string' || !(/\.val$/i.test(patternPath) || patternPath === TROUSERS_ZIP))
      return refuse('UNSUPPORTED_PATTERN', 'Expected an authentic Valentina .val')
    if (typeof measurementsPath !== 'string' || !( /\.vit$/i.test(measurementsPath) || measurementsPath === TROUSERS_ZIP))
      return refuse('MEASUREMENTS_REQUIRED', 'An explicit Valentina individual .vit is required')
    const source = patternPath === TROUSERS_ZIP
      ? zipMember(TROUSERS_ZIP, TROUSERS_MEMBER, 7 * 1024 * 1024)
      : fs.readFileSync(patternPath)
    const isTrousers = sha(source) === TROUSERS_SOURCE_SHA && source.length === 6141594
    if (!isTrousers && (source.length > 4 * 1024 * 1024 || sha(source) !== EXPECTED_VALENTINA))
      return refuse('UNSUPPORTED_PATTERN', 'Only authenticated Valentina MaleShirt and Trousers sources are mapped')
    const nativePattern = isTrousers ? TROUSERS_SEAMLY : seamlyPattern
    if (sha(fs.readFileSync(nativePattern)) !== (isTrousers ? TROUSERS_SEAMLY_SHA : EXPECTED_SEAMLY))
      return refuse('REFERENCE_MISMATCH', 'The independent native Seamly2D construction has changed')
    const measurement = measurementsPath === TROUSERS_ZIP
      ? zipMember(TROUSERS_ZIP, TROUSERS_VIT_MEMBER, 2 * 1024 * 1024)
      : fs.readFileSync(measurementsPath)
    if (measurementsPath === TROUSERS_ZIP && !isTrousers)
      return refuse('INVALID_MEASUREMENTS', 'Archive trousers measurements require the Trousers construction')
    if (measurementsPath === TROUSERS_ZIP && sha(measurement) !== TROUSERS_VIT_SHA)
      return refuse('INVALID_MEASUREMENTS', 'Original archive measurements do not match authenticated source')
    if (measurement.length > 2 * 1024 * 1024) return refuse('INVALID_MEASUREMENTS', 'Oversized measurements')
    const xml = measurement.toString('utf8')
    if (!/^\s*<\?xml\s+version=['"]1\.0['"]\s+encoding=['"]UTF-8['"]\s*\?>\s*<vit>/.test(xml) ||
        !/<\/vit>\s*$/.test(xml) || /<!DOCTYPE|<!ENTITY|<\?[^x]|<script\b/i.test(xml) ||
        !/<unit>cm<\/unit>/.test(xml) || !/<body-measurements>/.test(xml))
      return refuse('INVALID_MEASUREMENTS', 'Unsupported or unsafe Valentina measurement XML')
    const measurements = [...xml.matchAll(/<m\s+name="([a-z][a-z0-9_]*)"\s+value="([^"]*)"\s*\/>/g)]
    const expected = isTrousers
      ? ['height_waist_side', 'height_knee', 'waist_circ', 'hip_circ', 'leg_crotch_to_floor', 'leg_knee_circ', 'leg_ankle_high_circ', 'leg_ankle_circ']
      : ['height', 'hand_circ', 'neck_circ', 'bust_circ', 'waist_circ', 'hip_circ', 'neck_back_to_waist_b', 'shoulder_length', 'arm_shoulder_tip_to_wrist_bent']
    if (measurements.length !== expected.length ||
        measurements.some((m, i) => m[1] !== expected[i] || !/^\s*\d+(?:\.\d+)?\s*$/.test(m[2]) ||
          !Number.isFinite(Number(m[2])) || Number(m[2]) <= 0) ||
        [...xml.matchAll(/<m\b/g)].length !== expected.length)
      return refuse('INVALID_MEASUREMENTS', `Expected ${expected.length} numeric authenticated construction measurements`)
    staging = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-valentina-seamly-'))
    const converted = path.join(staging, 'measurements.smis')
    fs.writeFileSync(converted, xml.replace('<vit>', '<smis>').replace(/<\/vit>\s*$/, '</smis>')
      .replace('<version>0.3.3</version>', '<version>0.3.4</version>'), { flag: 'wx' })
    const result = evaluateSeamly2DPattern20261023({ patternPath: nativePattern,
      measurementsPath: converted, format, ...(outputRoot ? { outputRoot } : {}),
      ...(executablePath ? { executablePath } : {}) })
    const bridge = isTrousers ? 'verified-trousers-reference' : 'verified-maleshirt-reference'
    if (!result.ok) return { ...result, bridge }
    return { ...result, bridge,
      valentinaSourceSha256: sha(source), valentinaMeasurementsSha256: sha(measurement),
      sourceMapping: isTrousers
        ? 'Valentina Trousers.val -> independently ported Seamly2D trousers.sm2d'
        : 'Valentina MaleShirt.val -> independently ported Seamly2D male_shirt.sm2d',
      manufacturingApproved: false }
  } catch (error) {
    return refuse('BRIDGE_FAILED', error instanceof Error ? error.message : String(error))
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true })
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { rewriteNativeCurveImport } from './relocate-native-internal-curve-20261030.mjs'

test('rewrites the targeted import with AST positions and preserves surrounding text', () => {
  const original = "// '../components/nativeInternalCurve.js'\n" +
    "import {sampleInternalCurve} from '../components/nativeInternalCurve.js'\n" +
    "export const original = 3\n"
  const result = rewriteNativeCurveImport(original)
  assert.equal(result.changed, true)
  assert.equal(result.source, original.replace(
    "from '../components/nativeInternalCurve.js'", "from './nativeInternalCurve.js'"))
  assert.deepEqual(rewriteNativeCurveImport(result.source),
    { source: result.source, changed: false, alreadyMigrated: true })
})

test('rejects unexpected source or multiple old imports instead of blind text replacements', () => {
  assert.throws(() => rewriteNativeCurveImport("import x from '../components/nativeInternalCurve.js'"),
    /Unexpected old curve import API/)
  assert.throws(() => rewriteNativeCurveImport("import {sampleInternalCurve} from '../components/nativeInternalCurve.js'\n" +
    "import {sampleInternalCurve as other} from '../components/nativeInternalCurve.js'"),
    /exactly one/)
})

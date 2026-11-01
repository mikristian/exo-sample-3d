import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeRuntimeSource,buildRuntimeOwnershipAudit,resolveRelative} from './runtime-ownership-audit.mjs'

test('Oxc captures distinct static, re-export, dynamic and CJS references',()=>{
  const out=analyzeRuntimeSource('src/a.js',`import x from './rustFooKernel.js'; export * from './b.js';
    const x1=import('./lazy.js'); const x2=require('./c.js');
    const x3=import(path);`)
  assert.deepEqual(out.references.map(r=>[r.kind,r.specifier]),[
    ['static-import','./rustFooKernel.js'],['re-export','./b.js'],
    ['dynamic-import','./lazy.js'],['commonjs-require','./c.js'],['dynamic-import',null]])
  assert.equal(out.parseErrors.length,0)
})

test('relative resolution prevents escaping root and does not count bare package names',()=>{
  const names=new Set(['src/a.js','src/sub/index.ts','src/z.js'])
  assert.equal(resolveRelative('src/a.js','./sub',names),'src/sub/index.ts')
  assert.equal(resolveRelative('src/a.js','../../outside',names),null)
  assert.equal(resolveRelative('src/a.js','some-library',names),null)
})

test('reachability and bridge evidence remain conservative and deterministic',()=>{
  const sources={
    'src/entry.js':`import './helper.js'; import './rustGeometryKernel.js';`,
    'src/helper.js':`export * from './rustGeometryKernel.js'`,
    'src/rustGeometryKernel.js':`export const fallback = () => 3`,
    'src/unrelated.js':'export const x=1',
  }
  const report=buildRuntimeOwnershipAudit(sources,['src/entry.js'])
  assert.deepEqual(report.potentiallyReachableFiles,['src/entry.js','src/helper.js','src/rustGeometryKernel.js'])
  assert.equal(report.rustWrapperReferences.length,2)
  assert.equal(report.verifiedFunctionalRustPercentage,null)
  assert.deepEqual(report,buildRuntimeOwnershipAudit(Object.fromEntries(Object.entries(sources).reverse()),['src/entry.js']))
})

test('missing entries and malformed sources surface without inventing ownership',()=>{
  const report=buildRuntimeOwnershipAudit({'src/bad.js':'const = ;'},['src/missing.js'])
  assert.equal(report.parseFailures.length,1)
  assert.deepEqual(report.missingEntrypoints,['src/missing.js'])
  assert.equal(report.verifiedFunctionalRustPercentage,null)
})

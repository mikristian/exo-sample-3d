import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRuntimeProvenance,verifyRuntimeProvenance,runtimePaths} from './runtime-provenance.mjs'

test('packaged fingerprint verifies exact runtime bytes and catches later source drift',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-runtime-fingerprint-'))
  try {
    for (const relative of runtimePaths) {
      const target=path.join(root,relative)
      fs.mkdirSync(path.dirname(target),{recursive:true})
      fs.writeFileSync(target,relative==='web/index.html'
        ? '<script type="module" src="/assets/app-123.js"></script><link href="/assets/style-123.css" rel="stylesheet">'
        : `fixture:${relative}`)
    }
    for (const relative of ['web/assets/app-123.js','web/assets/style-123.css',
      'web/assets/chunk-567.js','web/assets/font-123.woff2',
      'web/assets/obsolete-999.js','web/wasm/exo_ui_kernel.wasm',
      'integrations/clothcraft/native-verified-production-order-run37.mjs',
      'src/core/backends/nativeOrderedAssembly20261025.mjs',
      'node_modules/test-runtime-package/index.js']) {
      const target=path.join(root,relative)
      fs.mkdirSync(path.dirname(target),{recursive:true})
      fs.writeFileSync(target,relative==='web/assets/app-123.js'
        ? 'const route = () => import("./chunk-567.js")'
        :relative==='web/assets/style-123.css'?'@font-face{src:url("./font-123.woff2")}'
        : `fixture:${relative}`)
    }
    assert.equal(verifyRuntimeProvenance(root).status,'manifest-missing')
    const manifest=createRuntimeProvenance(root,{builtAt:'2026-10-30T00:00:00.000Z'})
    fs.writeFileSync(path.join(root,'runtime-provenance.json'),JSON.stringify(manifest))
    assert.equal(verifyRuntimeProvenance(root).identity,manifest.identity)
    assert.equal(verifyRuntimeProvenance(root).verified,true)
    assert.ok(manifest.files['web/assets/app-123.js'])
    assert.ok(manifest.files['web/assets/chunk-567.js'])
    assert.ok(manifest.files['web/assets/font-123.woff2'])
    assert.ok(manifest.files['web/wasm/exo_ui_kernel.wasm'])
    assert.ok(manifest.files['integrations/clothcraft/native-verified-production-order-run37.mjs'])
    assert.ok(manifest.files['src/core/backends/nativeOrderedAssembly20261025.mjs'])
    assert.ok(manifest.files['node_modules/test-runtime-package/index.js'])
    assert.equal(manifest.files['web/assets/obsolete-999.js'],undefined)
    // A history of old hashed bundles must not force a full release rebuild or
    // invalidate the manifest for the actively served UI.
    fs.appendFileSync(path.join(root,'web/assets/obsolete-999.js'),'stale')
    assert.equal(verifyRuntimeProvenance(root).verified,true)
    fs.appendFileSync(path.join(root,'web/assets/app-123.js'),'tampered')
    assert.equal(verifyRuntimeProvenance(root).mismatch,'web/assets/app-123.js')
    fs.writeFileSync(path.join(root,'web/assets/app-123.js'),'const route = () => import("./chunk-567.js")')
    fs.appendFileSync(path.join(root,'integrations/clothcraft/server.mjs'),'drift')
    assert.deepEqual(verifyRuntimeProvenance(root),{
      status:'runtime-mismatch',verified:false,identity:manifest.identity,mismatch:'integrations/clothcraft/server.mjs'
    })
    fs.writeFileSync(path.join(root,'integrations/clothcraft/server.mjs'),'fixture:integrations/clothcraft/server.mjs')
    fs.appendFileSync(path.join(root,'node_modules/test-runtime-package/index.js'),'tamper')
    assert.equal(verifyRuntimeProvenance(root).mismatch,'node_modules/test-runtime-package/index.js')
    fs.writeFileSync(path.join(root,'runtime-provenance.json'),'{')
    assert.equal(verifyRuntimeProvenance(root).status,'invalid-manifest')
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})

test('fingerprinting fails closed for a missing active Vite entrypoint chunk',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-runtime-missing-entry-'))
  try{
    for(const relative of runtimePaths){
      const target=path.join(root,relative)
      fs.mkdirSync(path.dirname(target),{recursive:true})
      fs.writeFileSync(target,relative==='web/index.html'
        ? '<script type="module" src="/assets/not-installed.js"></script>'
        : 'fixture')
    }
    fs.mkdirSync(path.join(root,'web/wasm'),{recursive:true})
    assert.throws(()=>createRuntimeProvenance(root),/MISSING_ACTIVE_RUNTIME_ASSET/)
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('fingerprinting fails when an active JavaScript chunk import or CSS font is missing',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-runtime-missing-import-'))
  try{
    for(const relative of runtimePaths){
      const target=path.join(root,relative)
      fs.mkdirSync(path.dirname(target),{recursive:true})
      fs.writeFileSync(target,relative==='web/index.html'
        ? '<script type="module" src="/assets/index-test.js"></script>'
        : 'fixture')
    }
    fs.mkdirSync(path.join(root,'web/assets'),{recursive:true})
    fs.mkdirSync(path.join(root,'web/wasm'),{recursive:true})
    fs.writeFileSync(path.join(root,'web/assets/index-test.js'),'import("./missing-123.js")')
    assert.throws(()=>createRuntimeProvenance(root),/MISSING_ACTIVE_RUNTIME_ASSET:web\/assets\/missing-123.js/)
    fs.writeFileSync(path.join(root,'web/assets/missing-123.js'),'// valid chunk')
    fs.writeFileSync(path.join(root,'web/assets/index-test.js'),'import("./style-test.css")')
    fs.writeFileSync(path.join(root,'web/assets/style-test.css'),'@font-face{src:url("./missing.woff2")}')
    assert.throws(()=>createRuntimeProvenance(root),/MISSING_ACTIVE_RUNTIME_ASSET:web\/assets\/missing.woff2/)
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('missing hashed chunk in a Vite-style modulepreload map blocks provenance',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-runtime-mapdeps-'))
  try{
    for(const relative of runtimePaths){
      const target=path.join(root,relative)
      fs.mkdirSync(path.dirname(target),{recursive:true})
      fs.writeFileSync(target,relative==='web/index.html'
        ? '<script type="module" src="/assets/index-test.js"></script>'
        : 'fixture')
    }
    fs.mkdirSync(path.join(root,'web/assets'),{recursive:true})
    fs.mkdirSync(path.join(root,'web/wasm'),{recursive:true})
    fs.writeFileSync(path.join(root,'web/assets/index-test.js'),
      'const __vite__mapDeps=i=>i.map(n=>["GLTFExporter-Abcd1234.js"][n])')
    assert.throws(()=>createRuntimeProvenance(root),
      /MISSING_ACTIVE_RUNTIME_ASSET:web\/assets\/GLTFExporter-Abcd1234.js/)
    fs.writeFileSync(path.join(root,'web/assets/GLTFExporter-Abcd1234.js'),'export default 1')
    assert.ok(createRuntimeProvenance(root).files['web/assets/GLTFExporter-Abcd1234.js'])
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})

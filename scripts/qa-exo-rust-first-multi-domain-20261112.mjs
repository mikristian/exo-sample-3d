#!/usr/bin/env node
/**
 * Integrated Rust-first migration evidence for active drafting, sewing,
 * 2D geometry, native document mutations, and manufacturing. All temporary
 * Rust session edits use a disposable OS tempdir. Does NOT mutate EXO's
 * installed app, production services or user garment documents.
 *
 * node scripts/qa-exo-rust-first-multi-domain-20261112.mjs
 */
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createWorkspace} from '../integrations/clothcraft/workspace.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const specs=[
 {system:'2D drafting / geometry',script:'scripts/qa-rust-geometry-kernel.mjs',required:'"backend":"rust-wasm"',metric:'551 geometry parity cases'},
 {system:'Drafting constructions',script:'scripts/qa-rust-construction-kernel.mjs',required:'Rust construction WASM parity passed',metric:'52 construction fixtures'},
 {system:'Sewing length calculations',script:'scripts/qa-rust-sewing-kernel.mjs',required:'"backend":"rust-wasm"',metric:'992 seam diagnostics'},
 {system:'Garment marker / SVG / PDF',script:'scripts/qa-rust-marker-seeded-parity-20261020.mjs',required:'"wasmLoaded":true',metric:'4 layouts, 16 exact export artifacts'},
 {system:'Manufacturing preflight',script:'scripts/qa-rust-preflight-kernel.mjs',required:'1000 full reports match',metric:'1000 parity fixtures'},
 {system:'DXF notch geometry',script:'scripts/qa-rust-dxf-notch-parity.mjs',required:'',metric:'Rust DXF notch regression'},
 {system:'WASM grade to native Rust CUT',script:'scripts/qa-rust-grading-connected-migration-20261112.mjs',required:'"gradedNativeCutlines":6',metric:'6 native graded CUT sizes'},
]
const hashes={}
for(const id of ['geometry','construction','sewing','marker','preflight','grading']){
  const path=join(root,`public/wasm/exo_${id}_kernel.wasm`)
  const actual=createHash('sha256').update(readFileSync(path)).digest('hex')
  const recorded=readFileSync(join(root,`public/wasm/exo_${id}_kernel.sha256`),'utf8').trim().split(/\s+/)[0]
  assert.equal(actual,recorded,`${id}: built Rust WASM changed without matching recorded checksum`)
  hashes[id]=actual
}
const cases=[]
for(const spec of specs){
  const run=spawnSync(process.execPath,[join(root,spec.script)],{
    cwd:root,encoding:'utf8',timeout:30000,maxBuffer:5*1024*1024,
    env:{...process.env,EXO_CLOTHCRAFT_REPO:join(root,'research/oss/clothcraft'),
      EXO_CLOTHCRAFT_SESSION_BIN:join(root,'research/oss/clothcraft/target/debug/exo-session'),
      EXO_CLOTHCRAFT_GPU:'0'},
  })
  const ok=run.status===0 && (!spec.required||run.stdout.includes(spec.required))
  cases.push({system:spec.system,pass:ok,fixture:spec.metric,script:spec.script,
    exitCode:run.status,stdoutLastLine:run.stdout.trim().split('\n').at(-1)?.slice(0,700)||'',
    error:ok?null:String(run.error?.message||run.stderr||'output did not confirm required Rust backend').slice(0,500)})
}

// Native document integration: real compiled Rust exo-session via the existing
// Node workspace bridge, no production HTTP ports or user workspaces involved.
const sandbox=mkdtempSync(join(tmpdir(),'exo-native-sewing-20261112-'))
let workspace=createWorkspace(sandbox)
let native
try{
  async function request(body){
    const response=await workspace.request(body)
    assert.equal(response.ok,true,`${body.op} refused: ${response.error}`)
    return response.data
  }
  const opened=await request({op:'open',preset:'tshirt'})
  const seam=opened.template?.seams?.[0]
  assert(seam?.id,'Native source needs an actual sewable panel edge')
  const before=structuredClone(opened.template)
  const failed=await workspace.request({op:'edit-seam',revision:opened.revision,
    seam:seam.id,reverse:!seam.reverse_b,ease:!seam.allow_ease,stiffness:1})
  assert.equal(failed.ok,false,'Invalid physical seam stiffness was accepted')
  const snapshot=await request({op:'snapshot'})
  assert.equal(snapshot.revision,opened.revision,'Invalid native edit changed source revision')
  const edited=await request({op:'edit-seam',revision:opened.revision,
    seam:seam.id,reverse:!seam.reverse_b,ease:!seam.allow_ease,stiffness:seam.stiffness*1.2})
  assert.equal(edited.template.seams[0].stiffness,seam.stiffness*1.2)
  const stale=await workspace.request({op:'edit-seam',revision:opened.revision,
    seam:seam.id,reverse:false,ease:false,stiffness:seam.stiffness})
  assert.equal(stale.ok,false,'Stale native revision was accepted')
  const undone=await request({op:'undo',revision:edited.revision})
  assert.deepEqual(undone.template,before,'Native Undo did not restore exact original garment')
  const redone=await request({op:'redo',revision:undone.revision})
  assert.equal(redone.template.seams[0].stiffness,seam.stiffness*1.2)
  const saved=await request({op:'save'})
  assert.equal(saved.project.template.seams[0].stiffness,seam.stiffness*1.2)
  const audit=await request({op:'pattern-audit',revision:redone.revision})
  assert.equal(audit.format,'exo-native-pattern-audit.v1')
  assert.equal(audit.manufacturerReady,false,'Unqualified Rust source claimed factory readiness')
  assert.equal(audit.sourceGeometryMeasured,true)
  // Cold start against the exact Rust-saved document and linked history;
  // do not re-import the same payload as a *new* garment (which intentionally
  // fails strict journal identity checks).
  workspace.close()
  workspace=createWorkspace(sandbox)
  const reopened=await request({op:'snapshot'})
  assert.equal(reopened.template.seams[0].stiffness,seam.stiffness*1.2)
  native={pass:true,compiledRustSession:true,seamEdit:true,negativeInputs:2,
    undo:true,redo:true,durableSave:true,coldOpen:true,
    nativePatternAudit:true,manufacturerReady:false}
}catch(error){
  native={pass:false,error:String(error?.stack||error)}
}finally{
  workspace.close()
  rmSync(sandbox,{recursive:true,force:true})
}

const pass=cases.every(c=>c.pass)&&native.pass
const result={schema:'exo-rust-first-multi-domain-evidence.v1',date:'2026-11-12',pass,
  languages:'Native Rust executable + browser Rust WebAssembly with existing JS/React interface',
  checkedWasmSha256:hashes,tests:cases,nativeDocumentIntegration:native,
  activeReactUiClickVerified:false,
  factoryProductionCertified:false,physicalSolverAccepted:false,
  releaseCandidateReady:false,
  interpretation:'Passing deterministic module and native document parity proves bounded Rust operation behavior. It does NOT prove all UI actions use Rust, physical fit, factory certification, or installed release readiness.'}
const out=join(root,'docs/reports/EXO_RUST_FIRST_MULTI_DOMAIN_20261112.json')
writeFileSync(out,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({pass,verifiedSystems:cases.filter(c=>c.pass).length,
  totalSystems:cases.length,nativeSeam:!!native.pass,
  domainResults:cases.map(x=>({system:x.system,pass:x.pass,metric:x.fixture})),
  native,sourceManifest:out},null,2))
if(!pass)process.exitCode=1

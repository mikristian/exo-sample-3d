#!/usr/bin/env node
/** Source, generated TS, and native executable read-only contract checks.
 * No user garment, desktop bundle, or production process is modified.
 * `cargo test` in rust/exo_command_contract must have generated TS bindings.
 */
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {dirname,resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(import.meta.url)
const {parse}=require('@babel/parser')
const generated=readFileSync(join(root,'rust/exo_command_contract/bindings/ExoGradeCommandV1.ts'),'utf8')
const rustSource=readFileSync(join(root,'research/oss/clothcraft/src/bin/exo-session.rs'),'utf8')
const uiSource=readFileSync(join(root,'src/components/ClothCraftWorkspace.jsx'),'utf8')
const ast=parse(generated,{sourceType:'module',plugins:['typescript']})
const type=ast.program.body.find(x=>x.type==='ExportNamedDeclaration'&&
  x.declaration?.type==='TSTypeAliasDeclaration'&&
  x.declaration.id.name==='ExoGradeCommandV1')?.declaration.typeAnnotation
assert.equal(type?.type,'TSUnionType','ts-rs must produce a discriminated request union')
const expected=['grade-run-status','grade-run-cutlines','grade-run-activate','grade-run-restore']
const found=[]
for(const variant of type.types){
  assert.equal(variant.type,'TSTypeLiteral')
  const props=new Map(variant.members.map(member=>[member.key?.name||member.key?.value,member.typeAnnotation?.typeAnnotation]))
  const op=props.get('op')?.literal?.value
  assert.ok(op,`Generated TS variant missing op: ${JSON.stringify(variant)}`)
  assert.equal(props.get('revision')?.type,'TSNumberKeyword',`${op}: revisions must be JSON-safe JS numbers`)
  if(op==='grade-run-activate')assert.equal(props.get('size')?.type,'TSStringKeyword')
  found.push(op)
  assert.ok(rustSource.includes(`"${op}"=>`),`Rust session missing real handler for ${op}`)
}
assert.deepEqual(found.sort(),expected.sort())
assert.ok(!generated.includes('bigint'),'JSON contract cannot carry TS bigint')
// Source routing proof only: the existing React controls call the guarded
// request builders, which emit the Rust-owned typed request shape.
assert.ok(uiSource.includes("from '../core/exoNativeGradeCommandV1.js'"),
  'real React workspace no longer imports the typed native command adapter')
assert.ok(uiSource.includes('request(nativeGradeActivateCommandV1(state.current.revision,size))'),
  'React size activation is not routed through the typed Rust command contract')
assert.ok(uiSource.includes('request(nativeGradeRestoreCommandV1(state.current.revision))'),
  'React size restoration is not routed through the typed Rust command contract')
const binary=join(root,'research/oss/clothcraft/target/debug/exo-session')
const report={contractVariants:found.sort(),typescript:'generated Rust source',nativeHandlerBranches:4,
  uiSourceCommandAdapterWired:true,uiInteractionExecuted:false,
  nativeBinaryPresent:existsSync(binary),abiCapabilities:null,releaseReady:false,
  caveat:'Presence of handlers and TypeScript contracts is not a functional proof of a connected EXO UI, grading parity, or installed-app acceptance.'}
if(process.argv.includes('--probe-native')){
  assert.ok(report.nativeBinaryPresent,'Built Rust native session missing')
  const probe=spawnSync(binary,['--exo-capabilities'],{encoding:'utf8',timeout:4000,maxBuffer:1024*32})
  assert.equal(probe.status,0,`native capability probe failed: ${probe.stderr}`)
  const cap=JSON.parse(probe.stdout.trim())
  report.abiCapabilities={
    nativePropertyMetadataV1:cap.nativePropertyMetadataV1===true,
    nativeProjectGenerationV1:cap.nativeProjectGenerationV1===true,
  }
  assert.equal(report.abiCapabilities.nativePropertyMetadataV1,true,'missing native property ABI')
  assert.equal(report.abiCapabilities.nativeProjectGenerationV1,true,'missing native project generation ABI')
}
console.log(JSON.stringify({result:'PASS',...report},null,2))

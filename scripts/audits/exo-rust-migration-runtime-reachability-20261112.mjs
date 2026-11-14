#!/usr/bin/env node
/**
 * EXO Rust migration: conservative static ES import graph from selected actual
 * application/bridge entry points. No source or installed app is modified.
 *
 * node scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs
 * node scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs --self-test
 *
 * This is reachability, NOT proof that a function runs, nor that an unreachable
 * source file is dead. Dynamic import expressions are counted as unknown.
 */
import {readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, extname, join, relative, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'

const require=createRequire(import.meta.url)
const {parse}=require('@babel/parser')
const scriptDir=dirname(fileURLToPath(import.meta.url))
const root=resolve(scriptDir,'../..')
const startRoots=[
  'src/main.jsx',
  'integrations/clothcraft/server.mjs',
  'integrations/clothcraft/workspace.mjs',
  'integrations/clothcraft/bridge.mjs',
  'integrations/clothcraft/agent-api.mjs',
  'integrations/clothcraft/collaboration.mjs',
  'integrations/clothcraft/mcp-server.mjs',
  'native_backend/server.mjs',
  'ppf_backend/server.mjs',
  'techpack-studio/src/main.jsx',
]
const extensions=['','.js','.jsx','.mjs','.cjs','.ts','.tsx','.json']
const supported=/\.(?:js|jsx|mjs|cjs|ts|tsx)$/
function walk(node, callback){
  if(!node || typeof node!=='object')return
  if(Array.isArray(node)){for(const v of node)walk(v,callback);return}
  if(typeof node.type==='string')callback(node)
  for(const [k,v] of Object.entries(node)){
    if(k==='loc'||k==='start'||k==='end'||k==='comments'||k==='tokens'||k==='extra')continue
    if(v && typeof v==='object')walk(v,callback)
  }
}
function getImports(source,filename){
  const ast=parse(source,{sourceType:'unambiguous',sourceFilename:filename,
    errorRecovery:false,plugins:['jsx','typescript','importAttributes','dynamicImport']})
  const literals=new Map();const unknown=[]
  function add(p,kind){if(typeof p==='string')literals.set(p,(literals.get(p)||new Set()).add(kind))}
  walk(ast,node=>{
    if(node.type==='ImportDeclaration')add(node.source?.value,'import')
    if(node.type==='ExportNamedDeclaration'&&node.source)add(node.source.value,'reexport')
    if(node.type==='ExportAllDeclaration')add(node.source?.value,'reexport')
    if(node.type==='ImportExpression'){
      if(node.source?.type==='StringLiteral')add(node.source.value,'dynamic-literal')
      else unknown.push({kind:'dynamic-import',line:node.loc?.start?.line??null})
    }
    if(node.type==='CallExpression' &&
      (node.callee?.type==='Import'||(node.callee?.type==='Identifier'&&node.callee.name==='require'))){
      const argument=node.arguments?.[0]
      if(argument?.type==='StringLiteral')add(argument.value,node.callee.type==='Import'?'dynamic-literal':'require')
      else unknown.push({kind:node.callee.type==='Import'?'dynamic-import':'dynamic-require',line:node.loc?.start?.line??null})
    }
  })
  return {imports:[...literals.entries()].map(([specifier,kinds])=>({specifier,kinds:[...kinds].sort()})),unknown}
}
function localResolve(base,specifier,projectRoot){
  if(!specifier.startsWith('.'))return {kind:'package',specifier}
  const raw=resolve(dirname(base),specifier.split(/[?#]/,1)[0])
  if(!raw.startsWith(projectRoot+'/'))return {kind:'outside',specifier}
  for(const ext of extensions){
    const path=raw+ext
    if(existsSync(path) && !path.endsWith('/')){
      try{if(readFileSync(path).length>=0)return {kind:'resolved',path}}catch{}
    }
  }
  for(const ext of extensions.slice(1)){
    const path=join(raw,'index'+ext)
    if(existsSync(path))return {kind:'resolved',path}
  }
  return {kind:'unresolved',specifier}
}
function scan(projectRoot,roots){
  const pending=roots.map(x=>resolve(projectRoot,x));const done=new Set()
  const parsed=[];const edges=[];const unsupported=[];const failures=[]
  while(pending.length){
    const path=pending.pop();if(done.has(path))continue
    done.add(path)
    if(!path.startsWith(projectRoot+'/')||!existsSync(path)){
      failures.push({path:relative(projectRoot,path),reason:'entry-or-source-not-found'});continue
    }
    if(!supported.test(path))continue
    const rel=relative(projectRoot,path).replaceAll('\\','/')
    let src,result
    try{src=readFileSync(path,'utf8');result=getImports(src,rel)}
    catch(error){failures.push({path:rel,reason:String(error?.message||error)});continue}
    parsed.push({path:rel,lines:src.split('\n').length,imports:result.imports.length,dynamicUnknown:result.unknown.length})
    for(const miss of result.unknown)unsupported.push({path:rel,...miss})
    for(const imp of result.imports){
      const resolution=localResolve(path,imp.specifier,projectRoot)
      const target=resolution.path?relative(projectRoot,resolution.path).replaceAll('\\','/'):null
      edges.push({from:rel,to:target,specifier:imp.specifier,kinds:imp.kinds,status:resolution.kind})
      if(resolution.kind==='resolved')pending.push(resolution.path)
      else if(resolution.kind==='unresolved')unsupported.push({path:rel,kind:'unresolved-local',specifier:imp.specifier})
    }
  }
  return {roots,parsed:parsed.sort((a,b)=>a.path.localeCompare(b.path)),edges,
    unsupported,failures,conclusion:'Static module reachability only. Dynamic unknown imports, injected services and runtime dispatch need independent verification.'}
}
function selfTest(){
  const dir=mkdtempSync(join(tmpdir(),'exo-rust-module-graph-'))
  try{
    mkdirSync(join(dir,'src/core'),{recursive:true})
    writeFileSync(join(dir,'src/main.jsx'),"import './App.jsx';\n")
    writeFileSync(join(dir,'src/App.jsx'),"import {x} from './core/grade.js'; export {y} from './core/helpers.js'; const z=import('./core/lazy.js'); const a=import('./core/'+x);\n")
    writeFileSync(join(dir,'src/core/grade.js'),"export const x='value'\n")
    writeFileSync(join(dir,'src/core/helpers.js'),"export const y=1\n")
    writeFileSync(join(dir,'src/core/lazy.js'),"export const lazy=1\n")
    writeFileSync(join(dir,'src/core/unused.js'),"export const unused=1\n")
    const result=scan(dir,['src/main.jsx'])
    assert.equal(result.failures.length,0,JSON.stringify(result.failures))
    assert.equal(result.parsed.length,5)
    assert.equal(result.unsupported.filter(x=>x.kind==='dynamic-import').length,1)
    assert.ok(!result.parsed.some(x=>x.path.endsWith('unused.js')))
    assert.ok(result.edges.some(x=>x.to==='src/core/lazy.js'&&x.kinds.includes('dynamic-literal')))
    console.log('PASS: imports, reexports, literal dynamic imports, unknown dynamic imports and unreachable modules')
  }finally{rmSync(dir,{recursive:true,force:true})}
}
function main(){
  if(process.argv.includes('--self-test')){selfTest();return}
  const result=scan(root,startRoots)
  const inventoryPath=join(root,'docs/reports/EXO_V2_BACKEND_SYSTEM_SOURCE_MAP_20261112.json')
  const inventory=existsSync(inventoryPath)?JSON.parse(readFileSync(inventoryPath,'utf8')):null
  const mapped=new Map((inventory?.files||[]).filter(x=>x.tier==='EXO-code-scope').map(x=>[x.path,x]))
  const reachable=result.parsed.filter(x=>mapped.has(x.path)).map(x=>({...x,
    system:mapped.get(x.path).subsystem,language:mapped.get(x.path).lang}))
  const bySystem=new Map()
  for(const x of reachable){
    const a=bySystem.get(x.system)||{system:x.system,files:0,lines:0}
    a.files++;a.lines+=mapped.get(x.path).lines;bySystem.set(x.system,a)
  }
  const report={generatedAt:'2026-11-12',method:'Babel AST static module graph from EXO candidate application roots',
    root:root.replaceAll('\\','/'),roots:result.roots,
    reachableCodeFiles:result.parsed.length,reachableMappedBackendFiles:reachable.length,
    reachableMappedBackendLines:reachable.reduce((sum,x)=>sum+mapped.get(x.path).lines,0),
    parseFailures:result.failures,dynamicAndUnresolved:result.unsupported,
    imports:result.edges,bySystem:[...bySystem.values()].sort((a,b)=>b.lines-a.lines),
    interpretation:result.conclusion,
    note:'Does not declare unreferenced modules dead; app entrypoints may be injected by Electron/Swift, Vite glob, event handlers or generated code.'}
  const prefix=join(root,'docs/reports/EXO_RUST_MIGRATION_REACHABILITY_20261112')
  writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n')
  const table=report.bySystem.map(x=>`| ${x.system.replaceAll('|','/')} | ${x.files} | ${x.lines.toLocaleString('en-US')} |`).join('\n')
  const md=`# EXO Rust migration — runtime source reachability (${report.generatedAt})\n\n`+
    `The candidate frontend/bridge entry points connect to **${report.reachableCodeFiles} parsed modules**; `+
    `of these **${report.reachableMappedBackendFiles}** are in the backend source inventory `+
    `(${report.reachableMappedBackendLines.toLocaleString('en-US')} lines). `+
    `The scan recorded **${report.dynamicAndUnresolved.length}** unknown dynamic/unresolved imports and **${report.parseFailures.length}** parse errors.\n\n`+
    `**Do not treat static reachability as active execution or unreached code as dead.** `+
    `Native Rust session and C++ are processes, not reachable through JavaScript import edges. `+
    `Main React code includes embedded business logic not separately attributed by source file.\n\n`+
    `## Reachable backend source by system\n\n| System | Files | Source lines |\n|---|---:|---:|\n${table}\n\n`+
    `## Priority interpretation\n\n`+
    `1. Inspect reachable grading, DXF and manufacturing imports for existing Rust adapters and fallback paths.\n`+
    `2. Capture a real end-to-end command trace and verify executable SHA and native ABI before changing ownership.\n`+
    `3. Assign high-confidence dead/obsolete candidates only after a runtime/browser and process-launch audit.\n`+
    `4. Convert function by function; require equal output, save/reopen, Undo/Redo and clean bundle acceptance.\n\n`+
    `Data: \`EXO_RUST_MIGRATION_REACHABILITY_20261112.json\`. `+
    `Scan implementation: \`scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs\`.\n`
  writeFileSync(prefix+'.md',md)
  console.log(JSON.stringify({mappedBackendFiles:report.reachableMappedBackendFiles,
    mappedBackendLines:report.reachableMappedBackendLines,parsedFiles:report.reachableCodeFiles,
    unknown:report.dynamicAndUnresolved.length,parseFailures:report.parseFailures.length,
    output:prefix},null,2))
  if(report.parseFailures.length)process.exitCode=1
}
main()

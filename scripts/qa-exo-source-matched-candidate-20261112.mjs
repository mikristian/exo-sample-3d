#!/usr/bin/env node
// Isolated, source-fenced Rust candidate. Never writes to existing Cargo targets or the installed app.
import {createHash} from 'node:crypto'
import {existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve, relative} from 'node:path'
import {spawnSync} from 'node:child_process'

const root=resolve(import.meta.dirname,'..')
const home=process.env.HOME
const cargoHome=join(root,'research/runtime/clothcraft-rust-toolchain/cargo')
const rustupHome=join(root,'research/runtime/clothcraft-rust-toolchain/rustup')
const cargo=join(cargoHome,'bin/cargo')
const env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,PATH:`${join(cargoHome,'bin')}:${process.env.PATH??''}`,CARGO_INCREMENTAL:'0'}
const specs=[
  {id:'rust-metadata-validator',crate:'integrations/clothcraft/rust-service',bin:'exo-metadata-validation'},
  {id:'rust-static-web-host',crate:'integrations/clothcraft/rust-static-host',bin:'exo-rust-static-host'},
]
const wasm=[
  ['fabric',['exo_fabric_kernel_abi_version']],
  ['geometry',['exo_geometry_abi_version','exo_grid_coordinate','exo_draft_axis_x','exo_draft_axis_y','exo_topology_kind']],
  ['grading',['exo_grading_abi_version','exo_grade_point_x','exo_grade_point_y']],
  ['sewing',['exo_sewing_abi_version','exo_sewing_signed_difference_cm','exo_sewing_difference_percent','exo_sewing_warning']],
  ['ui',['exo_pom_abi_version','exo_pom_label_x','exo_pom_label_y']],
]
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const fileHash=p=>sha(readFileSync(p))
function sourceList(folder){
  const paths=[]
  const visit=p=>{for(const e of readdirSync(p,{withFileTypes:true})){
    if(['target','.git'].includes(e.name))continue
    const next=join(p,e.name)
    if(e.isDirectory())visit(next)
    else if(e.isFile() && (e.name.endsWith('.rs')||['Cargo.toml','Cargo.lock','build.rs','.cargo/config.toml'].includes(e.name)))paths.push(next)
  }}
  visit(folder)
  return paths.sort().map(p=>({path:relative(root,p),sha256:fileHash(p)}))
}
const cmd=(exe,args,opts={})=>spawnSync(exe,args,{encoding:'utf8',timeout:120000,env,...opts})
const report={schema:'exo.source-matched-native-candidate.v1',createdAt:new Date().toISOString(),candidateRoot:null,sourceMatchesCurrentCheckout:false,artifacts:[],wasm:[],limitations:['Not signed, notarized, packaged, installed, or rolled back','Native exo-session not rebuilt: existing target is approximately 6.9 GiB with only 2.8 GiB free','WASM bytes and exports checked but current-source rebuild provenance is not established']}
const runBuild=process.argv.includes('--build')
// An inspection without --build must never erase a prior successful, pinned
// candidate manifest. A previous version clobbered source-match evidence.
if(!runBuild){
  console.log(JSON.stringify({status:'no-build',note:'Existing candidate report preserved; use --build only for a fresh isolated build.'}))
  process.exit(2)
}
if(runBuild){
  const candidate=mkdtempSync(join(tmpdir(),'exo-source-matched-20261112-'))
  report.candidateRoot=candidate
  const available=Number(cmd('df',['-Pk',candidate]).stdout.trim().split('\n').at(-1)?.trim().split(/\s+/)[3])*1024
  if(!Number.isFinite(available)||available<900*1024*1024){report.blocker='Insufficient temporary volume free space for isolated build'}
  else if(!existsSync(cargo)){report.blocker='Private Cargo executable missing'}
  else {
    for(const spec of specs){
      const folder=join(root,spec.crate),before=sourceList(folder)
      const lock=join(folder,'Cargo.lock')
      // Cargo.lock is mandatory for a --locked reproducible dependency graph.
      if(!existsSync(lock)){report.artifacts.push({id:spec.id,status:'blocked',reason:'Cargo.lock missing'});continue}
      const target=join(candidate,spec.bin+'-target')
      const args=['build','--offline','--locked','-j','2','--manifest-path',join(folder,'Cargo.toml'),'--target-dir',target,'--bin',spec.bin]
      const built=cmd(cargo,args,{env:{...env,CARGO_TARGET_DIR:target},timeout:240000})
      const after=sourceList(folder),unchanged=JSON.stringify(before)===JSON.stringify(after)
      const binary=join(target,'debug',spec.bin)
      const item={id:spec.id,status:built.status===0&&unchanged&&existsSync(binary)?'source-matched':'blocked',buildExit:built.status,sourceUnchanged:unchanged,inputs:before,buildCommand:['cargo',...args.map(a=>a.startsWith(candidate)?'<isolated-target>':a)],stderrTail:(built.stderr??'').slice(-1200)}
      if(existsSync(binary)){item.path=binary;item.sha256=fileHash(binary);item.bytes=statSync(binary).size}
      if(item.status==='source-matched' && spec.id==='rust-metadata-validator'){
        const check=cmd(binary,[],{input:'{"target":"panel","field":"itemNo","value":"TEST-01"}\n{"target":"panel","field":"supplier","value":"x"}\n'})
        const lines=check.stdout.trim().split('\n')
        item.cliCheck={exit:check.status,accepted:lines[0]==='{"ok":true}',rejected:lines[1]?.includes('"ok":false')===true}
        if(check.status!==0||!item.cliCheck.accepted||!item.cliCheck.rejected)item.status='cli-check-failed'
      }
      if(item.status==='source-matched' && spec.id==='rust-static-web-host'){
        const check=cmd(binary,['--unknown'])
        item.cliCheck={exit:check.status,refusesUnknownArgument:check.status===2}
        if(check.status!==2)item.status='cli-check-failed'
      }
      report.artifacts.push(item)
    }
  }
} else report.blocker='Run with --build to create isolated current-source artifacts'
for(const [name,exports] of wasm){
  const path=join(root,`public/wasm/exo_${name}_kernel.wasm`)
  const item={id:`wasm-${name}`,path:relative(root,path),exists:existsSync(path),sourceMatched:false}
  if(item.exists){const bytes=readFileSync(path);item.sha256=sha(bytes);item.bytes=bytes.length
    try{const actual=WebAssembly.Module.exports(new WebAssembly.Module(bytes)).filter(e=>e.kind==='function').map(e=>e.name);item.missingExports=exports.filter(e=>!actual.includes(e));item.abiValid=item.missingExports.length===0}
    catch(e){item.abiValid=false;item.error=String(e)}
  }
  report.wasm.push(item)
}
report.sourceMatchesCurrentCheckout=report.artifacts.length===specs.length&&report.artifacts.every(a=>a.status==='source-matched')
report.completeReleaseCandidate=false
const output=join(root,'docs/reports/EXO_SOURCE_MATCHED_CANDIDATE_20261112.json')
writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({manifest:output,candidateRoot:report.candidateRoot,sourceMatchesCurrentCheckout:report.sourceMatchesCurrentCheckout,artifacts:report.artifacts.map(({id,status,sha256,cliCheck})=>({id,status,sha256,cliCheck})),wasm:report.wasm.map(({id,abiValid,sha256})=>({id,abiValid,sha256})),blocker:report.blocker},null,2))
if(!report.sourceMatchesCurrentCheckout)process.exitCode=2

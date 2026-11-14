#!/usr/bin/env node
/**
 * Reuse an existing Cargo dependency cache to build a source-matched EXO
 * `exo-session` candidate in the DEVELOPMENT tree, then copy it into an
 * isolated temp candidate. This deliberately NEVER modifies the installed
 * macOS app, its live Node service, or any user garment.
 *
 * --build is explicit because cargo may replace the *development* executable.
 * Do not run concurrently with browser or native QA that uses this executable.
 *
 * node scripts/qa-exo-native-session-current-source-20261112.mjs --build
 */
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {copyFileSync,existsSync,mkdtempSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const native=join(root,'research/oss/clothcraft')
const target=join(native,'target')
const bin=join(target,'debug/exo-session')
const cargoDir=join(root,'research/runtime/clothcraft-rust-toolchain/cargo')
const rustupDir=join(root,'research/runtime/clothcraft-rust-toolchain/rustup')
const cargo=join(cargoDir,'bin/cargo')
const hash=data=>createHash('sha256').update(data).digest('hex')
const fileHash=p=>hash(readFileSync(p))
const stamp=()=>new Date().toISOString()
function sourceInputs(){
  const paths=[]
  function walk(p){
    for(const entry of readdirSync(p,{withFileTypes:true})){
      if(entry.name==='target'||entry.name==='.git')continue
      const q=join(p,entry.name)
      if(entry.isDirectory())walk(q)
      else if(entry.isFile()&&(/\.rs$/.test(entry.name)||
        ['Cargo.toml','Cargo.lock','build.rs'].includes(entry.name)))paths.push(q)
    }
  }
  walk(join(native,'src'))
  for(const f of ['Cargo.toml','Cargo.lock','build.rs']){
    const p=join(native,f);if(existsSync(p))paths.push(p)
  }
  return paths.sort().map(p=>({source:relative(root,p),sha256:fileHash(p)}))
}
function command(binary,args,more={}){
  return spawnSync(binary,args,{encoding:'utf8',maxBuffer:1024*1024,
    timeout:90000,...more})
}

const report={schema:'exo.rust-native-session-source-candidate.v1',date:'2026-11-12',
  method:'Offline locked Cargo rebuild using existing cached development target, isolated copied candidate, guarded source-hash before and after',
  startedAt:stamp(),candidateRoot:null,buildStatus:'not-run',
  sourceInputsUnchanged:false,sourceMatchVerified:false,capabilityGate:false,
  deployed:false,signed:false,physicalFactoryAcceptance:false,
  blockers:[],notes:[
    'Reusing existing Cargo target can replace DEVELOPMENT target/debug/exo-session; installed EXO app is never touched.',
    'Source match means Cargo succeeded with pinned lockfile and the recorded Rust source files did not change while building; it does not establish byte-for-byte reproducibility across machines.',
    'Production UI, manufacturing, GPU parity, signing, notarization and tested rollback remain independent release gates.',
  ]}
const dest=join(root,'docs/reports/EXO_NATIVE_SESSION_SOURCE_CANDIDATE_20261112.json')
if(!process.argv.includes('--build')){
  report.blockers.push('Use --build after all isolated browser/native QA using development exo-session has finished')
  writeFileSync(dest,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({status:'no-build',reason:report.blockers[0]}))
  process.exit(2)
}
const df=command('/bin/df',['-Pk',target])
const diskFields=df.stdout.trim().split('\n').at(-1)?.trim().split(/\s+/)
const freeBytes=Number(diskFields?.[3])*1024
report.freeBytesBefore=freeBytes
if(!existsSync(cargo)||!existsSync(bin)||!Number.isFinite(freeBytes)||freeBytes<1.3*1024**3){
  report.blockers.push('Missing existing Cargo cache/compiled binary or less than 1.3 GiB free disk: fail closed')
}else{
  // Check live OS processes, not just the presence of an executable on disk.
  const ps=command('/bin/ps',['-axo','args='])
  if(ps.status!==0)report.blockers.push('Unable to verify development native binary is not in use')
  else if(ps.stdout.split('\n').some(line=>line.startsWith(bin+' ')||line===bin))
    report.blockers.push('Development exo-session is running; refuse build during active QA')
  else{
    report.inputs=sourceInputs()
    const candidate=mkdtempSync(join(tmpdir(),'exo-current-source-session-20261112-'))
    report.candidateRoot=candidate
    report.originalHash=fileHash(bin)
    // Preserve original DEVELOPMENT compiled executable for manual rollback;
    // never write to the installed app.
    copyFileSync(bin,join(candidate,'previous-development-exo-session'))
    const env={...process.env,CARGO_HOME:cargoDir,RUSTUP_HOME:rustupDir,
      PATH:`${join(cargoDir,'bin')}:${process.env.PATH||''}`,CARGO_TARGET_DIR:target,
      CARGO_INCREMENTAL:'0',EXO_CLOTHCRAFT_GPU:'0'}
    const cmd=['build','--offline','--locked','--no-default-features','--bin','exo-session','-j','1']
    report.buildCommand=['cargo',...cmd]
    // One bounded retry can reuse crates compiled during a prior timed-out
    // attempt; 240 s is a ceiling, not a claim that the build will finish.
    const built=command(cargo,cmd,{cwd:native,env,timeout:240000,maxBuffer:3*1024*1024})
    report.buildExit=built.status
    report.buildLogTail=(built.stderr||'').slice(-2600)
    report.sourceInputsUnchanged=JSON.stringify(report.inputs)===JSON.stringify(sourceInputs())
    if(built.status!==0||!report.sourceInputsUnchanged){
      report.blockers.push('Cargo failed or source inputs changed during build; refuse candidate promotion')
    }else{
      const staged=join(candidate,'exo-session')
      copyFileSync(bin,staged)
      report.binaryPath=staged
      report.binarySha256=fileHash(staged)
      report.binaryBytes=statSync(staged).size
      const cli=command(staged,['--exo-capabilities'],{cwd:native,timeout:4000})
      report.capabilityProbeExit=cli.status
      try{
        const flags=cli.status===0?JSON.parse(cli.stdout.trim()):null
        report.capabilities={nativePropertyMetadataV1:flags?.nativePropertyMetadataV1===true,
          nativeProjectGenerationV1:flags?.nativeProjectGenerationV1===true,
          ok:flags?.ok===true, gpuSimulation:flags?.gpuSimulation===true}
        report.capabilityGate=report.capabilities.nativePropertyMetadataV1 &&
          report.capabilities.nativeProjectGenerationV1 &&report.capabilities.ok
      }catch{report.capabilityGate=false}
      report.sourceMatchVerified=report.capabilityGate&&report.sourceInputsUnchanged
      if(!report.sourceMatchVerified)report.blockers.push('Candidate native Rust capability/ABI check failed')
    }
  }
}
report.completedAt=stamp()
writeFileSync(dest,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({sourceMatchVerified:report.sourceMatchVerified,buildStatus:report.buildExit,
  sourceInputsUnchanged:report.sourceInputsUnchanged,capabilityGate:report.capabilityGate,
  stagedCandidate:report.binaryPath||null,sha256:report.binarySha256||null,
  freeBytesBefore:report.freeBytesBefore,blockers:report.blockers,manifest:dest},null,2))
if(!report.sourceMatchVerified)process.exitCode=2

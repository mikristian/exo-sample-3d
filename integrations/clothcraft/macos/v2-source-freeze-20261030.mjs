#!/usr/bin/env node
// Content fence for an isolated EXO V2 staging build. Records the exact bytes
// of code/config inputs (including ignored active Rust session), then rejects
// source drift before signing. This is NOT a copy or an immutable checkout.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const codeSuffix=/\.(?:[cm]?[jt]sx?|rs|toml|lock|json|css|scss|html|sh|py|c|cpp|h|hpp|mm|swift)$/i
const excluded=/(?:^|\/)(?:target|dist|node_modules|\.git|output|build|build-cmake|\.exo-build-scratch)(?:\/|$)/
const roots=['src','integrations/clothcraft','rust','scripts','native_cpp','research/oss/clothcraft/src',
  'research/oss/clothcraft/Cargo.toml','research/oss/clothcraft/Cargo.lock',
  'package.json','package-lock.json','vite.config.mjs','index.html',
  'tsconfig.json','tsconfig.app.json','tsconfig.node.json']
const ignoredInputs=[
  'research/oss/clothcraft/src/bin/exo-session.rs',
]
const sha=content=>crypto.createHash('sha256').update(content).digest('hex')

export function fingerprintInputMap(inputs){
  const records=Object.fromEntries(Object.entries(inputs).sort(([a],[b])=>a.localeCompare(b))
    .map(([name,data])=>[name,{bytes:Buffer.byteLength(data),sha256:sha(data)}]))
  return {schema:'exo.v2.source-code-fence.v1',identity:sha(JSON.stringify(records)),records}
}

export function compareInputFingerprints(reference,current){
  if(reference?.schema!=='exo.v2.source-code-fence.v1' ||
     reference.identity!==sha(JSON.stringify(reference.records||{})))
    return {ok:false,code:'INVALID_SOURCE_FENCE',changed:[]}
  const old=reference.records
  const next=current.records
  const changed=[...new Set([...Object.keys(old),...Object.keys(next)])]
    .filter(name=>old[name]?.sha256!==next[name]?.sha256 ||
      old[name]?.bytes!==next[name]?.bytes).sort()
  return {ok:changed.length===0&&reference.identity===current.identity,
    code:changed.length?'SOURCE_CHANGED':'SOURCE_UNCHANGED',changed:changed.slice(0,40),
    referenceIdentity:reference.identity,currentIdentity:current.identity}
}

function inputPaths(){
  const output=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',...roots],{
    cwd:root,maxBuffer:32*1024*1024})
  return [...new Set([...output.toString('utf8').split('\0').filter(Boolean),...ignoredInputs])]
    .filter(name=>codeSuffix.test(name)&&!excluded.test(name)).sort()
}

export function captureSourceFence(){
  const inputs={}
  let total=0
  for(const name of inputPaths()){
    const full=path.join(root,name)
    if(!fs.existsSync(full))continue
    const stat=fs.lstatSync(full)
    if(!stat.isFile())throw Error('UNSAFE_SOURCE_ENTRY:'+name)
    total+=stat.size
    if(total>512*1024*1024)throw Error('SOURCE_FENCE_SIZE_LIMIT_EXCEEDED')
    inputs[name]=fs.readFileSync(full)
  }
  if(!inputs['research/oss/clothcraft/src/bin/exo-session.rs'])
    throw Error('ACTIVE_NATIVE_SOURCE_NOT_CAPTURED')
  const snapshot=fingerprintInputMap(inputs)
  return {...snapshot,createdAt:new Date().toISOString(),fileCount:Object.keys(snapshot.records).length,
    sourceBytes:total}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [, , mode, manifestFile]=process.argv
  if(!['--write','--verify'].includes(mode)||!manifestFile)
    throw Error('Usage: v2-source-freeze-20261030.mjs --write|--verify FENCE_JSON')
  const full=path.resolve(manifestFile)
  if(!full.startsWith(root+path.sep))throw Error('SOURCE_FENCE_PATH_MUST_BE_IN_REPOSITORY')
  if(mode==='--write'){
    const manifest=captureSourceFence()
    fs.mkdirSync(path.dirname(full),{recursive:true})
    fs.writeFileSync(full,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600})
    console.log(JSON.stringify({status:'captured',identity:manifest.identity,fileCount:manifest.fileCount,
      sourceBytes:manifest.sourceBytes,manifestFile:full}))
  }else{
    const reference=JSON.parse(fs.readFileSync(full,'utf8'))
    const result=compareInputFingerprints(reference,captureSourceFence())
    console.log(JSON.stringify(result,null,2))
    if(!result.ok)process.exitCode=2
  }
}

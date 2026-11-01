import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'

export const runtimePaths = [
  'integrations/clothcraft/server.mjs',
  'integrations/clothcraft/workspace.mjs',
  'integrations/clothcraft/bridge.mjs',
  'integrations/clothcraft/workspace-auth.mjs',
  'integrations/clothcraft/agent-api.mjs',
  'integrations/clothcraft/rust-agent-api/client.mjs',
  'integrations/clothcraft/rust-service/validator-client.mjs',
  'web/index.html',
  'bin/node',
  'native_cpp/build-cmake/garment_cad_cli',
  'research/oss/clothcraft/target/debug/cloth-template',
  'research/oss/clothcraft/target/debug/cloth-fit',
  'research/oss/clothcraft/target/debug/exo-session',
  'integrations/clothcraft/rust-agent-api/target/debug/exo-agent-validator',
  'integrations/clothcraft/rust-service/target/debug/exo-metadata-validation',
  'integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host',
]
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const MAX_FILES=4096
const MAX_TOTAL_BYTES=1024*1024*1024
const activeAssetRoot='web/assets'
const wasmRoot='web/wasm'
const serviceRoots=['integrations/clothcraft','src/core','node_modules']

function packagedPaths(root) {
  // A long-lived V2 install accumulates hundreds of no-longer-referenced Vite
  // generations. Hash the CURRENT HTML entry and its referenced JS/CSS modules,
  // not arbitrary historic files left in web/assets. Otherwise a valid app
  // exceeds the 1 GiB integrity budget and no manifest can be created.
  const discovered=new Set()
  const pending=[]
  const acceptAsset=relative=>{
    if (!/^web\/assets\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp)$/.test(relative))
      throw Error(`INVALID_ACTIVE_RUNTIME_ASSET:${relative}`)
    if (discovered.has(relative)) return
    if (!fs.existsSync(path.join(root,relative)))
      throw Error(`MISSING_ACTIVE_RUNTIME_ASSET:${relative}`)
    discovered.add(relative)
    pending.push(relative)
    if(discovered.size>MAX_FILES)throw Error('RUNTIME_FILE_LIMIT_EXCEEDED')
  }
  const resolveAsset=(source,reference)=>{
    const clean=reference.split(/[?#]/)[0]
    if(clean.startsWith('/assets/'))return `web${clean}`
    if(clean.startsWith('assets/'))return `web/${clean}`
    if(clean.startsWith('./')||clean.startsWith('../')){
      const relative=path.posix.normalize(path.posix.join(path.posix.dirname(source),clean))
      return relative.startsWith('web/assets/')?relative:null
    }
    return null
  }
  const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8')
  const references=[...html.matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi)]
    .map(match=>match[1])
    .filter(value=>/^(?:\/|\.\/)?assets\//.test(value))
  if(!references.some(value=>/\.js(?:[?#]|$)/.test(value)))
    throw Error('MISSING_ACTIVE_RUNTIME_ENTRYPOINT')
  for(const reference of references){
    const target=resolveAsset('web/index.html',reference)
    if(target)acceptAsset(target)
  }
  while(pending.length){
    const relative=pending.pop()
    if(!/\.(?:js|css)$/.test(relative))continue
    const body=fs.readFileSync(path.join(root,relative),'utf8')
    // Vite names dynamic chunks and styles inside JS strings (sometimes via
    // the modulepreload helper), and CSS may use relative @imports. Include
    // existing JS/CSS siblings reachable through these literal references.
    const explicitReferences=[
      ...[...body.matchAll(/\bimport\s*(?:\(\s*)?['"]([^'"]+\.(?:js|css)(?:\?[^'"]*)?)['"]/g)].map(match=>match[1]),
      ...[...body.matchAll(/\bfrom\s*['"]([^'"]+\.(?:js|css)(?:\?[^'"]*)?)['"]/g)].map(match=>match[1]),
      ...[...body.matchAll(/\bnew\s+URL\s*\(\s*['"]([^'"]+\.(?:js|css|png|svg|webp|jpe?g|woff2?))['"]/g)].map(match=>match[1]),
      ...[...body.matchAll(/\burl\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match=>match[1]),
    ]
    for(const reference of explicitReferences){
      const target=resolveAsset(relative,reference)
      if(target)acceptAsset(target)
    }
    // Vite modulepreload helper uses literal chunk basenames rather than
    // import() for some dependencies. Include existing hashed JS/CSS siblings.
    for(const match of body.matchAll(/(?:\/assets\/|\.\/)?([A-Za-z0-9._-]+\.(?:js|css))\b/g)){
      const target=`${activeAssetRoot}/${match[1]}`
      if(fs.existsSync(path.join(root,target)))acceptAsset(target)
    }
    // Vite's modulepreload dependency map may retain only bare hashed chunk
    // names. A missing listed chunk is not harmless: fail before declaring the
    // deployed entrypoint complete rather than silently skipping the filename.
    for(const match of body.matchAll(/\b([A-Za-z0-9._-]+-[A-Za-z0-9_-]{8}\.(?:js|css))\b/g)){
      acceptAsset(`${activeAssetRoot}/${match[1]}`)
    }
  }
  const wasmDirectory=path.join(root,wasmRoot)
  if(!fs.existsSync(wasmDirectory))throw Error(`MISSING_RUNTIME_DIRECTORY:${wasmRoot}`)
  for(const entry of fs.readdirSync(wasmDirectory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(!/^[A-Za-z0-9._-]+$/.test(entry.name)||!entry.isFile())
      throw Error(`UNSUPPORTED_RUNTIME_ENTRY:${wasmRoot}/${entry.name}`)
    discovered.add(`${wasmRoot}/${entry.name}`)
  }
  // The builder stages a transitive first-party ESM and locked npm package
  // closure. Hash those ACTIVE module bytes too: a release manifest that only
  // checks server.mjs misses a changed dependency under src/core or
  // node_modules. Do not include old compiled web generations or QA fixtures.
  const scanRuntimeModules=relative=>{
    const directory=path.join(root,relative)
    if(!fs.existsSync(directory))return
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(!/^[A-Za-z0-9@._-]+$/.test(entry.name) || entry.name==='.' || entry.name==='..')
        throw Error(`INVALID_RUNTIME_MODULE_ENTRY:${relative}/${entry.name}`)
      const child=`${relative}/${entry.name}`
      if(entry.isDirectory())scanRuntimeModules(child)
      else if(entry.isFile()){
        if(/\.(?:mjs|cjs|js|json|node|wasm)$/.test(entry.name)){
          discovered.add(child)
          if(discovered.size>MAX_FILES)throw Error('RUNTIME_FILE_LIMIT_EXCEEDED')
        }
      }else throw Error(`UNSUPPORTED_RUNTIME_MODULE_ENTRY:${child}`)
    }
  }
  for(const relative of serviceRoots)scanRuntimeModules(relative)
  if(discovered.size>MAX_FILES)throw Error('RUNTIME_FILE_LIMIT_EXCEEDED')
  return [...new Set([...runtimePaths,...discovered])].sort()
}

function fileHashes(root, paths) {
  let total=0
  return Object.fromEntries(paths.map(relative=>{
    const filename=path.join(root,relative)
    const stat=fs.lstatSync(filename)
    if(!stat.isFile() || stat.size>MAX_TOTAL_BYTES || (total+=stat.size)>MAX_TOTAL_BYTES)
      throw Error('RUNTIME_SIZE_LIMIT_EXCEEDED')
    return [relative,{sha256:digest(fs.readFileSync(filename)),bytes:stat.size}]
  }))
}

export function createRuntimeProvenance(resourceRoot, {builtAt = new Date().toISOString()} = {}) {
  const files=fileHashes(resourceRoot,packagedPaths(resourceRoot))
  const identity = digest(Buffer.from(JSON.stringify(files)))
  // The outer macOS executable is intentionally NOT hashed: code signing
  // rewrites its bytes after this resource manifest is written. Gate its
  // integrity with codesign --verify instead. Native Rust resources are still
  // covered by content hashes.
  return {schema:'exo.desktop.runtime-provenance.v3', builtAt, identity,
    coverage:'active-web-entrypoint-and-imports-plus-all-web-wasm-and-native-resources-excluding-outer-signed-macos-executable', files}
}

export function verifyRuntimeProvenance(resourceRoot) {
  const manifestFile=path.join(resourceRoot,'runtime-provenance.json')
  try {
    const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'))
    if (manifest.schema!=='exo.desktop.runtime-provenance.v3' ||
        manifest.coverage!=='active-web-entrypoint-and-imports-plus-all-web-wasm-and-native-resources-excluding-outer-signed-macos-executable' ||
        Object.keys(manifest.files || {}).join('|')!==packagedPaths(resourceRoot).join('|') ||
        digest(Buffer.from(JSON.stringify(manifest.files)))!==manifest.identity) {
      return {status:'invalid-manifest',verified:false}
    }
    let total=0
    for (const relative of Object.keys(manifest.files)) {
      const expected=manifest.files[relative]
      const filename=path.join(resourceRoot,relative)
      const stat=fs.lstatSync(filename)
      if(!stat.isFile() || stat.size>MAX_TOTAL_BYTES || (total+=stat.size)>MAX_TOTAL_BYTES)
        return {status:'invalid-manifest',verified:false}
      const bytes=fs.readFileSync(filename)
      if (bytes.length!==expected.bytes || digest(bytes)!==expected.sha256)
        return {status:'runtime-mismatch',verified:false,identity:manifest.identity,mismatch:relative}
    }
    return {status:'verified',verified:true,identity:manifest.identity,builtAt:manifest.builtAt}
  } catch(error) {
    return {status:fs.existsSync(manifestFile)?'invalid-manifest':'manifest-missing',verified:false}
  }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const verifyOnly=process.argv[2]==='--verify'
  const root=process.argv[verifyOnly?3:2]
  if (!root) throw Error('RESOURCE_ROOT_REQUIRED')
  if (verifyOnly) {
    const result=verifyRuntimeProvenance(root)
    if (!result.verified) throw Error(`RUNTIME_PROVENANCE_VERIFICATION_FAILED:${result.status}:${result.mismatch||''}`)
    console.log(`EXO runtime provenance verified ${result.identity}`)
  } else {
  const manifest=createRuntimeProvenance(root)
  fs.writeFileSync(path.join(root,'runtime-provenance.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'w'})
  if (!verifyRuntimeProvenance(root).verified) throw Error('RUNTIME_PROVENANCE_VERIFICATION_FAILED')
  console.log(`EXO runtime provenance ${manifest.identity}`)
  }
}

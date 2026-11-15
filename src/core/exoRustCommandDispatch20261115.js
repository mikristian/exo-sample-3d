// EXO V3 Stage A: keep React as presentation; route supported actions to the
// authenticated Rust/ClothCraft native workspace. Do not reinterpret a legacy
// JS/C++ operation as verified Rust merely because it crosses this boundary.
const UNVERSIONED = new Set(['snapshot','save','pause','open'])
export const RUST_ROUTE_EVIDENCE = Object.freeze({
  'snapshot':'native-rust-session',
  'save':'native-rust-session',
  'edit':'native-rust-session',
  'edit-batch':'native-rust-session',
  'undo':'native-rust-session',
  'redo':'native-rust-session',
  'set-property':'native-rust-session',
  'grade-run-status':'native-rust-session',
  'grade-run-cutlines':'native-rust-session',
  'grade-run-activate':'native-rust-session',
  'grade-run-restore':'native-rust-session',
  'step':'native-rust-session',
  'reset':'native-rust-session',
  'grab':'native-rust-session',
})
const OWN = (value,key)=>Object.prototype.hasOwnProperty.call(value,key)
const validRevision = value=>Number.isSafeInteger(value)&&value>=0
const object = value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)

export function prepareRustWorkspaceCommand20261115(data,currentRevision){
  if(!object(data)||typeof data.op!=='string'||!/^[a-z][a-z0-9-]{0,80}$/.test(data.op))
    throw Error('Invalid native Rust command envelope')
  if(currentRevision!==undefined&&currentRevision!==null&&!validRevision(currentRevision))
    throw Error('Invalid current Rust document revision')
  const explicit=OWN(data,'revision')?data.revision:undefined
  if(explicit!==undefined&&!validRevision(explicit))
    throw Error('Invalid native Rust command revision')
  if(!UNVERSIONED.has(data.op)&&explicit!==undefined&&currentRevision!==undefined&&currentRevision!==null&&
     explicit!==currentRevision)
    throw Error('Stale Rust document revision; refresh before sending command')
  const revision=explicit===undefined?currentRevision:explicit
  if(!UNVERSIONED.has(data.op)&&!validRevision(revision))
    throw Error('Rust document must be loaded before editing')
  if(data.op==='edit'&&!object(data.command))
    throw Error('Rust edit requires a native command object')
  if(data.op==='edit-batch'&&(!Array.isArray(data.commands)||
    data.commands.length<1||data.commands.length>256||data.commands.some(command=>!object(command))))
    throw Error('Native Rust edit batch must contain 1–256 commands')
  if(data.op==='grade-run-activate'&&
     (typeof data.size!=='string'||data.size.length<1||data.size.length>64||
      Array.from(data.size).some(ch=>/[\x00-\x1f\x7f]/.test(ch))))
    throw Error('Invalid Rust graded-size label')
  // Preserve legacy packet shape: existing workspace handlers may not all be
  // native Rust. The *verification ledger*, not this serializer, owns parity.
  return Object.freeze({...data,...(revision===undefined?{}:{revision})})
}

export async function dispatchRustWorkspaceCommand20261115({
  base,data,currentRevision,bridgeFetch,headers,
}){
  if(typeof bridgeFetch!=='function'||typeof headers!=='function')
    throw Error('Authenticated native Rust transport is required')
  const url=new URL(base)
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||
     url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw Error('Refusing non-local native Rust workspace origin')
  const packet=prepareRustWorkspaceCommand20261115(data,currentRevision)
  const response=await bridgeFetch(url.origin+'/workspace',{
    method:'POST',headers:headers(),body:JSON.stringify(packet),
  })
  if(!response||typeof response.json!=='function')
    throw Error('Native Rust workspace returned no response')
  let result
  try {result=await response.json()}
  catch {throw Error('Native Rust workspace returned invalid JSON')}
  if(!object(result)||typeof result.ok!=='boolean')
    throw Error('Native Rust workspace returned invalid response envelope')
  if(!response.ok||!result.ok)
    return {...result,ok:false,error:result.error||'ClothCraft native Rust command rejected'}
  return result
}

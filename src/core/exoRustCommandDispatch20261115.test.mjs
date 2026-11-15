import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prepareRustWorkspaceCommand20261115 as packet,
  dispatchRustWorkspaceCommand20261115 as dispatch,
  RUST_ROUTE_EVIDENCE,
} from './exoRustCommandDispatch20261115.js'

test('exact typed revision and commands preserve old /workspace packet shape',()=>{
  assert.deepEqual(packet({op:'snapshot',avatar:true},undefined),{op:'snapshot',avatar:true})
  assert.deepEqual(packet({op:'save'},undefined),{op:'save'})
  assert.deepEqual(packet({op:'open',preset:'tshirt'},undefined),{op:'open',preset:'tshirt'})
  assert.deepEqual(packet({op:'snapshot',revision:1},2),{op:'snapshot',revision:1})
  assert.deepEqual(packet({op:'edit',command:{kind:'MovePoint',point:1}},5),
    {op:'edit',command:{kind:'MovePoint',point:1},revision:5})
  assert.deepEqual(packet({op:'grade-run-activate',revision:7,size:'XL'},7),
    {op:'grade-run-activate',revision:7,size:'XL'})
  assert.equal(Object.isFrozen(packet({op:'undo'},4)),true)
  assert.equal(RUST_ROUTE_EVIDENCE['grade-run-activate'],'native-rust-session')
  assert.equal(RUST_ROUTE_EVIDENCE['unknown-operation'],undefined)
})
test('fail closed on invalid op, unsafe revision, stale state and malformed commands',()=>{
  for(const bad of [null,[],3,{}, {op:''},{op:'../../rpc'},{op:'edit',command:3}]){
    assert.throws(()=>packet(bad,0))
  }
  for(const rev of [-1,1.5,NaN,Infinity,2**53,'1']){
    assert.throws(()=>packet({op:'undo',revision:rev},undefined))
    assert.throws(()=>packet({op:'edit',command:{}},rev))
  }
  assert.throws(()=>packet({op:'undo',revision:6},5),/Stale/)
  assert.throws(()=>packet({op:'edit',command:{}},undefined),/loaded/)
  for(const size of ['',null,12,'XL\u0000','X'.repeat(65)]){
    assert.throws(()=>packet({op:'grade-run-activate',size},2))
  }
  for(const commands of [[],new Array(257).fill({}),[null]]){
    assert.throws(()=>packet({op:'edit-batch',commands},2))
  }
})
test('verified Rust command path POSTs using injected authenticated bridge, no JS fallback',async()=>{
  let captured
  const expected={ok:true,data:{revision:4,template:{panels:[]}}}
  const out=await dispatch({base:'http://127.0.0.1:5485',data:{op:'edit',command:{kind:'MovePoint'}},
    currentRevision:3,headers:()=>({'Authorization':'Bearer TEST'}),bridgeFetch:async(url,options)=>{
      captured={url,options}
      return {ok:true,json:async()=>expected}
    }})
  assert.deepEqual(out,expected)
  assert.equal(captured.url,'http://127.0.0.1:5485/workspace')
  assert.deepEqual(captured.options.headers,{'Authorization':'Bearer TEST'})
  assert.deepEqual(JSON.parse(captured.options.body),
    {op:'edit',command:{kind:'MovePoint'},revision:3})
})
test('rejects non-local targets and invalid responses instead of hiding failures',async()=>{
  for(const base of ['https://example.com','http://evil.example:5485','http://127.0.0.1:5485/path','http://127.0.0.1:5485/?x=1'])
    await assert.rejects(()=>dispatch({base,data:{op:'save'},bridgeFetch:async()=>({ok:true,json:async()=>({ok:true})}),headers:()=>({})}))
  const params={base:'http://127.0.0.1:5385',data:{op:'undo'},currentRevision:1,headers:()=>({})}
  const rejected=await dispatch({...params,bridgeFetch:async()=>({ok:false,json:async()=>({ok:false,error:'Invalid seam'})})})
  assert.equal(rejected.ok,false)
  assert.equal(rejected.error,'Invalid seam')
  await assert.rejects(()=>dispatch({...params,bridgeFetch:async()=>({ok:true,json:async()=>null})}),/invalid response/)
  await assert.rejects(()=>dispatch({...params,bridgeFetch:async()=>({ok:true,json:async()=>{throw Error('decode')}})}),/invalid JSON/)
})

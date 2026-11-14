import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

// Exercise the actual workspace request callback, not a duplicate helper.
// The component is JSX, so isolate its single-line callback in a controlled
// environment without launching another browser or touching a user project.
const component = readFileSync(new URL('../components/ClothCraftWorkspace.jsx', import.meta.url), 'utf8')
const requestSource = component.match(/const request=useCallback\(async\(data\)=>\{[^\n]+\},\[\]\)/)?.[0]
assert.ok(requestSource, 'native workspace request callback must be present')

function harness({httpOk=true,body={ok:true,data:{revision:8,template:{id:'updated'}}},operation='edit'}={}) {
  const original={revision:7,template:{id:'trusted'},avatar:{id:'avatar-original'}}
  const state={current:original},lock={current:false},running={current:false}
  const errors=[],snapshots=[],busy=[],playing=[],requests=[],nativeGradeLastError={current:''}
  const context={
    useCallback:callback=>callback,BASE:'/test',state,lock,running,nativeGradeLastError,
    fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return {ok:httpOk,json:async()=>body}},
    setBusy:value=>busy.push(value),setError:value=>errors.push(value),
    setS:value=>snapshots.push(value),setPlaying:value=>playing.push(value),
  }
  const callback=runInNewContext(requestSource.replace(/^const request=/,''),context)
  return {run:()=>callback({op:operation}),state,original,errors,snapshots,busy,playing,requests,lock,nativeGradeLastError}
}

test('HTTP 409 with forged template must not poison authoritative workspace state',async()=>{
  const h=harness({httpOk:false,body:{ok:false,error:'stale revision',data:{revision:900,template:{id:'forged'},gradeRun:{approved:true}}}})
  assert.equal(await h.run(),null)
  assert.equal(h.state.current,h.original)
  assert.equal(h.snapshots.length,0)
  assert.match(h.errors.at(-1),/stale revision/)
  assert.equal(h.lock.current,false)
  assert.deepEqual(h.busy,[true,false])
  await h.run()
  assert.deepEqual(h.requests.map(request=>request.revision),[7,7],
    'a subsequent native request must not send a revision from rejected data')
})

test('HTTP 200 with backend ok:false and forged template must not mutate state',async()=>{
  const h=harness({body:{ok:false,error:'unsafe edit',data:{revision:10,template:{id:'forged'}}}})
  assert.equal(await h.run(),null)
  assert.equal(h.state.current,h.original)
  assert.equal(h.snapshots.length,0)
  assert.match(h.nativeGradeLastError.current,/unsafe edit/)
})

test('valid response updates template and retains current avatar when omitted',async()=>{
  const h=harness()
  const data=await h.run()
  assert.equal(data.template.id,'updated')
  assert.equal(h.state.current.template.id,'updated')
  assert.equal(h.state.current.avatar,h.original.avatar)
  assert.equal(h.snapshots.length,1)
  assert.equal(h.errors.at(-1),'')
  await h.run()
  assert.deepEqual(h.requests.map(request=>request.revision),[7,8],
    'a subsequent request must use the newly accepted revision')
})

test('valid read-only response returns data without replacing current template',async()=>{
  const data={status:'ready',persistedInProject:true}
  const h=harness({body:{ok:true,data}})
  assert.equal(await h.run(),data)
  assert.equal(h.state.current,h.original)
  assert.equal(h.snapshots.length,0)
})

test('open response with no avatar does not carry avatar from previous project',async()=>{
  const h=harness({operation:'open'})
  await h.run()
  assert.equal(h.state.current.avatar,null)
})

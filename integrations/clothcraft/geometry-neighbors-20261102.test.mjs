import assert from 'node:assert/strict'
import {test} from 'node:test'
import {spawn} from 'node:child_process'

test('actual trained source embeddings return ordered, sourced neighbors only for trusted UI', {timeout:30000}, async()=>{
  const port=48000+Math.floor(Math.random()*10000)
  const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
    cwd:new URL('../../',import.meta.url),env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port)},stdio:['ignore','pipe','pipe']})
  const base=`http://127.0.0.1:${port}/pattern-intelligence/v1/geometry-neighbors`
  const origin='http://127.0.0.1:5173'
  const request=async(suffix='',headers={Origin:origin})=>{
    const response=await fetch(base+suffix,{headers})
    return {status:response.status,body:await response.json()}
  }
  try {
    let ready=false
    for(let i=0;i<100;i++) {
      if(child.exitCode!==null)throw new Error('server exited')
      try {await fetch(`http://127.0.0.1:${port}/health`);ready=true;break} catch {await new Promise(resolve=>setTimeout(resolve,100))}
    }
    assert.ok(ready)
    const {status,body}=await request('?sourceId=default%2F00%2Frand_00YONAPXZE&limit=5')
    assert.equal(status,200)
    assert.equal(body.searchMode,'learned_geometry_embedding_nearest_source')
    assert.equal(body.embeddingDimensions,16)
    assert.equal(body.embeddingCount,50036)
    assert.equal(body.results.length,5)
    assert.ok(body.results.every(item=>item.sourceId!==body.sourceId && item.license && Number.isFinite(item.similarity)))
    assert.ok(body.results.every((item,i)=>i===0||item.similarity<=body.results[i-1].similarity))
    assert.equal((await request('?sourceId=invalid')).status,400)
    assert.equal((await request('?sourceId=abc&limit=31')).status,400)
    assert.equal((await request('?sourceId=abc&query=hoodie')).status,400)
    assert.equal((await request('?sourceId=abc',{Origin:'http://untrusted.example'})).status,403)
  } finally {child.kill('SIGTERM')}
})

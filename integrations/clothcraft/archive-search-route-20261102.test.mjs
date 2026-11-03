import assert from 'node:assert/strict'
import {test} from 'node:test'
import {spawn} from 'node:child_process'

test('trusted archive search endpoint validates access, parameters, provenance and live coverage', {timeout:20000}, async () => {
  const port = 46000 + Math.floor(Math.random()*10000)
  const child = spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
    cwd:new URL('../../',import.meta.url),env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port)},stdio:['ignore','pipe','pipe']})
  const base=`http://127.0.0.1:${port}/pattern-intelligence/v1/archive-search`
  const origin='http://127.0.0.1:5173'
  async function request(path='',options={}) {
    const response=await fetch(base+path,{headers:{Origin:origin,...options.headers},method:options.method})
    return {status:response.status,data:await response.json()}
  }
  try {
    let ready=false
    for(let i=0;i<75;i++) {
      if(child.exitCode!==null) throw new Error('bridge exited before startup')
      try {await fetch(`http://127.0.0.1:${port}/health`);ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,100))}
    }
    assert.equal(ready,true,'bridge should start')
    const found=await request('?sourceId=default%2F00%2Frand_00YONAPXZE')
    assert.equal(found.status,200)
    assert.equal(found.data.matched,1)
    assert.equal(found.data.results[0].sourceId,'default/00/rand_00YONAPXZE')
    assert.equal(found.data.results[0].license,'CC BY 4.0')
    assert.ok(found.data.coverage.indexed>=100000)
    assert.ok(found.data.coverage.recordedDxfPaths>=0)
    assert.equal((await request('?unapprovedFilter=true')).status,400)
    assert.equal((await request('?limit=abc')).status,400)
    assert.equal((await request('',{headers:{Origin:'http://untrusted.example'}})).status,403)
    // Workspace-wide POST authorization runs before route method validation.
    assert.equal((await request('',{method:'POST'})).status,401)
  } finally {child.kill('SIGTERM')}
})

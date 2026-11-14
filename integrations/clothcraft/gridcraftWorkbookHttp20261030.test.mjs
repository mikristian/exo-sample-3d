import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {randomBytes} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'

test('local workbook endpoint enforces trusted UI and bearer, calculates native Rust grid in disposable bridge',async()=>{
  const listener=net.createServer()
  listener.listen(0,'127.0.0.1')
  await once(listener,'listening')
  const port=listener.address().port
  await new Promise(resolve=>listener.close(resolve))
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-gridcraft-http-'))
  const token=randomBytes(32).toString('hex')
  const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
    env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:dir,EXO_WORKSPACE_TOKEN:token},
    stdio:['ignore','pipe','pipe'],
  })
  const route='/techpack/gridcraft/v2/workbook/evaluate'
  const base=`http://127.0.0.1:${port}`
  const request=async(url,method='GET',auth='',origin='http://127.0.0.1:5386',payload)=>{
    const response=await fetch(base+url,{method,headers:{
      ...(origin?{Origin:origin}:{}),...(auth?{Authorization:`Bearer ${auth}`}:{}),
      ...(payload?{'Content-Type':'application/json'}:{})
    },...(payload?{body:JSON.stringify(payload)}:{})})
    return {status:response.status,body:await response.json()}
  }
  try{
    await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Bridge startup timeout')),10000))])
    assert.equal((await request('/health')).status,200)
    assert.equal((await request(route,'POST','',undefined,{cells:[['1']]})).status,401)
    assert.equal((await request(route,'POST','', 'http://127.0.0.1:5386',{cells:[['1']]})).status,401)
    assert.equal((await request(route,'POST',token,'http://attacker.invalid',{cells:[['1']]})).status,403)
    assert.equal((await request(route,'POST',token,'http://127.0.0.1:5386',{cells:[['=WEBSERVICE(A1)']]})).status,422)
    const status=await request('/techpack/gridcraft/v2/workbook/status')
    assert.equal(status.status,200)
    assert.equal(status.body.engine,'gridcraft-rust-workbook')
    if(status.body.available){
      const calculated=await request(route,'POST',token,'http://127.0.0.1:5386',{
        cells:[['10','20','=A1+B1'],['2','3','=SUM(A1:C1)']]
      })
      assert.equal(calculated.status,200,JSON.stringify(calculated))
      assert.deepEqual(calculated.body.values,[[10,20,30],[2,3,60]])
      assert.equal(calculated.body.source,'ephemeral-readonly')
    }
  }finally{
    child.kill('SIGTERM')
    if(child.exitCode===null)await once(child,'exit')
    fs.rmSync(dir,{recursive:true,force:true})
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {randomBytes} from 'node:crypto'

test('local bridge refuses spoofed Host before any agent or workspace route', async () => {
  const reserved = net.createServer()
  reserved.listen(0, '127.0.0.1')
  await once(reserved, 'listening')
  const port = reserved.address().port
  await new Promise(resolve => reserved.close(resolve))
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-local-host-'))
  const child = spawn(process.execPath, ['integrations/clothcraft/server.mjs'], {
    env: {...process.env, EXO_CLOTHCRAFT_PORT:String(port), EXO_CLOTHCRAFT_OUTPUT_DIR:output, EXO_WORKSPACE_TOKEN:randomBytes(32).toString('hex')},
    stdio:['ignore','pipe','pipe'],
  })
  try {
    await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(Error('Bridge startup timeout')), 10000))])
    const base = `http://127.0.0.1:${port}`
    for (const route of ['/health','/agent/v1/keys','/agent/v1/status','/workspace']) {
      const response = await new Promise((resolve,reject) => {
        const request=http.request({hostname:'127.0.0.1',port,path:route,method:route==='/workspace'?'POST':'GET',headers:{Host:`attacker.example:${port}`,Origin:'http://127.0.0.1:5386'}},res=>{
          let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}))
        });request.on('error',reject);request.end()
      })
      assert.equal(response.status,403,route)
      assert.equal(response.body.code,'HOST_FORBIDDEN',route)
    }
    const allowed = await fetch(base+'/health')
    assert.equal(allowed.status,200)
    assert.equal((await allowed.json()).ok,true)
  } finally {
    child.kill('SIGTERM')
    if(child.exitCode===null) await once(child,'exit')
    fs.rmSync(output,{recursive:true,force:true})
  }
})

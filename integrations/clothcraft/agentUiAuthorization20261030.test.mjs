import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {randomBytes} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL} from './workspaceBridgeProtocol20261030.mjs'

test('full bridge requires shell token for UI agent management and edits',async()=>{
 const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening')
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve))
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-agent-ui-auth-'))
 const token=randomBytes(32).toString('hex')
 const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{env:{...process.env,EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:dir,EXO_WORKSPACE_TOKEN:token},stdio:['ignore','pipe','pipe']})
 const base=`http://127.0.0.1:${port}`
 const call=async(route,method='GET',authorization,body)=>{
  const response=await fetch(base+route,{method,headers:{Origin:'http://127.0.0.1:5386',...(authorization?{Authorization:`Bearer ${authorization}`}:{})},...(body?{body:JSON.stringify(body)}:{})})
  return {status:response.status,body:await response.json()}
 }
 try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server startup timeout')),10000))])
  const health=await call('/health')
  assert.equal(health.status,200)
  assert.equal(health.body.workspaceBridgeProtocol,EXO_WORKSPACE_BRIDGE_PROTOCOL)
  assert.ok(health.body.workspaceBridgeCapabilities.includes('native-mirror-exclusive-owner'))
  assert.ok(health.body.workspaceBridgeCapabilities.includes('snapshot-metadata-v1'))
  assert.equal((await call('/agent/v1/keys')).status,401)
  assert.equal((await call('/agent/v1/keys','POST',undefined,{name:'forged',scopes:['read']})).status,401)
  assert.equal((await call('/agent/v1/actions','POST',undefined,{action:'workspace.save',expectedRevision:0})).status,401)
  const created=await call('/agent/v1/keys','POST',token,{name:'Scoped',scopes:['read']})
  assert.equal(created.status,201)
  assert.ok(created.body.key.startsWith('cck_'))
  assert.equal((await call('/agent/v1/keys','GET',created.body.key)).status,403)
  assert.equal((await call('/agent/v1/status','GET',created.body.key)).status,200)
  assert.equal((await call('/agent/v1/actions','POST',created.body.key,{action:'workspace.save',expectedRevision:0})).status,403)
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');fs.rmSync(dir,{recursive:true,force:true})}
})

// No modification of an existing EXO user's garment: all transactions are temp.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {createWorkspace} from './workspace.mjs'
import {EXO_CC0_AVATAR_MODELS_20261102} from '../../src/data/exoAvatarLibrary20261102.js'
const root=path.resolve(import.meta.dirname,'../..')
const idList=[]
for(const entry of EXO_CC0_AVATAR_MODELS_20261102){
  const fixture=path.join(root,entry.collider)
  assert.ok(fs.existsSync(fixture),'missing approved EXO OBJ '+entry.id)
  assert.equal(fs.lstatSync(fixture).isSymbolicLink(),false)
  const verts=[],faces=[]
  for(const line of fs.readFileSync(fixture,'utf8').split('\n')){
    if(line.startsWith('v '))verts.push(line.slice(2).trim().split(/\s+/).map(Number))
    else if(line.startsWith('f '))faces.push(line.slice(2).trim().split(/\s+/).map(Number))
  }
  assert.equal(verts.length,13380)
  assert.equal(faces.length,26756)
  assert.ok(verts.every(v=>v.length===3&&v.every(Number.isFinite)))
  const h=Math.max(...verts.map(v=>v[1]))-Math.min(...verts.map(v=>v[1]))
  assert.ok(Math.abs(h-entry.bodyHeightM)<0.003,'native height units differ')
  idList.push(entry.id)
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'exo-curated-av-'))
fs.mkdirSync(path.join(temp,'workspace'),{recursive:true})
const workspace=createWorkspace(temp)
try{
  let opened=await workspace.request({op:'open',preset:'tshirt',avatar:true})
  assert.equal(opened.ok,true,JSON.stringify(opened).slice(0,280))
  const results=[]
  for(const model of idList){
    const response=await workspace.request({op:'select-avatar',model})
    assert.equal(response.ok,true,`selected ${model}: ${response.error}`)
    assert.equal(response.data.avatarModel,model)
    assert.equal(response.data.avatar.positions.length,13380)
    assert.equal(response.data.avatar.triangles.length,26756)
    const bounds=response.data.avatar.positions
    const y=bounds.map(v=>v[1]);const h=Math.max(...y)-Math.min(...y)
    const expected=EXO_CC0_AVATAR_MODELS_20261102.find(x=>x.id===model)
    assert.ok(Math.abs(h-expected.bodyHeightM)<0.003,'Rust native avatar differs in height')
    const snap=await workspace.request({op:'snapshot',avatar:true})
    assert.equal(snap.ok,true)
    assert.equal(snap.data.avatarModel,model)
    results.push({model,verts:bounds.length,heightM:Math.round(h*10000)/10000})
  }
  console.log('EXO_NATIVE_AVATAR_SWITCH_PASS',JSON.stringify({results,root:temp}))
  const invalid=await workspace.request({op:'select-avatar',model:'../../../../tmp/malicious.obj'}).then(x=>x).catch(e=>({ok:false,error:e.message}))
  assert.equal(invalid.ok,false,'Must reject arbitrary avatar paths')
  workspace.close()
  const reloaded=createWorkspace(temp)
  try{
    const saved=await reloaded.request({op:'snapshot',avatar:true})
    assert.equal(saved.ok,true,'Reopen must preserve native linked document and journal: '+saved.error)
    assert.equal(saved.data.avatarModel,idList.at(-1),'Latest physical avatar ID must persist on reopen')
    assert.equal(saved.data.avatar.positions.length,13380)
    console.log('EXO_NATIVE_AVATAR_COLD_REOPEN_PASS',saved.data.avatarModel)
  }finally{reloaded.close()}
}finally{
  workspace.close()
  if(process.env.EXO_AVATAR_QA_KEEP_TEMP)console.log('EXO_KEEP_TEMP',temp);else fs.rmSync(temp,{recursive:true,force:true})
}

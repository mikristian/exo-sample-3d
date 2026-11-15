import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const cli=process.env.EXO_NATIVE_SESSION_BIN
const avatar=process.env.EXO_NATIVE_AVATAR||resolve(root,'public/avatars/makehuman-base.obj')
if(!cli)throw Error('Set EXO_NATIVE_SESSION_BIN to the compiled ClothCraft Rust exo-session executable')
const child=spawn(cli,[avatar],{stdio:['pipe','pipe','pipe']})
const queue=[]
const stderr=[]
child.stderr.on('data',chunk=>{if(stderr.length<20)stderr.push(String(chunk))})
const lines=createInterface({input:child.stdout})
lines.on('line',line=>{
  const pending=queue.shift()
  if(!pending)throw Error('Native session sent an unsolicited response')
  try{pending.resolve(JSON.parse(line))}
  catch(error){pending.reject(error)}
})
child.on('exit',(code,signal)=>{
  while(queue.length)queue.shift().reject(Error('Rust native process exited: '+code+' / '+signal+' '+stderr.join(' ')))
})
const send=packet=>new Promise((resolve,reject)=>{
  queue.push({resolve,reject})
  child.stdin.write(JSON.stringify(packet)+'\n')
})
try{
  const opened=await send({op:'open',preset:'tshirt'})
  assert.equal(opened.ok,true,opened.error)
  const initial=opened.data
  assert.ok(initial?.template?.panels?.length>=1)
  assert.ok(initial?.template?.fabrics?.length>=1)
  const baseline=initial.template.panels.length
  const fabric=initial.template.fabrics[0].id
  const points=[[1.65,-.2],[1.86,-.2],[1.86,.06],[1.65,.06]]
  const tangents=[[0,0],[0,0],[0,0],[0,0]]
  const commit=await send({
    op:'edit',revision:initial.revision,
    command:{kind:'Polygon',points,tangents,fabric},
  })
  assert.equal(commit.ok,true,commit.error)
  assert.equal(commit.data.template.panels.length,baseline+1)
  const newPanel=commit.data.template.panels.find(p=>!initial.template.panels.some(q=>q.id===p.id))
  assert.ok(newPanel?.id,'Rust did not author a new garment polygon')
  const stale=await send({op:'undo',revision:initial.revision})
  assert.equal(stale.ok,false,'Stale revision must be rejected by Rust document')
  assert.match(stale.error,/Stale/)
  const undo=await send({op:'undo',revision:commit.data.revision})
  assert.equal(undo.ok,true,undo.error)
  assert.equal(undo.data.template.panels.length,baseline)
  const redo=await send({op:'redo',revision:undo.data.revision})
  assert.equal(redo.ok,true,redo.error)
  assert.equal(redo.data.template.panels.length,baseline+1)
  const restored=redo.data.template.panels.find(p=>p.id===newPanel.id)
  assert.ok(restored,'Rust Undo/Redo changed the authored panel identity')
  console.log('PASS: Rust pen Polygon commit accepted; new panel',newPanel.id)
  console.log('PASS: original panel count',baseline,'->',baseline+1,'->',baseline,'->',baseline+1)
  console.log('PASS: Rust stale revision refused, Undo/Redo preserved stable panel ID')
  console.log('NOTE: This exercises the Rust native document, not a browser pointer-event test.')
}finally{
  child.stdin.end()
}

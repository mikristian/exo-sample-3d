import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'

const root=path.dirname(fileURLToPath(import.meta.url))
const swift=fs.readFileSync(path.join(root,'EXOClothCraftWorkspaceV2.swift'),'utf8')
const embedded=/private static let stagingWatchdogScript = #"""\n([\s\S]*?)\n\s*"""#/.exec(swift)?.[1]
const alive=pid=>{
  if(!Number.isSafeInteger(pid)||pid<=0)return false
  try{process.kill(pid,0);return true}catch(error){return error.code!=='ESRCH'}
}
const waitFor=async(condition,ms=8000)=>{
  const start=Date.now()
  while(Date.now()-start<ms){
    if(condition())return true
    await sleep(80)
  }
  return false
}

test('the actual Swift staging watchdog terminates its own orphaned bridge and nested Rust child',async t=>{
  assert.ok(embedded && embedded.includes('ps -o ppid= -p "$$"'),'Watchdog Swift source must be extractable')
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'exo-watchdog-isolation-'))
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}))
  // No installed/staged app or session may be contacted. The witness processes
  // below are synthetic and write their own PIDs into this disposable directory.
  const childSource=[
    'const {spawn}=require("node:child_process"),fs=require("node:fs")',
    'const path=require("node:path")',
    'if(process.argv[1]==="bridge"){',
    ' const nested=spawn(process.execPath,["-e","setInterval(()=>{},2000)"],{stdio:"ignore"})',
    ' fs.writeFileSync(path.join(process.argv[2],"nested-pid"),String(nested.pid))',
    '}',
    'setInterval(()=>{},2000)',
  ].join(';')
  const launcherSource=[
    'const {spawn}=require("node:child_process"),fs=require("node:fs"),path=require("node:path")',
    'const folder=process.argv[1],watchdog=process.argv[2],childSource=process.argv[3]',
    'const one=spawn(process.execPath,["-e",childSource,"bridge",folder],{stdio:"ignore"})',
    'const two=spawn(process.execPath,["-e",childSource,"worker",folder],{stdio:"ignore"})',
    'fs.writeFileSync(path.join(folder,"children"),JSON.stringify([one.pid,two.pid]))',
    'const sh=spawn("/bin/sh",["-c",watchdog,"exo-staging-watchdog",String(process.pid),String(one.pid),String(two.pid)],{stdio:"ignore"})',
    'fs.writeFileSync(path.join(folder,"watchdog-pid"),String(sh.pid))',
    'setInterval(()=>{},2000)',
  ].join(';')
  const launcher=spawn(process.execPath,['-e',launcherSource,folder,embedded,childSource],{stdio:'ignore'})
  const tracked=new Set([launcher.pid])
  try{
    assert.ok(await waitFor(()=>fs.existsSync(path.join(folder,'children'))&&
      fs.existsSync(path.join(folder,'nested-pid'))&&
      fs.existsSync(path.join(folder,'watchdog-pid'))),'Synthetic staging services did not start')
    const children=JSON.parse(fs.readFileSync(path.join(folder,'children'),'utf8'))
    const nested=Number(fs.readFileSync(path.join(folder,'nested-pid'),'utf8'))
    const watchdog=Number(fs.readFileSync(path.join(folder,'watchdog-pid'),'utf8'))
    for(const pid of [...children,nested,watchdog])tracked.add(pid)
    assert.ok(children.every(alive)&&alive(nested)&&alive(watchdog))
    // A failed Node bridge may die before the AppKit shell. Its Rust child
    // is then reparented and is no longer discoverable with pgrep -P Node
    // when AppKit eventually exits. The watchdog must remember the identity
    // of descendants it saw while the Node bridge was still alive.
    await sleep(700)
    process.kill(children[0],'SIGTERM')
    assert.ok(await waitFor(()=>!alive(children[0]),2000),'Synthetic Node bridge did not exit')
    assert.ok(alive(nested),'The native grandchild did not outlive its bridge for this test')
    process.kill(launcher.pid,'SIGKILL')
    assert.ok(await waitFor(()=>children.every(pid=>!alive(pid))&&!alive(nested),8500),
      'A terminated staged AppKit launcher must not orphan its Node/Rust children')
    assert.ok(await waitFor(()=>!alive(watchdog),3000),'Watchdog did not retire')
  }finally{
    for(const pid of tracked)if(alive(pid))try{process.kill(pid,'SIGTERM')}catch{}
  }
})

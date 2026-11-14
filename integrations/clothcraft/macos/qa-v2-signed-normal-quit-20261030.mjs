#!/usr/bin/env node
// REAL signed AppKit staging normal-Quit lifecycle witness, not a kill fixture.
// Never launches an app, touches a user project or issues a command to live V2.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync,spawnSync} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const candidateFolder=path.join(repo,'integrations/clothcraft/output/release-candidates')
const app=path.resolve(process.env.EXO_STAGING_APP_PATH||
  path.join(candidateFolder,'EXO-ClothCraft-V2-Candidate-Watchdog-20261030.app'))
assert.equal(path.dirname(app),candidateFolder,'Refuse app outside private release-candidates folder')
assert.match(path.basename(app),/^EXO-ClothCraft-V2-Candidate-[A-Za-z0-9-]+\.app$/)
assert.ok(!fs.lstatSync(app).isSymbolicLink(),'Refuse symlinked staging app')
const executable=path.join(app,'Contents/MacOS/EXOClothCraft')
const staticHost=path.join(app,'Contents/Resources/integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host')
const session=path.join(app,'Contents/Resources/research/oss/clothcraft/target/debug/exo-session')
const script=path.join(app,'Contents/Resources/integrations/clothcraft/server.mjs')
const node=path.join(process.env.HOME,'Library/Application Support/EXO-ClothCraft-Studio-V2-Staging/Runtime/node')
const bundle='com.mikristian.exo.clothcraft.workspace.v2.candidate'
const production=path.join(process.env.HOME,'Applications/EXO ClothCraft Studio V2.app/Contents/MacOS/EXOClothCraft')

const rows=()=>execFileSync('/bin/ps',['-axo','pid=,ppid=,stat=,command='],{encoding:'utf8',timeout:5000})
  .trim().split('\n').map(line=>{
    const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/)
    return m?{pid:Number(m[1]),ppid:Number(m[2]),stat:m[3],command:m[4]}:null
  }).filter(Boolean)
const listener=port=>{
  const r=spawnSync('/usr/sbin/lsof',['-nP',`-tiTCP:${port}`,'-sTCP:LISTEN'],{encoding:'utf8',timeout:4000})
  assert.ok([0,1].includes(r.status),`Could not probe staging port ${port}`)
  return r.stdout.trim().split(/\s+/).filter(Boolean).map(Number)
}
const running=pid=>rows().some(p=>p.pid===pid&&!p.stat.startsWith('Z'))

assert.ok(fs.existsSync(executable),'Signed candidate missing')
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{timeout:30000})
assert.equal(execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',path.join(app,'Contents/Info.plist')],{encoding:'utf8'}).trim(),bundle)
const before=rows()
const allStagingApps=before.filter(p=>p.command.startsWith(candidateFolder+path.sep)&&
  p.command.endsWith('/Contents/MacOS/EXOClothCraft'))
assert.equal(allStagingApps.length,1,'Refuse Apple Event if multiple staging apps share the candidate bundle ID')
const candidates=before.filter(p=>p.command===executable)
assert.equal(candidates.length,1,'Refuse to target 0 or multiple staged AppKit processes')
const parent=candidates[0]
assert.ok(before.some(p=>p.command===production),'Installed EXO must remain running')
const web=before.find(p=>p.ppid===parent.pid&&p.command.startsWith(staticHost+' --web-root '))
const bridge=before.find(p=>p.ppid===parent.pid&&p.command===node+' '+script)
assert.ok(web&&bridge,'Missing staged signed child services')
const rust=before.find(p=>p.ppid===bridge.pid&&p.command.startsWith(session+' '))
assert.ok(rust,'Missing staged native Rust grandchild')
const watcher=before.find(p=>p.ppid===parent.pid&&p.command.startsWith('/bin/sh '))
assert.ok(watcher,'Missing staging-only watchdog')
assert.deepEqual(listener(5485),[bridge.pid])
assert.deepEqual(listener(5486),[web.pid])

const pids=[parent.pid,web.pid,bridge.pid,rust.pid,watcher.pid]
execFileSync('/usr/bin/osascript',['-e',`tell application id "${bundle}" to quit`],{timeout:10000})
let settled=false
for(let i=0;i<80;i++){
  if(pids.every(p=>!running(p))&&listener(5485).length===0&&listener(5486).length===0){settled=true;break}
  await sleep(200)
}
const productionStill=rows().some(p=>p.command===production)
const report={pass:settled&&productionStill,action:'normal macOS Quit Apple Event',
  stagedParentPid:parent.pid,stagedChildren:pids.slice(1),stagingServicesReaped:settled,
  stagingPortsFreed:listener(5485).length===0&&listener(5486).length===0,
  productionStillRunning:productionStill,
  factoryApproved:false,installedAppTouched:false}
console.log(JSON.stringify(report,null,2))
if(!report.pass)process.exitCode=1

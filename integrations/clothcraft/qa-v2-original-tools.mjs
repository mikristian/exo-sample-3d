// Independent V2 GUI verification. Dedicated local services and throwaway
// garment output: cannot modify either installed application's saved project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-tools-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const reference=path.join(homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016')
for(const f of ['fitting-project.json','fitting-project.json.native'])
 if(existsSync(path.join(reference,f)))copyFileSync(path.join(reference,f),path.join(output,'workspace',f))
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(rust),'Build V2 Rust exo-session binary first')
const processes=[]
function start(binary,args,env={}) {
 const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 processes.push(p)
 return p
}
async function ready(url){
 for(let i=0;i<100;i++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});if(r.ok)return}catch{}
  if(processes.some(p=>p.exitCode!==null))throw Error('V2 test process exited before ready')
  await sleep(250)
 }
 throw Error('Timeout waiting for '+url)
}
const base='http://127.0.0.1:5415',ui='http://127.0.0.1:5416'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:base})
 await Promise.all([ready(base+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const p=await browser.newPage({viewport:{width:1728,height:1040}}),errors=[],actions=[]
 p.on('pageerror',e=>errors.push(e.message))
 p.on('response',r=>{if(r.url().endsWith('/workspace')&&r.request().method()==='POST')actions.push(r.request().postDataJSON())})
 await p.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 const board=p.locator('.cc-board svg'),front=p.locator('.cc-board [data-panel]').first()
 const alignment=await p.evaluate(()=>{
  const svg=document.querySelector('.cc-board svg'),pieces=[...svg.querySelectorAll('[data-panel]')]
  const garment=pieces[0].getBoundingClientRect(),back=pieces[1].getBoundingClientRect()
  const center=new DOMPoint(0,.76).matrixTransform(svg.getScreenCTM()).x
  const body=svg.querySelector('[aria-label="Centered front avatar silhouette"]').getBoundingClientRect()
  return {x:center,frontX:garment.left+garment.width/2,
   bodyX:body.left+body.width/2,bodyHeight:body.height,backRight:back.right,boardRight:svg.getBoundingClientRect().right}
 })
 assert(Math.abs(alignment.x-alignment.frontX)<2,'Front pattern not over center axis')
 assert(Math.abs(alignment.x-alignment.bodyX)<2,'Avatar not over center axis')
 assert(alignment.backRight<=alignment.boardRight+2,'Back pattern clipped')
 assert(alignment.bodyHeight>170,'Silhouette is not a full-height figure')
 await front.click({force:true})
 await p.screenshot({path:path.join(output,'v2-centered-original-exo.png')})
 assert.equal(await p.locator('.clo-mac-menu').count(),1,'Original EXO menu missing')
 assert.equal(await p.locator('.clo-left-3d-double-bars').count(),2,'EXO dual toolbars missing')

 // A real 2D move must not snap back because of the front-axis alignment.
 const b0=await snapshot(),r0=await front.boundingBox()
 const x=r0.x+r0.width*.5,y=r0.y+r0.height*.67
 await p.mouse.move(x,y);await p.mouse.down()
 await p.mouse.move(x+32,y+13,{steps:12});await p.mouse.up();await sleep(700)
 const b1=await snapshot(),r1=await front.boundingBox()
 assert(b1.revision>b0.revision,'2D drag did not reach Rust')
 assert(r1.x>r0.x+10,'2D pattern snapped back to the body axis')

 // The actual Garment Studio 360-degree ring must commit a *Rust* rotation.
 await p.getByRole('button',{name:'Rotate 3D',exact:true}).click()
 const canvas=p.locator('.cc-scene canvas')
 await p.waitForFunction(()=>{
  const el=document.querySelector('.cc-scene canvas')
  return Number(el?.dataset.gizmoRingRadius)>20
 },{timeout:10000})
 const gizmo=await canvas.evaluate(el=>({x:+el.dataset.gizmoCenterX,y:+el.dataset.gizmoCenterY,r:+el.dataset.gizmoRingRadius}))
 const rect=await canvas.boundingBox(),before=await snapshot()
 const gx=rect.x+gizmo.x,gy=rect.y+gizmo.y,r=gizmo.r*1.24
 await p.mouse.move(gx+r,gy);await p.mouse.down()
 await p.mouse.move(gx+r*.72,gy+r*.7,{steps:16});await p.mouse.up();await sleep(700)
 const rotation=actions.filter(a=>a.op==='pose-panel'&&a.rotation_delta_degrees?.some(n=>Math.abs(n)>.1)).at(-1)
 assert(rotation,'360-degree wheel did not rotate ClothCraft via Rust')
 const after=await snapshot()
 assert(after.revision>before.revision)
 for(const panel of before.panels.filter(panel=>panel.id!==rotation.panel))
  assert.deepEqual(after.positions.slice(...panel.vertices),before.positions.slice(...panel.vertices),
    'Rotation changed an unselected simulated panel')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,centerAxisDeltaPx:alignment.x-alignment.frontX,
  silhouetteAxisDeltaPx:alignment.x-alignment.bodyX,boardDragMovedPx:r1.x-r0.x,
  rotatedPanel:rotation.panel,otherPanelsUnchanged:true,qaOutput:output,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}

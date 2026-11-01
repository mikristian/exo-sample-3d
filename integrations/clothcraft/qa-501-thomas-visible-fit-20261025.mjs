// 501-inspired jeans assembly experiment on the local Thomas collision mesh.
// Uses the active Vite 5174 UI and a dedicated isolated native Rust service;
// saves a separate jeans-fitting project and keeps the visible browser open.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const evidence=path.join(root,'docs/goals/evidence/501-reconstruction-20261025')
const original=path.join(evidence,'501-inspired-W32-L32-exo-project.json')
const dest=path.join(evidence,'501-Thomas-3D-fitting-experiment.json')
const baseline=JSON.parse(readFileSync(original,'utf8'))
const temp=mkdtempSync(path.join(tmpdir(),'exo-501-thomas-native-'))
const thomas='/Users/mikylecouto/Applications/EXO ClothCraft Studio V2.app/Contents/Resources/collision-avatars/thomas-body.obj'
const ui='http://127.0.0.1:5174',port=5565,native=`http://127.0.0.1:${port}`
const log={started:new Date().toISOString(),stages:[],sewing:[],steps:[],errors:[],source:original,
  notes:['Independent Levi 501-inspired construction; not factory jeans pattern.',
    'Each native seam is real; sewing direction and unequal cutline length must be verified.']}
mkdirSync(path.join(temp,'workspace'),{recursive:true})
const record=(stage,data={})=>{const item={stage,at:new Date().toISOString(),...data};log.stages.push(item);console.log('THOMAS:',JSON.stringify(item));return item}
let server,browser,page
const call=async data=>{
 const r=await fetch(native+'/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(120000)})
 const j=await r.json();if(!j.ok)throw Error(`${data.op||''} ${data.command?.kind||''}: ${j.error||'native refusal'}`)
 return j.data
}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(1300)})).ok)return}catch{}await sleep(200)}throw Error('Could not start private jeans fit service')}
const ref=(panel,index)=>({panel:baseline.template.panels[panel].id,side:'top',edge:`edge_${index+1}`,range:[0,1]})
// Real cutline correspondences. The 501 reconstruction still needs trueing;
// partial alignment and easing are explicit, never mistaken for exact joins.
const pairs=[
  ['Front left outseam lower',ref(0,9),ref(2,9)],
  ['Front right outseam lower',ref(1,9),ref(3,9)],
  ['Front left inner leg lower',ref(0,7),ref(2,7)],
  ['Front right inner leg lower',ref(1,7),ref(3,7)],
  ['Back left yoke lower',ref(2,0),ref(4,0)],
  ['Back right yoke lower',ref(3,0),ref(5,0)],
]
// Sewing policy: request unequal-length easing explicitly only during this
// research fitting experiment. Production patterns must first be trued.
const sewingPairs=pairs.map(([name,a,b])=>({name,a,b,reverse:true,ease:true}))
// Staging height is based on avatar's 1.79 m stature. 2D material +Y goes
// downward, so local y = -v; panel tops should sit approximately at 1.04 m.
// Front faces at positive Z, back faces at negative Z; left/right X sign.
const staged={
  0:{translation:[-.18,1.05,.215],rotation_degrees:[0,0,0]},
  1:{translation:[.03,1.05,.215],rotation_degrees:[0,0,0]},
  2:{translation:[-.165,1.15,-.23],rotation_degrees:[0,180,0]},
  3:{translation:[.047,1.15,-.23],rotation_degrees:[0,180,0]},
  4:{translation:[-.17,1.23,-.23],rotation_degrees:[0,180,0]},
  5:{translation:[.06,1.23,-.23],rotation_degrees:[0,180,0]},
  6:{translation:[-.16,1.09,-.252],rotation_degrees:[0,180,0]},
  7:{translation:[.05,1.09,-.252],rotation_degrees:[0,180,0]},
  8:{translation:[-.17,1.05,.235],rotation_degrees:[0,0,0]},
  9:{translation:[.045,1.05,.235],rotation_degrees:[0,0,0]},
  10:{translation:[-.16,1.08,.25],rotation_degrees:[0,0,0]},
  11:{translation:[.05,1.08,.25],rotation_degrees:[0,0,0]},
  12:{translation:[.018,1.065,.245],rotation_degrees:[0,0,0]},
  13:{translation:[-.19,1.09,.25],rotation_degrees:[0,0,0]},
  14:{translation:[-.19,1.14,-.25],rotation_degrees:[0,180,0]},
  15:{translation:[-.028,1.065,.246],rotation_degrees:[0,0,0]},
  16:{translation:[.020,1.065,.246],rotation_degrees:[0,0,0]},
}
for(let index=17;index<24;index++)staged[index]={translation:[-.19+(index-17)*.055,1.18,.245],rotation_degrees:[0,0,0]}
// Collision-safe first assembly: legs/yokes are arranged around Thomas while
// accessory cutting pieces remain staged on separate nearby racks. Bringing
// all auxiliary layers flush to the avatar caused OGC initial intersections.
for(let index=0;index<6;index++)staged[index].translation[2]+=index*.015
for(let index=6;index<24;index++)staged[index]={translation:[-1.0+((index-6)%6)*.37,
  1.62+Math.floor((index-6)/6)*.22,.6+(index-6)*.04],rotation_degrees:[0,0,0]}

try{
 const probe=await fetch(native+'/health',{signal:AbortSignal.timeout(400)}).catch(()=>null)
 if(probe?.ok)throw Error('Fitting port already used: 5565')
 server=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{
   ...process.env,EXO_CLOTHCRAFT_PORT:String(port),EXO_CLOTHCRAFT_OUTPUT_DIR:temp,
   EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
   EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
   EXO_CLOTHCRAFT_AVATAR_THOMAS_OBJ:thomas,EXO_CLOTHCRAFT_GPU:'0'}})
 server.stdout.on('data',()=>{});server.stderr.on('data',x=>process.stderr.write(String(x).slice(0,1000)))
 await ready(native+'/health')
 let snap=await call({op:'open',project:baseline})
 assert.equal(snap.template.panels.length,24)
 const th=await call({op:'select-avatar',model:'clo-thomas'})
 assert.equal(th.avatarModel,'clo-thomas')
 record('Thomas loaded',{avatarModel:th.avatarModel,panels:th.template.panels.length,
  avatarVertices:th.avatar?.positions?.length})

 // Reuse the one browser from the drawing pass if available; this fit is
 // a new dedicated visible Chrome window with the 3D and 2D split layout.
 browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:[
   '--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal','--window-position=85,60']})
 page=await browser.newPage({viewport:{width:1720,height:1080}})
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);log.errors.push(e.message)})
 await page.route('**/workspace',async route=>{
  const headers={...route.request().headers()};delete headers.origin
  const response=await route.fetch({url:native+'/workspace',headers})
  await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
 })
 await page.goto(ui+'/?desktop=1&engine=clothcraft&testSession=501-Thomas-3d-visible',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-scene canvas').first().waitFor({timeout:60000})
 await page.getByRole('combobox',{name:'3D and 2D window arrangement'}).selectOption('split')
 await page.waitForFunction(()=>Number(document.querySelector('.cc-scene canvas')?.dataset.native3dPanelMeshCount)===24,null,{timeout:30000})
 await page.getByTitle('Front camera: looking along Z',{exact:true}).first().click()
 record('visible Rust 3D', {panelMeshes:await page.locator('.cc-scene canvas').first().evaluate(el=>el.dataset.native3dPanelMeshCount),
  viewport:await page.locator('.cc-viewport-3d').first().boundingBox()})
 await page.screenshot({path:path.join(evidence,'501-Thomas-3d-before-arrangement.png'),animations:'disabled'})

 // Source-preserving native Place edits; Rust recompiles the actual 3D mesh.
 for(let index=0;index<baseline.template.panels.length;index++){
   const before=await call({op:'snapshot'}),panel=before.template.panels[index]
   const placed=await call({op:'edit',revision:before.revision,command:{kind:'Place',panel:panel.id,
      placement:staged[index]}})
   record('3D placement',{panel:panel.name,index,translation:staged[index].translation,revision:placed.revision})
   await sleep(index<6?110:15)
 }
 await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.native3dPanelMeshCount==='24')
 await page.screenshot({path:path.join(evidence,'501-Thomas-3d-arranged.png'),animations:'disabled'})

 // Real native Sew edits, one at a time, verifying successful compiler output.
 for(const pair of sewingPairs){
   const before=await call({op:'snapshot'})
   try{
    const sewed=await call({op:'edit',revision:before.revision,command:{kind:'Sew',a:pair.a,b:pair.b,
      reverse:pair.reverse,ease:pair.ease}})
    const evidence={name:pair.name,seamId:sewed.template.seams.at(-1)?.id,ok:true,
      first:pair.a.second,second:pair.b.edge,revision:sewed.revision}
    log.sewing.push(evidence);record('native sewn edges',evidence)
   }catch(error){const evidence={name:pair.name,ok:false,error:String(error.message)};log.sewing.push(evidence);record('sewing rejected',evidence)}
 }
 let after=await call({op:'snapshot'})
 record('compiled sewn garment',{panels:after.template.panels.length,seams:after.template.seams.length,
  gapMm:after.seams?.map(x=>({id:x.id,maxMm:x.max_gap_m!=null?x.max_gap_m*1000:null}))})
 await page.screenshot({path:path.join(evidence,'501-Thomas-3d-sewn-initial.png'),animations:'disabled'})

 // A few isolated CPU solver frames first. Never claim a fitted garment on
 // force-only source sewing success or proceed through a failing contact.
 for(let i=0;i<4;i++){
   const before=await call({op:'snapshot'})
   try{
     after=await call({op:'step',steps:i===0?1:3,revision:before.revision})
     const datum={step:i,ok:true,time:after.time,revision:after.revision,
       contacts:after.metrics?.contacts,maximumSeamGapMm:(after.metrics?.max_seam_gap_m??NaN)*1000,
       stretchP95:after.metrics?.extension_p95_percent}
     log.steps.push(datum);record('native simulated',datum)
   }catch(error){const datum={step:i,ok:false,error:error.message};log.steps.push(datum);record('simulation rejected',datum);break}
   await sleep(300)
 }
 const saved=await call({op:'save'})
 assert.equal(saved.project.template.panels.length,24)
 assert(saved.project.avatar_path.includes('thomas-body.obj'))
 writeFileSync(dest,JSON.stringify(saved.project,null,2)+'\n')
 await page.waitForTimeout(1100)
 await page.screenshot({path:path.join(evidence,'501-Thomas-3d-simulation-result.png'),animations:'disabled'})
 const reopened=await call({op:'open',project:saved.project})
 record('saved and reopened',{panels:reopened.template.panels.length,seams:reopened.template.seams.length,
   avatar:reopened.avatarModel,time:reopened.time,errors})
 writeFileSync(path.join(evidence,'501-Thomas-fitting-results.json'),JSON.stringify(log,null,2)+'\n')
 console.log('FINAL 501 THOMAS FIT',JSON.stringify({saved:dest,panels:reopened.template.panels.length,
   seams:reopened.template.seams.length,steps:log.steps,errors},null,2))
 await new Promise(resolve=>{process.on('SIGINT',resolve);browser.on('disconnected',resolve)})
}catch(error){record('blocked',{error:error.stack||String(error)});process.exitCode=1}
finally{writeFileSync(path.join(evidence,'501-Thomas-fitting-results.json'),JSON.stringify(log,null,2)+'\n');
  await browser?.close().catch(()=>{});server?.kill('SIGTERM');console.log('Thomas fitting experiment ended')}

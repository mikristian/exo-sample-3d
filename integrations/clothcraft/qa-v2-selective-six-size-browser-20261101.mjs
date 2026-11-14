// Executable Rust acceptance: physical persistent six-size facing dependency.
// All inputs and saved projects live in a disposable temporary workspace.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'
import {createServer} from 'node:net'
const freePort=()=>new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
const nativePort=await freePort(),uiPort=await freePort()

const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-persistent-facing-'))
const native=`http://127.0.0.1:${nativePort}`,ui=`http://127.0.0.1:${uiPort}`
const children=[],pageErrors=[],requests=[]
const launch=(file,args,env={})=>{
  const child=spawn(file,args,{cwd:process.cwd(),detached:true,stdio:'ignore',env:{...process.env,...env}})
  children.push(child)
}
const ready=async url=>{for(let i=0;i<120;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  await sleep(300)
}throw Error('Service not ready '+url)}
const authHeaders=()=>({'content-type':'application/json',authorization:'Bearer '+fs.readFileSync(path.join(root,'workspace-auth-token'),'utf8').trim()})
const content=project=>({...project,native_commit:project.native_commit?{...project.native_commit,generation:0}:undefined})
const workspace={request:async packet=>{
  const reply=await fetch(native+'/workspace',{method:'POST',headers:authHeaders(),
    body:JSON.stringify(packet),signal:AbortSignal.timeout(60000)})
  return reply.json()
},close:()=>{for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}}}
launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:String(nativePort),EXO_CLOTHCRAFT_OUTPUT_DIR:root,EXO_CLOTHCRAFT_GPU:'0',
  EXO_CLOTHCRAFT_REPO:path.join(process.cwd(),'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(process.cwd(),'research/oss/clothcraft/target/debug/exo-session')})
let browser,page

const clone=structuredClone
const sizes=['XS','S','M','L','XL','XXL']
const offsets=[-.015,-.007,0,.005,.010,.014]
let state,stage='open',beforeRevision
const checks=[]
const send=async req=>{
  const result=await workspace.request({revision:state?.revision,...req})
  assert.equal(result.ok,true, `${req.op}: ${result.error??'native Rust refused'}`)
  if(result.data?.template)state=result.data
  return result.data
}
const panel=(template,id)=>{
  const found=template.panels.filter(p=>p.id===id)
  assert.equal(found.length,1,`Expected unique panel ${id}`)
  return found[0]
}
const refuse=async (req,label)=>{
  const saved=(await send({op:'save'})).project
  const revision=state.revision
  const result=await workspace.request({revision,...req})
  assert.equal(result.ok,false,`${label}: native Rust incorrectly accepted invalid mutation`)
  await send({op:'snapshot'})
  assert.equal(state.revision,revision)
  assert.deepEqual(content((await send({op:'save'})).project),content(saved))
  return result.error
}
const checkPhysical=async (expectedWidth)=>{
  const saved=(await send({op:'save'})).project
  assert(saved.native_facing_dependency)
  const f=saved.native_facing_dependency
  assert.equal(f.facingId,'facing_persisted_v1')
  assert.deepEqual(saved.grade_run.sizes,sizes)
  const cuts=await send({op:'grade-run-cutlines'})
  const sewing=await send({op:'grade-run-sewing-balance-audit'})
  assert.equal(cuts.cuttingAuthorized,false)
  assert.equal(sewing.factoryApproved,false)
  let notches=0
  for(let i=0;i<6;i++){
    const t=saved.grade_run.gradedTemplates[i]
    const parent=panel(t,f.parentPanelId).polygon
    const facing=panel(t,f.facingId).polygon
    assert(Math.abs(parent.points[1][0]-(expectedWidth+offsets[i]))<1e-7)
    assert(Math.abs(parent.points[2][0]-(expectedWidth+offsets[i]))<1e-7)
    assert(Math.abs(facing.points[1][0]-(expectedWidth+offsets[i]))<1e-7)
    assert(Math.abs(facing.points[2][0]-(expectedWidth+offsets[i]))<1e-7)
    const sizeCut=cuts.sizes[i]
    const childCut=sizeCut.panels.find(p=>p.panel_id===f.facingId)?.cut
    const parentCut=sizeCut.panels.find(p=>p.panel_id===f.parentPanelId)?.cut
    assert(childCut&&parentCut)
    assert.equal(childCut.notches.length,2)
    assert.equal(parentCut.notches.length,2)
    assert(childCut.edges.every(e=>Math.abs(e.allowance_m-.01)<1e-9))
    const seam=sewing.sizes[i].seams.find(s=>s.seamId===`${f.facingId}_attach`)
    assert(seam)
    assert.equal(seam.allowEase,false)
    assert.equal(seam.requiresEaseReview,false)
    assert(Math.abs(seam.mismatchM)<1e-7)
    assert.equal(seam.notchIntervalLengthsM.length,3)
    notches+=childCut.notches.length
  }
  assert.equal(notches,12)
  return saved
}

try{
  await ready(native+'/health')
  await send({op:'open',preset:'tshirt'})
  for(const seam of [...state.template.seams])
    await send({op:'edit',command:{kind:'RemoveSeam',seam:seam.id}})
  const originalIds=new Set(state.template.panels.map(p=>p.id))
  for(let i=0;i<2;i++) await send({op:'edit',command:{kind:'Polygon',fabric:state.template.fabrics[0].id,
    points:[[0,0],[.4,0],[.4,.32],[0,.32]]}})
  const ids=state.template.panels.filter(p=>!originalIds.has(p.id)).map(p=>p.id)
  assert.equal(ids.length,2)
  stage='author 10mm allowances, source bindings and 6 physical grades'
  for(const p of [...state.template.panels])for(const edge of p.polygon.edges)
    await send({op:'edit',command:{kind:'SeamAllowance',panel:p.id,edge,width_m:.01}})
  const rules=[]
  ids.forEach((panelId,index)=>{
    rules.push({id:`width_upper_${index}`,panelId,pointIndex:1,mode:'polar',
      a:0,b:0,angleDeg:0,distanceFormula:index===0?'width':'otherWidth',dependsOn:[]})
    rules.push({id:`width_lower_${index}`,panelId,pointIndex:2,mode:'polar',
      a:3,b:3,angleDeg:0,distanceFormula:index===0?'width':'otherWidth',dependsOn:[]})
  })
  await send({op:'bindings-store',nativeBindings:{
    measurements:{width:{valueMm:400},otherWidth:{valueMm:400}},bindings:rules}})
  const base=clone(state.template)
  await send({op:'grade-run-commit',gradeRun:{
    schemaVersion:1,sizes,baseSize:'M',baseTemplate:clone(base),
    gradedTemplates:sizes.map((size,i)=>{
      const t=clone(base)
      for(const id of ids)for(const point of [1,2])
        panel(t,id).polygon.points[point][0]+=offsets[i]
      return t
    }),pomSpecs:[]}})
  checks.push('Two authored 400×320mm rectangles, 10mm edge allowances, four physical bound anchors and XS–XXL grades')

  stage='native install transaction'
  const parentId=ids[0],parentEdgeId=panel(state.template,parentId).polygon.edges[0]
  const invalid=await refuse({op:'facing-dependency-install',parentPanelId:parentId,
    parentEdgeId,facingId:'bad_face',depthMm:1000,allowanceMm:10},'out-of-bounds facing depth')
  const beforeInstall=(await send({op:'save'})).project
  const preRevision=state.revision
  await send({op:'facing-dependency-install',parentPanelId:parentId,parentEdgeId,
    facingId:'facing_persisted_v1',depthMm:40,allowanceMm:10})
  assert.equal(state.revision,preRevision+1)
  assert.equal(state.nativeFacingDependency.facingId,'facing_persisted_v1')
  assert.equal(state.nativePointBindings.active,true)
  const installed=await checkPhysical(.4)
  const inspection=await send({op:'facing-dependency-inspect'})
  assert.equal(inspection.nativeFacingDependency.facingId,'facing_persisted_v1')
  stage='real browser UI staged qualified 400→380mm regeneration'
  beforeRevision=state.revision
  launch(path.join(process.cwd(),'node_modules/.bin/vite'),['--host','127.0.0.1','--port',String(uiPort),'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
  await ready(ui)
  browser=await chromium.launch({headless:true,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--disable-gpu','--no-first-run']})
  page=await browser.newPage({viewport:{width:1650,height:1020}})
  page.setDefaultTimeout(14000)
  page.on('pageerror',error=>pageErrors.push(error.message))
  page.on('request',request=>{if(request.url().endsWith('/workspace')){
    try{requests.push(request.postDataJSON())}catch{}
  }})
  await page.route('**/workspace',async route=>{
    const headers={...route.request().headers(),...authHeaders()};delete headers.origin
    const response=await route.fetch({url:native+'/workspace',headers})
    await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
  })
  await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  await page.locator('.cc-board').first().waitFor({timeout:18000})
  await page.getByRole('combobox',{name:'CLO-style workspace layout presets'}).selectOption('gradingStudio')
  await page.locator('.cc-embedded-2d').waitFor({state:'attached',timeout:14000})
  const studio=page.getByRole('button',{name:'Open full-screen 2D pattern studio'})
  if(await studio.count())await studio.click()
  else{
    const layout=page.getByRole('combobox',{name:'Viewport layout'})
    if(await layout.count())await layout.selectOption('2d')
  }
  await page.waitForTimeout(650)
  const nativeButton=page.getByRole('button',{name:'Grading Rules',exact:true}).first()
  if(await nativeButton.count())await nativeButton.click()
  else await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-pattern-studio-command',
    {detail:{command:'grade-manual'}})))
  const modal=page.locator('[data-native-grade-pattern="true"]')
  try{await modal.waitFor({state:'visible'})}catch(error){
    const diagnostics=await page.evaluate(()=>({
      url:location.href,gradeRules:[...document.querySelectorAll('button')].filter(b=>/Grading Rules|grading/i.test(b.innerText)).slice(0,8).map(b=>b.innerText),
      embedded:document.querySelectorAll('[data-native-clothcraft]').length,
      root:document.querySelector('.cc-embedded-root')?.className,
      excerpt:document.body.innerText.slice(0,1100)
    }))
    throw Error(error.message+'; UI_DIAGNOSTIC='+JSON.stringify(diagnostics))
  }
  // The independently floating quick toolbar can physically cover the
  // measurement worksheet in a compact screen. Close it through its real
  // user-facing control before interacting with the deeper worksheet.
  const quickToolbar=page.locator('[data-clo-floating-widget="grading-quick-toolbar"]')
  if(await quickToolbar.count())await quickToolbar.getByRole('button',{name:'Close Grading Toolbar'}).click()
  assert.match(await modal.innerText(),/5 pieces/,'The live browser must see five real sewn panels')
  await modal.getByRole('tab',{name:'Measurements'}).click()
  const regen=modal.locator('[data-native-six-size-regeneration="true"]')
  await regen.waitFor({state:'visible'})
  assert.match(await regen.innerText(),/4 rule/, 'Native persisted 4-point binding graph not shown in editor')
  await regen.getByRole('combobox',{name:'Six-size direct measurement'}).selectOption('width')
  await regen.getByRole('textbox',{name:'Six-size new measurement mm'}).fill('380')
  await regen.getByRole('button',{name:'Stage measurement change'}).click()
  console.log('Staged single-source measurement through actual app UI')
  assert.match(await regen.innerText(),/width: 400.*380/s)
  assert.deepEqual(content((await send({op:'save'})).project),content(installed),
    'Staging browser measurement changed Rust before confirmed commit')
  await regen.getByRole('button',{name:'Preview XS–XXL regeneration'}).click()
  await regen.getByRole('table',{name:'Per-size native geometry changes'}).waitFor({state:'visible',timeout:30000})
  assert.equal(await regen.getByRole('table',{name:'Per-size native geometry changes'}).locator('tbody tr').count(),6)
  assert.deepEqual(content((await send({op:'save'})).project),content(installed),
    'Preview browser measurement changed Rust before confirmed commit')
  console.log('Verified selective six-size browser preview')
  await regen.getByRole('checkbox',{name:/I reviewed all six size changes/}).check()
  await regen.getByRole('button',{name:'Commit confirmed six-size regeneration'}).click()
  await regen.getByText(/Native regeneration committed at revision/).waitFor({state:'visible',timeout:30000})
  await send({op:'snapshot'})
  assert.equal(state.revision,beforeRevision+1)
  assert(requests.some(req=>req.op==='bindings-grade-regenerate-preview'))
  assert(requests.some(req=>req.op==='bindings-grade-regenerate'))
  assert.deepEqual(pageErrors,[])

  assert.equal(state.nativePointBindings.active,true)
  const after=await checkPhysical(.38)
  const otherId=ids[1]
  assert.deepEqual(panel(after.template,otherId),panel(installed.template,otherId))
  for(let i=0;i<6;i++)assert.deepEqual(panel(after.grade_run.gradedTemplates[i],otherId),panel(installed.grade_run.gradedTemplates[i],otherId))
  assert.equal(state.regenerationEvidence?.changedPanels??1,1)
  await page.screenshot({path:'docs/qa/selective-regeneration-20261101/browser.png',fullPage:true})
  await send({op:'undo'})
  const undone=(await send({op:'save'})).project
  for(const key of ['template','grade_run','native_point_bindings','native_facing_dependency'])assert.deepEqual(undone[key],installed[key])
  await send({op:'redo'})
  const redone=(await send({op:'save'})).project
  for(const key of ['template','grade_run','native_point_bindings','native_facing_dependency'])assert.deepEqual(redone[key],after[key])
  await checkPhysical(.38)
  console.log(JSON.stringify({passed:true,nativeRust:true,disposable:true,selectiveSource:true,
    derivedFacingId:'facing_persisted_v1',sizes,physicalFacingNotches:12,
    browserQualifiedRegeneration:true,unaffectedSixSizePieceExact:true,
    undoRedoSavedGraph:true,browserErrors:pageErrors,beforeRevision,afterRevision:beforeRevision+1,
    factoryApproved:false,licensedModarisParity:false},null,2))
}catch(error){
  console.error(JSON.stringify({passed:false,stage,reason:error?.message??String(error),
    checks,factoryApproved:false},null,2))
  process.exitCode=1
}finally{
  workspace.close()
  await Promise.race([(browser?.close()??Promise.resolve()).catch(()=>{}),sleep(7000)])
  fs.rmSync(root,{recursive:true,force:true})
  process.exit(process.exitCode||0)
}

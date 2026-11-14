import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const dir=dirname(fileURLToPath(import.meta.url))
const screenshots=join(dir,'qa')
mkdirSync(screenshots,{recursive:true})
const url=process.env.CLOTHCRAFT_CHARACTERS_URL||'http://127.0.0.1:5288/'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']})
const errors=[]
const result={url,characters:0,colorways:0,threeDimensional:false,threeFrames:false,orbitDrag:false,eyeTracking:false,blink:false,actions:[],audioDemo:false,audioReactivePose:false,audioStop:false,microphone:false,filePlayback:false,persistence:false,mobileWidth:null,errors,screenshots}
try {
  const desktop=await browser.newPage({viewport:{width:1480,height:1000},deviceScaleFactor:1})
  desktop.on('pageerror',err=>errors.push(`desktop: ${err.message}`))
  await desktop.goto(url,{waitUntil:'networkidle'})
  assert.match(await desktop.title(),/Character Atelier/)
  result.characters=await desktop.locator('.character-card').count()
  result.colorways=await desktop.locator('.color-swatch').count()
  assert.equal(result.characters,4)
  assert.equal(result.colorways,6)
  assert.equal(await desktop.locator('.showcase-mascot-wrap canvas.cc-alien-canvas').count(),1,'Main character requires a real WebGL canvas')
  assert.equal(await desktop.locator('.showcase-mascot-wrap [data-design="alien-3d"]').count(),1,'Expected original 3D alien character')
  assert.equal(await desktop.locator('#character-accessory').count(),0,'Accessory controls should not be available')
  for(const name of ['Stitch','Patch','Bobbin','Forma']){
    await desktop.locator('.character-card').filter({hasText:name}).click()
    const face=desktop.locator('.showcase-mascot-wrap .cc-alien-3d')
    await desktop.waitForFunction(()=>Number(document.querySelector('.showcase-mascot-wrap [data-render-frames]')?.dataset.renderFrames||0)>=1)
    assert.equal(await face.getAttribute('data-renderer'),'three-webgl',`${name} should render using the real 3D engine`)
    assert.equal(await face.getAttribute('data-3d'),'true')
    assert.equal(await face.locator('canvas').count(),1)
  }
  await desktop.locator('.character-card').filter({hasText:'Stitch'}).click()
  await desktop.getByRole('button',{name:'Dust coral',exact:true}).click()
  assert.equal(await desktop.getByRole('button',{name:'Dust coral',exact:true}).getAttribute('aria-pressed'),'true')
  assert.equal(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-renderer'),'three-webgl')
  await desktop.getByRole('button',{name:'Lunar silver',exact:true}).click()
  result.threeDimensional=true
  await desktop.waitForFunction(()=>Number(document.querySelector('.showcase-mascot-wrap [data-render-frames]')?.dataset.renderFrames||0)>=3)
  result.threeFrames=true
  await desktop.screenshot({path:join(screenshots,'character-atelier-desktop.png'),fullPage:true})

  const stage=desktop.locator('.showcase-stage')
  const rect=await stage.boundingBox()
  await desktop.mouse.move(rect.x+rect.width*.25,rect.y+rect.height*.42)
  await desktop.waitForTimeout(350)
  const leftEye=Number(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-rotation-y'))
  await desktop.mouse.move(rect.x+rect.width*.77,rect.y+rect.height*.42)
  await desktop.waitForTimeout(350)
  const rightEye=Number(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-rotation-y'))
  assert(Math.abs(leftEye-rightEye)>.03,`3D face did not track cursor: ${leftEye}, ${rightEye}`)
  result.eyeTracking=true
  const canvas=desktop.locator('.showcase-mascot-wrap .cc-alien-canvas')
  const box=await canvas.boundingBox()
  await desktop.mouse.move(box.x+box.width*.52,box.y+box.height*.45)
  await desktop.mouse.down()
  await desktop.mouse.move(box.x+box.width*.82,box.y+box.height*.38,{steps:8})
  await desktop.mouse.up()
  await desktop.waitForTimeout(500)
  const rotated=Number(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-rotation-y'))
  assert(Math.abs(rotated)>.3,`Dragging did not rotate 3D head: ${rotated}`)
  await canvas.dblclick()
  await desktop.waitForTimeout(550)
  const resetYaw=Number(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-rotation-y'))
  assert(Math.abs(resetYaw)<Math.abs(rotated),`Double-click did not return toward front: ${resetYaw}`)
  result.orbitDrag=true
  await desktop.getByRole('button',{name:'Toggle eye close-up'}).click()
  assert.equal(await desktop.locator('.showcase-stage.is-eye-focus').count(),1,'Eye close-up mode did not activate')
  await desktop.waitForTimeout(850)
  await desktop.screenshot({path:join(screenshots,'character-atelier-eye-closeup.png')})
  await desktop.getByRole('button',{name:'Toggle eye close-up'}).click()
  assert.equal(await desktop.locator('.showcase-stage.is-eye-focus').count(),0,'Full form mode not restored')

  await desktop.getByRole('button',{name:'Blink animation'}).click()
  await desktop.waitForTimeout(80)
  assert.equal(await desktop.locator('.showcase-mascot-wrap [data-mood="blinking"]').count(),1)
  result.blink=true
  for(const action of ['Wave','Jump','Talk','Dance']) {
    await desktop.getByRole('button',{name:`${action} animation`}).click()
    await desktop.waitForTimeout(90)
    assert.equal(await desktop.locator('.showcase-mascot-wrap [data-mood="'+({Wave:'waving',Jump:'bouncing',Talk:'speaking',Dance:'dancing'}[action])+'"]').count(),1)
    result.actions.push(action)
  }
  await desktop.getByRole('button',{name:'Hear voice demo'}).click()
  await desktop.locator('.blob-audio-indicator.on').waitFor()
  await desktop.waitForTimeout(350)
  assert.equal(await desktop.locator('.showcase-mascot-wrap [data-mood="speaking"]').count(),1)
  await desktop.waitForFunction(()=>Number(document.querySelector('.showcase-mascot-wrap .cc-alien-3d')?.dataset.audioLevel||0)>.06,null,{timeout:4000})
  const reactiveScale=Number(await desktop.locator('.showcase-mascot-wrap .cc-alien-3d').getAttribute('data-pulse-scale'))
  assert(reactiveScale>1.01,`3D pose should respond to audible sound: ${reactiveScale}`)
  result.audioReactivePose=true
  const sampled=await desktop.evaluate(async()=>{
    const values=[]
    for(let i=0;i<12;i++){values.push(Number(document.querySelector('.showcase-mascot-wrap .cc-alien-3d')?.dataset.audioLevel||0));await new Promise(done=>setTimeout(done,90))}
    return values
  })
  assert(sampled.some(value=>value>.08),`Analyser did not react to generated sound: ${sampled}`)
  result.audioDemo=true
  await desktop.screenshot({path:join(screenshots,'character-atelier-speaking.png')})
  await desktop.getByRole('button',{name:'Stop demo'}).click()
  await desktop.locator('.blob-audio-indicator:not(.on)').waitFor()
  result.audioStop=true

  // A real local WAV plays through the same analyser (no upload or external API).
  const wav=await desktop.evaluate(()=>{
    const rate=22050,seconds=1.25,samples=Math.round(rate*seconds)
    const data=new ArrayBuffer(44+samples*2),view=new DataView(data)
    const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
    str(0,'RIFF');view.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ')
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true)
    view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true)
    str(36,'data');view.setUint32(40,samples*2,true)
    for(let i=0;i<samples;i++){const env=.75+.20*Math.cos(i*.002);view.setInt16(44+i*2,Math.round(16000*env*Math.sin(2*Math.PI*260*i/rate)),true)}
    return Array.from(new Uint8Array(data))
  })
  await desktop.locator('input[type="file"][accept="audio/*"]').setInputFiles({name:'qa-local-tone.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)})
  await desktop.locator('.blob-audio-indicator.on').waitFor()
  const fileEnergy=await desktop.evaluate(async()=>{await new Promise(done=>setTimeout(done,220));return Number(document.querySelector('.showcase-mascot-wrap .cc-alien-3d')?.dataset.audioLevel||0)})
  assert(fileEnergy>.02,`Local WAV signal not detected: ${fileEnergy}`)
  result.filePlayback=true
  await desktop.getByRole('button',{name:'Stop file'}).click()
  await desktop.evaluate(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia=async constraints=>{
      const stream=await original(constraints)
      window.__qaMicrophoneTracks=stream.getAudioTracks()
      return stream
    }
  })
  await desktop.getByRole('button',{name:'Use microphone'}).click()
  await desktop.locator('.blob-audio-indicator.on').waitFor()
  await desktop.waitForTimeout(400)
  assert.equal(await desktop.locator('.blob-audio-indicator').innerText(),'MICROPHONE')
  const micTracks=await desktop.evaluate(()=>window.__qaMicrophoneTracks?.map(track=>({kind:track.kind,readyState:track.readyState})))
  assert(micTracks?.length>0&&micTracks.every(track=>track.kind==='audio'&&track.readyState==='live'),`Fake microphone stream unavailable: ${JSON.stringify(micTracks)}`)
  result.microphone=true
  await desktop.getByRole('button',{name:'Stop microphone'}).click()
  await desktop.locator('.blob-audio-indicator:not(.on)').waitFor()
  assert((await desktop.evaluate(()=>window.__qaMicrophoneTracks?.every(track=>track.readyState==='ended'))),'Microphone tracks must stop immediately')
  await desktop.getByRole('button',{name:'Patch',exact:false}).first().click()
  assert.match(await desktop.locator('.showcase-bottom h2').innerText(),/Patch/)
  await desktop.getByRole('button',{name:'Astral lilac',exact:true}).click()
  await desktop.locator('#character-nickname').fill('Little Maker')
  await desktop.locator('#character-eyes').selectOption('focused')
  await desktop.getByRole('button',{name:'Subtle'}).click()
  await desktop.getByRole('button',{name:'Midnight',exact:true}).click()
  await desktop.getByRole('button',{name:'Surprised'}).click()
  await desktop.screenshot({path:join(screenshots,'character-atelier-customized.png'),fullPage:true})
  await desktop.reload({waitUntil:'networkidle'})
  assert.match(await desktop.locator('.showcase-bottom h2').innerText(),/Little Maker/)
  assert.equal(await desktop.locator('.showcase-mascot-wrap [data-character="patch"]').count(),1)
  assert.equal(await desktop.locator('#character-eyes').inputValue(),'focused')
  assert.equal(await desktop.getByRole('button',{name:'Midnight',exact:true}).getAttribute('aria-pressed'),'true')
  assert.equal(await desktop.getByRole('button',{name:'Subtle'}).getAttribute('aria-pressed'),'true')
  result.persistence=true

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true})
  mobile.on('pageerror',err=>errors.push(`mobile: ${err.message}`))
  await mobile.goto(url,{waitUntil:'networkidle'})
  await mobile.screenshot({path:join(screenshots,'character-atelier-mobile.png'),fullPage:true})
  const metrics=await mobile.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,viewport:visualViewport?.width||window.innerWidth}))
  assert(metrics.scrollWidth<=metrics.clientWidth+2,`Mobile horizontal scroll: ${JSON.stringify(metrics)}`)
  result.mobileWidth=metrics
  assert.equal(errors.length,0,`Browser runtime errors: ${errors.join(' | ')}`)
  writeFileSync(join(screenshots,'qa-results.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify({ok:true,...result},null,2))
} finally {await browser.close()}

import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.EXO_COMPANION_URL || 'http://127.0.0.1:5174/'
const dir=path.resolve('qa/exo-companion-modes-20261102')
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']})
const result={url,checks:{},errors:[],messages:[]}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 page.on('pageerror',error=>result.errors.push(error.message))
 page.on('console',msg=>{if(msg.type()==='error')result.messages.push(msg.text().slice(0,200))})
 await page.addInitScript(()=>{
  window.__exoTtsSpoken=[]
  class Utterance {
   constructor(text){this.text=text}
  }
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance})
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
   speak(utterance){window.__exoTtsSpoken.push(utterance.text);utterance.onstart?.();setTimeout(()=>utterance.onend?.(),100)},
   cancel(){},getVoices(){return [{name:'Test English',lang:'en-US',voiceURI:'test-en',localService:true}]},
   addEventListener(){},removeEventListener(){},
  }})
 })
 await page.route('**/api/exo-assistant/speech/status',route=>route.fulfill({json:{available:false}}))
 await page.route('**/api/exo-assistant/speech-local/status',route=>route.fulfill({json:{available:false}}))
 await page.route('**/api/exo-assistant/speech-neural/status',route=>route.fulfill({json:{available:false}}))
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000})
 await page.locator('[data-exo-ai-character]').waitFor({timeout:45000})
 await page.locator('[data-exo-ai-character] button').click()
 const panel=page.locator('#clo-arai-chat')
 await panel.waitFor({timeout:10000})
 result.checks.panel=true
 await panel.getByRole('button',{name:'Quick tour'}).click()
 await page.waitForTimeout(450)
 assert.equal(await page.locator('.exo-ai-guide-spotlight').count(),1)
 const speech=await page.evaluate(()=>window.__exoTtsSpoken)
 assert(speech.some(text=>text.includes('Welcome to EXO')),'Quick Tour never sent speech to Web Speech provider')
 result.checks.quickTourVoiceTriggered=true
 await panel.getByRole('button',{name:'Tutorials'}).click()
 assert.match(await panel.locator('#exo-ai-tutorial-panel').innerText(),/Step 1 of 14/)
 result.checks.fullTour14Stops=true
 await panel.getByRole('button',{name:'Stop tour'}).click()
 await panel.locator('#exo-ai-tour-choice').selectOption('grading')
 await panel.getByRole('button',{name:'Start guided lesson'}).click()
 assert.match(await panel.locator('#exo-ai-tutorial-panel').innerText(),/Step 1 of 4/)
 result.checks.gradingTutorial=true
 await panel.getByRole('button',{name:'Stop tour'}).click()
 await panel.getByRole('button',{name:'Workflows'}).click()
 await panel.locator('#exo-ai-workflow-select').selectOption('pattern-creation')
 assert.equal(await panel.locator('.exo-ai-workflow-steps li').count(),4)
 const mustConfirm=panel.getByText(/I approve replacing the current pattern/i)
 await mustConfirm.waitFor()
 assert.equal(await panel.getByRole('button',{name:'Run next step'}).isDisabled(),true)
 await panel.locator('.exo-ai-workflow-approval input').check()
 await panel.getByRole('button',{name:'Run next step'}).click()
 await page.waitForTimeout(800)
 result.checks.workflowCreateStep=await panel.locator('.exo-ai-workflow-steps li.finished').count()>=1
 await panel.locator('#exo-ai-workflow-select').selectOption('pattern-grading')
 for(let n=0;n<3;n++){
  await panel.getByRole('button',{name:'Run next step'}).click()
  await page.waitForTimeout(350)
 }
 result.checks.autoGradeStep=await panel.locator('.exo-ai-workflow-steps li.finished').count()>=3
 await panel.getByRole('button',{name:'Create custom workflow'}).click()
 await panel.locator('#exo-ai-custom-name').fill('My FIT Grade Flow')
 await panel.getByRole('button',{name:'Save custom workflow'}).click()
 assert.equal(await panel.locator('#exo-ai-workflow-select').inputValue().then(v=>v.startsWith('custom-')),true)
 result.checks.customWorkflowSaved=true
 await panel.getByRole('button',{name:'Celebrate'}).click()
 await page.waitForTimeout(350)
 assert(await page.locator('body.exo-ai-celebrating').count())
 assert(await page.locator('.exo-ai-character.party').count())
 const orbit=await page.locator('.exo-ai-character.party').getAttribute('style')
 result.checks.partyAvatar=!!orbit
 await page.screenshot({path:path.join(dir,'desktop-party.png')})
 await panel.getByRole('button',{name:'Stop party'}).click()
 assert.equal(await page.locator('body.exo-ai-celebrating').count(),0)
 const buttonColor=await panel.getByRole('button',{name:'Quick tour'}).evaluate(el=>getComputedStyle(el).backgroundColor)
 result.checks.solidButtons=buttonColor!=='rgba(0, 0, 0, 0)'&&buttonColor!=='transparent'
 await page.screenshot({path:path.join(dir,'desktop-workflow.png')})
 await page.setViewportSize({width:390,height:844})
 await page.waitForTimeout(350)
 const rect=await panel.boundingBox()
 result.checks.mobileWithinViewport=!!rect&&rect.x>=0&&rect.x+rect.width<=391
 await page.screenshot({path:path.join(dir,'mobile-workflow.png')})
}finally{
 await browser.close()
 writeFileSync(path.join(dir,'results.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result,null,2))
}

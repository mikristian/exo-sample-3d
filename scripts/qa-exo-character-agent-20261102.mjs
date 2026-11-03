import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import path from 'node:path'

const target=process.env.EXO_ASSISTANT_URL||'http://127.0.0.1:5173/'
const output=path.resolve('out/qa-exo-character-agent-20261102')
mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage']})
const qa={url:target,character:false,chat:false,patternTour:false,gradingTour:false,techpackTour:false,toolSpotlight:false,commandExecution:false,voiceControl:false,localModeHonest:false,phone:false,errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 page.on('pageerror',e=>qa.errors.push(e.message))
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:40000})
 await page.locator('[data-exo-ai-character]').waitFor({timeout:45000})
 qa.character=true
 await page.getByRole('button',{name:'Talk to EXO character assistant'}).click()
 await page.getByRole('dialog',{name:'EXO animated app assistant'}).waitFor()
 qa.chat=true
 await page.screenshot({path:path.join(output,'assistant-desktop.png'),fullPage:false})
 await page.getByRole('button',{name:'Pattern',exact:true}).click()
 await page.getByRole('heading',{name:'Open Pattern'}).waitFor()
 assert.equal(await page.locator('.exo-ai-tutorial-progress i').count(),3)
 await page.locator('.exo-ai-guide-spotlight').waitFor()
 assert.equal(await page.locator('[data-exo-guide-target=pattern]').count(),1)
 qa.patternTour=true;qa.toolSpotlight=true
 await page.screenshot({path:path.join(output,'assistant-pattern-spotlight.png'),fullPage:false})
 await page.getByRole('button',{name:/Next/}).click()
 await page.getByRole('heading',{name:'Find a drafting tool'}).waitFor()
 await page.getByRole('button',{name:'End tutorial'}).click()
 await page.getByRole('button',{name:'Grading',exact:true}).click()
 await page.getByRole('heading',{name:'Open Grading'}).waitFor()
 qa.gradingTour=true
 await page.getByRole('button',{name:'End tutorial'}).click()
 await page.getByRole('button',{name:'Tech packs',exact:true}).click()
 await page.getByRole('heading',{name:'Switch workspaces'}).waitFor()
 qa.techpackTour=true
 await page.getByRole('button',{name:'End tutorial'}).click()
 await page.getByRole('textbox',{name:'Ask EXO about the application'}).fill('show fabrics')
 await page.getByRole('button',{name:'Send message to EXO'}).click()
 await page.getByRole('dialog',{name:'EXO animated app assistant'}).getByText('Opened the Fabric library.').waitFor({timeout:15000})
 qa.commandExecution=true
 await page.getByRole('button',{name:'Enable character speech'}).click()
 assert.equal(await page.getByRole('button',{name:'Mute character speech'}).count(),1)
 qa.voiceControl=true
 await page.getByRole('button',{name:/Local AI Preview/}).click()
 await page.getByRole('textbox',{name:'Ask EXO about the application'}).fill('Can you discuss pattern sizes in my current workspace?')
 await page.getByRole('button',{name:'Send message to EXO'}).click()
 await page.getByText(/The optional local model is not available|Could not contact the local EXO model service|Local model.*unavailable/i).first().waitFor({timeout:25000})
 qa.localModeHonest=true
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:path.join(output,'assistant-mobile.png'),fullPage:false})
 const rect=await page.locator('.exo-ai-panel').boundingBox()
 assert(rect.x>=0&&rect.x+rect.width<=391)
 qa.phone=true
 writeFileSync(path.join(output,'results.json'),JSON.stringify(qa,null,2))
 console.log(JSON.stringify(qa,null,2))
}finally{await browser.close()}

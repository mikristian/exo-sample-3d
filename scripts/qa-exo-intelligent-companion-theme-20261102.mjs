import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import path from 'node:path'

const dir=path.resolve('qa/exo-intelligent-companion-20261102')
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']})
const results={url:process.env.EXO_ASSISTANT_URL||'http://127.0.0.1:5174/',checks:{},pageErrors:[]}
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 page.on('pageerror',e=>results.pageErrors.push(e.message))
 await page.route('**/api/exo-assistant/speech/status',route=>route.fulfill({json:{available:false}}))
 await page.route('**/api/exo-assistant/speech-local/status',route=>route.fulfill({json:{available:false}}))
 await page.route('**/api/exo-assistant/speech-neural/status',route=>route.fulfill({json:{available:false}}))
 await page.goto(results.url,{waitUntil:'domcontentloaded',timeout:45000})
 await page.locator('[data-exo-ai-character] button').waitFor({timeout:45000})
 await page.locator('[data-exo-ai-character] button').click()
 const panel=page.locator('#clo-arai-chat')
 await panel.waitFor({timeout:12000})
 await panel.getByRole('button',{name:'Mute voice'}).click()
 const ask=async text=>{
  await panel.getByRole('textbox',{name:'Ask EXO about the application'}).fill(text)
  await panel.getByRole('button',{name:'Send to EXO'}).click()
  await page.waitForTimeout(300)
 }
 await ask('Can you walk me through the theme settings step by step?')
 await page.locator('.studio-settings-dialog').waitFor({timeout:15000})
 assert.equal(await page.locator('#exo-ai-tutorial-panel select').inputValue(),'theme')
 await panel.getByRole('button',{name:'Next step'}).click()
 await page.waitForFunction(()=>document.querySelector('#exo-ai-tutorial-panel')?.textContent.includes('Step 2 of 9'),null,{timeout:7000})
 assert.match(await panel.locator('#exo-ai-tutorial-panel').innerText(),/Step 2 of 9/)
 assert(await page.locator('.exo-ai-guide-spotlight').count(),'Real theme setting spotlight missing')
 results.checks.themeTourWithActualSettings=true
 const panelZ=await panel.evaluate(el=>Number(getComputedStyle(el).zIndex))
 const dialogZ=await page.locator('.studio-settings-overlay').evaluate(el=>Number(getComputedStyle(el).zIndex))
 results.checks.assistantAboveThemeSettings=panelZ>dialogZ
 await page.screenshot({path:path.join(dir,'theme-tutorial.png')})
 await panel.getByRole('button',{name:'Stop tour'}).click()
 await ask('Show me all the theme options')
 await panel.locator('#exo-ai-theme-explorer').waitFor({timeout:8000})
 const choiceCount=await panel.locator('#exo-ai-theme-explorer .exo-ai-theme-grid button').count()
 assert(choiceCount>=8,'Theme browser shows too few installed presets')
 results.checks.installedPaletteBrowser=true
 await ask('Change the interface theme to Violet')
 await page.waitForTimeout(200)
 assert.equal(await page.locator('#exo-pattern-glass-shell').getAttribute('data-studio-theme'),'violet')
 results.checks.namedThemeApplied=true
 await ask('What theme am I using right now?')
 assert.match(await panel.locator('.exo-ai-dialogue').innerText(),/current EXO interface theme is Violet/i)
 results.checks.currentThemeAware=true
 await ask('Show me the purple themes')
 assert.match(await panel.locator('.exo-ai-dialogue').innerText(),/installed purple theme options/i)
 results.checks.themeCategoryFollowup=true
 await page.screenshot({path:path.join(dir,'theme-options.png')})
 await ask('Walk me through sewing tools')
 await panel.locator('#exo-ai-tour-choice').waitFor({timeout:10000})
 assert.equal(await panel.locator('#exo-ai-tour-choice').inputValue(),'sewing')
 results.checks.sewingTutorialByChat=true
 await panel.getByRole('button',{name:'Stop tour'}).click()
 await page.setViewportSize({width:390,height:844})
 await page.waitForTimeout(250)
 const rect=await panel.boundingBox()
 results.checks.mobileAssistantInViewport=rect&&rect.x>=0&&rect.x+rect.width<=391
 await page.screenshot({path:path.join(dir,'mobile-theme.png')})
}finally{
 await browser.close()
 writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2)+'\n')
 console.log(JSON.stringify(results,null,2))
}

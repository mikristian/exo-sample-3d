import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
const dir='qa/exo-companion-modes-20261102'
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']})
const result={voiceProviders:[],speakingObserved:false,errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}})
 page.on('pageerror',error=>result.errors.push(error.message))
 page.on('response',response=>{if(response.url().includes('/api/exo-assistant/speech'))result.voiceProviders.push({url:response.url().split('/api/')[1],status:response.status()})})
 await page.goto(process.env.EXO_COMPANION_URL||'http://127.0.0.1:5174/',{waitUntil:'domcontentloaded',timeout:45000})
 await page.locator('[data-exo-ai-character] button').waitFor({timeout:45000})
 await page.locator('[data-exo-ai-character] button').click()
 await page.locator('#clo-arai-chat .exo-ai-guide-controls button').getByText('Quick tour').click()
 try{await page.locator('.exo-ai-character.speaking').waitFor({timeout:19000});result.speakingObserved=true}catch{}
 result.tourStep=await page.locator('#clo-arai-chat').innerText().then(text=>text.includes('Welcome to EXO'))
 await page.screenshot({path:dir+'/live-voice-state.png'})
}finally{
 await browser.close()
 writeFileSync(dir+'/live-voice-results.json',JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result,null,2))
}

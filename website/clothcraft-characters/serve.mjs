import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {execFile} from 'node:child_process'
import {createServer} from 'vite'

const root=dirname(fileURLToPath(import.meta.url))
const port=Number(process.env.CLOTHCRAFT_CHARACTERS_PORT||5288)
const server=await createServer({
  root,
  configFile:false,
  clearScreen:false,
  server:{host:'127.0.0.1',port,strictPort:true},
})

await server.listen()
server.printUrls()
console.log('ClothCraft Character Atelier is separate from the garment studio.')
if(process.argv.includes('--open') && process.platform==='darwin'){
  execFile('open',[`http://127.0.0.1:${port}/`],error=>{
    if(error)console.error(`Could not open browser automatically: ${error.message}`)
  })
}

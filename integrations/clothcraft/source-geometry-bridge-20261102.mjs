import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./pattern-source-geometry-20261102.py', import.meta.url))
export function readArchiveSourceGeometry(sourceId) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [script], {stdio:['pipe','pipe','pipe']})
    const chunks=[]
    let size=0
    const timer=setTimeout(()=>child.kill('SIGKILL'), 10000)
    child.stdout.on('data', chunk=>{size+=chunk.length;if(size>6*1024*1024)child.kill('SIGKILL');else chunks.push(chunk)})
    child.on('error',reject)
    child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('source_geometry_process_failed'));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch(e){reject(e)}})
    child.stdin.end(JSON.stringify({sourceId}))
  })
}

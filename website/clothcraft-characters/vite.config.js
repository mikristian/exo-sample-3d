import {defineConfig} from 'vite'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.dirname(fileURLToPath(import.meta.url))

// Keep both independent local pages in production output.
export default defineConfig({
  root,
  build:{
    outDir:path.join(root,'dist'),
    rollupOptions:{input:{atelier:path.join(root,'index.html'),circle:path.join(root,'circle.html')}},
  },
})

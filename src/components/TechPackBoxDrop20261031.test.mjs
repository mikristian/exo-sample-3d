import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import Module from 'node:module'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'

const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
const bundle=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
const mod=new Module(filename)
mod.filename=filename
mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
mod.require=createRequire(import.meta.url)
mod._compile(bundle.outputFiles[0].text,filename)

const assets=[{id:'photo-1',dataUrl:'data:image/png;base64,AAAA'},{id:'photo-2',url:'https://example.invalid/remote.png'}]
const drag=(type,raw,others=[])=>({types:[type,...others],getData:key=>key===type?raw:''})

test('only linked document asset IDs resolve from known native drag formats',()=>{
  const {droppedBoxAssetId}=mod.exports
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset','photo-1'),assets),'photo-1')
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset',JSON.stringify({assetId:'photo-2'})),assets),'photo-2')
  assert.equal(droppedBoxAssetId(drag('application/x-exo-asset',JSON.stringify({id:'photo-1'})),assets),'photo-1')
  assert.equal(droppedBoxAssetId(drag('text/plain','photo-1'),assets),'photo-1')
  assert.equal(droppedBoxAssetId(drag('text/plain','https://example.invalid/remote.png'),assets),null)
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset','unknown'),assets),null)
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset','{"id":null}'),assets),null)
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset','photo-1',['application/x-exo-techpack-template']),assets),null)
  assert.equal(droppedBoxAssetId(drag('application/x-exo-techpack-asset','x'.repeat(4097)),assets),null)
})

test('embedded table right click opens Studio without consuming double click text selection',()=>{
  const source=fs.readFileSync(filename,'utf8')
  assert.doesNotMatch(source,/onDoubleClickCapture/)
  assert.match(source,/onContextMenu=\{event=>\{if\(kind==='table'\)/)
  assert.match(source,/onOpenTableStudio\(\)/)
  assert.match(source,/preventScroll:true/)
  assert.match(source,/tpbc-photo-filled/)
  assert.match(source,/patch\(\{assetId,assetSrc:null\}\)/)
})

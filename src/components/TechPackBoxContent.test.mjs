import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {transform,build} from 'esbuild'
import {createRequire} from 'node:module'
import Module from 'node:module'
import {fileURLToPath} from 'node:url'

const component=fs.readFileSync(new URL('./TechPackBoxContent.jsx',import.meta.url),'utf8')

test('TechPack box JSX compiles with spreadsheet and image editing controls',async()=>{
  const output=await transform(component,{loader:'jsx',format:'esm'})
  assert.match(output.code,/TechPackSpreadsheetBlock/)
  assert.match(output.code,/Replace photo/)
  assert.match(output.code,/Clear box photo/)
})

test('photo updates keep authored contents and do not allow remote image preview URLs',()=>{
  assert.match(component,/patch\(\{assetId:\s*null,\s*assetSrc:\s*null\}\)/)
  assert.match(component,/safeBoxImageSrc/)
  assert.match(component,/data:image/)
  assert.doesNotMatch(component,/dangerouslySetInnerHTML/)
  assert.match(component,/onDoubleClick/)
})

test('populated artboard media has no permanent editor chrome or photo card border',()=>{
  const css=fs.readFileSync(new URL('./TechPackBoxContent.css',import.meta.url),'utf8')
  assert.match(component,/const pureMedia=/)
  assert.match(component,/tpbc-pure-media/)
  assert.match(component,/!pureMedia&&<div className="tpbc-topline"/)
  assert.match(component,/editable&&!safeSrc&&<button type="button" className="tpbc-photo-overlay"/)
  assert.match(component,/kind==='module'&&!pureMedia&&<div className="tpbc-template-module"/)
  assert.match(component,/editable&&!safeSrc&&!pureMedia&&\(kind==='asset'/)
  assert.match(css,/\.tpbc\.tpbc-pure-media\{padding:0!important/)
  assert.match(css,/\.tpbc-pure-media \.tpbc-photo-frame\{[^}]*border:0!important/)
})

test('read-only preview computes formulas, applies theme and cell styles, and preserves source warnings',async()=>{
  const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
  const output=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
  const executable=new Module(filename)
  executable.filename=filename
  executable.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
  executable.require=createRequire(import.meta.url)
  executable._compile(output.outputFiles[0].text,filename)
  const {spreadsheetBoxPreview}=executable.exports
  const original={columns:[{id:'a',label:'Quantity',width:190},{id:'b',label:'Total'}],rows:[
    {id:'native',cells:{a:{input:'7',origin:'native',sourceRef:'pom:qty'},b:{input:'=A1*3',value:'=A1*3'}}},
    {id:'changed',cells:{a:{input:'9',override:true,sourceRevision:3},b:{input:'=A2/0'}}}
  ],tableStyle:{theme:'dark'},cellStyles:{'native:1':{bold:true,align:'right',color:'#123456',background:'#abcdef'},'changed:0':{italic:true,color:'red'}}}
  const before=JSON.stringify(original)
  const view=spreadsheetBoxPreview(original)
  assert.equal(view.rows[0].cells[1].value,'21')
  assert.equal(view.rows[1].cells[1].value,'#DIV/0!')
  assert.equal(view.rows[0].cells[0].status,'Source linked')
  assert.equal(view.rows[1].cells[0].status,'Override · review required')
  assert.equal(view.rows[0].cells[1].style.fontWeight,'bold')
  assert.equal(view.rows[0].cells[1].style.textAlign,'right')
  assert.equal(view.rows[0].cells[1].style.background,'#abcdef')
  assert.equal(view.rows[1].cells[0].style.color,undefined)
  assert.equal(view.palette.header,'#243449')
  assert.equal(view.columns[0].width,190)
  assert.equal(JSON.stringify(original),before,'preview must leave source data untouched')
})
test('embedded preview keeps merged heading cells and suppresses covered boxes',async()=>{
  const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
  const output=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',
    packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
  const mod=new Module(filename)
  mod.filename=filename
  mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
  mod.require=createRequire(import.meta.url)
  mod._compile(output.outputFiles[0].text,filename)
  const table={columns:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],
    rows:[{id:'r1',cells:{a:{input:'FACTORY NOTES'},b:{input:''},c:{input:''}}}],
    mergedCells:[{r:0,c:0,rowSpan:1,colSpan:3}]}
  const preview=mod.exports.spreadsheetBoxPreview(table)
  assert.equal(preview.rows[0].cells[0].merge.colSpan,3)
  assert.equal(preview.rows[0].cells[1].covered,true)
  assert.equal(preview.rows[0].cells[2].covered,true)
})
test('embedded grid fits all columns to 100% of placed object instead of clipping wider pixel widths',async()=>{
  const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
  const output=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',
    packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
  const mod=new Module(filename)
  mod.filename=filename
  mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
  mod.require=createRequire(import.meta.url)
  mod._compile(output.outputFiles[0].text,filename)
  const fitted=mod.exports.fittedEmbeddedColumnWidths([{width:44},{width:63},{width:466}])
  assert.equal(fitted.length,3)
  assert.ok(Math.abs(fitted.map(parseFloat).reduce((sum,n)=>sum+n,0)-100)<1e-8)
  assert.equal(fitted[0],String(44/573*100)+'%')
  assert.deepEqual(mod.exports.fittedEmbeddedColumnWidths([]),[])
  assert.match(component,/style=\{\{width:fittedColumns\[index\]\}\}/)
  assert.match(component,/setSelectionRange\?\.\(0,0\)/)
})
test('direct clicks edit authored table headers and cells without changing linked source values',async()=>{
  const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
  const output=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',
    packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
  const mod=new Module(filename);mod.filename=filename
  mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
  mod.require=createRequire(import.meta.url)
  mod._compile(output.outputFiles[0].text,filename)
  const {patchInlineSpreadsheet,canInlineEditSpreadsheet}=mod.exports
  const authored={columns:[{id:'a',label:'POM'},{id:'b',label:'Measurement'}],
    rows:[{id:'r1',cells:{a:{input:'Chest'},b:{input:''}}}],
    mergedCells:[],origin:'authored'}
  assert.equal(canInlineEditSpreadsheet(authored),true)
  const heading=patchInlineSpreadsheet(authored,'header',-1,1,'CM')
  assert.equal(heading.columns[1].label,'CM')
  assert.equal(authored.columns[1].label,'Measurement')
  const edited=patchInlineSpreadsheet(heading,'cell',0,1,'56')
  assert.equal(edited.rows[0].cells.b.input,'56')
  assert.equal(edited.rows[0].cells.b.value,'56')
  assert.equal(authored.rows[0].cells.b.input,'')
  const linked={...authored,rows:[{id:'r1',sourceRef:'pom:chest',cells:authored.rows[0].cells}]}
  assert.equal(canInlineEditSpreadsheet(linked),false)
  assert.equal(patchInlineSpreadsheet(linked,'cell',0,1,'999'),null)
  const merged={...authored,mergedCells:[{r:0,c:0,rowSpan:1,colSpan:2}]}
  assert.equal(patchInlineSpreadsheet(merged,'cell',0,1,'999'),null)
})

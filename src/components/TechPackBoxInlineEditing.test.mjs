import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import Module from 'node:module'
import {fileURLToPath} from 'node:url'

const filename=fileURLToPath(new URL('./TechPackBoxContent.jsx',import.meta.url))
const bundle=await build({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.jsx':'jsx','.css':'empty'},logLevel:'silent'})
const mod=new Module(filename)
mod.filename=filename
mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)))
mod.require=createRequire(import.meta.url)
mod._compile(bundle.outputFiles[0].text,filename)
const {patchInlineSpreadsheet,canInlineEditSpreadsheet}=mod.exports

const authored=()=>({columns:[{id:'a',label:'Description',width:210},{id:'b',label:'Value',width:110}],rows:[
  {id:'r1',cells:{a:{input:'Neck',value:'Neck',provenance:{kind:'authored'}},b:{input:'22',value:'22',origin:'authored'}}},
  {id:'r2',cells:{a:{input:'Hem',value:'Hem'},b:{input:'31',value:'31'}}}],
  mergedCells:[{r:0,c:0,rowSpan:1,colSpan:2}],cellStyles:{'r1:0':{bold:true,align:'center'}}})

test('updates exactly one authored cell and preserves merged headings and presentation metadata',()=>{
  const before=authored()
  const snapshot=JSON.stringify(before)
  assert.equal(patchInlineSpreadsheet(before,'cell',0,1,'hidden'),null,'covered cell is uneditable')
  const next=patchInlineSpreadsheet(before,'cell',0,0,'FACTORY NOTES')
  assert.equal(next.rows[0].cells.a.input,'FACTORY NOTES')
  assert.equal(next.rows[0].cells.a.value,'FACTORY NOTES')
  assert.equal(next.rows[0].cells.a.provenance.kind,'authored')
  assert.strictEqual(next.rows[1],before.rows[1])
  assert.strictEqual(next.mergedCells,before.mergedCells)
  assert.strictEqual(next.cellStyles,before.cellStyles)
  assert.equal(JSON.stringify(before),snapshot)
})

test('header updates preserve stable IDs, widths and column provenance',()=>{
  const before=authored()
  const next=patchInlineSpreadsheet(before,'header',-1,1,'Tolerance')
  assert.deepEqual(next.columns[0],before.columns[0])
  assert.deepEqual(next.columns[1],{id:'b',label:'Tolerance',width:110})
  assert.equal(patchInlineSpreadsheet(before,'header',0,1,'not a header'),null)
})

test('rejects source linked tables, source cells, overridden cells and source rows',()=>{
  const original=authored()
  assert.equal(canInlineEditSpreadsheet(original),true)
  assert.equal(patchInlineSpreadsheet(original,'cell',1,1,'4',{sourceLinked:true}),null)
  assert.equal(patchInlineSpreadsheet({...original,origin:'native'},'cell',1,1,'4'),null)
  assert.equal(patchInlineSpreadsheet({...original,sourceRef:'native:bundle'},'header',-1,0,'new'),null)
  const bound=authored()
  bound.rows[0].cells.b.sourceRef='pom:height'
  assert.equal(canInlineEditSpreadsheet(bound),false)
  assert.equal(patchInlineSpreadsheet(bound,'cell',1,0,'changed'),null)
  const overridden=authored()
  overridden.rows[0].cells.b.provenance={kind:'override',sourceRef:'pom:height'}
  assert.equal(canInlineEditSpreadsheet(overridden),false)
  const linkedRow=authored()
  linkedRow.rows[0].sourceRef='measurement:height'
  assert.equal(canInlineEditSpreadsheet(linkedRow),false)
})

test('rejects invalid coordinates without changing table state',()=>{
  const source=authored()
  assert.equal(patchInlineSpreadsheet(source,'cell',-1,0,'bad'),null)
  assert.equal(patchInlineSpreadsheet(source,'cell',90,0,'bad'),null)
  assert.equal(patchInlineSpreadsheet(source,'cell',1,20,'bad'),null)
  assert.equal(patchInlineSpreadsheet(source,'other',0,0,'bad'),null)
})

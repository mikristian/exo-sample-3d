import test from 'node:test'
import assert from 'node:assert/strict'
import {TECHPACK_TABLE_GALLERY,TECHPACK_HEADER_GALLERY,createTechPackGalleryTable,applyTechPackHeaderPreset,replaceTechPackHeaderPreset} from './techPackTableGallery20261030.js'
import {validateTableV3} from './validation.js'
import {normalizedMergedCells} from './mergedCells20261030.js'

test('curated authored table presets contain safe labels and bounded editable cells',()=>{
 assert(TECHPACK_TABLE_GALLERY.length>=25)
 assert.equal(new Set(TECHPACK_TABLE_GALLERY.map(item=>item.id)).size,TECHPACK_TABLE_GALLERY.length)
 for(const recipe of TECHPACK_TABLE_GALLERY){
  const table=createTechPackGalleryTable(recipe.id)
  assert.equal(validateTableV3(table).valid,true,recipe.id)
  assert(table.columns.length>=4&&table.columns.length<=8)
  assert(table.rows.length>=4&&table.rows.length<=10)
  assert.equal(table.sourceLinked,false)
  assert.equal(table.rows[0].cells[table.columns[0].id].value,recipe.rowLabels[0])
  assert(!/sourceRef|sourceRevision|patternId/.test(JSON.stringify(table)))
  for(const row of table.rows)for(const cell of Object.values(row.cells)){
   assert.equal(cell.origin,'authored')
   assert.equal(cell.provenance.kind,'authored')
  }
 }
 const pom=createTechPackGalleryTable('pom-spec')
 assert(pom.rows.every(row=>pom.columns.slice(1).every(col=>row.cells[col.id].value==='')))
 const size=createTechPackGalleryTable('size-chart')
 assert(size.rows.every(row=>size.columns.slice(1).every(col=>row.cells[col.id].value==='')))
 assert.deepEqual(size.rows.map(row=>row.cells[size.columns[0].id].value),['XS','S','M','L','XL'])
 const measurement=createTechPackGalleryTable('measurement-matrix')
 assert.deepEqual(measurement.columns.map(col=>col.label).slice(3),['XS','S','M','L','XL'])
 assert(measurement.rows.every(row=>measurement.columns.slice(2).every(col=>row.cells[col.id].value==='')))
})

test('header presets preserve existing cells, shift existing merges and never mutate the source',()=>{
 assert(TECHPACK_HEADER_GALLERY.length>=14)
 assert.equal(new Set(TECHPACK_HEADER_GALLERY.map(item=>item.id)).size,TECHPACK_HEADER_GALLERY.length)
 for(const header of TECHPACK_HEADER_GALLERY){
  const original=createTechPackGalleryTable('pom-spec',{title:'Fit specification'})
  original.rows[2].cells[original.columns[2].id].value='Across body'
  original.rows[2].cells[original.columns[2].id].input='Across body'
  original.mergedCells=[{r:1,c:2,rowSpan:1,colSpan:2}]
  original.cellStyles={'row-2:2':{italic:true}}
  const before=structuredClone(original)
  const next=applyTechPackHeaderPreset(original,header.id,{label:'Fit specification'})
  assert.deepEqual(original,before)
  assert.equal(validateTableV3(next).valid,true,header.id)
  assert.equal(next.rows[2+header.rows].cells[next.columns[2].id].value,'Across body')
  assert.deepEqual(next.cellStyles['row-2:2'],{italic:true})
  assert.deepEqual(normalizedMergedCells(next)[0],{r:1+header.rows,c:2,rowSpan:1,colSpan:2})
  if(header.rows)assert.equal(next.rows[0].cells[next.columns[0].id].value,'Fit specification')
 }
})

test('new gallery templates are source-independent and keep measured and approval fields empty',()=>{
 for(const id of ['size-run','colorway-approval','embellishment-placement','print-artwork','fit-approval','garment-spec','wash-testing','packaging-spec','compliance-review','carton-assortment']){
  const table=createTechPackGalleryTable(id)
  assert.equal(table.sourceLinked,false,id)
  assert(table.rows.every(row=>table.columns.slice(1).every(column=>row.cells[column.id].value==='')),id)
  assert(!/sourceRef|sourceRevision|patternId/.test(JSON.stringify(table)),id)
 }
})

test('new visual headers can be switched without deleting supplied table data',()=>{
 const table=createTechPackGalleryTable('fit-approval')
 table.rows[0].cells[table.columns[1].id].value='User entered size'
 table.rows[0].cells[table.columns[1].id].input='User entered size'
 for(const header of TECHPACK_HEADER_GALLERY){
  const applied=applyTechPackHeaderPreset(table,header.id)
  const switched=replaceTechPackHeaderPreset(applied,'review-heading',{label:'Fit review'})
  assert.equal(validateTableV3(switched).valid,true,header.id)
  assert.equal(switched.rows[2].cells[table.columns[1].id].value,'User entered size')
 }
})

test('header rejects invalid merge layouts, row overflow and unknown identifiers',()=>{
 const table=createTechPackGalleryTable('bom')
 assert.throws(()=>createTechPackGalleryTable('missing'),/Unknown tech pack gallery/)
 assert.throws(()=>applyTechPackHeaderPreset(table,'missing'),/Unknown tech pack header/)
 const bad=structuredClone(table)
 bad.mergedCells=[{r:0,c:0,rowSpan:1,colSpan:2},{r:0,c:1,rowSpan:1,colSpan:2}]
 assert.throws(()=>applyTechPackHeaderPreset(bad,'title-band'),/OVERLAPPING/)
 const huge=structuredClone(table)
 huge.rows=Array.from({length:100},(_,i)=>({...structuredClone(table.rows[0]),id:'row-'+i}))
 assert.throws(()=>applyTechPackHeaderPreset(huge,'title-band'),/100-row/)
 const stillValid=applyTechPackHeaderPreset(huge,'minimal')
 assert.equal(stillValid.rows.length,100)
})

test('replacement removes previous gallery headings and retains authored cells, merges and metadata',()=>{
 const base=createTechPackGalleryTable('bom')
 base.sourceRevision=17
 base.rows[2].cells[base.columns[2].id].input='Placement edited'
 base.rows[2].cells[base.columns[2].id].value='Placement edited'
 base.rows[2].cells[base.columns[2].id].sourceRef='preserved-ref'
 base.mergedCells=[{r:3,c:1,rowSpan:1,colSpan:2}]
 const old=applyTechPackHeaderPreset(base,'double-heading',{label:'Original title'})
 const oldCopy=structuredClone(old)
 const next=replaceTechPackHeaderPreset(old,'section-band',{label:'New section'})
 assert.deepEqual(old,oldCopy)
 assert.equal(next.rows.length,base.rows.length+1)
 assert.equal(next.rows[0].cells[next.columns[0].id].value,'New section')
 assert.deepEqual(next.rows.slice(1),base.rows)
 assert.deepEqual(next.mergedCells.filter(m=>m.r>0),[{r:4,c:1,rowSpan:1,colSpan:2}])
 assert.equal(next.sourceRevision,17)
 assert.equal(next.rows[3].cells[next.columns[2].id].sourceRef,'preserved-ref')
 const minimal=replaceTechPackHeaderPreset(next,'minimal')
 assert.equal(minimal.rows.length,base.rows.length)
 assert.deepEqual(minimal.rows,base.rows)
 assert.deepEqual(minimal.mergedCells,base.mergedCells)
 assert.equal(replaceTechPackHeaderPreset(minimal,'title-band').rows.length,base.rows.length+1)
})

test('replacement fails closed on edited headings, altered styles, unsafe merges and legacy headings',()=>{
 const original=applyTechPackHeaderPreset(createTechPackGalleryTable('pom-spec'),'title-band',{label:'My heading'})
 const changedCell=structuredClone(original)
 changedCell.rows[0].cells[changedCell.columns[0].id].value='Edited heading'
 assert.throws(()=>replaceTechPackHeaderPreset(changedCell,'section-band'),/edited/)
 const changedStyle=structuredClone(original)
 changedStyle.cellStyles[`${changedStyle.rows[0].id}:0`].bold=false
 assert.throws(()=>replaceTechPackHeaderPreset(changedStyle,'minimal'),/edited/)
 const changedMerge=structuredClone(original)
 changedMerge.mergedCells=[]
 assert.throws(()=>replaceTechPackHeaderPreset(changedMerge,'compact'),/edited/)
 const legacy=structuredClone(original)
 delete legacy.headerPresetSnapshot
 assert.throws(()=>replaceTechPackHeaderPreset(legacy,'minimal'),/snapshot/)
 assert.throws(()=>replaceTechPackHeaderPreset(original,'unknown'),/Unknown tech pack header/)
 assert.equal(replaceTechPackHeaderPreset(createTechPackGalleryTable('bom'),'title-band').rows.length,8)
})

test('rekeyed embedded heading is replaceable only with exact remapped snapshot',()=>{
 const original=applyTechPackHeaderPreset(createTechPackGalleryTable('pom-spec'),'double-heading',{label:'Embedded title'})
 const embedded=structuredClone(original)
 for(let i=0;i<2;i++){
  const oldId=embedded.rows[i].id
  const newId=`row-embedded-${i}`
  embedded.rows[i].id=newId
  embedded.headerPresetSnapshot.rows[i].id=newId
  embedded.headerPresetSnapshot.rowIds[i]=newId
  embedded.cellStyles[`${newId}:0`]=embedded.cellStyles[`${oldId}:0`]
  delete embedded.cellStyles[`${oldId}:0`]
  embedded.headerPresetSnapshot.styles[newId]=embedded.headerPresetSnapshot.styles[oldId]
  delete embedded.headerPresetSnapshot.styles[oldId]
 }
 const saved=structuredClone(embedded)
 const replaced=replaceTechPackHeaderPreset(embedded,'title-band',{label:'Revised'})
 assert.deepEqual(embedded,saved)
 assert.equal(replaced.rows.length,original.rows.length-1)
 assert.equal(replaced.rows[0].cells[replaced.columns[0].id].value,'Revised')
 assert.deepEqual(replaced.rows.slice(1),original.rows.slice(2))
 const mismatch=structuredClone(embedded)
 mismatch.headerPresetSnapshot.rowIds[0]='row-incorrect'
 assert.throws(()=>replaceTechPackHeaderPreset(mismatch,'minimal'),/edited/)
 const changed=structuredClone(embedded)
 changed.rows[1].cells[changed.columns[0].id].value='User edit'
 assert.throws(()=>replaceTechPackHeaderPreset(changed,'minimal'),/edited/)
})

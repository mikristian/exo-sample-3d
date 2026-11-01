import test from 'node:test'
import assert from 'node:assert/strict'
import {saveAuthoredTableTemplate,instantiateAuthoredTableTemplate,isTechPackTableLocked} from './tableEmbeds20261030.js'
import {createTechPackGalleryTable,applyTechPackHeaderPreset,replaceTechPackHeaderPreset} from './techPackTableGallery20261030.js'

test('explicit save preserves authored text and formatting while erasing source values, overrides, refs and identities',()=>{
  const source={id:'private-table',name:'BOM',sourceRevision:99,columns:[{id:'native-col',label:'PART',width:175},{id:'custom-col',label:'NOTE'}],rows:[
    {id:'native-row',sourceRef:'garment:secret',cells:{'native-col':{input:'secret source',origin:'native',sourceRef:'secret'},'custom-col':{input:'reviewed override',override:true,provenance:{kind:'override',sourceRef:'secret'}}}},
    {id:'manual-row',cells:{'native-col':{input:'Hand sewn'},'custom-col':{input:'Seam allowance'}}}],
    tableStyle:{theme:'technical'},cellStyles:{'manual-row:1':{bold:true,color:'#123456'},'native-row:0':{italic:true}}}
  const saved=saveAuthoredTableTemplate(source,{id:'library-1',name:'Reusable BOM'})
  const serialized=JSON.stringify(saved)
  for(const forbidden of ['private-table','garment:secret','secret source','reviewed override','native-col','manual-row','sourceRevision'])assert.equal(serialized.includes(forbidden),false,forbidden)
  assert.equal(saved.rows[0].cells['col-0'].input,'')
  assert.equal(saved.rows[1].cells['col-0'].input,'Hand sewn')
  assert.deepEqual(saved.cellStyles['row-1:1'],{bold:true,color:'#123456'})
  const placed=instantiateAuthoredTableTemplate(saved,{pageId:'artwork',boxId:'box7'})
  assert.equal(placed.boxId,'box7')
  assert.equal(placed.pageId,'artwork')
  assert.equal(placed.rows[1].cells[placed.columns[0].id].value,'Hand sewn')
  assert.equal(placed.cellStyles[`${placed.rows[1].id}:1`].bold,true)
  assert.notEqual(placed.id,saved.id)
  assert.notEqual(placed.columns[0].id,saved.columns[0].id)
  assert.notEqual(placed.rows[0].id,saved.rows[0].id)
  placed.rows[1].cells[placed.columns[0].id].input='changed'
  assert.equal(saved.rows[1].cells['col-0'].input,'Hand sewn')
})

test('rejects oversized tables and missing artboard position',()=>{
  const column={id:'a',label:'A'}
  assert.throws(()=>saveAuthoredTableTemplate({columns:Array.from({length:51},(_,i)=>({...column,id:`a${i}`})),rows:[]}),RangeError)
  assert.throws(()=>saveAuthoredTableTemplate({columns:[column],rows:Array.from({length:101},()=>({cells:{a:''}}))}),RangeError)
  assert.throws(()=>instantiateAuthoredTableTemplate({columns:[column],rows:[]},{}),TypeError)
})

test('recognizes locks on embedded boxes and board transforms',()=>{
  assert.equal(isTechPackTableLocked({pageBoxes:{art:[{id:'1',locked:true}]}},'art','1'),true)
  assert.equal(isTechPackTableLocked({boardObjects:{art:{'box-1':{locked:true}}}},'art','1'),true)
  assert.equal(isTechPackTableLocked({pageBoxes:{art:[{id:'1'}]}},'art','1'),false)
})
test('merged headings persist through library save and independent artboard embedding',()=>{
 const table={title:'Factory details',columns:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],
   rows:[{id:'one',cells:{a:{input:'CUTTING INSTRUCTIONS'},b:{input:''},c:{input:''}}}],
   mergedCells:[{r:0,c:0,rowSpan:1,colSpan:3}],cellStyles:{'one:0':{bold:true,align:'center'}}}
 const template=saveAuthoredTableTemplate(table,{id:'library-merged'})
 assert.deepEqual(template.mergedCells,[{r:0,c:0,rowSpan:1,colSpan:3}])
 const placed=instantiateAuthoredTableTemplate(template,{pageId:'construction',boxId:'one'})
 assert.deepEqual(placed.mergedCells,template.mergedCells)
 assert.equal(placed.rows[0].cells[placed.columns[0].id].value,'CUTTING INSTRUCTIONS')
 placed.mergedCells[0].colSpan=2
 assert.equal(template.mergedCells[0].colSpan,3)
})
test('gallery heading presets remain selectable after saving and embedding on a page',()=>{
 const table=applyTechPackHeaderPreset(createTechPackGalleryTable('size-chart'),'title-band')
 const saved=saveAuthoredTableTemplate(table,{id:'size-template'})
 assert.equal(saved.headerPreset,'title-band')
 assert.equal(saved.headerPresetSnapshot.rows.length,1)
 const placed=instantiateAuthoredTableTemplate(saved,{pageId:'measurements',boxId:'sizes'})
 assert.equal(placed.headerPresetSnapshot.rowIds[0],placed.rows[0].id)
 const changed=replaceTechPackHeaderPreset(placed,'section-band')
 assert.equal(changed.rows.length,placed.rows.length)
 assert.equal(changed.headerPreset,'section-band')
 assert.equal(changed.rows[1].cells[changed.columns[0].id].input,'XS')
 assert.equal(changed.cellStyles[changed.rows[0].id+':0'].align,'left')
 assert.equal(table.cellStyles[table.rows[0].id+':0'].align,'center')
})

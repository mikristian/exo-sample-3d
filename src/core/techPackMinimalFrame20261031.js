import {insertCustomTechPackPage} from './techPackPageComposer.js'
import {createCustomTechPackTable} from './techpack-spreadsheet/customTableDesign20261030.js'

// The shared structural rule from the 11-page original Mikristian / Seville
// PDF. All measurements are page-design pixels, NEVER garment dimensions.
export const MINIMAL_FRAMED_TECHPACK=Object.freeze({
  id:'seville-blank-frame',name:'Blank framed technical sheet',
  width:612,height:792,
  frame:Object.freeze({x:26,y:34,width:560,height:706}),
  headerHeight:47,sectionHeight:25,
  content:Object.freeze({x:39,y:109,width:534,height:608}),
  footer:Object.freeze({y:754,height:28})
})

/** An actual authored GridCraft/EXO table. Header labels, values and section
 * band are editable cells; no separate React form shadows the table model.
 * Values from the current garment are an initial *snapshot*, not falsely
 * presented as live/approved manufacturing provenance.
 */
export function createFramedHeaderTable({source={},draft={},headerFields={},title='TECHNICAL DETAILS'}={}){
  const names=(source.fabrics||[]).map(f=>f.name).filter(Boolean).slice(0,2).join(' / ')
  // Exact reading order and proportional column boundaries of the reference
  // Mikristian/Seville PDF, p.1–2: two narrow label/value rows followed by
  // one merged gray section-title band. The name spans three slots in row 2.
  const columns=Array.from({length:10},()=> '')
  const values=[
    ['SEASON',headerFields.season??draft.season??'','STYLE NO.',headerFields.sku??draft.sku??'',
      'CATEGORY',headerFields.category??draft.category??source.productionSpec?.category??'',
      'FABRIC',headerFields.fabric??names,'DATE',headerFields.date??draft.date??''],
    ['BRAND',headerFields.brand??draft.brand??'','NAME',headerFields.name??draft.styleName??source.name??'',
      '','','SIZE',headerFields.size??source.grading?.baseSize??'','MAT.',headerFields.material??''],
    [title,'','','',''],
  ]
  const table=createCustomTechPackTable({name:'Tech Pack identification header',rows:3,columns:10,
    headings:columns,theme:{theme:'custom',header:'#eeeeee',stripe:'#ffffff',
      text:'#111111',body:'#ffffff',bodyText:'#111111',border:'#111111'}})
  const ids=table.columns.map(col=>col.id)
  const colWidths=[44,63,56,78,56,43,45,84,37,67]
  const cellStyles={}
  const widths=table.columns.map((col,i)=>({...col,width:colWidths[i]}))
  for(let r=0;r<3;r++)for(let c=0;c<10;c++){
    if(r===2&&c!==0)continue
    if(r===1&&(c===4||c===5))continue
    cellStyles[`${table.rows[r].id}:${c}`]={
      bold:true,align:r===2?'center':'left',
      color:'#191919',background:r===2?'#ededed':'#ffffff'}
  }
  return {...table,kind:'framed-header',
    mergedCells:[{r:1,c:3,rowSpan:1,colSpan:3},{r:2,c:0,rowSpan:1,colSpan:10}],
    columns:widths,
    rows:table.rows.map((row,r)=>({...row,cells:Object.fromEntries(ids.map((id,c)=>[id,{
      ...row.cells[id],input:String(values[r][c]??''),value:String(values[r][c]??'')}]))})),
    cellStyles}
}

export function createFramedHeaderBox(pageId,options={}){
  const table=options.existingHeaderTable?
    JSON.parse(JSON.stringify(options.existingHeaderTable)):createFramedHeaderTable(options)
  const titleRow=table.kind==='framed-header'&&table.columns.length===10?2:3
  if(options.existingHeaderTable&&table.rows?.[titleRow]?.cells?.[table.columns?.[0]?.id]){
    const cell=table.rows[titleRow].cells[table.columns[0].id]
    table.rows[titleRow].cells[table.columns[0].id]={...cell,input:options.title||'TECHNICAL DETAILS',
      value:options.title||'TECHNICAL DETAILS'}
  }
  const landscape=options.orientation==='landscape',a4=options.paperSize==='A4'
  const pageWidth=landscape?(a4?842:792):(a4?595:612)
  return {id:'framed-header-'+pageId,title:'Tech Pack header',positionMode:'absolute',
    x:26,y:34,width:pageWidth-52,height:72,border:'none',lineColor:'#111111',note:'',
    slot:{category:'tables',templateRole:'shared-header',spreadsheetTable:{
      ...table,id:'framed-table-'+pageId,pageId,boxId:'framed-header-'+pageId}}}
}

/** Creates only the persistent page structure — no sample data, table, logo,
 * swatch or photograph. A specific garment's project source is bound at view.
 */
export function createBlankFramedTechPackPage(workspace,id,afterId,defaults=[],headerOptions={}){
  const next=insertCustomTechPackPage(workspace,id,afterId,MINIMAL_FRAMED_TECHPACK.name,defaults)
  const orientation=workspace.orientation==='landscape'?'landscape':'portrait'
  const paperSize=workspace.paperSize==='A4'?'A4':'Letter'
  const existingHeaderTable=Object.values(workspace.pageBoxes||{}).flat().find(box=>
    box.slot?.templateRole==='shared-header')?.slot?.spreadsheetTable
  return {...next,pages:{...next.pages,[id]:{...next.pages?.[id],
    title:'TECHNICAL DETAILS',subtitle:'',minimalFramedTemplate:true,
    paperSize,orientation,headerPreset:'seville'}},
    pageBoxes:{...next.pageBoxes,[id]:[createFramedHeaderBox(id,{
      ...headerOptions,orientation,paperSize,...(existingHeaderTable?{existingHeaderTable}:{})})]},
    // Source data, assets and saved document edits are left untouched.
  }
}

/** Restyle an existing *blank custom* page with the same outer frame and
 * header; preserve all authored pageBoxes / tables / references in place.
 * Not valid for source-derived built-in factory pages.
 */
export function applyBlankFramedTechPackPage(workspace,id){
  if(!workspace.customPages?.some(page=>page.id===id))throw new Error('Choose a custom artboard to apply a blank frame')
  const previous=workspace.pages?.[id]||{}
  const boxes=workspace.pageBoxes?.[id]||[]
  return {...workspace,pageBoxes:{...workspace.pageBoxes,[id]:boxes.some(box=>box.slot?.templateRole==='shared-header')?
    boxes:[createFramedHeaderBox(id,{orientation:workspace.orientation||previous.orientation||'portrait',
      paperSize:workspace.paperSize||previous.paperSize||'Letter'}),...boxes]},
    pages:{...workspace.pages,[id]:{...previous,minimalFramedTemplate:true,
    paperSize:workspace.paperSize||previous.paperSize||'Letter',orientation:workspace.orientation||previous.orientation||'portrait',
    headerPreset:previous.headerPreset||'seville'}}}
}

/** Explicit one-time clean slate. Archives old layouts without touching
 * garment geometry, measurement sources or the project asset library.
 */
export function startFreshFramedTechPack(workspace={},id='custom-clean-start',headerOptions={}){
  const pageKeys=['customPages','pageOrder','pages','pageBoxes','tables','boardObjects',
    'pageAssets','annotations','cells','extraRows','hiddenObjects','lockedObjects','vectorObjects','reviewNotes']
  const prior={}
  for(const key of pageKeys)if(workspace[key]!=null)prior[key]=workspace[key]
  const next={...workspace}
  for(const key of pageKeys)delete next[key]
  next.factoryPagesHidden=true
  next.cleanStartVersion=1
  next.previousTechPackLayout=prior
  return createBlankFramedTechPackPage(next,id,'',[],headerOptions)
}

export function synchronizeFramedHeaderTables(workspace={},pageId,editedTable){
  const boxes=workspace.pageBoxes||{}
  if(!Array.isArray(editedTable?.columns)||!Array.isArray(editedTable?.rows))return workspace
  return {...workspace,pageBoxes:Object.fromEntries(Object.entries(boxes).map(([id,items])=>[id,
    !Array.isArray(items)||id===pageId?items:items.map(box=>{
      if(box.slot?.templateRole!=='shared-header')return box
      const previous=box.slot?.spreadsheetTable
      if(!Array.isArray(previous?.rows)||!Array.isArray(previous?.columns))return box
      // The last merged band is the *page-specific* section heading.
      // Copy shared metadata, column labels and styling across pages while
      // keeping each document's own title and persistent table identity.
      const titleRow=editedTable.kind==='framed-header'&&editedTable.columns.length===10?2:3
      const rows=editedTable.rows.map((row,index)=>index===titleRow&&previous.rows[titleRow]?
        previous.rows[titleRow]:JSON.parse(JSON.stringify(row)))
      return {...box,slot:{...box.slot,spreadsheetTable:{...JSON.parse(JSON.stringify(editedTable)),
        id:previous.id,pageId:id,boxId:box.id,rows}}}
    })]))}
}

export function restorePreviousTechPackPages(workspace={}){
  const saved=workspace.previousTechPackLayout
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return workspace
  return {...workspace,...saved,factoryPagesHidden:false,cleanStartVersion:1,
    previousTechPackLayout:null}
}

/** First run of the redesign migrates the selected active document exactly
 * once; later documents with already-authored pages are never auto-reset.
 */
export function shouldInitializeFreshTechPack(workspace={},oneTimeReset=false){
  if(workspace.cleanStartVersion===1)return false
  return oneTimeReset===true||(!(workspace.customPages?.length)&&!(workspace.pageOrder?.length))
}

/** Existing clean-start documents may still carry the first 5-column header.
 * Upgrade ONLY that explicit legacy framed-header signature to the 10-column
 * Mikristian reference grid. Save the original table in the slot for recovery
 * and retain every authored identification value in its corresponding cell.
 * The old REV. field is not silently reinterpreted as a calendar date.
 */
export function upgradeLegacyFramedHeaders(workspace={}){
  let changed=false
  const boxes=Object.fromEntries(Object.entries(workspace.pageBoxes||{}).map(([pageId,items])=>[
    pageId,!Array.isArray(items)?items:items.map(box=>{
      const old=box?.slot?.spreadsheetTable
      if(box?.slot?.templateRole!=='shared-header'||old?.kind!=='framed-header'||
        old.columns?.length!==5||old.rows?.length!==4)return box
      const cell=(r,c)=>String(old.rows?.[r]?.cells?.[old.columns[c]?.id]?.input??
        old.rows?.[r]?.cells?.[old.columns[c]?.id]?.value??'')
      const values={season:cell(0,0),sku:cell(0,1),category:cell(0,2),
        fabric:cell(0,3),brand:cell(2,0),name:cell(2,1),size:cell(2,2),
        material:cell(2,3)}
      const fresh=createFramedHeaderTable({headerFields:values,title:cell(3,0)||'TECHNICAL DETAILS'})
      changed=true
      return {...box,x:26,y:34,width:560,height:72,
        slot:{...box.slot,legacyFramedHeader:JSON.parse(JSON.stringify(old)),
          legacyRevision:cell(0,4),legacyIssue:cell(2,4),
          spreadsheetTable:{...fresh,id:old.id,pageId,boxId:box.id}}}
    })
  ]))
  return changed?{...workspace,pageBoxes:boxes,framedHeaderDesignVersion:2}:workspace
}

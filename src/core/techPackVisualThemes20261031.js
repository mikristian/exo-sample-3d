import {TECHPACK_THEMES} from './techPackTemplatePresets.js'
import {TECHPACK_TABLE_GALLERY} from './techpack-spreadsheet/techPackTableGallery20261030.js'
import {STUDIO_THEME_PRESETS} from './studioThemePresets.js'

// Every composition uses the canonical ten columns and keeps the authored
// identification values at their original row/column coordinates.
const recipes=[
 ['mikristian-reference','Mikristian original','Classic ruled identification and full gray band','#ededed','#191919','#ffffff','#171717','full','wide',21,24,22,'left'],
 ['atelier-minimal','Atelier minimal','Hairline rules, generous paper and understated heading','#f8f7f4','#242424','#ffffff','#888078','full','wide',26,26,28,'left'],
 ['technical-blue','Technical blueprint','Strong navy title with compact technical rows','#244d70','#ffffff','#eff5fb','#54788f','full','wide',18,18,30,'center'],
 ['forest-study','Forest editorial','Sage information strips and inset section label','#345c50','#ffffff','#f2f8f4','#648e78','split','narrow',24,24,28,'left'],
 ['oxblood-atelier','Oxblood atelier','Wide couture title and warm identification grid','#79343d','#ffffff','#fff6f7','#a56d74','full','wide',25,25,36,'center'],
 ['graphite-reverse','Graphite reverse','Strong black title band, quiet information cells','#252a2e','#ffffff','#f3f3f3','#3b464d','full','wide',18,22,34,'center'],
 ['split-register','Split register','Divided section title and ruled right folio','#35536c','#ffffff','#f0f4f7','#658397','split','wide',21,29,28,'left'],
 ['folio-block','Folio block','Asymmetric title block with right-hand panel','#583b47','#ffffff','#fcf3f5','#956878','short','narrow',29,20,31,'left'],
 ['architectural-grid','Architectural grid','Compact information rows and spacious headline','#303c43','#ffffff','#f4f5f2','#667579','full','none',18,19,39,'center'],
 ['gallery-caption','Gallery caption','Quiet editorial heading over softly tinted paper','#f3e9d9','#29251f','#fffcf7','#b4a58e','split','wide',27,27,23,'left'],
 ['factory-dense','Factory dense','Tight production register with hard ruled title','#1d4252','#ffffff','#eaf2f4','#476778','short','wide',17,17,24,'left'],
 ['runway-ledger','Runway ledger','Tall branded caption with restrained metadata','#4a3d62','#ffffff','#f8f5fc','#80719a','full','narrow',25,30,38,'center'],
 ['modernist-panel','Modernist panel','Two-zone title treatment and balanced grid','#e0ddd3','#202c2d','#fcfbf7','#7d8986','split','none',20,27,31,'left'],
 ['industrial-inverse','Industrial inverse','Compressed identity fields with monumental label','#222b36','#ffffff','#e8edf2','#536273','short','wide',20,20,40,'center'],
 ['clay-notebook','Clay notebook','Earth-tone split heading and open record spacing','#965840','#ffffff','#fcf6ef','#b98771','split','narrow',29,29,25,'left'],
 ['archive-plate','Archive plate','Numbered-register proportions and full-width heading','#425048','#ffffff','#f3f5ee','#778578','full','none',22,32,27,'center'],
]
export const FRAMED_HEADER_PRESETS=Object.freeze(recipes.map(([id,name,description,header,text,body,border,band,nameMerge,firstHeight,secondHeight,titleHeight,titleAlign])=>Object.freeze({id,name,description,header,text,body,border,band,nameMerge,firstHeight,secondHeight,titleHeight,titleAlign})))
const safeHex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)
const copy=v=>JSON.parse(JSON.stringify(v))
const contrast=(hex)=>{
 const n=parseInt(hex.slice(1),16)
 const light=[n>>16&255,n>>8&255,n&255].map(x=>{const c=x/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4})
 return .2126*light[0]+.7152*light[1]+.0722*light[2]>.179?'#171717':'#ffffff'
}
const paletteFor=theme=>({header:theme.accent,stripe:theme.wash,text:contrast(theme.accent),body:theme.wash,bodyText:contrast(theme.wash),border:theme.line})
export function restyleFramedHeader(table,presetId){
 const preset=FRAMED_HEADER_PRESETS.find(item=>item.id===presetId)
 if(!preset)throw new RangeError('Unknown framed-header preset')
 if(table?.kind!=='framed-header'||table.columns?.length!==10||table.rows?.length!==3)
  throw new TypeError('Choose a canonical editable ten-column framed-header table')
 const rows=table.rows.map((row,i)=>({...row,height:[preset.firstHeight,preset.secondHeight,preset.titleHeight][i]}))
 // All alternate spans contain only currently empty cells. Values, formulas,
 // provenance, and the section title remain anchored to their original cells.
 const merges=[]
 if(preset.nameMerge==='wide')merges.push({r:1,c:3,rowSpan:1,colSpan:3})
 if(preset.nameMerge==='narrow')merges.push({r:1,c:3,rowSpan:1,colSpan:2})
 merges.push({r:2,c:0,rowSpan:1,colSpan:preset.band==='full'?10:preset.band==='split'?7:5})
 if(preset.band==='split')merges.push({r:2,c:7,rowSpan:1,colSpan:3})
 if(preset.band==='short')merges.push({r:2,c:5,rowSpan:1,colSpan:5})
 const styles={...(table.cellStyles||{})}
 rows.forEach((row,r)=>table.columns.forEach((_,c)=>{
   const key=`${row.id}:${c}`
   const onBand=r===2&&(preset.band==='full'||c< (preset.band==='split'?7:5))
   const bg=onBand?preset.header:r===0&&preset.id==='graphite-reverse'?preset.header:preset.body
   styles[key]={...(styles[key]||{}),bold:r===2||c%2===0,
     align:r===2?preset.titleAlign:'left',background:bg,
     color:contrast(bg),fontSize:r===2?(preset.titleHeight>=35?13:11):preset.firstHeight<=20?9:10}
 }))
 return {...table,rows,mergedCells:merges,cellStyles:styles,
   tableStyle:{...table.tableStyle,theme:'custom',header:preset.header,
     stripe:preset.body,text:contrast(preset.header),body:preset.body,
     bodyText:contrast(preset.body),border:preset.border},framedHeaderPreset:presetId}
}
export function applyFramedHeaderPreset(workspace,pageId,id){
 let found=false
 const boxes=(workspace.pageBoxes?.[pageId]||[]).map(box=>{
   if(box.slot?.templateRole!=='shared-header'||!box.slot.spreadsheetTable)return box
   found=true
   const table=restyleFramedHeader(box.slot.spreadsheetTable,id)
   // The authored sheet content begins at y=132. A default header at y=34
   // therefore has at most 98px available; cap at 94px for breathing room.
   const nextHeight=Math.max(72,Math.min(94,table.rows.reduce((sum,row)=>sum+row.height,0)))
   const previousAuto=Number.isFinite(box.autoFramedHeaderHeight)&&box.height===box.autoFramedHeaderHeight
   const defaultHeight=box.height===72&&box.autoFramedHeaderHeight==null
   const canAutoSize=(previousAuto||defaultHeight)&&Number.isFinite(box.y)&&box.y+nextHeight<=128
   return {...box,...(canAutoSize?{height:nextHeight,autoFramedHeaderHeight:nextHeight}:{}),
     slot:{...box.slot,spreadsheetTable:table}}
 })
 if(!found)throw new RangeError('Select a framed Tech Pack artboard with an editable header')
 return {...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:boxes}}
}
export function applyTechPackColorTheme(workspace,themeId,{pageId=null,scope='all'}={}){
 const theme=TECHPACK_THEMES.find(item=>item.id===themeId)
 if(!theme)throw new RangeError('Unknown Tech Pack theme')
 if(scope!=='all'&&scope!=='page')throw new RangeError('Unknown theme scope')
 if(scope==='page'&&(typeof pageId!=='string'||!pageId))throw new RangeError('Choose a page')
 const ids=scope==='all'?new Set([...Object.keys(workspace.pages||{}),...Object.keys(workspace.pageBoxes||{})]):new Set([pageId])
 const pageBoxes={...workspace.pageBoxes}
 const palette=paletteFor(theme)
 for(const id of ids){
  pageBoxes[id]=(pageBoxes[id]||[]).map(box=>{
   const table=box.slot?.spreadsheetTable
   const tinted={...box,background:theme.wash,lineColor:theme.line,
     ...(box.slot?.spreadsheetTable?{}:{})}
   if(!table||!Array.isArray(table.columns)||!Array.isArray(table.rows))return tinted
   const cloned=copy(table)
   cloned.tableStyle={...cloned.tableStyle,theme:'custom',...palette}
   cloned.cellStyles={...(cloned.cellStyles||{})}
   cloned.rows.forEach((row,r)=>cloned.columns.forEach((_,c)=>{
     const key=`${row.id}:${c}`
     const existing=cloned.cellStyles[key]||{}
     const isBand=box.slot?.templateRole==='shared-header'&&r===cloned.rows.length-1
     const bg=isBand||(!isBand&&r===0&&box.slot?.templateRole!=='shared-header')?theme.accent:theme.wash
     cloned.cellStyles[key]={...existing,background:bg,color:contrast(bg)}
   }))
   return {...tinted,slot:{...box.slot,spreadsheetTable:cloned}}
  })
 }
 const pageTheme={accent:theme.accent,line:theme.line,wash:theme.wash,
   background:theme.wash,text:contrast(theme.wash),headerText:contrast(theme.accent)}
 const pages={...workspace.pages}
 for(const id of ids)pages[id]={...pages[id],templateTheme:themeId,templateColors:pageTheme}
 return {...workspace,pageBoxes,pages,
   ...(scope==='all'?{templateTheme:themeId,templateColors:pageTheme,
     visualTheme:{...workspace.visualTheme,id:themeId,...pageTheme}}:{})}
}
export const FRAMED_TABLE_GALLERY=TECHPACK_TABLE_GALLERY
export const isTechPackThemeColor=safeHex

// Studio chrome palettes are shared with the document picker, while their
// printable colors remain explicit and independent of application chrome.
const curatedPages=[
 ['paper-ivory','Ivory drafting','Light', '#faf7ed','#e8e1d2','#ffffff','#fffdf8','#b1a793','#342e28'],
 ['paper-porcelain','Porcelain technical','Light','#ffffff','#ecf1f4','#ffffff','#f8fbfc','#a4b4bf','#244963'],
 ['paper-sage','Sage atelier','Light','#f3f7f0','#dce9dd','#ffffff','#f9fcf7','#8aa396','#315a48'],
 ['paper-rose','Rose archive','Light','#fff7f5','#f7e6e2','#ffffff','#fffaf8','#bd968f','#774840'],
 ['paper-sand','Sandstone studio','Light','#f8f2e6','#ede1d0','#fffefa','#f9f4e9','#b6a387','#73533b'],
 ['paper-slate','Slate architectural','Light','#edf2f5','#dfe7ed','#ffffff','#f4f8fa','#879aaa','#304c60'],
 ['paper-ink','Ink drafting','Dark','#20272e','#303a44','#27323b','#29333c','#718594','#d2e6f2'],
 ['paper-charcoal','Charcoal atelier','Dark','#252525','#363636','#2d2d2d','#303030','#858585','#f0e3d2'],
 ['paper-navy','Navy night','Dark','#192538','#293950','#223046','#26354a','#7187a6','#b9d7f4'],
 ['paper-forest','Forest night','Dark','#1e3029','#2b4439','#263b32','#294035','#739988','#c4e6d0'],
]
export const TECHPACK_PRINT_PALETTES=Object.freeze(curatedPages.map(([id,name,category,background,table,body,header,line,accent])=>Object.freeze({id,name,category,background,table,body,header,line,accent,wash:table})))
export const TECHPACK_STUDIO_PALETTES=Object.freeze(STUDIO_THEME_PRESETS.map(p=>Object.freeze({
 id:`studio:${p.id}`,name:p.name,category:p.category,
 accent:p.accent,line:p.borderColor,wash:(p.mode==='light'||contrast(p.panelColor)==='#171717')?p.panelColor:'#f5f6f7',
 background:(p.mode==='light'||contrast(p.panelColor)==='#171717')?p.panelColor:'#ffffff',
 header:p.accent,table:(p.mode==='light'||contrast(p.panelColor)==='#171717')?p.panelColor:'#f5f6f7',body:'#ffffff'
})))

const FACTORY_HEADER_FILLS=new Set(['#ffffff','#ededed','#eeeeee'])
const FACTORY_BOX_FILLS=new Set(['#ffffff','#ededed','#eeeeee','#f5f5f5','#f8f8f8'])

export const TECHPACK_COLOR_FIELDS=Object.freeze([
 {key:'background',label:'Page background'},
 {key:'header',label:'Header fill'},
 {key:'table',label:'Table cells'},
 {key:'body',label:'Content panels'},
 {key:'line',label:'Rules and borders'},
 {key:'accent',label:'Accent'}
])

export function resolveTechPackPalette(id){
 const printable=TECHPACK_PRINT_PALETTES.find(item=>item.id===id)
 if(printable)return printable
 const studio=TECHPACK_STUDIO_PALETTES.find(item=>item.id===id)
 if(studio)return studio
 const legacy=TECHPACK_THEMES.find(item=>item.id===id)
 if(!legacy)throw new RangeError('Unknown Tech Pack palette')
 return {...legacy,background:legacy.wash,header:legacy.accent,table:legacy.wash,body:legacy.wash}
}

export function applyTechPackPaletteOverrides(workspace,overrides,{scope='page',pageId,preserveManual=true,paletteId=null}={}){
 if(scope!=='all'&&scope!=='page')throw new RangeError('Unknown palette scope')
 if(scope==='page'&&(!pageId||typeof pageId!=='string'))throw new RangeError('Choose a page')
 const allowed=new Set(TECHPACK_COLOR_FIELDS.map(item=>item.key))
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw new TypeError('Expected color overrides')
 const colors={}
 for(const [key,value] of Object.entries(overrides)){
  if(!allowed.has(key)||!safeHex(value))throw new RangeError(`Invalid Tech Pack color: ${key}`)
  colors[key]=value
 }
 const ids=scope==='all'?new Set([...Object.keys(workspace.pages||{}),...Object.keys(workspace.pageBoxes||{})]):new Set([pageId])
 const pages={...workspace.pages},pageBoxes={...workspace.pageBoxes}
 for(const id of ids){
  const prior=pages[id]?.templateColors||workspace.templateColors||{}
  const merged={...prior,...colors,...('table' in colors?{wash:colors.table}:{}),...('header' in colors?{headerText:contrast(colors.header)}:{})}
  pages[id]={...pages[id],templateColors:merged,...(paletteId?{templateTheme:paletteId}:{})}
  pageBoxes[id]=(pageBoxes[id]||[]).map(box=>{
   const role=box.slot?.templateRole
   const isHeader=role==='shared-header'
   const next={...box}
   const fill=isHeader?colors.header:colors.body
   if(fill&&(!preserveManual||!box.background||FACTORY_BOX_FILLS.has(String(box.background).toLowerCase())||box.background===prior.body||box.background===prior.wash||box.background===prior.header||box.background===box.techPackPaletteBackground)){
    next.background=fill
    next.techPackPaletteBackground=fill
   }
   if(colors.line&&(!preserveManual||!box.lineColor||box.lineColor===prior.line||box.lineColor===box.techPackPaletteLine)){
    next.lineColor=colors.line
    next.techPackPaletteLine=colors.line
   }
   const table=box.slot?.spreadsheetTable
   if(!table?.rows||!table?.columns)return next
   const copyTable={...table,tableStyle:{...table.tableStyle},cellStyles:{...table.cellStyles}}
   const oldGenerated=table.techPackPaletteGenerated||{}
   const tableFill=isHeader?(colors.header||colors.table):colors.table
   const generated={...oldGenerated}
   if(tableFill){
    copyTable.tableStyle={...copyTable.tableStyle,theme:'custom',...(isHeader?{header:tableFill}:{body:tableFill,stripe:tableFill}),...(colors.line?{border:colors.line}:{})}
    for(const row of table.rows)for(let c=0;c<table.columns.length;c++){
     const key=`${row.id}:${c}`,style=table.cellStyles?.[key]||{}
     const owned=oldGenerated[key]
     const factoryHeader=isHeader&&FACTORY_HEADER_FILLS.has(String(style.background||'').toLowerCase())
     const factoryFill=FACTORY_BOX_FILLS.has(String(style.background||'').toLowerCase())
     if(preserveManual&&style.background&&style.background!==owned?.background&&!factoryHeader&&!factoryFill)continue
     // In canonical headers the bottom title band is the only colored band.
     // Other cells take the table fill, retaining the factory white body by default.
     const cellFill=isHeader&&row===table.rows[table.rows.length-1]
       ?(colors.header||owned?.background||style.background||'#ededed')
       :isHeader?(colors.table||((owned?.background&&owned.background!=='#ededed')?owned.background:'#ffffff')):tableFill
     const nextStyle={...style,background:cellFill,color:contrast(cellFill)}
     copyTable.cellStyles[key]=nextStyle
     generated[key]={background:cellFill}
    }
   }else if(colors.line)copyTable.tableStyle.border=colors.line
   copyTable.techPackPaletteGenerated=generated
   next.slot={...box.slot,spreadsheetTable:copyTable}
   return next
  })
 }
 return {...workspace,pages,pageBoxes,...(scope==='all'?{
  templateColors:{...workspace.templateColors,...colors,...('table' in colors?{wash:colors.table}:{})},
  ...(paletteId?{templateTheme:paletteId}:{}),visualTheme:{...workspace.visualTheme,...colors,...(paletteId?{id:paletteId}:{})}
 }: {})}
}

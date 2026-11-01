import {createCustomTechPackTable} from './customTableDesign20261030.js'
import {normalizedMergedCells} from './mergedCells20261030.js'

// All samples are authored labels. Measurements, tolerances, quantities and sizes
// must be entered by the designer or confirmed by the manufacturer.
const recipes=[
 ['pattern-cutlist','Pattern room','Pattern piece cutting register','Cut quantities, grain, fold and piece approval',['Pattern ID','Component / name','Material','Cut qty','Fold / pair','Grain / nap','Seam allowance','Notches / approval'],['Front body','Back body','Left sleeve','Right sleeve','Neck rib','Facing / reinforcement']],
 ['pattern-notches','Pattern room','Notches and drill marks','Correspondence and hole coordinates',['Piece','Edge / seam ID','Notch type','Measured position','Match / balance','Drill hole','Cut direction','Approval'],['Front armhole','Back armhole','Shoulder','Sleeve cap','Side seam','Hem']],
 ['pattern-seam-allowance','Pattern room','Seam and hem allowance register','Cutline allowances by source edge',['Pattern piece','Edge / seam','Allowance (mm)','Seam / finish','Fold / hem depth','Taped or bound','Exception','Review'],['Neck seam','Shoulder seam','Sleeve armhole','Side seam','Sleeve hem','Bottom hem']],
 ['cutting-plan','Pattern room','Cutting and marker plan','Piece cut counts, ply, nap, marker and yield',['Piece','Fabric','Sizes','Total units','Ply','Nap','Marker ref','Cut signoff'],['Body front','Body back','Sleeve','Rib trim','Interfacing']],
 ['costing','Finance','Production costing worksheet','Quoted unit economics, consumption and landed costs',['Item','Description','Unit','Quantity','Unit cost','Extended cost','Currency','Approval'],['Main fabric','Rib / trim','Sewing labor','Print / embellishment','Packaging','Overhead','Freight','Total']],
 ['source-verification','Administration','Source and approval register','Distinguishes source evidence from illustrative inputs',['Specification field','Source filename / revision','Type','Exact value','Sample-only value','Confirmation owner','Approved?'],['Pattern geometry','Fabric composition','Grading','Artwork rights','Manufacturing method','Fit approval']],
 ['size-chart','Sizing','Size chart','Finished garment size overview',['Size','Chest','Waist','Hip','Body length','Sleeve length'],['XS','S','M','L','XL']],
 ['measurement-matrix','Measurements','Multi-size POM chart','Measurements and tolerances across sizes',['POM','Measurement point','Tolerance','XS','S','M','L','XL'],['Chest width','Body length','Shoulder width','Sleeve length','Hem width','Neck opening']],
 ['pom-spec','Measurements','POM measurement specification','Points of measure and inspection',['POM code','Measurement point','How to measure','Target','Tolerance','Notes'],['POM A','POM B','POM C','POM D','POM E','POM F']],
 ['grading','Measurements','Grading rules','Size increment instructions',['POM code','Measurement point','Base size','Grade down','Grade up','Notes'],['POM A','POM B','POM C','POM D','POM E']],
 ['bom','Materials','Bill of materials','Materials and production components',['Item','Material / description','Placement','Color','Consumption','Supplier','Notes'],['Shell fabric','Lining','Thread','Closure','Main label','Care label','Packaging']],
 ['colorways','Materials','Colorways','Approved colors and combinations',['Colorway','Body color','Contrast color','Trim color','Pantone / reference','Approval'],['Colorway A','Colorway B','Colorway C','Colorway D']],
 ['construction','Production','Construction operations','Sewing and assembly instructions',['Step','Operation','Location','Machine','Method','QC checkpoint'],['Preparation','Front assembly','Back assembly','Sleeve assembly','Side seams','Finishing']],
 ['stitch-seam','Production','Stitch and seam specifications','Seam construction reference',['Location','Seam type','Stitch type','SPI','Thread','Allowance','Notes'],['Shoulder','Armhole','Side seam','Hem','Neckline']],
 ['care-label','Labels','Care label information','Artwork and compliance review',['Field','Required wording / icon','Language','Placement','Approval'],['Fiber content','Washing','Bleaching','Drying','Ironing','Country of origin']],
 ['quality-control','Quality','Quality control checklist','Inspection checkpoints',['Checkpoint','Inspection method','Acceptance criteria','Result','Inspector','Notes'],['Fabric appearance','Seam quality','Measurement check','Trim attachment','Label accuracy','Final appearance']],
 ['packing','Production','Packing instructions','Folding and carton requirements',['Step','Packing item','Method / instruction','Quantity','Reference','Notes'],['Fold garment','Tissue / insert','Individual bag','Barcode label','Carton grouping','Carton marking']],
 ['trim-labels','Materials','Trim and label specification','Trim placement and approval',['Trim item','Artwork / reference','Material','Placement','Dimensions','Color','Approval'],['Main label','Size label','Care label','Hangtag','Closure','Brand patch']],
 ['revision-log','Administration','Revision log','Document change tracking',['Revision','Date','Section','Change description','Requested by','Approved by'],['Initial issue','Measurement update','Materials update','Construction update','Approval update']],
 ['blank','General','Blank specification table','Empty structure for a new table',['Item','Description','Reference','Specification','Status','Notes'],['Item A','Item B','Item C','Item D']],
 ['fabric-spec','Materials','Fabric specification','Fabric construction and evaluation',['Fabric','Composition','Construction','Weight','Finish','Test / standard','Approval'],['Shell','Lining','Rib / binding','Interfacing','Pocketing']],
 ['size-run','Sizing','Size range matrix','Size range planning by style and color',['Style','Colorway','XS','S','M','L','XL','Notes'],['Style A','Style B','Style C','Style D']],
 ['size-conversion','Sizing','Size conversion guide','Regional size correspondence to be specified',['Size system','XS','S','M','L','XL','Notes'],['Brand size','US','EU','UK','Asia']],
 ['colorway-materials','Materials','Colorway material matrix','Materials and trim references by colorway',['Component','Colorway A','Colorway B','Colorway C','Colorway D','Reference'],['Shell','Lining','Thread','Ribbing','Hardware','Labels']],
 ['colorway-approval','Quality','Colorway approval log','Sample review and color approvals',['Colorway','Reference','Lab dip','Sample review','Decision','Reviewer','Date'],['Colorway A','Colorway B','Colorway C','Colorway D']],
 ['embellishment-placement','Artwork','Embellishment placement','Location and application instructions',['Artwork / trim','Garment panel','Placement reference','Offset / dimension','Technique','Approval'],['Front artwork','Back artwork','Sleeve artwork','Neck artwork','Hem artwork']],
 ['print-artwork','Artwork','Print artwork specification','Artwork files and production techniques',['Artwork','File reference','Technique','Color reference','Scale / dimensions','Placement','Status'],['Front print','Back print','Sleeve print','Inside print','Special finish']],
 ['embroidery','Artwork','Embroidery detail','Embroidery application and stitch specifications',['Motif','File reference','Location','Thread colors','Stitch / technique','Dimensions','Approval'],['Front motif','Back motif','Sleeve motif','Patch motif']],
 ['fit-approval','Fit','Fit sample approval','Fit comments and decision tracking',['Sample stage','Size','Review point','Observation','Action required','Decision','Date'],['Proto sample','Fit sample','Revised sample','Preproduction sample']],
 ['fit-comments','Fit','Fit correction log','Requested corrections with follow-up',['Area','Issue / observation','Requested correction','Assigned to','Recheck','Status'],['Neckline','Shoulder','Chest','Sleeve','Hem','Overall silhouette']],
 ['garment-spec','Measurements','Garment specification summary','Core construction and garment attributes',['Attribute','Specification','Location','Reference','Tolerance','Status'],['Silhouette','Fit','Fabrication','Neckline','Sleeve','Hem','Closure']],
 ['wash-testing','Testing','Wash and care test log','Record test methods and observed outcomes',['Test','Method / standard','Sample','Conditions','Result','Acceptance criteria','Review'],['Dimensional stability','Colorfastness','Appearance after wash','Seam durability','Pilling']],
 ['performance-testing','Testing','Performance test matrix','Record independent test criteria and results',['Test','Standard','Material / sample','Required result','Actual result','Lab / date','Status'],['Abrasion','Tensile strength','Tear strength','Color migration','Seam slippage']],
 ['packaging-spec','Packaging','Packaging specification','Primary and secondary pack details',['Item','Material','Dimensions','Print / artwork','Placement','Supplier','Approval'],['Polybag / alternative','Tissue / wrap','Hangtag','Barcode','Inner carton','Master carton']],
 ['carton-assortment','Packaging','Carton assortment matrix','Size and color packing allocation',['Carton type','Colorway','XS','S','M','L','XL','Total'],['Carton A','Carton B','Carton C','Carton D']],
 ['compliance-review','Compliance','Compliance review checklist','Applicable standards and document review',['Requirement','Market / region','Reference / standard','Evidence','Owner','Review status'],['Fiber labeling','Care labeling','Country of origin','Product safety','Restricted substances','Packaging labels']],
 ['restricted-substances','Compliance','Restricted substance review','Material testing and evidence collection',['Material / component','Requirement','Test method','Certificate / report','Expiry / date','Review'],['Shell fabric','Lining','Dye / print','Hardware','Coating','Packaging']],
 ['sample-tracker','Administration','Sample tracking','Track sample rounds and outstanding decisions',['Sample stage','Request date','Received date','Size / colorway','Reviewer','Status','Notes'],['Proto','Fit','Salesman','Preproduction','Production']],
 ['production-handoff','Production','Production handoff checklist','Confirm readiness before factory release',['Deliverable','Version / reference','Prepared by','Reviewed by','Status','Notes'],['Final patterns','Grade rules','BOM','Artwork files','Labels','Packing instructions']]
]

export const TECHPACK_TABLE_GALLERY=Object.freeze(recipes.map(([id,category,name,description,headings,labels])=>Object.freeze({
 id,category,name,description,headings:Object.freeze([...headings]),rowLabels:Object.freeze([...labels]),theme:'technical'
})))

export const TECHPACK_HEADER_GALLERY=Object.freeze([
 {id:'title-band',name:'Centered title band',description:'Full-width merged title',rows:1,merge:true,align:'center',background:'#24364b',color:'#ffffff'},
 {id:'section-band',name:'Section heading',description:'Full-width subsection label',rows:1,merge:true,align:'left',background:'#e7edf4',color:'#24364b'},
 {id:'dark-banner',name:'Dark specification banner',description:'Contrasting merged section title',rows:1,merge:true,align:'left',background:'#182b42',color:'#ffffff'},
 {id:'light-banner',name:'Light title banner',description:'Soft neutral title',rows:1,merge:true,align:'center',background:'#f0f2f5',color:'#252e3a'},
 {id:'accent-band',name:'Blue accent heading',description:'Bold blue title strip',rows:1,merge:true,align:'left',background:'#dceafa',color:'#16436f'},
 {id:'minimal',name:'Minimal column headings',description:'Emphasized column labels, no extra row',rows:0,merge:false,align:'left',background:'#ffffff',color:'#24364b'},
 {id:'compact',name:'Compact technical headings',description:'Compact headings, no extra row',rows:0,merge:false,align:'center',background:'#edf0f3',color:'#24364b'},
 {id:'double-heading',name:'Title and subsection',description:'Merged title followed by section row',rows:2,merge:true,align:'center',background:'#24364b',color:'#ffffff'},
 {id:'ink-banner',name:'Ink banner',description:'Deep charcoal title strip',rows:1,merge:true,align:'left',background:'#171e29',color:'#f8fafc'},
 {id:'slate-heading',name:'Slate heading',description:'Subtle blue-gray heading',rows:1,merge:true,align:'left',background:'#dbe2ea',color:'#263646'},
 {id:'sage-heading',name:'Sage heading',description:'Muted green review header',rows:1,merge:true,align:'left',background:'#dbe9df',color:'#244b38'},
 {id:'sand-heading',name:'Sand heading',description:'Warm neutral section header',rows:1,merge:true,align:'left',background:'#f2eadf',color:'#654a30'},
 {id:'plum-banner',name:'Plum banner',description:'Rich muted plum title',rows:1,merge:true,align:'center',background:'#47374b',color:'#ffffff'},
 {id:'ice-columns',name:'Ice column headings',description:'Lightweight cool header cells',rows:0,merge:false,align:'center',background:'#e5f3f7',color:'#20536a'},
 {id:'graphite-columns',name:'Graphite column headings',description:'High contrast compact column labels',rows:0,merge:false,align:'left',background:'#364150',color:'#ffffff'},
 {id:'review-heading',name:'Review and status heading',description:'Two-tier title and review subtitle',rows:2,merge:true,align:'left',background:'#234a5e',color:'#ffffff'}
].map(item=>Object.freeze(item)))

const copy=value=>JSON.parse(JSON.stringify(value))
const plain=(value,max=80)=>String(value??'').slice(0,max)
const authoredCell=value=>({input:value,value,origin:'authored',provenance:{kind:'authored'}})
const requireTable=table=>{
 if(!table||!Array.isArray(table.columns)||!Array.isArray(table.rows)||table.columns.length<1||table.columns.length>50||table.rows.length>100)
  throw new TypeError('A bounded canonical table is required')
 normalizedMergedCells(table)
}

export function createTechPackGalleryTable(id,{title}={}){
 const preset=TECHPACK_TABLE_GALLERY.find(item=>item.id===id)
 if(!preset)throw new RangeError(`Unknown tech pack gallery ID: ${id}`)
 const table=createCustomTechPackTable({name:plain(title??preset.name),headings:[...preset.headings],rows:preset.rowLabels.length,theme:preset.theme})
 for(let i=0;i<preset.rowLabels.length;i++){
  const col=table.columns[0].id
  table.rows[i].cells[col]=authoredCell(preset.rowLabels[i])
 }
 return {...table,kind:'gallery',galleryPreset:id,sourceLinked:false,mergedCells:[],cellStyles:{}}
}

export function applyTechPackHeaderPreset(table,id,{label}={}){
 requireTable(table)
 const recipe=TECHPACK_HEADER_GALLERY.find(item=>item.id===id)
 if(!recipe)throw new RangeError(`Unknown tech pack header ID: ${id}`)
 if(table.rows.length+recipe.rows>100)throw new RangeError('Header exceeds 100-row table limit')
 const result=copy(table)
 result.cellStyles={...(result.cellStyles||{})}
 if(recipe.rows===0){
  result.tableStyle={...(result.tableStyle||{}),theme:'custom',header:recipe.background,text:recipe.color}
  result.headerPreset=id
  return result
 }
 const title=plain(label??result.title??'Specification')
 const rows=Array.from({length:recipe.rows},(_,index)=>{
  let suffix=0
  while(result.rows.some(row=>row.id===`gallery-heading-${index}-${suffix}`))suffix++
  const rowId=`gallery-heading-${index}-${suffix}`
  const cells=Object.fromEntries(result.columns.map((col,colIndex)=>[col.id,authoredCell(colIndex===0?(index===0?title:'Section'):'')]))
  return {id:rowId,cells,provenance:{kind:'authored'}}
 })
 result.rows=[...rows,...result.rows]
 result.mergedCells=[...(result.mergedCells||[]).map(merge=>({...merge,r:merge.r+recipe.rows}))]
 if(result.columns.length>1)for(let index=0;index<recipe.rows;index++)result.mergedCells.push({r:index,c:0,rowSpan:1,colSpan:result.columns.length})
 normalizedMergedCells(result)
 rows.forEach((row,i)=>{
  result.cellStyles[`${row.id}:0`]={bold:true,align:recipe.align,background:i===1?'#e7edf4':recipe.background,color:i===1?'#24364b':recipe.color}
 })
 result.headerPreset=id
 result.headerPresetSnapshot={
  rowIds:rows.map(row=>row.id),
  rows:copy(rows),
  styles:copy(Object.fromEntries(rows.map(row=>[row.id,result.cellStyles[`${row.id}:0`]]))),
  merges:copy(result.mergedCells.filter(merge=>merge.r<recipe.rows))
 }
 return result
}

/** Replace a gallery-owned heading only when its original cells and layout remain intact. */
export function replaceTechPackHeaderPreset(table,id,{label}={}){
 requireTable(table)
 if(!TECHPACK_HEADER_GALLERY.some(preset=>preset.id===id))
  throw new RangeError(`Unknown tech pack header ID: ${id}`)
 if(!table.headerPreset)return applyTechPackHeaderPreset(table,id,{label})
 const previous=TECHPACK_HEADER_GALLERY.find(preset=>preset.id===table.headerPreset)
 if(!previous)throw new RangeError('Unknown existing tech pack header preset')
 const result=copy(table)
 const snapshot=result.headerPresetSnapshot
 if(previous.rows){
  // Older gallery headings do not carry a trustworthy snapshot of their original
  // label and cell values. Removing them could erase a user's changes.
  if(!snapshot||!Array.isArray(snapshot.rowIds)||snapshot.rowIds.length!==previous.rows)
   throw new RangeError('Cannot safely replace heading without original snapshot')
  const headingRows=result.rows.slice(0,previous.rows)
  if(headingRows.length!==previous.rows||headingRows.some((row,i)=>row.id!==snapshot.rowIds[i]||JSON.stringify(row)!==JSON.stringify(snapshot.rows?.[i])))
   throw new RangeError('Heading rows have been edited')
  const headingIds=new Set(snapshot.rowIds)
  for(const [key,style] of Object.entries(result.cellStyles||{})){
   const split=key.lastIndexOf(':')
   if(headingIds.has(key.slice(0,split))&&(key.slice(split+1)!=='0'||JSON.stringify(style)!==JSON.stringify(snapshot.styles?.[key.slice(0,split)])))
    throw new RangeError('Heading styles have been edited')
  }
  const headingMerges=result.mergedCells?.filter(merge=>merge.r<previous.rows)||[]
  if(JSON.stringify(headingMerges)!==JSON.stringify(snapshot.merges)||headingMerges.some(merge=>merge.r+merge.rowSpan>previous.rows))
   throw new RangeError('Heading merges have been edited')
  result.rows.splice(0,previous.rows)
  result.mergedCells=(result.mergedCells||[]).filter(merge=>merge.r>=previous.rows).map(merge=>({...merge,r:merge.r-previous.rows}))
  for(const key of Object.keys(result.cellStyles||{}))if(headingIds.has(key.slice(0,key.lastIndexOf(':'))))delete result.cellStyles[key]
 }else if(result.rows.some(row=>/^gallery-heading-/.test(row.id))){
  // A zero-row preset must not claim ownership of heading rows.
  throw new RangeError('Unexpected heading rows')
 }
 delete result.headerPreset
 delete result.headerPresetSnapshot
 return applyTechPackHeaderPreset(result,id,{label})
}

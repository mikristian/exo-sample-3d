import {TECHPACK_TABLE_GALLERY,createTechPackGalleryTable} from './techpack-spreadsheet/techPackTableGallery20261030.js'
import {createCustomTechPackTable} from './techpack-spreadsheet/customTableDesign20261030.js'

/** Frequent tables visible in the little picker on the framed artboard.
 * Static gallery labels are unapproved examples; no factory values are
 * generated or imported as if they came from the garment.
 */
export const BOTTOM_TABLE_PRESETS=Object.freeze([
  'blank','size-chart','measurement-matrix','pom-spec','grading','bom',
  'colorways','fabric-spec','stitch-seam','trim-labels','quality-control','care-label',
  'packing','print-artwork','fit-comments','revision-log','fit-approval','sample-tracker',
  'production-handoff','colorway-approval','embellishment-placement','packaging-spec',
  'costing','pattern-cutlist','pattern-notches','pattern-seam-allowance','cutting-plan',
  'source-verification','wash-testing','performance-testing','compliance-review',
  'carton-assortment','size-run','embroidery','construction'
])

export function createFramedBottomTableBox(presetId,pageId,boxId,layout={}){
  if(!BOTTOM_TABLE_PRESETS.includes(presetId)||!TECHPACK_TABLE_GALLERY.some(p=>p.id===presetId))
    throw new RangeError('Choose a recognized Tech Pack table preset')
  if(typeof pageId!=='string'||!pageId||typeof boxId!=='string'||!boxId)
    throw new TypeError('Page and table identity are required')
  const table=presetId==='blank'?createCustomTechPackTable({
    name:'Specification table',preset:'blank',rows:4,columns:3,
    headings:['REFERENCE','DETAIL','SPECIFICATION'],
    theme:{theme:'custom',header:'#eeeeee',stripe:'#ffffff',
      text:'#111111',body:'#ffffff',bodyText:'#111111',border:'#171717'}
  }):createTechPackGalleryTable(presetId)
  // Do not silently cut off a newly expanded production table. Nine rows
  // still fit at the framed foot; print pagination handles larger grids.
  const height=Math.min(240,Math.max(139,43+table.rows.length*22))
  const landscape=layout.orientation==='landscape',a4=layout.paperSize==='A4'
  const pageWidth=landscape?(a4?842:792):(a4?595:612)
  const pageHeight=landscape?(a4?595:612):(a4?842:792)
  return {id:boxId,title:table.title||'Specification table',positionMode:'absolute',
    // A fitted bottom chart shares the frame's actual left/right/bottom
    // boundaries; unlike the central artwork it has no inner side margin.
    x:26,y:pageHeight-52-height,width:pageWidth-52,height,
    border:'none',lineColor:'#171717',note:'',
    slot:{category:'tables',templateRole:'bottom-table',sourceLinked:false,
      spreadsheetTable:{...table,id:'table-'+boxId,pageId,boxId}}}
}

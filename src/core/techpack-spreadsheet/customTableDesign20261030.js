import {createTableV3} from './schemaV3.js'
import {normalizeTableStyle} from './tableAdapter.js'

export const CUSTOM_TABLE_PRESETS = Object.freeze({
  'measurement-spec': Object.freeze({name:'Measurement specification',headings:['POM','Description','Tolerance','XS','S','M','L','XL'],rows:6}),
  bom: Object.freeze({name:'Bill of materials',headings:['Component','Description','Color','Quantity','Unit','Supplier','Notes'],rows:6}),
  construction: Object.freeze({name:'Construction instructions',headings:['Operation','Seam / stitch','Machine','Allowance','Instruction','QC'],rows:6}),
  blank: Object.freeze({name:'Custom table',headings:['Column 1','Column 2','Column 3','Column 4','Column 5','Column 6','Column 7','Column 8'],rows:12}),
})

const boundedCount=(value,label,max)=>{
  if(!Number.isInteger(value)||value<1||value>max)throw new RangeError(`${label} must be an integer from 1 to ${max}`)
  return value
}
const plainText=(value,max=80)=>String(value??'').slice(0,max)
const isHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)
const clone=value=>JSON.parse(JSON.stringify(value))

/** Makes an entirely authored table; it never inherits linked garment values. */
export function createCustomTechPackTable({name='Custom table',rows,columns,headings,theme='light',header,preset='blank',template,pageId='',boxId=''}={}){
  const recipe=template==null?clone(CUSTOM_TABLE_PRESETS[preset]??(()=>{throw new Error(`Unknown table preset: ${preset}`)})()):clone(template)
  const suppliedHeadings=headings??recipe.headings??recipe.headers
  if(suppliedHeadings!=null&&!Array.isArray(suppliedHeadings))throw new TypeError('headings must be an array')
  const columnCount=boundedCount(columns??suppliedHeadings?.length??3,'columns',50)
  const rowCount=boundedCount(rows??recipe.rows??4,'rows',100)
  if(suppliedHeadings?.length>50)throw new RangeError('headings cannot exceed 50 columns')
  const labels=Array.from({length:columnCount},(_,index)=>plainText(suppliedHeadings?.[index]??`Column ${index+1}`))
  const table=createTableV3({title:plainText(name||recipe.name||'Custom table'),pageId,boxId,
    columns:labels.map((label,index)=>({id:`column-${index}`,label,type:'text',width:105})),
    rows:Array.from({length:rowCount},(_,index)=>({id:`row-${index}`,cells:Array(columnCount).fill('')}))})
  const chosenTheme=typeof theme==='string'?{theme}:theme
  const tableStyle=normalizeTableStyle(chosenTheme)
  if(typeof theme==='object'&&theme!==null){
    for(const key of ['header','stripe','text'])if(theme[key]!==undefined&&!isHex(theme[key]))throw new TypeError(`${key} must be a six-digit hex color`)
  }
  if(header!==undefined){
    if(!isHex(header))throw new TypeError('header must be a six-digit hex color')
    tableStyle.header=header
    tableStyle.theme='custom'
  }
  return {...table,name:table.title,kind:preset,sourceKind:'manual',tableStyle,needsReview:false}
}

export function createCustomTechPackTableFromPreset(preset,options={}){
  return createCustomTechPackTable({...options,preset})
}

export function applyCustomTechPackTableTheme(table,theme){
  if(!table||!Array.isArray(table.columns)||!Array.isArray(table.rows))throw new TypeError('A canonical table is required')
  const values=typeof theme==='string'?{theme}:theme
  for(const key of ['header','stripe','text'])if(values?.[key]!==undefined&&!isHex(values[key]))throw new TypeError(`${key} must be a six-digit hex color`)
  return {...table,tableStyle:normalizeTableStyle(values)}
}

// Source-linked formula recalculation using verified original Valentina <-> Seamly
// construction pairings. The actual upstream Seamly engine evaluates the entire
// tool dependency graph after a bounded, reversible formula edit.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {XMLValidator} from 'fast-xml-parser'
import {evaluateSeamly2DRequest20261023} from './seamly2dEngineRoute20261023.mjs'
import {evaluateValentinaFormula20261031} from '../../src/core/valentinaConnectedDraft20261031.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const sources={
  MaleShirt:{
    original:'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt/MaleShirt.val',
    paired:'research/oss/pattern-cad/Seamly2D/src/app/share/samples/patterns/male_shirt.sm2d',
    valSha:'8bdbb6bacc320c12737b88403c6b050f2f26e08324f56fc8641c586a324b3ad5',
    seamlySha:'a5638b7b983126f445dded9ad10fd0e75f1dbc974dba801d156eb4ec68a02c6a',
  },
  Trousers:{
    original:'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/Trousers/Trousers.val',
    paired:'research/oss/pattern-cad/Seamly2D/src/app/share/samples/patterns/trousers.sm2d',
    valSha:'f4616c6ba796cbd6cb186c35971bd5b554ce2b0db9eea57e34fce5bc3f22cd5c',
    seamlySha:'8909525adf3d4e016dab3ea7ecf1e95ef138d035990ebbc0719297982d3773fc',
  }
}
const hash=x=>createHash('sha256').update(x).digest('hex')
const fail=(code,reason)=>({ok:false,code,reason,manufacturingApproved:false})
const maxXml=8*1024*1024
const escapeAttr=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
const unescapeAttr=s=>s.replace(/&(?:lt|gt|quot|apos|amp|#(?:x[0-9a-f]+|\d+));/gi,ent=>{
  const named={'&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&amp;':'&'}
  if(Object.hasOwn(named,ent))return named[ent]
  if(/^&#x/i.test(ent))return String.fromCodePoint(parseInt(ent.slice(3,-1),16))
  if(/^&#/i.test(ent))return String.fromCodePoint(parseInt(ent.slice(2,-1),10))
  return ent
})
const attr=(s,k)=>new RegExp('(?:^|\\s)'+k+'\\s*=\\s*("([^"]*)"|\'([^\']*)\')').exec(s)?.[2] ??
  new RegExp('(?:^|\\s)'+k+'\\s*=\\s*("([^"]*)"|\'([^\']*)\')').exec(s)?.[3]

// Only same-name increments and tool identifiers that already have EXACTLY
// equivalent original expressions in both genuine source graphs may be edited.
function replaceFormula(xml,tag,predicate,formula){
  let matches=0,previous
  const next=xml.replace(new RegExp('<'+tag+'\\b[^>]*\\/\\s*>','g'),node=>{
    const identity=predicate(node)
    if(!identity)return node
    matches++
    if(matches!==1)throw Error('Duplicate source formula target')
    const expression=/\bformula\s*=\s*("([^"]*)"|'([^']*)')/.exec(node)
      || /\blength\s*=\s*("([^"]*)"|'([^']*)')/.exec(node)
    if(!expression)throw Error('Missing original formula attribute')
    previous=unescapeAttr(expression[2]??expression[3])
    return node.replace(expression[0], expression[0].slice(0,expression[0].indexOf('='))+'='+expression[1][0]+escapeAttr(formula)+expression[1][0])
  })
  if(matches!==1)throw Error('Original formula target not found or duplicated')
  return {xml:next,previous}
}
const parseToolElements=xml=>[...xml.matchAll(/<(point|line|spline|arc|elArc|path)\b[^>]*\/\s*>/g)]
  .map(match=>({tag:match[1],attributes:match[0],id:attr(match[0],'id')}))
const names=xml=>[...xml.matchAll(/<increment\b[^>]*\/\s*>/g)]
  .map(match=>({node:match[0],name:attr(match[0],'name'),formula:unescapeAttr(attr(match[0],'formula')??'')}))

/** Apply true upstream construction edits to matched seamly XML, never bypass a source SHA.
 * Return patched .val and independently verified .sm2d, preserving original inputs.
 */
export function projectValentinaConstructionEdits20261031(patternXml,constructionEdits){
  if(typeof patternXml!=='string'||!patternXml||Buffer.byteLength(patternXml)>maxXml)
    throw Error('Original Valentina XML missing or exceeds 8 MB')
  if(!Array.isArray(constructionEdits)||constructionEdits.length<1||constructionEdits.length>24)
    throw Error('Choose 1–24 source construction edits')
  const originalHash=hash(patternXml)
  const pair=Object.entries(sources).find(([,entry])=>entry.valSha===originalHash)
  if(!pair)throw Error('Connected source edit requires an authenticated original Valentina construction')
  const [identity,entry]=pair
  if(hash(fs.readFileSync(path.join(repo,entry.original)))!==entry.valSha)
    throw Error('Original Valentina source on disk is not the authenticated construction')
  let paired=fs.readFileSync(path.join(repo,entry.paired),'utf8')
  if(hash(paired)!==entry.seamlySha)throw Error('Original paired Seamly source identity mismatch')
  let original=patternXml
  const edits=[]
  const seen=new Set()
  const valTools=parseToolElements(original)
  const pairedTools=parseToolElements(paired)
  const valIncrements=names(original)
  const pairedIncrements=names(paired)
  for(const item of constructionEdits){
    if(!item||typeof item!=='object'||Array.isArray(item)||
      Object.keys(item).some(k=>!['kind','name','block','id','formula'].includes(k)))
      throw Error('Unsupported construction edit input')
    const formula=item.formula
    if(typeof formula!=='string'||!formula.trim()||formula.length>160||
      !/^[A-Za-z0-9_#.+\-*/^()?:<>=!\s]+$/.test(formula))
      throw Error('Construction formula must use supported numeric operators and source identifiers')
    // A punctuation allowlist alone would admit nonsense such as JS labels.
    // Validate the complete expression with our deterministic, non-eval parser;
    // symbolic identifiers receive a dummy numeric value for syntax checking.
    try{evaluateValentinaFormula20261031(formula,()=>1)}
    catch{throw Error('Unsupported construction formula syntax')}
    const key=JSON.stringify([item.kind,item.name,item.block,item.id])
    if(seen.has(key))throw Error('Duplicate construction edit')
    seen.add(key)
    if(item.kind==='increment'){
      if(typeof item.name!=='string'||!/^#[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(item.name))
        throw Error('Invalid increment name')
      const before=valIncrements.filter(v=>v.name===item.name)
      const mapped=pairedIncrements.filter(v=>v.name===item.name)
      if(before.length!==1||mapped.length!==1||before[0].formula!==mapped[0].formula)
        throw Error('Only matching original Valentina and Seamly increment formulas can be edited')
      const a=replaceFormula(original,'increment',node=>attr(node,'name')===item.name,formula)
      const b=replaceFormula(paired,'increment',node=>attr(node,'name')===item.name,formula)
      if(a.previous!==b.previous)throw Error('Increment source formulas diverged')
      original=a.xml;paired=b.xml
      edits.push({kind:'increment',name:item.name,previous:a.previous,formula})
    }else if(item.kind==='tool-length'){
      const id=String(item.id)
      if(!/^[1-9]\d{0,6}$/.test(id))throw Error('Invalid construction tool ID')
      if(!Number.isInteger(item.block)||item.block<0||item.block>99)
        throw Error('Tool block index must be a nonnegative integer')
      const originalBlocks=original.split(/(?=<draw\s)/)
      const seamlyBlocks=paired.split(/(?=<draftBlock\s)/)
      if(item.block+1>=originalBlocks.length||item.block+1>=seamlyBlocks.length)
        throw Error('Construction block missing')
      const o=originalBlocks[item.block+1],s=seamlyBlocks[item.block+1]
      const oTools=parseToolElements(o).filter(t=>t.id===id)
      const sTools=parseToolElements(s).filter(t=>t.id===id)
      if(oTools.length!==1||sTools.length!==1||oTools[0].tag!==sTools[0].tag||
        attr(oTools[0].attributes,'length')!==attr(sTools[0].attributes,'length'))
        throw Error('Construction tool is not paired one-to-one with identical source expression')
      const pred=node=>attr(node,'id')===id
      const a=replaceFormula(o,oTools[0].tag,pred,formula)
      const b=replaceFormula(s,sTools[0].tag,pred,formula)
      if(a.previous!==b.previous)throw Error('Original tool expressions diverged')
      original=original.replace(o,a.xml)
      paired=paired.replace(s,b.xml)
      edits.push({kind:'tool-length',block:item.block,id,previous:a.previous,formula})
    }else throw Error('Unsupported construction edit kind')
  }
  if(XMLValidator.validate(original)!==true||XMLValidator.validate(paired)!==true)
    throw Error('Edited original construction is invalid XML')
  return {identity,originalPatternXml:original,pairedPatternXml:paired,
    baselineSha256:originalHash,editedValentinaSha256:hash(original),editedSeamlySha256:hash(paired),
    constructionEdits:edits,manufacturingApproved:false}
}

/** The genuine executable evaluates the complete, edited source graph. */
export function evaluateValentinaConnected2DRequest20261031(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).some(k=>!['patternXml','measurementsXml','constructionEdits','format','sourceUnit'].includes(k)))
    return fail('INVALID_REQUEST','Unknown connected construction request fields')
  try{
    const projected=projectValentinaConstructionEdits20261031(body.patternXml,body.constructionEdits)
    const vit=body.measurementsXml
    if(typeof vit!=='string'||!/^\s*<\?xml[\s\S]*?<vit>/.test(vit)||Buffer.byteLength(vit)>2*1024*1024)
      return fail('INVALID_MEASUREMENTS','Valentina individual .vit measurement XML required')
    if(/<!\s*(?:DOCTYPE|ENTITY)/i.test(vit))return fail('INVALID_MEASUREMENTS','External entity forbidden')
    const converted=vit.replace('<vit>','<smis>').replace(/<\/vit>\s*$/,'</smis>')
      .replace('<version>0.3.3</version>','<version>0.3.4</version>')
    const result=evaluateSeamly2DRequest20261023({
      patternXml:projected.pairedPatternXml,measurementsXml:converted,format:body.format,
      ...(body.format==='aama-r10'?{sourceUnit:body.sourceUnit}:{}),
    })
    if(!result.ok)return result
    return {...result,originEngine:'Valentina',bridge:'verified-connected-'+projected.identity.toLowerCase(),
      sourceMapping:'Original Valentina '+projected.identity+' -> authenticated matching Seamly2D construction',
      baselineSha256:projected.baselineSha256,inputSha256:projected.editedValentinaSha256,
      measurementsSha256:hash(vit),editedSeamlySha256:projected.editedSeamlySha256,
      constructionEdits:projected.constructionEdits,editedOriginalPatternXml:projected.originalPatternXml,
      manufacturingApproved:false,factoryExportAllowed:false,
      note:'Recalculated complete paired upstream construction through real Seamly2D runtime; EXO native parametric editor parity is not asserted.'}
  }catch(e){return fail('CONNECTED_SOURCE_REFUSED',String(e?.message||e))}
}

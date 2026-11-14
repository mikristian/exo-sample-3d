import {strFromU8,unzipSync} from 'fflate'
import {sha256Bytes} from './sha256Bytes.js'
import {readPhysicalCutContours20261024} from './accumarkMarkerDxfGeometryParity20261024.mjs'
import {preflightPhysicalCutOverlap20261023_2000} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {buildSizeRun} from './grading.js'
import {edgeLength,edgePointAt,samplePieceBoundary,seamAllowanceBoundary} from './project.js'
import {inspectConnectedDevelopmentPdf20261101} from './modarisConnectedDevelopmentPdfReceipt20261101.js'

const refuse=message=>{throw Error(`Connected development receiver refused: ${message}`)}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const token=value=>String(value||'PATTERN').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,48).toUpperCase()
const crcTable=Uint32Array.from({length:256},(_,index)=>{
  let value=index
  for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1
  return value>>>0
})
function crc32(bytes){
  let value=0xffffffff
  for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8)
  return (value^0xffffffff)>>>0
}

function assertMarkerPlotBytes(files,size,fabricId,pieces,expectedWidthCm,expectedGapCm){
  const prefix=`markers/${size}/${fabricId}`
  for(const extension of ['svg','pdf'])if(!Object.hasOwn(files,`${prefix}.${extension}`))
    refuse(`missing marker plot for ${size}/${fabricId}`)
  const svg=strFromU8(files[`${prefix}.svg`])
  if(!svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"')||
    !svg.endsWith('</svg>')||/<script\b|<foreignObject\b|<image\b|<use\b|<!|\bon[a-z]+\s*=|\bstyle\s*=|javascript:|xlink:href|\bhref\s*=/iu.test(svg))
    refuse(`unsafe or malformed marker SVG ${size}/${fabricId}`)
  const allowed=new Set(['?xml','svg','title','desc','rect','g','polygon','line','text'])
  for(const match of svg.matchAll(/<([!?]?\/?[A-Za-z][A-Za-z0-9:-]*)\b/g)){
    if(!allowed.has(match[1].replace(/^\//,'')))
      refuse(`unsupported marker SVG element ${size}/${fabricId}`)
  }
  const group=/<g id="cut-lines">([\s\S]*?)<\/g>/.exec(svg)?.[1]
  const polygons=group?.match(/<polygon\b[^>]*\/>/g)||[]
  const quantity=pieces.reduce((sum,piece)=>sum+(piece.cutQuantity??1),0)
  if(!group||polygons.length!==quantity||polygons.join('')!==group||
    (svg.match(/<polygon\b/g)||[]).length!==polygons.length)
    refuse(`marker SVG polygon inventory mismatch ${size}/${fabricId}`)
  const page=/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="([\d.]+)cm" height="([\d.]+)cm" viewBox="0 0 ([\d.]+) ([\d.]+)">/.exec(svg)
  const pageValues=page?.slice(1).map(Number)
  if(!pageValues||!pageValues.every(Number.isFinite)||pageValues[0]<=0||
    pageValues[1]<=0||Math.abs(pageValues[0]-expectedWidthCm)>0.0002||
    Math.abs(pageValues[0]-pageValues[2])>0.00001||
    Math.abs(pageValues[1]-pageValues[3])>0.00001)
    refuse(`marker SVG dimensional envelope mismatch ${size}/${fabricId}`)
  // Renderer contours use ten subdivisions while CUT DXFs use twelve. For
  // each printed polygon, independently reconstruct the ten-subdivision
  // graded physical outline and the allowed grain/cross-grain orientations.
  // Compare translation-free point sequences at print rounding precision,
  // rather than relying on the embedded marker QA's self-reported success.
  const demands=pieces.map(piece=>{
    const base=seamAllowanceBoundary(piece,10)
    const grain=Number(piece.grainAngleDeg||0)
    if(!Number.isFinite(grain)||base.length<3)
      refuse(`invalid graded marker contour ${size}/${piece.id}`)
    const orientations=piece.marker?.allowCrossGrain?[-grain,90-grain]:[-grain]
    const contours=orientations.map(degrees=>{
      const radians=degrees*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians)
      const rotated=base.map(p=>({x:p.x*cos-p.y*sin,y:p.x*sin+p.y*cos}))
      return rotated.map(p=>({x:p.x-rotated[0].x,y:p.y-rotated[0].y}))
    })
    return {id:piece.id,quantity:piece.cutQuantity??1,contours}
  })
  const placedBounds=[]
  const printedPolygons=[]
  for(const polygon of polygons){
    if(!/^<polygon fill="none" stroke="#111" stroke-width="0\.04" points="[^"]+"\/>$/.test(polygon))
      refuse(`marker SVG attribute mismatch ${size}/${fabricId}`)
    const points=/\bpoints="([^"]+)"/.exec(polygon)?.[1]?.trim().split(/\s+/)
    if(!points||points.length<3||points.length>2000||points.some(value=>{
      const match=/^(-?(?:\d+\.?\d*|\.\d+)),(-?(?:\d+\.?\d*|\.\d+))$/.exec(value)
      return !match||![Number(match[1]),Number(match[2])].every(Number.isFinite)
    }))refuse(`invalid marker SVG polygon points ${size}/${fabricId}`)
    const actual=points.map(value=>{
      const [x,y]=value.split(',').map(Number)
      return {x,y}
    })
    if(actual.some(({x,y})=>x< -0.0002||y< -0.0002||
      x>pageValues[0]+0.0002||y>pageValues[1]+0.0002))
      refuse(`marker SVG contour outside fabric ${size}/${fabricId}`)
    const bounds={
      minX:Math.min(...actual.map(p=>p.x)),
      maxX:Math.max(...actual.map(p=>p.x)),
      minY:Math.min(...actual.map(p=>p.y)),
      maxY:Math.max(...actual.map(p=>p.y)),
    }
    if(placedBounds.some(other=>
      bounds.minX<other.maxX+expectedGapCm-0.0002&&
      other.minX<bounds.maxX+expectedGapCm-0.0002&&
      bounds.minY<other.maxY+expectedGapCm-0.0002&&
      other.minY<bounds.maxY+expectedGapCm-0.0002))
      refuse(`marker SVG placement overlap or spacing mismatch ${size}/${fabricId}`)
    placedBounds.push(bounds)
    const found=demands.findIndex(demand=>demand.quantity>0&&demand.contours.some(expected=>
      expected.length===actual.length&&expected.every((p,i)=>
        Math.hypot(actual[i].x-actual[0].x-p.x,actual[i].y-actual[0].y-p.y)<0.0002)))
    if(found<0)refuse(`marker SVG contour geometry mismatch ${size}/${fabricId}`)
    demands[found].quantity--
    printedPolygons.push(actual)
  }
  if(demands.some(demand=>demand.quantity!==0))
    refuse(`marker SVG source quantity mismatch ${size}/${fabricId}`)
  const pdf=strFromU8(files[`${prefix}.pdf`])
  if(!pdf.startsWith('%PDF-')||!pdf.trimEnd().endsWith('%%EOF'))
    refuse(`invalid marker PDF envelope ${size}/${fabricId}`)
  try{
    inspectConnectedDevelopmentPdf20261101(pdf,{
      size,fabricId,widthCm:pageValues[0],heightCm:pageValues[1],polygons:printedPolygons,
    })
  }catch(error){refuse(`marker PDF ${size}/${fabricId}: ${error.message}`)}
}

/** Bound expensive polygon intersection checks before the DXF parser runs. */
function assertBoundedDxf(dxf,size){
  if(dxf.length>12_000_000)refuse(`DXF source exceeds receiver byte budget ${size}`)
  const lines=dxf.replace(/\r/g,'').split('\n')
  if(lines.length>300_000)refuse(`DXF source exceeds receiver group budget ${size}`)
  let onCut=false,cutVertices=0,totalCutVertices=0
  for(let i=0;i+1<lines.length;i+=2){
    if(lines[i].trim()!=='0')continue
    const kind=lines[i+1].trim()
    if(kind==='POLYLINE'){
      onCut=false
      cutVertices=0
      for(let j=i+2;j+1<lines.length;j+=2){
        if(lines[j].trim()==='0')break
        if(lines[j].trim()==='8'&&lines[j+1].trim().startsWith('CUT_'))onCut=true
      }
    }else if(kind==='VERTEX'&&onCut){
      if(++cutVertices>2000||++totalCutVertices>20_000)
        refuse(`DXF physical CUT exceeds bounded vertex budget ${size}`)
    }else if(kind==='SEQEND'){
      onCut=false
    }
  }
}

/**
 * Parse *separate* STITCH polylines and authored NOTCH lines from the DXF
 * entity stream. This is source-side geometry/inventory corroboration, not a
 * licensed CAD interpreter, and it does not infer physical notch tolerances.
 */
function expectedPhysicalNotches(piece){
  const {edgePaths}=samplePieceBoundary(piece,12)
  const boundary=seamAllowanceBoundary(piece,12)
  const result=[]
  for(const notch of piece.notches||[]){
    const edge=notch?.edgeIndex
    const station=notch?.t??0.5,depth=notch?.depthCm??0.45
    if(!Number.isInteger(edge)||edge<0||edge>=edgePaths.length||
      typeof station!=='number'||!Number.isFinite(station)||station<0||station>1||
      typeof depth!=='number'||!Number.isFinite(depth)||depth<=0||
      ![undefined,null,'single','double'].includes(notch.type))
      refuse(`invalid authored notch specification: ${piece.id}`)
    const length=edgeLength(piece,edge)
    const gap=length>0?Math.min(0.045,0.38/length):0.02
    const fractions=notch.type==='double'?[station-gap,station+gap]:[station]
    for(const fraction of fractions){
      if(!Number.isFinite(fraction)||fraction<0||fraction>1)
        refuse(`invalid authored double-notch endpoint: ${piece.id}`)
      const path=edgePaths[edge]
      if(!Array.isArray(path)||path.length<2)refuse(`missing authored notch edge: ${piece.id}`)
      const spans=[0]
      for(let i=1;i<path.length;i++)spans[i]=spans[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y)
      const total=spans.at(-1)
      if(!(total>0))refuse(`zero-length authored notch edge: ${piece.id}`)
      const target=total*fraction
      let segment=0
      while(segment<spans.length-2&&spans[segment+1]<target)segment++
      const span=spans[segment+1]-spans[segment]
      if(!(span>0))refuse(`zero-length authored notch interval: ${piece.id}`)
      const fractionOnSegment=(target-spans[segment])/span
      const offset=edgePaths.slice(0,edge).reduce((sum,part)=>sum+part.length-1,0)
      const a=boundary[(offset+segment)%boundary.length],b=boundary[(offset+segment+1)%boundary.length]
      if(!a||!b)refuse(`missing authored physical CUT boundary: ${piece.id}`)
      const start={x:a.x+(b.x-a.x)*fractionOnSegment,y:a.y+(b.y-a.y)*fractionOnSegment}
      const stitch=edgePointAt(piece,edge,fraction,64)?.point
      const dx=stitch?.x-start.x,dy=stitch?.y-start.y
      const distance=Math.hypot(dx,dy)
      if(!(distance>1e-5)||![start.x,start.y,depth].every(Number.isFinite))
        refuse(`invalid physical notch direction: ${piece.id}`)
      const end={x:start.x+dx/distance*depth,y:start.y+dy/distance*depth}
      result.push({start,end})
    }
  }
  return result
}

function inspectStitchAndNotchInventory(dxf,graded,size,cutContours){
  const lines=dxf.replace(/\r/g,'').trimEnd().split('\n')
  const pairs=[]
  for(let i=0;i+1<lines.length;i+=2)
    pairs.push({code:Number(lines[i].trim()),value:lines[i+1].trim()})
  const stitches=new Map(),notches=new Map()
  let entities=false
  const metadata=(start)=>{
    const fields=new Map()
    let index=start
    while(index<pairs.length&&pairs[index].code!==0){
      const field=pairs[index++]
      if(!fields.has(field.code))fields.set(field.code,[])
      fields.get(field.code).push(field.value)
    }
    return {fields,index}
  }
  const one=(fields,code,label)=>{
    const values=fields.get(code)||[]
    if(values.length!==1)refuse(`invalid DXF ${label} multiplicity ${size}`)
    return values[0]
  }
  for(let i=0;i<pairs.length;){
    const record=pairs[i]
    if(record.code!==0){i++;continue}
    const kind=record.value
    if(kind==='SECTION'){
      entities=pairs[i+1]?.value==='ENTITIES'
      i+=2;continue
    }
    if(kind==='ENDSEC'){entities=false;i++;continue}
    if(!entities||!['POLYLINE','LINE'].includes(kind)){
      if(entities&&!['SEQEND','VERTEX'].includes(kind)){
        const recordData=metadata(i+1)
        const layer=recordData.fields.get(8)?.[0]
        if(layer?.startsWith('STITCH_')||layer?.startsWith('NOTCH_'))
          refuse(`unsupported DXF entity type ${kind} on stitch/notch layer ${size}`)
      }
      i++;continue
    }
    const {fields,index}=metadata(i+1)
    const layer=fields.get(8)?.[0]
    if(kind==='POLYLINE'){
      i=index
      if(layer?.startsWith('NOTCH_'))
        refuse(`unsupported DXF POLYLINE on authored NOTCH layer ${size}`)
      if(!layer?.startsWith('STITCH_'))continue
      if(!same([...fields.keys()].sort((a,b)=>a-b),[8,66,70])||
        one(fields,66,'STITCH sequence flag')!=='1'||
        one(fields,70,'STITCH flags')!=='1'||
        stitches.has(layer))refuse(`invalid duplicate/open DXF STITCH layer ${size}/${layer}`)
      const points=[]
      while(pairs[i]?.code===0&&pairs[i].value==='VERTEX'){
        const vertex=metadata(i+1)
        if(!same([...vertex.fields.keys()].sort((a,b)=>a-b),[8,10,20,30])||
          one(vertex.fields,8,'STITCH vertex layer')!==layer||
          Number(one(vertex.fields,30,'STITCH vertex Z'))!==0)
          refuse(`unsupported DXF STITCH vertex geometry ${size}/${layer}`)
        const x=Number(one(vertex.fields,10,'STITCH vertex X'))/10
        const y=Number(one(vertex.fields,20,'STITCH vertex Y'))/10
        if(!Number.isFinite(x)||!Number.isFinite(y))
          refuse(`nonfinite DXF STITCH vertex ${size}/${layer}`)
        points.push({x,y})
        i=vertex.index
      }
      if(pairs[i]?.value!=='SEQEND')refuse(`unterminated DXF STITCH ${size}/${layer}`)
      i++
      stitches.set(layer,points)
      continue
    }
    i=index
    if(layer?.startsWith('STITCH_'))
      refuse(`unsupported DXF LINE on STITCH layer ${size}`)
    if(!layer?.startsWith('NOTCH_'))continue
    if(!same([...fields.keys()].sort((a,b)=>a-b),[8,10,11,20,21,30,31])||
      Number(one(fields,30,'NOTCH start Z'))!==0||
      Number(one(fields,31,'NOTCH end Z'))!==0)
      refuse(`unsupported DXF NOTCH entity geometry ${size}/${layer}`)
    const x=Number(one(fields,10,'NOTCH start X'))/10
    const y=Number(one(fields,20,'NOTCH start Y'))/10
    const x2=Number(one(fields,11,'NOTCH end X'))/10
    const y2=Number(one(fields,21,'NOTCH end Y'))/10
    if(![x,y,x2,y2].every(Number.isFinite)||Math.hypot(x2-x,y2-y)<1e-7)
      refuse(`invalid DXF NOTCH line ${size}/${layer}`)
    if(!notches.has(layer))notches.set(layer,[])
    notches.get(layer).push({start:{x,y},end:{x:x2,y:y2}})
  }
  if(stitches.size!==graded.pieces.length)refuse(`DXF STITCH inventory mismatch ${size}`)
  const requiredNotches=new Map()
  for(const piece of graded.pieces){
    const name=token(piece.name),layer=`STITCH_${name}`
    const actual=stitches.get(layer)
    let expected
    try{expected=samplePieceBoundary(piece,12).points}
    catch(error){refuse(`invalid graded STITCH geometry ${size}: ${error.message}`)}
    if(!actual||!Array.isArray(expected)||actual.length!==expected.length||actual.length<3)
      refuse(`missing DXF STITCH geometry ${size}/${piece.id}`)
    const dx=actual[0].x-expected[0].x,dy=actual[0].y-expected[0].y
    if(actual.some((point,j)=>!Number.isFinite(expected[j].x)||!Number.isFinite(expected[j].y)||
      Math.hypot(point.x-expected[j].x-dx,point.y-expected[j].y-dy)>0.00001))
      refuse(`DXF STITCH geometry differs from graded source: ${size}/${piece.id}`)
    const cut=cutContours.get(`CUT_${name}_${token(size)}`)
    const sourceCut=seamAllowanceBoundary(piece,12)
    if(!cut||cut.length!==sourceCut.length||
      Math.hypot(cut[0].x-sourceCut[0].x-dx,cut[0].y-sourceCut[0].y-dy)>0.00001)
      refuse(`DXF CUT and STITCH translations differ: ${size}/${piece.id}`)
    const expectedNotches=expectedPhysicalNotches(piece)
    if(expectedNotches.length)requiredNotches.set(`NOTCH_${name}`,expectedNotches)
    const actualNotches=notches.get(`NOTCH_${name}`)||[]
    if(actualNotches.length!==expectedNotches.length)
      refuse(`DXF authored NOTCH inventory mismatch ${size}/${piece.id}`)
    const remaining=[...actualNotches]
    for(const expectedNotch of expectedNotches){
      const found=remaining.findIndex(line=>
        Math.hypot(line.start.x-expectedNotch.start.x-dx,line.start.y-expectedNotch.start.y-dy)<=0.00001&&
        Math.hypot(line.end.x-expectedNotch.end.x-dx,line.end.y-expectedNotch.end.y-dy)<=0.00001)
      if(found<0)refuse(`DXF authored NOTCH geometry mismatch ${size}/${piece.id}`)
      remaining.splice(found,1)
    }
  }
  if(notches.size!==requiredNotches.size||
    [...requiredNotches].some(([layer,expected])=>notches.get(layer)?.length!==expected.length))
    refuse(`DXF authored NOTCH inventory mismatch ${size}`)
}

/**
 * Inspect ZIP metadata before inflating any entries. fflate's filter can skip
 * an oversize file without flagging it, and duplicate entries are collapsed by
 * its resulting object: neither behavior is acceptable for a receiver.
 *
 * EXO produces ordinary single-disk ZIP32 without data descriptors. Refuse
 * other archive variants rather than interpreting their ambiguous metadata.
 */
function preflightZip32(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<22||bytes.length>100_000_000)refuse('invalid or oversized ZIP')
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const u16=(at)=>view.getUint16(at,true),u32=(at)=>view.getUint32(at,true)
  let end=-1
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--){
    if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){end=i;break}
  }
  if(end<0)refuse('missing or malformed ZIP end record')
  if(u16(end+20)!==0)refuse('ZIP comments are unsupported for this v1 archive')
  if(u16(end+4)!==0||u16(end+6)!==0||u16(end+8)!==u16(end+10)||
    u16(end+10)<5||u16(end+10)>500||u16(end+10)===65535)refuse('unsupported ZIP disk or entry count')
  const count=u16(end+10),offset=u32(end+16),length=u32(end+12)
  if(offset===0xffffffff||length===0xffffffff||offset+length!==end)refuse('invalid ZIP central directory')
  let cursor=offset,total=0
  const names=new Set(),spans=[],declaredSizes=new Map()
  for(let i=0;i<count;i++){
    if(cursor+46>end||u32(cursor)!==0x02014b50)refuse('invalid ZIP central record')
    const flags=u16(cursor+8),method=u16(cursor+10),crc=u32(cursor+16),compressed=u32(cursor+20),original=u32(cursor+24)
    const nameLength=u16(cursor+28),extraLength=u16(cursor+30),commentLength=u16(cursor+32)
    const localOffset=u32(cursor+42),next=cursor+46+nameLength+extraLength+commentLength
    if(next>end||nameLength<1||extraLength!==0||commentLength!==0||
      flags&~0x800||![0,8].includes(method)||
      u16(cursor+34)!==0||
      compressed===0xffffffff||original===0xffffffff||localOffset===0xffffffff)refuse('unsupported ZIP entry metadata')
    if(original>30_000_000||(total+=original)>100_000_000)refuse('uncompressed ZIP size budget exceeded')
    if(localOffset+30>offset||u32(localOffset)!==0x04034b50)refuse('invalid ZIP local header')
    const localFlags=u16(localOffset+6),localMethod=u16(localOffset+8)
    const localNameLength=u16(localOffset+26),localExtraLength=u16(localOffset+28)
    if(localExtraLength!==0)refuse('unsupported ZIP local extra fields')
    const start=localOffset+30+localNameLength+localExtraLength,stop=start+compressed
    if(localFlags!==flags||localMethod!==method||localNameLength!==nameLength||
      u32(localOffset+14)!==crc||
      u32(localOffset+18)!==compressed||u32(localOffset+22)!==original||
      stop>offset)refuse('inconsistent ZIP local and central records')
    const centralName=bytes.subarray(cursor+46,cursor+46+nameLength)
    const localName=bytes.subarray(localOffset+30,localOffset+30+localNameLength)
    if(centralName.some((b,j)=>b!==localName[j]))refuse('ZIP local filename mismatch')
    const name=strFromU8(centralName)
    if(!/^[A-Za-z0-9_.\/-]+$/.test(name)||name.startsWith('/')||name.includes('..')||
      name.includes('//')||name.endsWith('/')||names.has(name))refuse('unsafe or duplicate ZIP entry name')
    names.add(name);declaredSizes.set(name,{length:original,crc});spans.push([localOffset,stop])
    cursor=next
  }
  if(cursor!==end)refuse('ZIP central inventory does not fill directory')
  spans.sort((a,b)=>a[0]-b[0])
  if(spans[0]?.[0]!==0||spans.at(-1)?.[1]!==offset||
    spans.some((span,i)=>i>0&&span[0]!==spans[i-1][1]))
    refuse('ZIP contains overlapping or hidden entry data')
  return declaredSizes
}

/** Independently opens the archive bytes; no licensing or factory approval. */
export function inspectConnectedDevelopmentZip20261101(bytes){
  const declaredSizes=preflightZip32(bytes)
  let files
  try{files=unzipSync(bytes)}
  catch(error){refuse(`unreadable ZIP: ${error.message}`)}
  const paths=Object.keys(files)
  if(paths.length!==declaredSizes.size||paths.some(name=>!declaredSizes.has(name)||
    files[name].length!==declaredSizes.get(name).length))refuse('ZIP file inventory or inflation-size mismatch')
  for(const name of paths)if(crc32(files[name])!==declaredSizes.get(name).crc)
    refuse(`ZIP CRC mismatch: ${name}`)
  const read=name=>{
    if(!Object.hasOwn(files,name))refuse(`missing ${name}`)
    try{
      const original=strFromU8(files[name])
      const value=JSON.parse(original,(key,value)=>{
        if(['__proto__','prototype','constructor'].includes(key))throw Error('unsafe JSON key')
        return value
      })
      // Every JSON file in this v1 producer is JSON.stringify(value,null,2).
      // Exact canonical representation rejects duplicate object keys and
      // parser-dependent interpretations despite a self-consistent hash.
      if(original!==JSON.stringify(value,null,2))refuse(`noncanonical JSON: ${name}`)
      return value
    }catch(error){
      if(error.message?.startsWith('Connected development receiver refused:'))throw error
      refuse(`invalid JSON: ${name}`)
    }
  }
  const manifest=read('manifest.json'),status=read('review-status.json')
  if(!manifest||typeof manifest!=='object'||manifest.format!=='exo.connected-development-manifest.v1'||
    manifest.factoryCertified!==false||manifest.factoryApproved===true||
    !same(Object.keys(manifest).sort(),['factoryCertified','files','format','sha256'])||
    !status||status.format!=='exo.connected-development-review.v1'||
    status.factoryCertified!==false||status.factoryApproved===true||
    !same(Object.keys(status).sort(),['checks','factoryCertified','format','releaseStatus','requiredExternalChecks'])||
    status.releaseStatus!=='NOT_APPROVED_FOR_CUTTING_OR_BULK_PRODUCTION')
    refuse('archive claims unsafe or unrecognized release status')
  if(!Array.isArray(manifest.files)||!same([...paths].sort(),manifest.files)||
    !manifest.sha256||typeof manifest.sha256!=='object'||Array.isArray(manifest.sha256))refuse('manifest inventory mismatch')
  const payloadNames=paths.filter(name=>name!=='manifest.json').sort()
  if(!same(Object.keys(manifest.sha256).sort(),payloadNames))refuse('hash inventory mismatch')
  for(const name of payloadNames){
    if(!/^[0-9a-f]{64}$/.test(manifest.sha256[name])||sha256Bytes(files[name])!==manifest.sha256[name])
      refuse(`byte digest mismatch: ${name}`)
  }
  const source=read('source/garment-source.json'),run=read('source/linked-size-run.json')
  const sizes=source?.grading?.sizes
  if(!Array.isArray(sizes)||!sizes.length||sizes.length>120||new Set(sizes).size!==sizes.length||
    sizes.some(s=>typeof s!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(s)))refuse('invalid source size names')
  if((source.factoryCertified!==undefined&&source.factoryCertified!==false)||
    (source.factoryApproved!==undefined&&source.factoryApproved!==false)||
    !source.modarisSizeLinkedGrade||!Array.isArray(source.pieces)||!source.pieces.length||
    source.pieces.length>200||!run||typeof run!=='object'||Array.isArray(run)||
    !same(Object.keys(run).sort(),[...sizes].sort()))refuse('incomplete connected source or run')
  if(source.patternSource?.referenceOnly||source.pieces.some(piece=>piece?.patternImportProvenance?.referenceOnly))
    refuse('reference-only source is not manufacturing geometry')
  const sourceIds=new Set(),sourceNames=new Set()
  for(const piece of source.pieces){
    if(typeof piece?.id!=='string'||!piece.id||sourceIds.has(piece.id)||
      typeof piece.name!=='string'||!piece.name.trim()||sourceNames.has(token(piece.name))||
      !Array.isArray(piece.points)||piece.points.length<3)refuse('invalid source piece identities')
    sourceIds.add(piece.id);sourceNames.add(token(piece.name))
  }
  if(!Array.isArray(status.checks)||status.checks.length!==sizes.length||
    !same(status.requiredExternalChecks,
      ['Independent licensed CAD import','Calibrated print-scale measurement','Physical cut and sewn sample','Factory approval']))
    refuse('incomplete external review restrictions')
  for(const name of ['qa/marker-dxf-parity.json','qa/marker-plot-parity.json',
    'qa/industrial.json','qa/cutlines.json','qa/notches.json','qa/geometry.json']){
    const report=read(name)
    if(!report||typeof report!=='object'||
      (report.factoryCertified!==undefined&&report.factoryCertified!==false)||
      (report.factoryApproved!==undefined&&report.factoryApproved!==false)||
      (name.startsWith('qa/marker-')
        ? report.factoryApproved!==false||report.ok!==true
        : report.factoryCertified!==false))
      refuse(`unsafe QA release flag: ${name}`)
  }
  const markerDxf=read('qa/marker-dxf-parity.json')
  if(!same(markerDxf.sizes,sizes)||!Array.isArray(markerDxf.measurements)||
    markerDxf.checkedPlacements!==markerDxf.measurements.length)
    refuse('marker/DXF QA size coverage mismatch')
  // Validate untrusted quantity fields before Array.from or any expensive
  // geometry reconstruction. An altered linked-size-run must not be able to
  // request billions of expected marker placements during QA comparison.
  let totalExpectedPlacements=0
  for(const size of sizes){
    if(!Array.isArray(run[size]?.pieces)||run[size].pieces.length!==source.pieces.length)
      refuse(`invalid linked run pieces for ${size}`)
    for(const piece of run[size].pieces){
      const count=piece?.cutQuantity??1
      if(!Number.isSafeInteger(count)||count<1||count>99)
        refuse(`invalid linked run cut quantity for ${size}`)
      totalExpectedPlacements+=count
      if(totalExpectedPlacements>100_000)
        refuse('linked marker demand exceeds receiver resource budget')
    }
  }
  const expectedMeasurements=sizes.flatMap(size=>run[size].pieces.flatMap(piece=>
    Array.from({length:piece.cutQuantity??1},(_,instance)=>({
      size,fabric:piece.fabricId||'main',pieceId:piece.id,instance,
    }))))
  const measurementKey=value=>[value.size,value.fabric,value.pieceId,value.instance].join('\u0000')
  if(!same(markerDxf.measurements.map(measurementKey).sort(),
      expectedMeasurements.map(measurementKey).sort())||
    markerDxf.measurements.some(row=>![
      row.hausdorffCm,row.areaDifferenceCm2,row.perimeterDifferenceCm,
    ].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0)))
    refuse('marker/DXF QA placement evidence mismatch')
  for(const name of ['qa/industrial.json','qa/cutlines.json']){
    if(!same(read(name).sizes,sizes))refuse(`incomplete QA size coverage: ${name}`)
  }
  const markerPlot=read('qa/marker-plot-parity.json')
  const expectedPlots=sizes.flatMap(size=>
    [...new Set(run[size]?.pieces?.map(piece=>piece.fabricId||'main')||[])]
      .map(fabricId=>({size,fabricId})))
  if(!Array.isArray(markerPlot.rows)||markerPlot.rows.length!==expectedPlots.length||
    markerPlot.rows.some((row,i)=>row?.ok!==true||row.factoryApproved!==false||
      row.size!==expectedPlots[i].size||row.fabricId!==expectedPlots[i].fabricId))
    refuse('marker plot QA coverage mismatch')
  let rebuilt
  try{rebuilt=buildSizeRun(source)}
  catch(error){refuse(`stale or invalid linked source: ${error.message}`)}
  if(!same(rebuilt,run))refuse('linked size run does not agree with authored source')
  const checks=[]
  for(let i=0;i<sizes.length;i++){
    const size=sizes[i],graded=run[size],statusCheck=status.checks[i]
    if(graded?.previewSize!==size||!Array.isArray(graded.pieces)||graded.pieces.length!==source.pieces.length||
      !same(graded.pieces.map(p=>p.id),source.pieces.map(p=>p.id))||
      !same(graded.pieces.map(p=>p.name),source.pieces.map(p=>p.name)))refuse(`invalid graded size ${size}`)
    if(!statusCheck||!same(Object.keys(statusCheck).sort(),
      ['cutContourCount','factoryCertified','internalGeometryCheck','size'])||
      statusCheck.size!==size||statusCheck.cutContourCount!==graded.pieces.length||
      statusCheck.factoryCertified!==false||statusCheck.internalGeometryCheck!=='passed')
      refuse(`invalid review row for ${size}`)
    const path=`patterns/${size}.dxf`
    if(!Object.hasOwn(files,path))refuse(`missing ${path}`)
    const dxf=strFromU8(files[path])
    assertBoundedDxf(dxf,size)
    let contours
    try{
      contours=readPhysicalCutContours20261024(dxf)
      const cutPreflight=preflightPhysicalCutOverlap20261023_2000(dxf)
      if(!cutPreflight.ok||cutPreflight.contourCount!==graded.pieces.length)
        refuse(`physical CUT preflight failed for ${size}`)
    }catch(error){refuse(`unreadable or unsafe DXF ${size}: ${error.message}`)}
    if(!(contours instanceof Map)||contours.size!==graded.pieces.length)refuse(`DXF CUT inventory mismatch ${size}`)
    const comments=dxf.replace(/\r/g,'').split('\n').flatMap((line,j,lines)=>
      line.trim()==='999'&&j+1<lines.length?[lines[j+1].trim()]:[])
    for(const [label,value] of [['GARMENT_STUDIO_PROJECT ',source.id||'untitled'],['GARMENT_STUDIO_SIZE ',size]]){
      if(comments.filter(c=>c.startsWith(label)).length!==1||!comments.includes(label+value))
        refuse(`DXF source identity mismatch ${size}`)
    }
    for(const piece of graded.pieces){
      const layer=`CUT_${token(piece.name)}_${token(size)}`
      const actual=contours.get(layer)
      if(!actual)refuse(`missing DXF CUT layer ${layer}`)
      let expected
      try{expected=seamAllowanceBoundary(piece,12)}catch(error){refuse(`invalid graded CUT geometry: ${error.message}`)}
      if(!Array.isArray(expected)||expected.length!==actual.length||expected.length<3)
        refuse(`DXF CUT vertex inventory mismatch ${size}/${piece.id}`)
      const dx=actual[0].x-expected[0].x,dy=actual[0].y-expected[0].y
      if(actual.some((point,j)=>!Number.isFinite(expected[j].x)||!Number.isFinite(expected[j].y)||
        Math.hypot(point.x-expected[j].x-dx,point.y-expected[j].y-dy)>0.00001))
        refuse(`DXF CUT geometry differs from graded source: ${size}/${piece.id}`)
    }
    inspectStitchAndNotchInventory(dxf,graded,size,contours)
    for(const fabricId of new Set(graded.pieces.map(p=>p.fabricId||'main')))
      assertMarkerPlotBytes(files,size,fabricId,
        graded.pieces.filter(piece=>(piece.fabricId||'main')===fabricId),
        graded.markerSettings?.fabricWidthsCm?.[fabricId]??source.markerSettings?.fabricWidthCm??150,
        source.markerSettings?.gapCm??1.5)
    checks.push({size,cutCount:contours.size})
  }
  // The v1 producer has a closed file vocabulary. Recomputed manifest hashes
  // cannot authorize arbitrary executable/document files or silent replacement
  // artifacts in what is supposed to be a development-only CAD handoff.
  const expectedFiles=new Set([
    'manifest.json','review-status.json',
    'source/garment-source.json','source/linked-size-run.json',
    'qa/marker-dxf-parity.json','qa/marker-plot-parity.json',
    'qa/industrial.json','qa/cutlines.json','qa/notches.json','qa/geometry.json',
  ])
  for(const size of sizes){
    expectedFiles.add(`patterns/${size}.dxf`)
    for(const fabricId of new Set(run[size].pieces.map(piece=>piece.fabricId||'main'))){
      expectedFiles.add(`markers/${size}/${fabricId}.svg`)
      expectedFiles.add(`markers/${size}/${fabricId}.pdf`)
      const svg=`print-calibration/${size}/${fabricId}.svg`
      const pdf=`print-calibration/${size}/${fabricId}.pdf`
      const hasSvg=Object.hasOwn(files,svg),hasPdf=Object.hasOwn(files,pdf)
      if(hasSvg!==hasPdf)
        refuse(`incomplete print-calibration pair ${size}/${fabricId}`)
      if(hasSvg){
        const plotSvg=strFromU8(files[svg])
        const plotPdf=strFromU8(files[pdf])
        if(!plotSvg.includes('<svg')||!plotSvg.trimEnd().endsWith('</svg>')||
          !plotPdf.startsWith('%PDF-')||!plotPdf.trimEnd().endsWith('%%EOF'))
          refuse(`invalid print-calibration plot ${size}/${fabricId}`)
        expectedFiles.add(svg);expectedFiles.add(pdf)
      }
    }
  }
  if(paths.length!==expectedFiles.size||paths.some(name=>!expectedFiles.has(name)))
    refuse('unexpected development archive file or missing required artifact')
  return {ok:true,factoryCertified:false,sizes:[...sizes],checks,filesVerified:paths.length,
    note:'Internal digital integrity, linked grading and physical CUT geometry read-back; no licensed CAD or physical verification. SHA-256 is not an authenticated signature.'}
}

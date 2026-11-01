import {zipSync,strToU8,unzipSync,strFromU8} from 'fflate'
import {sha256Bytes} from './sha256Bytes.js'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'
import {listSpreadsheetTablesFromWorkspace} from './techpack-spreadsheet/printProjection.js'
import {exportTechPackXlsx} from './techpack-spreadsheet/exporterXlsx.js'
import {createGarmentSpreadsheetTables} from './techpack-spreadsheet/sourceBindings.js'
import {techPackFactoryReadiness} from './techPackFactoryReadiness.js'
import {buildAccuMarkGuardedFactoryPackage20261023} from './accumarkGuardedFactoryPackage20261023.js'
import {deriveTechPackLiveEngineering20261031} from './techPackLiveEngineering20261031.js'
import {deriveTechPackFactoryMaterials20261031} from './techPackFactoryMaterials20261031.js'
import {evaluateTechPackProductionGovernance} from './techPackProductionGovernance20261031.js'

/** Technical handoff draft, NOT a graded cutter package or factory approval.
 * Real factory DXF bytes are included ONLY if the existing independently
 * validated AccuMark package gate passes; no fake pattern SVG is named DXF.
 * The snapshot contains only authored Tech Pack data intentionally exported
 * by the current user, never host secrets or runtime collaboration tokens.
 */
const MAX_FILES=100
const MAX_FILE=12_000_000
const MAX_TOTAL=48_000_000
const text=value=>strToU8(String(value))
const json=value=>text(JSON.stringify(value,null,2))
const fileName=value=>String(value||'garment').normalize('NFKD').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,48)||'garment'
const validPath=p=>typeof p==='string'&&p.length<=180&&/^[a-z0-9_.\/-]+$/i.test(p)&&
  !p.startsWith('/')&&!p.includes('..')&&!p.includes('//')&&!p.includes('\\')&&
  p.split('/').every(part=>part!=='.'&&part!==''&&part!=='__proto__')
const base64Bytes=payload=>{
  if(typeof payload!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload))throw Error('Invalid artwork base64')
  const raw=atob(payload),out=new Uint8Array(raw.length)
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i)
  return out
}
const assetFile=(asset,index)=>{
  const raw=asset?.dataUrl||asset?._src||asset?.src
  if(typeof raw!=='string'||raw.length>MAX_FILE*2)return null
  const match=raw.match(/^data:image\/(webp|png|jpeg);base64,(.+)$/i)
  if(match)return {name:`references/asset-${String(index+1).padStart(3,'0')}.${match[1].toLowerCase()==='jpeg'?'jpg':match[1].toLowerCase()}`,
    bytes:base64Bytes(match[2]),label:String(asset?.name||asset?.caption||'Reference').slice(0,120)}
  // Do not export arbitrary user SVG as executable XML into a factory ZIP.
  // Print HTML safely embeds vetted in-document SVG preview only.
  return null
}
// The public inspection endpoint rejects malicious ZIP sizes before fflate
// allocates decompressed records. This uses central-directory lower bounds;
// the final unpacked lengths and checksums are also verified independently.
function preflightZip(input){
 const view=new DataView(input.buffer,input.byteOffset,input.byteLength)
 let end=-1
 for(let i=input.length-22;i>=Math.max(0,input.length-65557);i--)
   if(view.getUint32(i,true)===0x06054b50){end=i;break}
 if(end<0)throw Error('Invalid Tech Pack ZIP directory')
 const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true),start=view.getUint32(end+16,true)
 if(!count||count>MAX_FILES||count===65535||view.getUint16(end+8,true)!==count||
   view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0||
   start+directorySize>input.length)throw Error('Unsafe Tech Pack ZIP directory')
 let offset=start,sum=0
 for(let i=0;i<count;i++){
   if(offset+46>start+directorySize||view.getUint32(offset,true)!==0x02014b50)throw Error('Malformed Tech Pack ZIP directory')
   const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true)
   const packed=view.getUint32(offset+20,true),unpacked=view.getUint32(offset+24,true)
   const n=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true)
   if(flags&1||![0,8].includes(method)||packed===0xffffffff||unpacked===0xffffffff||
     unpacked>MAX_FILE||unpacked>Math.max(1024,packed)*1000)throw Error('Tech Pack ZIP entry expansion exceeds safe limits')
   sum+=unpacked
   if(sum>MAX_TOTAL)throw Error('Tech Pack ZIP cumulative expansion exceeds limit')
   const tail=offset+46+n+extra+comment
   if(tail>start+directorySize)throw Error('Malformed Tech Pack ZIP directory range')
   const name=new TextDecoder('utf-8',{fatal:true}).decode(input.subarray(offset+46,offset+46+n))
   if(!validPath(name))throw Error('Unsafe Tech Pack ZIP entry name')
   offset=tail
 }
 if(offset!==start+directorySize)throw Error('Tech Pack ZIP directory contains trailing records')
}
export function inspectTechPackHandoffZip20261031(input){
  const data=input instanceof Uint8Array?input:new Uint8Array(input)
  if(!data.length||data.length>MAX_TOTAL)throw Error('Tech Pack ZIP exceeds transfer limit')
  preflightZip(data)
  const files=unzipSync(data)
  const paths=Object.keys(files)
  if(!paths.length||paths.length>MAX_FILES||paths.some(p=>!validPath(p)))throw Error('Unsafe factory handoff paths')
  let bytes=0
  for(const [path,entry] of Object.entries(files)){
    if(!(entry instanceof Uint8Array)||entry.length>MAX_FILE)throw Error('Factory handoff entry exceeds limit: '+path)
    bytes+=entry.length
    if(bytes>MAX_TOTAL)throw Error('Factory handoff decompressed content exceeds limit')
  }
  const manifest=JSON.parse(strFromU8(files['manifest.json']||new Uint8Array()))
  if(manifest.format!=='exo-techpack-handoff.v1'||!Array.isArray(manifest.files))throw Error('Unsupported Tech Pack handoff')
  const declared=new Set(manifest.files.map(record=>record.path))
  if(declared.size!==manifest.files.length||declared.size!==paths.length-1)throw Error('Tech Pack handoff manifest inventory differs')
  for(const entry of manifest.files){
    if(!validPath(entry.path)||entry.path==='manifest.json'||!Object.hasOwn(files,entry.path)||
       files[entry.path].length!==entry.bytes||sha256Bytes(files[entry.path])!==entry.sha256)throw Error('Tech Pack handoff integrity failure: '+String(entry.path))
  }
  return {files,manifest}
}

export function buildTechPackHandoff20261031({
 source={},draft={},workspace={},assets=[],project=null,nativeSnapshot=null,nativeMode=true,approvedPdf=null,
 release=false,releaseEvidence=null,includeVerifiedPatterns=false
}={}){
 if(!source?.ready)throw Error('Saved garment source required for a Tech Pack handoff')
 if(!workspace||typeof workspace!=='object'||Array.isArray(workspace))throw Error('Invalid Tech Pack document')
 if(!Array.isArray(assets)||assets.length>80)throw Error('Invalid Tech Pack asset inventory')
 const readiness=techPackFactoryReadiness(source,draft,workspace,assets)
 if(release){
   if(!readiness.ready||releaseEvidence?.status!=='released'||releaseEvidence?.verified!==true||
      !releaseEvidence?.releaseId||!releaseEvidence?.sourceRevision||
      String(releaseEvidence.sourceRevision)!==String(source.revision))
     throw Error('Factory RELEASE blocked: verified source-matched physical approvals and complete specifications are required')
 }
 const files=Object.create(null)
 const put=(name,bytes)=>{
   if(!validPath(name)||name==='manifest.json'||Object.hasOwn(files,name))throw Error('Unsafe or duplicate factory handoff path')
   if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_FILE)throw Error('Invalid factory handoff payload: '+name)
   files[name]=bytes
 }
 const print=renderTechPackWorkspacePrintHTML(source,draft,workspace,assets)
 put('documents/techpack-print.html',text(print))
 const sourceTables=source.ready?createGarmentSpreadsheetTables(source,draft):{}
 const placed=listSpreadsheetTablesFromWorkspace(workspace,sourceTables)
 const authored=Object.entries(workspace.tables||{}).flatMap(([pageId,tables])=>
   (Array.isArray(tables)?tables:[]).map(t=>({...t,name:t.title||pageId})))
 const allTables=[...placed,...authored]
 if(allTables.length)put('documents/editable-specifications.xlsx',exportTechPackXlsx(allTables))
 const metadata={status:release?'released':'draft-for-review',factoryApproved:false,
   sampleOnly:Boolean(workspace.demoTechPack),sourceRevision:source.revision??null,
   styleName:draft.styleName||source.name||'',sku:draft.sku||'',
   sourceKind:source.kind,generatedFrom:'source-linked EXO document',
   notice:'Pattern screenshots and simulated models are NOT certified printable cut files; verified DXF is an independent guarded workflow.',
   missing:readiness.missing.map(i=>({id:i.id,page:i.pageId,reason:i.reason})),
   review:readiness.review.map(i=>({id:i.id,page:i.pageId,reason:i.reason}))}
 put('review/source-and-release-status.json',json(metadata))
 put('documents/editable-techpack.json',json({format:'exo-techpack-document.v1',draft,workspace}))
 const engineering=deriveTechPackLiveEngineering20261031({
   snapshot:nativeSnapshot,project,source,nativeMode})
 const factoryMaterials=deriveTechPackFactoryMaterials20261031({
   snapshot:nativeSnapshot,source,engineering,draft,
   markerEvidence:workspace.factoryMarkerEvidence})
 const governance=evaluateTechPackProductionGovernance({
   ...source,revision:source.revision??engineering.sourceRevision},workspace.productionGovernance||{})
 put('engineering/source-linked-patterns-seams-pom.json',json(engineering))
 put('engineering/materials-operations-and-costs.json',json(factoryMaterials))
 put('review/physical-sampling-and-governance.json',json({
   governance:workspace.productionGovernance||{},evaluation:governance,
   disclaimer:'Locally recorded evidence and roles are unauthenticated until verified by the receiving factory.'}))
 const imageIndex=[]
 for(let i=0;i<assets.length;i++){
   const asset=assetFile(assets[i],i)
   if(!asset)continue
   put(asset.name,asset.bytes)
   imageIndex.push({name:asset.name,assetId:assets[i]?.id||null,description:asset.label})
 }
 if(imageIndex.length)put('references/image-inventory.json',json(imageIndex))
 let patternCount=0
 if(includeVerifiedPatterns){
   const verified=buildAccuMarkGuardedFactoryPackage20261023(project,{zip:false})
   if(!verified.ok)throw Error('No verified manufacturing DXF available: '+verified.reason)
   for(const [path,bytes] of Object.entries(verified.files||{})){
     if(!/^patterns\/[a-zA-Z0-9_.-]+\.dxf$/.test(path))continue
     put('verified-'+path,bytes);patternCount++
   }
   if(!patternCount)throw Error('Verified factory pattern package contains no size DXF')
 }
 if(approvedPdf!=null){
   const data=approvedPdf instanceof Uint8Array?approvedPdf:new Uint8Array(approvedPdf)
   if(data.length<8||strFromU8(data.subarray(0,5))!=='%PDF-')throw Error('Supplied PDF is not a valid PDF envelope')
   put('documents/techpack-print.pdf',data)
 }else put('documents/SAVE-PRINT-TO-PDF.txt',text(
   'Open techpack-print.html in a browser and use Print > Save as PDF. No PDF binary is fabricated by EXO. Review every page for legibility before factory handoff.'))
 const fileList=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha256Bytes(bytes)}))
 const manifest={format:'exo-techpack-handoff.v1',version:1,status:metadata.status,
   manufacturingApproved:false,patternCount,printPages:workspace.pageOrder?.length||0,
   sourceRevision:source.revision??null,sourceName:source.name||null,
   limitations:['Source-linked specs and approvals need independent physical verification',
     'SHA-256 manifest is integrity evidence, not a digital signature',
     'PDF must be generated and visually checked if not explicitly provided',
     ...(!patternCount?['No validated manufacturing DXF included']:[])],
   files:fileList}
 files['manifest.json']=json(manifest)
 const total=Object.values(files).reduce((sum,b)=>sum+b.length,0)
 if(total>MAX_TOTAL||fileList.length>MAX_FILES-1)throw Error('Factory handoff exceeds combined budget')
 const zip=zipSync(files,{level:6})
 if(zip.length>MAX_TOTAL)throw Error('Compressed factory handoff exceeds limit')
 inspectTechPackHandoffZip20261031(zip)
 return {zip,manifest,readiness,filename:`${fileName(draft.sku||source.name)}-techpack-${release?'released':'draft-review'}.zip`,patternCount}
}

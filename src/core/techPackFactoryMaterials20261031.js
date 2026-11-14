// Factory materials and operations are provisional until the physical source is verified.
const rows=v=>Array.isArray(v)?v:[]
const finite=v=>typeof v==='number'&&Number.isFinite(v)
const valid=v=>typeof v==='string'&&v.length>0
const clone=v=>v==null?v:structuredClone(v)
const value=(n,unit,origin)=>({value:finite(n)&&n>=0?n:null,unit:finite(n)&&n>=0?unit:null,
  status:finite(n)&&n>=0?origin:'unknown'})
const unverified=()=>({value:null,unit:null,status:'unknown'})
const materialRef=(id,revision)=>({kind:'material',id,revision})

/** Only real quantities with known units are multiplied. `estimate` is never called verified. */
export function calculateTechPackMaterialCost20261031({consumption,unitPrice,wastePercent=0,currency}={}){
  const a=consumption,b=unitPrice
  if(!finite(a?.value)||a.value<0||!valid(a.unit)||!finite(b?.value)||b.value<0||
    a.unit!==b.perUnit||!valid(currency)||!finite(wastePercent)||wastePercent<0||wastePercent>100)
    return {...unverified(),currency:null,reason:'UNVERIFIED_CONSUMPTION_OR_UNIT_PRICE'}
  return {value:Math.round((a.value*b.value*(1+wastePercent/100)+Number.EPSILON)*1e6)/1e6,
    unit:currency,currency,status:a.status==='verified'&&b.status==='verified'?'verified':'estimate',
    sourceStatus:[a.status,b.status],wastePercent}
}

export function deriveTechPackFactoryMaterials20261031({snapshot=null,source=null,engineering=null,draft={},markerEvidence=null}={}){
  const revision=engineering?.sourceRevision??snapshot?.revision??source?.revision??null
  const fabrics=rows(snapshot?.template?.fabrics).length?rows(snapshot.template.fabrics):rows(source?.fabrics)
  const authored=rows(draft?.bom)
  const authoredById=new Map(authored.filter(x=>valid(x?.id)).map(x=>[x.id,x]))
  const items=fabrics.filter(x=>valid(x?.id)).map(f=>{
    const override=authoredById.get(f.id)
    authoredById.delete(f.id)
    return {id:f.id,name:f.name||f.id,materialType:'fabric',sourceRef:materialRef(f.id,revision),
      color:f.color??f.properties?.color??null,composition:f.composition??null,
      gsm:value(f.gsm??f.properties?.gsm,'g/m²','source'),
      thickness:value(f.thickness??f.properties?.thickness,'m','source'),
      consumption:unverified(),unitPrice:unverified(),
      supplier:null,authored:clone(override??{}),status:'review-required',manufacturingApproved:false}
  })
  for(const item of authoredById.values())items.push({id:item.id,name:item.description||item.name||item.id,
    materialType:item.type||'authored',sourceRef:null,color:null,composition:null,
    gsm:unverified(),thickness:unverified(),consumption:unverified(),unitPrice:unverified(),
    supplier:null,authored:clone(item),status:'authored-unverified',manufacturingApproved:false})
  const patterns=rows(engineering?.patterns)
  const assignments=patterns.map(p=>({patternId:p.id,materialId:p.fabricId||null,
    quantity:Number.isSafeInteger(p.cutCount)&&p.cutCount>0?p.cutCount:null,
    status:p.cutCountStatus==='source'?'source':'unknown',sourceRef:clone(p.sourceRef)}))
  const colorways=rows(draft?.colorways).map(c=>({id:c.id||null,name:c.name||'',
    assignments:clone(c.materials??{}),status:'authored-unverified'}))
  const marker=revision!=null&&markerEvidence&&markerEvidence.sourceRevision===revision&&markerEvidence.verified===true&&
    finite(markerEvidence.yieldPercent)&&markerEvidence.yieldPercent>=0&&markerEvidence.yieldPercent<=100&&
    valid(markerEvidence.markerId)&&valid(markerEvidence.size)&&valid(markerEvidence.colorwayId)?
    {markerId:markerEvidence.markerId,size:markerEvidence.size,colorwayId:markerEvidence.colorwayId,
      yieldPercent:value(markerEvidence.yieldPercent,'%','verified'),sourceRevision:revision,status:'source-verified'}:
    {markerId:null,size:null,colorwayId:null,yieldPercent:unverified(),status:'unverified'}
  const seams=rows(engineering?.seams)
  const authoredOperations=rows(draft?.sewingOperations)
  const operations=seams.map(seam=>{
    const override=authoredOperations.find(o=>o?.seamId===seam.id)
    return {id:`seam:${seam.id}`,seamId:seam.id,sourceRef:clone(seam.sourceRef),
      first:seam.first,second:seam.second,stitchClass:override?.stitchClass??null,
      spi:finite(override?.spi)&&override.spi>0?value(override.spi,'stitches/in','authored'):unverified(),
      threadId:override?.threadId??null,authored:clone(override??{}),
      status:seam.refsResolved?'authored-unverified':'unresolved-seam',manufacturingApproved:false}
  })
  for(const op of authoredOperations.filter(x=>!seams.some(s=>s.id===x?.seamId)))operations.push({
    id:op.id||`unlinked:${op.seamId||'unknown'}`,seamId:op.seamId??null,sourceRef:null,
    stitchClass:op.stitchClass??null,spi:unverified(),threadId:op.threadId??null,
    authored:clone(op),status:'unresolved-seam',manufacturingApproved:false})
  return {kind:'exo-techpack-factory-materials.v1',sourceRevision:revision,
    materials:items,patternAssignments:assignments,colorways,marker,operations,
    costs:{total:unverified(),currency:null},manufacturingApproved:false,
    issues:[...assignments.filter(a=>a.quantity===null).map(a=>`CUT_COUNT_UNKNOWN:${a.patternId}`),
      ...operations.filter(o=>o.status==='unresolved-seam').map(o=>`SEAM_REFERENCE_UNRESOLVED:${o.seamId}`)]}
}

/** Rebind source-linked materials/operations; preserve manually entered BOM and sewing fields. */
export function reconcileTechPackFactoryMaterials20261031(previous={},fresh={}){
  const changed=previous.sourceRevision==null||fresh.sourceRevision==null||
    String(previous.sourceRevision)!==String(fresh.sourceRevision)
  const preserve=(oldList,newList)=>{
    const originals=new Map(rows(oldList).filter(x=>valid(x?.id)).map(x=>[x.id,x]))
    const next=rows(newList).map(item=>{
      const old=originals.get(item.id);originals.delete(item.id)
      return {...clone(item),authored:clone(old?.authored??item.authored??{}),
        stale:changed&&Boolean(old),manufacturingApproved:false}
    })
    return [...next,...[...originals.values()].map(old=>({...clone(old),stale:true,sourceMissing:true,
      status:'source-missing-review-required',manufacturingApproved:false}))]
  }
  return {...clone(fresh),materials:preserve(previous.materials,fresh.materials),
    operations:preserve(previous.operations,fresh.operations),
    marker:changed?{markerId:null,size:null,colorwayId:null,yieldPercent:unverified(),status:'unverified'}:clone(fresh.marker),
    issues:[...rows(fresh.issues),...(changed?['SOURCE_REVISION_CHANGED_REVIEW_REQUIRED']:[])],manufacturingApproved:false}
}

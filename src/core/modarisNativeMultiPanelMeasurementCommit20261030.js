import {
  createNativePatternConstraintSidecar20261023 as create,
  planNativePatternConstraintBindings20261023 as plan,
  fingerprintNativePatternBindingsSource20261023 as fingerprint,
} from './nativePatternConstraintBindings20261023.js'
import {evaluateNativeDraftFormulas20261023 as evalFormulas} from './nativeParametricFormula20261023.js'

const fail=reason=>Object.freeze({ok:false,reason,manufacturingApproved:false})
const direct=value=>typeof value==='number'?value:
  value&&typeof value==='object'&&!Object.hasOwn(value,'formula')?value.valueMm:undefined
const normalized=value=>Array.isArray(value)?value.map(normalized):
  value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalized(value[k])])):value
const same=(a,b)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b))
const rules=items=>items.map(item=>{
  const copy=structuredClone(item)
  if(Array.isArray(copy.dependsOn)&&copy.dependsOn.length===0)delete copy.dependsOn
  return copy
})
const within=value=>Number.isFinite(value)&&Math.abs(value)<=5000
const vec2=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8
function rotated3(vector,degrees){
  if(!Array.isArray(degrees)||degrees.length!==3||!degrees.every(Number.isFinite))
    throw Error('Native material placement has invalid rotation')
  const [rx,ry,rz]=degrees.map(v=>v*Math.PI/180)
  let [x,y,z]=vector
  ;[x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)]
  ;[x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)]
  ;[y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)]
  return [x,y,z]
}

/**
 * Multi-piece ungraded native worksheet transaction. The only authored RPC
 * value is a named direct measurement; Rust derives and commits every point,
 * curved handle and updated binding atomically across two or more pieces.
 */
export function prepareModarisNativeMultiPanelMeasurementCommit20261030(snapshot,sidecar,reviewed){
  try{
    if(!Number.isSafeInteger(snapshot?.revision)||!snapshot?.nativePointBindings?.active||
      snapshot?.gradeRunPersisted||snapshot?.fabricGradeEnvelope||
      snapshot?.nativeFacingDependency||snapshot?.pieceVariant?.persisted||
      snapshot?.importedHardware?.length||snapshot?.printGraphics?.length)
      throw Error('Native multi-panel worksheet requires ungraded source without project attachments')
    if(!reviewed?.ok||!sidecar||!reviewed.sidecar||
      sidecar.sourceRevision!==snapshot.revision||
      sidecar.sourceFingerprint!==fingerprint(snapshot))
      throw Error('Multi-panel source revision or worksheet sidecar is stale')
    const native=snapshot.nativePointBindings
    if(native.version!==1||!same(native.measurements,sidecar.measurements)||
      !same(rules(native.bindings??[]),rules(sidecar.bindings??[])))
      throw Error('Rust-owned measurements or binding identities differ from reviewed source')
    const panelIds=[...new Set(sidecar.bindings.map(b=>b.panelId))]
    if(panelIds.length<2||panelIds.length>16)
      throw Error('Native multi-panel change requires rules in 2–16 independent panels')
    if(!Array.isArray(snapshot?.template?.panels)||!Array.isArray(snapshot.template.seams))
      throw Error('Missing native garment source')
    for(const panelId of panelIds){
      const panels=snapshot.template.panels.filter(p=>p.id===panelId)
      if(panels.length!==1||snapshot.template.seams.some(s=>s.a?.panel===panelId||s.b?.panel===panelId))
        throw Error('Multi-panel source contains missing, duplicate or sewn bound pieces')
      const p=panels[0],poly=p.polygon
      if(!poly||poly.points?.length>32||p.pins?.length||p.pin_points?.length||
        poly.holes?.length||poly.lines?.length||poly.free_curve_points&&Object.keys(poly.free_curve_points).length||
        poly.vertex_ids&&Object.keys(poly.vertex_ids).length||
        poly.vertex_mirror_groups&&Object.keys(poly.vertex_mirror_groups).length||
        poly.annotations?.length||poly.measurements?.length||
        poly.target_lengths&&Object.keys(poly.target_lengths).length)
        throw Error('Multi-panel source has unsupported attached geometry or point count')
    }
    const old=sidecar.measurements,updated=reviewed.sidecar.measurements
    const names=Object.keys(old)
    if(names.length!==Object.keys(updated).length||
      Object.keys(updated).some(key=>!Object.hasOwn(old,key)))
      throw Error('Native multi-panel worksheet cannot add or remove measurements')
    const changed=names.filter(key=>{
      const previous=direct(old[key]),next=direct(updated[key])
      return Number.isFinite(previous)&&Number.isFinite(next)?previous!==next:!same(old[key],updated[key])
    })
    if(changed.length!==1)throw Error('Native multi-panel transaction requires exactly one changed direct value')
    const measurement=changed[0],expectedValueMm=direct(old[measurement]),valueMm=direct(updated[measurement])
    if(!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(measurement)||
      !within(expectedValueMm)||!within(valueMm)||Math.abs(expectedValueMm-valueMm)<1e-8)
      throw Error('One native edit requires an existing direct value changed within ±5000 mm')
    const oldValues=evalFormulas({measurements:old}),nextValues=evalFormulas({measurements:updated})
    if(!oldValues.ok||!nextValues.ok||sidecar.bindings.some(b=>
      !within(oldValues.valuesMm[b.distanceFormula])||!within(nextValues.valuesMm[b.distanceFormula])))
      throw Error('Native multi-panel formula or distance is not qualified')
    const current=plan(snapshot,sidecar)
    if(!current.ok||current.commands.length||current.steps.some(step=>!step.unchanged))
      throw Error(`Stored native point graph does not match its original physical geometry: ${current.reason||'drift'}`)
    const proposed=plan(snapshot,reviewed.sidecar)
    if(!proposed.ok||proposed.commands.length<2)
      throw Error(`Updated native formula cannot produce safe dependent points: ${proposed.reason||'no changes'}`)
    const affected=[...new Set(proposed.commands.map(cmd=>cmd.panel))].sort()
    if(affected.length<2||proposed.commands.some(cmd=>cmd.kind!=='Anchor'))
      throw Error('Native multi-panel edit must change two or more qualified pieces')
    return Object.freeze({ok:true,request:Object.freeze({
      op:'bindings-multipanel-measurement-recompute',revision:snapshot.revision,
      measurement,expectedValueMm,valueMm,
    }),changedBindingIds:proposed.steps.filter(step=>!step.unchanged).map(step=>step.bindingId),
    affectedPanels:affected,manufacturingApproved:false})
  }catch(error){return fail(error?.message||String(error))}
}

export function witnessModarisNativeMultiPanelMeasurementCommit20261030(before,after,sidecar,prepared){
  const reject=reason=>Object.freeze({...fail(reason),nativeCommitAlreadyOccurred:true,
    requiresOperatorRecovery:true,nativeRollbackAttempted:false})
  try{
    const reread=prepareModarisNativeMultiPanelMeasurementCommit20261030(
      before,sidecar,{ok:true,sidecar:{
        ...sidecar,measurements:{...sidecar.measurements,[prepared.request.measurement]:
          typeof sidecar.measurements[prepared.request.measurement]==='number'?
            prepared.request.valueMm:{valueMm:prepared.request.valueMm}}
      }})
    if(!prepared?.ok||!same(reread,prepared))throw Error('Multi-panel measurement proposal was altered or expired')
    const {measurement,valueMm}=prepared.request
    if(after?.revision!==before.revision+1||
      after?.nativeMeasurementRecompute?.nativeAuthoritative!==true||
      after.nativeMeasurementRecompute.oneUndoStep!==true||
      after.nativeMeasurementRecompute.measurement!==measurement||
      after.nativeMeasurementRecompute.panelCount!==prepared.affectedPanels.length||
      !same([...after.nativeMeasurementRecompute.affectedPanels].sort(),prepared.affectedPanels)||
      !same([...after.nativeMeasurementRecompute.correctedBindingIds].sort(),[...prepared.changedBindingIds].sort()))
      throw Error('Rust native multi-panel receipt disagrees with expected one-revision change')
    const native=after.nativePointBindings
    if(!native?.active||native.version!==1||native.manufacturingApproved!==false||
      !same(rules(native.bindings??[]),rules(sidecar.bindings??[])))
      throw Error('Rust did not preserve the qualified native construction graph')
    const expected=structuredClone(sidecar.measurements)
    expected[measurement]=typeof expected[measurement]==='number'?valueMm:{valueMm}
    if(!same(native.measurements,expected))throw Error('Rust persisted the wrong source measurements')
    if(!same({...before.template,panels:[]},{...after.template,panels:[]}))throw Error('Garment-level metadata changed')
    if(before.template.panels.length!==after?.template?.panels?.length)
      throw Error('Rust changed panel count during measurement propagation')
    const affected=new Set(prepared.affectedPanels)
    for(let i=0;i<before.template.panels.length;i++){
      const old=before.template.panels[i],next=after.template.panels[i]
      if(old.id!==next.id)throw Error('Rust changed saved panel identities')
      if(!affected.has(old.id)){
        if(!same(old,next))throw Error('Rust changed unrelated garment panel')
      }else if(!same(old.polygon.edges,next.polygon.edges)||
        !same(old.polygon.notches,next.polygon.notches)||
        !same(old.polygon.seam_allowances,next.polygon.seam_allowances)){
        throw Error('Rust changed manufacturing edge or mark identity')
      }else{
        const strip=p=>({...p,
          polygon:{...p.polygon,points:[],curves:{}},
          pattern:{...p.pattern,width:undefined,height:undefined},
          placement:{...p.placement,translation:undefined},layout_2d:undefined})
        if(!same(strip(old),strip(next)))
          throw Error('Rust changed non-geometric panel or manufacturing data')
        const oldPoints=old.polygon.points,newPoints=next.polygon.points
        if(!Array.isArray(oldPoints)||!Array.isArray(newPoints)||
          oldPoints.length!==newPoints.length||oldPoints.length>32||
          !oldPoints.every(vec2)||!newPoints.every(vec2))
          throw Error('Native panel lost its finite point inventory')
        const bound=new Set(sidecar.bindings.filter(b=>b.panelId===old.id).map(b=>b.pointIndex))
        const unbound=oldPoints.map((_,index)=>index).filter(index=>!bound.has(index))
        if(!unbound.length)throw Error('Native bound panel has no stable reference point')
        const origin=oldPoints[unbound[0]].map((v,k)=>newPoints[unbound[0]][k]-v)
        if(unbound.some(index=>oldPoints[index].some((v,k)=>!near(newPoints[index][k],v+origin[k]))))
          throw Error('Rust changed an unbound material reference anchor')
        const curves=old.polygon.curves??{},newCurves=next.polygon.curves??{}
        if(!same(Object.keys(curves).sort(),Object.keys(newCurves).sort()))
          throw Error('Rust changed the authored cubic curve inventory')
        for(let edgeIndex=0;edgeIndex<old.polygon.edges.length;edgeIndex++){
          const edge=old.polygon.edges[edgeIndex]
          if(!curves[edge])continue
          const oldControls=curves[edge],nextControls=newCurves[edge],
            end=(edgeIndex+1)%oldPoints.length
          if(!Array.isArray(oldControls)||!Array.isArray(nextControls)||
            oldControls.length!==2||nextControls.length!==2||
            !oldControls.every(vec2)||!nextControls.every(vec2)||
            !oldControls[0].every((v,k)=>near(nextControls[0][k]-v,newPoints[edgeIndex][k]-oldPoints[edgeIndex][k]))||
            !oldControls[1].every((v,k)=>near(nextControls[1][k]-v,newPoints[end][k]-oldPoints[end][k])))
            throw Error('Rust shifted a cubic handle independently of its attached anchor')
        }
        const angle=(old.layout_rotation_degrees??0)*Math.PI/180
        const shift=[-origin[0]*Math.cos(angle)+origin[1]*Math.sin(angle),
          -origin[0]*Math.sin(angle)-origin[1]*Math.cos(angle)]
        if(!vec2(old.layout_2d)||!vec2(next.layout_2d)||
          !next.layout_2d.every((v,k)=>near(v,old.layout_2d[k]+shift[k])))
          throw Error('Rust layout normalization disagrees with source material translation')
        const placement=old.placement?.translation,nextTranslation=next.placement?.translation
        const placementShift=rotated3([-origin[0],origin[1],0],old.placement?.rotation_degrees)
        if(!Array.isArray(placement)||!Array.isArray(nextTranslation)||
          placement.length!==3||nextTranslation.length!==3||
          !nextTranslation.every((v,k)=>near(v,placement[k]+placementShift[k])))
          throw Error('Rust 3D placement normalization changed independently of 2D pattern')
      }
    }
    const rebased=create(after,{measurements:native.measurements,bindings:native.bindings})
    if(!rebased.ok)throw Error(`Rust source graph could not be restored: ${rebased.reason}`)
    const solved=plan(after,rebased.sidecar)
    if(!solved.ok||solved.commands.length||solved.steps.some(step=>!step.unchanged))
      throw Error(`Recomputed native points fail saved rules: ${solved.reason||'geometry mismatch'}`)
    return Object.freeze({ok:true,committedRevision:after.revision,measurement,valueMm,
      correctedBindingIds:[...prepared.changedBindingIds],affectedPanels:[...prepared.affectedPanels],
      nativeEvidenceVerified:true,manufacturingApproved:false})
  }catch(error){return reject(error?.message||String(error))}
}

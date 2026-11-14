// Read-only cutter qualification worksheet. This module never emits cutter commands.
const finite=Number.isFinite
const refuse=(code,detail=code)=>({ok:false,code,detail,cuttingAuthorized:false,machineReady:false,manufacturingApproved:false})
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,72}$/.test(s)
const point=p=>p&&finite(p.xMm)&&finite(p.yMm)&&Math.abs(p.xMm)<1e8&&Math.abs(p.yMm)<1e8
// Validate the original centimeter value before multiplying. JS numeric
// coercion would otherwise accept null, strings and booleans as CUT marks,
// while BigInt values can throw rather than produce a refusal.
const cmCoord=value=>typeof value==='number'&&finite(value)&&Math.abs(value)<1e7
// Machine-neutral inspection only: a signed-area check alone accepts bowties,
// repeated vertices and overlapping edges. Require a simple closed polygon.
// Limit quadratic segment-pair inspection to the CUT worksheet's 4096-point
// budget rather than allowing arbitrary caller input to exhaust the receiver.
const CUT_VERTEX_LIMIT=4096
const CUT_INTERSECTION_EPS_MM=1e-7
// Match the upstream nested-mark placement tolerance (0.025 cm). This is a
// geometry-ownership check, not a physical knife-offset or cutter calibration.
const NOTCH_ANCHOR_TOLERANCE_MM=.25
function distanceToCutSegmentMm(p,a,b){
 const dx=b.xMm-a.xMm,dy=b.yMm-a.yMm
 const lengthSquared=dx*dx+dy*dy
 const t=lengthSquared?Math.max(0,Math.min(1,
  ((p.xMm-a.xMm)*dx+(p.yMm-a.yMm)*dy)/lengthSquared)):0
 return Math.hypot(p.xMm-a.xMm-t*dx,p.yMm-a.yMm-t*dy)
}
function onCutContourMm(p,path,tolerance){
 for(let i=0;i<path.length-1;i++)
  if(distanceToCutSegmentMm(p,path[i],path[i+1])<=tolerance)return true
 return false
}
function insideCutContourMm(p,path){
 if(onCutContourMm(p,path,.0001))return true
 let inside=false
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1]
  if((a.yMm>p.yMm)!==(b.yMm>p.yMm)&&
   p.xMm<(b.xMm-a.xMm)*(p.yMm-a.yMm)/(b.yMm-a.yMm)+a.xMm)
   inside=!inside
 }
 return inside
}
// A notch may start on the boundary and end inside a concave piece yet cross
// exterior fabric between those endpoints. Split the entire segment at every
// contour crossing and inspect each open interval, rather than trusting just
// the endpoint. This is a geometric ownership check, not a knife-path approval.
function notchStaysInsideCutContourMm(start,end,path){
 const rx=end.xMm-start.xMm,ry=end.yMm-start.yMm
 const rr=rx*rx+ry*ry
 if(rr<=0)return false
 const cross=(ax,ay,bx,by)=>ax*by-ay*bx
 const breaks=[0,1]
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1]
  const sx=b.xMm-a.xMm,sy=b.yMm-a.yMm
  const qx=a.xMm-start.xMm,qy=a.yMm-start.yMm
  const den=cross(rx,ry,sx,sy)
  const threshold=1e-12*Math.max(1,Math.hypot(rx,ry)*Math.hypot(sx,sy))
  if(Math.abs(den)>threshold){
   const t=cross(qx,qy,sx,sy)/den
   const u=cross(qx,qy,rx,ry)/den
   if(t>=0&&t<=1&&u>=0&&u<=1)breaks.push(t)
  }else if(Math.abs(cross(qx,qy,rx,ry))<=threshold){
   // Collinear edge: retain its overlap endpoints as interval boundaries.
   for(const t of [(qx*rx+qy*ry)/rr,((b.xMm-start.xMm)*rx+(b.yMm-start.yMm)*ry)/rr])
    if(t>=0&&t<=1)breaks.push(t)
  }
 }
 breaks.sort((a,b)=>a-b)
 for(let i=1;i<breaks.length;i++){
  if(breaks[i]-breaks[i-1]<=1e-10)continue
  const t=(breaks[i]+breaks[i-1])/2
  if(!insideCutContourMm({xMm:start.xMm+t*rx,yMm:start.yMm+t*ry},path))return false
 }
 return true
}
function cutContourHasSelfIntersection(path){
 const count=path.length-1
 const orient=(a,b,c)=>(b.xMm-a.xMm)*(c.yMm-a.yMm)-(b.yMm-a.yMm)*(c.xMm-a.xMm)
 const onSegment=(a,b,c)=>c.xMm>=Math.min(a.xMm,b.xMm)-CUT_INTERSECTION_EPS_MM&&
  c.xMm<=Math.max(a.xMm,b.xMm)+CUT_INTERSECTION_EPS_MM&&
  c.yMm>=Math.min(a.yMm,b.yMm)-CUT_INTERSECTION_EPS_MM&&
  c.yMm<=Math.max(a.yMm,b.yMm)+CUT_INTERSECTION_EPS_MM
 const sign=(v,scale)=>v>scale?1:v< -scale?-1:0
 for(let i=0;i<count;i++){
  const a=path[i],b=path[i+1]
  if(Math.hypot(a.xMm-b.xMm,a.yMm-b.yMm)<=CUT_INTERSECTION_EPS_MM)return true
  // A 180-degree reversal at an adjacent edge is overlapping even though
  // neighboring segments normally share one allowed endpoint.
  const next=path[(i+2)%count],abx=b.xMm-a.xMm,aby=b.yMm-a.yMm
  const bcx=next.xMm-b.xMm,bcy=next.yMm-b.yMm
  if(Math.abs(abx*bcy-aby*bcx)<=CUT_INTERSECTION_EPS_MM*Math.max(1,Math.hypot(abx,aby),Math.hypot(bcx,bcy))&&
    abx*bcx+aby*bcy<0)return true
  for(let j=i+2;j<count;j++){
   if(i===0&&j===count-1)continue // shared closing vertex
   const c=path[j],d=path[j+1]
   if(Math.max(a.xMm,b.xMm)+CUT_INTERSECTION_EPS_MM<Math.min(c.xMm,d.xMm)||
      Math.max(c.xMm,d.xMm)+CUT_INTERSECTION_EPS_MM<Math.min(a.xMm,b.xMm)||
      Math.max(a.yMm,b.yMm)+CUT_INTERSECTION_EPS_MM<Math.min(c.yMm,d.yMm)||
      Math.max(c.yMm,d.yMm)+CUT_INTERSECTION_EPS_MM<Math.min(a.yMm,b.yMm))continue
   const scale= CUT_INTERSECTION_EPS_MM*Math.max(1,Math.hypot(b.xMm-a.xMm,b.yMm-a.yMm),Math.hypot(d.xMm-c.xMm,d.yMm-c.yMm))
   const o1=sign(orient(a,b,c),scale),o2=sign(orient(a,b,d),scale)
   const o3=sign(orient(c,d,a),scale),o4=sign(orient(c,d,b),scale)
   if((o1===0&&onSegment(a,b,c))||(o2===0&&onSegment(a,b,d))||
      (o3===0&&onSegment(c,d,a))||(o4===0&&onSegment(c,d,b))||
      (o1!==o2&&o3!==o4))return true
  }
 }
 return false
}
/** Explicit machine envelope and device capability contract. A claimed device
 * name, operator or successful local preview can never authorize cutting. */
export function qualifyIndustrialCutterStudy20261028(study,markTransfer,profile,{calibration=null,receiverAcceptance=null}={}){
 if(study?.ok!==true||study.format!=='exo.machine-neutral-CUT-inspection.v1'||!Array.isArray(study.records)||!study.records.length||
   !finite(study.fabricWidthMm)||study.fabricWidthMm<=0||!markTransfer||markTransfer.ok!==true||!Array.isArray(markTransfer.placements))return refuse('UNVERIFIED_CUT_SOURCE')
 if(!profile||!id(profile.profileId)||!id(profile.manufacturer)||!id(profile.model)||!finite(profile.bedWidthMm)||profile.bedWidthMm<=0||
   !finite(profile.bedLengthMm)||profile.bedLengthMm<=0||typeof profile.supportsNotches!=='boolean'||typeof profile.supportsDrills!=='boolean')return refuse('INVALID_MACHINE_PROFILE')
 const issues=[],seen=new Set(),index=new Map()
 let transferredNotches=0,transferredDrills=0
 // This is a machine-neutral geometry worksheet, not an executable machine
 // program. Its own serialization contract explicitly uses millimeters,
 // carries no command protocol/driver and never claims physical authorization.
 // Validate those fields rather than trusting the worksheet's ok flag.
 if(study.units!=='mm')issues.push({code:'CUT_WORKSHEET_UNITS_INVALID'})
 if(study.commandProtocol!==null||study.hardwareDriver!==null)
  issues.push({code:'CUT_WORKSHEET_PROTOCOL_PRESENT'})
 if(study.cuttingAuthorized!==false||study.manufacturingApproved!==false)
  issues.push({code:'CUT_WORKSHEET_AUTHORIZATION_CLAIM'})
 // Nested mark-transfer coordinates are global marker cm, not local pattern
 // coordinates. The cutter study uses mm; apply the same 0.0001 mm envelope
 // tolerance to both notch endpoints and drill centers after conversion.
 const withinBed=p=>p.xMm>=-.0001&&p.yMm>=-.0001&&p.xMm<=profile.bedWidthMm+.0001&&p.yMm<=profile.bedLengthMm+.0001
 // Never construct a lossy Map from untrusted transferred inventory: duplicate
 // placement identities previously overwrote earlier marks and could pass.
 const instanceKey=p=>p&&typeof p.pieceId==='string'&&p.pieceId.length>0&&!p.pieceId.includes('\0')&&
  Number.isSafeInteger(p.instance)&&p.instance>=0?`${p.pieceId}\0${p.instance}`:null
 for(const placement of markTransfer.placements){
  const key=instanceKey(placement)
  if(key===null){issues.push({code:'INVALID_MARK_INSTANCE'});continue}
  if(index.has(key)){issues.push({code:'DUPLICATE_MARK_INSTANCE',key});continue}
  index.set(key,placement)
  if(!Array.isArray(placement.notches)||!Array.isArray(placement.drills))issues.push({code:'INVALID_MARKS',key})
  else{
   transferredNotches+=placement.notches.length
   transferredDrills+=placement.drills.length
  }
  // The DXF-checked nested transfer explicitly declares whether all authored
  // physical notches survived placement. Never silently upgrade a false flag
  // into a passing machine-neutral worksheet. Older standalone fixtures may
  // omit this optional field, but any supplied value must be true.
  if(Object.hasOwn(placement,'physicalNotchesPreserved')&&placement.physicalNotchesPreserved!==true)
   issues.push({code:'PHYSICAL_NOTCH_TRANSFER_INCOMPLETE',key})
 }
 // Production transfer summaries are not authority by themselves, but their
 // mismatch with the actual nested instance inventory is a concrete loss of
 // manufacturing marks. Preserve legacy worksheets that omit summaries.
 if(Object.hasOwn(markTransfer,'notchCount')&&
   (!Number.isSafeInteger(markTransfer.notchCount)||markTransfer.notchCount!==transferredNotches))
  issues.push({code:'MARK_TRANSFER_NOTCH_COUNT_MISMATCH'})
 if(Object.hasOwn(markTransfer,'drillCount')&&
   (!Number.isSafeInteger(markTransfer.drillCount)||markTransfer.drillCount!==transferredDrills))
  issues.push({code:'MARK_TRANSFER_DRILL_COUNT_MISMATCH'})
 if(study.fabricWidthMm>profile.bedWidthMm)issues.push({code:'BED_WIDTH_EXCEEDED'})
 for(const row of study.records){
  const key=instanceKey(row)
  if(key===null){issues.push({code:'INVALID_CUT_INSTANCE'});continue}
  if(seen.has(key)){issues.push({code:'DUPLICATE_CUT_INSTANCE',key});continue}seen.add(key)
  if(row.units!=='mm'||row.closed!==true){
   issues.push({code:'CUT_RECORD_METADATA_INVALID',key});continue
  }
  if(row.notchCuttingVerified!==false||row.drillVerified!==false||
    row.materialVerificationRequired!==true){
   issues.push({code:'CUT_RECORD_AUTHORIZATION_CLAIM',key});continue
  }
  const marks=index.get(key)
  if(!marks){issues.push({code:'MISSING_MARK_INSTANCE',key});continue}
  if(!Array.isArray(row.physicalCutPathMm)||row.physicalCutPathMm.length<4||row.physicalCutPathMm.length>CUT_VERTEX_LIMIT){issues.push({code:'INVALID_CUT_POINTS',key});continue}
  // Array.some/map skip sparse slots; a hole previously made maxY NaN and
  // silently passed both geometry and cutter-bed checks. for..of visits holes
  // as undefined, and a streaming maximum avoids spread-argument overflow.
  let validPath=true,maxY=-Infinity,outOfBed=false
  for(const p of row.physicalCutPathMm){
   if(!point(p)){validPath=false;break}
   if(p.yMm>maxY)maxY=p.yMm
   if(p.xMm<-.0001||p.yMm<-.0001||p.xMm>profile.bedWidthMm+.0001)outOfBed=true
  }
  if(!validPath){issues.push({code:'INVALID_CUT_POINTS',key});continue}
  // A CUT contour is a closed manufacturing boundary, not an arbitrary
  // polyline. Finite, in-bed open paths previously passed this inspection.
  // Coordinates are quantized to 0.0001 mm in the marker CUT worksheet.
  const path=row.physicalCutPathMm
  const first=path[0],last=path[path.length-1]
  if(Math.hypot(first.xMm-last.xMm,first.yMm-last.yMm)>0.0001){
   issues.push({code:'CUT_CONTOUR_NOT_CLOSED',key});continue
  }
  // Reject collapsed/collinear closed paths. Compute the shoelace area
  // relative to the first vertex to reduce cancellation for large offsets.
  let twiceArea=0
  for(let i=1;i<path.length-1;i++){
   const a=path[i],b=path[i+1]
   twiceArea+=(a.xMm-first.xMm)*(b.yMm-first.yMm)-
    (b.xMm-first.xMm)*(a.yMm-first.yMm)
  }
  if(!Number.isFinite(twiceArea)||Math.abs(twiceArea)<=0.000001){
   issues.push({code:'CUT_CONTOUR_DEGENERATE',key});continue
  }
  if(cutContourHasSelfIntersection(path)){
   issues.push({code:'CUT_CONTOUR_SELF_INTERSECTION',key});continue
  }
  if(maxY>profile.bedLengthMm+1e-4)issues.push({code:'BED_LENGTH_EXCEEDED',key})
  if(outOfBed)issues.push({code:'BED_BOUNDS_EXCEEDED',key})
  if(!Array.isArray(marks.notches)||!Array.isArray(marks.drills)){issues.push({code:'INVALID_MARKS',key});continue}
  if(marks.notches.length&&!profile.supportsNotches)issues.push({code:'NOTCH_TOOL_UNSUPPORTED',key})
  if(marks.drills.length&&!profile.supportsDrills)issues.push({code:'DRILL_TOOL_UNSUPPORTED',key})
  // Array.some skips holes: a sparse marks array must not masquerade as
  // geometrically validated notches or drill locations.
  for(const n of marks.notches){
   const sx=n?.startCm?.x,sy=n?.startCm?.y,ex=n?.endCm?.x,ey=n?.endCm?.y
   if(!cmCoord(sx)||!cmCoord(sy)||!cmCoord(ex)||!cmCoord(ey)){
    issues.push({code:'INVALID_NOTCH_GEOMETRY',key});break
   }
   const start={xMm:sx*10,yMm:sy*10}
   const end={xMm:ex*10,yMm:ey*10}
   // A physical notch is a cut segment, not just a marker point. A zero or
   // sub-quantization segment can disappear from the machine-neutral CUT
   // worksheet even when its two endpoints are finite and inside the bed.
   if(Math.hypot((ex-sx)*10,(ey-sy)*10)<=0.0001){
    issues.push({code:'NOTCH_SEGMENT_DEGENERATE',key});break
   }
   if(!withinBed(start)||!withinBed(end)){
    issues.push({code:'NOTCH_BED_BOUNDS_EXCEEDED',key});break
   }
   // An in-bed mark can still be detached from its own nested CUT instance,
   // or point outward into adjacent fabric. Bed limits alone do not prove
   // contour ownership or an inward notch transfer.
   if(!onCutContourMm(start,path,NOTCH_ANCHOR_TOLERANCE_MM)){
    issues.push({code:'NOTCH_CONTOUR_ANCHOR_MISMATCH',key});break
   }
   if(!insideCutContourMm(end,path)){
    issues.push({code:'NOTCH_OUTSIDE_CUT_CONTOUR',key});break
   }
   if(!notchStaysInsideCutContourMm(start,end,path)){
    issues.push({code:'NOTCH_TRANSITS_OUTSIDE_CUT_CONTOUR',key});break
   }
  }
  for(const p of marks.drills){
   const x=p?.xCm,y=p?.yCm
   if(!cmCoord(x)||!cmCoord(y)){
    issues.push({code:'INVALID_DRILL_GEOMETRY',key});break
   }
   const center={xMm:x*10,yMm:y*10}
   if(!withinBed(center)){
    issues.push({code:'DRILL_BED_BOUNDS_EXCEEDED',key});break
   }
   if(!insideCutContourMm(center,path)){
    issues.push({code:'DRILL_OUTSIDE_CUT_CONTOUR',key});break
   }
  }
 }
 if(seen.size!==index.size)issues.push({code:'UNMATCHED_PLACEMENTS'})
 if(!calibration||calibration.referenceLengthMm!==100||!finite(calibration.measuredLengthMm)||Math.abs(calibration.measuredLengthMm-100)>.2||
   !id(calibration.operatorId)||typeof calibration.measuredAt!=='string'||!/^\d{4}-\d\d-\d\d/.test(calibration.measuredAt))issues.push({code:'CALIBRATION_NOT_VERIFIED'})
 if(!receiverAcceptance||receiverAcceptance.accepted!==true||!id(receiverAcceptance.application)||!id(receiverAcceptance.version)||!id(receiverAcceptance.operatorId)||
   !Array.isArray(receiverAcceptance.evidenceFiles)||!receiverAcceptance.evidenceFiles.length||
   receiverAcceptance.evidenceFiles.some(file=>typeof file!=='string'||!file.trim()||file.length>256)||
   new Set(receiverAcceptance.evidenceFiles).size!==receiverAcceptance.evidenceFiles.length)
   issues.push({code:'RECEIVER_ACCEPTANCE_NOT_DOCUMENTED'})
 // Inspection passing does not imply certified electrical interlocks, material,
 // cutter firmware semantics, knife offsets, feed dynamics, or signed approval.
 return {ok:issues.length===0,status:issues.length?'BLOCKED':'DOCUMENTED_ENGINEERING_REVIEW',issues,
   machine:{profileId:profile.profileId,manufacturer:profile.manufacturer,model:profile.model},
   cuts:seen.size,notches:[...index.values()].reduce((n,p)=>n+(Array.isArray(p.notches)?p.notches.length:0),0),
   cutterProtocolVerified:false,physicalInterlocksVerified:false,materialQualified:false,
   machineReady:false,cuttingAuthorized:false,manufacturingApproved:false,
   warning:'Machine profile and calibration evidence are informational. Never send this report to a cutter or interpret it as machine qualification.'}
}

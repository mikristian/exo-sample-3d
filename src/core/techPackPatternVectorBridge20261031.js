import {vectorcraftAnchorKind} from './vectorcraftAnchorPort.js'

const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const num=n=>Number(n.toFixed(8))
const local=(p,min,scale)=>[num((p[0]-min[0])*scale),num((p[1]-min[1])*scale)]
const format=p=>`${p[0]} ${p[1]}`

/**
 * Copy native panel outline into an editable TechPack path. Native source is
 * immutable; coordinates in panel.polygon are physical metres. Curved edges
 * use source cubic controls, never traced pixels or sampled approximations.
 * The returned path is a drawing copy, not a factory release or pattern edit.
 */
export function nativePatternPanelToTechPackPath(panel,{id,pageId='patterns',x=48,y=120,maxWidth=500,maxHeight=500,
    stroke='#171717',fill='none',strokeWidth=1.5,sourceFile=null}={}){
  const polygon=panel?.polygon,vertices=polygon?.points,edges=polygon?.edges
  if(typeof panel?.id!=='string'||!panel.id||!Array.isArray(vertices)||vertices.length<3||vertices.length>1000||
     !vertices.every(point)||!Array.isArray(edges)||edges.length!==vertices.length||
     edges.some(e=>typeof e!=='string'||!e)||new Set(edges).size!==edges.length)
    throw new TypeError('Expected a native panel with finite polygon points and distinct ordered edge IDs')
  if(![x,y,maxWidth,maxHeight,strokeWidth].every(Number.isFinite)||maxWidth<=0||maxHeight<=0||strokeWidth<0)
    throw new TypeError('Invalid Tech Pack path placement')
  if(!/^(?:#[a-f0-9]{6}|none)$/i.test(fill)||!/^(?:#[a-f0-9]{6}|none)$/i.test(stroke))
    throw new TypeError('Invalid vector fill or stroke')
  const xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);const min=[Math.min(...xs),Math.min(...ys)]
  const max=[Math.max(...xs),Math.max(...ys)]
  const width=max[0]-min[0],height=max[1]-min[1]
  if(width<=1e-12||height<=1e-12)throw new TypeError('Degenerate native panel outline')
  const controls=edges.map(edge=>polygon.curves?.[edge]??null)
  if(controls.some(c=>c!==null&&(!Array.isArray(c)||c.length!==2||!c.every(point))))
    throw new TypeError('Invalid native cubic controls')
  // Bounds include Bézier control hull so all editable anchors stay inside the object.
  const all=[...vertices,...controls.flatMap(c=>c||[])]
  const low=[Math.min(...all.map(p=>p[0])),Math.min(...all.map(p=>p[1]))]
  const high=[Math.max(...all.map(p=>p[0])),Math.max(...all.map(p=>p[1]))]
  const span=[high[0]-low[0],high[1]-low[1]]
  const scale=Math.min(maxWidth/span[0],maxHeight/span[1])
  if(!Number.isFinite(scale)||scale<=0)throw new TypeError('Invalid native scale')
  const positions=vertices.map(p=>local(p,low,scale))
  const anchors=positions.map((p,i)=>{
    const incoming=controls[(i+vertices.length-1)%vertices.length]
    const outgoing=controls[i]
    const hIn=incoming?local(incoming[1],low,scale):p.slice()
    const hOut=outgoing?local(outgoing[0],low,scale):p.slice()
    return {p,hIn,hOut,kind:vectorcraftAnchorKind(p,hIn,hOut),sourcePointIndex:i,
      sourceVertexId:polygon.vertex_ids?.[i]??null,incomingEdgeId:edges[(i+edges.length-1)%edges.length],outgoingEdgeId:edges[i]}
  })
  let d=`M ${format(positions[0])}`
  for(let i=0;i<vertices.length;i++){
    const next=positions[(i+1)%vertices.length],curve=controls[i]
    d+=curve?` C ${format(local(curve[0],low,scale))} ${format(local(curve[1],low,scale))} ${format(next)}`:
      ` L ${format(next)}`
  }
  d+=' Z'
  return {id:id||`source-pattern-${panel.id}`,kind:'path',name:`${panel.name||panel.id} · source outline`,
    x,y,width:num(span[0]*scale),height:num(span[1]*scale),d,anchors,
    stroke,fill,strokeWidth,fillRule:'evenodd',opacity:1,hidden:false,locked:false,
    sourceLink:{kind:'native-pattern-panel',panelId:panel.id,pageId,sourceFile,
      pointUnits:'metres',sourceBounds:{min:low.slice(),max:high.slice()},scalePointsPerMetre:scale,
      edgeIds:edges.slice(),sourcePolygon:structuredClone(polygon)},
    productionQualified:false}
}

/** Returns new vectorObjects mapping without touching the native source. */
export function appendNativePatternVectorToTechPack(workspace,pageId,panel,options={}){
  if(typeof pageId!=='string'||!pageId)throw new TypeError('pageId is required')
  const path=nativePatternPanelToTechPackPath(panel,{...options,pageId})
  const before=workspace?.vectorObjects?.[pageId]||[]
  if(!Array.isArray(before)||before.some(item=>item.id===path.id))throw new TypeError('Duplicate vector ID or invalid page vector layer')
  return {...workspace,vectorObjects:{...workspace?.vectorObjects,[pageId]:[...before,path]}}
}

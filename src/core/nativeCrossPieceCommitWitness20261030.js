const fail=reason=>Object.freeze({ok:false,reason,manufacturingApproved:false})
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8
const point=(template,id,index)=>{
  const panels=template?.panels
  if(!Array.isArray(panels)||panels.filter(p=>p?.id===id).length!==1)return null
  const p=panels.find(p=>p.id===id)
  const vertices=p?.polygon?.points
  if(!Number.isSafeInteger(index)||index<0||!Array.isArray(vertices)||index>=vertices.length||!finitePoint(vertices[index]))return null
  return {panel:p,material:vertices[index]}
}
const board=({panel,material})=>{
  const origin=panel.layout_2d??[0,0]
  const degrees=panel.layout_rotation_degrees??0
  if(!finitePoint(origin)||!Number.isFinite(degrees))return null
  const theta=degrees*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta)
  return [origin[0]+material[0]*c-material[1]*s,
    origin[1]+material[0]*s+material[1]*c]
}
const rotated=(delta,degrees)=>{
  if(!finitePoint(delta)||!Number.isFinite(degrees))return null
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a)
  return [delta[0]*c-delta[1]*s,delta[0]*s+delta[1]*c]
}
const relation=({template,nativeCrossPieceLink:link})=>{
  if(link?.active!==true||link.version!==1||link.sourcePanelId===link.targetPanelId||
    !finitePoint(link.boardOffsetM)||link.boardOffsetM.some(v=>Math.abs(v)>10)||
    link.manufacturerApproved!==false)return null
  const a=point(template,link.sourcePanelId,link.sourcePointIndex)
  const b=point(template,link.targetPanelId,link.targetPointIndex)
  if(!a||!b)return null
  const x=board(a),y=board(b)
  if(!x||!y||!x.every((v,i)=>close(y[i]-v,link.boardOffsetM[i])))return null
  return {link,a,b}
}

/** A strict browser-side witness for a native cross-piece response.
 * Rust remains the authority; this prevents a valid-looking revision/flag
 * from being advertised as a verified source/target operation when the
 * returned geometry or link identity actually disagrees with the request.
 * The native grading catalog and real physical output need separate proofs.
 */
export function verifyNativeCrossPieceCommit20261030(before,request,after){
  try{
    const op=request?.op
    if(!['native-cross-piece-install','native-cross-piece-move','native-cross-piece-clear'].includes(op)||
      !Number.isSafeInteger(before?.revision)||before.revision<0||
      request.revision!==before.revision||after?.revision!==before.revision+1||
      !after?.template||!before?.template||after.manufacturingApproved!==false||
      before.gradeRunPersisted!==after.gradeRunPersisted)
      throw Error('Native cross-piece revision, project or grade identity mismatch')
    if(op==='native-cross-piece-clear'){
      if(!before.nativeCrossPieceLink?.active||after.nativeCrossPieceLink!=null||
        !same(before.template,after.template))
        throw Error('Native link removal changed garment geometry or did not clear the link')
      return Object.freeze({ok:true,operation:'clear',manufacturingApproved:false})
    }
    const metadata=after.nativeCrossPieceCommit
    if(metadata?.operation!==(op==='native-cross-piece-install'?'install':'move')||
      metadata.nativeAuthoritative!==true||metadata.oneUndoStep!==true||
      metadata.manufacturingApproved!==false)
      throw Error('Native cross-piece transaction lacks a qualified Rust commit')
    const next=relation(after)
    if(!next)throw Error('Native cross-piece geometry violates the persisted board-space relationship')
    const link=next.link
    if(op==='native-cross-piece-install'){
      if(before.nativeCrossPieceLink!=null||!same(before.template,after.template)||
        link.sourcePanelId!==request.sourcePanelId||link.sourcePointIndex!==request.sourcePointIndex||
        link.targetPanelId!==request.targetPanelId||link.targetPointIndex!==request.targetPointIndex)
        throw Error('Native link installation changed garment geometry or linked the wrong anchors')
    }else{
      const prior=relation(before)
      if(!prior||request.sourcePanelId!==prior.link.sourcePanelId||
        !same([link.sourcePanelId,link.sourcePointIndex,link.targetPanelId,link.targetPointIndex,link.boardOffsetM],
          [prior.link.sourcePanelId,prior.link.sourcePointIndex,prior.link.targetPanelId,prior.link.targetPointIndex,prior.link.boardOffsetM])||
        !finitePoint(request.expectedPosition)||!finitePoint(request.position)||
        !request.expectedPosition.every((v,i)=>close(v,prior.a.material[i])))
        throw Error('Native cross-piece move changed link identity or returned the wrong source point')
      // AnchorGroup normalizes the polygon's local material coordinates and
      // shifts its layout_2d by the opposite amount. A curved Bézier handle
      // extending below zero can therefore change the returned local Y even
      // when the operator requested an X-only edit. The *board-space* delta
      // must match the rotated requested material delta exactly; comparing
      // the returned local anchor to position would reject valid Rust edits.
      const priorBoard=board(prior.a),nextBoard=board(next.a)
      const delta=rotated(request.position.map((v,i)=>v-request.expectedPosition[i]),
        prior.a.panel.layout_rotation_degrees??0)
      if(!priorBoard||!nextBoard||!delta||
        !nextBoard.every((v,i)=>close(v,priorBoard[i]+delta[i])))
        throw Error('Native cross-piece source board displacement differs from the requested edit')
      // This is a linked two-panel operation, not an unannounced edit of a
      // third piece. Pattern normalization on the two linked pieces is Rust-owned.
      const ids=new Set([link.sourcePanelId,link.targetPanelId])
      const oldPanels=before.template.panels,newPanels=after.template.panels
      if(!Array.isArray(oldPanels)||!Array.isArray(newPanels)||oldPanels.length!==newPanels.length||
        oldPanels.some((p,i)=>p.id!==newPanels[i]?.id||(!ids.has(p.id)&&!same(p,newPanels[i]))))
        throw Error('Native linked source edit unexpectedly modified unrelated pattern pieces')
    }
    return Object.freeze({ok:true,operation:metadata.operation,manufacturingApproved:false})
  }catch(error){return fail(error?.message??String(error))}
}

// Read-only revision-tagged bridge projection for cheap status polling.
// Never replace the full native snapshot: this intentionally omits editable
// geometry, body mesh, seam topology, graphics and document data.
export function nativeWorkspaceSummary20261030(snapshot,{busy=false,running=false}={}){
  if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||
     !Array.isArray(snapshot?.template?.panels)||
     !Array.isArray(snapshot.positions)||!Array.isArray(snapshot.triangles)||
     snapshot.template.panels.length>20_000||
     snapshot.positions.length>2_000_000||snapshot.triangles.length>4_000_000)
    throw Error('NATIVE_WORKSPACE_SUMMARY_INVALID_SOURCE')
  return Object.freeze({
    format:'exo.native-workspace-status.v1',
    sourceRevision:snapshot.revision,
    nativeCoordinateUnit:'m',
    pieceCount:snapshot.template.panels.length,
    vertexCount:snapshot.positions.length,
    triangleCount:snapshot.triangles.length,
    activeGradedSize:typeof snapshot.activeGradedSize==='string'?snapshot.activeGradedSize:null,
    canUndo:Boolean(snapshot.canUndo),
    canRedo:Boolean(snapshot.canRedo),
    busy:Boolean(busy),running:Boolean(running),
    sourceOnly:true,factoryCertified:false,
  })
}

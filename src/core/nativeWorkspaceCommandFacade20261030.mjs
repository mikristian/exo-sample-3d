// @typedef {{revision:number, template:{panels:Array<{id:string}>}}} NativeWorkspaceSnapshot
// @typedef {{op:'edit',revision:number,command:{kind:'Anchor',panel:string,anchor:number,position:number[]}}} NativeAnchorRequest
// All native pattern coordinates are metres. UI coordinate inputs are millimetres.
const point=(coordinates)=>Array.isArray(coordinates)&&coordinates.length===2&&coordinates.every(Number.isFinite)
function identity(snapshot,panelId){
  if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||
    typeof panelId!=='string'||!snapshot?.template?.panels?.some(p=>p.id===panelId))
    throw Error('Native source revision/panel identity invalid')
  return snapshot.revision
}
export function nativeAnchorCoordinateRequest20261030(snapshot,{panel,anchor,positionMm}){
  const revision=identity(snapshot,panel)
  if(!Number.isSafeInteger(anchor)||anchor<0||!point(positionMm)||
    positionMm.some(v=>Math.abs(v)>50_000))throw Error('Invalid 2D anchor millimetres')
  const source=snapshot.template.panels.find(p=>p.id===panel)
  if(!source?.polygon?.points?.[anchor])throw Error('Native anchor no longer exists')
  const position=Object.freeze(positionMm.map(v=>v/1000))
  return Object.freeze({op:'edit',revision,command:Object.freeze({kind:'Anchor',panel,anchor,position}),sourceUnit:'mm',nativeUnit:'m'})
}
export function nativeBoardResetBatchRequest20261030(snapshot){
  if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||!Array.isArray(snapshot?.template?.panels))throw Error('Invalid native revision')
  if(snapshot.template.panels.length>256)throw Error('Native 2D board batch exceeds 256 panels')
  let x=0
  const commands=snapshot.template.panels.map(panel=>{
    identity(snapshot,panel.id)
    if(!Number.isFinite(panel.pattern?.width)||panel.pattern.width<0||
      panel.pattern.width>50||x+panel.pattern.width+0.15>50)
      throw Error('Invalid board width in metres')
    const command=Object.freeze({kind:'BoardTransform',panel:panel.id,origin:Object.freeze([x,0]),rotation_degrees:0})
    x+=panel.pattern.width+0.15
    return command
  })
  return Object.freeze({op:'edit-batch',revision:snapshot.revision,commands:Object.freeze(commands),nativeUnit:'m'})
}
// The request hook remains responsible for native CAS and error handling.
export function nativeFacadeWireRequest20261030(request,snapshot,facade){
  if(snapshot?.revision!==facade?.revision)throw Error('Stale native workspace revision')
  if(facade.op==='edit')return request({op:'edit',revision:facade.revision,command:facade.command})
  if(facade.op==='edit-batch')return request({op:'edit-batch',revision:facade.revision,commands:facade.commands})
  throw Error('Unsupported native facade request')
}

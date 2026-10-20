import {createPortal} from 'react-dom'
import React,{useState,useEffect,useRef,useCallback,useMemo} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import ClothCraftFabricLibrary from './ClothCraftFabricLibrary.jsx'
import ClothCraftGraphicEditor from './ClothCraftGraphicEditor.jsx'
import {normalizeGarmentGraphic} from '../core/nativeGarmentGraphics.js'
import {importedCloHardwareDimensions} from '../core/importedCloHardwareDimensions.js'
import {readNativeGraphics,saveNativeGraphics} from '../core/nativeGraphicStorage.js'
import ClothCraftSceneV2 from './ClothCraftSceneV2.jsx'
import FoamMaterialPropertyEditor from './FoamMaterialPropertyEditor.jsx'
import {parseSvgPattern} from '../core/svgPatternImport.js'
import {safeFoamEdgeWidth} from './FoamPaddingNativeOverlay.jsx'
import CameraFabricHand from './CameraFabricHand.jsx'
import ClothCraftBoardV2 from './ClothCraftBoardV2.jsx'
import NativePatternAuditPanel from './NativePatternAuditPanel.jsx'
import ClothCraftContextMenu from './ClothCraftContextMenu.jsx'
import {CloFloatingPanel} from './CloFinishingToolWidgets.jsx'
import {measureNativeSelection} from '../core/clothcraftSelectionMetrics.js'
import {CLOTHCRAFT_FABRICS,presetProperties,validFabric} from '../core/clothcraftFabrics.js'
import {Scissors,Shirt,Layers,UserRound,Activity,Factory,Sun,FolderOpen,Save,Download,Undo2,Redo2,Play,Pause,RotateCcw,MousePointer2,PenTool,Move3D,Rotate3D,Search,Settings2,Eye,EyeOff,Grid2X2,Box,ChevronRight,FilePlus2,BookOpen,UploadCloud,LockKeyhole,UnlockKeyhole,SlidersHorizontal,Trash2} from 'lucide-react'
import './ClothCraftWorkspace.css'
import './ClothCraftToolDialogs.css'
import './ClothCraftExoShell.css'
// The signed Mac app always serves its UI on 5386 and its native Rust bridge
// on 5385. Resolve that pair at runtime: concurrent local builds can omit the
// VITE_* production variable, and must never send desktop commands to 5193.
const BASE=typeof window!=='undefined'&&window.location.port==='5486'
  ? 'http://127.0.0.1:5485'
  : typeof window!=='undefined'&&window.location.port==='5386'
    ? 'http://127.0.0.1:5385'
  : (import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL||'http://127.0.0.1:5193')
const COLORS=['#527e91','#d29465','#7a9e79','#a889b2','#c3ab5d','#76a5a4']
const EXO_SECTIONS=[['Pattern',Shirt],['Sewing',Scissors],['Fabric',Layers],['Avatar',UserRound],['Fit',Activity],['Production',Factory],['Render',Sun]]
const weighted=(weights,values)=>weights.reduce((p,[i,w])=>p.map((n,k)=>n+values[i][k]*w),values[0].map(()=>0))
function boardPoint(s,i){const range=s.panels.find(p=>i>=p.vertices[0]&&i<p.vertices[1]),p=s.template.panels.find(p=>p.id===range.id),a=(p.layout_rotation_degrees||0)*Math.PI/180,[u,v]=s.uv[i];return[range.layout[0]+u*Math.cos(a)-v*Math.sin(a),range.layout[1]+u*Math.sin(a)+v*Math.cos(a)]}
function Scene({snapshot,active,selected,mode,onPick,onHover,onPlace,showAvatar=true,showSeams=true,wireframe=false}){
 const host=useRef(),engine=useRef(),latest=useRef();latest.current={onPick,onHover,onPlace,selected}
 useEffect(()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e6e7e5');
  const camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.set(2,1.4,3)
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.current.appendChild(renderer.domElement)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true
  scene.add(new THREE.HemisphereLight(0xffffff,0x77736e,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,4,3);scene.add(light)
  const grid=new THREE.GridHelper(4,40,0xb5b8b5,0xd0d2cf);scene.add(grid)
  const cloth=new THREE.Group(),body=new THREE.Group(),lines=new THREE.Group();scene.add(cloth,body,lines)
  const pivot=new THREE.Object3D();scene.add(pivot);const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());
  transform.addEventListener('dragging-changed',e=>{controls.enabled=!e.value})
  transform.addEventListener('mouseUp',()=>{if(latest.current.selected)latest.current.onPlace({kind:'Place',panel:latest.current.selected.panel,placement:{translation:pivot.position.toArray(),rotation_degrees:[pivot.rotation.x,pivot.rotation.y,pivot.rotation.z].map(n=>THREE.MathUtils.radToDeg(n))}})})
  const ray=new THREE.Raycaster();ray.params.Line.threshold=.008
  const hit=e=>{const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const boundary=ray.intersectObjects(lines.children).find(h=>h.object.userData.edge);const surface=ray.intersectObjects(cloth.children)[0];if(boundary&&(!surface||boundary.distance<=surface.distance+.025))return boundary.object.userData;return surface?.object.userData||null}
  let down=null;const start=e=>{down=[e.clientX,e.clientY]},move=e=>latest.current.onHover(hit(e)),end=e=>{if(!transform.dragging&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<4)latest.current.onPick(hit(e));down=null}
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',end)
  const resize=new ResizeObserver(()=>{const {width,height}=host.current.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()});resize.observe(host.current)
  let frame;const draw=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw)};draw();engine.current={cloth,body,lines,transform,pivot}
  return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();transform.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});renderer.dispose();renderer.domElement.remove();engine.current=null}
 },[])
 useEffect(()=>{
  if(!snapshot||!engine.current)return
  const {cloth,body,lines}=engine.current
  const clear=g=>{for(const o of [...g.children]){o.geometry?.dispose();o.material?.dispose();g.remove(o)}}
  clear(cloth);clear(lines)
  const mesh=(positions,triangles,color)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));g.setIndex(triangles.flat());g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.92}))}
  if(snapshot.avatar&&engine.current.avatarData!==snapshot.avatar){clear(body);body.add(mesh(snapshot.avatar.positions,snapshot.avatar.triangles,'#c5c0b7'));engine.current.avatarData=snapshot.avatar}
  snapshot.panels.forEach((p,i)=>{const m=mesh(snapshot.positions,snapshot.triangles.slice(...p.triangles),active?.panel===p.id?'#e4b66d':COLORS[i%COLORS.length]);m.userData={panel:p.id};cloth.add(m)
   for(const [edge,indices] of Object.entries(p.boundaries)){
    const selected=active?.panel===p.id&&(!active.edge||active.edge===edge)
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(indices.map(n=>new THREE.Vector3(...snapshot.positions[n]))),new THREE.LineBasicMaterial({color:selected?'#f2693d':'#43555a',depthTest:true}));l.userData={panel:p.id,edge};lines.add(l)
   }
  })
  snapshot.seams.forEach((seam,i)=>{const spec=snapshot.template.seams.find(s=>s.id===seam.id);const emphasized=active&&[spec.a,spec.b].some(b=>b.panel===active.panel&&(!active.edge||b.edge===active.edge));seam.guides.forEach((pair,j)=>{if(!emphasized&&j%4)return;const points=pair.map(w=>new THREE.Vector3(...weighted(w,snapshot.positions)));const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:emphasized?'#f2693d':COLORS[i%COLORS.length],transparent:true,opacity:emphasized?1:.35}));lines.add(l)})})
 },[snapshot,active?.panel,active?.edge])
 useEffect(()=>{const e=engine.current;if(!e)return;e.body.visible=showAvatar;e.lines.visible=showSeams;e.cloth.traverse(o=>{if(o.isMesh&&o.material)o.material.wireframe=wireframe})},[showAvatar,showSeams,wireframe,snapshot?.revision,active?.panel,active?.edge])
 useEffect(()=>{const e=engine.current;if(!e)return;const p=snapshot?.template.panels.find(p=>p.id===selected?.panel);if(p&&['move3d','rotate3d'].includes(mode)){e.pivot.position.fromArray(p.placement.translation);e.pivot.rotation.set(...p.placement.rotation_degrees.map(n=>THREE.MathUtils.degToRad(n)));e.transform.setMode(mode==='move3d'?'translate':'rotate');e.transform.attach(e.pivot)}else e.transform.detach()},[snapshot?.revision,selected?.panel,mode])
 return <div className="cc-scene" ref={host} aria-label="ClothCraft 3D garment and original mannequin"/>
}
function Board({s,active,pick,hover,edit,mode,busy,onPolygon}){
 const svg=useRef(),drag=useRef(),[view,setView]=useState([-0.15,-.15,2.4,1.9]),[draft,setDraft]=useState([])
 const point=e=>{const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const n=p.matrixTransform(svg.current.getScreenCTM().inverse());return[n.x,n.y]}
 useEffect(()=>{
  if(mode!=='pen'&&mode!=='line')return
  const onKey=e=>{
   if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return
   if(e.key==='Escape'&&draft.length){e.preventDefault();e.stopImmediatePropagation();setDraft([])}
   if(e.key==='Enter'&&draft.length>=(mode==='line'?2:3)&&!busy){e.preventDefault();onPolygon(draft);setDraft([])}
  }
  window.addEventListener('keydown',onKey,true)
  return()=>window.removeEventListener('keydown',onKey,true)
 },[mode,draft,busy,onPolygon])
 const screen=(p,uv)=>{const a=(p.layout_rotation_degrees||0)*Math.PI/180,r=s.panels.find(r=>r.id===p.id);return[r.layout[0]+uv[0]*Math.cos(a)-uv[1]*Math.sin(a),r.layout[1]+uv[0]*Math.sin(a)+uv[1]*Math.cos(a)]}
 const start=(e,p,anchor)=>{if(busy||mode==='sew'||mode==='pen'||mode==='line'||e.button!==0)return;e.stopPropagation();svg.current.setPointerCapture(e.pointerId);drag.current={p,anchor,start:point(e)};pick({panel:p.id,...(typeof anchor==='number'?{anchor}:{})})}
 const up=e=>{const d=drag.current;drag.current=null;if(!d)return;const q=point(e),delta=q.map((n,i)=>n-d.start[i]);if(Math.hypot(...delta)<.002)return;if(d.pan){setView(v=>[v[0]-delta[0],v[1]-delta[1],v[2],v[3]]);return}const r=s.panels.find(p=>p.id===d.p.id);if(d.anchor!==undefined){const a=-(d.p.layout_rotation_degrees||0)*Math.PI/180;const local=[delta[0]*Math.cos(a)-delta[1]*Math.sin(a),delta[0]*Math.sin(a)+delta[1]*Math.cos(a)];if(typeof d.anchor==='string'){const [,edge,j]=d.anchor.split(':');const polygon=structuredClone(d.p.polygon);polygon.curves[edge][Number(j)]=polygon.curves[edge][Number(j)].map((n,i)=>n+local[i]);edit({kind:'Shape',panel:d.p.id,polygon})}else edit({kind:'Anchor',panel:d.p.id,anchor:d.anchor,position:d.p.polygon.points[d.anchor].map((n,i)=>n+local[i])})}else edit({kind:'BoardTransform',panel:d.p.id,origin:r.layout.map((n,i)=>n+delta[i]),rotation_degrees:d.p.layout_rotation_degrees||0})}
 return <div className="cc-board"><svg ref={svg} viewBox={view.join(' ')} onPointerUp={up} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if((mode==='pen'||mode==='line')&&!busy){setDraft(p=>[...p,point(e)]);return}drag.current={pan:true,start:point(e)};svg.current.setPointerCapture(e.pointerId)}} onWheel={e=>{const factor=e.deltaY>0?1.1:.9;setView(v=>[v[0],v[1],v[2]*factor,v[3]*factor])}} aria-label="Linked metric 2D pattern board">
  <defs><pattern id="cc-grid" width=".05" height=".05" patternUnits="userSpaceOnUse"><path d="M .05 0 L 0 0 0 .05" fill="none" stroke="#dde0dc" strokeWidth=".001"/></pattern></defs><rect x="-50" y="-50" width="100" height="100" fill="url(#cc-grid)"/>
  {s.panels.map((r,i)=>{const p=s.template.panels.find(p=>p.id===r.id),selected=active?.panel===p.id;return <g key={p.id} onPointerEnter={()=>hover({panel:p.id})} onPointerLeave={()=>hover(null)}>
   <path data-panel={p.id} d={s.triangles.slice(...r.triangles).map(t=>'M'+t.map(n=>screen(p,s.uv[n]).join(',')).join('L')+'Z').join('')} fill={selected?'#f4deb7':COLORS[i%COLORS.length]} fillOpacity=".72" onPointerDown={e=>start(e,p)} onClick={e=>{e.stopPropagation();pick({panel:p.id})}}/>
   {Object.entries(r.boundaries).map(([edge,indices])=><polyline data-edge={`${p.id}:${edge}`} key={edge} points={indices.map(n=>screen(p,s.uv[n]).join(',')).join(' ')} fill="none" stroke={selected&&active.edge===edge?'#ef6339':'#374e57'} strokeWidth={selected&&active.edge===edge?'.009':'.003'} style={{cursor:'crosshair'}} onPointerDown={e=>e.stopPropagation()} onPointerEnter={e=>{e.stopPropagation();hover({panel:p.id,edge})}} onClick={e=>{e.stopPropagation();pick({panel:p.id,edge})}}/>)}
   <text x={r.layout[0]} y={r.layout[1]-.035} fontSize=".027" fill="#34454a">{p.name}</text>
   {selected&&mode==='edit'&&p.polygon?.points.map((uv,n)=>{const q=screen(p,uv);return <circle key={n} cx={q[0]} cy={q[1]} r=".009" fill="#fff" stroke="#f2693d" strokeWidth=".003" onPointerDown={e=>start(e,p,n)}/>})}
   {selected&&mode==='edit'&&Object.entries(p.polygon?.curves||{}).flatMap(([edge,controls])=>controls.map((uv,j)=>{const q=screen(p,uv),n=p.polygon.edges.indexOf(edge),anchor=screen(p,p.polygon.points[(n+j)%p.polygon.points.length]);return <g key={`${edge}-${j}`}><line x1={anchor[0]} y1={anchor[1]} x2={q[0]} y2={q[1]} stroke="#527e91" strokeWidth=".002"/><circle cx={q[0]} cy={q[1]} r=".008" fill="#527e91" stroke="white" strokeWidth=".002" onPointerDown={e=>start(e,p,`c:${edge}:${j}`)}/></g>}))}
  </g>})}
  {s.seams.flatMap((seam,i)=>{const spec=s.template.seams.find(s=>s.id===seam.id),em=active&&[spec.a,spec.b].some(b=>b.panel===active.panel&&(!active.edge||b.edge===active.edge));const uv=s.uv.map((_,i)=>boardPoint(s,i));return seam.guides.filter((_,j)=>em||j%4===0).map((pair,j)=>{const a=weighted(pair[0],uv),b=weighted(pair[1],uv);return <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={em?'#ef6339':COLORS[i%COLORS.length]} strokeWidth={em?'.003':'.0015'} strokeDasharray=".01 .008" opacity={em?1:.35} pointerEvents="none"/>})})}
  {draft.length>0&&<polyline points={draft.map(p=>p.join(',')).join(' ')} fill="none" stroke="#ef6339" strokeWidth=".005" pointerEvents="none"/>}
 </svg></div>
}
export default function ClothCraftWorkspace({embedded=false,exoSection='Pattern',exoObjectTab='Scene',exoLayout='split',exoSplit=50,environmentPreset='studio',stageId='none',stageSettings=null,onRemoveStage, cameraSettings=null,sceneLight=null,sceneLight2=null,exposure=1.1,studioAppearance=null,studioPreferences=null,workspaceGrid=true,workspaceSeams=true}){
 const [s,setS]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null),[hovered,setHovered]=useState(null),[mode,setMode]=useState('edit'),[pair,setPair]=useState([]),[reverse,setReverse]=useState(true),[ease,setEase]=useState(false),[sewingVariant,setSewingVariant]=useState('free'),[playing,setPlaying]=useState(false),[size,setSize]=useState([300,400]),[shape,setShape]=useState('rectangle'),[basePolygonOpen,setBasePolygonOpen]=useState(false),[fillPanelOpen,setFillPanelOpen]=useState(false),[fillPanelTarget,setFillPanelTarget]=useState(''),[fillFabricId,setFillFabricId]=useState(''),[gradeMode,setGradeMode]=useState(''),[gradePanelTarget,setGradePanelTarget]=useState(''),[gradeWidthDelta,setGradeWidthDelta]=useState(20),[gradeHeightDelta,setGradeHeightDelta]=useState(10),[gradeStep,setGradeStep]=useState(1),[walkOpen,setWalkOpen]=useState(false),[walkSeamId,setWalkSeamId]=useState(''),[walkFraction,setWalkFraction]=useState(0),[fullnessOpen,setFullnessOpen]=useState(false),[fullnessPanel,setFullnessPanel]=useState(''),[fullnessLine,setFullnessLine]=useState(''),[toolPanel,setToolPanel]=useState(''),[lineId,setLineId]=useState(''),[ruffleWidth,setRuffleWidth]=useState(60),[ruffleRatio,setRuffleRatio]=useState(1.5),[edgeLength,setEdgeLength]=useState(100),[ranges,setRanges]=useState([[0,1],[0,1]])
 const [showBoundingBox,setShowBoundingBox]=useState(false),[showContactDots,setShowContactDots]=useState(true),[showMeasurements,setShowMeasurements]=useState(true),[showSilhouette,setShowSilhouette]=useState(true)
 useEffect(()=>{if(embedded)setShowSeams(workspaceSeams)},[embedded,workspaceSeams])
 const [segmentCommitting,setSegmentCommitting]=useState(false)
 const [seamEditing,setSeamEditing]=useState(false)
 const segmentPendingRef=useRef(null)
 const [freeSewPoints,setFreeSewPoints]=useState([])
 const freeSewPendingRef=useRef([])
 const [section,setSection]=useState('Pattern'),[libraryTab,setLibraryTab]=useState('Pieces'),[filter,setFilter]=useState(''),[showAvatar,setShowAvatar]=useState(true),[showSeams,setShowSeams]=useState(true),[wireframe,setWireframe]=useState(false),[layout,setLayout]=useState('split'),[libraryOpen,setLibraryOpen]=useState(true),[inspectorOpen,setInspectorOpen]=useState(true)
 const [patternAudit,setPatternAudit]=useState(null)
 const [cutlineProof,setCutlineProof]=useState(null)
 const [analysisMode,setAnalysisMode]=useState('surface')
 const [foamOpen,setFoamOpen]=useState(false)
 const [selectedFoamId,setSelectedFoamId]=useState(null)
 const [nativeFoamPads,setNativeFoamPads]=useState([])
 const [foamMessage,setFoamMessage]=useState('')
 const foamFileInput=useRef(null)
 const foamLoadedKey=useRef(null)
 const foamProjectKey=s?.template?.id||s?.template?.name||null
 useEffect(()=>{
  foamLoadedKey.current=null
  setSelectedFoamId(null)
  if(!foamProjectKey){setNativeFoamPads([]);return}
  try{
   const saved=JSON.parse(localStorage.getItem(`exo-v2-native-foam:${foamProjectKey}`)||'[]')
   setNativeFoamPads(Array.isArray(saved)?saved.filter(p=>p&&typeof p.panel==='string'&&Array.isArray(p.points)):[])
  }catch{setNativeFoamPads([])}
  foamLoadedKey.current=foamProjectKey
 },[foamProjectKey])
 const commitFoamPads=next=>{
  if(!foamProjectKey||foamLoadedKey.current!==foamProjectKey)return
  setNativeFoamPads(next)
  if(foamProjectKey){try{localStorage.setItem(`exo-v2-native-foam:${foamProjectKey}`,JSON.stringify(next))}catch{setFoamMessage('Foam draft changed, but browser storage is unavailable.')}}
 }
 const editNativeFoamPad=(id,changes)=>commitFoamPads(nativeFoamPads.map(p=>p.id===id?{...p,...changes}:p))
 useEffect(()=>{
  if(!embedded)return
  const pad=nativeFoamPads.find(item=>item.id===selectedFoamId)||null
  window.dispatchEvent(new CustomEvent('exo-clothcraft-foam-selection',{detail:{pad,projectKey:foamProjectKey}}))
 },[embedded,selectedFoamId,nativeFoamPads,foamProjectKey])
 useEffect(()=>{
  if(!embedded)return undefined
  const edit=event=>{
   const {id,material}=event.detail||{}
   if(!id||!material||!nativeFoamPads.some(pad=>pad.id===id))return
   editNativeFoamPad(id,{material})
  }
  window.addEventListener('exo-clothcraft-foam-material-edit',edit)
  return()=>window.removeEventListener('exo-clothcraft-foam-material-edit',edit)
 },[embedded,nativeFoamPads,foamProjectKey])
 const importNativeFoam=async e=>{
  const file=e.target.files?.[0];e.target.value=''
  if(!file||!foamProjectKey)return
  try{
   if(file.size>3*1024*1024)throw Error('SVG file exceeds 3MB')
   const result=parseSvgPattern(await file.text(),{fileName:file.name,maxPieces:12})
   const panel=selected?.panel||s?.template?.panels?.find(p=>/front/i.test(p.name+' '+p.id))?.id||s?.template?.panels?.[0]?.id
   if(!panel)throw Error('Select a native pattern first')
   const panelRange=s?.panels?.find(p=>p.id===panel)
   const panelUv=panelRange?.vertices&&s.uv?.slice(...panelRange.vertices)
   if(!panelUv?.length)throw Error('Native panel material coordinates are unavailable')
   const midX=(Math.min(...panelUv.map(p=>p[0]))+Math.max(...panelUv.map(p=>p[0])))*50
   const midY=(Math.min(...panelUv.map(p=>p[1]))+Math.max(...panelUv.map(p=>p[1])))*50
   const pads=result.pieces.map((piece,i)=>{
    const x=piece.points.map(p=>p.x),y=piece.points.map(p=>p.y)
    const width=Math.max(...x)-Math.min(...x),height=Math.max(...y)-Math.min(...y)
    if(width>120||height>120)throw Error('Imported foam outline must be at most 120 cm')
    const edgeWidthCm=safeFoamEdgeWidth(piece.points)
    if(!edgeWidthCm)throw Error(`Foam outline ${piece.name} cannot form a valid edge ramp. Simplify or enlarge it.`)
    return {id:`native-foam-${Date.now()}-${i}`,panel,name:piece.name,points:piece.points,x:midX,y:midY,widthCm:width,heightCm:height,rotationDeg:0,depthCm:1.5,edgeWidthCm,sewn:false,locked:false,mode:'sandwich'}
   })
   if(foamLoadedKey.current!==foamProjectKey)throw Error('Project changed during SVG import; reimport into the active project')
   commitFoamPads([...nativeFoamPads,...pads]);setSelectedFoamId(pads[0]?.id||null);setFoamMessage(`Imported ${pads.length} foam shape(s) for ${panel}. Preview guides are independent of native Rust sewing.`);setFoamOpen(true)
  }catch(error){setFoamMessage(error.message||'Foam SVG import failed')}
 }
 const [cloHardwareCatalog,setCloHardwareCatalog]=useState([])
 useEffect(()=>{
  let active=true
  fetch('/clo-hardware-converted/manifest.json').then(response=>response.ok?response.json():null)
    .then(value=>{if(active&&Array.isArray(value?.items))setCloHardwareCatalog(value.items)})
    .catch(()=>{})
  return()=>{active=false}
 },[])
 const cloAssetsById=useMemo(()=>new Map(cloHardwareCatalog.map(asset=>[asset.id,asset])),[cloHardwareCatalog])
 const sceneImportedHardware=useMemo(()=>(s?.importedHardware||[]).map(placed=>{
  const asset=cloAssetsById.get(placed.assetId)
  if(!asset?.glb)return null
  const base=importedCloHardwareDimensions(asset)
  return {id:placed.id,panel:placed.panel,assetId:placed.assetId,glbUrl:asset.glb,
   x:placed.positionMm?.[0]||0,y:placed.positionMm?.[1]||0,
   liftMm:Math.max(0,placed.positionMm?.[2]||1),
   widthMm:base[0]*(placed.scale?.[0]||1),heightMm:base[1]*(placed.scale?.[1]||1),depthMm:base[2]*(placed.scale?.[2]||1),
   rotationDeg:placed.rotationDegrees?.[2]||0,visible:placed.visible,
   roughness:placed.roughness,metalness:placed.metalness,color:placed.color,opacity:placed.opacity??1,
   reflectionIntensity:placed.reflectionIntensity??1,clearcoat:placed.clearcoat??0,
   materialType:placed.materialType||'original',weightGrams:placed.weightGrams??0}
 }).filter(Boolean),[s?.importedHardware,cloAssetsById])
 const [pleatActive,setPleatActive]=useState(false),[drawingError,setDrawingError]=useState('')
 useEffect(()=>{
  if(!embedded)return undefined
  const invalid=event=>setDrawingError(event.detail?.reason||'Draw the internal line entirely inside a pattern.')
  const pleat=event=>{
   if(!pleatActive)return
   if(!event.detail?.panelId){setDrawingError('Click a rectangular pattern to create pleat guides.');return}
   void createPleatGuides(event.detail.panelId)
  }
  window.addEventListener('exo-clothcraft-invalid-internal-polygon',invalid)
  window.addEventListener('exo-clothcraft-pleat-target',pleat)
  return()=>{
   window.removeEventListener('exo-clothcraft-invalid-internal-polygon',invalid)
   window.removeEventListener('exo-clothcraft-pleat-target',pleat)
  }
 },[embedded,pleatActive,busy,playing])
 // A Base Polygon form is transient. Never leave it obscuring both views
 // after Select, Trace, Sewing, or a related inspector has been activated.
 useEffect(()=>{
  if(!embedded)return undefined
  const onToolbar=event=>{
   const editSewing=event.detail?.nativeAction==='sewing.editExisting'
   setSeamEditing(editSewing)
   // Validation belongs to the previous drawing tool; selecting Walk or any
   // other toolbar action must dismiss it before opening the next dialog.
   setDrawingError('')
   if(event.detail?.nativeAction!=='pattern2d.basePolygon')setBasePolygonOpen(false)
   if(event.detail?.nativeAction==='pattern2d.fillPanel'){
    setFillPanelTarget(state.current?.template?.panels?.find(p=>p.id===selected?.panel)?.id||state.current?.template?.panels?.[0]?.id||'')
    setFillFabricId(state.current?.template?.fabrics?.[0]?.id||'')
    setFillPanelOpen(true)
   }else setFillPanelOpen(false)
   if(['pattern2d.editGrading','pattern2d.autoGrading'].includes(event.detail?.nativeAction)){
    setGradePanelTarget(state.current?.template?.panels?.find(p=>p.id===selected?.panel)?.id||state.current?.template?.panels?.[0]?.id||'')
    setGradeMode(event.detail.nativeAction==='pattern2d.editGrading'?'manual':'auto')
   }else setGradeMode('')
   if(event.detail?.nativeAction==='pattern2d.walkSeam'){
    setWalkSeamId(state.current?.template?.seams?.find(seam=>seam.id===selected?.seamId)?.id||state.current?.template?.seams?.[0]?.id||'')
    setWalkFraction(0)
    setWalkOpen(true)
   }else setWalkOpen(false)
   if(event.detail?.nativeAction==='pattern2d.fullnessRuffle'){
    const candidate=state.current?.template?.panels?.find(p=>p.id===selected?.panel&&p.polygon?.lines?.length)||state.current?.template?.panels?.find(p=>p.polygon?.lines?.length)
    setFullnessPanel(candidate?.id||'')
    setFullnessLine(candidate?.polygon?.lines?.[0]?.id||'')
    setFullnessOpen(true)
   }else setFullnessOpen(false)
   setPleatActive(event.detail?.nativeAction==='pattern2d.pleatGuides')
   if(event.detail?.nativeAction==='sewing.segmentSew'){
    setSewingVariant('segment')
    setRanges([[0,1],[0,1]])
    segmentPendingRef.current=null
    freeSewPendingRef.current=[]
    setFreeSewPoints([])
    setPair([])
   }else if(event.detail?.nativeAction==='sewing.freeSew'){
    setSewingVariant('free')
    setRanges([[0,1],[0,1]])
    // A free range is authored by independent pointer picks. Their lengths
    // usually differ slightly; offer an explicit, visible easing setting.
    setEase(true)
    segmentPendingRef.current=null
    freeSewPendingRef.current=[]
    setFreeSewPoints([])
    setPair([])
   }
  }
  window.addEventListener('exo-clothcraft-toolbar-activated',onToolbar)
  return()=>window.removeEventListener('exo-clothcraft-toolbar-activated',onToolbar)
 },[embedded,selected?.panel])
 useEffect(()=>{if(mode!=='edit')setBasePolygonOpen(false)},[mode])
 const [contextMenu,setContextMenu]=useState(null)
 const [inspectorFabricId,setInspectorFabricId]=useState(null)
 const [fabricHost,setFabricHost]=useState(null)
 const [graphicHost,setGraphicHost]=useState(null)
 const [nativeGraphics,setNativeGraphics]=useState([])
 const [selectedGraphicId,setSelectedGraphicId]=useState(null)
 const [showGraphicMeasurements,setShowGraphicMeasurements]=useState(()=>{
  try{return localStorage.getItem('exo-v2-show-2d-graphic-measurements')!=='false'}catch{return true}
 })
 const toggleGraphicMeasurements=value=>{
  setShowGraphicMeasurements(Boolean(value))
  try{localStorage.setItem('exo-v2-show-2d-graphic-measurements',String(Boolean(value)))}catch{}
 }
 useEffect(()=>{
  if(!embedded)return undefined
  const setMeasurements=event=>{
   if(typeof event.detail?.visible==='boolean')toggleGraphicMeasurements(event.detail.visible)
  }
  window.addEventListener('exo-clothcraft-set-graphic-measurements',setMeasurements)
  return()=>window.removeEventListener('exo-clothcraft-set-graphic-measurements',setMeasurements)
 },[embedded])
 const graphicThumbnailCache=useRef(new Map())
 const [graphicThumbnailVersion,setGraphicThumbnailVersion]=useState(0)
 const graphicsDocumentRef=useRef(null)
 const graphicsSaveTimer=useRef(null),graphicsPending=useRef(null),graphicsEditVersion=useRef(0)
 // Rust's panel material UVs are in metres. These are the permanent cutting
 // dimensions, independent of zoom or how far the garment is draped.
 const nativeGraphicPanelBounds=panelId=>{
  const value=s?.graphicPanelMetrics?.[panelId]
  if(value?.width>0&&value?.height>0)return {widthMm:value.width*1000,heightMm:value.height*1000,
    minXmm:value.minX*1000,minYmm:value.minY*1000}
  const p=s?.panels?.find(panel=>panel.id===panelId)
  const uv=p?.vertices&&s?.uv?.slice(...p.vertices)
  if(!uv?.length)return null
  const x=uv.map(v=>v[0]),y=uv.map(v=>v[1])
  return {widthMm:(Math.max(...x)-Math.min(...x))*1000,
   heightMm:(Math.max(...y)-Math.min(...y))*1000,minXmm:Math.min(...x)*1000,minYmm:Math.min(...y)*1000}
 }
 const preparePrintGraphic=graphic=>{
  const g=normalizeGarmentGraphic(graphic)
  const bounds=nativeGraphicPanelBounds(g.panel)
  if(!bounds?.widthMm||!bounds?.heightMm)throw Error(`No physical panel coordinates for ${g.panel}`)
  const widthMm=g.widthMm??g.scale*bounds.widthMm
  const heightMm=g.heightMm??widthMm*g.height/g.width
  return {...g,widthMm,heightMm,
   positionMm:g.positionMm??[g.center[0]*bounds.widthMm-widthMm/2,g.center[1]*bounds.heightMm-heightMm/2]}
 }
 // Panel ids/count can change after Duplicate, Mirror or Remove. Do not key
 // artwork storage to mutable topology or a valid edit would hide all prints.
 const graphicsDocumentKey=s?.template?.panels?.length
  ? `exo-v2-print-layout:${s.template.id||s.template.name||'untitled'}`:null
 // Native Rust persists real print dimensions and layers with the garment.
 // IndexedDB serves only as a backwards-compatible migration source/cache.
 useEffect(()=>{
  let cancelled=false
  graphicsDocumentRef.current=graphicsDocumentKey
  if(!graphicsDocumentKey){setNativeGraphics([]);return()=>{cancelled=true}}
  const valid=saved=>Array.isArray(saved)?saved.filter(g=>
    typeof g?.panel==='string'&&typeof g?.dataUrl==='string'&&g.dataUrl.startsWith('data:image/png;base64,')
    &&s.template.panels.some(p=>p.id===g.panel)):[]
  let legacy=[]
  try{legacy=valid(JSON.parse(localStorage.getItem(graphicsDocumentKey)||'[]'))}catch{}
  readNativeGraphics(graphicsDocumentKey).then(saved=>{
   if(cancelled||graphicsDocumentRef.current!==graphicsDocumentKey)return
   const artwork=valid(saved)
   const native=valid(s?.printGraphics)
   if(native.length){setNativeGraphics(native);return}
   const toMigrate=artwork.length?artwork:legacy
   if(toMigrate.length)updateNativeGraphics(toMigrate)
   else setNativeGraphics([])
  }).catch(()=>{if(!cancelled&&legacy.length)updateNativeGraphics(legacy)})
  return()=>{cancelled=true}
 },[graphicsDocumentKey])
 const updateNativeGraphics=next=>{
  if(!Array.isArray(next))return
  let calibrated
  try{calibrated=next.map(preparePrintGraphic)}catch(error){setError(error.message);return}
  const version=++graphicsEditVersion.current
  setNativeGraphics(calibrated)
  if(graphicsDocumentRef.current)void saveNativeGraphics(graphicsDocumentRef.current,calibrated).catch(()=>{})
  graphicsPending.current=calibrated
  if(graphicsSaveTimer.current)clearTimeout(graphicsSaveTimer.current)
  graphicsSaveTimer.current=setTimeout(()=>{void (async()=>{
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,25))
   if(running.current){setError('Pause simulation before saving graphics. The current preview is not yet stored in Rust.');return}
   const latest=graphicsPending.current
   graphicsPending.current=null
   if(!latest)return
   // Rust accepts only production fields. Legacy percent-scale, browser file
   // format and old relief aliases must never enter the signed project JSON.
   const printGraphics=latest.map(({format,scale,reliefHeightMm,...graphic})=>graphic)
   const response=await request({op:'graphics-set',printGraphics,graphics:true})
   if(response?.printGraphics&&version===graphicsEditVersion.current){
    setNativeGraphics(response.printGraphics)
    setNotice('Rust saved the artwork, its material settings, and exact millimetre print dimensions with this garment.')
   }
  })()},260)
 }
 const selectGraphicOnBoard=id=>{
  setSelectedGraphicId(id)
  if(embedded)window.dispatchEvent(new CustomEvent('exo-clothcraft-graphic-picked',{detail:{id}}))
 }
 const moveGraphicOnBoard=(id,positionMm)=>{
  if(busy||playing||!nativeGraphics.some(graphic=>graphic.id===id))return
  updateNativeGraphics(nativeGraphics.map(graphic=>graphic.id===id?{...graphic,positionMm}:graphic))
 }
 // The upper Object Browser and the lower Property Editor share one layer ID.
 // Small actual-artwork thumbnails are cached separately from full print PNGs,
 // so simulation status messages never copy megabytes of artwork each frame.
 useEffect(()=>{
  let cancelled=false
  const cache=graphicThumbnailCache.current
  const ids=new Set(nativeGraphics.map(graphic=>graphic.id))
  for(const id of cache.keys())if(!ids.has(id))cache.delete(id)
  for(const graphic of nativeGraphics){
   if(cache.get(graphic.id)?.source===graphic.dataUrl)continue
   const image=new Image()
   image.onload=()=>{
    if(cancelled)return
    const canvas=document.createElement('canvas')
    canvas.width=canvas.height=64
    const ctx=canvas.getContext('2d')
    if(!ctx)return
    const fit=Math.min(56/image.naturalWidth,56/image.naturalHeight)
    const width=image.naturalWidth*fit,height=image.naturalHeight*fit
    ctx.drawImage(image,(64-width)/2,(64-height)/2,width,height)
    cache.set(graphic.id,{source:graphic.dataUrl,thumbnail:canvas.toDataURL('image/png')})
    setGraphicThumbnailVersion(value=>value+1)
   }
   image.src=graphic.dataUrl
  }
  return()=>{cancelled=true}
 },[nativeGraphics])
 useEffect(()=>{
  if(nativeGraphics.length&&!nativeGraphics.some(graphic=>graphic.id===selectedGraphicId))setSelectedGraphicId(nativeGraphics[0].id)
  if(!nativeGraphics.length&&selectedGraphicId!==null)setSelectedGraphicId(null)
 },[nativeGraphics,selectedGraphicId])
 useEffect(()=>{
  if(!embedded)return
  const setVisibility=event=>{
   const {id,visible}=event.detail||{}
   if(typeof id!=='string'||typeof visible!=='boolean'||busy||playing)return
   if(!nativeGraphics.some(graphic=>graphic.id===id))return
   updateNativeGraphics(nativeGraphics.map(graphic=>graphic.id===id?{...graphic,visible}:graphic))
  }
  window.addEventListener('exo-clothcraft-graphic-visibility',setVisibility)
  return()=>window.removeEventListener('exo-clothcraft-graphic-visibility',setVisibility)
 },[embedded,nativeGraphics,busy,playing,s?.graphicPanelMetrics])
 // Object Browser Copy / Assign share the existing Rust-backed graphics store.
 // The new record has an independent ID and is saved by updateNativeGraphics.
 useEffect(()=>{
  if(!embedded)return undefined
  const copy=event=>{
   if(busy||playing)return
   const source=nativeGraphics.find(g=>g.id===event.detail?.id)
   if(!source)return
   const id=`graphic-copy-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
   const duplicate=normalizeGarmentGraphic({...source,id,name:`${source.name||'Graphic'} Copy`,
    center:Array.isArray(source.center)?source.center.map(n=>Math.min(.95,n+.03)):[.53,.53],
    ...(Array.isArray(source.positionMm)?{positionMm:source.positionMm.map(n=>n+10)}:{})})
   updateNativeGraphics([...nativeGraphics,duplicate])
   setSelectedGraphicId(id)
   setNotice(`Copied ${source.name||'graphic'}; the copy has its own saved layer and print position.`)
  }
  const assign=event=>{
   if(busy||playing)return
   const source=nativeGraphics.find(g=>g.id===event.detail?.id)
   const panel=selected?.panel||s?.template?.panels?.[0]?.id
   if(!source||!panel)return
   updateNativeGraphics(nativeGraphics.map(g=>g.id===source.id?{...g,panel}:g))
   setSelectedGraphicId(source.id)
   setNotice(`Assigned ${source.name||'graphic'} to ${s?.template?.panels?.find(p=>p.id===panel)?.name||panel}.`)
  }
  window.addEventListener('exo-clothcraft-copy-graphic',copy)
  window.addEventListener('exo-clothcraft-assign-graphic',assign)
  return()=>{window.removeEventListener('exo-clothcraft-copy-graphic',copy);window.removeEventListener('exo-clothcraft-assign-graphic',assign)}
 },[embedded,nativeGraphics,busy,playing,selected?.panel,s?.template?.panels])
 // The Fabric Property Editor region may first mount when a Fabric object is
 // selected (after the workspace already switched tabs). Reacquire the portal
 // host on actual native asset selection/revision, not only on section change.
 useEffect(()=>{setFabricHost(embedded?document.getElementById('cc-native-fabric-inspector'):null)},
  [embedded,exoSection,inspectorFabricId,s?.revision])
 useEffect(()=>{setGraphicHost(embedded?document.getElementById('cc-native-graphic-editor'):null)},[embedded,exoSection,exoObjectTab,s?.revision])
 const workspaceRoot=useRef(null), shortcutsFocused=useRef(false), nativeOpenInput=useRef(null)
 const cameraViewport=useRef(null)
 const state=useRef(),running=useRef(false),runToken=useRef(0),lock=useRef(false),resumeAfterGrab=useRef(false),grabPause=useRef(Promise.resolve()),fitAfterReset=useRef(false);state.current=s
 // Wait for the Rust snapshot and the Three.js garment meshes to refresh
 // before fitting the camera to a freshly reset, off-body garment. A stage
 // stays in place, and the off-body panels remain visible in front of it.
 useEffect(()=>{
  if(!fitAfterReset.current||stageId!=='EXO01'||!s?.template)return
  fitAfterReset.current=false
  window.dispatchEvent(new CustomEvent('exo-clothcraft-fit-camera'))
 },[s?.revision,stageId])
 const request=useCallback(async(data)=>{if(lock.current)return null;lock.current=true;setBusy(true);setError('');try{const res=await fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.current?.revision,...data})});const result=await res.json();if(result.data?.template){const next={...result.data,avatar:result.data.avatar||(data.op==='open'?null:state.current?.avatar)};state.current=next;setS(next)}if(!res.ok||!result.ok)throw Error(result.error||'ClothCraft request failed');return result.data}catch(e){setError(e.message.includes('OGC initial intersection')?'A panel overlaps the avatar or another panel. Use Move to place it fully clear, then switch to Hand or press SIM. Reset Panels restores the initial arrangement.':e.message);running.current=false;setPlaying(false);return null}finally{lock.current=false;setBusy(false)}},[])
 const runPatternAudit=async()=>{
  if(busy||lock.current||!state.current?.template)return
  const audit=await request({op:'pattern-audit'})
  if(audit?.format==='exo-native-pattern-audit.v1'){
   setPatternAudit(audit)
   setNotice(`Rust measured ${audit.editablePanelCount} editable pattern(s) and ${audit.seams.length} sewing pair(s). Factory validation remains required.`)
  }
 }
 const runProductionCutlines=async()=>{
  if(busy||lock.current||!state.current?.template)return
  const proof=await request({op:'production-cutlines'})
  if(proof?.format==='exo-native-cutline-proof.v1'){
   setCutlineProof(proof)
   setNotice(`Rust created ${proof.generatedCount} closed engineering cutline proof(s); ${proof.blockedCount} panel(s) blocked. This is not a factory-approved export.`)
  }
 }
 const downloadCutlineProof=(panel,format='svg')=>{
  if(cutlineProof?.revision!==state.current?.revision||!['svg','dxf'].includes(format)||!panel?.[format])return
  const blob=new Blob([panel[format]],{type:format==='svg'?'image/svg+xml':'application/dxf'}),url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=`exo-${String(panel.name||panel.panelId).replace(/[^a-z0-9_-]+/gi,'_').slice(0,70)}-cutline-QA.${format}`
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),5000)
  setNotice(`Downloaded Rust metric engineering ${format.toUpperCase()}. External CAD import, plotting scale and sewn samples still require validation.`)
 }
 useEffect(()=>{
  if(!embedded)return undefined
  const action=async event=>{
   const detail=event.detail||{},command=detail.action
   const respond=(ok,error)=>window.dispatchEvent(new CustomEvent('exo-clothcraft-imported-hardware-result',{detail:{requestId:detail.requestId,ok,error}}))
   if(running.current){respond(false,'Pause simulation before editing imported hardware');return}
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   // Every queued hardware edit must start from the latest accepted snapshot.
   // Capturing this before awaiting lock silently overwrites preceding slider
   // edits when users change several dimensions and material fields quickly.
   const original=state.current
   if(!original?.template){respond(false,'Native project is still loading');return}
   if(command==='undo'||command==='redo'){
    const response=await request({op:command==='undo'?'hardware-undo':'hardware-redo'})
    respond(Boolean(response),response?'':'No imported hardware history step available')
    return
   }
   const previous=original.importedHardware||[]
   let next=previous
   if(command==='place'){
    const asset=cloAssetsById.get(detail.assetId)
    const panel=original.template.panels.find(p=>p.id===detail.panel)||original.template.panels[0]
    if(!asset?.glb||!panel){respond(false,'Select a native garment panel and 3D model');return}
    const points=panel.polygon?.points||[]
    const panelRange=original.panels?.find(entry=>entry.id===panel.id)?.triangles
    const vertices=panelRange&&original.triangles?.[panelRange[0]]?.map(index=>original.uv?.[index])
    const centroid=vertices?.length===3&&vertices.every(point=>Array.isArray(point)&&point.length>=2)
      ?[(vertices[0][0]+vertices[1][0]+vertices[2][0])/3,(vertices[0][1]+vertices[1][1]+vertices[2][1])/3]
      :points.length?points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]):[0.1,0.1]
    const kind=({Buttons:'button','Zipper pullers':'puller','Zipper sliders':'slider','Zipper stoppers':'stopper'})[asset.category]||'trim'
    const id=typeof detail.id==='string'&&detail.id.length<100?detail.id:`clo-hardware-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
    next=[...previous,{id,assetId:asset.id,panel:panel.id,kind,positionMm:[centroid[0]*1000,centroid[1]*1000,1],rotationDegrees:[0,0,0],scale:[1,1,1],visible:true,color:'#ffffff',roughness:.5,metalness:0,
      reflectionIntensity:1,clearcoat:0,weightGrams:0,materialType:'original'}]
   }else if(command==='update'||command==='remove'||command==='duplicate'){
    const record=previous.find(p=>p.id===detail.id)
    if(!record){respond(false,'Selected imported hardware no longer exists');return}
    if(command==='remove')next=previous.filter(p=>p.id!==detail.id)
    else if(command==='duplicate')next=[...previous,{...record,id:`clo-hardware-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,positionMm:[record.positionMm[0]+10,record.positionMm[1],record.positionMm[2]]}]
    else{
     const asset=cloAssetsById.get(record.assetId),value=detail.value,field=detail.field
     const base=importedCloHardwareDimensions(asset)
     const changed={...record,positionMm:[...record.positionMm],rotationDegrees:[...record.rotationDegrees],scale:[...record.scale]}
     if(['widthMm','heightMm','depthMm'].includes(field)){
      const axis={widthMm:0,heightMm:1,depthMm:2}[field]
      if(!Number.isFinite(Number(value))||Number(value)<=0||!Number.isFinite(base[axis])||base[axis]<=0){respond(false,'Invalid model dimension');return}
      changed.scale[axis]=Number(value)/base[axis]
     }else if(field==='x'||field==='y'||field==='liftMm'){
      const axis={x:0,y:1,liftMm:2}[field]
      changed.positionMm[axis]=Number(value)*(field==='liftMm'?1:10)
     }else if(field==='rotationDeg')changed.rotationDegrees[2]=Number(value)
     else if(['visible','color','roughness','metalness','opacity','reflectionIntensity','clearcoat','weightGrams','materialType'].includes(field))changed[field]=value
     else{respond(false,'Unsupported native hardware property');return}
     next=previous.map(p=>p.id===record.id?changed:p)
    }
   }else{respond(false,'Unknown imported hardware action');return}
   const result=await request({op:'hardware-set',importedHardware:next})
   respond(Boolean(result),result?'':'Native imported hardware edit was not accepted')
  }
  window.addEventListener('exo-clothcraft-imported-hardware-command',action)
  return()=>window.removeEventListener('exo-clothcraft-imported-hardware-command',action)
 },[embedded,cloAssetsById,request])
 useEffect(()=>{request({op:'snapshot',avatar:true,graphics:true});const pause=()=>{running.current=false;fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'pause'}),keepalive:true}).catch(()=>{})};window.addEventListener('pagehide',pause);return()=>{running.current=false;window.removeEventListener('pagehide',pause)}},[request])
 const edit=async c=>{
  // A mode transition or a previous edit may still own the native request.
  // Queue this user edit rather than silently dropping its button click.
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  if(running.current){
   running.current=false;setPlaying(false)
   await request({op:'pause'})
  }
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  return request({op:'edit',command:c})
 }
 // Changing a sewn side boundary alters its material length. Rust correctly
 // refuses that Shape while allow_ease=false. Require an explicit, visible
 // user action to enable ease on ONLY the affected sewn relationships; never
 // silently change production fit or relax compiler validation.
 const enableCurveSeamEase=async({panelId,edge,mirror=false,polygon=null,expectedRevision=null,affectedEdges=null})=>{
  if(!panelId||!edge)return false
  // A staged curve is a concrete proposal against a specific native snapshot.
  // Never commit it on top of another user's intervening pattern changes.
  if(polygon&&expectedRevision!==null&&state.current?.revision!==expectedRevision){
   setError('Curve proposal is stale after another edit; select the edge again and redraw the curve.')
   return false
  }
  const touchingEdges=new Set(Array.isArray(affectedEdges)&&affectedEdges.length?affectedEdges:[edge])
  if(mirror){
   // Side curves edit BOTH left and right boundaries of this material panel.
   // Both sewn side relationships must explicitly allow ease, or Rust rejects
   // the mirrored contour after the first seam has already been updated.
   const counterpart=edge.endsWith('-left')?edge.replace(/-left$/,'-right'):
    edge.endsWith('-right')?edge.replace(/-right$/,'-left'):null
   const polygon=state.current?.template?.panels?.find(item=>item.id===panelId)?.polygon
   if(counterpart&&polygon?.edges?.includes(counterpart))touchingEdges.add(counterpart)
  }
  const related=(state.current?.template?.seams||[]).filter(seam=>!seam.allow_ease&&
   [seam.a,seam.b].some(boundary=>boundary?.panel===panelId&&touchingEdges.has(boundary?.edge)))
  for(const seam of related){
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   const applied=await request({op:'edit-seam',seam:seam.id,
    reverse:seam.reverse_b,ease:true,stiffness:seam.stiffness})
   if(!applied)return false
  }
  if(polygon){
   const committed=await edit({kind:'Shape',panel:panelId,polygon})
   if(!committed)return false
  }
  setNotice(`Enabled native sewing ease on ${related.map(seam=>seam.id).join(', ')} so curved-edge lengths may differ. Undo restores the original sewing setting.`)
  return true
 }
 // Import one user-selected EXO fabric preset into the live Rust document.
 // The native Fabric command edits a matching panel; when several panels
 // share the material it creates an independent fabric for just this panel,
 // never silently changes unrelated garment fabrics or the whole project.
 useEffect(()=>{
  if(!embedded)return undefined
  const importFabric=async event=>{
   const {requestId,id,entry}=event.detail||{}
   if(!requestId)return
   const respond=(ok,error='',fabricId)=>window.dispatchEvent(new CustomEvent('exo-clothcraft-fabric-preset-result',
     {detail:{requestId,ok,error,fabricId}}))
   const snapshot=state.current
   const oldFabric=snapshot?.template?.fabrics?.find(f=>f.id===id)
   const panel=snapshot?.template?.panels?.find(p=>p.fabric===id)
   if(!oldFabric||!panel){respond(false,'The selected native fabric is not assigned to a garment pattern');return}
   if(!entry?.name||!validFabric(entry.properties)){respond(false,'Invalid native fabric name or physical properties');return}
   if(running.current||lock.current){respond(false,'Pause simulation and finish current edits before opening a fabric');return}
   try{
    const revised=await edit({kind:'Fabric',panel:panel.id,name:entry.name,properties:entry.properties,all_panels:false})
    if(!revised){respond(false,'The Rust solver did not accept the imported physical material');return}
    const fabricId=state.current?.template?.panels?.find(p=>p.id===panel.id)?.fabric
    if(!fabricId){respond(false,'Native fabric changed but its new identifier could not be resolved');return}
    for(const field of ['itemNo','construction','supplier','owner']){
     if(typeof entry[field]!=='string')continue
     const result=await request({op:'set-property',target:'fabric',id:fabricId,field,value:entry[field]})
     if(!result){respond(false,`Physical fabric imported, but the ${field} metadata update failed`,fabricId);return}
    }
    for(const field of ['color','opacity','roughness','metalness','reflectionIntensity']){
     if(entry.appearance?.[field]===undefined)continue
     const result=await request({op:'set-property',target:'fabric',id:fabricId,field:`appearance.${field}`,value:entry.appearance[field]})
     if(!result){respond(false,`Physical fabric imported, but appearance ${field} could not be saved`,fabricId);return}
    }
    setInspectorFabricId(fabricId)
    setNotice(`Opened ${entry.name} as a native fabric for ${panel.name}. Its physical properties are saved in Rust; other garment materials are unchanged.`)
    respond(true,'',fabricId)
   }catch(error){respond(false,error?.message||'Native fabric import failed')}
  }
  window.addEventListener('exo-clothcraft-import-fabric-preset',importFabric)
  return()=>window.removeEventListener('exo-clothcraft-import-fabric-preset',importFabric)
 })
 // A 3D cloth ray hit has exact interpolated native material coordinates.
 // Forward two hits on the same sewn pattern to the authoritative Rust
 // InternalLine editor rather than storing a disconnected visual stroke.
 useEffect(()=>{
  if(!embedded)return undefined
  let active=true
  const onLine=async event=>{
   const {panel,points}=event.detail||{}
   const templatePanel=state.current?.template?.panels?.find(p=>p.id===panel)
   const valid=Array.isArray(points)&&points.length===2&&points.every(p=>
    Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)))
   if(!templatePanel||!valid){setError('3D internal line: choose two visible points on the same native garment panel.');return}
   const gap=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1])
   if(gap<.001||gap>5){setError('3D internal line length must be at least 1 mm and within 5 m.');return}
   const created=await edit({kind:'InternalLine',panel,points,tangents:[[0,0],[0,0]]})
   if(active&&created)setNotice(`Created a native 3D-drawn construction line (${(gap*1000).toFixed(1)} mm) on ${templatePanel.name}. Undo/Redo and Save apply.`)
  }
  window.addEventListener('exo-clothcraft-3d-internal-line',onLine)
  return()=>{active=false;window.removeEventListener('exo-clothcraft-3d-internal-line',onLine)}
 },[embedded])
 useEffect(()=>{
  if(!embedded)return undefined
  const applyPreset=async event=>{
   const presetId=event.detail?.presetId
   const preset=CLOTHCRAFT_FABRICS.find(entry=>entry.id===presetId)
   const snapshot=state.current
   const panel=snapshot?.template?.panels?.find(p=>p.id===selected?.panel)||snapshot?.template?.panels?.[0]
   const fabric=snapshot?.template?.fabrics?.find(f=>f.id===panel?.fabric)
   if(!preset||!panel||!fabric){setError(!preset?'Unknown native fabric preset.':'No native garment panel is available for fabric assignment.');return}
   if(lock.current){setNotice('Native workspace is processing another change. Apply the fabric again once ready.');return}
   const properties=presetProperties(preset,fabric.properties)
   if(!validFabric(properties)){setError(`Invalid native material values for ${preset.name}.`);return}
   const allPanels=event.detail?.allPieces===true
   const updated=await edit({kind:'Fabric',panel:panel.id,name:preset.name,properties,all_panels:allPanels})
   if(updated)setNotice(`${preset.name} applied to ${allPanels?'all garment panels':panel.name}. Native physical properties and visual material updated; values are estimates until tested.`)
  }
  window.addEventListener('exo-clothcraft-apply-preset',applyPreset)
  return()=>window.removeEventListener('exo-clothcraft-apply-preset',applyPreset)
 },[embedded,selected?.panel,request])
 useEffect(()=>{
  if(!embedded)return undefined
  const assignExisting=async event=>{
   const snapshot=state.current
   const fabric=snapshot?.template?.fabrics?.find(f=>f.id===event.detail?.id)
   const panel=snapshot?.template?.panels?.find(p=>p.id===selected?.panel)||snapshot?.template?.panels?.[0]
   if(!fabric||!panel){setError('Select a fabric and native garment panel to assign.');return}
   if(running.current||lock.current){setError('Pause the native simulation before assigning fabric.');return}
   const changed=await edit({kind:'Fabric',panel:panel.id,name:fabric.name,properties:fabric.properties,all_panels:false})
   if(changed)setNotice(`Applied ${fabric.name} to ${panel.name} in the native cloth simulation.`)
  }
  window.addEventListener('exo-clothcraft-assign-fabric',assignExisting)
  return()=>window.removeEventListener('exo-clothcraft-assign-fabric',assignExisting)
 },[embedded,selected?.panel])
 const createPleatGuides=async panelId=>{
  if(busy||playing||lock.current)return
  const panel=state.current?.template?.panels?.find(p=>p.id===panelId)
  if(!panel||panel.polygon?.points?.length!==4){setDrawingError('Select a rectangular pattern to place pleat fold guides.');return}
  const result=await request({op:'pleat-guides',panel:panelId,orientation:'vertical',spacing_mm:20,inset_mm:10})
  if(result)setNotice('Three native pleat fold guides created. Undo removes them together.')
 }
 const pick=value=>{if(embedded)window.dispatchEvent(new CustomEvent('exo-clothcraft-native-pick',{detail:value||null}));setInspectorFabricId(null);if(!value){setSelected(null);setHovered(null);setPair([]);return}setSelected(value);if(mode==='sew'&&value.edge)setPair(p=>p.length===1?[p[0],value]:[value])}
 useEffect(()=>{
  if(!embedded)return undefined
  const chooseFabric=event=>{const id=event.detail?.id;setInspectorFabricId(typeof id==='string'?id:null)}
  const onPropertyEdit=async event=>{
   const d=event.detail||{}
   const outcome={requestId:d.requestId,ok:false,error:'Property could not be saved'}
   const allowedField=['name','itemNo'].includes(d.field)||
     (d.kind==='fabric'&&['construction','supplier','owner','pantoneCode','pantoneSystem','pantoneSource','pantoneApproval','appearance.color','appearance.opacity','appearance.roughness','appearance.metalness','appearance.reflectionIntensity','appearance.back.color','appearance.back.opacity','appearance.back.roughness','appearance.back.metalness','appearance.back.reflectionIntensity','appearance.back.reset','appearance.side.color','appearance.side.opacity','appearance.side.roughness','appearance.side.metalness','appearance.side.reflectionIntensity','appearance.side.reset'].includes(d.field))
   if(!['pattern','fabric'].includes(d.kind)||!allowedField||typeof d.id!=='string'){
     outcome.error='Unsupported native property edit'
   }else if(running.current){
     outcome.error='Pause simulation before editing properties'
   }else{
     // Snapshot polling briefly holds the same native request lock. Queue an
     // intentional property edit until the in-flight read completes, rather
     // than silently dropping user changes during routine viewport updates.
     for(let attempt=0;lock.current&&attempt<250;attempt++)
       await new Promise(resolve=>setTimeout(resolve,20))
     if(running.current)outcome.error='Pause simulation before editing properties'
     else if(lock.current)outcome.error='Native workspace is busy; retry when the current operation completes'
     else {
       const data=await request({op:'set-property',target:d.kind==='pattern'?'panel':'fabric',
         id:d.id,field:d.field,value:d.value,
         revision:d.revision})
       if(data){outcome.ok=true;delete outcome.error}
       else outcome.error='Native property update failed; check the workspace notice'
     }
   }
   window.dispatchEvent(new CustomEvent('exo-clothcraft-property-result',{detail:outcome}))
  }
  window.addEventListener('exo-clothcraft-select-fabric',chooseFabric)
  window.addEventListener('exo-clothcraft-edit-property',onPropertyEdit)
  return()=>{
   window.removeEventListener('exo-clothcraft-select-fabric',chooseFabric)
   window.removeEventListener('exo-clothcraft-edit-property',onPropertyEdit)
  }
 },[embedded,request])
 useEffect(()=>{
  const onPropertyCommand=event=>{
   const detail=event.detail
   if(detail?.type!=='target-length'||!state.current?.template||running.current)return
   const panel=state.current.template.panels.find(p=>p.id===detail.panel)
   if(!panel?.polygon?.edges?.includes(detail.edge)||!Number.isFinite(detail.cm)||detail.cm<=0||detail.cm>1000)return
   void request({op:'line-spec',panel:detail.panel,edge:detail.edge,target_m:detail.cm/100})
  }
  window.addEventListener('exo-clothcraft-property-command',onPropertyCommand)
  return()=>window.removeEventListener('exo-clothcraft-property-command',onPropertyCommand)
 },[])
 useEffect(()=>{
  const onSelectSeam=event=>{
   const id=event.detail?.seamId
   if(!id){pick(null);return}
   const spec=state.current?.template?.seams?.find(s=>s.id===id)
   if(!spec)return
   setSelected({panel:spec.a.panel,edge:spec.a.edge||spec.a.side,kind:'sewing',seamId:id})
   setHovered(null)
  }
  window.addEventListener('exo-clothcraft-select-seam',onSelectSeam)
  return()=>window.removeEventListener('exo-clothcraft-select-seam',onSelectSeam)
 },[])
 const save=async(download=false)=>{const data=await request({op:'save'});if(!data)return;setNotice('Workspace saved with editable patterns, seams and drape.');if(download){const blob=new Blob([JSON.stringify(data.project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='exo-clothcraft-fitting-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}}
 // File Library shares the currently open authoritative Rust document. Each
 // request carries a response ID so switching between saved projects cannot
 // accidentally snapshot the hidden legacy project or an older fixture.
 useEffect(()=>{
  if(!embedded)return undefined
  let mounted=true
  const onFileLibrary=event=>{
   const {requestId,action,project}=event.detail||{}
   if(typeof requestId!=='string'||!['capture','open'].includes(action))return
   void (async()=>{
    let response={requestId,ok:false,error:'Native garment workspace is unavailable'}
    try{
     if(running.current)throw Error('Pause simulation before saving or opening a library project')
     let waiting=0
     while(lock.current&&waiting++<120)await new Promise(resolve=>setTimeout(resolve,25))
     if(lock.current)throw Error('Native garment is still busy; try again')
     if(action==='capture'){
      if(!state.current?.template)throw Error('Native garment has not loaded yet')
      const saved=await request({op:'save'})
      if(!saved?.project?.template)throw Error('Native garment save failed')
      response={requestId,ok:true,project:saved.project,name:saved.project.template.name||state.current.template.name||'Untitled garment'}
     }else{
      if(!project?.template||!Array.isArray(project.template.panels))throw Error('This saved file does not contain a valid native ClothCraft garment')
      const opened=await request({op:'open',project})
      if(!opened?.template)throw Error('The native engine could not reopen this saved garment')
      setSelected(null);setHovered(null);setPair([]);setPlaying(false)
      response={requestId,ok:true,name:opened.template.name||'Saved garment'}
     }
    }catch(error){response.error=error instanceof Error?error.message:String(error)}
    if(mounted)window.dispatchEvent(new CustomEvent('exo-project-file-library-native-result',{detail:response}))
   })()
  }
  window.addEventListener('exo-project-file-library-native-request',onFileLibrary)
  return()=>{mounted=false;window.removeEventListener('exo-project-file-library-native-request',onFileLibrary)}
 },[embedded,request])
 const play=async()=>{
  // Starting SIM after Select/Move/Rotate switches to the live Fabric Hand
  // tool, exactly as the native ClothCraft grab workflow. Keep a single
  // simulation loop: the subsequent mode effect must not start a second one.
  const token=++runToken.current
  if(running.current){running.current=false;setPlaying(false);while(lock.current)await new Promise(r=>setTimeout(r,20));await request({op:'pause'});return}
  while(lock.current)await new Promise(r=>setTimeout(r,20))
  if(token!==runToken.current)return
  const started=await request({op:'play'});if(!started||token!==runToken.current)return
  running.current=true;setPlaying(true)
  modeIntent.current='stretch3d'
  setMode('stretch3d')
  while(running.current&&token===runToken.current){
   await new Promise(r=>setTimeout(r,100))
   if(!running.current||token!==runToken.current)break
   const result=await request({op:'snapshot'})
   if(!result||result.running===false)break
  }
  if(token===runToken.current){running.current=false;setPlaying(false)}
 }
 // Mode changes own automatic physics. A pending release must never restart
 // the solver after Select/reset, and an old poll loop must not stop a new one.
 const modeIntent=useRef(mode), modeTransition=useRef(0), previousMode=useRef(mode)
 modeIntent.current=mode
 useEffect(()=>{
  if(previousMode.current===mode)return
  previousMode.current=mode
  const transition=++modeTransition.current
  const needsPause=running.current||resumeAfterGrab.current
  if(mode!=='stretch3d'){
   const hadGrab=livePointer.current.held||livePointer.current.ready||livePointer.current.sending
   livePointer.current.held=false;livePointer.current.ready=false
   if(hadGrab)void queueLiveGrab(null)
   ++runToken.current;running.current=false;resumeAfterGrab.current=false;setPlaying(false)
  }
  void (async()=>{
   await grabPause.current
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   if(transition!==modeTransition.current)return
   if(mode==='stretch3d'){
    if(!running.current&&!resumeAfterGrab.current)void play()
   }else if(needsPause)await request({op:'pause'})
  })()
 },[mode])
 const selectedPanel=s?.template.panels.find(p=>p.id===selected?.panel),active=hovered||selected
 const selectExistingSewingSeam=seamId=>{
  const seam=state.current?.template?.seams?.find(item=>item.id===seamId)
  if(!seam)return
  setSelected({panel:seam.a.panel,edge:seam.a.edge,kind:'sewing',seamId:seam.id})
  setHovered(null)
 }
 const pickInSewingMode=value=>{
  if(seamEditing&&value?.panel){
   const matching=state.current?.template?.seams?.filter(seam=>seam.a.panel===value.panel||seam.b.panel===value.panel)||[]
   if(matching.length){
    const current=matching.findIndex(seam=>seam.id===selected?.seamId)
    selectExistingSewingSeam(matching[(current+1)%matching.length].id)
    return
   }
  }
  if(!seamEditing)pick(value)
 }
 const openPreset=async preset=>{if(s&&!window.confirm('Open a new ClothCraft fixture? Export your current project first if you want to keep a separate copy.'))return;running.current=false;setPlaying(false);setPair([]);setSelected(null);await request({op:'open',preset})}
 const importFile=async e=>{const file=e.target.files?.[0];if(!file)return;try{const project=JSON.parse(await file.text());if(s&&!window.confirm('Replace this workspace with the imported project?'))return;await request({op:'open',...(project.template?{project}:{document:project})});setSelected(null)}catch(err){setError(err.message)}e.target.value=''}
 const boundary=(x,i)=>({panel:x.panel,edge:x.edge,side:'top',range:ranges[i]})
 const clearFreeSew=()=>{
  freeSewPendingRef.current=[]
  setFreeSewPoints([])
 }
 useEffect(()=>{
  if(mode==='sew'&&sewingVariant==='segment')return
  segmentPendingRef.current=null
  setSegmentCommitting(false)
 },[mode,sewingVariant])
 useEffect(()=>{
  if(mode==='sew'&&sewingVariant==='free')return
  freeSewPendingRef.current=[]
  setFreeSewPoints([])
 },[mode,sewingVariant])
 useEffect(()=>{
  if(mode!=='sew'||sewingVariant!=='free')return
  const cancel=event=>{
   if(event.key==='Escape'&&freeSewPendingRef.current.length){
    event.preventDefault()
    event.stopPropagation()
    freeSewPendingRef.current=[]
    setFreeSewPoints([])
   }
  }
  window.addEventListener('keydown',cancel,true)
  return()=>window.removeEventListener('keydown',cancel,true)
 },[mode,sewingVariant])
 const selectFreeSewPoint=async mark=>{
  if(playing||busy||segmentCommitting||mode!=='sew'||sewingVariant!=='free'||
    !mark?.panel||!mark?.edge||!Number.isFinite(mark?.fraction))return
  const candidate={panel:mark.panel,edge:mark.edge,
    fraction:Math.max(0,Math.min(1,Math.round(mark.fraction*100000)/100000))}
  const previous=freeSewPendingRef.current
  if(previous.length===1||previous.length===3){
   const beginning=previous.at(-1)
   if(candidate.panel!==beginning.panel||candidate.edge!==beginning.edge){
    setNotice(`Finish the selected ${previous.length===1?'first':'second'} edge by clicking another point along the same highlighted edge.`)
    return
   }
   if(Math.abs(candidate.fraction-beginning.fraction)<.008){
    setNotice('The free sewing range needs two different points along the edge. Click farther from its start.')
    return
   }
  }
  if(previous.length===2 && candidate.panel===previous[0].panel&&candidate.edge===previous[0].edge){
   setNotice('Choose the matching second edge to connect to the first selected range.')
   return
  }
  const next=[...previous,candidate]
  setSelected({panel:candidate.panel,edge:candidate.edge})
  freeSewPendingRef.current=next
  setFreeSewPoints(next)
  if(next.length!==4)return
  const interval=(first,second)=>[Math.min(first.fraction,second.fraction),
    Math.max(first.fraction,second.fraction)]
  const first=interval(next[0],next[1]),second=interval(next[2],next[3])
  // The clicked start→end direction defines the alignment. Rust receives
  // normalized cutline ranges and reverses the second edge as necessary.
  const flipSecond=(next[1].fraction-next[0].fraction)*(next[3].fraction-next[2].fraction)<0
  setSegmentCommitting(true)
  try{
   const result=await edit({kind:'Sew',
    a:{panel:next[0].panel,edge:next[0].edge,side:'top',range:first},
    b:{panel:next[2].panel,edge:next[2].edge,side:'top',range:second},
    reverse:flipSecond,ease})
   if(result){
    freeSewPendingRef.current=[]
    setFreeSewPoints([])
    setNotice(`Free seam created: ${next[0].edge} ${(first[0]*100).toFixed(1)}–${(first[1]*100).toFixed(1)}% ↔ ${next[2].edge} ${(second[0]*100).toFixed(1)}–${(second[1]*100).toFixed(1)}%. Choose another start point or Undo.`)
   }else{
    freeSewPendingRef.current=next.slice(0,3)
    setFreeSewPoints(next.slice(0,3))
   }
  }finally{setSegmentCommitting(false)}
 }
 const selectSegmentEdge=async edge=>{
  if(playing||busy||segmentCommitting||mode!=='sew'||sewingVariant!=='segment'||!edge?.panel||!edge?.edge)return
  const candidate={panel:edge.panel,edge:edge.edge}
  const first=segmentPendingRef.current
  setSelected(candidate)
  if(!first){
   segmentPendingRef.current=candidate
   setPair([candidate])
   return
  }
  if(first.panel===candidate.panel&&first.edge===candidate.edge){
   segmentPendingRef.current=null
   setPair([])
   return
  }
  segmentPendingRef.current=null
  setPair([first,candidate])
  setSegmentCommitting(true)
  try {
   const result=await edit({kind:'Sew',
    a:{panel:first.panel,edge:first.edge,side:'top',range:[0,1]},
    b:{panel:candidate.panel,edge:candidate.edge,side:'top',range:[0,1]},
    reverse,ease})
   if(result){
    setPair([])
    setNotice(`Segment sewn: ${first.panel} / ${first.edge} → ${candidate.panel} / ${candidate.edge}. Select another pair to continue; Undo reverses the new seam.`)
   }else{
    segmentPendingRef.current=first
    setPair([first])
   }
  }finally{setSegmentCommitting(false)}
 }
 const activateSection=value=>{setSection(value);if(value==='Sewing')setMode('sew');else if(mode==='sew')setMode('edit');setPair([])}
 const changeViewportMode=value=>{
  if(!['edit','sew','pen','line','move3d','rotate3d','stretch3d'].includes(value))return
  setMode(value)
  setPair([])
  if(value==='sew'||value==='line')setSection('Sewing')
 }
 const openViewportContext=({x,y,dimension,hit,hasBackgroundImage=false})=>{
  shortcutsFocused.current=true
  if(seamEditing){
   const candidate=hit?.seamId ? state.current?.template?.seams?.find(seam=>seam.id===hit.seamId)
     :state.current?.template?.seams?.find(seam=>[seam.a,seam.b].some(side=>side.panel===hit?.panel&&side.edge===hit?.edge))
   if(candidate){
    selectExistingSewingSeam(candidate.id)
    hit={...hit,seamId:candidate.id}
   }
  }else if(hit?.panel){setSelected(hit);setHovered(null)}
  setContextMenu({x,y,dimension,hit:hit||null,hasBackgroundImage})
 }
 const requestHistory=async op=>{
  if(running.current)return
  // React updates the panel list slightly before the prior backend request's
  // busy flag clears. Keyboard repeat/rapid Undo→Redo must wait for the lock
  // rather than silently dropping the second native history operation.
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  if((op==='undo'&&state.current?.canUndo)||(op==='redo'&&state.current?.canRedo))
   return request({op})
  return null
 }
 const contextItems=(()=>{
  if(!contextMenu)return []
  const item=(id,label,shortcut,disabled=false,danger=false)=>({id,label,shortcut,disabled,danger})
  if(contextMenu.dimension==='shortcuts')return [
    item('undo','Undo','⌘Z',!s?.canUndo||busy||playing),
    item('redo','Redo','⌘⇧Z',!s?.canRedo||busy||playing),
    item('save','Save project','⌘S',busy),
    item('select','Select / edit','V'),item('draw','Draw pattern','B'),
    item('sew','Sew boundaries','E'),item('internal','Internal line','I'),
    item('move','Move 3D garment','G'),item('rotate','Rotate 3D garment','R'),
    item('hand','Fabric hand / stretch','H'),
    item('simulate',playing?'Pause simulation':'Start simulation','Space',busy&&!playing),
    item('delete','Delete selected pattern','⌫',!selected?.panel||busy||playing),
  ]
  const is2D=contextMenu.dimension==='2d'
  const hasPanel=Boolean(contextMenu.hit?.panel)
  const canEdit=!busy&&!playing
  if(seamEditing){
   const id=contextMenu.hit?.seamId||selected?.seamId
   const seam=s?.template?.seams?.find(item=>item.id===id)
   const seamActions=seam ? [
    item('edit-seam-select',`Edit Sewing · ${seam.id}`,'',true),
    {separator:true},
    item('edit-seam-reverse',seam.reverse_b?'Unreverse second edge':'Reverse second edge','',!canEdit),
    item('edit-seam-ease',seam.allow_ease?'Disable seam easing':'Allow seam easing','',!canEdit),
    item('edit-seam-soft','Stiffness · Soft (10,000)','',!canEdit),
    item('edit-seam-standard','Stiffness · Standard (50,000)','',!canEdit),
    item('edit-seam-firm','Stiffness · Firm (150,000)','',!canEdit),
    {separator:true},
    item('edit-seam-remove','Remove selected sewing relationship','',!canEdit,true),
    item('select','Exit Edit Sewing','V'),
   ] : [
    item('edit-seam-empty','Click an existing sewn edge or dotted sewing link to select it','',true),
    item('select','Exit Edit Sewing','V'),
   ]
   return contextMenu.dimension==='3d'&&stageId!=='none'&&onRemoveStage
    ? [...seamActions,{separator:true},item('remove-stage','Remove Stage','',false,true)]
    : seamActions
  }
  const common=[
    item('undo','Undo','⌘Z',!s?.canUndo||!canEdit),
    item('redo','Redo','⌘⇧Z',!s?.canRedo||!canEdit),
    {separator:true},
  ]
  const panelActions=hasPanel ? [
    item('select','Select pattern','V'),
    item(is2D?'internal':'hand',is2D?'Draw internal line':'Fabric hand / stretch',is2D?'I':'H'),
    item('duplicate','Duplicate pattern','',!canEdit),
    item('mirror','Mirror pattern','',!canEdit),
    item('delete','Delete pattern','⌫',!canEdit,true),
    {separator:true},
  ] : []
  const viewActions=is2D ? [
    item('draw','Draw new pattern','B',!canEdit),
    item('sew','Sew boundaries','E',!canEdit),
    ...(!hasPanel?[
      {separator:true},
      ...(contextMenu.hasBackgroundImage?[
        item('background-format','Format 2D Background…'),
        item('background-replace','Replace Background Image…'),
        item('background-remove','Remove Background Image','',false,true),
      ]:[item('background-add','Add Background Image…')]),
    ]:[]),
  ] : [
    item('orbit','Orbit / select','V'),
    item('move','Move garment','G'),
    item('rotate','Rotate garment','R'),
    item('hand','Fabric hand / stretch','H'),
    {separator:true},
    item('avatar',showAvatar?'Hide avatar':'Show avatar'),
    item('wireframe',wireframe?'Hide wireframe':'Show wireframe'),
    item('seams',showSeams?'Hide seam links':'Show seam links'),
    item('simulate',playing?'Pause simulation':'Start simulation','Space',busy&&!playing),
    ...(stageId!=='none'&&onRemoveStage?[{separator:true},item('remove-stage','Remove Stage','',false,true)]:[]),
  ]
  return [...common,...panelActions,...viewActions,{separator:true},item('shortcuts','Keyboard shortcuts','?')]
 })()
 const executeContextAction=(id,context)=>{
  const panel=context?.hit?.panel ?? (context?.dimension==='shortcuts'?selected?.panel:null)
  if(id.startsWith('edit-seam-')&&id!=='edit-seam-select'&&id!=='edit-seam-empty'){
   const seamId=context?.hit?.seamId||selected?.seamId
   const seam=state.current?.template?.seams?.find(item=>item.id===seamId)
   if(!seam||busy||playing)return
   if(id==='edit-seam-remove'){
    if(window.confirm(`Remove sewing relationship ${seam.id}? Native Undo restores it.`))
      void edit({kind:'RemoveSeam',seam:seam.id}).then(result=>{if(result)setSelected(null)})
    return
   }
   const updates={
    'edit-seam-reverse':{reverse:!seam.reverse_b},
    'edit-seam-ease':{ease:!seam.allow_ease},
    'edit-seam-soft':{stiffness:10000},
    'edit-seam-standard':{stiffness:50000},
    'edit-seam-firm':{stiffness:150000},
   }[id]
   if(updates)void request({op:'edit-seam',seam:seam.id,
     reverse:seam.reverse_b,ease:seam.allow_ease,stiffness:seam.stiffness,...updates})
     .then(result=>{if(result)setNotice(`Updated native sewing relationship ${seam.id}. Undo restores the earlier settings.`)})
   return
  }
  switch(id){
   case 'remove-stage':
    if(context?.dimension==='3d'&&stageId!=='none'&&onRemoveStage){
     onRemoveStage()
     setNotice('Stage removed from 3D view. Garment and avatar preserved.')
    }
    break
   case 'background-add':case 'background-format':case 'background-replace':case 'background-remove':
    window.dispatchEvent(new CustomEvent('exo-open-2d-background-image',{
      detail:{editor:'native',action:id.substring('background-'.length)},
    }));break
   case 'undo':if(!playing)void requestHistory('undo');break
   case 'redo':if(!playing)void requestHistory('redo');break
   case 'save':if(!busy)void save(false);break
   case 'select':case 'orbit':
    changeViewportMode('edit');setSeamEditing(false)
    window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:'select'}}))
    break
   case 'draw':setMode('pen');setSection('Pattern');setPair([]);break
   case 'internal':changeViewportMode('line');break
   case 'sew':changeViewportMode('sew');break
   case 'move':changeViewportMode('move3d');break
   case 'rotate':changeViewportMode('rotate3d');break
   case 'hand':changeViewportMode('stretch3d');break
   case 'duplicate':if(panel&&!busy&&!playing)void edit({kind:'Duplicate',panel});break
   case 'mirror':if(panel&&!busy&&!playing)void edit({kind:'Mirror',panel,axis:'x',copy_side:1});break
   case 'delete':
    if(panel!=null&&!busy&&!playing&&state.current?.template?.panels?.some(item=>item.id===panel)){
     setContextMenu(null)
     void edit({kind:'RemovePanel',panel}).then(result=>{
      if(!result)return
      setSelected(current=>current?.panel===panel?null:current)
      setHovered(current=>current?.panel===panel?null:current)
      setPair(current=>current.filter(item=>item?.panel!==panel))
      setNotice(`Deleted pattern ${panel}. Press ⌘Z to undo.`)
     })
    }
    break
   case 'avatar':setShowAvatar(v=>!v);break
   case 'wireframe':setWireframe(v=>!v);break
   case 'seams':setShowSeams(v=>!v);break
   case 'simulate':if(!busy||playing)void play();break
   case 'shortcuts':setContextMenu({x:Math.round(window.innerWidth/2-120),y:Math.round(window.innerHeight/2-200),dimension:'shortcuts',hit:null});break
   default:break
  }
 }
 // Preserve the original EXO keyboard focus when users work elsewhere in the
 // native app. Modifier shortcuts only intercept keys while this workspace
 // has been activated, and never while entering property values or file names.
 useEffect(()=>{
  const activate=event=>{
   if(event.target.closest?.('.cc-native-context-menu'))return
   shortcutsFocused.current=Boolean(workspaceRoot.current?.contains(event.target))
  }
  const keyboard=event=>{
   if(!shortcutsFocused.current||event.defaultPrevented)return
  const target=event.target
  if(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'))return
  // The corner toolbar owns Escape while a flyout option has keyboard focus.
  // Let its local handler close the row without changing the drawing mode or
  // replacing the user's current Property Editor selection.
  if(event.key==='Escape'&&target?.closest?.('.exo-viewport-inline-tools'))return
   const key=event.key.toLowerCase()
   const modifier=event.metaKey||event.ctrlKey
   let action=null
   if(modifier&&!event.altKey){
    if(key==='z')action=event.shiftKey?'redo':'undo'
    else if(key==='y')action='redo'
    else if(key==='s')action='save'
   } else if(!event.altKey&&!modifier&&!event.shiftKey){
    const map={v:'select',b:'draw',e:'sew',i:'internal',g:'move',r:'rotate',h:'hand',' ':'simulate','?':'shortcuts'}
    action=map[key]||null
    if(key==='delete'||key==='backspace')action='delete'
   } else if(!modifier&&!event.altKey&&event.key==='?')action='shortcuts'
   if(event.key==='Escape'){
    action='select'
    setContextMenu(null)
    setPair([])
    setSelected(null)
   }
   if(!action)return
   // The 2D board owns the newest uncommitted polygon/line vertex. Its own
   // capture listener rewinds that draft before native Rust history applies.
   if(action==='undo'&&document.querySelector('.cc-board polyline[stroke="#ef6339"]'))return
   event.preventDefault()
   event.stopPropagation()
   event.stopImmediatePropagation?.()
   setContextMenu(null)
   executeContextAction(action,{dimension:'shortcuts',hit:selected})
  }
  document.addEventListener('pointerdown',activate,true)
  window.addEventListener('keydown',keyboard,true)
  return()=>{document.removeEventListener('pointerdown',activate,true);window.removeEventListener('keydown',keyboard,true)}
 },[busy,playing,selected,s?.canUndo,s?.canRedo,contextMenu])
 const downloadText=(content,filename,type)=>{const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 const exportClothObj=()=>{if(!s)return;const lines=['# EXO ClothCraft Studio research cloth OBJ (not factory fit)','o cloth'];s.positions.forEach(p=>lines.push(`v ${p.join(' ')}`));s.triangles.forEach(t=>lines.push(`f ${t.map(n=>n+1).join(' ')}`));downloadText(lines.join('\n'),'exo-clothcraft-simulation.obj','text/plain');setNotice('Exported the current Rust cloth mesh as a reference OBJ (not fit certified).')}
 const exportPatternSvg=()=>{if(!s)return;const pts=[],lines=s.panels.flatMap((range,i)=>Object.values(range.boundaries).map(indices=>{const coordinates=indices.map(index=>boardPoint(s,index)).map(v=>v.map(n=>n*1000));pts.push(...coordinates);return `<polyline points="${coordinates.map(v=>v.map(n=>n.toFixed(3)).join(',')).join(' ')}" fill="none" stroke="${COLORS[i%COLORS.length]}" stroke-width="1" stroke-linecap="round"/>`}));if(!pts.length)return;const minX=Math.min(...pts.map(p=>p[0]))-50,minY=Math.min(...pts.map(p=>p[1]))-50,maxX=Math.max(...pts.map(p=>p[0]))+50,maxY=Math.max(...pts.map(p=>p[1]))+50;downloadText(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><title>EXO ClothCraft material-space reference only; not a factory pattern</title>${lines.join('')}</svg>`,'exo-clothcraft-pattern-reference.svg','image/svg+xml');setNotice('Saved visual SVG guide. Not a factory pattern or print-to-scale DXF.')}
 // Upstream live mouse spring: coalesce pointer targets, never pause physics
 // or overwrite particles. The solver owns all visible cloth deformation.
 const livePointer=useRef({pending:undefined,sending:false,held:false})
 const queueLiveGrab=async value=>{
  const q=livePointer.current;q.pending=value
  if(q.sending)return
  q.sending=true
  try{
   while(q.pending!==undefined){
    const grab=q.pending;q.pending=undefined
    const response=await fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'grab',grab})})
    const result=await response.json()
    if(!response.ok||!result.ok)throw Error(result.error||'Live cloth grab failed')
   }
  }catch(error){setError(error.message);q.pending=undefined;q.held=false}
  finally{q.sending=false}
 }
 const startClothGrab=async grab=>{
  livePointer.current.held=true;livePointer.current.ready=false;livePointer.current.target=grab
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,10))
  if(!livePointer.current.held||modeIntent.current!=='stretch3d')return
  if(!running.current){void play();while(lock.current)await new Promise(resolve=>setTimeout(resolve,10))}
  if(livePointer.current.held&&running.current){livePointer.current.ready=true;void queueLiveGrab(livePointer.current.target)}
 }
 const cancelClothGrab=()=>{livePointer.current.held=false;livePointer.current.ready=false;void queueLiveGrab(null)}
 // Reset the *3D simulated pose*, not the authored pattern or sewn edges.
 // This is safe even if the user hits Reset while physics or a fabric grab is
 // running: stop automatic stepping, finish any pending operation, then ask
 // Rust to restore the editable garment's original off-body initial_state.
 const resetPatternPosition=async()=>{
  modeIntent.current='edit';previousMode.current='edit';++modeTransition.current;++runToken.current;setMode('edit')
  if(!state.current?.template){
   const recovered=await request({op:'recover-off-body'})
   if(recovered){
    setSelected(null);setHovered(null);setPair([]);setMode('edit')
    setNotice('Recovered off-body panels from the saved garment. The original project and drape were backed up before recovery. Press SIM to try again.')
   }
   return
  }
  running.current=false
  resumeAfterGrab.current=false
  setPlaying(false)
  await grabPause.current
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  // A diverged solver may return an error from pause/snapshot even after
  // stopping. Reset must use the cached last-authoritative revision, rather
  // than failing because a previous OGC intersection blocks snapshots.
  await request({op:'pause'})
  await request({op:'snapshot'})
  fitAfterReset.current=stageId==='EXO01'
  const result=await request({op:'reset',revision:state.current?.revision})
  if(!result){fitAfterReset.current=false;return}
  setPair([])
  setSelected(null)
  setHovered(null)
  setMode('edit')
  setNotice('Patterns returned to their original off-body positions. Pattern shapes, sewing links and materials are preserved. Press SIM to drape again.')
 }
 const resetBoardArrangement=async()=>{
  if(lock.current){setNotice('Wait for the current operation before resetting the 2D arrangement.');return}
  if(running.current){running.current=false;setPlaying(false);await request({op:'pause'})}
  let x=0
  const commands=(state.current?.template?.panels||[]).map(panel=>{
   const command={kind:'BoardTransform',panel:panel.id,origin:[x,0],rotation_degrees:0}
   x+=panel.pattern.width+.15;return command
  })
  if(commands.length){const result=await request({op:'edit-batch',commands});if(result)setNotice('Reset all 2D panel layouts. Drape, rest patterns and materials preserved. Undo restores all layouts together.')}
 }
 const pullClothPoint=grab=>{
  livePointer.current.target=grab
  if(livePointer.current.held&&livePointer.current.ready&&modeIntent.current==='stretch3d'&&running.current)void queueLiveGrab(grab)
 }
 const placeVisiblePanel=async command=>{
  const original=state.current?.template?.panels?.find(panel=>panel.id===command.panel)
  if(!original||!command?.placement)return
  if(running.current){running.current=false;setPlaying(false);while(lock.current)await new Promise(resolve=>setTimeout(resolve,20));await request({op:'pause'})}
  // Authored Place arranges flat panels BEFORE simulation. Once draped, move
  // the current solver particles, preserving the other panels' exact pose.
  if(!(state.current?.time>0))return edit(command)
  const prior=original.placement
  const translation_delta=command.placement.translation.map((n,i)=>n-(prior.translation[i]||0))
  const rotation_delta_degrees=command.placement.rotation_degrees.map((n,i)=>n-(prior.rotation_degrees[i]||0))
  const result=await request({op:'pose-panel',panel:command.panel,translation_delta,rotation_delta_degrees})
  if(result)setNotice(`Repositioned ${original.name} as simulated cloth; other draped panels stayed fixed. Connected seams relax on the next physics step.`)
  return result
 }
 const showPiece=item=>{setSelected({panel:item});setHovered(null)}
 const filtered=value=>value.toLowerCase().includes(filter.trim().toLowerCase())
 useEffect(()=>{
  if(!embedded)return undefined
  const selectAvatar=async event=>{
   const model=event.detail?.model
   if(!['makehuman-base','clo-thomas'].includes(model)){
    setError('Native V2 supports MakeHuman and CLO Thomas collision avatars.')
    return
   }
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   if(running.current){running.current=false;setPlaying(false);await request({op:'pause'})}
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   const result=await request({op:'select-avatar',model})
   if(!result)return
   setShowAvatar(true)
   setSelected(null);setHovered(null)
   setNotice(`${model==='clo-thomas'?'CLO Thomas':'MakeHuman'} loaded as the native 2D and 3D fitting body. Garment patterns and seams preserved; simulation reset for the new collider.`)
   window.dispatchEvent(new CustomEvent('exo-clothcraft-native-avatar-applied',{detail:{model}}))
  }
  window.addEventListener('exo-clothcraft-select-avatar',selectAvatar)
  return()=>window.removeEventListener('exo-clothcraft-select-avatar',selectAvatar)
 },[embedded,request])
 useEffect(()=>{
  if(!embedded)return undefined
  const dispatch=event=>{
   const command=event.detail
   if(['duplicate-selected','mirror-selected','delete-selected','trace-selected'].includes(command)&&!selected?.panel){setNotice('Select a native fabric panel first.');return}
   if((busy||playing)&&['file:new','file:open'].includes(command)){setNotice('Pause the native simulation and finish the current operation before opening a different project.');return}
   // History requests wait for the in-flight Rust edit inside requestHistory.
   // Rejecting them on React's transient busy flag loses immediate Cmd+Z.
   if(busy&&['save','export','duplicate-selected','mirror-selected','delete-selected','trace-selected'].includes(command)){setNotice('Wait for the current native operation to finish, then try again.');return}
   if(command==='file:new')void openPreset('tshirt')
   else if(command==='file:open')nativeOpenInput.current?.click()
   else if(command==='toggle-sim')void play()
   else if(command==='redrape'&&!running.current)void play()
   else if(command==='reset-2d')void resetBoardArrangement()
   // An edit's UI can settle before its Rust request releases the async lock.
   // Queue history behind that lock rather than silently dropping immediate
   // Undo/Redo from the CLO toolbar or macOS menu.
   else if(command==='undo')void requestHistory('undo')
   else if(command==='redo')void requestHistory('redo')
   else if(command==='save'&&!busy)void save(false)
   else if(command==='export'&&!busy)void save(true)
   else if(command==='reset'||command==='reset-position')void resetPatternPosition()
   else if(command==='step'&&!busy)void request({op:'step',steps:1})
   else if(command==='tool:base-polygon'){
    setBasePolygonOpen(true)
    setMode('edit')
    setNotice('Base Polygon: choose a shape and exact dimensions. Create adds a native Rust pattern; Undo reverses the result.')
   }
   else if(command==='duplicate-selected'&&!busy&&selected?.panel)void edit({kind:'Duplicate',panel:selected.panel})
   else if(command==='trace-selected'&&!busy&&selected?.panel){
    if(running.current||playing){setNotice('Pause native simulation before tracing a source contour.');return}
    void (async()=>{
      const result=await request({op:'trace-contour',panel:selected.panel,revision:state.current?.revision})
      if(!result)return
      const traced=result.template?.panels?.at(-1)
      if(traced?.id)setSelected({panel:traced.id})
      setNotice('Trace created an independent straight-edge native pattern. Undo restores the prior draft; curves and holes are rejected.')
    })()
   }
   else if(command==='mirror-selected'&&!busy&&selected?.panel)void edit({kind:'Mirror',panel:selected.panel,axis:'x',copy_side:1})
   else if(command==='delete-selected'&&!busy&&selected?.panel){
    if(window.confirm('Remove the selected ClothCraft panel and all its seams?'))void edit({kind:'RemovePanel',panel:selected.panel})
   }
   else if(command==='analysis:strain'||command==='analysis:surface')setAnalysisMode(command.slice(9))
   else if(command==='wireframe')setWireframe(x=>!x)
   else if(command==='seams')setShowSeams(x=>!x)
   else if(command==='avatar')setShowAvatar(x=>!x)
   else if(typeof command==='string'&&command.startsWith('set-wireframe:'))setWireframe(command.endsWith('true'))
   else if(typeof command==='string'&&command.startsWith('set-seams:'))setShowSeams(command.endsWith('true'))
   else if(typeof command==='string'&&command.startsWith('select:')){
    const id=command.slice(7).toLowerCase()
    if(id==='none'){setSelected(null);setHovered(null);return}
    const matching=state.current?.template?.panels.find(p=>p.id.toLowerCase()===id||p.name.toLowerCase()===id)
    if(matching)setSelected({panel:matching.id})
   }
   else if(typeof command==='string'&&command.startsWith('mode:')){setMode(command.slice(5));setPair([])}
  }
  window.addEventListener('exo-clothcraft-command',dispatch)
  return()=>window.removeEventListener('exo-clothcraft-command',dispatch)
 },[embedded,busy,playing,play,request,selected])
 useEffect(()=>{
  if(!embedded||!s)return
  const panelRefs=(s.template?.panels||[]).map(p=>({
    id:p.id,name:p.name,type:'pattern',itemNo:s.propertyMetadata?.panels?.[p.id]?.itemNo||'',
    fabricId:p.fabric,
  }))
  const fabricRefs=(s.template?.fabrics||[]).map(f=>({
    id:f.id,name:f.name,type:'fabric',itemNo:s.propertyMetadata?.fabrics?.[f.id]?.itemNo||'',
    construction:s.propertyMetadata?.fabrics?.[f.id]?.construction||'',
    supplier:s.propertyMetadata?.fabrics?.[f.id]?.supplier||'',
    owner:s.propertyMetadata?.fabrics?.[f.id]?.owner||'',
    appearance:s.propertyMetadata?.fabrics?.[f.id]?.appearance||null,
    properties:f.properties||null,
  }))
  const measuredSelection=measureNativeSelection(s,selected)
  const activePanel=panelRefs.find(p=>p.id===measuredSelection?.panelId)
  window.dispatchEvent(new CustomEvent('exo-clothcraft-status',{detail:{
   name:s.template?.name||'ClothCraft garment',revision:s.revision||0,avatarModel:s.avatarModel||'makehuman-base',
   panels:s.template?.panels?.length||0,seams:s.template?.seams?.length||0,
   panelRefs,fabricRefs,
   graphicRefs:nativeGraphics.map(graphic=>({id:graphic.id,name:graphic.name,
     panel:graphic.panel,widthMm:graphic.widthMm,heightMm:graphic.heightMm,visible:graphic.visible,
     thumbnail:graphicThumbnailCache.current.get(graphic.id)?.source===graphic.dataUrl?graphicThumbnailCache.current.get(graphic.id)?.thumbnail:null})),
   selectedGraphicId,
   showGraphicMeasurements,
   importedHardware:(s.importedHardware||[]).map(entry=>({...entry,name:cloAssetsById.get(entry.assetId)?.name||entry.assetId,
     sourcePath:cloAssetsById.get(entry.assetId)?.sourcePath||'',
     thumbnail:cloAssetsById.get(entry.assetId)?.thumbnail||'',
     glbUrl:cloAssetsById.get(entry.assetId)?.glb||'',
     dimensionsMm:importedCloHardwareDimensions(cloAssetsById.get(entry.assetId))})),
   canUndoHardware:Boolean(s.canUndoHardware),canRedoHardware:Boolean(s.canRedoHardware),
   seamRefs:s.template?.seams?.map(seam=>({id:seam.id,first:seam.a?.panel,second:seam.b?.panel}))||[],
   seamMeasurements:s.template?.seams?.map(seam=>measureNativeSelection(s,{seamId:seam.id})).filter(Boolean)||[],
   vertices:s.positions?.length||0, time:s.time||0,running:playing,busy,mode,
   canUndo:Boolean(s.canUndo),canRedo:Boolean(s.canRedo),
   selection:measuredSelection?{...measuredSelection,itemNo:activePanel?.itemNo||''}:null,
  }}))
 },[embedded,playing,busy,mode,selected?.panel,selected?.edge,selected?.seamId,s?.revision,s?.positions,s?.propertyMetadata,s?.template?.name,s?.template?.panels?.length,s?.template?.fabrics,s?.template?.seams?.length,s?.canUndo,s?.canRedo,s?.importedHardware,cloAssetsById,nativeGraphics,selectedGraphicId,showGraphicMeasurements,graphicThumbnailVersion,Math.floor(s?.time||0)])
 useEffect(()=>{
  if(!embedded)return
  const open=()=>setFoamOpen(true)
  window.addEventListener('exo-clothcraft-open-foam-padding',open)
  return()=>window.removeEventListener('exo-clothcraft-open-foam-padding',open)
 },[embedded])
 if(embedded){
  const layout=exoLayout==='3d'?'3d':exoLayout==='2d'?'2d':exoLayout==='stack'?'stack':'split'
  const nativeFabricPanel=inspectorFabricId
    ?s?.template?.panels?.find(p=>p.fabric===inspectorFabricId)||null
    :selectedPanel||s?.template?.panels?.[0]||null
  return <div ref={workspaceRoot} className={`cc-embedded-root cc-embedded-${layout}`} aria-label="ClothCraft linked native Rust 3D and 2D editors" data-native-clothcraft="true" style={{'--cc-embedded-split':`${exoSplit}%`}}>
   <input ref={nativeOpenInput} data-native-project-import="true" type="file" accept=".json,application/json" hidden onChange={importFile}/>
   <ClothCraftContextMenu context={contextMenu} items={contextItems} onChoose={executeContextAction} onClose={()=>setContextMenu(null)}/>
   {(error||notice)&&<div className={error?'cc-error':'cc-notice'} role="status">{error||notice}<button onClick={()=>{setError('');setNotice('')}}>×</button></div>}
   <CloFloatingPanel kind="free-sewing" title="Free Sewing" open={mode==='sew'&&sewingVariant==='free'} active={true} onClose={()=>{setMode('edit');setFreeSewPoints([])}}>
    <section className="cc-embedded-sew-commit" data-native-free-sewing-settings="true" aria-label="Free sewing properties">
     <strong>FREE SEWING</strong>
     <label><span>Allow unequal seam lengths</span><input type="checkbox" aria-label="Allow Free Sewing easing" checked={ease} onChange={event=>setEase(event.target.checked)} disabled={segmentCommitting}/></label>
     {freeSewPoints.length>0&&<button type="button" onClick={clearFreeSew}>Clear selected endpoints</button>}
   </section></CloFloatingPanel>
   <CloFloatingPanel kind="base-polygon" title="Base Polygon" open={basePolygonOpen} active={true} onClose={()=>setBasePolygonOpen(false)}><section className="cc-embedded-sew-commit" data-native-base-polygon="true" aria-label="Native base polygon creation">
     <strong>BASE POLYGON</strong>
     <label>Shape <select aria-label="Base polygon shape" value={shape} onChange={event=>setShape(event.target.value)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="sector">Sector</option></select></label>
     {size.map((mm,index)=><label key={index}>{index?'Height':'Width'} (mm) <input aria-label={`Base polygon ${index?'height':'width'} in millimetres`} type="number" min="5" max="10000" step="5" value={mm} onChange={event=>setSize(current=>current.map((value,j)=>j===index?Number(event.target.value):value))}/></label>)}
     <button type="button" disabled={busy||playing||!s?.template?.fabrics?.[0]||size.some(mm=>!Number.isFinite(mm)||mm<5||mm>10000)} onClick={async()=>{
       const before=state.current
       const fabric=before?.template?.fabrics?.[0]?.id
       if(!fabric)return
       const result=await edit({kind:'Primitive',shape,size:size.map(mm=>mm/1000),origin:[0,0],fabric})
       if(result){setBasePolygonOpen(false);setNotice(`Created native ${shape} pattern, ${size[0]} × ${size[1]} mm. Undo restores previous topology.`)}
     }}>Create native pattern</button>
     <button type="button" onClick={()=>setBasePolygonOpen(false)}>Cancel</button>
   </section></CloFloatingPanel>
   <CloFloatingPanel kind="fabric-fill" title="Fill Pattern" open={fillPanelOpen} active={true} onClose={()=>setFillPanelOpen(false)}><section className="cc-embedded-sew-commit" data-native-fill-panel="true" aria-label="Native pattern fabric fill">
     <strong>FILL PATTERN · RUST FABRIC</strong>
     <label>Pattern<select aria-label="Pattern to fill" value={fillPanelTarget} onChange={event=>setFillPanelTarget(event.target.value)}>{(s?.template?.panels||[]).map(panel=><option key={panel.id} value={panel.id}>{panel.name}</option>)}</select></label>
     <label>Material<select aria-label="Fill with existing material" value={fillFabricId} onChange={event=>setFillFabricId(event.target.value)}>{(s?.template?.fabrics||[]).map(fabric=><option key={fabric.id} value={fabric.id}>{fabric.name}</option>)}</select></label>
     <button type="button" data-native-fill-apply="true" disabled={busy||playing||!fillPanelTarget||!s?.template?.fabrics?.some(f=>f.id===fillFabricId)} onClick={async()=>{
       const fabric=state.current?.template?.fabrics?.find(f=>f.id===fillFabricId)
       const panel=state.current?.template?.panels?.find(p=>p.id===fillPanelTarget)
       if(!fabric||!panel){setError('Choose a valid native panel and material.');return}
       const result=await edit({kind:'Fabric',panel:panel.id,name:fabric.name,properties:fabric.properties,all_panels:false})
       if(result){setNotice(`Filled ${panel.name} with ${fabric.name} in the native garment. Undo reverses the material assignment.`);setFillPanelOpen(false)}
     }}>Apply fabric fill to pattern</button>
     <button type="button" onClick={()=>setFillPanelOpen(false)}>Cancel</button>
     <small>Applies a physical material to the entire native panel. Area paint and masks are separate features.</small>
   </section></CloFloatingPanel>
   <CloFloatingPanel kind="fullness" title="Fullness" open={fullnessOpen} active={true} onClose={()=>setFullnessOpen(false)}><section className="cc-embedded-sew-commit" data-native-fullness="true" aria-label="Native gathered fullness">
     <strong>FULLNESS · GATHERED STRIP</strong>
     {(s?.template?.panels||[]).some(p=>p.polygon?.lines?.length)?<>
       <label>Pattern<select aria-label="Fullness source pattern" value={fullnessPanel} onChange={event=>{
         const id=event.target.value;setFullnessPanel(id);setFullnessLine(s?.template?.panels?.find(p=>p.id===id)?.polygon?.lines?.[0]?.id||'')
       }}>{s.template.panels.filter(p=>p.polygon?.lines?.length).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
       <label>Internal line<select aria-label="Fullness source internal line" value={fullnessLine} onChange={e=>setFullnessLine(e.target.value)}>{(s.template.panels.find(p=>p.id===fullnessPanel)?.polygon?.lines||[]).map(line=><option key={line.id} value={line.id}>{line.id}</option>)}</select></label>
       <label>Strip width (mm)<input aria-label="Fullness strip width millimetres" type="number" min="5" max="1000" step="5" value={ruffleWidth} onChange={e=>setRuffleWidth(Number(e.target.value))}/></label>
       <label>Gather ratio<input aria-label="Fullness gathering ratio" type="number" min="1" max="4" step="0.1" value={ruffleRatio} onChange={e=>setRuffleRatio(Number(e.target.value))}/></label>
       <button type="button" data-native-fullness-apply="true" disabled={busy||playing||!fullnessPanel||!fullnessLine||!Number.isFinite(ruffleWidth)||ruffleWidth<5||ruffleWidth>1000||!Number.isFinite(ruffleRatio)||ruffleRatio<1||ruffleRatio>4} onClick={async()=>{
         const result=await edit({kind:'Ruffle',panel:fullnessPanel,line:fullnessLine,width:ruffleWidth/1000,ratio:ruffleRatio})
         if(result){setNotice('Created a native sewn fullness strip from the selected internal line. Undo removes the new panel and seam.');setFullnessOpen(false)}
       }}>Create sewn fullness strip</button>
     </>:<span role="status">Draw an internal line first with Internal Polygon/Line, then use Fullness to create a gathered strip.</span>}
     <button type="button" onClick={()=>setFullnessOpen(false)}>Cancel</button>
     <small>Actual Rust geometry and sewing creation. Point-directed fullness on an existing contour is not implemented.</small>
   </section></CloFloatingPanel>
   <CloFloatingPanel kind="pattern-validation" title="Pattern Tool" open={Boolean(drawingError)} active={true} onClose={()=>setDrawingError('')}>
    <div className="clo-floating-tool-body"><div className="clo-finishing-inset" role="status">{drawingError}</div><button type="button" onClick={()=>setDrawingError('')}>OK</button></div>
   </CloFloatingPanel>
   {typeof document!=='undefined'&&createPortal(<CloFloatingPanel kind="grading" title={gradeMode==='auto'?'Auto Grading':'Pattern Grading'} open={Boolean(gradeMode)} active={true} onClose={()=>{setGradeMode('');window.dispatchEvent(new Event('exo-clothcraft-grading-panel-closed'))}}>
     <div className="clo-native-grading" data-native-grade-pattern="true" data-grading-variant={gradeMode} aria-label="Native pattern grading">
       <div className="clo-floating-tool-body">
         <div className="clo-finishing-inset">
           <label className="clo-grading-row">
             <span>Pattern</span>
             <select aria-label="Pattern to grade" value={gradePanelTarget} onChange={event=>setGradePanelTarget(event.target.value)}>
               {(s?.template?.panels||[]).map(panel=><option key={panel.id} value={panel.id}>{panel.name}</option>)}
             </select>
           </label>
           {gradeMode==='auto'?<label className="clo-grading-row">
             <span>Size step</span>
             <select aria-label="Auto grading increment" value={gradeStep} onChange={event=>setGradeStep(Number(event.target.value))}>
               <option value={-2}>Down two steps</option><option value={-1}>Down one step</option>
               <option value={1}>Up one step</option><option value={2}>Up two steps</option>
             </select>
           </label>:<>
             <label className="clo-grading-row">
               <span>Width change</span>
               <div className="clo-grading-unit">
                 <input aria-label="Grade width delta millimetres" type="number" min="-500" max="500" step="1"
                   value={gradeWidthDelta} onChange={event=>setGradeWidthDelta(Number(event.target.value))}/>
                 <span>mm</span>
               </div>
             </label>
             <label className="clo-grading-row">
               <span>Height change</span>
               <div className="clo-grading-unit">
                 <input aria-label="Grade height delta millimetres" type="number" min="-500" max="500" step="1"
                   value={gradeHeightDelta} onChange={event=>setGradeHeightDelta(Number(event.target.value))}/>
                 <span>mm</span>
               </div>
             </label>
           </>}
         </div>
         <div className="clo-grading-preview" aria-label="Grading dimensions preview">
           <span>Pattern size change</span>
           <strong>{gradeMode==='auto'?20*gradeStep:gradeWidthDelta>=0?`+${gradeWidthDelta}`:gradeWidthDelta} × {gradeMode==='auto'?10*gradeStep:gradeHeightDelta>=0?`+${gradeHeightDelta}`:gradeHeightDelta} mm</strong>
         </div>
         <p className="clo-grading-note">Rust single-panel affine grading adjusts real contour points, cubic controls and free curve points with native Undo and saved history. Notch depths and allowance widths remain metric. Holes, internal lines, linked multisize rule grading and factory approval still require further work.</p>
         <div className="clo-grading-actions">
           <button type="button" onClick={()=>{setGradeMode('');window.dispatchEvent(new Event('exo-clothcraft-grading-panel-closed'))}}>Cancel</button>
           <button type="button" className="clo-grade-primary" data-native-grade-apply="true"
             disabled={busy||playing||!gradePanelTarget||!Number.isFinite(gradeMode==='auto'?gradeStep:gradeWidthDelta)||!Number.isFinite(gradeMode==='auto'?gradeStep:gradeHeightDelta)||Math.abs(gradeMode==='auto'?20*gradeStep:gradeWidthDelta)>500||Math.abs(gradeMode==='auto'?10*gradeStep:gradeHeightDelta)>500}
             onClick={async()=>{
               const panel=state.current?.template?.panels?.find(p=>p.id===gradePanelTarget)
               if(!panel){setError('Select a valid native pattern first.');return}
               const width=gradeMode==='auto'?20*gradeStep:gradeWidthDelta,height=gradeMode==='auto'?10*gradeStep:gradeHeightDelta
               while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
               const result=await request({op:'grade-pattern',panel:panel.id,width_delta_mm:width,height_delta_mm:height})
               if(result){
                 setNotice(`Graded ${panel.name} ${width>=0?'+':''}${width} mm wide, ${height>=0?'+':''}${height} mm high. Rust Undo restores its original dimensions.`)
                 setGradeMode('')
                 window.dispatchEvent(new Event('exo-clothcraft-grading-panel-closed'))
               }
             }}>Apply Grading</button>
         </div>
       </div>
     </div>
   </CloFloatingPanel>,document.body)}
   {typeof document!=='undefined'&&createPortal(<CloFloatingPanel kind="walk" title="Walk Pattern" open={walkOpen} active={true} onClose={()=>setWalkOpen(false)}>
   <section className="clo-walk-body clo-floating-tool-body" data-native-seam-walk="true" aria-label="Walk native sewing relationship">
     <div className="clo-finishing-inset"><strong className="clo-walk-label">Matched sewing edges</strong>
     {(s?.template?.seams?.length||0)>0?<>
       <label>Sewn edge pair<select aria-label="Walk sewing pair" value={walkSeamId} onChange={event=>{setWalkSeamId(event.target.value);setWalkFraction(0)}}>{s.template.seams.map(seam=><option key={seam.id} value={seam.id}>{seam.id} · {seam.a.panel} / {seam.a.edge} ↔ {seam.b.panel} / {seam.b.edge}</option>)}</select></label>
       {(()=>{const measured=measureNativeSelection(s,{seamId:walkSeamId});if(!measured)return null;const a=measured.first.length2DCm,b=measured.second.length2DCm;return <div className="clo-walk-measures" data-native-walk-measurements="true" role="status"><div><span>First cut edge</span><strong>{a?.toFixed(2)??'—'} cm</strong></div><div><span>Second cut edge</span><strong>{b?.toFixed(2)??'—'} cm</strong></div><div><span>Mismatch</span><strong>{a!=null&&b!=null?(Math.abs(a-b)*10).toFixed(1)+' mm':'—'}</strong></div></div>})()}
       <label className="clo-walk-slider">Matched arclength <input aria-label="Walk arclength fraction" type="range" min="0" max="1" step="0.01" value={walkFraction} onChange={event=>setWalkFraction(Number(event.target.value))}/><output>{(walkFraction*100).toFixed(0)}%</output></label>
       <small>Both highlighted dots move along their actual Rust material-space boundary coordinates. This measures mismatch; it does not automatically ease or reshape geometry.</small>
     </>:<span role="status">No native sewing pairs yet. Use Segment Sewing or Free Sewing to connect two pattern edges.</span>}
     </div><button className="clo-walk-close" type="button" onClick={()=>setWalkOpen(false)}>Close</button>
   </section>
   </CloFloatingPanel>,document.body)}
   {exoSection==='Fabric'&&fabricHost&&createPortal(<ClothCraftFabricLibrary snapshot={s} panel={nativeFabricPanel} busy={busy||playing} onEdit={edit} showPresets={false}/>,fabricHost)}
   {foamOpen&&<CloFloatingPanel kind="foam-padding" title="Foam Padding / Trapunto" open={foamOpen} active={true} onClose={()=>setFoamOpen(false)}>
    <section data-native-foam-padding="true" className="cc-foam-editor">
     <div className="cc-foam-hero"><div className="cc-foam-hero-mark"><Layers size={19}/></div><div><strong>Raised Foam Studio</strong><span>SVG contours → sculpted padding → stitch guides</span></div><span className="cc-foam-draft-chip">PREVIEW</span></div>
     <div className="cc-foam-upload-area">
      <input ref={foamFileInput} hidden type="file" accept=".svg,image/svg+xml" onChange={importNativeFoam}/>
      <button type="button" className="cc-foam-import" disabled={!s?.template?.panels?.length} onClick={()=>foamFileInput.current?.click()}><UploadCloud size={20}/><span><strong>Import SVG shape</strong><small>Closed vector paths · up to 3 MB</small></span><span aria-hidden="true">+</span></button>
     </div>
     {foamMessage&&<p className="cc-foam-message" role="status">{foamMessage}</p>}
     <div className="cc-foam-section-heading"><span>SHAPE LAYERS</span><strong>{nativeFoamPads.length} {nativeFoamPads.length===1?'shape':'shapes'}</strong></div>
     {nativeFoamPads.length===0&&<div className="cc-foam-empty"><Layers size={26}/><strong>No padding shapes yet</strong><span>Import an SVG to place raised foam on the selected garment pattern.</span></div>}
     {nativeFoamPads.length>0&&<div className="cc-foam-layer-list" role="group" aria-label="Foam layers">{nativeFoamPads.map((pad,index)=><button key={pad.id} type="button" className={`cc-foam-layer ${selectedFoamId===pad.id?'is-selected':''}`} aria-pressed={selectedFoamId===pad.id} onClick={()=>setSelectedFoamId(pad.id)}><span className="cc-foam-layer-icon"><Layers size={15}/></span><span className="cc-foam-layer-info"><strong>{pad.name||`Foam layer ${index+1}`}</strong><small>{pad.panel} · {Number(pad.depthCm||0).toFixed(1)} cm raised</small></span>{pad.locked?<LockKeyhole size={14}/>:<ChevronRight size={15}/>}</button>)}</div>}
     {nativeFoamPads.filter(pad=>pad.id===(selectedFoamId||nativeFoamPads[0]?.id)).map(pad=><div className="cc-foam-selected" key={pad.id}>
      <div className="cc-foam-section-heading"><span>PLACEMENT & SHAPE</span><span className="cc-foam-status-dot">Live 2D + 3D</span></div>
      <div className="cc-foam-form">
       <label className="cc-foam-full">Target garment panel<select value={pad.panel} onChange={e=>editNativeFoamPad(pad.id,{panel:e.target.value})}>{(s?.template?.panels||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
       {[
        ['x','Position X','cm',-150,150,.5],['y','Position Y','cm',-150,150,.5],
        ['widthCm','Width','cm',.5,120,.5],['heightCm','Height','cm',.5,120,.5],
        ['depthCm','Foam height','cm',.05,8,.1],['edgeWidthCm','Edge softness','cm',.025,8,.1],
        ['rotationDeg','Rotation','°',-180,180,1],
       ].map(([field,label,unit,min,max,step])=><label key={field}>{label}<span className="cc-foam-number"><input aria-label={`${label} (${unit})`} type="number" value={pad[field]??0} min={min} max={max} step={step} disabled={Boolean(pad.locked)&&['x','y','widthCm','heightCm','rotationDeg'].includes(field)} onChange={e=>{const v=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(v))editNativeFoamPad(pad.id,{[field]:Math.max(min,Math.min(max,v))})}}/><small>{unit}</small></span></label>)}
       <label className="cc-foam-full">Fabric construction<select value={pad.mode||'sandwich'} onChange={e=>editNativeFoamPad(pad.id,{mode:e.target.value})}><option value="sandwich">Outer fabric / foam / backing</option><option value="underlay">Foam beneath shell</option></select></label>
      </div>
      <div className="cc-foam-switches"><label><input type="checkbox" checked={Boolean(pad.sewn)} onChange={e=>editNativeFoamPad(pad.id,{sewn:e.target.checked})}/><span><strong>Stitch perimeter guide</strong><small>Visual placement reference only</small></span></label><label><input type="checkbox" checked={Boolean(pad.locked)} onChange={e=>editNativeFoamPad(pad.id,{locked:e.target.checked})}/><span><strong>Lock placement</strong><small>Prevent dragging on the 2D pattern</small></span></label></div>
      <div className="cc-foam-actions"><button type="button" className="cc-foam-properties" onClick={()=>{setSelectedFoamId(pad.id);if(embedded){setFoamOpen(false);window.dispatchEvent(new CustomEvent('exo-clothcraft-foam-selection',{detail:{pad,projectKey:foamProjectKey}}))}}}><SlidersHorizontal size={15}/> Material properties</button><button type="button" className="cc-foam-remove" onClick={()=>{commitFoamPads(nativeFoamPads.filter(p=>p.id!==pad.id));if(selectedFoamId===pad.id)setSelectedFoamId(null)}} aria-label={`Remove ${pad.name||'foam shape'}`} title="Remove shape"><Trash2 size={16}/></button></div>
     </div>)}
     {!embedded&&nativeFoamPads.find(pad=>pad.id===selectedFoamId)&&<FoamMaterialPropertyEditor pad={nativeFoamPads.find(pad=>pad.id===selectedFoamId)} onChange={material=>editNativeFoamPad(selectedFoamId,{material})} onClose={()=>setSelectedFoamId(null)}/>}
     <div className="cc-foam-footnote"><span className="cc-foam-footnote-icon">i</span><span>These are locally saved construction previews. Real foam contact physics and automatic multilayer sewing are not yet supported by the Rust solver.</span></div>
    </section>
   </CloFloatingPanel>}
   {graphicHost&&createPortal(<ClothCraftGraphicEditor graphics={nativeGraphics} onChange={updateNativeGraphics} panels={(s?.template?.panels||[]).map(p=>({...p,printBoundsMm:nativeGraphicPanelBounds(p.id)}))} panelId={selected?.panel||s?.template?.panels?.find(p=>/front/i.test(p.name+' '+p.id))?.id||s?.template?.panels?.[0]?.id} selectedGraphicId={selectedGraphicId} onSelectGraphic={setSelectedGraphicId} showLayerList={false} disabled={busy||playing}/>,graphicHost)}
   <div ref={cameraViewport} className="cc-embedded-main">
    <CameraFabricHand viewportRef={cameraViewport} onActivate={()=>changeViewportMode('stretch3d')} disabled={busy&&!playing||!s?.template?.panels?.length}/>
    <section className="cc-view cc-viewport-3d" aria-label="ClothCraft 3D garment viewport" style={{position:'relative'}}><ClothCraftSceneV2 foamPads={nativeFoamPads} onFoamSelect={id=>{setSelectedFoamId(id);if(!embedded)setFoamOpen(true)}} importedHardware={sceneImportedHardware} graphics={nativeGraphics} analysisMode={analysisMode} snapshot={s} active={hovered||selected} selected={selected} mode={mode==='stretch3d'?'stretch3d':playing||busy?'edit':mode} seamEditing={seamEditing} onContextMenuRequest={event=>openViewportContext({...event,dimension:'3d'})} onCanvasActivate={()=>{shortcutsFocused.current=true}} onChangeMode={changeViewportMode} toolsDisabled={busy&&!playing} onPick={pickInSewingMode} onHover={setHovered} onPlace={placeVisiblePanel} showAvatar={showAvatar} showSeams={showSeams} sewingToolsActive={mode==='sew'||seamEditing} wireframe={wireframe} showBoundingBox={showBoundingBox} showContactDots={showContactDots} onStretchStart={startClothGrab} onStretchCancel={cancelClothGrab} onStretchDrag={pullClothPoint} environmentPreset={environmentPreset} stageId={stageId} stageSettings={stageSettings} cameraSettings={cameraSettings} sceneLight={sceneLight} sceneLight2={sceneLight2} exposure={exposure} studioAppearance={studioAppearance} studioPreferences={studioPreferences}/></section>
   <section className="cc-view cc-viewport-2d" aria-label="ClothCraft 2D pattern viewport">{s&&<ClothCraftBoardV2 showGrid={workspaceGrid} showMeasurements={showMeasurements} showSilhouette={showSilhouette} showAvatar={showAvatar} showSeamDots={showContactDots} walkSeamId={walkOpen?walkSeamId:null} walkFraction={walkFraction} onAvatarPick={()=>{pick({avatar:true});activateSection('Avatar')}} graphics={nativeGraphics} foamPads={nativeFoamPads} onMoveFoamPad={editNativeFoamPad} sewingVariant={sewingVariant} editSewing={seamEditing} onSelectSewingSeam={selectExistingSewingSeam} sewingFirstEdge={pair[0]||null} sewingCommitting={segmentCommitting} onSegmentSewEdge={selectSegmentEdge} freeSewPoints={freeSewPoints} onFreeSewPoint={selectFreeSewPoint} onClearFreeSew={clearFreeSew} allowFreeSewEase={ease} onChangeFreeSewEase={setEase} selectedGraphicId={selectedGraphicId} onSelectGraphic={selectGraphicOnBoard} onMoveGraphic={moveGraphicOnBoard} showGraphicMeasurements={showGraphicMeasurements} showGraphicMeasurementToggle={false} s={s} selection={selected} active={hovered||selected} pick={pick} hover={setHovered} edit={edit} onEnableCurveSeamEase={enableCurveSeamEase} mode={mode} onChangeMode={changeViewportMode} onContextMenuRequest={openViewportContext} busy={busy||playing} onPolygon={(points,tangents)=>{if(mode==='line'){if(!selectedPanel){setDrawingError('Select a pattern before drawing an internal line.');return}const r=s.panels.find(p=>p.id===selectedPanel.id),a=-(selectedPanel.layout_rotation_degrees||0)*Math.PI/180;const local=points.map(p=>{const u=p[0]-r.layout[0],v=p[1]-r.layout[1];return[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)]});edit({kind:'InternalLine',panel:selectedPanel.id,points:local,tangents:local.map(()=>[0,0])})}else edit({kind:'Polygon',points,tangents:Array.isArray(tangents)&&tangents.length===points.length?tangents:points.map(()=>[0,0]),fabric:s.template.fabrics[0].id})}}/>}<NativePatternAuditPanel audit={patternAudit} revision={s?.revision} onClose={()=>setPatternAudit(null)} onRefresh={runPatternAudit} onGenerateCutlines={runProductionCutlines} onDownloadCutline={downloadCutlineProof} cutlines={cutlineProof} disabled={busy}/></section>
   </div>
   <div className="cc-embedded-footer"><button type="button" disabled={busy||!s} onClick={runPatternAudit} aria-label="Run native Rust pattern QA">Pattern QA</button><strong>{busy?'Computing…':playing?'Running Rust simulation':'Rust session ready'}</strong><span>{s?.positions.length??0} vertices · {s?.time?.toFixed(3)??'—'} s · Seam gap {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'} · P95 stretch {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</span><details data-dart-fit-inspector="true" style={{maxWidth:300,fontSize:11}}><summary>3D dart closure · {s?.dartFit?.length||0} seam(s)</summary>{s?.dartFit?.length?s.dartFit.map(dart=><p key={dart.seamId} data-dart-fit-seam={dart.seamId} data-dart-gap-mm={dart.maxGapMm} data-dart-rms-mm={dart.rmsGapMm} data-dart-provisional-closure={String(dart.withinProvisional2mm)}>{dart.seamId}: max {Number(dart.maxGapMm).toFixed(2)} mm · RMS {Number(dart.rmsGapMm).toFixed(2)} mm · {dart.withinProvisional2mm?'within provisional 2 mm':'legs still open'}</p>):<p>Add a cut-and-sewn physical dart to inspect 3D seam separation.</p>}<small>Measured from Rust solver positions; not a folded-dart, fit or collision certification.</small></details><small>Physical fit not certified</small></div>
  </div>
 }
 return <main ref={workspaceRoot} className="cc-workspace cc-exo-shell"><ClothCraftContextMenu context={contextMenu} items={contextItems} onChoose={executeContextAction} onClose={()=>setContextMenu(null)}/><header className="cc-header"><div className="cc-brand"><Box size={18}/><strong>EXO <span>SAMPLE 3D</span></strong><small>× CLOTHCRAFT ENGINE</small></div><div className="cc-exo-menus"><button onClick={()=>setLibraryOpen(v=>!v)} aria-label="Toggle asset library"><FolderOpen size={15}/> LIBRARY</button><button onClick={()=>setInspectorOpen(v=>!v)} aria-label="Toggle property editor"><Settings2 size={15}/> PROPERTIES</button><select aria-label="EXO workspace section" value={section} onChange={e=>activateSection(e.target.value)}>{EXO_SECTIONS.map(([name])=><option key={name}>{name}</option>)}</select><select aria-label="Viewport layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="split">3D + 2D</option><option value="3d">3D focus</option><option value="2d">2D focus</option></select></div><div className="cc-header-actions"><label className="cc-button" title="Open ClothCraft or compatible EXO garment project"><FolderOpen size={14}/> Open project<input type="file" accept=".json" hidden disabled={busy||playing} onChange={importFile}/></label><button onClick={()=>save(false)} disabled={busy||playing||!s} title="Save current Rust garment project"><Save size={15}/> Save</button><button onClick={()=>save(true)} disabled={busy||playing||!s}><Download size={15}/> Save / export</button><a href="?desktop=1" title="Open the full EXO interface">FULL EXO <ChevronRight size={14}/></a></div></header>
 <div className="cc-project-bar"><div><strong>GARMENT STUDIO</strong><span>{s?.template.name||'Loading ClothCraft project…'}</span><small>REV {s?.revision??'—'} · {s?.template.panels.length??0} PANELS · {s?.template.seams.length??0} SEAMS</small></div><div className="cc-project-fittings"><span className="cc-online-dot"/> RUST VBD + OGC <span className="cc-project-status">{playing?'SIMULATING':busy?'WORKING':'READY'}</span></div></div>
 <nav className="cc-toolbar"><div>{[['edit','Select / edit',MousePointer2],['sew','Sew edges',Scissors],['pen','Draw pattern',PenTool],['line','Internal line',Layers],['move3d','Move 3D',Move3D],['rotate3d','Rotate 3D',Rotate3D]].map(([key,label,Icon])=><button key={key} title={label} aria-pressed={mode===key} className={mode===key?'active':''} onClick={()=>{setMode(key);setPair([]);if(key==='sew')setSection('Sewing');else if(key==='line')setSection('Sewing');else if(key==='pen')setSection('Pattern')}}><Icon size={15}/>{label}</button>)}<button type="button" title="Foam Padding / Trapunto" aria-label="Foam Padding / Trapunto" aria-pressed={foamOpen} onClick={()=>{setFoamOpen(v=>!v);setSection('Pattern')}}><Layers size={15}/>Foam Padding / Trapunto</button><button type="button" disabled={busy||!s} onClick={runPatternAudit} aria-label="Run native Rust pattern QA">Pattern QA</button></div><div><button disabled={busy||playing||!s?.canUndo} onClick={()=>request({op:'undo'})}><Undo2 size={15}/>Undo</button><button disabled={busy||playing||!s?.canRedo} onClick={()=>request({op:'redo'})}><Redo2 size={15}/>Redo</button><button disabled={(!playing&&busy)||!s} className="cc-primary" onClick={play}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Pause':'Simulate'}</button><button disabled={busy||playing||!s} onClick={()=>request({op:'step',steps:1})}>Single step</button><button disabled={busy||playing||!s} onClick={()=>void resetPatternPosition()}><RotateCcw size={15}/>Reset arrangement</button></div></nav>
 {(error||notice)&&<div className={error?'cc-error':'cc-notice'} role="status">{error||notice}<button onClick={()=>{setError('');setNotice('')}}>×</button></div>}
 <div className={`cc-body cc-layout-${layout} ${libraryOpen?'':'cc-no-library'} ${inspectorOpen?'':'cc-no-inspector'}`}>
 <nav className="cc-exo-rail" aria-label="EXO tool categories">{EXO_SECTIONS.map(([name,Icon])=><button key={name} className={section===name?'active':''} aria-pressed={section===name} title={name} onClick={()=>activateSection(name)}><Icon size={19}/><span>{name}</span></button>)}</nav>
 {libraryOpen&&<aside className="cc-pieces" aria-label="EXO asset browser"><div className="cc-side-title"><span>ASSET BROWSER</span><FolderOpen size={15}/></div><div className="cc-library-tabs">{['Pieces','Seams','Library','History'].map(tab=><button key={tab} className={tab===libraryTab?'active':''} onClick={()=>setLibraryTab(tab)}>{tab}</button>)}</div><label className="cc-search"><Search size={14}/><input aria-label="Search library items" value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Find ${libraryTab.toLowerCase()}…`}/></label>
 {libraryTab==='Pieces'&&<><h3>GARMENT · {s?.template.panels.length??0} PANELS</h3><p>{s?.template.name||'Connecting…'}</p>{s?.template.panels.filter(p=>filtered(p.name)).map((p,i)=><button data-piece={p.id} key={p.id} className={active?.panel===p.id?'active':''} onMouseEnter={()=>setHovered({panel:p.id})} onMouseLeave={()=>setHovered(null)} onClick={()=>showPiece(p.id)}><i style={{background:COLORS[i%COLORS.length]}}/>{p.name}<ChevronRight size={13}/></button>)}</>}
 {libraryTab==='Seams'&&<><h3>SEWING RELATIONSHIPS · {s?.template.seams.length??0}</h3>{s?.template.seams.filter(item=>filtered(item.id)).map(seam=><div className="cc-seam-row" key={seam.id} onMouseEnter={()=>setHovered({panel:seam.a.panel,edge:seam.a.edge})} onMouseLeave={()=>setHovered(null)}><button onClick={()=>{setSelected({panel:seam.a.panel,edge:seam.a.edge,kind:'sewing',seamId:seam.id});activateSection('Sewing')}}>{seam.id}</button><button aria-label={`Delete seam ${seam.id}`} disabled={busy||playing} onClick={()=>edit({kind:'RemoveSeam',seam:seam.id})}>×</button></div>)}</>}
 {libraryTab==='Library'&&<><h3>STARTING BLOCKS</h3>{[['T-shirt','tshirt'],['Dress','dress']].filter(([name])=>filtered(name)).map(([name,preset])=><button key={preset} disabled={busy||playing} onClick={()=>openPreset(preset)}><Shirt size={15}/>{name} fixture</button>)}<h3>NEW PATTERN ELEMENTS</h3><button onClick={()=>{activateSection('Pattern');setShape('rectangle')}}><FilePlus2 size={14}/> Rectangle</button><button onClick={()=>{activateSection('Pattern');setShape('ellipse')}}><FilePlus2 size={14}/> Ellipse</button><button onClick={()=>{activateSection('Pattern');setMode('pen')}}><PenTool size={14}/> Draw custom outline</button></>}
 {libraryTab==='History'&&<><h3>SESSION HISTORY</h3><p>Revision {s?.revision??0}</p><button disabled={!s?.canUndo||busy||playing} onClick={()=>request({op:'undo'})}><Undo2 size={15}/> Undo last edit</button><button disabled={!s?.canRedo||busy||playing} onClick={()=>request({op:'redo'})}><Redo2 size={15}/> Redo last edit</button><p>The Rust editing history supports undo/redo; save a project for persistent revisions.</p></>}
 <footer>EXO asset workspace · ClothCraft physics<br/>Unsupported EXO-specific production features remain in Full EXO</footer></aside>}
 <section className="cc-view cc-viewport-3d" style={{position:'relative'}}><h2><span><Box size={14}/> 3D GARMENT</span><small>ClothCraft linked viewport · Orbit / select</small></h2><ClothCraftSceneV2 foamPads={nativeFoamPads} onFoamSelect={id=>{setSelectedFoamId(id);if(!embedded)setFoamOpen(true)}} importedHardware={sceneImportedHardware} analysisMode={analysisMode} snapshot={s} active={active} selected={selected} mode={mode==='stretch3d'?'stretch3d':playing||busy?'edit':mode} seamEditing={seamEditing} onContextMenuRequest={event=>openViewportContext({...event,dimension:'3d'})} onCanvasActivate={()=>{shortcutsFocused.current=true}} onChangeMode={changeViewportMode} toolsDisabled={busy&&!playing} onPick={pickInSewingMode} onHover={setHovered} onPlace={placeVisiblePanel} showAvatar={showAvatar} showSeams={showSeams} wireframe={wireframe} showBoundingBox={showBoundingBox} showContactDots={showContactDots} onStretchStart={startClothGrab} onStretchCancel={cancelClothGrab} onStretchDrag={pullClothPoint} environmentPreset={environmentPreset} stageId={stageId} stageSettings={stageSettings} cameraSettings={cameraSettings} sceneLight={sceneLight} sceneLight2={sceneLight2} exposure={exposure} studioAppearance={studioAppearance} studioPreferences={studioPreferences}/></section><section className="cc-view cc-viewport-2d"><h2><span><Grid2X2 size={14}/> 2D PATTERN</span><small>True material geometry · metres</small></h2>{s&&<ClothCraftBoardV2 showGrid={workspaceGrid} showMeasurements={showMeasurements} showSilhouette={showSilhouette} showAvatar={showAvatar} showSeamDots={showContactDots} walkSeamId={walkOpen?walkSeamId:null} walkFraction={walkFraction} onAvatarPick={()=>{pick({avatar:true});activateSection('Avatar')}} graphics={nativeGraphics} foamPads={nativeFoamPads} onMoveFoamPad={editNativeFoamPad} sewingVariant={sewingVariant} editSewing={seamEditing} onSelectSewingSeam={selectExistingSewingSeam} sewingFirstEdge={pair[0]||null} sewingCommitting={segmentCommitting} onSegmentSewEdge={selectSegmentEdge} freeSewPoints={freeSewPoints} onFreeSewPoint={selectFreeSewPoint} onClearFreeSew={clearFreeSew} allowFreeSewEase={ease} onChangeFreeSewEase={setEase} selectedGraphicId={selectedGraphicId} onSelectGraphic={selectGraphicOnBoard} onMoveGraphic={moveGraphicOnBoard} showGraphicMeasurements={showGraphicMeasurements} onToggleGraphicMeasurements={toggleGraphicMeasurements} s={s} selection={selected} active={active} pick={pick} hover={setHovered} edit={edit} onEnableCurveSeamEase={enableCurveSeamEase} mode={mode} onChangeMode={changeViewportMode} onContextMenuRequest={openViewportContext} busy={busy||playing} onPolygon={(points,tangents)=>{if(mode==='line'){if(!selectedPanel){setDrawingError('Select a pattern before drawing an internal line.');return}const r=s.panels.find(p=>p.id===selectedPanel.id),a=-(selectedPanel.layout_rotation_degrees||0)*Math.PI/180;const local=points.map(p=>{const u=p[0]-r.layout[0],v=p[1]-r.layout[1];return[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)]});edit({kind:'InternalLine',panel:selectedPanel.id,points:local,tangents:local.map(()=>[0,0])})}else edit({kind:'Polygon',points,tangents:Array.isArray(tangents)&&tangents.length===points.length?tangents:points.map(()=>[0,0]),fabric:s.template.fabrics[0].id})}}/>}<NativePatternAuditPanel audit={patternAudit} revision={s?.revision} onClose={()=>setPatternAudit(null)} onRefresh={runPatternAudit} onGenerateCutlines={runProductionCutlines} onDownloadCutline={downloadCutlineProof} cutlines={cutlineProof} disabled={busy}/></section>
 {inspectorOpen&&<aside className="cc-inspector" aria-label="EXO property editor"><div className="cc-inspector-heading"><span>PROPERTY EDITOR</span><strong>{section.toUpperCase()}</strong></div><div className="cc-inspector-context"><small>{selectedPanel?'ACTIVE PATTERN':'NO PATTERN SELECTED'}</small><strong>{selectedPanel?.name||'Project settings'}</strong>{selected?.edge&&<span>Edge: {selected.edge}</span>}</div>
 {section==='Pattern'&&<><p className="cc-section-intro">Author material-space patterns with ClothCraft's original 2D and 3D editors.</p><button type="button" onClick={()=>setFoamOpen(true)}>Foam Padding / Trapunto · {nativeFoamPads.length} draft shape(s)</button></>}
 {section==='Sewing'&&<p className="cc-section-intro">Select two boundaries in either viewport, inspect their correspondence, then sew using Rust's native authoring engine.</p>}
 {section==='Fabric'&&<p className="cc-section-intro">Edit the selected panel's actual physical material values in the ClothCraft solver.</p>}
 {section==='Avatar'&&<><fieldset><legend>AVATAR · COLLISION BODY</legend><p>Current body: {s?.avatarModel==='clo-thomas'?'CLO Thomas':'MakeHuman'} fitted collision mesh. Its triangles feed Rust VBD + OGC contact.</p><label><span>Show avatar</span><input type="checkbox" checked={showAvatar} onChange={e=>setShowAvatar(e.target.checked)}/></label><small>Select MakeHuman or CLO Thomas in the EXO avatar library to load its corresponding native collision body. This resets the simulation pose while preserving garment patterns.</small></fieldset><fieldset><legend>BODY MESH DIAGNOSTICS</legend><p>{s?.avatar?.positions.length??'—'} vertices · {s?.avatar?.triangles.length??'—'} triangles</p></fieldset></>}
 {section==='Fit'&&<><fieldset><legend>RUST SIMULATION</legend><p>{s?.backend||'Connecting Rust solver…'}</p><button disabled={busy||!s} onClick={play}>{playing?'Pause simulation':'Simulate garment'}</button><button disabled={busy||playing||!s} onClick={()=>request({op:'step',steps:1})}>Single step</button><button disabled={busy||playing||!s} onClick={()=>void resetPatternPosition()}>Reset arrangement</button></fieldset><fieldset><legend>LIVE CONTACT / FIT</legend><p>Physics time: {s?.time?.toFixed(3)??'—'} s</p><p>Worst seam gap: {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'}</p><p>Stretch p95: {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</p><p>Active contacts: {s?.metrics?.contacts??'—'}</p><p className="cc-warning">Collision and garment fit are experimental. These numbers do not certify a production-ready fit.</p></fieldset><fieldset data-dart-fit-inspector="true"><legend>CUT-AND-SEWN DART · 3D SEAM CLOSURE</legend>{s?.dartFit?.length?s.dartFit.map(dart=><div key={dart.seamId} data-dart-fit-seam={dart.seamId} data-dart-gap-mm={dart.maxGapMm} data-dart-rms-mm={dart.rmsGapMm} data-dart-provisional-closure={String(dart.withinProvisional2mm)}><strong>{dart.seamId}</strong><p>Maximum leg separation: {Number(dart.maxGapMm).toFixed(2)} mm</p><p>RMS separation: {Number(dart.rmsGapMm).toFixed(2)} mm</p><p>Leg lengths: {(dart.lengthsMm||[]).map(value=>Number(value).toFixed(1)).join(' / ')} mm</p><small>{dart.withinProvisional2mm?'Within provisional 2 mm geometry check':'Legs remain more than 2 mm apart — continue checking the simulation'}</small></div>):<p>Author a physical cut-and-sewn dart to inspect its individual 3D seam closure.</p>}<p className="cc-warning">These are direct Rust world-space seam measurements. The 2 mm check is provisional, not a certification of stable simulation, self-contact, an uncut folded dart or garment fit.</p></fieldset></>}
 {section==='Production'&&<><fieldset><legend>EXO FILE OUTPUT</legend><button disabled={busy||playing||!s} onClick={()=>save(true)}><Download size={14}/> Export editable fitting project JSON</button><button disabled={!s} onClick={exportClothObj}><Box size={14}/> Export current drape OBJ</button><button disabled={!s} onClick={exportPatternSvg}><Grid2X2 size={14}/> Export pattern reference SVG</button><p>Visual SVG is not a print-to-scale factory pattern. Full EXO has the grading, DXF, tech packs and production handoff tools.</p><a href="?desktop=1" className="cc-go-classic">Open full EXO production workspace <ChevronRight size={13}/></a></fieldset></>}
 {section==='Render'&&<><fieldset><legend>3D DISPLAY</legend><label>Avatar body<input type="checkbox" checked={showAvatar} onChange={e=>setShowAvatar(e.target.checked)}/></label><label>Seam correspondences<input type="checkbox" checked={showSeams} onChange={e=>setShowSeams(e.target.checked)}/></label><label>Cloth wireframe<input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/></label></fieldset><fieldset><legend>VIEWPORT LAYOUT</legend><select aria-label="Render viewport layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="split">Side by side</option><option value="3d">3D focus</option><option value="2d">2D focus</option></select><p>Studio lighting and material rendering in Full EXO are separate from ClothCraft's physical material controls.</p></fieldset></>}
 {section==='Sewing'&&<fieldset><legend>Sewing correspondence</legend><p>{pair.map(p=>`${p.panel} / ${p.edge}`).join(' → ')||'Pick two edges in either view'}</p><label><input type="checkbox" checked={reverse} onChange={e=>setReverse(e.target.checked)}/> Reverse second edge</label><label><input type="checkbox" checked={ease} onChange={e=>setEase(e.target.checked)}/> Allow easing / unequal lengths</label>{ranges.map((range,i)=><label key={i}>Edge {'AB'[i]} interval{range.map((n,j)=><input key={j} aria-label={`Edge ${'AB'[i]} ${j?'end':'start'}`} type="number" min="0" max="1" step=".05" value={n} onChange={e=>setRanges(v=>v.map((r,k)=>k===i?r.map((n,l)=>l===j?Number(e.target.value):n):r))}/>)}</label>)}<button disabled={busy||pair.length!==2} onClick={async()=>{const r=await edit({kind:'Sew',a:boundary(pair[0],0),b:boundary(pair[1],1),reverse,ease});if(r)setPair([])}}>Create seam</button><button onClick={()=>setPair([])}>Cancel</button></fieldset>}
 {section==='Pattern'&&<fieldset><legend>Add pattern</legend><select value={shape} onChange={e=>setShape(e.target.value)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="sector">Arc sector</option></select>{size.map((n,i)=><label key={i}>{i?'Height':'Width'} (mm)<input type="number" value={n} min="5" max="10000" onChange={e=>setSize(v=>v.map((n,k)=>k===i?Number(e.target.value):n))}/></label>)}<button disabled={busy||!s} onClick={()=>edit({kind:'Primitive',shape,size:size.map(n=>n/1000),origin:[0,0],fabric:s.template.fabrics[0].id})}>Create piece</button></fieldset>}
 {selectedPanel&&['Pattern','Fabric'].includes(section)&&<>{section==='Pattern'&&<><fieldset><legend>Pattern operations</legend><button disabled={busy||playing} onClick={()=>edit({kind:'Duplicate',panel:selectedPanel.id})}>Duplicate</button>{['x','y'].map(axis=><button key={axis} disabled={busy||playing} onClick={()=>edit({kind:'Mirror',panel:selectedPanel.id,axis,copy_side:1})}>Mirror {axis.toUpperCase()}</button>)}<button disabled={busy||playing} onClick={()=>{if(confirm('Remove this panel and its sewing relationships?'))edit({kind:'RemovePanel',panel:selectedPanel.id})}}>Remove piece</button></fieldset><fieldset><legend>3D arrangement</legend>{['translation','rotation_degrees'].map(key=><div key={key}><small>{key==='translation'?'Position (m)':'Rotation (°)'}</small>{selectedPanel.placement[key].map((n,i)=><label key={`${selectedPanel.id}-${key}-${i}-${n}`}>{'XYZ'[i]}<input type="number" step={key==='translation'?'.01':'5'} defaultValue={n} disabled={busy||playing} onBlur={e=>edit({kind:'Place',panel:selectedPanel.id,placement:{...selectedPanel.placement,[key]:selectedPanel.placement[key].map((n,j)=>i===j?Number(e.target.value):n)}})}/></label>)}</div>)}</fieldset></>}{section==='Fabric'&&<ClothCraftFabricLibrary snapshot={s} panel={selectedPanel} busy={busy||playing} onEdit={edit}/>}</>}
 {section==='Pattern'&&selectedPanel?.polygon&&<fieldset><legend>Points and curves</legend><select aria-label="Pattern point" value={selected?.anchor??0} onChange={e=>setSelected({panel:selectedPanel.id,anchor:Number(e.target.value)})}>{selectedPanel.polygon.points.map((_,i)=><option key={i} value={i}>Point {i+1}</option>)}</select>{selectedPanel.polygon.points[selected?.anchor??0]?.map((n,i)=><label key={`${selectedPanel.id}-${selected?.anchor}-${i}-${n}`}>{i?'Y':'X'} (mm)<input type="number" defaultValue={n*1000} disabled={busy||playing} onBlur={e=>{const anchor=selected?.anchor??0,position=[...selectedPanel.polygon.points[anchor]];position[i]=Number(e.target.value)/1000;edit({kind:'Anchor',panel:selectedPanel.id,anchor,position})}}/></label>)}<button disabled={busy||playing} onClick={()=>edit({kind:'CurvePoint',panel:selectedPanel.id,anchor:selected?.anchor??0,curved:true})}>Curve point</button><button disabled={busy||playing} onClick={()=>edit({kind:'CurvePoint',panel:selectedPanel.id,anchor:selected?.anchor??0,curved:false})}>Straighten point</button><button disabled={busy||playing} onClick={()=>edit({kind:'RemovePoint',panel:selectedPanel.id,point:selected?.anchor??0})}>Remove point</button></fieldset>}
 {section==='Sewing'&&selected?.edge&&<fieldset><legend>Boundary length</legend><label>Length (mm)<input type="number" min="1" value={edgeLength} onChange={e=>setEdgeLength(Number(e.target.value))}/></label><button disabled={busy||playing} onClick={()=>edit({kind:'TargetLength',panel:selected.panel,edge:selected.edge,target_m:edgeLength/1000})}>Set target length</button><button disabled={busy||playing} onClick={()=>edit({kind:'SplitBoundary',panel:selected.panel,edge:selected.edge,at_m:edgeLength/1000})}>Split at distance</button></fieldset>}
 {section==='Pattern'&&selectedPanel&&<fieldset><legend>Combine patterns / cut holes</legend><select aria-label="Boolean tool panel" value={toolPanel} onChange={e=>setToolPanel(e.target.value)}><option value="">Choose second panel</option>{s.template.panels.filter(p=>p.id!==selectedPanel.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{['union','difference','intersection'].map(operation=><button key={operation} disabled={busy||!toolPanel} onClick={()=>edit({kind:'Boolean',a:selectedPanel.id,b:toolPanel,operation,keep_tool:true})}>{operation==='union'?'Join':operation==='difference'?'Subtract / hole':'Intersection'}</button>)}</fieldset>}
 {section==='Sewing'&&selectedPanel?.polygon?.lines?.length>0&&<fieldset><legend>Internal sewing / ruffle</legend><select value={lineId||selectedPanel.polygon.lines[0].id} onChange={e=>setLineId(e.target.value)}>{selectedPanel.polygon.lines.map(l=><option key={l.id} value={l.id}>{l.id}</option>)}</select><label>Width (mm)<input type="number" value={ruffleWidth} onChange={e=>setRuffleWidth(Number(e.target.value))}/></label><label>Gather ratio<input type="number" step=".1" value={ruffleRatio} onChange={e=>setRuffleRatio(Number(e.target.value))}/></label><button disabled={busy||playing} onClick={()=>edit({kind:'Ruffle',panel:selectedPanel.id,line:lineId||selectedPanel.polygon.lines[0].id,width:ruffleWidth/1000,ratio:ruffleRatio})}>Create and sew ruffle</button><button disabled={busy||playing} onClick={()=>edit({kind:'RemoveLine',panel:selectedPanel.id,line:lineId||selectedPanel.polygon.lines[0].id})}>Remove internal line</button></fieldset>}
 </aside>}</div><footer className="cc-status"><span>{busy?'Computing…':playing?'Simulating':'Ready'} · {s?.backend||'Connecting to native workspace'}</span><span>{s?.positions.length||0} vertices · {s?.time?.toFixed(3)||'0'} s · Seam gap {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'} · P95 stretch {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</span><small>{s?.metrics?.max_seam_gap_m>.015&&s?.time>4?'Seams remain open — adjust arrangement':'Normal contact · no friction · fit not certified'}</small></footer></main>
}

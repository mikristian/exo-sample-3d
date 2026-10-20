import {vertexExtensions} from '../core/clothcraftStrainView.js'
import {createFabricFaceMaterials,createFabricEdgeRibbon} from '../core/clothcraftFabricSurface.js'
import {attachGarmentGraphics} from '../core/nativeGarmentGraphics.js'
import {createNativeImportedHardwareOverlay,nativeHardwareAnchor} from './ClothCraftImportedHardwareOverlay.jsx'
import React, {useEffect, useRef, useState} from 'react'
import ClothCraftCornerTools from './ClothCraftCornerTools.jsx'
import * as THREE from 'three'
import {createStageEnvironment, applyStageSettings} from '../core/createStageEnvironment.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'
import {paintStudioGradient} from './studioGradientBackdrop.js'
import {applySceneCameraViewport} from '../core/sceneCameraViewport.js'
import {cursorForTool} from '../core/toolCursors.js'
import {preDrapeDisplayPositions} from '../core/nativePreDrapeCurvature.js'
import {createSceneMeshes} from './FoamPaddingNativeOverlay.jsx'
import {normalizeFoamMaterial, stepFoamCompressionState, foamPressFalloff} from '../core/foamCompressionModel.js'
import {avatarSurfaceConstructionCurves} from './avatarConstructionGuides.js'

const COLORS = ['#638da2', '#d49b70', '#8caf87', '#b69bc7', '#ceb96d', '#82b7b1']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
const setMarkerDiagnostics = (canvas, counts, visible) => {
  if (!canvas) return
  const total = counts.reduce((sum, count) => sum + count, 0)
  canvas.dataset.seamMarkerCount = String(total)
  canvas.dataset.seamMarkerVisibleCount = String(visible ? total : 0)
  canvas.dataset.seamMarkerColors = JSON.stringify(SEAM_COLORS.filter((_, index) => counts[index] > 0))
  canvas.dataset.seamMarkerPalette = JSON.stringify(SEAM_COLORS)
}
const degrees = values => values.map(value => THREE.MathUtils.degToRad(Number(value) || 0))
const finiteVec = values => Array.isArray(values) && values.length >= 3 && values.slice(0, 3).every(Number.isFinite)
const v3 = values => new THREE.Vector3(...values)
const disposeTree = object => {
  object.traverse(child => {
    child.geometry?.dispose()
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : []
    for (const material of materials) {material.userData?.ownedTexture?.dispose(); material.dispose()}
  })
}
const replaceChildren = group => {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeTree(child)
  }
}
const weighted = (entries, points) => {
  const out = new THREE.Vector3()
  for (const entry of entries || []) {
    if (!Array.isArray(entry)) continue
    const [index, weight] = entry
    if (finiteVec(points?.[index]) && Number.isFinite(weight)) out.addScaledVector(v3(points[index]), weight)
  }
  return out
}
const material = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, side: THREE.DoubleSide, roughness: .82, metalness: .025, ...options,
})
const buildIndexedMesh = (positions, triangles, color, uv = null) => {
  // Native snapshots may contain uninitialized or collapsed solver triangles.
  // They cannot contribute visible cloth and poison normal calculations.
  const validTriangles = (Array.isArray(triangles) ? triangles : []).filter(tri => {
    if (!Array.isArray(tri) || tri.length !== 3 || !tri.every(i => Number.isInteger(i) && finiteVec(positions?.[i]))) return false
    if (new Set(tri).size !== 3) return false
    const a = v3(positions[tri[0]]), b = v3(positions[tri[1]]), c = v3(positions[tri[2]])
    return b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18
  })
  const indices = [...new Set(validTriangles.flat())]
  const remap = new Map(indices.map((value, index) => [value, index]))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(indices.flatMap(index => positions[index]), 3))
  if (uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(indices.flatMap(index =>
    Array.isArray(uv[index]) && uv[index].length >= 2 && uv[index].slice(0, 2).every(Number.isFinite)
      ? uv[index].slice(0, 2) : [0, 0]), 2))
  geometry.userData.nativeVertices=indices
  geometry.setIndex(validTriangles.flatMap(tri => tri.map(index => remap.get(index))))
  if (validTriangles.length) geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return new THREE.Mesh(geometry, material(color))
}
const line = (a, b, color, opacity = 1) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({color, transparent: opacity < 1, opacity, depthTest: true}))
}
// Project an authored material-space construction point back onto the current
// Rust cloth triangles. The template's internal lines are not world-space
// sketches: this keeps saved marks attached to the moving cloth geometry.
const worldPointAtMaterialUv=(triangles,uv,positions,point,offset)=>{
  for(const [ia,ib,ic] of triangles){
    const a=uv?.[ia],b=uv?.[ib],c=uv?.[ic]
    if(![a,b,c].every(v=>Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(Number.isFinite)))continue
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if(Math.abs(den)<1e-12)continue
    const wa=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den
    const wb=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den
    const wc=1-wa-wb
    if(Math.min(wa,wb,wc)<-1e-5||Math.max(wa,wb,wc)>1.00001)continue
    if(![ia,ib,ic].every(i=>finiteVec(positions?.[i])))continue
    return v3(positions[ia]).multiplyScalar(wa)
      .addScaledVector(v3(positions[ib]),wb)
      .addScaledVector(v3(positions[ic]),wc)
      .add(offset)
  }
  return null
}

/**
 * ClothCraft Rust snapshot visualizer. Positions and triangle indices are Rust-world coordinates (metres).
 * onPlace({kind:'Place', panel, placement:{translation:[x,y,z],rotation_degrees:[x,y,z]}})
 * onStretchDrag is optional and receives {panel,delta:[x,y,z],point:[x,y,z],origin:[x,y,z]}.
 * A Place edit requests a solver reinitialization through the host; this view cannot guarantee
 * that moved simulated vertices remain at their visualized positions after the new snapshot.
 */
export default function ClothCraftSceneV2({
  snapshot, active, selected, mode = 'edit', seamEditing=false, onPick, onHover, onPlace,
  graphics = [], importedHardware = [], foamPads = [],
  onChangeMode = () => {}, toolsDisabled = false,
  showAvatar = true, showSeams = true, sewingToolsActive = false, wireframe = false, analysisMode = 'surface',
  showBoundingBox = false, showContactDots = true, spread = 0,
  onStretchDrag, onStretchStart, onStretchCancel, environmentPreset = 'studio', stageId = 'none', showFloor = true,
  cameraSettings = null, sceneLight = null, sceneLight2 = null, exposure = 1.1, studioAppearance = null, studioPreferences = null, stageSettings = null,
  onContextMenuRequest, onCanvasActivate, onFoamSelect,
}) {
  const host = useRef(null)
  const sceneRef = useRef(null)
  const hardwareRecordsRef = useRef(new Map())
  const hardwareSnapshotRef = useRef(snapshot)
  hardwareSnapshotRef.current = snapshot
  const [grabRefresh, setGrabRefresh] = useState(0)
  const [showConstructionGuides, setShowConstructionGuides] = useState(false)
  const propsRef = useRef({})
  propsRef.current = {snapshot, active, selected, mode, seamEditing, onPick, onHover, onPlace, showAvatar,
    showSeams, sewingToolsActive, wireframe, showBoundingBox, showContactDots, spread, onStretchDrag, onStretchStart, onStretchCancel, environmentPreset, stageId, showFloor,
    onContextMenuRequest, onCanvasActivate, onFoamSelect}

  useEffect(() => {
    const hostNode = host.current
    if (!hostNode) return
    const scene = new THREE.Scene()
    // The original EXO GarmentViewport daylight backdrop and fog are part of
    // the studio, independent of the Rust geometry displayed in this scene.
    const backdropCanvas = document.createElement('canvas')
    backdropCanvas.width = 8
    backdropCanvas.height = 512
    const studioBackdrop = new THREE.CanvasTexture(backdropCanvas)
    studioBackdrop.colorSpace = THREE.SRGBColorSpace
    paintStudioGradient(studioBackdrop)
    scene.background = studioBackdrop
    scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    const camera = new THREE.PerspectiveCamera(34, 1, .005, 150)
    camera.position.set(2.4, 1.65, 3.1)
    const renderer = new THREE.WebGLRenderer({antialias: studioPreferences?.antialias!==false, alpha: false})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    hostNode.appendChild(renderer.domElement)
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const roomEnvironment = new RoomEnvironment()
    const studioEnvironment = pmremGenerator.fromScene(roomEnvironment, .04).texture
    roomEnvironment.dispose()
    scene.environment = studioEnvironment

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.95, 0)
    controls.enableDamping = true
    controls.dampingFactor = .07
    controls.zoomToCursor = true
    controls.minDistance = .15
    controls.maxDistance = 15
    const ambient = new THREE.HemisphereLight(0xffffff, 0xb7b7bc, 1.85)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xfffcf8, 2.6)
    key.position.set(2.5, 4.5, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xe2ecff, .85)
    fill.position.set(-3, 2, -2.5)
    scene.add(fill)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), material('#ebebed', {roughness:.94,metalness:0}))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -.005
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(5.5, 22, 0xaeb0b4, 0xdddddf)
    grid.position.y = .002
    scene.add(grid)
    const axes = new THREE.Group()
    axes.add(line(new THREE.Vector3(0,.013,-2.75),new THREE.Vector3(0,.013,2.75),'#8b8c91',.52))
    grid.add(axes)
    // Subtle studio centerline from floor to above the mannequin. The regular
    // 6-metre metric floor grid and orientation axes remain intact.
    const centerGuide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.12, 0)]),
      new THREE.LineDashedMaterial({color:'#729bb0',dashSize:.08,gapSize:.045,transparent:true,opacity:.46,depthTest:true}),
    )
    centerGuide.computeLineDistances()
    grid.add(centerGuide)
    const cloth = new THREE.Group()
    const avatar = new THREE.Group()
    const boundaries = new THREE.Group()
    const seams = new THREE.Group()
    const dots = new THREE.Group()
    const boxes = new THREE.Group()
    const brushMarks = new THREE.Group()
    const tapeMarks = new THREE.Group()
    const internalLineMarks = new THREE.Group()
    const authoredLines = new THREE.Group()
    const foamPaddingGroup = new THREE.Group()
    foamPaddingGroup.name = 'exo-native-foam-padding-preview'
    scene.add(cloth, avatar, boundaries, seams, dots, boxes, brushMarks, tapeMarks, internalLineMarks, authoredLines, foamPaddingGroup)

    const pivot = new THREE.Object3D()
    scene.add(pivot)
    const transform = new TransformControls(camera, renderer.domElement)
    scene.add(transform.getHelper())
    transform.setSize(.65)
    transform.setSpace('world')
    transform.setMode('translate')
    const rings = new THREE.Group()
    scene.add(rings)
    const pickRings = []
    for (const [axis,color] of Object.entries({x:0xef6967,y:0x76d38f,z:0x76aaff,free:0xe9f4ff})) {
      const visual = new THREE.Mesh(new THREE.TorusGeometry(1,.014,8,120),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:axis==='free'?.63:.97,depthTest:false,depthWrite:false}))
      const picker = new THREE.Mesh(new THREE.TorusGeometry(1,.065,8,120),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide}))
      picker.userData.rotationAxis=axis
      if(axis==='x'){visual.rotation.y=Math.PI/2;picker.rotation.y=Math.PI/2}
      if(axis==='y'){visual.rotation.x=-Math.PI/2;picker.rotation.x=-Math.PI/2}
      if(axis==='free'){visual.scale.setScalar(1.24);picker.scale.setScalar(1.24)}
      visual.renderOrder=95;picker.renderOrder=96
      rings.add(visual,picker);pickRings.push(picker)
    }
    rings.visible=false
    const ray = new THREE.Raycaster()
    ray.params.Line.threshold = .012
    const pointer = new THREE.Vector2()
    const state = {scene, camera, renderer, controls, cloth, avatar, boundaries, seams, dots, boxes,
      floor, grid, ambient, key, fill, studioBackdrop, brushMarks, tapeMarks,
      pivot, transform, ray, pointer, panelMeshes: new Map(), panelOffsets: new Map(),
      down: null, dragging: false, nativeStart: null, handleStart: null, requestId: null,
      sceneSnapshot: null, rings, ringDrag:null, ringEnabled:false, stretchGrab:null,
      stretchCommitPending:false, pendingGrabSnapshot:false, meshBrushActive:false,
      authoredLines, brushVertices:new Set(), brushDrag:null, tapeMode:null, tapePoints:[], tapeDrag:null,
      internalLineActive:false,internalLinePoints:[],foamPaddingGroup,
      foamPress:null,foamCompression:new Map(),foamMeshes:new Map()}
    sceneRef.current = state
    // Cursor follows the actual active viewport operation. Native pointer
    // handlers occasionally change the cursor while dragging; restore the
    // selected tool artwork as soon as that transient interaction ends.
    const updateToolCursor=()=>{
      const currentMode=propsRef.current.mode
      const tool=state.internalLineActive?'line-3d':state.tapeMode
        ||(currentMode==='edit'&&propsRef.current.seamEditing?'seam-edit':null)
        ||(currentMode==='sew'?'sew':null)
        ||(state.meshBrushActive?'mesh-brush'
          :currentMode==='rotate3d'?'rotate'
          :currentMode==='move3d'||currentMode==='transform'?'move'
          :currentMode==='stretch3d'?'hand':null)
      const cursor=state.stretchGrab||state.brushDrag!==null?'grabbing'
        :(['move3d','rotate3d','transform'].includes(currentMode)&&state.rotationHoverAxis)?cursorForTool('rotate')
        :tool==='hand'?'grab':cursorForTool(tool)||'default'
      renderer.domElement.style.cursor=cursor
      renderer.domElement.dataset.activeToolCursor=tool||'default'
    }
    state.updateToolCursor=updateToolCursor
    updateToolCursor()
    const updateInternalLine=()=>{
      replaceChildren(internalLineMarks)
      const points=state.internalLinePoints
      for(const hit of points){
        const marker=new THREE.Mesh(new THREE.SphereGeometry(.009,12,8),new THREE.MeshBasicMaterial({color:'#56dbff',depthTest:false,depthWrite:false}))
        marker.position.copy(hit.point);marker.renderOrder=111;internalLineMarks.add(marker)
      }
      if(points.length===2){
        const segment=line(points[0].point,points[1].point,'#56dbff')
        segment.material.depthTest=false;segment.material.depthWrite=false;segment.renderOrder=110
        internalLineMarks.add(segment)
      }
      renderer.domElement.dataset.internalLine3dMode=state.internalLineActive?'on':'off'
      renderer.domElement.dataset.internalLine3dPoints=String(points.length)
      renderer.domElement.dataset.internalLine3dPanel=points[0]?.panel||''
    }
    state.clearInternalLine=()=>{state.internalLinePoints=[];updateInternalLine()}
    const activateInternalLine=event=>{
      const next=event.detail?.tool==='line-3d'
      if(next!==state.internalLineActive)state.internalLinePoints=[]
      state.internalLineActive=next
      updateToolCursor()
      updateInternalLine()
    }
    window.addEventListener('exo-clothcraft-3d-tool',activateInternalLine)
    const internalLineHit=event=>{
      const rect=renderer.domElement.getBoundingClientRect()
      if(!rect.width||!rect.height)return null
      pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height)
      ray.setFromCamera(pointer,camera)
      const surface=ray.intersectObjects(cloth.children,false)[0]
      if(!surface?.uv||!surface.face||!surface.object.userData.panel)return null
      const body=avatar.visible?ray.intersectObjects(avatar.children,false)[0]:null
      if(body&&body.distance<surface.distance-1e-5)return null
      // buildIndexedMesh uses snapshot.uv verbatim, in Rust panel material metres.
      // Three interpolates the triangle UV at the precise ray intersection.
      const vertices=surface.object.geometry.userData.nativeVertices
      const indices=[surface.face.a,surface.face.b,surface.face.c].map(i=>vertices?.[i])
      const source=state.sceneSnapshot?.uv
      if(indices.some(i=>!Array.isArray(source?.[i])||source[i].length<2||!source[i].slice(0,2).every(Number.isFinite)))return null
      const uv=surface.uv.toArray()
      if(!uv.every(Number.isFinite))return null
      return {point:surface.point.clone(),panel:surface.object.userData.panel,uv}
    }
    updateInternalLine()
    const tapeHit=event=>{
      const rect=renderer.domElement.getBoundingClientRect()
      if(!rect.width||!rect.height)return null
      pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1)
      ray.setFromCamera(pointer,camera)
      const clothHit=ray.intersectObjects(cloth.children,false)[0]
      const avatarHit=avatar.visible?ray.intersectObjects(avatar.children,false)[0]:null
      if(state.tapeMode?.startsWith('avatar-measure')){
        if(!avatarHit||(clothHit&&clothHit.distance<avatarHit.distance-1e-5))return null
        return {point:avatarHit.point.clone(),panel:'avatar'}
      }
      if(!clothHit||(avatarHit&&avatarHit.distance<clothHit.distance-1e-5))return null
      return {point:clothHit.point.clone(),panel:clothHit.object.userData.panel}
    }
    const updateTape=()=>{
      replaceChildren(tapeMarks)
      const points=state.tapePoints
      if(points.length){
        const pointGeometry=new THREE.SphereGeometry(.009,12,8)
        for(const hit of points){
          const marker=new THREE.Mesh(pointGeometry.clone(),new THREE.MeshBasicMaterial({color:'#ffbd39',depthTest:false}))
          marker.position.copy(hit.point);marker.renderOrder=110;tapeMarks.add(marker)
        }
        pointGeometry.dispose()
      }
      if(points.length===2){
        const geometry=new THREE.BufferGeometry().setFromPoints(points.map(hit=>hit.point))
        const segment=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#ffbd39',depthTest:false,depthWrite:false}))
        segment.renderOrder=109;tapeMarks.add(segment)
      }
      const mm=points.length===2?points[0].point.distanceTo(points[1].point)*1000:null
      const isAvatar=state.tapeMode?.startsWith('avatar-measure')
      renderer.domElement.dataset.garmentMeasurePoints=String(isAvatar?0:points.length)
      renderer.domElement.dataset.garmentMeasureMm=!isAvatar&&mm!==null?mm.toFixed(2):''
      renderer.domElement.dataset.garmentMeasurePanels=JSON.stringify(isAvatar?[]:points.map(hit=>hit.panel))
      renderer.domElement.dataset.avatarMeasurePoints=String(isAvatar?points.length:0)
      renderer.domElement.dataset.avatarMeasureMm=isAvatar&&mm!==null?mm.toFixed(2):''
    }
    state.updateTape=updateTape
    const activateTape=event=>{
      const tool=event.detail?.tool
      const next=['garment-measure','garment-measure-edit','avatar-measure','avatar-measure-edit'].includes(tool)?tool:null
      if(next!==state.tapeMode){
        if(state.tapeDrag!==null&&renderer.domElement.hasPointerCapture(state.tapeDrag))
          renderer.domElement.releasePointerCapture(state.tapeDrag)
        state.tapePoints=[];state.tapeDrag=null;controls.enabled=true
      }
      state.tapeMode=next
      renderer.domElement.dataset.garmentMeasureMode=next?.startsWith('garment-')?next:'off'
      renderer.domElement.dataset.avatarMeasureMode=next?.startsWith('avatar-')?next:'off'
      updateToolCursor()
      updateTape()
    }
    window.addEventListener('exo-clothcraft-3d-tool',activateTape)
    updateTape()
    const updateBrushMarks = () => {
      replaceChildren(brushMarks)
      const points=[]
      for (const mesh of state.panelMeshes.values()) {
        const indices=mesh.geometry.userData.nativeVertices || []
        const position=mesh.geometry.getAttribute('position')
        mesh.updateWorldMatrix(true,false)
        for(let i=0;i<indices.length;i++)if(state.brushVertices.has(indices[i]))
          points.push(...new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).toArray())
      }
      if(points.length){
        const geometry=new THREE.BufferGeometry()
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3))
        brushMarks.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffcb41',size:9,sizeAttenuation:false,depthTest:false,depthWrite:false})))
      }
      renderer.domElement.dataset.meshBrushSelectedCount=String(state.brushVertices.size)
      renderer.domElement.dataset.meshBrushHighlightedCount=String(points.length/3)
      renderer.domElement.dataset.meshBrushSelectedIndices=JSON.stringify([...state.brushVertices].sort((a,b)=>a-b))
    }
    state.updateBrushMarks=updateBrushMarks
    const applyBrush = event => {
      const rect=renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1)
      ray.setFromCamera(pointer,camera)
      const contact=ray.intersectObjects(cloth.children,false)[0]
      if(!contact)return
      const point=contact.point
      const paintedMesh=contact.object
      // A brush stroke belongs to the visible, ray-hit panel. Nearby panels
      // may overlap in 3D but must never receive this stroke by proximity.
      const avatarHit=ray.intersectObjects(avatar.children,false)[0]
      if(avatar.visible && avatarHit && avatarHit.distance < contact.distance-1e-5)return
      // Fixed pixel brush size translates into metres at the hit depth, so zoom
      // changes its world-space radius rather than making it unusably tiny.
      const distance=camera.position.distanceTo(point)
      const radius=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*22/Math.max(1,rect.height)
      const removing=event.altKey
      for(const mesh of [paintedMesh]){
        const attr=mesh.geometry.getAttribute('position')
        const native=mesh.geometry.userData.nativeVertices||[]
        mesh.updateWorldMatrix(true,false)
        for(let i=0;i<native.length;i++){
          const position=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld)
          if(position.distanceTo(point)<=radius){
            if(removing)state.brushVertices.delete(native[i])
            else state.brushVertices.add(native[i])
          }
        }
      }
      renderer.domElement.dataset.meshBrushRadiusMetres=String(radius)
      renderer.domElement.dataset.meshBrushHitPanel=String(contact.object.userData.panel)
      updateBrushMarks()
    }
    const setBrushActive=(active,clear=false)=>{
      state.meshBrushActive=Boolean(active)
      renderer.domElement.dataset.meshBrushActive=String(state.meshBrushActive)
      updateToolCursor()
      if(!state.meshBrushActive){
        if(state.brushDrag!==null&&renderer.domElement.hasPointerCapture(state.brushDrag))
          renderer.domElement.releasePointerCapture(state.brushDrag)
        state.brushDrag=null
        controls.enabled=true
      }
      if(clear){state.brushVertices.clear();updateBrushMarks()}
    }
    state.setBrushActive=setBrushActive
    const activateBrush=event=>{
      const active=event.type==='exo-clothcraft-3d-tool'
        ?event.detail?.tool==='mesh-brush':Boolean(event.detail?.active)
      setBrushActive(active,Boolean(event.detail?.clear)||!active)
    }
    const clearBrush=event=>{
      if(event.key==='Escape'&&state.internalLineActive)state.clearInternalLine()
      if(event.key==='Escape'&&state.tapeMode){
        state.tapePoints=[];state.tapeDrag=null;controls.enabled=true;updateTape()
      }
      if(event.key==='Escape'&&state.meshBrushActive){
        state.brushVertices.clear();updateBrushMarks()
        if(state.brushDrag!==null&&renderer.domElement.hasPointerCapture(state.brushDrag))
          renderer.domElement.releasePointerCapture(state.brushDrag)
        state.brushDrag=null;controls.enabled=true
      }
    }
    window.addEventListener('exo-clothcraft-mesh-brush',activateBrush)
    window.addEventListener('exo-clothcraft-3d-tool',activateBrush)
    window.addEventListener('keydown',clearBrush,true)
    renderer.domElement.dataset.meshBrushActive='false'
    updateBrushMarks()
    const transformMode = () => ['move3d','rotate3d','transform'].includes(propsRef.current.mode)
    const hideGizmo = () => {
      state.ringEnabled = false
      rings.visible = false
      transform.detach()
      transform.visible = false
      transform.enabled = false
      delete renderer.domElement.dataset.gizmoCenterX
      delete renderer.domElement.dataset.gizmoCenterY
      delete renderer.domElement.dataset.gizmoRingRadius
      renderer.domElement.dataset.gizmoVisible = 'false'
    }
    hideGizmo()
    const updateRings = () => {
      rings.visible=state.ringEnabled
      if(!rings.visible)return
      rings.position.copy(pivot.position)
      rings.quaternion.copy(pivot.quaternion)
      rings.scale.setScalar(.25)
      // Match our original GarmentViewport's projected gizmo center metadata;
      // used for browser input regression, not to approximate ring geometry.
      const projected=pivot.position.clone().project(camera)
      renderer.domElement.dataset.gizmoCenterX=String((projected.x+1)*renderer.domElement.clientWidth*.5)
      renderer.domElement.dataset.gizmoCenterY=String((1-projected.y)*renderer.domElement.clientHeight*.5)
      const cameraRight=new THREE.Vector3(.25,0,0).applyQuaternion(camera.quaternion).add(pivot.position).project(camera)
      renderer.domElement.dataset.gizmoRingRadius=String(Math.abs(cameraRight.x-projected.x)*renderer.domElement.clientWidth*.5)
      renderer.domElement.dataset.gizmoVisible='true'
      const face=pivot.quaternion.clone().invert().multiply(camera.quaternion)
      for(const child of rings.children)if(child.userData.rotationAxis==='free'||child.scale.x>1.2)child.quaternion.copy(face)
      rings.updateMatrixWorld(true)
    }
    const angleAt = event => {
      const rect=renderer.domElement.getBoundingClientRect(), projected=pivot.position.clone().project(camera)
      return Math.atan2(event.clientY-(rect.top+(1-projected.y)*rect.height/2),
        event.clientX-(rect.left+(projected.x+1)*rect.width/2))
    }
    const ringHit = event => {
      if(!rings.visible)return null
      const rect=renderer.domElement.getBoundingClientRect()
      const center=pivot.position.clone().project(camera)
      const right=new THREE.Vector3(.25,0,0).applyQuaternion(camera.quaternion).add(pivot.position).project(camera)
      const radius=Math.abs(right.x-center.x)*rect.width/2
      if(Math.hypot(event.clientX-(rect.left+(center.x+1)*rect.width/2),event.clientY-(rect.top+(1-center.y)*rect.height/2))<radius*.6)return null
      pointer.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height)
      ray.setFromCamera(pointer,camera)
      return ray.intersectObjects(pickRings,false)[0]?.object.userData.rotationAxis||null
    }
    const startPose = id => {
      const mesh=state.panelMeshes.get(id)
      const placement=propsRef.current.snapshot?.template?.panels?.find(p=>p.id===id)?.placement
      if(!mesh||!placement)return null
      return {id,mesh,placement:structuredClone(placement),center:pivot.position.clone(),
        quaternion:pivot.quaternion.clone(), vertices:mesh.geometry.attributes.position.array.slice(),
        meshPosition:mesh.position.clone()}
    }
    const previewPose = pose => {
      if(!pose)return
      const spin=pivot.quaternion.clone().multiply(pose.quaternion.clone().invert())
      const translation=pivot.position.clone().sub(pose.center)
      const attr=pose.mesh.geometry.attributes.position
      for(let i=0;i<attr.count;i++){
        const value=new THREE.Vector3(pose.vertices[i*3],pose.vertices[i*3+1],pose.vertices[i*3+2])
          .add(pose.meshPosition).sub(pose.center).applyQuaternion(spin).add(pose.center).add(translation).sub(pose.meshPosition)
        attr.setXYZ(i,value.x,value.y,value.z)
      }
      attr.needsUpdate=true
      pose.mesh.geometry.computeVertexNormals()
      pose.mesh.geometry.computeBoundingBox()
      pose.mesh.geometry.computeBoundingSphere()
      const moved=point=>point.clone().sub(pose.center).applyQuaternion(spin).add(pose.center).add(translation)
      for(const group of [state.seams,state.boundaries]){
        for(const guide of group.children){
          const links=guide.userData.links||[guide.userData.panel,guide.userData.panel]
          const originals=guide.userData.basePoints
          if(!originals)continue
          const positions=guide.geometry.attributes.position
          originals.forEach((point,index)=>{
            const next=links[index]===pose.id?moved(point):point
            positions.setXYZ(index,next.x,next.y,next.z)
          })
          positions.needsUpdate=true
          guide.geometry.computeBoundingSphere()
        }
      }
      for(const cloud of state.dots.children){
        const markers=cloud.userData.markers||[]
        const dummy=new THREE.Object3D()
        markers.forEach((marker,index)=>{
          dummy.position.copy(marker.panel===pose.id?moved(marker.point):marker.point)
          dummy.updateMatrix();cloud.setMatrixAt(index,dummy.matrix)
        })
        cloud.instanceMatrix.needsUpdate=true
      }
      updateRings()
    }
    const commitPose = pose => {
      if(!pose)return
      const translation=pivot.position.clone().sub(pose.center)
      const spin=pivot.quaternion.clone().multiply(pose.quaternion.clone().invert())
      const baseRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...degrees(pose.placement.rotation_degrees||[0,0,0])))
      const euler=new THREE.Euler().setFromQuaternion(spin.multiply(baseRotation),'XYZ')
      if(translation.lengthSq()>1e-12||pivot.quaternion.angleTo(pose.quaternion)>1e-5)
        propsRef.current.onPlace?.({kind:'Place',panel:pose.id,placement:{
          ...pose.placement,translation:(pose.placement.translation||[0,0,0]).map((value,i)=>value+translation.getComponent(i)),
          rotation_degrees:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)}})
    }

    const hit = event => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      pointer.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height)
      ray.setFromCamera(pointer, camera)
      const edge = ray.intersectObjects(boundaries.children, false).find(item => item.object.userData?.edge)
      const surface = ray.intersectObjects(cloth.children, false)[0]
      const body = propsRef.current.showAvatar && avatar.visible
        ? ray.intersectObjects(avatar.children,false)[0] : null
      // A visible fitting body is selectable wherever cloth does not occlude
      // it. This also prevents clicking through the body to fabric behind it.
      if(body && (!surface || body.distance<surface.distance-.003) &&
        (!edge || body.distance<edge.distance-.003)) return {avatar:true}
      return edge && (!surface || edge.distance < surface.distance + .018)
        ? edge.object.userData : surface?.object.userData || null
    }
    const foamHit=event=>{
      const rect=renderer.domElement.getBoundingClientRect()
      if(!(rect.width>0&&rect.height>0))return null
      pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height)
      ray.setFromCamera(pointer,camera)
      const candidates=ray.intersectObjects(foamPaddingGroup.children,false)
      const foam=candidates.find(row=>row.object.userData?.foamPadId&&!row.object.userData?.foamStitchGuide)
      if(!foam){renderer.domElement.dataset.nativeFoamLastRay='no-intersection';return null}
      const body=propsRef.current.showAvatar&&avatar.visible?ray.intersectObjects(avatar.children,false)[0]:null
      const clothHit=ray.intersectObjects(cloth.children,false)[0]
      const contactTolerance=.012
      renderer.domElement.dataset.nativeFoamLastRay=[foam.distance.toFixed(3),clothHit?.distance?.toFixed(3)||'none',body?.distance?.toFixed(3)||'none'].join(',')
      if(body&&body.distance<foam.distance-contactTolerance)return null
      if(clothHit&&clothHit.distance<foam.distance-contactTolerance)return null
      return foam
    }
    const releaseFoamPress=event=>{
      if(!state.foamPress||(event?.pointerId!==undefined&&event.pointerId!==state.foamPress.pointerId))return false
      const press=state.foamPress
      state.foamPress=null
      const entry=state.foamCompression.get(press.id)
      if(entry)entry.pressed=false
      controls.enabled=true
      if(renderer.domElement.hasPointerCapture(press.pointerId))renderer.domElement.releasePointerCapture(press.pointerId)
      renderer.domElement.dataset.nativeFoamPressActive='false'
      updateToolCursor()
      return true
    }
    const applyFoamCompression=dt=>{
      for(const [id,entry] of state.foamCompression){
        const mesh=state.foamMeshes.get(id)
        if(!mesh){state.foamCompression.delete(id);continue}
        const props=normalizeFoamMaterial(mesh.userData.foamCompressionProperties)
        const result=stepFoamCompressionState(entry,{pressStrength:entry.pressed?1:0,pressureKpa:45},dt,props)
        entry.compression=result.compression
        entry.velocity=result.velocity
        entry.memory=result.memory
        if(!entry.pressed&&entry.compression<.0005&&Math.abs(entry.velocity)<.001){entry.compression=0;entry.velocity=0}
        const base=mesh.userData.foamCompressionBase,surface=mesh.userData.foamCompressionSurface
        if(!base||!surface)continue
        const attr=mesh.geometry.getAttribute('position')
        const radius=Math.max(.002,entry.radius)
        for(let i=0;i<attr.count;i++){
          const j=i*3,dx=base[j]-entry.point.x,dy=base[j+1]-entry.point.y,dz=base[j+2]-entry.point.z
          const attenuation=foamPressFalloff(Math.sqrt(dx*dx+dy*dy+dz*dz)*100,radius*100)
          const compression=entry.compression*attenuation
          attr.setXYZ(i,base[j]+(surface[j]-base[j])*compression,
            base[j+1]+(surface[j+1]-base[j+1])*compression,
            base[j+2]+(surface[j+2]-base[j+2])*compression)
        }
        attr.needsUpdate=true
        mesh.geometry.computeVertexNormals()
        mesh.geometry.computeBoundingSphere()
        mesh.geometry.computeBoundingBox()
      }
    }
    // Keep the cloth responsive under the pointer while one Rust brush edit is
    // prepared. Solver positions remain authoritative after pointer release.
    // ClothCraft atelier.rs::pick_and_drag: triangle barycentric spring,
    // ray-normal drag plane, continuous solver updates; release removes force.
    const finishStretch = (event, cancelled) => {
      const grab=state.stretchGrab
      if(!grab)return
      state.stretchGrab=null
      controls.enabled=true
      updateToolCursor()
      if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
      propsRef.current.onStretchCancel?.()
      renderer.domElement.dataset.fabricGrabState='idle'
    }
    state.cancelStretch=()=>{if(state.stretchGrab)finishStretch({pointerId:state.stretchGrab.pointerId},true)}
    // Camera input uses the identical live Rust Fabric Hand spring as mouse
    // dragging: ray-hit triangle indices + barycentric weights + world target.
    // The hand tracker never modifies saved vertices or sewing relationships.
    const stopCameraGrab=()=>{
      if(!state.cameraGrab)return
      state.cameraGrab=null
      renderer.domElement.dataset.fabricGrabSource='none'
      renderer.domElement.dataset.fabricGrabState='idle'
      propsRef.current.onStretchCancel?.()
    }
    state.stopCameraGrab=stopCameraGrab
    // Screen-space mouse pointer follows the tracked index fingertip even
    // while the fingers are open. It lives above WebGL and never intercepts
    // mouse input, so the real canvas and toolbar remain usable.
    const cameraCursor=document.createElement('div')
    cameraCursor.className='cc-camera-fabric-cursor'
    cameraCursor.setAttribute('aria-hidden','true')
    cameraCursor.innerHTML='<span class="cc-camera-cursor-arrow"></span><span class="cc-camera-cursor-contact"></span>'
    cameraCursor.dataset.visible='false'
    cameraCursor.dataset.grabbing='false'
    hostNode.appendChild(cameraCursor)
    const cameraFabricHand=event=>{
      const hand=event.detail
      if(!hand?.tracking){
        cameraCursor.dataset.visible='false'
        cameraCursor.dataset.grabbing='false'
        renderer.domElement.dataset.cameraHandCursorVisible='false'
        stopCameraGrab();return
      }
      if(!Number.isFinite(hand.x)||!Number.isFinite(hand.y))return
      const x=THREE.MathUtils.clamp(hand.x,0,1),y=THREE.MathUtils.clamp(hand.y,0,1)
      const rect=renderer.domElement.getBoundingClientRect()
      const rootRect=hostNode.getBoundingClientRect()
      cameraCursor.style.left=`${rect.left-rootRect.left+x*rect.width}px`
      cameraCursor.style.top=`${rect.top-rootRect.top+y*rect.height}px`
      cameraCursor.dataset.visible='true'
      renderer.domElement.dataset.cameraHandCursorVisible='true'
      renderer.domElement.dataset.cameraHandCursorX=x.toFixed(4)
      renderer.domElement.dataset.cameraHandCursorY=y.toFixed(4)
      pointer.set(x*2-1,1-y*2)
      ray.setFromCamera(pointer,camera)
      const hoveredSurface=ray.intersectObjects(cloth.children,false)[0]
      const hoveredBody=ray.intersectObjects(avatar.children,false)[0]
      const overFabric=Boolean(hoveredSurface?.face&&!(avatar.visible&&hoveredBody&&hoveredBody.distance<hoveredSurface.distance-.001))
      cameraCursor.dataset.overFabric=String(overFabric)
      cameraCursor.dataset.grabbing=String(Boolean(hand.pinched&&state.cameraGrab))
      if(!hand.pinched||propsRef.current.mode!=='stretch3d'){
        stopCameraGrab();return
      }
      if(!state.cameraGrab){
        if(state.stretchGrab)return
        const surface=hoveredSurface
        if(!overFabric||!surface?.object.userData?.panel)return
        const origin=surface.point.clone(),mesh=surface.object
        const native=mesh.geometry.userData.nativeVertices||[]
        const face=surface.face,position=mesh.geometry.getAttribute('position')
        if([face.a,face.b,face.c].some(i=>!Number.isInteger(native[i])))return
        const p=mesh.worldToLocal(origin.clone())
        const a=new THREE.Vector3().fromBufferAttribute(position,face.a)
        const b=new THREE.Vector3().fromBufferAttribute(position,face.b)
        const c=new THREE.Vector3().fromBufferAttribute(position,face.c)
        const bary=THREE.Triangle.getBarycoord(p,a,b,c,new THREE.Vector3())
        if(!bary)return
        state.cameraGrab={vertices:[face.a,face.b,face.c].map(i=>native[i]),weights:bary.toArray(),
          origin,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),origin)}
        renderer.domElement.dataset.fabricGrabSource='camera'
        renderer.domElement.dataset.fabricGrabState='dragging'
        cameraCursor.dataset.grabbing='true'
        propsRef.current.onStretchStart?.({vertices:state.cameraGrab.vertices,weights:state.cameraGrab.weights,target:origin.toArray()})
      }else{
        const grab=state.cameraGrab
        const point=ray.ray.intersectPlane(grab.plane,new THREE.Vector3())
        if(!point)return
        const displacement=point.sub(grab.origin).clampLength(0,.8)
        const target=grab.origin.clone().add(displacement)
        propsRef.current.onStretchDrag?.({vertices:grab.vertices,weights:grab.weights,target:target.toArray()})
      }
    }
    window.addEventListener('exo-clothcraft-camera-fabric-hand',cameraFabricHand)
    const contextMenu = event => {
      event.preventDefault()
      event.stopPropagation()
      const picked = hit(event)
      // Client coordinates let the workspace's shared portal position the menu
      // correctly even when this canvas is nested in a resizable split pane.
      propsRef.current.onContextMenuRequest?.({
        x: event.clientX, y: event.clientY,
        hit: picked?.panel ? {panel: picked.panel, edge: picked.edge ?? null} : null,
      })
    }
    const pointerDown = event => {
      propsRef.current.onCanvasActivate?.()
      if (event.button !== 0) return
      if(state.internalLineActive){
        const selectedHit=internalLineHit(event)
        if(selectedHit){
          if(state.internalLinePoints.length===2)state.internalLinePoints=[]
          // Reject a line crossing two independently authored garment panels.
          if(!state.internalLinePoints.length||state.internalLinePoints[0].panel===selectedHit.panel){
            state.internalLinePoints.push(selectedHit)
            if(state.internalLinePoints.length===2){
              const [a,b]=state.internalLinePoints
              if(Math.hypot(a.uv[0]-b.uv[0],a.uv[1]-b.uv[1])>1e-7)
                window.dispatchEvent(new CustomEvent('exo-clothcraft-3d-internal-line',{detail:{panel:a.panel,points:[a.uv,b.uv]}}))
            }
            updateInternalLine()
          }
        }
        event.preventDefault();event.stopImmediatePropagation()
        return
      }
      if(state.tapeMode){
        const hit=tapeHit(event)
        if(hit){
          if(state.tapePoints.length===2&&['garment-measure','avatar-measure'].includes(state.tapeMode))state.tapePoints=[]
          let index=state.tapePoints.length===2?0:state.tapePoints.length
          if(state.tapeMode?.endsWith('-measure-edit')&&state.tapePoints.length===2){
            const rect=renderer.domElement.getBoundingClientRect()
            const screenDistance=point=>{
              const screen=point.clone().project(camera)
              return Math.hypot((screen.x+1)*rect.width/2+rect.left-event.clientX,(1-screen.y)*rect.height/2+rect.top-event.clientY)
            }
            const distances=state.tapePoints.map(p=>screenDistance(p.point))
            if(Math.min(...distances)<=24)index=distances[0]<=distances[1]?0:1
          }
          state.tapePoints[index]=hit
          if(state.tapePoints.length>2)state.tapePoints.length=2
          updateTape()
          if(state.tapeMode?.endsWith('-measure-edit')){
            state.tapeDrag=event.pointerId;state.tapeDragIndex=index
            controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId)
          }
        }
        event.preventDefault();event.stopImmediatePropagation()
        return
      }
      if(state.meshBrushActive){
        state.brushDrag=event.pointerId
        controls.enabled=false
        renderer.domElement.setPointerCapture(event.pointerId)
        applyBrush(event)
        event.preventDefault();event.stopImmediatePropagation()
        return
      }
      if(!state.stretchCommitPending&&!state.dragging&&!state.stretchGrab&&!transformMode()&&propsRef.current.mode==='edit'&&!propsRef.current.seamEditing){
        const foam=foamHit(event)
        if(foam){
          const mesh=foam.object,id=mesh.userData.foamPadId
          const bounds=mesh.geometry.boundingSphere||new THREE.Sphere()
          const props=normalizeFoamMaterial(mesh.userData.foamCompressionProperties)
          const specifiedRadius=Number(props.contactRadiusCm)/100
          const radius=Math.max(.012,Math.min(.15,Number.isFinite(specifiedRadius)&&specifiedRadius>0?specifiedRadius:bounds.radius*.75||.045))
          const point=foam.point.clone()
          const entry=state.foamCompression.get(id)||{compression:0,velocity:0,memory:0}
          Object.assign(entry,{pressed:true,point,radius})
          state.foamCompression.set(id,entry)
          state.foamPress={id,pointerId:event.pointerId}
          controls.enabled=false
          renderer.domElement.setPointerCapture(event.pointerId)
          renderer.domElement.dataset.nativeFoamPressActive='true'
          renderer.domElement.dataset.nativeFoamSelectedPadId=String(id)
          propsRef.current.onFoamSelect?.(id)
          event.preventDefault();event.stopImmediatePropagation()
          return
        }
      }
      if (state.stretchCommitPending) {event.preventDefault();return}
      // The 3D placement ring remains available in both Move and Rotate;
      // translating with the gizmo and rotating by its circular handle can
      // be combined without switching toolbar modes.
      const axis=['move3d','rotate3d'].includes(propsRef.current.mode)?ringHit(event):null
      if(axis&&propsRef.current.selected?.panel){
        const pose=startPose(propsRef.current.selected.panel)
        if(pose){
          const direction=axis==='free'?camera.getWorldDirection(new THREE.Vector3()).negate():
            new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0).applyQuaternion(pose.quaternion)
          state.ringDrag={pose,direction:direction.normalize(),previous:angleAt(event),accumulated:0}
          controls.enabled=false;transform.enabled=false
          renderer.domElement.setPointerCapture(event.pointerId)
          event.preventDefault();event.stopImmediatePropagation()
          return
        }
      }
      state.down = {x: event.clientX, y: event.clientY, hit: hit(event)}
      if (propsRef.current.mode === 'move3d' && state.down.hit?.panel && !state.transform.dragging && !state.transform.axis) {
        const id = state.down.hit.panel
        const surface = ray.intersectObjects(cloth.children, false).find(item => item.object.userData?.panel === id)
        const mesh = state.panelMeshes.get(id)
        const panel = propsRef.current.snapshot?.template?.panels?.find(item => item.id === id)
        if (mesh && surface && panel?.placement) {
          const start = surface.point.clone()
          state.move = {pointerId:event.pointerId,id, mesh, start, last:start.clone(), origin:mesh.position.clone(),pivotOrigin:pivot.position.clone(),
            plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),start),
            placement:structuredClone(panel.placement)}
          controls.enabled = false
          renderer.domElement.setPointerCapture(event.pointerId)
          propsRef.current.onPick?.({panel:id})
        }
      }
      if (propsRef.current.mode === 'stretch3d' && typeof propsRef.current.onStretchDrag === 'function') {
        const surface=ray.intersectObjects(cloth.children,false)[0]
        const occluder=ray.intersectObjects(avatar.children,false)[0]
        if (surface?.object.userData?.panel && (!occluder||occluder.distance>=surface.distance-1e-5)) {
          const origin=surface.point.clone()
          state.down.hit={panel:surface.object.userData.panel}
          const mesh=surface.object,indices=mesh.geometry.userData.nativeVertices
          const face=surface.face,local=mesh.worldToLocal(origin.clone()),position=mesh.geometry.attributes.position
          const a=new THREE.Vector3().fromBufferAttribute(position,face.a),b=new THREE.Vector3().fromBufferAttribute(position,face.b),c=new THREE.Vector3().fromBufferAttribute(position,face.c)
          const bary=THREE.Triangle.getBarycoord(local,a,b,c,new THREE.Vector3())
          if(!bary)return
          const vertices=[face.a,face.b,face.c].map(i=>indices[i]),weights=bary.toArray()
          state.stretchGrab={pointerId:event.pointerId,panel:mesh.userData.panel,vertices,weights,origin,last:origin.clone(),
            plane:new THREE.Plane().setFromNormalAndCoplanarPoint(ray.ray.direction.clone(),origin)}
          renderer.domElement.dataset.fabricGrabState='dragging'
          controls.enabled=false
          renderer.domElement.setPointerCapture(event.pointerId)
          updateToolCursor()
          propsRef.current.onStretchStart?.({vertices,weights,target:origin.toArray()})
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      }
    }
    const pointerMove = event => {
      if(state.foamPress){
        if(event.pointerId===state.foamPress.pointerId){
          const entry=state.foamCompression.get(state.foamPress.id)
          if(entry&&event.buttons===1){
            const foam=foamHit(event)
            if(foam?.object.userData.foamPadId===state.foamPress.id)entry.point.copy(foam.point)
          }
        }
        return
      }
      if(state.tapeMode){
        if(state.tapeDrag===event.pointerId&&event.buttons===1){
          const hit=tapeHit(event)
          if(hit){state.tapePoints[state.tapeDragIndex]=hit;updateTape()}
        }
        return
      }
      if(state.meshBrushActive){
        if(state.brushDrag===event.pointerId&&event.buttons===1)applyBrush(event)
        return
      }
      if(state.ringDrag){
        const drag=state.ringDrag,next=angleAt(event)
        let delta=next-drag.previous
        if(delta>Math.PI)delta-=2*Math.PI
        if(delta< -Math.PI)delta+=2*Math.PI
        drag.previous=next;drag.accumulated+=delta
        pivot.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(drag.direction,drag.accumulated).multiply(drag.pose.quaternion))
        previewPose(drag.pose)
        event.preventDefault()
        return
      }
      if (state.dragging) return
      const axis=transformMode()?ringHit(event):null
      transform.enabled=transformMode()&&!axis
      state.rotationHoverAxis=axis||null
      updateToolCursor()
      const current = hit(event)
      if (!state.stretchGrab) propsRef.current.onHover?.(current)
      if (state.move && event.buttons === 1) {
        const point = ray.ray.intersectPlane(state.move.plane,new THREE.Vector3())
        if (point) {
          state.move.last.copy(point)
          const delta = point.clone().sub(state.move.start)
          state.move.mesh.position.copy(state.move.origin).add(delta)
          pivot.position.copy(state.move.pivotOrigin).add(delta)
          updateRings()
          // Update active sewing guides in-place while the selected cloth is
          // pulled away. All untouched panel endpoints stay at the draped pose.
          for (const guide of state.seams.children) {
            const links=guide.userData?.links,points=guide.userData?.basePoints
            if (!links || !points) continue
            const attr=guide.geometry.attributes.position
            for(let index=0;index<2;index++){
              const p=points[index].clone()
              if(links[index]===state.move.id)p.add(delta)
              attr.setXYZ(index,p.x,p.y,p.z)
            }
            attr.needsUpdate=true
            guide.geometry.computeBoundingSphere()
          }
          for(const boundary of state.boundaries.children){
            if(boundary.userData.panel!==state.move.id)continue
            const attr=boundary.geometry.attributes.position
            boundary.userData.basePoints?.forEach((point,index)=>{
              const next=point.clone().add(delta)
              attr.setXYZ(index,next.x,next.y,next.z)
            })
            attr.needsUpdate=true
            boundary.geometry.computeBoundingSphere()
          }
          const dummy=new THREE.Object3D()
          for(const cloud of state.dots.children){
            ;(cloud.userData.markers||[]).forEach((marker,index)=>{
              dummy.position.copy(marker.point).add(marker.panel===state.move.id?delta:new THREE.Vector3())
              dummy.updateMatrix();cloud.setMatrixAt(index,dummy.matrix)
            })
            cloud.instanceMatrix.needsUpdate=true
          }
        }
        return
      }
      if (state.stretchGrab && event.buttons === 1) {
        const point=ray.ray.intersectPlane(state.stretchGrab.plane,new THREE.Vector3())
        if (point) {
          state.stretchGrab.last.copy(point)
          propsRef.current.onStretchDrag?.({vertices:state.stretchGrab.vertices,weights:state.stretchGrab.weights,target:point.toArray()})
        }
        event.preventDefault()
      }
    }
    const pointerUp = event => {
      if(releaseFoamPress(event))return
      if(state.tapeDrag===event.pointerId){
        state.tapeDrag=null;controls.enabled=true
        if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
        updateToolCursor()
        return
      }
      if(state.brushDrag===event.pointerId){
        state.brushDrag=null;controls.enabled=true
        if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
        updateToolCursor()
        return
      }
      if (state.stretchGrab) {
        const wasClick=state.down && Math.hypot(event.clientX-state.down.x,event.clientY-state.down.y)<5
        const picked=state.down?.hit
        finishStretch(event,event.type==='pointercancel')
        if(wasClick&&event.type!=='pointercancel')propsRef.current.onPick?.(picked)
        state.down=null
        return
      }
      if(state.ringDrag){
        const drag=state.ringDrag
        if(event.type==='pointercancel'){pivot.quaternion.copy(drag.pose.quaternion);previewPose(drag.pose)}
        else commitPose(drag.pose)
        state.ringDrag=null;controls.enabled=true;transform.enabled=transformMode()
        if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
        updateToolCursor()
        return
      }
      const movedPanel = Boolean(state.move)
      if (state.move) {
        const movement=state.move.last.clone().sub(state.move.start)
        const p=state.move.placement
        if (event.type!=='pointercancel' && movement.lengthSq()>1e-8) {
          const translation=(p.translation||[0,0,0]).map((n,i)=>n+movement.getComponent(i))
          propsRef.current.onPlace?.({kind:'Place',panel:state.move.id,placement:{...p,translation}})
        } else {state.move.mesh.position.copy(state.move.origin);setGrabRefresh(value=>value+1)}
        state.move=null
        controls.enabled=true
        if (renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
      }
      if (state.down && !movedPanel && event.type!=='pointercancel' && !state.dragging && Math.hypot(event.clientX - state.down.x, event.clientY - state.down.y) < 5)
        propsRef.current.onPick?.(hit(event))
      state.down = null
      state.stretchPlane = null
      state.stretchPoint = null
      state.stretchLast = null
    }
    const pointerLeave = () => {
      propsRef.current.onHover?.(null)
      state.rotationHoverAxis=null
      updateToolCursor()
      if(!state.move&&!state.stretchGrab){state.down=null;state.stretchPlane=null}
    }
    const draggingChanged = event => {
      state.dragging = !!event.value
      controls.enabled = !event.value
      if (event.value) {
        state.handleStart = {position: pivot.position.clone(), rotation: pivot.quaternion.clone()}
        state.transformPose=startPose(propsRef.current.selected?.panel)
        const p = propsRef.current.snapshot?.template?.panels?.find(panel => panel.id === propsRef.current.selected?.panel)
        if (p) state.nativeStart = structuredClone(p.placement)
      }
    }
    const transformEnd = () => {
      if(state.transformPose){
        commitPose(state.transformPose)
        state.transformPose=null;state.nativeStart=null;state.handleStart=null
        return
      }
      const id = propsRef.current.selected?.panel
      if (!id || !state.nativeStart || !state.handleStart) return
      const base = state.nativeStart
      const movement = pivot.position.clone().sub(state.handleStart.position)
      const translation = (base.translation || [0, 0, 0]).map((coordinate, index) => coordinate + movement.getComponent(index))
      const baseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...degrees(base.rotation_degrees || [0, 0, 0]), 'XYZ'))
      const rotationDelta = pivot.quaternion.clone().multiply(state.handleStart.rotation.clone().invert())
      const updatedEuler = new THREE.Euler().setFromQuaternion(rotationDelta.multiply(baseQuaternion), 'XYZ')
      const rotation_degrees = [updatedEuler.x, updatedEuler.y, updatedEuler.z].map(THREE.MathUtils.radToDeg)
      if (movement.lengthSq() > 1e-12 || rotation_degrees.some((value, index) => Math.abs(value - (base.rotation_degrees?.[index] || 0)) > 1e-5))
        propsRef.current.onPlace?.({kind: 'Place', panel: id, placement: {translation, rotation_degrees}})
      state.nativeStart = null
      state.handleStart = null
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerdown', pointerDown, true)
    renderer.domElement.removeEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('contextmenu', contextMenu)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerUp)
    const cancelLostGrab=()=>{releaseFoamPress();state.cancelStretch?.();stopCameraGrab();if(state.move)pointerUp({type:'pointercancel',pointerId:state.move.pointerId,clientX:NaN,clientY:NaN})}
    renderer.domElement.addEventListener('lostpointercapture',cancelLostGrab)
    window.addEventListener('blur',cancelLostGrab)
    renderer.domElement.addEventListener('pointerleave', pointerLeave)
    transform.addEventListener('dragging-changed', draggingChanged)
    const transformPreview=()=>previewPose(state.transformPose)
    transform.addEventListener('objectChange', transformPreview)
    transform.addEventListener('mouseUp', transformEnd)
    const resize = () => {
      if (!hostNode.isConnected) return
      const {width, height} = hostNode.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(hostNode)
    resize()
    let lastFrame=performance.now()
    const render = () => {
      state.requestId = requestAnimationFrame(render)
      const now=performance.now(),dt=Math.min(.033,Math.max(0,(now-lastFrame)/1000))
      lastFrame=now
      applyFoamCompression(dt)
      updateRings()
      controls.update()
      renderer.render(scene, camera)
    }
    render()
    return () => {
      stopCameraGrab()
      cameraCursor.remove()
      window.removeEventListener('exo-clothcraft-camera-fabric-hand',cameraFabricHand)
      cancelAnimationFrame(state.requestId)
      window.removeEventListener('exo-clothcraft-mesh-brush',activateBrush)
      window.removeEventListener('exo-clothcraft-3d-tool',activateBrush)
      window.removeEventListener('exo-clothcraft-3d-tool',activateTape)
      window.removeEventListener('exo-clothcraft-3d-tool',activateInternalLine)
      window.removeEventListener('keydown',clearBrush,true)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('contextmenu', contextMenu)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.domElement.removeEventListener('pointercancel', pointerUp)
      renderer.domElement.removeEventListener('lostpointercapture',cancelLostGrab)
      window.removeEventListener('blur',cancelLostGrab)
      renderer.domElement.removeEventListener('pointerleave', pointerLeave)
      transform.removeEventListener('dragging-changed', draggingChanged)
      transform.removeEventListener('mouseUp', transformEnd)
      transform.removeEventListener('objectChange', transformPreview)
      transform.detach()
      transform.dispose()
      controls.dispose()
      replaceChildren(cloth); replaceChildren(avatar); replaceChildren(boundaries)
      replaceChildren(seams); replaceChildren(dots); replaceChildren(boxes); replaceChildren(brushMarks)
      replaceChildren(tapeMarks)
      replaceChildren(internalLineMarks)
      replaceChildren(authoredLines)
      replaceChildren(foamPaddingGroup)
      state.foamCompression.clear();state.foamMeshes.clear()
      if(state.stageGroup){
        state.stageGroup.userData.disposed = true
        scene.remove(state.stageGroup)
        disposeTree(state.stageGroup)
        state.stageGroup = null
      }
      disposeTree(rings)
      scene.environment = null
      studioEnvironment.dispose()
      pmremGenerator.dispose()
      studioBackdrop.dispose()
      floor.geometry.dispose();floor.material.dispose()
      grid.geometry.dispose()
      for (const value of [grid.material, axes.material]) {
        for (const mat of Array.isArray(value)?value:[value]) mat?.dispose?.()
      }
      disposeTree(axes)
      centerGuide.geometry.dispose()
      centerGuide.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      for (const entry of hardwareRecordsRef.current.values()) entry.record?.dispose?.()
      hardwareRecordsRef.current.clear()
      sceneRef.current = null
    }
  }, [])

  // A native 3D mode change can originate from keyboard shortcuts, the
  // embedded quick bar, or a context menu instead of a CLO A/B slot. Release
  // mesh-brush pointer capture in every case when leaving the edit viewport.
  useEffect(() => {
    if (mode !== 'edit') sceneRef.current?.setBrushActive?.(false, true)
    if (mode !== 'stretch3d') sceneRef.current?.stopCameraGrab?.()
  }, [mode])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.floor.visible = showFloor && stageId === 'none'
    state.grid.visible = showFloor && stageId === 'none'
    const lighting = {
      studio: {hemi:1.85,key:2.6,rim:.85},
      softbox: {hemi:2.35,key:2.15,rim:.62},
      dramatic: {hemi:1.05,key:3.4,rim:1.65},
      neutral: {hemi:1.95,key:2.3,rim:.8},
    }[environmentPreset] || {hemi:1.85,key:2.6,rim:.85}
    state.ambient.intensity = lighting.hemi
    state.key.intensity = lighting.key
    state.fill.intensity = lighting.rim
    state.renderer.domElement.dataset.studioLightingPreset = environmentPreset
    state.renderer.domElement.dataset.studioFloorVisible = String(showFloor)
  }, [environmentPreset, stageId, showFloor])

  useEffect(()=>{
    const state=sceneRef.current
    if(!state)return
    applySceneCameraViewport(state.camera,state.controls,cameraSettings,state.renderer.domElement)
  },[cameraSettings])

  useEffect(()=>{
    const state=sceneRef.current
    if(!state)return
    const defaults={
      studio:{key:2.6,rim:.85},softbox:{key:2.15,rim:.62},
      dramatic:{key:3.4,rim:1.65},neutral:{key:2.3,rim:.8},
    }[environmentPreset]||{key:2.6,rim:.85}
    state.key.intensity=defaults.key*(sceneLight?.enabled===false?0:Math.max(0,Math.min(10,Number(sceneLight?.intensity??1))))
    state.fill.intensity=defaults.rim*(sceneLight2?.enabled===false?0:Math.max(0,Math.min(10,Number(sceneLight2?.intensity??1))))
    state.key.color.set(sceneLight?.color||'#fffcf8')
    state.fill.color.set(sceneLight2?.color||'#e2ecff')
    state.renderer.toneMappingExposure=Math.max(.2,Math.min(5,Number(exposure)||1.1))
    state.renderer.domElement.dataset.sceneLightIntensity=String(state.key.intensity)
    state.renderer.domElement.dataset.sceneLight2Intensity=String(state.fill.intensity)
  },[sceneLight,sceneLight2,environmentPreset,exposure])

  // Per-designer studio customization is optical only: never rewrite Rust
  // garment coordinates, stage presets or authored scene lighting properties.
  useEffect(()=>{
    const state=sceneRef.current
    if(!state)return
    const color=studioAppearance?.backgroundMode==='color'?studioAppearance?.studioColor:null
    const fogColor=paintStudioGradient(state.studioBackdrop,color)
    state.scene.background=state.studioBackdrop
    // A runway is a full-sized room: neutral-studio distance fog must not
    // erase the rear set, avatar, or garment panels arranged off-body.
    state.scene.fog=stageId==='EXO01'?null:new THREE.Fog(fogColor,6,16)
    const base={
      studio:2.6,softbox:2.15,dramatic:3.4,neutral:2.3,
    }[studioAppearance?.environmentPreset||environmentPreset]||2.6
    const configured=sceneLight?.enabled===false?0:Math.max(0,Math.min(10,Number(sceneLight?.intensity??1)))
    state.key.intensity=base*configured*Math.max(0,Math.min(5,Number(studioAppearance?.lightIntensity??1)))
    state.key.color.set(studioAppearance?.lightColor||sceneLight?.color||'#fffcf8')
    state.key.position.set(
      Number(studioAppearance?.lightPositionX??2.5),
      Number(studioAppearance?.lightPositionY??4.5),
      Number(studioAppearance?.lightPositionZ??3.1),
    )
    state.renderer.domElement.dataset.customStudioBackground=color||''
    state.renderer.domElement.dataset.customStudioLight=studioAppearance?.lightColor||''
    state.renderer.domElement.dataset.studioBackgroundMode=studioAppearance?.backgroundMode||'default'
    state.renderer.domElement.dataset.studioLightPosition=state.key.position.toArray().map(v=>v.toFixed(2)).join(',')
  },[studioAppearance?.studioColor,studioAppearance?.backgroundMode,studioAppearance?.environmentPreset,studioAppearance?.lightColor,studioAppearance?.lightIntensity,studioAppearance?.lightPositionX,studioAppearance?.lightPositionY,studioAppearance?.lightPositionZ,sceneLight,environmentPreset,stageId])

  useEffect(()=>{
    const state=sceneRef.current
    if(!state)return
    const quality=studioPreferences?.graphicsQuality||'high'
    const ratios={low:1,medium:1.25,high:2,ultra:2.5}
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratios[quality]||2))
    const blender=studioPreferences?.viewControls==='blender'
    state.controls.mouseButtons=blender
      ? {LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:THREE.MOUSE.DOLLY}
      : {LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}
    state.renderer.domElement.dataset.studioGraphicsQuality=quality
    state.renderer.domElement.dataset.studioAntialias=String(studioPreferences?.antialias!==false)
    state.renderer.domElement.dataset.studioViewControls=studioPreferences?.viewControls||'clo'
  },[studioPreferences?.graphicsQuality,studioPreferences?.antialias,studioPreferences?.viewControls])

  // EXO's stage is purely presentation geometry. A switch does not re-create
  // the native Rust garment snapshot, contacts, or editor selection.
  const syncStageLogoDiagnostics = () => {
    const state = sceneRef.current
    if (!state) return
    const canvas = state.renderer.domElement
    const logo = state.stageGroup?.userData.stageLogo
    let meshCount = 0
    logo?.traverse(node => { if (node.isMesh && node.geometry?.getAttribute('position')?.count) meshCount++ })
    canvas.dataset.stageLogoVisible = String(Boolean(logo && logo.visible && meshCount))
    canvas.dataset.stageLogoMeshCount = String(meshCount)
    canvas.dataset.stageLogoScale = logo ? String(logo.scale.x) : '0'
    const mesh = logo?.children.find(node => node.isMesh && node.material?.color)
    canvas.dataset.stageLogoColor = mesh?.material?.color?.getHexString ? `#${mesh.material.color.getHexString()}` : ''
  }
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    const previous = state.stageGroup
    if(previous){
      previous.userData.disposed = true
      state.scene.remove(previous)
      disposeTree(previous)
      state.stageGroup = null
    }
    const canvas = state.renderer.domElement
    canvas.dataset.stageId = stageId || 'none'
    canvas.dataset.stageMeshCount = '0'
    canvas.dataset.stageStatus = stageId === 'none' ? 'none' : 'loading'
    canvas.dataset.stageCameraReady = 'false'
    syncStageLogoDiagnostics()
    state.framedStageId = null
    // Stage has its own authored floor at Y=0, and is presentation geometry.
    // The real Rust avatar and cloth groups always stay outside this group.
    state.scene.fog=stageId==='EXO01'?null:new THREE.Fog(state.scene.background?.isColor?state.scene.background:0xe9e9eb,6,16)
    if(!stageId || stageId === 'none') return
    const update = group => {
      if(state.stageGroup !== group || group.userData.disposed || !canvas.isConnected)return
      let count = 0
      group.traverse(item => {if(item.isMesh && item.geometry?.getAttribute('position')?.count > 0)count++})
      canvas.dataset.stageMeshCount = String(count)
      canvas.dataset.stageStatus = group.userData.loadError ? 'error' : count > 0 ? 'ready' : 'empty'
      syncStageLogoDiagnostics()
      if(group.userData.loaded && count && state.framedStageId!==stageId){
        // Each recovered Blender room needs an initial shot from its runway
        // entrance. The avatar stays at the origin; the wall signage sits
        // behind/above it. Keep the previously approved EXO01 shot intact.
        const exo = stageId === 'EXO01'
        const target=exo ? new THREE.Vector3(0,1.05,-.25) : new THREE.Vector3(.15,1.55,-1.2)
        state.controls.target.copy(target)
        if(exo) state.camera.position.set(2.75,2.3,5.35)
        else if(stageId==='R02') state.camera.position.set(.75,2.55,6.5)
        else state.camera.position.set(.5,2.4,5.4)
        state.camera.lookAt(target)
        state.controls.update()
        state.framedStageId=stageId
        canvas.dataset.stageCameraReady='true'
      }
    }
    const group = createStageEnvironment(THREE,stageId,update,stageSettings || {})
    state.stageGroup = group
    state.scene.add(group)
    update(group)
    return () => {
      if(state.stageGroup!==group)return
      group.userData.disposed = true
      state.scene.remove(group)
      disposeTree(group)
      state.stageGroup = null
    }
  },[stageId])

  useEffect(() => {
    const group = sceneRef.current?.stageGroup
    if (group) applyStageSettings(THREE, group, stageSettings || {})
    syncStageLogoDiagnostics()
  }, [stageSettings, stageId])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    const {cloth, boundaries, seams, dots, avatar, boxes, authoredLines, panelMeshes, panelOffsets} = state
    for (const group of [cloth, boundaries, seams, dots, avatar, boxes, authoredLines]) replaceChildren(group)
    panelMeshes.clear()
    panelOffsets.clear()
    if (!snapshot) {
      state.markerCounts = SEAM_COLORS.map(() => 0)
      setMarkerDiagnostics(state.renderer.domElement, state.markerCounts, false)
      state.renderer.domElement.dataset.native3dPanelMeshCount = '0'
      state.renderer.domElement.dataset.native3dMeshRevision = ''
      state.renderer.domElement.dataset.native3dMeshTriangles = '0'
      return
    }
    // Explicit proof that the Three.js cloth was rebuilt from the same
    // committed Rust Shape snapshot as the 2D pattern. A staged yellow
    // proposal never falsely reports a committed 3D fabric change.
    state.renderer.domElement.dataset.native3dMeshRevision=String(snapshot.revision??'')
    state.renderer.domElement.dataset.native3dMeshTriangles=String(snapshot.triangles?.length||0)
    state.renderer.domElement.dataset.native3dMeshVertices=String(snapshot.positions?.length||0)
    const world = preDrapeDisplayPositions(snapshot)
    const previewCurved = world !== snapshot.positions
    state.renderer.domElement.dataset.nativePreDrapeCurved = String(previewCurved)
    state.renderer.domElement.dataset.nativePreDrapeDepth = previewCurved
      ? String(world.reduce((max,p,i)=>Math.max(max,Math.abs((p?.[0]||0)-(snapshot.positions?.[i]?.[0]||0)),Math.abs((p?.[2]||0)-(snapshot.positions?.[i]?.[2]||0))),0)) : '0'
    const panels = snapshot.panels || []
    const templatePanels = snapshot.template?.panels || []
    let renderedGraphics=0
    const strains=analysisMode==='strain'?vertexExtensions(snapshot):null
    state.renderer.domElement.dataset.analysisMode=analysisMode
    const offsetMagnitude = typeof spread === 'number' && Number.isFinite(spread) ? Math.max(0, spread) : (spread ? .3 : 0)
    panels.forEach((panel, index) => {
      const piece = templatePanels.find(item => item.id === panel.id)
      const triangleRange = Array.isArray(panel.triangles) && Array.isArray(snapshot.triangles)
        ? snapshot.triangles.slice(panel.triangles[0], panel.triangles[1]) : []
      const panelMesh = buildIndexedMesh(world, triangleRange, COLORS[index % COLORS.length], snapshot.uv)
      panelMesh.material.dispose()
      const fabricId=piece?.fabric
      const fabricAppearance=fabricId==null?null:snapshot.propertyMetadata?.fabrics?.[fabricId]?.appearance
      let backMaterial=null,sideMaterial=null
      const nativeFabric=snapshot.template?.fabrics?.find(f=>f.id===fabricId)
      if(!strains){
        const faces=createFabricFaceMaterials(nativeFabric,piece?.grain_degrees||0,fabricAppearance)
        panelMesh.material=faces.front
        backMaterial=faces.back
        sideMaterial=faces.side
      }
      if(strains){
        const colors=panelMesh.geometry.userData.nativeVertices.flatMap(i=>{
          const color=new THREE.Color().setHSL((1-Math.min(1,Math.max(0,strains[i])/.25))*.66,1,.5)
          return [color.r,color.g,color.b]
        })
        panelMesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
        panelMesh.material.userData?.ownedTexture?.dispose()
        panelMesh.material.dispose()
        panelMesh.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})
      }
      const offset = new THREE.Vector3()
      if (offsetMagnitude) {
        const angle = (index / Math.max(1, panels.length)) * 2 * Math.PI
        offset.set(Math.cos(angle) * offsetMagnitude, 0, Math.sin(angle) * offsetMagnitude)
      }
      panelMesh.position.copy(offset)
      panelMesh.userData = {panel: panel.id}
      // Keep native picking two-sided despite distinct front/back render faces.
      // The raycaster tests the original cloth only; display children never pick.
      if(backMaterial){
        const nativeRaycast=panelMesh.raycast
        panelMesh.raycast=function(raycaster,intersections){
          const originalSide=this.material.side
          this.material.side=THREE.DoubleSide
          try{nativeRaycast.call(this,raycaster,intersections)}finally{this.material.side=originalSide}
        }
      }
      if(backMaterial){
        const backMesh=new THREE.Mesh(panelMesh.geometry,backMaterial)
        backMesh.name='native-cloth-back-face'
        backMesh.raycast=()=>{}
        backMesh.castShadow=true
        backMesh.receiveShadow=true
        backMesh.material.wireframe=wireframe
        panelMesh.add(backMesh)
      }
      if(sideMaterial){
        // The Rust template stores fabric thickness in its properties object,
        // in metres; library presets may expose a legacy root-level value.
        const thickness=Number(nativeFabric?.properties?.thickness??nativeFabric?.thickness)
        const ribbon=createFabricEdgeRibbon(panelMesh.geometry,thickness)
        if(ribbon.geometry){
          const sideMesh=new THREE.Mesh(ribbon.geometry,sideMaterial)
          sideMesh.name='native-cloth-side-edge'
          sideMesh.raycast=()=>{}
          sideMesh.castShadow=false
          sideMesh.receiveShadow=true
          sideMesh.userData={edgeCount:ribbon.edgeCount,thicknessMeters:ribbon.thicknessMeters}
          sideMesh.material.wireframe=wireframe
          panelMesh.add(sideMesh)
        }else sideMaterial.dispose()
      }
      const graphicsForPanel=graphics.filter(graphic=>graphic.panel===panel.id&&graphic.visible!==false)
      if(graphicsForPanel.length){
        attachGarmentGraphics(panelMesh,graphicsForPanel)
        renderedGraphics+=graphicsForPanel.length
      }
      panelMesh.material.wireframe = wireframe
      panelMesh.castShadow = true
      panelMesh.receiveShadow = true
      cloth.add(panelMesh)
      panelMeshes.set(panel.id, panelMesh)
      panelOffsets.set(panel.id, offset)
      // Render native authored lines in 3D on every new solver snapshot. The
      // preview points can disappear when the tool is dismissed; the saved
      // pattern line remains visible here and in native project history.
      for(const guide of piece?.polygon?.lines||[]){
        const points=guide.points||[]
        if(points.length<2||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))continue
        for(let j=1;j<points.length;j++){
          const first=points[j-1],last=points[j]
          const count=Math.max(8,Math.min(120,Math.ceil(Math.hypot(last[0]-first[0],last[1]-first[1])/.012)))
          let current=[]
          const finish=()=>{
            if(current.length>1){
              const stroke=new THREE.Line(new THREE.BufferGeometry().setFromPoints(current),
                new THREE.LineBasicMaterial({color:'#1aadd4',depthTest:false,depthWrite:false,transparent:true,opacity:.92}))
              stroke.renderOrder=88;stroke.userData={panel:panel.id,internalLine:guide.id}
              authoredLines.add(stroke)
            }
            current=[]
          }
          for(let k=0;k<=count;k++){
            const t=k/count,uvPoint=[first[0]+t*(last[0]-first[0]),first[1]+t*(last[1]-first[1])]
            const point=worldPointAtMaterialUv(triangleRange,snapshot.uv,world,uvPoint,offset)
            if(point)current.push(point);else finish()
          }
          finish()
        }
      }
      for (const [edge, indices] of Object.entries(panel.boundaries || {})) {
        if (indices.length < 2) continue
        const vertices = indices.filter(i => finiteVec(world[i])).map(i => v3(world[i]).add(offset))
        if (vertices.length < 2) continue
        const geometry = new THREE.BufferGeometry().setFromPoints(vertices)
        const outline = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: '#566875', transparent: true, opacity: .76}))
        outline.userData = {panel: panel.id, edge}
        outline.userData.basePoints=vertices.map(value=>value.clone())
        boundaries.add(outline)
      }
      if (!piece) return
    })
    state.renderer.domElement.dataset.garmentGraphicCount=String(renderedGraphics)
    state.renderer.domElement.dataset.native3dPanelMeshCount = String(panelMeshes.size)
    // Keep precisely the Rust guide endpoints, with clear, unlit marks that
    // remain legible against the garment even at grazing camera angles.
    const dotGeometry = new THREE.SphereGeometry(.008, 8, 6)
    const sharedDotMaterials = SEAM_COLORS.map(color => new THREE.MeshBasicMaterial({
      color, depthTest:false, depthWrite:false, toneMapped:false,
    }))
    // One instanced draw call per seam color, regardless of guide count.
    const dotPositions = SEAM_COLORS.map(() => [])
    ;(snapshot.seams || []).forEach((seam, index) => {
      const colorIndex = index % SEAM_COLORS.length
      const spec = snapshot.template?.seams?.find(item => item.id === seam.id)
      const highlighted = !!active?.edge && [spec?.a, spec?.b].some(side => side?.panel === active.panel && side.edge === active.edge)
      ;(seam.guides || []).forEach((pair, pairIndex) => {
        if (!Array.isArray(pair) || pair.length !== 2) return
        const ends = pair.map((weights, sideIndex) => {
          const value = weighted(weights, world)
          const panelId = sideIndex ? spec?.b?.panel : spec?.a?.panel
          return value.add(panelOffsets.get(panelId) || new THREE.Vector3())
        })
        if (showSeams && highlighted) {
          const guide=line(ends[0], ends[1], highlighted ? '#f07847' : SEAM_COLORS[colorIndex], highlighted ? 1 : .62)
          guide.userData={links:[spec?.a?.panel,spec?.b?.panel],basePoints:ends.map(point=>point.clone())}
          seams.add(guide)
        }
        if (showSeams && showContactDots && highlighted)
          dotPositions[colorIndex].push({point:ends[0].clone(),panel:spec?.a?.panel},{point:ends[1].clone(),panel:spec?.b?.panel})
      })
    })
    sharedDotMaterials.forEach((mat, index) => {
      const positions = dotPositions[index]
      if (!positions.length) {mat.dispose(); return}
      const mesh = new THREE.InstancedMesh(dotGeometry.clone(), mat, positions.length)
      const dummy = new THREE.Object3D()
      positions.forEach(({point}, i) => {
        dummy.position.copy(point)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
      mesh.renderOrder = 85
      mesh.userData.markers=positions
      dots.add(mesh)
    })
    state.markerCounts = dotPositions.map(positions => positions.length)
    setMarkerDiagnostics(state.renderer.domElement, state.markerCounts, showSeams && sewingToolsActive && showContactDots)
    dotGeometry.dispose()
    if (snapshot.avatar?.positions?.length && snapshot.avatar?.triangles?.length) {
      const bodyMesh=buildIndexedMesh(snapshot.avatar.positions, snapshot.avatar.triangles, '#555b64')
      bodyMesh.material.metalness=0;bodyMesh.material.roughness=.95
      if (bodyMesh.geometry.index.count > 0) avatar.add(bodyMesh)
      // Guides derive their extents from the displayed avatar mesh and never
      // participate in collision, picking, simulation or exported geometry.
      bodyMesh.geometry.computeBoundingBox()
      const bounds=bodyMesh.geometry.boundingBox
      if(bodyMesh.geometry.index.count > 0 && bounds && !bounds.isEmpty() && Number.isFinite(bounds.min.y) && bounds.max.y-bounds.min.y>1e-6) {
        const guideGroup=new THREE.Group()
        guideGroup.name='avatar-construction-guides'
        guideGroup.raycast=()=>{}
        const guideMaterial=new THREE.LineDashedMaterial({color:'#6ed9df',transparent:true,opacity:.85,depthTest:false,dashSize:.035,gapSize:.02})
        const addGuide=(points,name)=>{
          if(points.length<2)return
          const geometry=new THREE.BufferGeometry().setFromPoints(points)
          const stroke=new THREE.Line(geometry,guideMaterial)
          stroke.name=name
          stroke.computeLineDistances()
          stroke.renderOrder=120
          guideGroup.add(stroke)
        }
        const vertices=bodyMesh.geometry.attributes.position
        const positions=Array.from({length:vertices.count},(_,i)=>[vertices.getX(i),vertices.getY(i),vertices.getZ(i)])
        const indices=bodyMesh.geometry.index.array
        const triangles=Array.from({length:indices.length/3},(_,i)=>[indices[i*3],indices[i*3+1],indices[i*3+2]])
        for(const curve of avatarSurfaceConstructionCurves(positions,triangles))
          addGuide(curve.points.map(p=>new THREE.Vector3(p[0],p[1],p[2])),curve.name)
        guideGroup.visible=showConstructionGuides
        if(guideGroup.children.length)avatar.add(guideGroup)
      }
      state.renderer.domElement.dataset.avatarColor='#555b64'
    }
    avatar.visible = showAvatar
    state.renderer.domElement.dataset.constructionGuidesVisible=String(showAvatar && showConstructionGuides && avatar.children.some(child=>child.name==='avatar-construction-guides'))
    state.renderer.domElement.dataset.avatarVisible = String(showAvatar && avatar.children.length > 0)
    boundaries.visible = sewingToolsActive
    seams.visible = showSeams && sewingToolsActive
    dots.visible = showSeams && sewingToolsActive && showContactDots
    state.renderer.domElement.dataset.fabricPresets=JSON.stringify([...panelMeshes.values()].map(m=>m.material.userData.fabricPreset))
    state.renderer.domElement.dataset.nativeFabricAppearances=JSON.stringify([...panelMeshes.values()].map(mesh=>{
      const back=mesh.children.find(child=>child.name==='native-cloth-back-face')?.material
      const edge=mesh.children.find(child=>child.name==='native-cloth-side-edge')
      const face=mat=>mat?{appearance:mat.userData.fabricAppearance||null,side:mat.side===THREE.FrontSide?'front':mat.side===THREE.BackSide?'back':'double',color:`#${mat.color.getHexString()}`,opacity:mat.opacity,roughness:mat.roughness??null,metalness:mat.metalness??null,reflectionIntensity:mat.envMapIntensity??null}:null
      return {panel:mesh.userData.panel,...face(mesh.material),front:face(mesh.material),back:face(back),side:face(edge?.material),sideEdgeCount:edge?.userData.edgeCount??0,sideThicknessMeters:edge?.userData.thicknessMeters??0}
    }))
    state.renderer.domElement.dataset.native3dInternalLineCount=String(authoredLines.children.length)
    state.renderer.domElement.dataset.nativeGrabActive=String(Boolean(snapshot.grabActive))
    state.renderer.domElement.dataset.simulationTime=String(snapshot.time)
    state.sceneSnapshot = snapshot
    // Solver snapshots refresh continuously while the user is choosing two points.
    // Preserve the first material point across deformation; only invalidate it
    // when the referenced panel is removed from the native snapshot.
    if(state.internalLinePoints?.length&&!panelMeshes.has(state.internalLinePoints[0].panel))state.clearInternalLine?.()
    const valid=new Set(world.map((vertex,index)=>finiteVec(vertex)?index:null).filter(index=>index!==null))
    for(const index of state.brushVertices)if(!valid.has(index))state.brushVertices.delete(index)
    state.updateBrushMarks?.()
  }, [snapshot, spread, grabRefresh, analysisMode, graphics])

  // Visual draft meshes share the native scene, camera, lighting and render
  // loop. Their material-space vertices follow the current Rust cloth pose;
  // this intentionally does not create native sewing or collision constraints.
  useEffect(() => {
    const state=sceneRef.current
    if(!state)return
    replaceChildren(state.foamPaddingGroup)
    state.foamMeshes.clear()
    if(!snapshot || !Array.isArray(foamPads) || !foamPads.length){
      state.foamPress=null
      state.foamCompression.clear()
      state.renderer.domElement.dataset.nativeFoamPadCount='0'
      state.renderer.domElement.dataset.nativeFoamStitchGuideCount='0'
      return
    }
    const displayPositions=preDrapeDisplayPositions(snapshot)
    const visibleSnapshot=displayPositions===snapshot.positions?snapshot:{...snapshot,positions:displayPositions}
    const meshes=createSceneMeshes(visibleSnapshot,foamPads,state.panelOffsets)
    for(const mesh of meshes){
      // Mark overlays so native garment picking keeps selecting cloth panels.
      mesh.userData.foamPreview=true
      mesh.frustumCulled=false
      state.foamPaddingGroup.add(mesh)
      if(mesh.isMesh&&mesh.userData.foamPadId){
        state.foamMeshes.set(mesh.userData.foamPadId,mesh)
      }
    }
    for(const id of [...state.foamCompression.keys()])if(!state.foamMeshes.has(id)){
      state.foamCompression.delete(id)
      if(state.foamPress?.id===id){state.foamPress=null;state.controls.enabled=true}
    }
    state.renderer.domElement.dataset.nativeFoamPadCount=String(meshes.filter(mesh=>mesh.isMesh).length)
    // Diagnostic screen-space centers help verify that a foam mesh is both
    // attached to the native cloth and reachable by the pointer.
    state.camera.updateMatrixWorld()
    state.renderer.domElement.dataset.nativeFoamProjectedCenters=meshes.filter(mesh=>mesh.isMesh).map(mesh=>{
      mesh.geometry.computeBoundingSphere()
      const world=mesh.geometry.boundingSphere?.center?.clone()
      if(!world)return ''
      const clip=world.clone().project(state.camera)
      return [mesh.userData.foamPadId,Number(clip.x.toFixed(4)),Number(clip.y.toFixed(4)),Number(clip.z.toFixed(4))].join(',')
    }).join(';')
    state.renderer.domElement.dataset.nativeFoamStitchGuideCount=String(meshes.filter(mesh=>mesh.userData.foamStitchGuide).length)
    state.renderer.domElement.dataset.nativeFoamMode='cloth-uv-visual-guide'
    return()=>replaceChildren(state.foamPaddingGroup)
  },[snapshot,foamPads])

  // Native Rust stores the placement records. This overlay resolves each
  // licensed local GLB by catalog asset ID and attaches it to the actual
  // deformed cloth triangle, without adding unsupported rigid contact forces.
  useEffect(() => {
    const state=sceneRef.current
    if(!state)return undefined
    const known=hardwareRecordsRef.current
    const wanted=new Map((importedHardware||[]).filter(item=>item?.visible!==false&&item.glbUrl&&item.panel&&item.id).map(item=>[
      item.id,{item,signature:JSON.stringify([item.panel,item.glbUrl,item.x,item.y,item.widthMm,item.heightMm,item.depthMm,item.rotationDeg,item.liftMm,item.color,item.roughness,item.metalness,item.opacity])},
    ]))
    for(const [id,previous] of known){
      if(wanted.get(id)?.signature===previous.signature)continue
      previous.record?.dispose?.()
      known.delete(id)
    }
    for(const [id,{item,signature}] of wanted){
      if(known.has(id))continue
      const pending={signature,item,record:null,cancelled:false}
      known.set(id,pending)
      // Imported hardware follows the visible preview surface at time zero,
      // then the authoritative native solver mesh when simulation starts.
      // This keeps buttons and YKK pulls attached after the visual pre-drape.
      const current=hardwareSnapshotRef.current
      const displayed=current&&preDrapeDisplayPositions(current)
      const visible=current&&displayed!==current.positions?{...current,positions:displayed}:current
      createNativeImportedHardwareOverlay(item,visible,item.panel,state.panelOffsets.get(item.panel))
        .then(record=>{
          if(!record)return
          if(pending.cancelled||known.get(id)!==pending||sceneRef.current!==state){record.dispose();return}
          pending.record=record
          state.scene.add(record.object)
          state.renderer.domElement.dataset.nativeImportedHardwareCount=String([...known.values()].filter(row=>row.record).length)
        })
        .catch(error=>{if(known.get(id)===pending){known.delete(id);state.renderer.domElement.dataset.importedHardwareLoadError=String(error.message).slice(0,140)}})
    }
    state.renderer.domElement.dataset.nativeImportedHardwareExpected=String(wanted.size)
    return()=>{for(const [id,previous] of known){if(!wanted.has(id)){previous.cancelled=true;previous.record?.dispose?.();known.delete(id)}}}
  },[importedHardware])
  useEffect(()=>{
    const state=sceneRef.current
    if(!state||!snapshot)return
    const displayPositions=preDrapeDisplayPositions(snapshot)
    const visibleSnapshot=displayPositions!==snapshot.positions
      ? {...snapshot,positions:displayPositions}:snapshot
    for(const entry of hardwareRecordsRef.current.values()){
      if(!entry.record)continue
      if(entry.lastUv!==snapshot.uv){
        const updated=nativeHardwareAnchor(snapshot,entry.item.panel,entry.item)
        if(updated)entry.record.anchor=updated
        entry.lastUv=snapshot.uv
      }
      entry.record.update(visibleSnapshot,state.panelOffsets.get(entry.item.panel))
    }
  },[snapshot,spread,importedHardware])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.avatar.visible = showAvatar
    state.renderer.domElement.dataset.avatarVisible = String(showAvatar && state.avatar.children.length > 0)
    state.boundaries.visible = sewingToolsActive
    state.seams.visible = showSeams && sewingToolsActive
    state.dots.visible = showSeams && sewingToolsActive && showContactDots
    setMarkerDiagnostics(state.renderer.domElement, state.markerCounts || SEAM_COLORS.map(() => 0), state.dots.visible)
    for (const mesh of state.panelMeshes.values()) {
      mesh.material.wireframe = wireframe
      for(const child of mesh.children)if(['native-cloth-back-face','native-cloth-side-edge'].includes(child.name))child.material.wireframe=wireframe
    }
    const currentPanel = selected?.panel
    for (const [id, mesh] of state.panelMeshes) {
      const hover = active?.panel === id
      // Preserve the fabric surface during linked selection; emissive supplies the highlight.
      mesh.material.emissive?.set(hover ? '#5a3111' : '#000000')
      mesh.material.emissiveIntensity = hover ? .24 : 0
      for(const child of mesh.children)if(['native-cloth-back-face','native-cloth-side-edge'].includes(child.name)){
        child.material.emissive?.set(hover ? '#5a3111' : '#000000')
        child.material.emissiveIntensity=hover?.24:0
      }
    }
    let highlightedEdges=0
    for (const boundary of state.boundaries.children) {
      const highlighted = sewingToolsActive && !!active?.edge && boundary.userData.panel === active.panel && active.edge === boundary.userData.edge
      boundary.material.color.set(highlighted ? '#ff9b3d' : '#566875')
      boundary.material.opacity = highlighted ? 1 : .76
      boundary.renderOrder=highlighted?96:0
      boundary.material.depthTest=!highlighted
      if(highlighted)highlightedEdges++
    }
    state.renderer.domElement.dataset.sewingHoverEdge=sewingToolsActive&&active?.edge?`${active.panel}:${active.edge}`:''
    state.renderer.domElement.dataset.sewingHighlighted3dEdgeCount=String(highlightedEdges)
    replaceChildren(state.boxes)
    if (showBoundingBox && currentPanel && state.panelMeshes.has(currentPanel)) {
      const bounds = new THREE.Box3().setFromObject(state.panelMeshes.get(currentPanel))
      if (!bounds.isEmpty()) state.boxes.add(new THREE.Box3Helper(bounds, '#e99b50'))
    }
    const nativePanel = snapshot?.template?.panels?.find(panel => panel.id === currentPanel)
    if (nativePanel && ['move3d', 'rotate3d','transform'].includes(mode) && state.panelMeshes.has(currentPanel) && !state.dragging && !state.ringDrag && !state.move) {
      const bounds = new THREE.Box3().setFromObject(state.panelMeshes.get(currentPanel))
      bounds.getCenter(state.pivot.position)
      state.pivot.rotation.set(0, 0, 0)
      state.transform.setMode(mode === 'rotate3d' ? 'rotate' : 'translate')
      state.transform.attach(state.pivot)
      state.transform.visible = true
      state.transform.enabled = true
      state.ringEnabled=['move3d','rotate3d'].includes(mode)
    } else if (!state.dragging&&!state.ringDrag&&!state.move) {
      state.ringEnabled=false
      state.rings.visible=false
      state.transform.detach()
      state.transform.visible=false
      state.transform.enabled=false
      delete state.renderer.domElement.dataset.gizmoCenterX
      delete state.renderer.domElement.dataset.gizmoCenterY
      delete state.renderer.domElement.dataset.gizmoRingRadius
      state.renderer.domElement.dataset.gizmoVisible='false'
    }
  }, [snapshot, active?.panel, active?.edge, selected?.panel, mode, showAvatar, showConstructionGuides,
    showSeams, sewingToolsActive, wireframe, showBoundingBox, showContactDots, spread, analysisMode])

  useEffect(()=>{if(mode!=='stretch3d')sceneRef.current?.cancelStretch?.()},[mode])
  useEffect(()=>{if(sceneRef.current)sceneRef.current.rotationHoverAxis=null;sceneRef.current?.updateToolCursor?.()},[mode,seamEditing])

  // A03 operates in native edit mode. A subsequent viewport mode change must
  // release the brush even when a caller omitted the explicit tool event.
  useEffect(()=>{
    if(mode!=='edit')sceneRef.current?.setBrushActive?.(false,true)
  },[mode])

  useEffect(()=>{
    const receive=event=>{
      if(event.type==='exo-clothcraft-command' && event.detail!=='fit-camera')return
      const state=sceneRef.current;if(!state)return
      const box=new THREE.Box3()
      // Visible Rust meshes include the authored spread and live panel transforms.
      // Camera fit should follow what the artist actually sees in this viewport.
      state.cloth.updateWorldMatrix(true,true)
      for(const mesh of state.panelMeshes.values())box.expandByObject(mesh)
      if(box.isEmpty())for(const p of propsRef.current.snapshot?.positions||[])if(finiteVec(p))box.expandByPoint(v3(p))
      if(box.isEmpty())return
      const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3())
      const vertical=THREE.MathUtils.degToRad(state.camera.fov)/2
      const horizontal=Math.atan(Math.tan(vertical)*state.camera.aspect)
      const distance=(Math.max(size.y/(2*Math.tan(vertical)),size.x/(2*Math.tan(horizontal)))+size.z/2)*1.35
      if(state.camera.userData.exoSceneViewType==='orthographic'){
        // Distance alone cannot fit an orthographic camera: its projection
        // bounds must grow to include reset/off-body panels as well.
        state.camera.userData.exoSceneOrthoHalfHeight=Math.max(.1,size.y/2,size.x/(2*Math.max(.1,state.camera.aspect)))*1.35
        state.camera.updateProjectionMatrix()
      }
      const direction=state.camera.position.clone().sub(state.controls.target).normalize()
      if(direction.lengthSq()<1e-8)direction.set(0,0,1)
      state.controls.target.copy(center);state.camera.position.copy(center).addScaledVector(direction,Math.max(.15,distance))
      state.camera.lookAt(center)
      state.controls.update()
      state.renderer.domElement.dataset.cameraFitCount=String(1+Number(state.renderer.domElement.dataset.cameraFitCount||0))
    }
    window.addEventListener('exo-clothcraft-command',receive)
    window.addEventListener('exo-clothcraft-fit-camera',receive)
    return()=>{
      window.removeEventListener('exo-clothcraft-command',receive)
      window.removeEventListener('exo-clothcraft-fit-camera',receive)
    }
  },[])
  const view = (position,lookAt=[0,.96,0]) => {
    const state = sceneRef.current
    if (!state) return
    const target = new THREE.Vector3(...lookAt)
    state.controls.target.copy(target)
    state.camera.position.copy(target.clone().add(new THREE.Vector3(...position)))
    state.camera.lookAt(target)
    state.controls.update()
  }
  const frameGarment=()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-fit-camera'))
  return <div ref={host} className="cc-scene" aria-label="EXO 3D garment scene: Rust geometry, interactive transform gizmo and sewing guides">
    {analysisMode==='strain'&&<div data-strain-legend="true" style={{position:'absolute',bottom:12,left:12,zIndex:3,background:'#fff',color:'#263746',padding:8,fontSize:11}}>Principal extension · blue 0% → red 25%+ · not stress/pressure</div>}
    <ClothCraftCornerTools dimension="3d" mode={mode} onChangeMode={onChangeMode} disabled={toolsDisabled}
      cameraHandControl={<span data-camera-hand-toolbar-fallback-slot="true"/>}/>
    <div className="cc-v2-orientation" role="group" aria-label="3D viewport orientation widget">
      <strong title="World orientation">XYZ</strong>
      <button type="button" aria-pressed={showConstructionGuides} onClick={()=>setShowConstructionGuides(value=>!value)} title="Toggle approximate avatar construction references: center front/back, chest, waist and navel">Guides</button>
      <button type="button" onClick={() => view([0, .05, 3.3])} title="Front camera: looking along Z">F</button>
      <button type="button" onClick={() => view([3.3, .05, 0])} title="Right camera: looking along X">R</button>
      <button type="button" onClick={() => view([0, 3.4, .02])} title="Top camera: looking down Y">T</button>
      <button type="button" onClick={() => view([2.4, .7, 3.1])} title="Perspective orbit camera">3D</button>
      {stageId==='EXO01'&&<>
        <button type="button" onClick={() => view([0,2.5,9.0],[0,1.5,-.7])} title="View the full Stage 01 runway and avatar" aria-label="View Stage 01 runway">S</button>
        <button type="button" onClick={() => view([2.5,1.1,4.5])} title="Frame avatar at the runway standing position" aria-label="Frame avatar on stage">A</button>
        <button type="button" onClick={frameGarment} title="Fit visible garment, including off-body or reset panels" aria-label="Fit garment on stage">G</button>
      </>}
    </div>
  </div>
}

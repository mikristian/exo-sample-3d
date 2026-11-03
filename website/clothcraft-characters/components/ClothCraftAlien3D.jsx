import React,{useEffect,useRef} from 'react'
import * as THREE from 'three'
import {
  CLOTHCRAFT_CHARACTER_COLORS,
  CLOTHCRAFT_CHARACTERS,
  DEFAULT_CLOTHCRAFT_CHARACTER,
  normalizeClothCraftCharacter,
} from './characterData.js'
import './ClothCraftAlien3D.css'

// Original, fully three-dimensional mesh inspired by the silhouette and
// expression of the familiar 👽 emoji. No rasterized emoji or downloaded mesh.
const HEADS={
  stitch:{width:1,height:1,depth:1,temple:1,jaw:1},
  patch:{width:1.055,height:.965,depth:1.03,temple:1.07,jaw:.99},
  bobbin:{width:1.075,height:.955,depth:1.08,temple:1.09,jaw:1.06},
  forma:{width:.955,height:1.055,depth:.96,temple:.96,jaw:.92},
}
const EYE_COLORS={lime:'#090f13',ice:'#101f29',orchid:'#201923',amber:'#251e19'}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))

function measures(y,profile){
  const u=clamp(y/(1.43*profile.height),-1,1)
  const s=Math.sqrt(Math.max(0,1-u*u))
  const temple=1+.10*Math.max(0,u)*profile.temple
  const jaw=1-.44*Math.pow(Math.max(0,-u),1.45)*profile.jaw
  return {
    rx:Math.max(.001,1.33*profile.width*s*temple*jaw),
    rz:Math.max(.001,.94*profile.depth*s*(.96+.08*Math.max(0,u))*(1-.26*Math.pow(Math.max(0,-u),1.7))),
  }
}

// Place facial details onto the actual curved forehead, not a flat face card.
function faceZ(x,y,profile){
  const {rx,rz}=measures(y,profile)
  return rz*Math.sqrt(Math.max(.018,1-(x/rx)**2))
}

function headGeometry(profile){
  const rings=64,segments=96,vertices=[],uvs=[],indices=[]
  for(let i=0;i<=rings;i++){
    const theta=Math.PI*i/rings
    const y=1.43*profile.height*Math.cos(theta)
    const {rx,rz}=measures(y,profile)
    for(let j=0;j<=segments;j++){
      const phi=2*Math.PI*j/segments
      vertices.push(rx*Math.cos(phi),y,rz*Math.sin(phi))
      uvs.push(j/segments,1-i/rings)
      if(i<rings&&j<segments){
        const k=i*(segments+1)+j
        indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Face normals point outwards, including the seam. Handles both front and back.
  const position=geometry.getAttribute('position')
  const normal=geometry.getAttribute('normal')
  if(normal.getZ(Math.floor(rings/2)*(segments+1)+segments/4)<0){
    const ind=geometry.index
    for(let k=0;k<ind.count;k+=3){
      const b=ind.getX(k+1),c=ind.getX(k+2)
      ind.setX(k+1,c);ind.setX(k+2,b)
    }
    geometry.computeVertexNormals()
  }
  return geometry
}

function eyeOutline(){
  const shape=new THREE.Shape()
  // Apple-style long oval, softly tilted outwards, with rounded ends.
  // Deliberately taller than the previous horizontal/cartoon eye.
  shape.moveTo(.16,.44)
  shape.bezierCurveTo(.51,.44,.58,.13,.43,-.18)
  shape.bezierCurveTo(.29,-.46,.02,-.57,-.22,-.38)
  shape.bezierCurveTo(-.43,-.18,-.41,.12,-.19,.29)
  shape.bezierCurveTo(-.07,.39,.08,.44,.16,.44)
  return shape.getPoints(80)
}

function smileOutline(){
  const shape=new THREE.Shape()
  shape.moveTo(-.32,-.80)
  shape.bezierCurveTo(-.14,-.94,.13,-.94,.32,-.80)
  shape.bezierCurveTo(.20,-1.11,-.18,-1.12,-.32,-.80)
  return shape.getPoints(56)
}

// A concentric tessellation makes the eyes subtly convex like a glass-black
// lens, rather than a rectangular decal or a sphere floating off the skull.
function facePatch(points,center,profile,{reflect=false,scaleX=1,scaleY=1,bulge=.042,depth=.012}={}){
  const segments=points.length-1
  const steps=10
  const vertices=[],indices=[]
  for(let k=0;k<=steps;k++){
    const radius=k/steps
    for(let j=0;j<segments;j++){
      const [pX,pY]=[points[j].x,points[j].y]
      const x=center[0]+pX*(reflect?-1:1)*scaleX*radius
      const y=center[1]+pY*scaleY*radius
      const surface=faceZ(x,y,profile)
      const crown=bulge*(1-radius*radius)
      vertices.push(x,y,surface+depth+crown)
      if(k<steps){
        const a=k*segments+j,b=k*segments+(j+1)%segments
        const c=(k+1)*segments+j,d=(k+1)*segments+(j+1)%segments
        if(reflect){indices.push(a,b,c,b,d,c)}
        else{indices.push(a,c,b,b,c,d)}
      }
    }
  }
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  // Avoid rendering order problems from a corner viewed at steep angles.
  return geo
}

function createAlien(settings){
  const profile=HEADS[settings.character]
  const group=new THREE.Group()
  const resources=[]
  const shell=CLOTHCRAFT_CHARACTER_COLORS.find(item=>item.id===settings.color)
  const skin=new THREE.MeshPhysicalMaterial({
    color:shell.base,
    roughness:.45,
    metalness:.07,
    clearcoat:.16,
    clearcoatRoughness:.52,
    side:THREE.DoubleSide,
  })
  const head=new THREE.Mesh(headGeometry(profile),skin)
  head.name='sculpted-alien-head'
  group.add(head)
  resources.push(head.geometry,skin)
  const eyeMat=new THREE.MeshPhysicalMaterial({
    color:EYE_COLORS[settings.eyeColor],
    roughness:.14,
    metalness:.12,
    clearcoat:1,
    clearcoatRoughness:.085,
    side:THREE.DoubleSide,
  })
  const eyes=[]
  const size=settings.eyeSize==='minimal'?.72:settings.eyeSize==='balanced'?.87:1
  const ratioX=settings.eyes==='focused'?.86:1
  const ratioY=(settings.eyes==='sleepy'?.79:settings.eyes==='focused'?1.05:1)*1.16
  for(const sign of [-1,1]){
    const geometry=facePatch(eyeOutline(),[sign*.585,.10],profile,{
      reflect:sign<0,scaleX:size*ratioX,scaleY:size*ratioY,
      bulge:.052,depth:.014,
    })
    const mesh=new THREE.Mesh(geometry,eyeMat)
    mesh.name=sign<0?'left-glossy-alien-eye':'right-glossy-alien-eye'
    geometry.translate(0,-.10,0)
    mesh.position.y=.10
    group.add(mesh)
    eyes.push(mesh)
    resources.push(geometry)
  }
  resources.push(eyeMat)
  const mouthMat=new THREE.MeshPhysicalMaterial({
    color:'#182226',roughness:.49,metalness:0,side:THREE.DoubleSide,
  })
  // Normalize the mouth curve around its OWN centroid. Otherwise the radial
  // tessellation would create a spurious triangle spanning up toward the eyes.
  const mouthPoints=smileOutline().map(point=>new THREE.Vector2(point.x,point.y+.94))
  const mouthGeo=facePatch(mouthPoints,[0,-.94],profile,{bulge:.004,depth:.028})
  const mouth=new THREE.Mesh(mouthGeo,mouthMat)
  mouth.name='small-friendly-alien-smile'
  group.add(mouth)
  resources.push(mouthGeo,mouthMat)
  return {group,head,eyes,mouth,resources}
}

function staticFallback(config){
  const shell=CLOTHCRAFT_CHARACTER_COLORS.find(item=>item.id===config.color)
  return <svg viewBox="0 0 220 235" className="cc-alien-fallback" role="img" aria-label="Alien character fallback">
    <path d="M110 10C162 10 202 46 204 96C206 149 167 196 110 225C53 196 14 149 16 96C18 46 58 10 110 10Z" fill={shell.base}/>
    <ellipse cx="72" cy="111" rx="29" ry="41" transform="rotate(-32 72 111)" fill="#0b1316"/>
    <ellipse cx="148" cy="111" rx="29" ry="41" transform="rotate(32 148 111)" fill="#0b1316"/>
    <path d="M86 172Q110 192 134 172Q128 202 110 201Q92 201 86 172Z" fill="#182226"/>
  </svg>
}

export default function ClothCraftAlien3D({
  config=DEFAULT_CLOTHCRAFT_CHARACTER,mood='idle',compact=false,
  look=null,emotion='happy',audioLevelRef=null,intensity=1,
}){
  const settings=normalizeClothCraftCharacter(config)
  const holder=useRef(null)
  const webgl=useRef(null)
  const rig=useRef(null)
  const current=useRef({})
  const [failed,setFailed]=React.useState(false)
  current.current={mood,look,emotion,motion:settings.motion,audioLevelRef,intensity}

  useEffect(()=>{
    const host=holder.current
    if(!host)return
    let renderer
    try{
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:!compact,powerPreference:'default'})
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,compact?1:1.5))
      renderer.outputColorSpace=THREE.SRGBColorSpace
      renderer.toneMapping=THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure=1.02
      renderer.setClearColor(0x000000,0)
    }catch(e){
      console.warn('3D character unavailable, using accessible vector fallback',e)
      setFailed(true)
      return
    }
    webgl.current=renderer
    renderer.domElement.className='cc-alien-canvas'
    renderer.domElement.setAttribute('aria-label','Interactive 3D alien head; drag to rotate, double click to face forward')
    renderer.domElement.setAttribute('role','img')
    host.appendChild(renderer.domElement)
    const scene=new THREE.Scene()
    const camera=new THREE.OrthographicCamera(-1.98,1.98,2.05,-2.05,.1,100)
    camera.position.set(0,0,8)
    camera.lookAt(0,0,0)
    scene.add(new THREE.HemisphereLight(0xf5ffff,0x667c77,1.75))
    const key=new THREE.DirectionalLight(0xffffff,2.3)
    key.position.set(-3,5,7)
    scene.add(key)
    const fill=new THREE.DirectionalLight(0xc6f1f3,.65)
    fill.position.set(4,.5,2)
    scene.add(fill)
    const rim=new THREE.DirectionalLight(0xa0ccc6,1.2)
    rim.position.set(1,3,-5)
    scene.add(rim)
    const sculpture=createAlien(settings)
    const rigParent=new THREE.Group()
    rigParent.add(sculpture.group)
    scene.add(rigParent)
    rig.current=rigParent
    // Controlled orbit, with spring smoothing and a double-click home view.
    let yaw=0,pitch=0,targetYaw=0,targetPitch=0
    let pointer=null,dragging=false
    const onDown=e=>{
      if(compact||e.button!==0)return
      dragging=true
      pointer={x:e.clientX,y:e.clientY,yaw:targetYaw,pitch:targetPitch}
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.classList.add('is-dragging')
    }
    const onMove=e=>{
      if(!dragging||!pointer)return
      targetYaw=clamp(pointer.yaw+(e.clientX-pointer.x)*.009,-1.3,1.3)
      targetPitch=clamp(pointer.pitch+(e.clientY-pointer.y)*.006,-.52,.52)
      e.stopPropagation()
    }
    const onUp=e=>{
      dragging=false
      pointer=null
      renderer.domElement.classList.remove('is-dragging')
      if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId)
    }
    const onDoubleClick=()=>{targetYaw=0;targetPitch=0}
    renderer.domElement.addEventListener('pointerdown',onDown)
    renderer.domElement.addEventListener('pointermove',onMove)
    renderer.domElement.addEventListener('pointerup',onUp)
    renderer.domElement.addEventListener('pointercancel',onUp)
    renderer.domElement.addEventListener('dblclick',onDoubleClick)

    const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches
    const resize=()=>{
      const width=Math.max(1,Math.round(host.clientWidth))
      const height=Math.max(1,Math.round(host.clientHeight))
      renderer.setSize(width,height,false)
      const ratio=width/height
      const visibleY=compact?3.85:3.85
      camera.top=visibleY/2
      camera.bottom=-visibleY/2
      camera.left=-visibleY*ratio/2
      camera.right=visibleY*ratio/2
      camera.updateProjectionMatrix()
    }
    const observer=new ResizeObserver(resize)
    observer.observe(host)
    resize()
    let handle=0,start=performance.now(),previous=start,blink=0
    let level=0,frames=0
    const animate=(now)=>{
      const dt=Math.min(.06,(now-previous)/1000);previous=now
      const state=current.current
      level+=(clamp((state.audioLevelRef?.current||0)*(state.intensity||1),0,1)-level)*Math.min(1,dt*13)
      const t=(now-start)/1000
      const orbitLook=state.look||{x:0,y:0}
      const awake=!reduced&&state.motion&&!compact
      const idleYaw=awake?Math.sin(t*.45)*.025:0
      const idlePitch=awake?Math.cos(t*.52)*.02:0
      yaw+=(targetYaw+(dragging?0:idleYaw+(orbitLook.x||0)*.018)-yaw)*Math.min(1,dt*7)
      pitch+=(targetPitch+(dragging?0:idlePitch+(orbitLook.y||0)*-.016)-pitch)*Math.min(1,dt*7)
      rigParent.rotation.y=yaw
      rigParent.rotation.x=pitch
      // Tiny quiet conversational motion, with real Web Audio level input.
      const float=awake?Math.sin(t*1.6)*.032:0
      rigParent.position.y=float+level*.035
      const breathe=awake?Math.sin(t*1.8)*.008:0
      const pulse=level*.045
      sculpture.group.scale.set(1+breathe+pulse,1-breathe*.5-pulse*.22,1+breathe*.3+pulse*.4)
      if(!compact){
        const blinking=state.mood==='blinking'||state.emotion==='sleepy'||
          (awake&&(Math.sin(t*1.85)+Math.sin(t*2.2) > 1.988))
        blink+=( (blinking?.075:state.emotion==='surprised'?1.065:1)-blink)*Math.min(1,dt*22)
        // Blink by scaling the eye meshes along their face plane, never
        // affecting the silhouette or eye placement.
        for(const eye of sculpture.eyes)eye.scale.y=blink
        if(state.mood==='bouncing')rigParent.position.y+=Math.abs(Math.sin(t*10))*.18
        if(state.mood==='dancing')rigParent.rotation.z=Math.sin(t*10)*.085
        else if(state.mood==='waving')rigParent.rotation.z=Math.sin(t*8)*.075
        else rigParent.rotation.z=0
      }
      renderer.render(scene,camera)
      if(!compact){
        const root=host.closest('.cc-character-avatar')
        if(root){
          root.dataset.audioLevel=level.toFixed(3)
          root.dataset.renderFrames=String(++frames)
          root.dataset.rotationY=yaw.toFixed(3)
          root.dataset.rotationX=pitch.toFixed(3)
          root.dataset.pulseScale=sculpture.group.scale.x.toFixed(3)
        }
        handle=requestAnimationFrame(animate)
      }
    }
    handle=requestAnimationFrame(animate)
    return ()=>{
      cancelAnimationFrame(handle)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown',onDown)
      renderer.domElement.removeEventListener('pointermove',onMove)
      renderer.domElement.removeEventListener('pointerup',onUp)
      renderer.domElement.removeEventListener('pointercancel',onUp)
      renderer.domElement.removeEventListener('dblclick',onDoubleClick)
      for(const disposable of sculpture.resources)disposable.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      if(webgl.current===renderer)webgl.current=null
      if(rig.current===rigParent)rig.current=null
    }
  },[settings.character,settings.color,settings.eyeColor,settings.eyes,settings.eyeSize,compact])

  const name=CLOTHCRAFT_CHARACTERS.find(item=>item.id===settings.character)?.name||'Alien'
  return <div
    className={`cc-character-avatar cc-alien-3d ${compact?'cc-character-mini':''}`}
    data-character={settings.character} data-mood={mood} data-blob="true"
    data-design="alien-3d" data-3d="true" data-renderer={failed?'svg-fallback':'three-webgl'}
    data-audio-level="0" aria-label={`${name}: interactive three-dimensional alien character`}
  >
    <div className="cc-alien-canvas-host" ref={holder}/>
    {failed&&staticFallback(settings)}
  </div>
}

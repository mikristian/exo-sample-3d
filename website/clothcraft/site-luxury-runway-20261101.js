/* ClothCraft: monumental animated fashion figures circling a rotating 3D Earth.
   They share the same 3D depth buffer as the globe, so they naturally disappear
   behind its surface and re-emerge as their orbit comes around the front. */
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/three-addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/three-addons/utils/SkeletonUtils.js';
import { createEarthRenderedAvatars } from './site-earth-rendered-avatars-20261102.js';
const canvas=document.getElementById('cc-runway-canvas');
if(canvas){
 const host=canvas.parentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'high-performance'});}catch(e){host.classList.add('cc-runway-fallback')}
 if(renderer){
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#02040e');
  const camera=new THREE.PerspectiveCamera(37,1,.1,170);camera.position.set(0,.55,16.8);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0x50627d,.48));
  const sun=new THREE.DirectionalLight(0xfff2de,3.2);sun.position.set(-8,8,11);scene.add(sun);
  const cool=new THREE.DirectionalLight(0x619bd9,.47);cool.position.set(7,-2,-5);scene.add(cool);
  const globe=new THREE.Group();scene.add(globe);globe.rotation.z=-.18;
  const loader=new THREE.TextureLoader();loader.setPath('/assets/earth/');
  const diffuse=loader.load('earth_atmos_2048.jpg');diffuse.colorSpace=THREE.SRGBColorSpace;
  const normal=loader.load('earth_normal_2048.jpg');
  const spec=loader.load('earth_specular_2048.jpg');
  const city=loader.load('earth_lights_2048.png');city.colorSpace=THREE.SRGBColorSpace;
  const radius=3.82;
  const earth=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),new THREE.MeshPhongMaterial({map:diffuse,normalMap:normal,normalScale:new THREE.Vector2(.34,.34),specularMap:spec,specular:new THREE.Color('#5b819d'),shininess:17}));globe.add(earth);
  const night=new THREE.Mesh(new THREE.SphereGeometry(radius*1.002,96,64),new THREE.MeshBasicMaterial({map:city,color:0xc9ac7e,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false}));globe.add(night);
  const cloudTexture=loader.load('earth_atmos_2048.jpg');
  const air=new THREE.Mesh(new THREE.SphereGeometry(radius*1.033,64,44),new THREE.MeshPhongMaterial({color:'#88b5db',transparent:true,opacity:.055,side:THREE.FrontSide,depthWrite:false,blending:THREE.AdditiveBlending}));globe.add(air);
  const haloMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,uniforms:{glowColor:{value:new THREE.Color('#4688bb')}},vertexShader:`varying vec3 vNormal;varying vec3 vEye;void main(){vec4 pos=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vEye=normalize(-pos.xyz);gl_Position=projectionMatrix*pos;}`,fragmentShader:`uniform vec3 glowColor;varying vec3 vNormal;varying vec3 vEye;void main(){float fres=pow(1.-max(0.,dot(normalize(vNormal),normalize(vEye))),4.);gl_FragColor=vec4(glowColor,fres*.23);}`});
  const aura=new THREE.Mesh(new THREE.SphereGeometry(radius*1.09,64,44),haloMaterial);globe.add(aura);
  // Depth-separated star field with mild atmospheric dust and no cartoon glow.
  function seeded(n){const v=Math.sin(n*143.192+7.53)*13758.545;return v-Math.floor(v)}
  const starCount=3800,starPositions=new Float32Array(starCount*3),starColors=new Float32Array(starCount*3);
  for(let i=0;i<starCount;i++){const a=seeded(i*3)*Math.PI*2,b=Math.acos(2*seeded(i*3+1)-1),r=25+seeded(i*3+2)*89;starPositions[i*3]=Math.cos(a)*Math.sin(b)*r;starPositions[i*3+1]=Math.cos(b)*r;starPositions[i*3+2]=Math.sin(a)*Math.sin(b)*r;const c=.48+seeded(i*7+2)*.52;starColors[i*3]=c;starColors[i*3+1]=c*.97;starColors[i*3+2]=Math.min(1,c*1.14)}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new THREE.BufferAttribute(starColors,3));
  const starMesh=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:.12,vertexColors:true,transparent:true,opacity:.86,sizeAttenuation:true,depthWrite:false}));scene.add(starMesh);
  const mat=(color,metalness=.05,roughness=.81)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
  const couture=[
    {coat:0x1a1b20,accent:0x5f6065,lower:0x131318,skin:0x967f70,type:'coat'},
    {coat:0xd8d1c7,accent:0xada69e,lower:0x434046,skin:0xb39a86,type:'dress'},
    {coat:0x615a61,accent:0xb8aeb2,lower:0x17171a,skin:0x8b695a,type:'cape'},
    {coat:0xb4a590,accent:0xddd4c5,lower:0x242327,skin:0x9b8276,type:'dress'},
    {coat:0x292d2f,accent:0x777a7b,lower:0x13171a,skin:0x9b8071,type:'coat'},
    {coat:0x5f5e61,accent:0x929497,lower:0x212124,skin:0xa48b79,type:'cape'},
    {coat:0x1f1b20,accent:0x6b6068,lower:0x242025,skin:0xc4ab9b,type:'coat'},
    {coat:0xd3c7b3,accent:0x887d76,lower:0x332e30,skin:0x967d6a,type:'dress'}
  ];
  const makeCylinder=(r1,r2,h,m)=>new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,12),m);
  function makePerson(n){const f=couture[n%couture.length],garment=mat(f.coat,.13,.7),detail=mat(f.accent,.2,.59),lower=mat(f.lower),skin=mat(f.skin),boots=mat(0x0f1012,.3,.5),hair=mat(n%2?0x251d1b:0x111319),root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
   const coat=makeCylinder(f.type==='dress'?.28:.32,f.type==='cape'?.48:.22,.66,garment);coat.position.y=.82;rig.add(coat);
   const shoulders=new THREE.Mesh(new THREE.BoxGeometry(f.type==='coat'?.88:.7,.16,.27),garment);shoulders.position.y=1.13;rig.add(shoulders);
   if(f.type==='dress'){const skirt=makeCylinder(.34,.15,.7,garment);skirt.position.y=.18;rig.add(skirt)}
   if(f.type==='cape'){const cape=makeCylinder(.57,.34,.99,garment);cape.position.y=.53;rig.add(cape)}
   if(f.type==='coat'){const panel=new THREE.Mesh(new THREE.BoxGeometry(.10,.92,.023),detail);panel.position.set(-.10,.66,.30);panel.rotation.z=-.085;rig.add(panel)}
   const neck=makeCylinder(.065,.069,.18,skin);neck.position.y=1.24;rig.add(neck);
   const head=new THREE.Mesh(new THREE.SphereGeometry(.16,18,12),skin);head.scale.set(.82,1.2,.85);head.position.y=1.48;rig.add(head);
   const cap=new THREE.Mesh(new THREE.SphereGeometry(.165,18,12),hair);cap.scale.set(.84,.5,.87);cap.position.y=1.59;rig.add(cap);
   const arms=[],legs=[];
   for(let side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.41,1.09,0);const sleeve=makeCylinder(.085,.115,.62,garment);sleeve.position.y=-.31;arm.add(sleeve);const hand=new THREE.Mesh(new THREE.SphereGeometry(.055,12,9),skin);hand.position.y=-.66;arm.add(hand);rig.add(arm);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.16,.40,0);const thigh=makeCylinder(.105,.12,.69,lower);thigh.position.y=-.35;leg.add(thigh);const boot=new THREE.Mesh(new THREE.BoxGeometry(.18,.13,.33),boots);boot.position.set(0,-.73,.06);leg.add(boot);rig.add(leg);legs.push(leg)}
   // Fallback figure uses the same tall orbiting runway carrier as the GLB.
   // Procedural figures are only a fallback for a failed 3D avatar load.
   const scale=[3.85,4.45,4.1,4.25][n];rig.scale.setScalar(scale);
   return {root,rig,arms,legs,offset:[1.17,2.73,4.32,5.86][n],latitude:[.08,-.12,.10,-.08][n],scale};
  }
  // Four large figures instead of a ring of eight tiny avatars. Their evenly
  // spaced starts guarantee some are in front and others behind the globe.
  const FIGURE_COUNT=4,EARTH_SPIN=.082,ORBIT_WALK=.021;
  const ORBIT_PHASES=[.55,2.35,4.20,5.45];
  const ORBIT_LATITUDES=[.08,-.12,.10,-.08];
  const FIGURE_HEIGHTS=[6.25,6.85,6.5,6.4]; // Earth diameter: 7.64 units
  const people=Array.from({length:FIGURE_COUNT},(_,i)=>makePerson(i));
  const renderedFrameMode=new URLSearchParams(location.search).get('avatarRender')==='frames';
  // The Academic CLO Thomas research mesh must NEVER enter the normal
  // published assets. A separate explicit loopback-only server may supply it
  // for inspection; on any real website this option is inert and CLO-free.
  const privateCloPreview=!renderedFrameMode&&new URLSearchParams(location.search).get('avatarSource')==='clo-private'&&
    location.hostname==='127.0.0.1'&&['8100','8377'].includes(location.port)&&location.protocol==='http:';
  canvas.dataset.cloPrivatePreview=privateCloPreview?'requested':'disabled';
  if(privateCloPreview){
    host.dataset.cloResearchOnly='true';
    // Keep the demonstration globe free of the large private-research overlay.
    // CLO's required attribution still belongs on the local preview page.
    const footer=document.querySelector('footer');
    const credit=document.createElement('div');
    credit.textContent='CLO Virtual Fashion, Inc. owns all rights to the avatar displayed';
    credit.dataset.cloPreviewAttribution='true';
    credit.style.cssText='display:table;margin:12px 0 0;padding:4px 7px;background:#fff;color:#323236;font:10pt "Avenir Next",sans-serif;letter-spacing:normal';
    (footer||document.body).appendChild(credit);
  }
  canvas.dataset.avatarRenderMode=renderedFrameMode?'frames':'glb';
  // Prefer an actual skinned humanoid with native glTF Walk clip over the
  // primitive geometry fallback. CLO Tomas itself is proprietary and not bundled.
  // Asset contract: each GLB contains a dressed skinned avatar and an in-place
  // walk clip. A missing or malformed asset falls back only for its own slot.
  const defaultGarmentAssets=[
    {url:new URL('./assets/fashion-avatars/garment-v1/EXO_masculine_cc0_distincthead_20261102.glb',import.meta.url).href,kind:'denim-shirt'},
    {url:new URL('./assets/fashion-avatars/garment-v1/EXO_feminine_cc0_distincthead_20261102.glb',import.meta.url).href,kind:'dress'}
  ];
  const garmentAssets=privateCloPreview?[
    // This URL resolves ONLY in an explicitly started, loopback-bound private
    // research server. No CLO file lives in this website/public directory.
    {url:new URL('/__exo_local_clo_research__/thomas-walk.glb',location.origin).href,kind:'denim-shirt',isPrivateClo:true},
    defaultGarmentAssets[1]
  ]:defaultGarmentAssets;
  const colorways=['#c2c6cc','#b7a19e','#48556b','#e1d5c5'];
  const mixers=[],loadedPeople=Array(FIGURE_COUNT).fill(null),loadFigure=new GLTFLoader();
  canvas.dataset.avatarOutfits='denim-shirt,dress,denim-shirt,dress';
  canvas.dataset.renderedFigures=String(FIGURE_COUNT);
  const setSourceStatus=()=>{
    const count=loadedPeople.filter(Boolean).length;
    const privateCount=loadedPeople.filter(p=>p?.privateClo).length;
    canvas.dataset.avatarSource=privateCloPreview?(privateCount?'private-clo-thomas-mixed':'private-clo-preview-fallback'):
      count===4?'clothed-glb':count?'mixed-clothed-fallback':'procedural-fallback';
    canvas.dataset.cloPrivateFigures=String(privateCount);
    if(privateCloPreview)canvas.dataset.cloPrivatePreview=privateCount?'loaded':'unavailable';
    canvas.dataset.clothedCount=String(count);canvas.dataset.garmentSkinnedCount=String(count);
  };
  const skipRootMotion=(clip,source)=>{
    // Reject tracks that move or scale a scene/root node; skeleton rotations
    // are preserved. This stops baked travel from shifting the orbital carrier.
    const rootNames=new Set([source.name,...source.children.filter(c=>!c.isBone).map(c=>c.name)]);
    return new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.filter(track=>{
      const marker=track.name.lastIndexOf('.');
      if(marker<0)return true;
      const name=track.name.slice(0,marker),property=track.name.slice(marker+1);
      return !((property==='position'||property==='scale')&&(name==='.'||rootNames.has(name)||name==='root'||name.endsWith('/root')));
    }));
  };
  function installClothedFigure(gltf,i,{privateClo=false}={}){
    if(!gltf?.scene)return false;
    const clip=gltf.animations?.find(c=>/walk|runway|stride/i.test(c.name))||gltf.animations?.[0];
    let hasSkin=false;gltf.scene.traverse(obj=>{if(obj.isSkinnedMesh)hasSkin=true});
    if(!clip||!hasSkin)return false;
    const source=cloneSkeleton(gltf.scene),root=new THREE.Group(),normalizer=new THREE.Group();
    root.add(normalizer);normalizer.add(source);
    source.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.castShadow=false;obj.receiveShadow=false;
      obj.material=(Array.isArray(obj.material)?obj.material:[obj.material]).map(material=>{
        const m=material.clone();
        // Preserve skin and detailed fabric textures; adjust clothing materials only.
        const name=(obj.name+' '+material.name).toLowerCase();
        if(m.color&&/shirt|denim|jean|dress|fabric|garment|skirt|trouser|pants/i.test(name))m.color.lerp(new THREE.Color(colorways[i]),.22);
        return m;
      });
      if(obj.material.length===1)obj.material=obj.material[0];
    });
    const mixer=new THREE.AnimationMixer(source),action=mixer.clipAction(skipRootMotion(clip,source));
    action.setEffectiveTimeScale(.75);action.play();mixer.update(.02+i*.19);
    source.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(source),size=new THREE.Vector3();box.getSize(size);
    const extent=Math.max(size.y,.001);
    if(!Number.isFinite(extent)||extent<.1||extent>10000){mixer.stopAllAction();return false}
    root.scale.setScalar(FIGURE_HEIGHTS[i]/extent);
    normalizer.position.set(-(box.min.x+box.max.x)*.5,-box.min.y,-(box.min.z+box.max.z)*.5);
    globe.remove(people[i].root);globe.add(root);
    loadedPeople[i]={root,offset:ORBIT_PHASES[i],latitude:ORBIT_LATITUDES[i],index:i,height:FIGURE_HEIGHTS[i],privateClo};
    mixers[i]=mixer;
    setSourceStatus();return true;
  }
  people.forEach(p=>globe.add(p.root));
  canvas.dataset.avatarSource='procedural-fallback';canvas.dataset.clothedCount='0';canvas.dataset.garmentSkinnedCount='0';
  const canLoad=()=>!reduce.matches&&!document.hidden;
  const requestGarments=()=>{
    if(canvas.dataset.assetRequestStarted||!canLoad())return;
    canvas.dataset.assetRequestStarted='true';
    const requestModels=assets=>assets.forEach((asset,assetIndex)=>loadFigure.load(asset.url,gltf=>{
      for(let i=assetIndex;i<FIGURE_COUNT;i+=assets.length)installClothedFigure(gltf,i,{privateClo:asset.isPrivateClo===true});
      setSourceStatus();
    },undefined,()=>setSourceStatus()));
    if(!privateCloPreview){requestModels(garmentAssets);return}
    // The separate loopback server must affirm this is an unlicensed local
    // research inspection. A generic public server can never return this
    // manifest, and is never allowed to load proprietary avatar geometry.
    fetch('/__exo_local_clo_research__/manifest.json',{credentials:'same-origin',cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('Private CLO inspection server missing');return r.json()})
      .then(manifest=>{
        if(manifest.schema!=='exo.private-clo-earth-research.v1'||manifest.localResearchOnly!==true||
          manifest.publicWebsiteAuthorized!==false||manifest.feminineCloModelAvailable!==false||
          manifest.garmentVisualApproved!==false||manifest.thomasUrl!=='/__exo_local_clo_research__/thomas-walk.glb')
          throw new Error('Private research status not verified');
        canvas.dataset.cloPrivatePreview='verified-local-research';
        requestModels(garmentAssets);
      }).catch(()=>{
        canvas.dataset.cloPrivatePreview='blocked-no-private-server';
        // Refuse to fetch CLO geometry if the private license/provenance
        // marker is unavailable; use existing legal CC0 avatars instead.
        requestModels(defaultGarmentAssets);
      });
  };
  const walkRadius=radius*1.13,walkUp=new THREE.Vector3(0,1,0);
  const renderedAvatars=renderedFrameMode?createEarthRenderedAvatars({THREE,globe,camera,canvas,people,phases:ORBIT_PHASES,latitudes:ORBIT_LATITUDES,heights:FIGURE_HEIGHTS,walkRadius,orbitWalk:ORBIT_WALK}):null;
  canvas.dataset.loadedRenderedFigures='0';
  const clock=new THREE.Clock();let frame=0,visible=true,elapsed=0;
  function positionPeople(t){
    for(let i=0;i<FIGURE_COUNT;i++){
      if(renderedAvatars&&people[i].root.parent!==globe)continue;
      const p=loadedPeople[i]||people[i];
      // Earth and walkers orbit in the same direction. The small extra angle
      // is the travel made by each animated gait relative to the rotating land.
      const angle=p.offset+t*ORBIT_WALK;
      // Unlike miniature people standing radially on a planet, these
      // monumental runway figures stay upright. Their feet orbit at
      // globe height, their faces turn along the orbital walking direction,
      // and the actual Earth mesh hides their bodies while they pass behind.
      const height=p.height||1.7*p.scale;
      p.root.position.set(Math.sin(angle)*walkRadius, -height*.49+p.latitude*.6,Math.cos(angle)*walkRadius);
      p.root.quaternion.setFromAxisAngle(walkUp,angle+Math.PI/2);
      if(!loadedPeople[i]){
        const stride=t*3.4+i*1.2;p.legs[0].rotation.x=Math.sin(stride)*.47;p.legs[1].rotation.x=-Math.sin(stride)*.47;
        p.arms[0].rotation.x=-Math.sin(stride)*.36;p.arms[1].rotation.x=Math.sin(stride)*.36;
        p.rig.position.y=Math.abs(Math.sin(stride))*.024;
      }
    }
    renderedAvatars?.update(t);
  }
  function resize(){
    const r=host.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);
    camera.aspect=r.width/Math.max(1,r.height);
    // On phones keep the larger models and globe in the camera's field of view
    // instead of clipping most of each orbit at the narrow viewport edges.
    camera.position.z=camera.aspect<.85?Math.min(29,16.8*.85/camera.aspect):16.8;
    camera.updateProjectionMatrix();
  }
  function draw(){frame=0;if(!visible)return;const dt=Math.min(clock.getDelta(),.045);if(!reduce.matches)elapsed+=dt;
   globe.rotation.y=elapsed*EARTH_SPIN-.23;for(const mixer of mixers)if(mixer)mixer.update(reduce.matches?0:dt);positionPeople(elapsed);starMesh.rotation.y=elapsed*.003;
   renderer.render(scene,camera);
   if(!reduce.matches&&document.visibilityState==='visible')frame=requestAnimationFrame(draw)}
  const requestAvatarAssets=()=>renderedAvatars?renderedAvatars.request():requestGarments();
  const observer=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible){requestAvatarAssets();clock.getDelta();if(!frame)frame=requestAnimationFrame(draw)}else if(frame){cancelAnimationFrame(frame);frame=0}},{threshold:.01});observer.observe(host);
  addEventListener('resize',()=>{resize();if(visible&&!frame)frame=requestAnimationFrame(draw)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible){requestAvatarAssets();if(!frame)frame=requestAnimationFrame(draw)}});
  reduce.addEventListener?.('change',()=>{if(!reduce.matches&&visible)requestAvatarAssets();if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(draw)});
  canvas.dataset.avatarCount=String(FIGURE_COUNT);
  canvas.dataset.avatarAnimation='Walk';
  canvas.dataset.avatarSource='procedural-fallback';
  canvas.dataset.orbitDirection='with-earth';
  canvas.dataset.earthSpin=String(EARTH_SPIN);
  canvas.dataset.orbitWalk=String(ORBIT_WALK);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(frame)cancelAnimationFrame(frame);frame=0;visible=false;host.classList.add('cc-runway-fallback');canvas.dataset.renderStatus='context-lost'});
  canvas.addEventListener('webglcontextrestored',()=>{host.classList.remove('cc-runway-fallback');canvas.dataset.renderStatus='restored';visible=true;resize();frame=requestAnimationFrame(draw)});
  resize();positionPeople(0);frame=requestAnimationFrame(draw);
 }
}

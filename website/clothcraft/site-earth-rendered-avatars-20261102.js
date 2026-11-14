/* Optional CC0 rendered-avatar sprites for the existing Earth scene.
   Frames are transparent images applied to real scene meshes, so Earth's
   depth buffer naturally covers figures on the far side of their orbit.
   The manifest is supplied by the independent CC0 media build. */
export function createEarthRenderedAvatars({THREE,globe,camera,canvas,people,phases,latitudes,heights,walkRadius,orbitWalk}){
  const count=people.length,figures=Array(count).fill(null);
  const state={ready:0,failed:0};
  canvas.dataset.loadedRenderedFigures='0';
  const manifestURL=new URL('./assets/fashion-avatars/rendered-cc0-proof-20261102/manifest.json',import.meta.url);
  const number=(v,fallback)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):fallback;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function parseVariant(source,base){
    if(!source||typeof source!=='object')return null;
    const file=source.url||source.src||source.atlas||source.file;
    if(typeof file!=='string'||!file||/^(?:data:|blob:|javascript:)/i.test(file))return null;
    const url=new URL(file,base);
    if(url.origin!==location.origin||!/^https?:$/.test(url.protocol)||!(/\.png$|\.webp$/i).test(url.pathname))return null;
    const columns=clamp(Math.floor(number(source.columns||source.cols,1)),1,64);
    const rows=clamp(Math.floor(number(source.rows,1)),1,64);
    return {url:url.href,columns,rows,frames:clamp(Math.floor(number(source.framesPerDirection||source.frames||source.frameCount,columns)),1,columns),fps:clamp(number(source.fps,12),1,60),facing:source.facing||'forward'};
  }
  function decodeManifest(raw){
    const entries=raw?.variants||raw?.avatars||raw?.figures||(raw?.models?.masculine&&raw?.models?.feminine?[raw.models.masculine,raw.models.feminine]:raw?.models);
    if(!Array.isArray(entries)||entries.length<2)return [];
    return entries.slice(0,2).map(entry=>{
      const front=parseVariant(entry.front||entry.forward||entry,manifestURL);
      const back=parseVariant(entry.back||entry.reverse||entry,manifestURL);
      return front?{front,back}:null;
    });
  }
  const loadImage=url=>new Promise((resolve,reject)=>{
    const image=new Image();image.decoding='async';image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('Atlas image failed'));image.src=url;
  });
  async function loadAtlas(variant){
    const image=await loadImage(variant.url);
    if(image.width<variant.columns||image.height<variant.rows)throw new Error('Invalid atlas size');
    return {...variant,image,width:image.width/variant.columns,height:image.height/variant.rows};
  }
  async function makeFigure(index,entry){
    const front=await loadAtlas(entry.front);
    let back=null;
    if(entry.back){try{back=await loadAtlas(entry.back)}catch{ /* Front remains usable. */ }}
    const surface=document.createElement('canvas');surface.width=Math.ceil(front.width);surface.height=Math.ceil(front.height);
    const ctx=surface.getContext('2d');if(!ctx)throw new Error('Missing canvas context');
    const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
    texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
    const aspect=clamp(front.width/front.height,.12,2);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.065,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false});
    const root=new THREE.Group();const mesh=new THREE.Mesh(new THREE.PlaneGeometry(heights[index]*aspect,heights[index]),material);
    mesh.position.y=heights[index]*.5;root.add(mesh);
    figures[index]={root,mesh,texture,ctx,surface,front,back,frame:-1,variant:null,index};
    globe.add(root);globe.remove(people[index].root);
    state.ready++;canvas.dataset.loadedRenderedFigures=String(state.ready);
    canvas.dataset.avatarSource=state.ready===count?'cc0-rendered-frames':'mixed-cc0-rendered-fallback';
  }
  function update(time){
    globe.updateWorldMatrix(true,false);
    const cameraWorld=camera.getWorldPosition(new THREE.Vector3());
    for(const f of figures){if(!f)continue;
      const angle=phases[f.index]+time*orbitWalk;
      f.root.position.set(Math.sin(angle)*walkRadius,-heights[f.index]*.49+latitudes[f.index]*.6,Math.cos(angle)*walkRadius);
      // Planes face the scene camera and choose a facing atlas based on orbital heading.
      const localCamera=globe.worldToLocal(cameraWorld.clone());
      f.root.lookAt(cameraWorld);
      const heading=angle+Math.PI/2;
      const cameraAngle=Math.atan2(localCamera.x-f.root.position.x,localCamera.z-f.root.position.z);
      const relative=((cameraAngle-heading)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      const direction=Math.round(relative/(Math.PI/2))%4;
      const fromBack=direction===2;
      const atlas=(fromBack&&f.back)||f.front;
      f.mesh.scale.x=fromBack&&!f.back?-1:1;
      const frame=Math.floor(time*atlas.fps+f.index*2)%atlas.frames;
      const row=atlas.rows>=4?direction%atlas.rows:0;
      const frameKey=row*atlas.columns+frame;
      if(frameKey!==f.frame||atlas!==f.variant){
        const column=frame%atlas.columns;
        f.ctx.clearRect(0,0,f.surface.width,f.surface.height);
        f.ctx.drawImage(atlas.image,column*atlas.width,row*atlas.height,atlas.width,atlas.height,0,0,f.surface.width,f.surface.height);
        f.texture.needsUpdate=true;f.frame=frameKey;f.variant=atlas;
      }
    }
  }
  let started=false;
  async function request(){
    if(started||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    started=true;canvas.dataset.assetRequestStarted='true';
    try{
      const response=await fetch(manifestURL,{credentials:'same-origin'});
      if(!response.ok)throw new Error('Frame manifest unavailable');
      const manifest=await response.json();
      if(manifest.license!=='CC0'||manifest.sourceKind!=='original-cc0'||manifest.commercialSourceAuthorized!==true||manifest.renderedOnly!==true)throw new Error('Unapproved render source');
      const variants=decodeManifest(manifest);
      if(variants.length<2||variants.some(v=>!v))throw new Error('Invalid frame manifest');
      await Promise.all(Array.from({length:count},async(_,i)=>{
        try{await makeFigure(i,variants[i%variants.length])}catch{state.failed++}
      }));
    }catch{state.failed=count}
    canvas.dataset.renderedFrameStatus=state.ready===count?'ready':state.ready?'partial':'fallback';
  }
  return {request,update};
}

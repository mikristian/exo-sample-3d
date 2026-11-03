/* Original zero-dependency canvas Earth: spherical mapping, Lambert shading,
   procedural land/ocean colors, atmosphere and galaxy star field. */
(()=>{
 const canvas=document.getElementById('cc-earth-space-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){document.querySelector('.cc-earth-fallback')?.style.setProperty('display','block');return}
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');const host=canvas.closest('.cc-hero-space');let W=0,H=0,ratio=1,frame=0,last=0,phase=0,active=true;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const sin=Math.sin,cos=Math.cos,PI=Math.PI;
 const rnd=n=>{const v=sin(n*127.1+78.233)*43758.5453;return v-Math.floor(v)};
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
 const noise=(x,y)=>{let ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=rnd(ix*137+iy*179),b=rnd((ix+1)*137+iy*179),c=rnd(ix*137+(iy+1)*179),d=rnd((ix+1)*137+(iy+1)*179);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy};
 const land=(lat,lon)=>{
   const x=lon*1.4,y=lat*1.4;
   const broad=noise(x*1.9+7,y*1.9+3)*.55+noise(x*4.2-6,y*4.2+9)*.28+noise(x*9.7+3,y*9.7+4)*.17;
   const continents=sin(lon*2.6+sin(lat*3)*1.5)*.055+cos(lat*3.8+lon*.8)*.045;
   return broad+continents;
 };
 // Precompute a coherent animated spherical texture; render an Earth disk as an ImageData.
 const disk=document.createElement('canvas');disk.width=440;disk.height=440;const dctx=disk.getContext('2d',{willReadFrequently:true});
 const seedStars=Array.from({length:420},(_,i)=>({x:rnd(i*3+.1),y:rnd(i*3+.3),r:.35+rnd(i*3+.8)*1.45,a:.13+rnd(i*3+1.2)*.75,tw:rnd(i*3+1.5)*PI*2}));
 function resize(){const rect=host.getBoundingClientRect();W=Math.max(1,Math.round(rect.width));H=Math.max(1,Math.round(rect.height));ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0)}
 function sphere(t){const n=disk.width,img=dctx.createImageData(n,n),arr=img.data;const rot=t*.18;for(let y=0;y<n;y++){const sy=1-2*(y+.5)/n;for(let x=0;x<n;x++){const sx=2*(x+.5)/n-1;const d=sx*sx+sy*sy;if(d>1)continue;const z=Math.sqrt(1-d);const lat=Math.asin(sy),lon=Math.atan2(sx,z)+rot;const v=land(lat,lon),isLand=v>.505;const polar=smooth(1.05,1.42,Math.abs(lat));const latWarm=1-Math.abs(lat)/(PI/2);let r,g,b;
 if(isLand){const m=clamp((v-.48)*3);r=57+46*m+20*(1-latWarm);g=83+39*m;b=56+19*m;const dry=noise(lon*8+34,lat*8-7)>.64;if(dry){r+=27;g+=18;b+=9}}
 else{const sea=noise(lon*5+9,lat*5+2);r=8+sea*12;g=29+sea*24;b=59+sea*43}
 r=r*(1-polar)+218*polar;g=g*(1-polar)+228*polar;b=b*(1-polar)+233*polar;
 const light=clamp(.16+Math.max(0,sx*-.48+sy*.28+z*.59)*.88,.09,1.1);const atmosphere=.16*Math.pow(1-z,2.5);const k=(y*n+x)*4;arr[k]=clamp(r*light+55*atmosphere,0,255);arr[k+1]=clamp(g*light+138*atmosphere,0,255);arr[k+2]=clamp(b*light+185*atmosphere,0,255);arr[k+3]=Math.round(255*clamp(smooth(0,.12,z)))}}
 dctx.putImageData(img,0,0)}
 function draw(now){if(!active)return;frame=0;if(!W||!H)resize();const dt=last?Math.min(now-last,80):16;last=now;if(!reduce.matches)phase+=dt/1000;
 ctx.clearRect(0,0,W,H);const bg=ctx.createRadialGradient(W*.51,H*.49,12,W*.52,H*.48,Math.max(W,H)*.65);bg.addColorStop(0,'#121c35');bg.addColorStop(.43,'#0b1225');bg.addColorStop(1,'#06080e');ctx.globalAlpha=.76;ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
 // Wide nebula washes stay behind the Earth and the original hero foreground.
 for(const [x,y,rgb,size] of [[.29,.35,'103,66,145',.34],[.74,.56,'48,85,143',.38],[.48,.85,'59,104,106',.29]]){const g=ctx.createRadialGradient(W*x,H*y,0,W*x,H*y,W*size);g.addColorStop(0,`rgba(${rgb},.12)`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 seedStars.forEach((s,i)=>{const px=s.x*W,py=s.y*H;const tw=.83+.17*sin(phase*.55+s.tw);ctx.fillStyle=`rgba(226,234,255,${(s.a*tw).toFixed(3)})`;ctx.beginPath();ctx.arc(px,py,s.r,0,2*PI);ctx.fill();if(i%37===0){ctx.fillStyle=`rgba(166,201,255,${(.13*tw).toFixed(3)})`;ctx.beginPath();ctx.arc(px,py,s.r*3,0,2*PI);ctx.fill()}});
 const radius=Math.min(W*.215,H*.285),cx=W*.5,cy=H*.50;
 const halo=ctx.createRadialGradient(cx,cy,radius*.83,cx,cy,radius*1.33);halo.addColorStop(0,'rgba(72,169,217,.24)');halo.addColorStop(.65,'rgba(35,98,161,.12)');halo.addColorStop(1,'rgba(35,98,161,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,radius*1.33,0,PI*2);ctx.fill();
 sphere(phase);ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,PI*2);ctx.clip();ctx.drawImage(disk,cx-radius,cy-radius,radius*2,radius*2);ctx.restore();
 const rim=ctx.createRadialGradient(cx-radius*.25,cy-radius*.27,radius*.3,cx,cy,radius*1.02);rim.addColorStop(.55,'rgba(50,139,203,0)');rim.addColorStop(.92,'rgba(67,171,226,.035)');rim.addColorStop(1,'rgba(106,196,239,.38)');ctx.fillStyle=rim;ctx.beginPath();ctx.arc(cx,cy,radius,0,2*PI);ctx.fill();
 if(!reduce.matches&&document.visibilityState==='visible')frame=requestAnimationFrame(draw)
 }
 function start(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(draw)}
 const observer=new IntersectionObserver(entries=>{active=entries[0]?.isIntersecting??false;if(active)start();else if(frame){cancelAnimationFrame(frame);frame=0}},{threshold:.01});observer.observe(host);
 addEventListener('resize',()=>{resize();start()},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&active)start()});reduce.addEventListener?.('change',()=>start());resize();start();
})();

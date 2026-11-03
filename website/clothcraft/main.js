const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js-enabled');
const clamp=(min,n,max)=>Math.max(min,Math.min(max,n));
const reveals=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});reveals.forEach(el=>observer.observe(el));}
else reveals.forEach(el=>el.classList.add('visible'));

// Responsive navigation. Keep actual menu icon markup intact for the CSS animation.
const header=document.querySelector('.header');
const nav=document.querySelector('#nav');
const menu=document.querySelector('.menu');
function closeNav(){nav.classList.remove('active');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation menu')}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('active');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu')});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeNav));
const mainDropdowns=[...nav.querySelectorAll('.nav-dropdown')];
mainDropdowns.forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)mainDropdowns.forEach(other=>{if(other!==detail)other.open=false})}));
document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target))mainDropdowns.forEach(detail=>detail.open=false)});

// Small but useful navigation cue; keep the active section visible without intrusive effects.
const primaryLinks=[...nav.querySelectorAll('a[href^="#"]')];
const observedSections=primaryLinks.map(a=>({link:a,section:document.querySelector(a.getAttribute('href'))})).filter(i=>i.section);
const sectionObserver=new IntersectionObserver(entries=>{
  const intersecting=entries.filter(e=>e.isIntersecting);
  if(!intersecting.length)return;
  intersecting.sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
  primaryLinks.forEach(a=>a.removeAttribute('aria-current'));
  const active=observedSections.find(x=>x.section===intersecting[0].target);
  if(active)active.link.setAttribute('aria-current','location');
},{rootMargin:'-24% 0px -58% 0px',threshold:0});
observedSections.forEach(item=>sectionObserver.observe(item.section));

document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeNav();mainDropdowns.forEach(detail=>detail.open=false)}});

// Scroll-driven 3D tilt/straighten. Read scroll once per frame and manipulate only compositor-friendly CSS properties.
const hero=document.querySelector('.hero');
const tilted=document.querySelector('#tilt-stage');
const heroCopy=document.querySelector('.hero-copy');
// Opening wordmark: each letter travels from the hero title toward the right-side ruler.
const brandReveal=document.getElementById('cc-brand-reveal');
const brandRevealTitle=document.getElementById('cc-brand-reveal-title');
// The sliced sprite is the actual supplied ClothCraft SVG. Each letter keeps
// the existing scroll-to-ruler choreography without rendering a substitute font.
const brandSvgWidth=1116.8573907, brandSvgHeight=106.0839311;
const brandGlyphCuts=[0,116,202,315,417,545,676,790,919,1013,brandSvgWidth];
const brandLetters=brandGlyphCuts.slice(0,-1).map((start,index)=>{
 const el=document.createElement('span');
 el.className='cc-brand-letter';
 el.setAttribute('aria-hidden','true');
 el.style.setProperty('--glyph',index);
 return el;
});
brandRevealTitle.replaceChildren(...brandLetters);
brandRevealTitle.setAttribute('role','img');
brandRevealTitle.setAttribute('aria-label','ClothCraft');
let brandLayout=null;
function measureBrand(){
 if(!brandReveal||!brandLetters.length)return;
 const width=brandRevealTitle.getBoundingClientRect().width;
 const height=width*brandSvgHeight/brandSvgWidth;
 brandLetters.forEach((el,i)=>{
   const left=brandGlyphCuts[i], right=brandGlyphCuts[i+1];
   el.style.width=`${((right-left)/brandSvgWidth*width).toFixed(3)}px`;
   el.style.height=`${height.toFixed(3)}px`;
   el.style.backgroundSize=`${width.toFixed(3)}px ${height.toFixed(3)}px`;
   el.style.backgroundPosition=`-${(left/brandSvgWidth*width).toFixed(3)}px 0`;
 });
 const word=brandRevealTitle.getBoundingClientRect();
 brandLayout={top:word.top,left:word.left,height:word.height,right:word.right,glyphs:brandLetters.map(el=>el.getBoundingClientRect())};
}
function paintBrand(){
 if(!brandLayout||!brandReveal)return;
 const total=Math.max(1,hero.offsetHeight-innerHeight);
 const start=Math.max(0,hero.getBoundingClientRect().top+scrollY);
 const progress=clamp(0,(scrollY-start)/(Math.max(1,total*.76)),1);
 const ease=x=>x*x*(3-2*x);
 const end=clamp(0,(progress-.17)/.56,1);
 brandReveal.style.setProperty('--brand-progress',progress.toFixed(5));
 brandReveal.style.setProperty('--brand-opacity',reducedMotion?'1':String((1-ease(clamp(0,(progress-(innerWidth>1150?.45:.66))/.34,1))).toFixed(4)));
 const railTitle=document.querySelector('.cc-measure-chapter[data-chapter="0"] .cc-chapter-name');
 const railBounds=railTitle?.getBoundingClientRect();
 const hasRail=innerWidth>1150&&railBounds&&railBounds.width>0;
 const railTargetX=hasRail?railBounds.right-railBounds.width*.40:innerWidth-30;
 const railTargetY=hasRail?railBounds.top+railBounds.height*.5:innerHeight*.22;
 // Glyphs are sliced from the real SVG, then arrive independently at the
 // rail's existing wordmark. Rotation happens after the lateral translation
 // begins, so the large logo reads as an actual folding word rather than a fade.
 const glyphCount=brandLetters.length;
 for(let i=0;i<glyphCount;i++){
   const el=brandLetters[i],rect=brandLayout.glyphs[i];
   const stagger=i*.030;
   const local=reducedMotion||!hasRail?0:ease(clamp(0,(end-stagger)/(1-stagger),1));
   const turn=ease(clamp(0,(local-.22)/.67,1));
   const shrink=ease(clamp(0,(local-.10)/.84,1));
   const tx=railTargetX-(rect.left+rect.width/2)-(glyphCount-1-i)*3.8;
   const ty=railTargetY-(rect.top+rect.height/2)+(i-(glyphCount-1)/2)*1.5;
   el.style.setProperty('--brand-tx',`${(tx*local).toFixed(2)}px`);
   el.style.setProperty('--brand-ty',`${(ty*local).toFixed(2)}px`);
   el.style.setProperty('--brand-rotate',`${(-90*turn).toFixed(2)}deg`);
   el.style.setProperty('--brand-scale',String((1-.86*shrink).toFixed(4)));
   el.style.opacity=reducedMotion?'1':String((1-ease(clamp(0,(local-.78)/.22,1))).toFixed(4));
 }
 document.documentElement.style.setProperty('--brand-ruler-reveal',String((hasRail?ease(clamp(0,(progress-.30)/.40,1)):1).toFixed(4)));
}

let scrollQueued=false;
function paintHero(){
 scrollQueued=false;
 const scroll=window.scrollY;
 header.classList.toggle('is-scrolled',scroll>10);
 if(reducedMotion){tilted.style.setProperty('--hero-ry','0deg');tilted.style.setProperty('--hero-rx','0deg');tilted.style.setProperty('--hero-rz','0deg');tilted.style.setProperty('--hero-scale','1');tilted.style.setProperty('--hero-lift','0px');heroCopy.style.setProperty('--hero-copy-opacity','1');heroCopy.style.setProperty('--hero-copy-lift','0px');return}
 const rect=hero.getBoundingClientRect();
 // The image begins dramatically tilted. During the first ~70% of the sticky scroll it becomes flat.
 const originalShowcase=document.querySelector('#cc-original-showcase');
 const showcaseRect=originalShowcase?.getBoundingClientRect();
 // Begin the entry under the download block; finish the tilt before the showcase
 // reaches its central viewing position. Keep that flat pose for the rest of its scroll.
 const progress=showcaseRect?clamp(0,(window.innerHeight*.80-showcaseRect.top)/(window.innerHeight*.47),1):0;
 const eased=progress*progress*(3-2*progress);
 const left=1-eased;
 tilted.style.setProperty('--hero-ry',`${(-18*left).toFixed(3)}deg`);
 tilted.style.setProperty('--hero-rx',`${(10*left).toFixed(3)}deg`);
 tilted.style.setProperty('--hero-rz',`${(-5*left).toFixed(3)}deg`);
 tilted.style.setProperty('--hero-scale',String((.86+.14*eased).toFixed(4)));
 const mobile=window.innerWidth<=900;
 tilted.style.setProperty('--hero-lift',`${(-eased*(mobile?14:22)).toFixed(1)}px`);
 const faded=1-clamp(0,(eased-.16)/.49,1);
 heroCopy.style.setProperty('--hero-copy-opacity',String(faded.toFixed(3)));
 heroCopy.style.setProperty('--hero-copy-lift',`${(-45*eased).toFixed(1)}px`);
}
function queueHero(){if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{paintHero();paintBrand()})}
window.addEventListener('scroll',queueHero,{passive:true});window.addEventListener('resize',()=>{measureBrand();queueHero()},{passive:true});measureBrand();paintHero();paintBrand();document.fonts?.ready?.then(()=>{measureBrand();paintBrand()});

// Autoplay only while visible. Reduced-motion users can choose to play the inline showcase themselves.
const heroVideo=document.querySelector('#hero-video');
const heroToggle=document.querySelector('#hero-video-toggle');
const heroCaption=document.querySelector('#hero-cut-caption');
const heroProgress=document.querySelector('#hero-montage-progress');
let heroPausedByUser=reducedMotion;
if(reducedMotion){heroToggle.textContent='▶';heroToggle.setAttribute('aria-label','Play hero animation')}

const filmVideo=document.querySelector('#studio-video');
const filmControl=document.querySelector('#pause-video');
let filmInView=false,heroInView=false,filmPausedByUser=reducedMotion;
if(reducedMotion){filmControl.textContent='▶';filmControl.setAttribute('aria-label','Play video')}
function safePlay(video){const result=video.play();if(result?.catch)result.catch(()=>{})}
function syncHeroVideo(){if(heroInView&&!heroPausedByUser&&!document.hidden)safePlay(heroVideo);else heroVideo.pause()}
heroToggle.addEventListener('click',()=>{
  if(heroVideo.paused){heroPausedByUser=false;heroInView=true;syncHeroVideo()}
  else{heroPausedByUser=true;heroVideo.pause()}
});
heroVideo.addEventListener('play',()=>{heroToggle.textContent='Ⅱ';heroToggle.setAttribute('aria-label','Pause hero animation')});
heroVideo.addEventListener('pause',()=>{heroToggle.textContent='▶';heroToggle.setAttribute('aria-label','Play hero animation')});

function syncFilmVideo(){if(filmInView&&!filmPausedByUser&&!document.hidden){safePlay(filmVideo);filmControl.textContent='Ⅱ';filmControl.setAttribute('aria-label','Pause video')}else filmVideo.pause()}
const heroFilmObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.target===heroVideo){heroInView=entry.isIntersecting;syncHeroVideo()}else{filmInView=entry.isIntersecting;syncFilmVideo()}}),{threshold:.12});
heroFilmObserver.observe(heroVideo);heroFilmObserver.observe(filmVideo);
filmControl.addEventListener('click',()=>{filmPausedByUser=!filmVideo.paused;if(filmPausedByUser){filmVideo.pause();filmControl.textContent='▶';filmControl.setAttribute('aria-label','Play video')}else{filmInView=true;syncFilmVideo()}});
const cuts=['WORKSPACE','PATTERN DRAFTING','FABRIC','CONSTRUCTION','STAGE','3D VIEWPORT','PRECISION','TEXTURES','WORKSPACE','PRESENTATION','SEWING','3D VIEW'];
const cutPoints=[0,1.45,3.15,4.60,6.10,7.55,8.95,10.35,11.80,13.30,14.75,16.20];
heroVideo.addEventListener('timeupdate',()=>{
 const t=heroVideo.currentTime;
 const idx=cutPoints.findLastIndex?.(x=>x<=t)??cutPoints.reduce((a,v,i)=>v<=t?i:a,0);
 const cap=`${String(clamp(0,idx,cuts.length-1)+1).padStart(2,'0')} / ${cuts[clamp(0,idx,cuts.length-1)]}`;
 if(heroCaption.textContent!==cap)heroCaption.textContent=cap;
 heroProgress.style.width=`${clamp(0,t/Math.max(heroVideo.duration||17.8,1)*100,100).toFixed(1)}%`;
});
const filmLabel=document.querySelector('#film-chapter');
filmVideo.addEventListener('timeupdate',()=>{const t=filmVideo.currentTime;const i=cutPoints.findLastIndex?.(x=>x<=t)??cutPoints.reduce((a,v,i)=>v<=t?i:a,0);filmLabel.textContent=cuts[clamp(0,i,cuts.length-1)]});

// Viewport-managed playback for the real Studio feature videos. Never let offscreen cards waste resources.
const scrollVideos=[...document.querySelectorAll('.cc-scroll-video')];
const activeScrollVideos=new Set();
function syncScrollVideos(){for(const video of scrollVideos){const shouldPlay=activeScrollVideos.has(video)&&!document.hidden&&!reducedMotion&&!video.dataset.manualPause;
 const source=video.querySelector('source');
 if(shouldPlay&&source.dataset.src&&!source.src){source.src=source.dataset.src;video.load()}
 if(shouldPlay){safePlay(video)}else video.pause();
 const button=video.closest('.cc-video-feature').querySelector('.cc-video-toggle');button.textContent=video.paused?'▶':'Ⅱ';button.setAttribute('aria-label',(video.paused?'Play ':'Pause ')+video.getAttribute('aria-label'));
}}
for(const video of scrollVideos){const button=video.closest('.cc-video-feature').querySelector('.cc-video-toggle');button.addEventListener('click',()=>{if(video.paused){delete video.dataset.manualPause;activeScrollVideos.add(video);const source=video.querySelector('source');if(source.dataset.src&&!source.src){source.src=source.dataset.src;video.load()}safePlay(video)}else{video.dataset.manualPause='true';video.pause()}button.textContent=video.paused?'▶':'Ⅱ'})}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)activeScrollVideos.add(entry.target);else activeScrollVideos.delete(entry.target)}syncScrollVideos()},{threshold:.3,rootMargin:'0px 0px -5% 0px'});scrollVideos.forEach(video=>observer.observe(video))}
else{scrollVideos.forEach(video=>activeScrollVideos.add(video));syncScrollVideos()}
// Real six-chapter studio recording browser.
const scenes=[
 {src:'assets/chapters/workspace.mp4',poster:'assets/chapters/workspace.jpg',name:'CONNECTED WORKSPACE',caption:'01 / TWO VIEWS. ONE WORKSPACE.'},
 {src:'assets/chapters/materials.mp4',poster:'assets/chapters/materials.jpg',name:'FABRIC & MATERIALS',caption:'02 / EXPLORE THE MATERIAL'},
 {src:'assets/chapters/presentation.mp4',poster:'assets/chapters/presentation.jpg',name:'STAGE PRESENTATION',caption:'03 / THE GARMENT IN CONTEXT'},
 {src:'assets/chapters/drafting.mp4',poster:'assets/chapters/drafting.jpg',name:'PRECISION DRAFTING',caption:'04 / EVERY LINE MATTERS'},
 {src:'assets/chapters/construction.mp4',poster:'assets/chapters/construction.jpg',name:'CONSTRUCTION TOOLS',caption:'05 / CONNECTING THE PIECES'},
 {src:'assets/chapters/viewport.mp4',poster:'assets/chapters/viewport.jpg',name:'3D GARMENT VIEW',caption:'06 / EXPLORE EVERY ANGLE'}
];
const sceneVideo=document.querySelector('#scene-video');const sceneSteps=[...document.querySelectorAll('.story-step')];
const sceneProgress=document.querySelector('#scene-progress');const sceneBar=document.querySelector('.progress-track');
const sceneName=document.querySelector('#scene-name');const sceneCaption=document.querySelector('#scene-caption');
const toggleScene=document.querySelector('#scene-toggle');const replayScene=document.querySelector('#scene-restart');
let activeScene=0,sceneInView=false,sceneManualPause=reducedMotion;
if(reducedMotion){toggleScene.textContent='▶ PLAY';toggleScene.setAttribute('aria-label','Play scene')}
function playScene(){if(!sceneInView||sceneManualPause||document.hidden)return;safePlay(sceneVideo);toggleScene.textContent='Ⅱ PAUSE';toggleScene.setAttribute('aria-label','Pause scene')}
function setScene(index,userTriggered=false){if(index<0||index>=scenes.length)return;if(activeScene===index){if(userTriggered){sceneManualPause=false;sceneVideo.currentTime=0;playScene()}return}activeScene=index;const scene=scenes[index];sceneSteps.forEach((button,i)=>{button.classList.toggle('active',i===index);button.setAttribute('aria-pressed',String(i===index))});sceneName.textContent=scene.name;sceneCaption.textContent=scene.caption;sceneProgress.style.width='0%';sceneBar.setAttribute('aria-valuenow','0');sceneVideo.pause();if(userTriggered)sceneManualPause=false;sceneVideo.poster=scene.poster;sceneVideo.src=scene.src;sceneVideo.load()}
sceneSteps.forEach((button,index)=>button.addEventListener('click',()=>setScene(index,true)));
sceneVideo.addEventListener('loadedmetadata',playScene);
sceneVideo.addEventListener('timeupdate',()=>{const percent=sceneVideo.duration>0?clamp(0,Math.round(100*sceneVideo.currentTime/sceneVideo.duration),100):0;sceneProgress.style.width=`${percent}%`;sceneBar.setAttribute('aria-valuenow',String(percent))});
sceneVideo.addEventListener('ended',()=>{toggleScene.textContent='↺ REPLAY';toggleScene.setAttribute('aria-label','Replay scene');sceneProgress.style.width='100%';sceneBar.setAttribute('aria-valuenow','100')});
toggleScene.addEventListener('click',()=>{if(sceneVideo.paused){if(sceneVideo.ended)sceneVideo.currentTime=0;sceneManualPause=false;sceneInView=true;playScene()}else{sceneManualPause=true;sceneVideo.pause();toggleScene.textContent='▶ PLAY';toggleScene.setAttribute('aria-label','Play scene')}});
replayScene.addEventListener('click',()=>{sceneManualPause=false;sceneVideo.currentTime=0;sceneInView=true;playScene()});
new IntersectionObserver(entries=>entries.forEach(entry=>{sceneInView=entry.isIntersecting;if(sceneInView)playScene();else sceneVideo.pause()}),{threshold:.15}).observe(document.querySelector('.viewer-sticky'));
if(window.matchMedia('(min-width: 901px)').matches){const stepsObserver=new IntersectionObserver(entries=>{const inCenter=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(inCenter)setScene(Number(inCenter.target.dataset.scene))},{rootMargin:'-38% 0px -38% 0px',threshold:0});sceneSteps.forEach(el=>stepsObserver.observe(el))}

document.addEventListener('visibilitychange',()=>{if(document.hidden){heroVideo.pause();filmVideo.pause();sceneVideo.pause();scrollVideos.forEach(video=>video.pause())}else{syncHeroVideo();syncFilmVideo();playScene();syncScrollVideos()}});

const annualInput=document.querySelector('#annual-spend');const yearsInput=document.querySelector('#saving-years');
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
function updateCalculator(){const annual=Number(annualInput.value),years=Number(yearsInput.value);document.querySelector('#annual-output').textContent=money.format(annual);document.querySelector('#years-output').textContent=`${years} ${years===1?'year':'years'}`;document.querySelector('#savings-total').textContent=money.format(annual*years)}
[annualInput,yearsInput].forEach(el=>el.addEventListener('input',updateCalculator));updateCalculator();

// Play four lightweight original ClothCraft showcase clips only while the hero is visible.
const orbitClips=[...document.querySelectorAll('.cc-orbit-media video')];
if(orbitClips.length){
 const orbitObserver=new IntersectionObserver(entries=>{for(const entry of entries){const video=entry.target;if(entry.isIntersecting&&!document.hidden&&!reducedMotion){video.play().catch(()=>{})}else{video.pause()}}},{threshold:.15});
 orbitClips.forEach(video=>{orbitObserver.observe(video);video.closest('.cc-orbit-media')?.addEventListener('pointerdown',event=>{const parent=video.closest('.cc-orbit-media');spawnMediaRipple(parent,event.clientX,event.clientY)})});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)orbitClips.forEach(v=>v.pause())});
}
function spawnMediaRipple(parent,x,y){
 if(reducedMotion||!parent)return;
 const rect=parent.getBoundingClientRect();const ripple=document.createElement('span');ripple.className='cc-click-ripple';ripple.style.left=(x-rect.left)+'px';ripple.style.top=(y-rect.top)+'px';parent.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
}
[...document.querySelectorAll('.cc-video-frame,.film-screen,.hero-media-edge,.cc-app-launch-visual')].forEach(el=>el.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;spawnMediaRipple(el,e.clientX,e.clientY)}));

// ArtCraft-style interaction: clicking does not open an enormous modal.
// The selected floating tile scales slightly in place then returns on next click/Escape.
let selectedOrbitTile=null;
function clearOrbitSelection(){if(!selectedOrbitTile)return;selectedOrbitTile.classList.remove('is-zoomed');selectedOrbitTile.setAttribute('aria-pressed','false');selectedOrbitTile=null}
for(const tile of document.querySelectorAll('.cc-orbit-media')){
 tile.setAttribute('aria-pressed','false');
 tile.addEventListener('click',()=>{
  if(selectedOrbitTile===tile){clearOrbitSelection();return}
  clearOrbitSelection();selectedOrbitTile=tile;tile.classList.add('is-zoomed');tile.setAttribute('aria-pressed','true');
 });
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')clearOrbitSelection()});
document.addEventListener('pointerdown',event=>{if(selectedOrbitTile&&!event.target.closest('.cc-orbit-media'))clearOrbitSelection()});

// Original ClothCraft continuous ruler: visual chapter hierarchy independent of hover preview.
const rail=document.getElementById('cc-measure-rail');
const ticksHost=document.getElementById('cc-measure-ticks');
const chapterHost=document.getElementById('cc-measure-chapters');
const floating=document.getElementById('cc-measure-floating');
const floatingNumber=document.getElementById('cc-measure-floating-number');
const floatingHeading=document.getElementById('cc-measure-floating-heading');
const floatingSubtitle=document.getElementById('cc-measure-floating-subtitle');
const cursor=document.getElementById('cc-measure-cursor');
const cursorLabel=document.getElementById('cc-measure-cursor-label');
const viewportBand=document.getElementById('cc-measure-viewport');
// Narrow ArtCraft-style ruler: no expanding 205px index drawer.
const chapterSpecs=[
 {id:'top',name:'CLOTHCRAFT',group:'THE FASHION DESIGN STUDIO',kind:'section'},
 {id:'product',name:'CRAFTING APPS',group:'CRAFTING APPS',kind:'section'},
 {id:'cc-original-showcase',name:'THE SHOWCASE',group:'THE STUDIO / IN MOTION',kind:'section'},
 {id:'workflow',name:'CLOTHCRAFT STUDIO',group:'WORKFLOW',kind:'section'},
 {id:'film-heading',name:'THE FILM',group:'WORKFLOW',kind:'section'},
 {id:'story',name:'UNDER THE SURFACE',group:'WORKFLOW',kind:'section'},
 {id:'features',name:'FEATURES',group:'FEATURES / PRINCIPLES',kind:'section'},
 {id:'open',name:'OWNERSHIP',group:'PRINCIPLES',kind:'section'},
 {id:'savings',name:'DESIGN BUDGET',group:'PRINCIPLES',kind:'section'},
 {id:'faq',name:'QUESTIONS',group:'PRINCIPLES',kind:'section'},
 {id:'community',name:'COMMUNITY',group:'COMMUNITY',kind:'section'},
 {id:'download',name:'GET STARTED',group:'GET STARTED',kind:'section'}
];
const subSpecs=[
 {selector:'#workflow .cc-video-feature:nth-child(1)',name:'PATTERN DRAFTING',group:'WORKFLOW'},
 {selector:'#workflow .cc-video-feature:nth-child(2)',name:'CONNECTED 2D + 3D',group:'WORKFLOW'},
 {selector:'#workflow .cc-video-feature:nth-child(3)',name:'CONSTRUCTION',group:'WORKFLOW'},
 {selector:'#workflow .cc-video-feature:nth-child(4)',name:'MATERIALS',group:'WORKFLOW'},
 {selector:'#features .cc-video-feature:nth-child(1)',name:'PRECISION',group:'FEATURES / PRINCIPLES'},
 {selector:'#features .cc-video-feature:nth-child(2)',name:'SEWING',group:'FEATURES / PRINCIPLES'},
 {selector:'#features .cc-video-feature:nth-child(3)',name:'FABRICS',group:'FEATURES / PRINCIPLES'},
 {selector:'#features .cc-video-feature:nth-child(4)',name:'PRESENTATION',group:'FEATURES / PRINCIPLES'}
];
const chapters=chapterSpecs.map((spec,i)=>({...spec,element:document.getElementById(spec.id),index:i})).filter(x=>x.element);
const subsections=subSpecs.map((spec,i)=>({...spec,element:document.querySelector(spec.selector),index:i})).filter(x=>x.element);
ticksHost.innerHTML=Array.from({length:101},(_,i)=>`<i class="cc-measure-tick${i%10===0?' major':i%5===0?' medium':''}" data-tick="${i}" style="top:${i}%">${i%5===0?`<span>${i}</span>`:''}</i>`).join('');
const marks=[...ticksHost.querySelectorAll('.cc-measure-tick')];
chapterHost.innerHTML=chapters.map((c,i)=>`<a class="cc-measure-chapter" href="#${c.id}" data-chapter="${i}" aria-label="Go to ${c.name.toLowerCase()}"><span class="cc-chapter-index">${String(i+1).padStart(2,'0')}</span><span class="cc-chapter-line"></span><span class="cc-chapter-name">${c.name}</span></a>`).join('');
const chapterLinks=[...chapterHost.querySelectorAll('.cc-measure-chapter')];
// A restrained gray bottom row holds future headings; approaching headings fly
// from their own place in this row toward the measuring ruler.
const futureBar=document.createElement('nav');futureBar.className='cc-measure-futures cc-measure-futures-stack';futureBar.setAttribute('aria-label','Upcoming sections');document.body.append(futureBar);
const futureLinks=chapters.map((chapter,i)=>{const a=document.createElement('a');a.href='#'+chapter.id;
 a.className='cc-measure-future';a.textContent=({1:'CRAFTING APPS',3:'CLOTHCRAFT STUDIO',6:'FEATURES',7:'OWNERSHIP',10:'COMMUNITY',11:'GET STARTED'})[i]||chapter.name;a.setAttribute('aria-label','Jump to '+chapter.name.toLowerCase());a.dataset.future=String(i);a.dataset.group=chapter.group||'';futureBar.append(a);return a});
futureBar.addEventListener('click',event=>{const a=event.target.closest('a[data-future]');if(!a)return;event.preventDefault();jumpToChapter(Number(a.dataset.future))});

const rulerTextStages=chapters.map((chapter,i)=>({chapter,link:chapterLinks[i],title:chapterLinks[i].querySelector('.cc-chapter-name')}));

function letterize(label){const text=label.textContent;label.textContent='';const frag=document.createDocumentFragment();[...text].forEach((letter,index)=>{const span=document.createElement('span');span.className='cc-ruler-letter';span.textContent=letter===' '?'\u00a0':letter;span.style.setProperty('--letter-index',index);frag.append(span)});label.append(frag)}
chapterLinks.forEach(link=>letterize(link.querySelector('.cc-chapter-name')));

const subsectionHost=document.createElement('div');subsectionHost.className='cc-measure-subsections';subsectionHost.setAttribute('aria-hidden','true');rail.append(subsectionHost);
subsectionHost.innerHTML=subsections.map(s=>`<span class="cc-measure-subsection" data-sub="${s.index}" title="${s.name}"><i></i><b>${s.name}</b></span>`).join('');
const subLinks=[...subsectionHost.children];
const overviewButtons=[];
let metrics=[],subMetrics=[],activeChapter=0,activeSub=-1,hoveredChapter=-1,hoveredSub=-1,hoveredFraction=null,dragging=false,paintQueued=false,metricQueued=false,stableUntil=0,rulerFocus=0,rulerFocusTarget=0,rulerLastFrame=0;
function maxScroll(){return Math.max(1,document.documentElement.scrollHeight-innerHeight)}
function docTop(el){return el.getBoundingClientRect().top+scrollY}
function measureRail(){const height=document.documentElement.scrollHeight;metrics=chapters.map(c=>docTop(c.element));subMetrics=subsections.map(s=>docTop(s.element));for(let i=0;i<chapters.length;i++){const frac=Math.min(.975,Math.max(.025,metrics[i]/height));chapterLinks[i].style.top=(frac*100)+'%'}for(let i=0;i<subsections.length;i++){const frac=Math.min(.975,Math.max(.025,subMetrics[i]/height));subLinks[i].style.top=(frac*100)+'%'}paintRuler()}
function nearestIndex(offset,positions){let result=0;positions.forEach((p,i)=>{if(p<=offset)result=i});return result}
function scrollProgress(){return Math.min(1,Math.max(0,scrollY/maxScroll()))}
function previewInfo(fraction){const y=fraction*document.documentElement.scrollHeight;const chapter=nearestIndex(y,metrics);let sub=-1;subMetrics.forEach((v,i)=>{if(v<=y)sub=i});if(sub>=0){const sectionTop=metrics[chapter],nextTop=chapter+1<metrics.length?metrics[chapter+1]:Infinity;if(subMetrics[sub]<sectionTop||subMetrics[sub]>=nextTop)sub=-1}return {chapter,sub}}
function setFloat(info){const c=chapters[info.chapter];floatingNumber.textContent=`${String(info.chapter+1).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`;floatingHeading.textContent=info.sub>=0?subsections[info.sub].name:c.name;floatingSubtitle.textContent=c.group}
function paintRuler(){paintQueued=false;const pct=scrollProgress(),number=Math.round(pct*100),docHeight=document.documentElement.scrollHeight,viewHeight=Math.max(.5,innerHeight/docHeight*100),railHeight=rail.getBoundingClientRect().height;
 const cursorFraction=hoveredFraction===null?pct:hoveredFraction;cursor.style.top=Math.max(70,Math.min(railHeight-24,cursorFraction*railHeight)).toFixed(2)+'px';cursorLabel.textContent=String(Math.round(cursorFraction*100)).padStart(3,'0')+'%';rail.setAttribute('aria-valuenow',String(number));viewportBand.style.top=pct*(100-viewHeight)+'%';viewportBand.style.height=viewHeight+'%';
 // Interpolate the entire scale every frame. The ruler expands to the real
 // page's full scroll length at rest, and visually contracts into the viewport
 // while hovered. An animating scale must retain the scroll position as its
 // anchor, otherwise the numbers appear to teleport.
 const hoveredNow=rail.classList.contains('is-hovered')||dragging;
 rulerFocusTarget=hoveredNow?1:0;
 const now=performance.now(),dt=rulerLastFrame?Math.min(now-rulerLastFrame,48):16;
 rulerLastFrame=now;
 const easing=reducedMotion?1:1-Math.exp(-dt/165);
 rulerFocus+=(rulerFocusTarget-rulerFocus)*easing;
 if(Math.abs(rulerFocusTarget-rulerFocus)<.001)rulerFocus=rulerFocusTarget;
 const scaleTop=10,scaleHeight=Math.max(1,innerHeight-20);
 const expandedLength=Math.max(scaleHeight,docHeight);
 const restLength=Math.max(scaleHeight*1.95,Math.min(expandedLength,scaleHeight*4.6));
 const rulerLength=restLength+(scaleHeight-restLength)*rulerFocus;
 const rulerOffset=scaleTop-(rulerLength-scaleHeight)*pct;
 ticksHost.style.height=rulerLength.toFixed(2)+'px';
 ticksHost.style.transform=`translate3d(0,${rulerOffset.toFixed(2)}px,0)`;
 rail.style.setProperty('--ruler-focus',rulerFocus.toFixed(4));
 rail.classList.toggle('is-expanded',rulerFocus>.03);
 if(rulerFocus!==rulerFocusTarget)queuePaint();
 const target=scrollY>=maxScroll()-2?document.documentElement.scrollHeight:scrollY+Math.min(innerHeight*.84,760);if(performance.now()>stableUntil||scrollY>=maxScroll()-2){activeChapter=nearestIndex(target,metrics);let sub=-1;subMetrics.forEach((v,i)=>{if(v<=target)sub=i});if(sub>=0){const top=metrics[activeChapter],next=activeChapter+1<metrics.length?metrics[activeChapter+1]:Infinity;activeSub=subMetrics[sub]>=top&&subMetrics[sub]<next?sub:-1}else activeSub=-1}
 chapterLinks.forEach((a,i)=>{a.classList.toggle('is-current',i===activeChapter);a.classList.toggle('is-past',i<activeChapter);a.classList.toggle('is-upcoming',i>activeChapter);a.setAttribute('aria-current',i===activeChapter?'location':'false')});
 overviewButtons.forEach((a,i)=>{a.classList.toggle('is-current',i===activeChapter);a.classList.toggle('is-past',i<activeChapter);a.classList.toggle('is-upcoming',i>activeChapter);a.setAttribute('aria-current',i===activeChapter?'location':'false')});
 subLinks.forEach((a,i)=>a.classList.toggle('is-current',i===activeSub));
 const groups=[1,3,6,7,10,11];
 futureLinks.forEach((a,i)=>{
   const future=i>activeChapter,representative=groups.includes(i)||i===activeChapter+1;
   a.hidden=!future||!representative;
   const phase=future?clamp(0,(innerHeight*1.17-(metrics[i]-scrollY))/Math.max(230,innerHeight*1.17-Math.min(innerHeight*.84,760)),1):1;
   const visibility=scrollY<50?1:(1-clamp(0,(phase-.30)/.45,1));
   a.style.opacity=future&&representative?String((.56+.26*Math.max(0,1-(i-activeChapter-1)*.10))*visibility):'0';
 });
 futureBar.classList.toggle('is-empty',activeChapter>=chapters.length-1);
 const hoverIsActive=rail.classList.contains('is-hovered')||dragging;
 const pointerPreview=hoveredFraction===null?activeChapter:previewInfo(hoveredFraction).chapter;
 futureBar.classList.toggle('is-inspecting',hoverIsActive);
 futureBar.style.setProperty('--preview-chapter',String(pointerPreview));
 const visibleFuture=futureLinks.filter(a=>!a.hidden);
 futureLinks.forEach((a,i)=>{
   a.classList.toggle('is-inspection-target',hoverIsActive&&i===pointerPreview);
   if(hoverIsActive&&!a.hidden)a.style.opacity='1';
   if(hoverIsActive&&!a.hidden){
     // Stable section positions, independent of cursor movement. The first
     // hover frame selects the list; moving the measurement line only previews.
     const row=visibleFuture.indexOf(a);
     const slotCount=Math.max(1,visibleFuture.length);
     const low=15, high=85;
     const tick=Math.round((low+(high-low)*row/Math.max(1,slotCount-1))/5)*5;
     const y=clamp(.12*innerHeight,tick/100*innerHeight,.88*innerHeight);
     a.style.setProperty('--future-expanded-y',y.toFixed(1)+'px');
     a.style.setProperty('--future-tick',String(tick));
   }
 });

 // Continuous, reversible glyph choreography. Each glyph receives its own scroll
 // phase, translation, rotation and scale, independent of a whole-word transform.
 // Use actual section distance: the next chapter begins its flight only when
 // the section approaches the viewport; no premature sideways label on load.
 const flightStart=innerHeight*1.17,flightSpan=Math.max(230,flightStart-Math.min(innerHeight*.84,760));
 const currentY=.235,historyStep=.044,futureBase=.83,futureStep=.044;
 const smooth=x=>{x=clamp(0,x,1);return x*x*(3-2*x)};
 rulerTextStages.forEach(({link,title},i)=>{
   const past=i<activeChapter,current=i===activeChapter;
   link.classList.toggle('is-older-history',i<activeChapter-5);
   link.style.setProperty('--history-order',String(activeChapter-i));
   const ahead=i-activeChapter,distance=metrics[i]-target;
   const phase=past||current?1:clamp(0,(flightStart-(metrics[i]-scrollY))/flightSpan,1);
   const rising=smooth(phase/.48),unfold=smooth((phase-.69)/.31);
   const sideways=smooth((phase-.14)/.35)*(1-unfold);
   const bottom=Math.min(.94,futureBase+Math.max(0,ahead-1)*futureStep);
   const screenY=past?(.073+(Math.max(0,5-(activeChapter-i)))*.018):current?currentY:bottom-(bottom-currentY)*(.65*rising+.35*smooth((phase-.43)/.57));
   const face=title.querySelectorAll('.cc-ruler-letter');
   const stagger=face.length>1?.20/(face.length-1):0;
   face.forEach((glyph,j)=>{
     const delay=j*stagger;
     const local=past||current?1:clamp(0,(phase-delay)/(1-delay),1);
     const travel=smooth(local/.50),open=smooth((local-.66)/.34);
     const turn=smooth((local-.12)/.20)*(1-smooth((local-.76)/.24));
     // Move glyphs progressively toward the rail while turning them sideways.
     // Restore their horizontal spacing letter by letter as the title activates.
     const tx=past||current?0:((1-open)*(10+(face.length-1-j)*1.25)*(1-travel*.45));
     const ty=past||current?0:(1-travel)*Math.min(30,9+j*1.4);
     glyph.style.setProperty('--glyph-x',tx.toFixed(2)+'px');
     glyph.style.setProperty('--glyph-y',ty.toFixed(2)+'px');
     glyph.style.setProperty('--glyph-turn',(reducedMotion?0:16*turn).toFixed(2)+'deg');
     glyph.style.setProperty('--glyph-size',(past||current?1:.72+.28*open).toFixed(4));
     glyph.style.opacity=String((past||current?1:.34+.66*Math.max(travel*.65,open)).toFixed(4));
     glyph.style.setProperty('--glyph-phase',local.toFixed(4));
   });
   // Scroll-linked transfer from the future row to the edge (no separate popover).
   const dockRect=futureLinks[i].getBoundingClientRect();
   const dockX=(dockRect.left+dockRect.width/2)-(innerWidth-112);
   const dockY=(dockRect.height?dockRect.top+dockRect.height/2:innerHeight-110)-screenY*innerHeight;
   const traveling=!past&&!current&&i===activeChapter+1;
   const departure=1-smooth(phase/.70);
   link.style.setProperty('--chapter-dock-x',(traveling?dockX*departure:0).toFixed(2)+'px');
   link.style.setProperty('--chapter-dock-y',(traveling?dockY*departure:0).toFixed(2)+'px');
   const sideHold=traveling?smooth((phase-.25)/.15)*(1-smooth((phase-.79)/.15)):0;
   link.style.setProperty('--chapter-side-angle',(reducedMotion?0:-90*sideHold).toFixed(2)+'deg');
   link.classList.toggle('is-docked',!past&&!current&&i>activeChapter+1);
   link.classList.toggle('is-transferring',traveling);
   link.classList.toggle('is-side-title',traveling&&phase>.33&&phase<.87);
   link.style.setProperty('--chapter-screen-y',(clamp(.035,screenY,.95)*100).toFixed(3)+'%');
   link.style.top=(clamp(.035,screenY,.95)*100).toFixed(3)+'%';
   link.style.setProperty('--chapter-entry',unfold.toFixed(4));
   link.style.setProperty('--chapter-phase',phase.toFixed(4));
   // Keep the label itself horizontal: glyphs now perform their own rotation.
   link.style.setProperty('--chapter-rotate','0deg');
   link.style.setProperty('--chapter-distance',String(Math.abs(i-activeChapter)));
   link.classList.toggle('is-morphing',!past&&!current&&phase>.02);
   link.classList.toggle('is-sideways',!past&&!current&&sideways>.12);
 });
 const floatingInfo=hoveredFraction===null?{chapter:activeChapter,sub:activeSub}:previewInfo(hoveredFraction);
 setFloat(floatingInfo);
 rail.dataset.activeHeading=chapters[activeChapter].name;
 chapterLinks.forEach((link,i)=>link.classList.toggle('is-preview',hoveredFraction!==null&&floatingInfo.chapter===i));

 floating.hidden=true; // Hover is represented directly by the bright future-heading stack, not a popover.
 floating.style.top=Math.max(75,Math.min(railHeight-75,(hoveredFraction===null?pct:hoveredFraction)*railHeight))+'px';

 const near=(hoveredFraction===null?pct:hoveredFraction)*100;marks.forEach(el=>{const d=Math.abs(Number(el.dataset.tick)-near);el.classList.toggle('is-near',d<3.5);el.classList.toggle('is-active',d<1.15)});
}
function queuePaint(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(paintRuler)}
function queueMeasure(){if(metricQueued)return;metricQueued=true;requestAnimationFrame(()=>{metricQueued=false;measureRail()})}
// Ruler navigation should feel like a fast trip THROUGH the page, not a scene
// cut. A native smooth scroll often finishes almost instantly over very long
// distances, so use a bounded, distance-aware animation instead. Let the ruler
// update its active chapter from the intermediate scroll positions as we pass.
let rulerJourney=null;
function cancelRulerJourney(){
 if(!rulerJourney)return;
 cancelAnimationFrame(rulerJourney.frame);
 rulerJourney=null;
 rail.classList.remove('is-journeying');
 stableUntil=0;
}
function animateRulerScroll(destination){
 cancelRulerJourney();
 const resolveTarget=typeof destination==='function'?destination:()=>destination;
 const from=window.scrollY;
 const to=Math.max(0,Math.min(maxScroll(),resolveTarget()));
 const distance=Math.abs(to-from);
 stableUntil=0;
 if(reducedMotion||distance<4){window.scrollTo({top:to,behavior:'instant'});queuePaint();return}
 // ~.9 s for a nearby section and up to ~1.8 s from top to footer.
 const screens=distance/Math.max(1,innerHeight);
 const duration=Math.min(1800,Math.max(680,620+200*Math.sqrt(screens)));
 const journey={frame:0,start:0,from,duration,resolveTarget};
 rulerJourney=journey;
 rail.classList.add('is-journeying');
 function step(now){
  if(rulerJourney!==journey)return;
  if(!journey.start)journey.start=now;
  const t=Math.min(1,(now-journey.start)/journey.duration);
  const eased=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  // Media may change page height during a long jump: track the live anchor.
  const liveTarget=Math.max(0,Math.min(maxScroll(),journey.resolveTarget()));
  window.scrollTo({top:journey.from+(liveTarget-journey.from)*eased,behavior:'instant'});
  queuePaint();
  if(t<1){journey.frame=requestAnimationFrame(step);return}
  window.scrollTo({top:Math.max(0,Math.min(maxScroll(),journey.resolveTarget())),behavior:'instant'});
  rulerJourney=null;
  rail.classList.remove('is-journeying');
  queueMeasure();
 }
 journey.frame=requestAnimationFrame(step);
}
function jumpToChapter(i){
 const c=chapters[i];if(!c)return;
 history.replaceState(null,'','#'+c.id);
 hoveredFraction=null;hoveredChapter=-1;hoveredSub=-1;
 animateRulerScroll(()=>Math.max(0,docTop(c.element)-92));
 queuePaint();
}
chapterLinks.forEach((link,i)=>link.addEventListener('click',e=>{e.preventDefault();jumpToChapter(i)}));

function pointerFraction(e){const r=rail.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)))}
let pointerStart=null;
rail.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;rail.classList.add('is-hovered');hoveredFraction=pointerFraction(e);queuePaint()});
rail.addEventListener('pointerleave',()=>{if(dragging||pointerStart)return;rail.classList.remove('is-hovered');hoveredFraction=null;queuePaint()});
rail.addEventListener('pointermove',e=>{
 hoveredFraction=pointerFraction(e);rail.style.setProperty('--hover-y',(hoveredFraction*100)+'%');
 if(pointerStart&&e.pointerId===pointerStart.id){
  const traveled=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);
  if(!dragging&&traveled>(e.pointerType==='touch'?10:6)){
   cancelRulerJourney();dragging=true;rail.classList.add('is-dragging');
  }
  if(dragging)window.scrollTo({top:hoveredFraction*maxScroll(),behavior:'instant'});
 }
 queuePaint();
});
rail.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button,a'))return;
 e.preventDefault();
 cancelRulerJourney();
 pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY,fraction:pointerFraction(e)};
 rail.setPointerCapture(e.pointerId);
 hoveredFraction=pointerStart.fraction;
 queuePaint();
});
function endDrag(e){
 if(!pointerStart||e.pointerId!==pointerStart.id)return;
 const wasDragging=dragging;
 const fraction=pointerFraction(e);
 pointerStart=null;dragging=false;
 rail.classList.remove('is-dragging');
 try{rail.releasePointerCapture(e.pointerId)}catch{}
 if(!rail.matches(':hover')){hoveredFraction=null;rail.classList.remove('is-hovered')}
 if(!wasDragging&&e.type==='pointerup')animateRulerScroll(()=>fraction*maxScroll());
 queuePaint();
}
rail.addEventListener('pointerup',endDrag);rail.addEventListener('pointercancel',endDrag);
// Direct manual intent always wins over an in-flight automated scroll.
window.addEventListener('wheel',cancelRulerJourney,{passive:true});
window.addEventListener('touchstart',cancelRulerJourney,{passive:true});
window.addEventListener('keydown',e=>{
 if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Escape'].includes(e.key)&&rulerJourney&&document.activeElement!==rail)cancelRulerJourney();
});
rail.addEventListener('keydown',e=>{
 let target=null;
 if(e.key==='ArrowDown')target=scrollY+innerHeight*.10;
 else if(e.key==='ArrowUp')target=scrollY-innerHeight*.10;
 else if(e.key==='PageDown')target=scrollY+innerHeight*.82;
 else if(e.key==='PageUp')target=scrollY-innerHeight*.82;
 else if(e.key==='Home')target=0;
 else if(e.key==='End')target=maxScroll();
 else if(e.key==='Escape'){cancelRulerJourney();return}
 if(target!==null){e.preventDefault();if(e.key==='End'||e.key==='Home'){cancelRulerJourney();window.scrollTo({top:e.key==='End'?document.documentElement.scrollHeight:0,behavior:'instant'});queueMeasure()}else animateRulerScroll(target);queuePaint()}
});
window.addEventListener('scroll',queuePaint,{passive:true});window.addEventListener('resize',queueMeasure,{passive:true});window.addEventListener('load',queueMeasure);document.fonts?.ready?.then(queueMeasure);if('ResizeObserver' in window){const observer=new ResizeObserver(queueMeasure);observer.observe(document.querySelector('main'));}measureRail();

// Small staggered reveals, independent from the legacy large-section animation.
const cardReveals=[...document.querySelectorAll('.cc-reveal-target')];
if('IntersectionObserver' in window){
 const cardObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('cc-is-visible');cardObserver.unobserve(entry.target)}}},{rootMargin:'0px 0px -60px 0px',threshold:.05});
 cardReveals.forEach((el,i)=>{el.style.transitionDelay=`${Math.min(i%4,3)*65}ms`;cardObserver.observe(el)})
}else{cardReveals.forEach(el=>el.classList.add('cc-is-visible'))}

// The landing page keeps its bespoke hero and ruler; add the shared editorial
// typography/scroll effects without replacing any existing interactions.
const ccSiteMotion=document.createElement('script');
ccSiteMotion.src=new URL('./site-scroll-motion-20261101.js',document.currentScript.src).href;
document.body.append(ccSiteMotion);
// ArtCraft-reference, geometry-based chapter flights: actual bottom label
// measurements -> vertical ruler track -> bold active heading, scroll scrubbed.
const ccFlightMotion=document.createElement('script');
ccFlightMotion.src=new URL('./site-ruler-flight-20261102.js',document.currentScript.src).href;
document.body.append(ccFlightMotion);

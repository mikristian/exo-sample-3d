/** ClothCraft Assets editorial showcase. Real local project media and captured Studio footage. */
const optOutMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const escapeText=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountAssetsShowcase(parent,{onMarketplace,onOpenProject,projects=[]}={}){
 if(!parent || parent.querySelector('.cc-editorial'))return;
 const entries=[
  {id:'garment-nike',title:'Graphic tee, built in ClothCraft.',type:'SAVED GARMENT PROJECT',image:'./market-media/nike-saved-native-render.webp',position:'center',description:'Native garment project reconstructed from the saved Studio state'},
  {id:'capture-workspace',title:'Two views. One workspace.',type:'LIVE STUDIO CAPTURE',image:'./app-captures/workspace.webp',position:'center',description:'Real 2D and 3D design interface'},
  {id:'capture-pattern',title:'Every line matters.',type:'PATTERN EDITING',image:'./app-captures/pattern-drafting.webp',position:'center',description:'Actual pattern geometry editing in ClothCraft'},
  {id:'capture-materials',title:'Fabric, inside the app.',type:'MATERIAL WORKROOM',image:'./app-captures/materials.webp',position:'center',description:'ClothCraft materials and garment viewport'},
  {id:'capture-construction',title:'Build with precision.',type:'CONSTRUCTION TOOLS',image:'./app-captures/construction.webp',position:'center',description:'The real pattern construction interface'},
  {id:'capture-avatar',title:'Make space for ideas.',type:'AVATAR + 2D TOOLS',image:'./app-captures/avatar-workspace.webp',position:'center',description:'The actual ClothCraft garment and pattern workspace'}
 ];
 const section=document.createElement('div');section.className='cc-editorial';
 section.innerHTML=`
 <section class="cc-editorial-head" aria-labelledby="cc-editorial-title"><div><span class="cc-eyebrow">02 / THE CLOTHCRAFT COLLECTION</span><h2 id="cc-editorial-title">See the work.<br><em>Closer than ever.</em></h2><p>Real software captures from the working ClothCraft app, alongside one saved graphic T-shirt project. No speculative garments or unused stage concepts. Swipe to explore.</p></div><div class="cc-editorial-nav"><span id="cc-gallery-count" aria-live="polite">01 / 06</span><button type="button" id="cc-gallery-prev" aria-label="Previous editorial image">←</button><button type="button" id="cc-gallery-next" aria-label="Next editorial image">→</button></div></section>
 <div class="cc-media-rail" id="cc-media-rail" role="region" aria-label="ClothCraft photo carousel" tabindex="0">${entries.map((e,i)=>`<article class="cc-media-card" data-index="${i}"><button type="button" data-editorial-project="${escapeText(e.id)}" aria-label="Explore ${escapeText(e.title)}"><span class="cc-media-image"><img loading="lazy" decoding="async" src="${escapeText(e.image)}" alt="${escapeText(e.description)}" style="object-position:${e.position}"><span class="cc-media-type">${String(i+1).padStart(2,'0')} / ${escapeText(e.type)}</span><span class="cc-media-arrow">↗</span></span><span class="cc-media-caption"><small>REAL CLOTHCRAFT STUDIO WORK</small><strong>${escapeText(e.title)}</strong><span>${escapeText(e.description)}</span></span></button></article>`).join('')}</div>
 <div class="cc-media-foot"><div class="cc-media-progress" aria-label="Gallery progress"><span id="cc-gallery-progress"></span></div><span>DRAG / SWIPE / SCROLL <b>↗</b></span></div>
 <section class="cc-film-chapter" id="cc-film" aria-labelledby="cc-film-heading"><div class="cc-film-copy"><span class="cc-eyebrow">03 / STUDIO IN MOTION</span><h2 id="cc-film-heading">From line<br>to <em>real form.</em></h2><p>The creative workflow comes alive in recorded ClothCraft Studio footage. Pattern drafting, materials, garment viewing, stage environments, and construction tools — all from the actual app.</p><div class="cc-film-actions"><button type="button" class="cc-film-start" id="cc-film-action">Play the film <span>↗</span></button><button type="button" class="cc-film-explore" id="cc-film-marketplace">Browse all assets <span>↗</span></button></div><small>REAL SCREEN RECORDINGS · STUDIO V2 / EXPERIMENTAL BUILD</small></div><div class="cc-film-view" id="cc-film-view"><div class="cc-film-frame"><div class="cc-film-topbar"><span class="cc-film-lights"><i></i><i></i><i></i></span><span>CLOTHCRAFT / SOFTWARE WORKFLOW</span><button type="button" class="cc-film-pause" id="cc-film-pause" aria-label="Play software demonstration">▶</button></div><video id="cc-assets-film" muted loop playsinline preload="none" poster="../assets/chapters/workspace.jpg" aria-label="Fast cut video of real ClothCraft Studio software"><source src="../assets/feature-montage.mp4" type="video/mp4"></video><div class="cc-film-overlay"><span id="cc-film-caption">01 / CONNECTED WORKSPACE</span><span>REAL UI / ACTIVE DEVELOPMENT</span></div><div class="cc-film-progress"><span id="cc-film-progress-inner"></span></div></div></div><div class="cc-film-bottom"><span>SCROLL TO STRAIGHTEN THE VIEW <b>↘</b></span><span>THE PRODUCT IS IN ACTIVE DEVELOPMENT</span></div></section>
 <div class="cc-end-action"><div><span class="cc-eyebrow">BACK TO MAKING</span><h2>Your next project<br><em>starts with curiosity.</em></h2></div><button type="button" id="cc-show-all-assets">Explore the complete collection <span>↗</span></button></div>`;
 // Let the existing home route hide the entire editorial set on marketplace/forum/portfolio routes.
 parent.append(section);
 const rail=section.querySelector('#cc-media-rail');const cards=[...section.querySelectorAll('.cc-media-card')];
 let selected=0,requested=false;
 function updateRail(){requested=false;const x=rail.getBoundingClientRect().left;let index=0,dist=Infinity;for(let i=0;i<cards.length;i++){const d=Math.abs(cards[i].getBoundingClientRect().left-x-parseFloat(getComputedStyle(rail).paddingLeft||0));if(d<dist){dist=d;index=i}}
  selected=index;section.querySelector('#cc-gallery-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;section.querySelector('#cc-gallery-progress').style.width=`${100*(index+1)/cards.length}%`;cards.forEach((c,i)=>c.classList.toggle('is-current',i===index));section.querySelector('#cc-gallery-prev').disabled=index===0;section.querySelector('#cc-gallery-next').disabled=index===cards.length-1;
 }
 function jump(index){const item=cards[clamp(index,0,cards.length-1)];if(!item)return;item.scrollIntoView({behavior:optOutMotion.matches?'instant':'smooth',inline:'start',block:'nearest'})}
 section.querySelector('#cc-gallery-prev').addEventListener('click',()=>jump(selected-1));section.querySelector('#cc-gallery-next').addEventListener('click',()=>jump(selected+1));
 rail.addEventListener('scroll',()=>{if(!requested){requested=true;requestAnimationFrame(updateRail)}},{passive:true});
 rail.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();jump(selected+1)}else if(e.key==='ArrowLeft'){e.preventDefault();jump(selected-1)}});
 rail.addEventListener('wheel',e=>{if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;const max=rail.scrollWidth-rail.clientWidth;if(e.deltaY>0&&rail.scrollLeft>=max-1||e.deltaY<0&&rail.scrollLeft<=0)return;e.preventDefault();rail.scrollLeft+=e.deltaY*.9},{passive:false});
 section.addEventListener('click',e=>{
  const id=e.target.closest('[data-editorial-project]')?.dataset.editorialProject;
  if(id){const project=projects.find(p=>p.id===id);if(project)onOpenProject?.(project);return}
  if(e.target.closest('#cc-film-marketplace,#cc-show-all-assets'))onMarketplace?.();
 });updateRail();
 const feature=section.querySelector('#cc-film');const viewer=section.querySelector('#cc-film-view');const video=section.querySelector('#cc-assets-film');const button=section.querySelector('#cc-film-pause');const action=section.querySelector('#cc-film-action');const progress=section.querySelector('#cc-film-progress-inner');const caption=section.querySelector('#cc-film-caption');
 let visible=false,manualPause=optOutMotion.matches,scheduled=false;
 const labels=['WORKSPACE','PATTERN DRAFTING','MATERIAL EXPLORATION','CONSTRUCTION','STAGE ENVIRONMENT','3D VIEWPORT','PRECISION EDITS','SURFACE DETAILS','CONNECTED WORKSPACE','PRESENTATION','SEWING TOOLS','3D VIEW'];
 const points=[0,1.45,3.15,4.60,6.10,7.55,8.95,10.35,11.80,13.30,14.75,16.20];
 function playback(){if(visible&&!manualPause&&!document.hidden){const started=video.play();started?.catch?.(()=>{manualPause=true;renderButton()})}else video.pause();renderButton()}
 function renderButton(){button.textContent=video.paused?'▶':'Ⅱ';button.setAttribute('aria-label',video.paused?'Play software demonstration':'Pause software demonstration');action.firstChild.textContent=video.paused?'Play the film ':'Pause the film '}
 function flipPlayback(){if(video.paused){manualPause=false;visible=true;playback()}else{manualPause=true;video.pause();renderButton()}}
 button.addEventListener('click',flipPlayback);action.addEventListener('click',flipPlayback);
 video.addEventListener('play',renderButton);video.addEventListener('pause',renderButton);
 video.addEventListener('timeupdate',()=>{const t=video.currentTime;progress.style.width=`${(t/Math.max(video.duration||17.8,1)*100).toFixed(1)}%`;let i=0;while(i+1<points.length && t>=points[i+1])i++;caption.textContent=`${String(i+1).padStart(2,'0')} / ${labels[i]}`});
 new IntersectionObserver(entries=>{for(const entry of entries){visible=entry.isIntersecting;playback()}},{threshold:.24}).observe(viewer);
 function adjustFilm(){scheduled=false;if(optOutMotion.matches){viewer.style.setProperty('--cc-rx','0deg');viewer.style.setProperty('--cc-ry','0deg');viewer.style.setProperty('--cc-rz','0deg');viewer.style.setProperty('--cc-scale','1');return}
  if(parent.hidden)return;const box=feature.getBoundingClientRect(),range=Math.max(1,box.height+innerHeight);let f=clamp((innerHeight-box.top)/range*2.1,0,1);f=f*f*(3-2*f);const turn=1-f;
  viewer.style.setProperty('--cc-rx',`${(9*turn).toFixed(2)}deg`);viewer.style.setProperty('--cc-ry',`${(-16*turn).toFixed(2)}deg`);viewer.style.setProperty('--cc-rz',`${(-5*turn).toFixed(2)}deg`);viewer.style.setProperty('--cc-scale',`${(.85+.15*f).toFixed(3)}`);
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(adjustFilm)}}
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});adjustFilm();
 document.addEventListener('visibilitychange',playback);
 return {destroy(){video.pause();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);section.remove()}};
}

/* Shared homepage ruler engine for ClothCraft's interior and standalone pages.
   The same main.js ruler implementation is reused; no duplicate animation model. */
(()=>{
  if(location.pathname.startsWith('/marketplace/')||location.pathname.startsWith('/community/'))return;
  const main=document.querySelector('main');
  if(!main||document.getElementById('cc-measure-rail')||document.querySelector('.cc-page-ruler'))return;
  const existing=Array.from(main.children).filter(node=>node.tagName==='SECTION');
  if(!existing.length)return;
  const slug=location.pathname.split('/').filter(Boolean)[0]||'page';
  // Interior pages are already headed by their real editorial titles. Avoid
  // repeating those complete, often very long headlines as floating ruler UI.
  // The visible labels are compact navigation landmarks; accessible names
  // still retain the full heading.
  document.body.classList.add('cc-ruler-interior');
  const rulerStyle=document.createElement('link');
  rulerStyle.rel='stylesheet';
  rulerStyle.href=new URL('site-interior-ruler-quiet-20261102.css',document.currentScript.src).href;
  document.head.append(rulerStyle);
  const shortLabels={
    solutions:['SOLUTIONS','DESIGN WORKFLOW'],
    features:['FEATURES','TOOL DETAILS'],
    product:['STUDIO','WORKSPACE'],
    development:['PROGRESS','VALIDATION'],
    about:['ABOUT','OUR FUTURE'],
    contribute:['HELP BUILD','CONTRIBUTE'],
    faq:['QUESTIONS','ANSWERS'],
    news:['NEWS','UPDATES'],
    support:['SUPPORT','GUIDES'],
    ideas:['IDEAS','COMMUNITY'],
    investors:['SUPPORT','DEVELOPMENT'],
    download:['DOWNLOAD','PLATFORMS'],
    'open-source':['OPEN SOURCE','CONTRIBUTE'],
    'press-kit':['PRESS KIT','RESOURCES']
  };
  // Interior pages only need the opening title and one major destination.
  // Preserve the complete page's original sections/anchors; reduce ruler labels only.
  const choice=existing.length>1?[existing[0],existing[Math.max(1,Math.floor((existing.length-1)*.72))]]:[existing[0]];
  const sections=choice.map((node,i)=>{
    if(!node.id)node.id=`${slug}-ruler-major-${i+1}`;
    const heading=node.querySelector('h1,h2');
    const raw=heading?.getAttribute('aria-label')||heading?.textContent||node.getAttribute('aria-label')||`Section ${i+1}`;
    const cleaned=raw.replace(/\s+/g,' ').trim();
    const short=shortLabels[slug]?.[i]||
      (cleaned.length>18?cleaned.slice(0,18).replace(/\s+\S*$/,'').trim():cleaned);
    return {element:node,id:node.id,name:short.toUpperCase(),fullName:cleaned};
  });
  const make=(tag,id,parent,cls)=>{const e=document.createElement(tag);if(id)e.id=id;if(cls)e.className=cls;parent.append(e);return e};
  const rail=make('div','cc-measure-rail',document.body,'cc-measure-rail');
  rail.setAttribute('role','scrollbar');rail.setAttribute('aria-label','Page scroll position');rail.setAttribute('aria-controls',main.id||'cc-shared-main');rail.setAttribute('aria-orientation','vertical');rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.setAttribute('aria-valuenow','0');rail.tabIndex=0;
  if(!main.id)main.id='cc-shared-main';
  make('div',null,rail,'cc-measure-glass').setAttribute('aria-hidden','true');
  const ticksHost=make('div','cc-measure-ticks',rail,'cc-measure-ticks');ticksHost.setAttribute('aria-hidden','true');
  const band=make('div','cc-measure-viewport',rail,'cc-measure-viewport');band.setAttribute('aria-hidden','true');
  const cursor=make('div','cc-measure-cursor',rail,'cc-measure-cursor');cursor.setAttribute('aria-hidden','true');
  make('span',null,cursor,'cc-measure-cursor-line');const counter=make('span','cc-measure-cursor-label',cursor,'cc-measure-cursor-label');counter.textContent='000%';
  const chapterHost=make('nav','cc-measure-chapters',rail,'cc-measure-chapters');chapterHost.setAttribute('aria-label','Page chapters');
  const clamp=(lo,x,hi)=>Math.max(lo,Math.min(hi,x));const smooth=t=>{t=clamp(0,t,1);return t*t*(3-2*t)};
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  ticksHost.innerHTML=Array.from({length:101},(_,i)=>`<i class="cc-measure-tick${i%10===0?' major':i%5===0?' medium':''}" data-tick="${i}" style="top:${i}%">${i%5===0?`<span>${i}</span>`:''}</i>`).join('');
  const marks=[...ticksHost.children];
  const letterize=(label)=>{const source=label.textContent;label.textContent='';for(const [i,ch] of [...source].entries()){const glyph=document.createElement('span');glyph.className='cc-ruler-letter';glyph.textContent=ch===' '?'\u00a0':ch;glyph.style.setProperty('--letter-index',i);label.append(glyph)}};
  const chapters=sections.map((section,i)=>{
    const a=make('a',null,chapterHost,'cc-measure-chapter');a.href='#'+section.id;a.dataset.chapter=String(i);a.setAttribute('aria-label','Go to '+section.fullName);a.title=section.fullName;
    make('span',null,a,'cc-chapter-line');const title=make('span',null,a,'cc-chapter-name');title.textContent=section.name;letterize(title);
    return {section,a,title};
  });
  const futures=make('nav',null,document.body,'cc-measure-futures cc-measure-futures-stack');futures.setAttribute('aria-label','Upcoming sections');
  const futureLinks=chapters.map(({section},i)=>{const a=make('a',null,futures,'cc-measure-future');a.href='#'+section.id;a.dataset.future=String(i);a.textContent=section.name;a.setAttribute('aria-label','Jump to '+section.fullName);return a});
  let positions=[],height=0,focus=0,lastFrame=0,inside=false,dragging=false,hoverFraction=null,frame=0,metricsQueued=false,journey=null;
  const maxScroll=()=>Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const measured=()=>sections.map(s=>s.element.getBoundingClientRect().top+scrollY);
  function measure(){height=document.documentElement.scrollHeight;positions=measured();render()}
  function schedule(){if(frame)return;frame=requestAnimationFrame(render)}
  function queueMeasure(){if(metricsQueued)return;metricsQueued=true;requestAnimationFrame(()=>{metricsQueued=false;measure()})}
  function render(){frame=0;if(innerWidth<=1150)return;
    const railH=innerHeight,pct=clamp(0,scrollY/maxScroll(),1),preview=hoverFraction===null?pct:hoverFraction;
    const now=performance.now(),dt=lastFrame?Math.min(48,now-lastFrame):16;lastFrame=now;
    const targetFocus=inside||dragging?1:0;focus+=(targetFocus-focus)*(reduced.matches?1:1-Math.exp(-dt/165));if(Math.abs(targetFocus-focus)<.001)focus=targetFocus;
    const wide=Math.max((railH-20)*1.95,Math.min(height,(railH-20)*4.6));const trackLength=wide+(railH-20-wide)*focus;
    ticksHost.style.height=trackLength.toFixed(2)+'px';ticksHost.style.transform=`translate3d(0,${(10-(trackLength-(railH-20))*pct).toFixed(2)}px,0)`;
    rail.style.setProperty('--ruler-focus',focus.toFixed(4));rail.classList.toggle('is-expanded',focus>.03);rail.classList.toggle('is-hovered',inside);
    counter.textContent=String(Math.round(preview*100)).padStart(3,'0')+'%';cursor.style.top=clamp(70,preview*railH,railH-24)+'px';rail.setAttribute('aria-valuenow',String(Math.round(pct*100)));
    band.style.top=pct*(100-innerHeight/Math.max(height,1)*100)+'%';band.style.height=Math.min(100,innerHeight/Math.max(height,1)*100)+'%';
    const measureTarget=scrollY+Math.min(innerHeight*.84,760);let active=0;positions.forEach((n,i)=>{if(n<=measureTarget)active=i});if(scrollY>=maxScroll()-2)active=chapters.length-1;
    const visibleFuture=[];
    futureLinks.forEach((a,i)=>{const upcoming=i>active;a.hidden=!upcoming;if(upcoming)visibleFuture.push(a);a.classList.toggle('is-inspection-target',inside&&i===active+1);a.style.opacity=upcoming?(inside?'1':String(Math.max(.3,.79-(i-active-1)*.09))):'0'});
    futures.classList.toggle('is-empty',!visibleFuture.length);futures.classList.toggle('is-inspecting',inside);
    visibleFuture.forEach((a,i)=>{const step=Math.round((15+70*i/Math.max(1,visibleFuture.length-1))/5)*5;a.style.setProperty('--future-expanded-y',(step*railH/100).toFixed(1)+'px')});
    const flightStart=innerHeight*1.17,flightSpan=Math.max(230,flightStart-Math.min(innerHeight*.84,760));
    for(let i=0;i<chapters.length;i++){
      const {a,title}=chapters[i],past=i<active,current=i===active,delta=active-i,distance=positions[i]-measureTarget;
      const phase=past||current?1:clamp(0,(flightStart-(positions[i]-scrollY))/flightSpan,1),rise=smooth(phase/.49),unfold=smooth((phase-.72)/.28);
      a.classList.toggle('is-current',current);a.classList.toggle('is-past',past);a.classList.toggle('is-upcoming',i>active);
      a.classList.toggle('is-older-history',delta>5);a.classList.toggle('is-morphing',!past&&!current&&phase>.02);
      a.setAttribute('aria-current',current?'location':'false');
      const y=past?(.073+Math.max(0,5-delta)*.018):current?.235:Math.min(.94,.83+Math.max(0,i-active-1)*.044)-(.83-.235)*(.65*rise+.35*smooth((phase-.43)/.57));
      a.style.top=(clamp(.035,y,.95)*100).toFixed(3)+'%';a.style.setProperty('--chapter-screen-y',(clamp(.035,y,.95)*100).toFixed(3)+'%');
      const traveling=i===active+1&&!past&&!current;
      const dock=futureLinks[i].getBoundingClientRect(),fromX=dock.width?dock.left+dock.width/2:innerWidth-120,fromY=dock.height?dock.top+dock.height/2:innerHeight-95;
      const leave=1-smooth(phase/.7),sideHold=traveling?smooth((phase-.25)/.15)*(1-smooth((phase-.79)/.15)):0;
      a.style.setProperty('--chapter-dock-x',(traveling?(fromX-(innerWidth-112))*leave:0).toFixed(2)+'px');
      a.style.setProperty('--chapter-dock-y',(traveling?(fromY-y*innerHeight)*leave:0).toFixed(2)+'px');
      a.style.setProperty('--chapter-side-angle',(reduced.matches?0:-90*sideHold).toFixed(2)+'deg');
      a.style.setProperty('--chapter-entry',unfold.toFixed(4));
      a.style.setProperty('--chapter-phase',phase.toFixed(4));
      a.classList.toggle('is-transferring',traveling);a.classList.toggle('is-side-title',traveling&&phase>.33&&phase<.87);
      a.classList.toggle('is-docked',i>active+1);a.style.setProperty('--chapter-rotate','0deg');
      const letters=[...title.querySelectorAll('.cc-ruler-letter')],delay=letters.length>1?.2/(letters.length-1):0;
      letters.forEach((glyph,j)=>{
        const local=past||current?1:clamp(0,(phase-j*delay)/(1-j*delay),1),travel=smooth(local/.5),open=smooth((local-.66)/.34),turn=smooth((local-.12)/.2)*(1-smooth((local-.76)/.24));
        glyph.style.setProperty('--glyph-x',(past||current?0:(1-open)*(10+(letters.length-1-j)*1.25)*(1-travel*.45)).toFixed(2)+'px');
        glyph.style.setProperty('--glyph-y',(past||current?0:(1-travel)*Math.min(30,9+j*1.4)).toFixed(2)+'px');
        glyph.style.setProperty('--glyph-turn',(reduced.matches?0:16*turn).toFixed(2)+'deg');
        glyph.style.setProperty('--glyph-size',(past||current?1:.72+.28*open).toFixed(4));glyph.style.opacity=String(past||current?1:(.34+.66*Math.max(travel*.65,open)).toFixed(4));
      });
    }
    marks.forEach(m=>{const d=Math.abs(Number(m.dataset.tick)-preview*100);m.classList.toggle('is-near',d<3.5);m.classList.toggle('is-active',d<1.15)});
    if(focus!==targetFocus)schedule();
  }
  function cancelJourney(){if(journey){cancelAnimationFrame(journey);journey=null}}
  function go(target){cancelJourney();const startY=scrollY,endY=clamp(0,typeof target==='function'?target():target,maxScroll());if(reduced.matches){scrollTo(0,endY);return}
    const begin=performance.now(),duration=Math.min(1600,Math.max(620,620+Math.abs(endY-startY)/Math.max(1,maxScroll())*900));
    function step(now){const t=clamp(0,(now-begin)/duration,1),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;scrollTo({top:startY+(endY-startY)*ease,behavior:'instant'});if(t<1){journey=requestAnimationFrame(step)}else{journey=null;queueMeasure()}}
    journey=requestAnimationFrame(step)}
  function navigate(index){const target=sections[index];if(!target)return;history.replaceState(null,'','#'+target.id);go(()=>target.element.getBoundingClientRect().top+scrollY-92)}
  chapters.forEach(({a},i)=>a.addEventListener('click',e=>{e.preventDefault();navigate(i)}));
  futures.addEventListener('click',e=>{const a=e.target.closest('[data-future]');if(a){e.preventDefault();navigate(Number(a.dataset.future))}});
  function fraction(e){const r=rail.getBoundingClientRect();return clamp(0,(e.clientY-r.top)/Math.max(1,r.height),1)}
  let start=null;
  rail.addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;inside=true;hoverFraction=fraction(e);schedule()});
  rail.addEventListener('pointerleave',()=>{if(dragging||start)return;inside=false;hoverFraction=null;schedule()});
  rail.addEventListener('pointermove',e=>{hoverFraction=fraction(e);rail.style.setProperty('--hover-y',(hoverFraction*100)+'%');if(start&&start.id===e.pointerId){if(!dragging&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6){cancelJourney();dragging=true}if(dragging)scrollTo({top:hoverFraction*maxScroll(),behavior:'instant'})}schedule()});
  rail.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('a,button'))return;e.preventDefault();cancelJourney();start={id:e.pointerId,x:e.clientX,y:e.clientY};hoverFraction=fraction(e);rail.setPointerCapture(e.pointerId);schedule()});
  function end(e){if(!start||start.id!==e.pointerId)return;const moved=dragging;start=null;dragging=false;try{rail.releasePointerCapture(e.pointerId)}catch{}if(!rail.matches(':hover')){inside=false;hoverFraction=null}if(!moved&&e.type==='pointerup')go(fraction(e)*maxScroll());schedule()}
  rail.addEventListener('pointerup',end);rail.addEventListener('pointercancel',end);
  rail.addEventListener('keydown',e=>{let target=null;if(e.key==='ArrowDown')target=scrollY+innerHeight*.1;else if(e.key==='ArrowUp')target=scrollY-innerHeight*.1;else if(e.key==='PageDown')target=scrollY+innerHeight*.82;else if(e.key==='PageUp')target=scrollY-innerHeight*.82;else if(e.key==='Home')target=0;else if(e.key==='End')target=maxScroll();if(target!==null){e.preventDefault();if(e.key==='Home'||e.key==='End'){cancelJourney();scrollTo(0,target)}else go(target)}});
  addEventListener('wheel',cancelJourney,{passive:true});addEventListener('touchstart',cancelJourney,{passive:true});addEventListener('scroll',schedule,{passive:true});addEventListener('resize',queueMeasure,{passive:true});addEventListener('load',queueMeasure);
  if('ResizeObserver' in window)new ResizeObserver(queueMeasure).observe(main);
  document.fonts?.ready?.then(queueMeasure);measure();
})();

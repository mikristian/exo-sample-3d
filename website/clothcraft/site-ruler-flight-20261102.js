/* ClothCraft — ArtCraft-reference ruler chapter flight.
 *
 * A scroll-scrubbed FLIP-like overlay built from the LIVE source/destination
 * rectangles: muted future label (bottom) -> sideways vertical measurement
 * edge -> fully horizontal bold chapter title (top). Each letter has a short,
 * reversible peel/reassembly on the final turn. The real chapter links remain
 * semantic, navigable and fully interactive. No copy of ArtCraft's source.
 */
(()=>{
  'use strict';
  if(window.__ccRulerFlight)return;
  window.__ccRulerFlight=true;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce.matches)return;
  if(matchMedia('(max-width: 1150px)').matches)return;
  const source=document.currentScript?.src||location.href;
  const sheet=document.createElement('link');
  sheet.rel='stylesheet';
  sheet.href=new URL('site-ruler-flight-20261102.css',source).href;
  document.head.append(sheet);

  const clamp=(x,min=0,max=1)=>Math.min(max,Math.max(min,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const glyphsOf=str=>('Segmenter' in Intl?
    [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(str)].map(item=>item.segment):[...str]);

  let rail,layer,carrier,word,glyphs=[],lastIndex=-1,previousSource=null,previousChapter=null,queued=false;
  let outgoing=null,outgoingKey=-1,outgoingBaseline=null;
  const setVar=(element,name,value)=>{
    if(element.style.getPropertyValue(name)!==value)element.style.setProperty(name,value);
  };
  function releaseOutgoing(){
    if(!outgoing)return;
    outgoing.classList.remove('cc-flight-outgoing');
    for(const name of ['--cc-outgoing-y','--cc-outgoing-font','--cc-outgoing-opacity'])outgoing.style.removeProperty(name);
    outgoing=null;
  }
  function clearOwnership(){
    if(previousChapter)previousChapter.classList.remove('cc-flight-owned');
    if(previousSource){
      previousSource.classList.remove('cc-flight-source','cc-flight-in-progress');
      previousSource.style.removeProperty('opacity');
    }
    previousSource=null;previousChapter=null;
  }
  function setWord(name,index){
    if(index===lastIndex)return;
    lastIndex=index;
    word.textContent='';
    glyphs=[];
    for(const char of glyphsOf(name)){
      const el=document.createElement('span');
      el.className='cc-flight-glyph';
      el.textContent=char===' '?'\u00a0':char;
      word.append(el);glyphs.push(el);
    }
    layer.dataset.chapter=String(index);
    layer.dataset.text=name;
  }
  const midpoint=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
  const rectOf=e=>e?.getBoundingClientRect();
  function move(t){
    if(!rail||!document.body.contains(rail))return;
    const active=rail.querySelector('.cc-measure-chapter.is-current');
    if(!active){layer.hidden=true;clearOwnership();releaseOutgoing();return}
    const activeIndex=Number(active.dataset.chapter);
    if(activeIndex!==outgoingKey){
      releaseOutgoing();outgoingKey=activeIndex;
      const title=active.querySelector('.cc-chapter-name');
      const rect=title.getBoundingClientRect(),style=getComputedStyle(title);
      outgoingBaseline={size:parseFloat(style.fontSize)||12,right:rect.right};
    }
    const nextIndex=Number(active.dataset.chapter)+1;
    const next=rail.querySelector('.cc-measure-chapter[data-chapter="'+nextIndex+'"]');
    const future=document.querySelector('.cc-measure-futures-stack [data-future="'+nextIndex+'"]');
    const targetSection=next&&document.getElementById(next.getAttribute('href').slice(1));
    const startDistance=innerHeight*1.17;
    const span=Math.max(230,startDistance-Math.min(innerHeight*.84,760));
    // Calculate directly from the LIVE section rectangle, not the ruler's
    // previous-frame CSS variable. Images, fonts, videos and responsive layout
    // can shift a section while scrolling; the motion must track that change.
    const phase=targetSection?clamp((startDistance-targetSection.getBoundingClientRect().top)/span,0,.999):0;
    if(!next||!future||future.hidden||!targetSection){
      layer.hidden=true;clearOwnership();releaseOutgoing();return;
    }
    layer.dataset.progress=phase.toFixed(4);
    if(previousSource!==future||previousChapter!==next){
      clearOwnership();
      previousSource=future;previousChapter=next;
      future.classList.add('cc-flight-source');
      next.classList.add('cc-flight-owned');
    }
    // The bottom future label owns the title until its real section begins
    // approaching. Prevent an extra duplicate next to the measurement ticks.
    if(phase<=.095||scrollY<25){
      releaseOutgoing();
      future.classList.remove('cc-flight-in-progress');
      future.style.removeProperty('opacity');
      layer.hidden=true;return;
    }
    future.classList.add('cc-flight-in-progress');
    // Inline important is required: the existing cross-theme stylesheet has
    // stronger !important selectors for the upcoming-chapter stack.
    future.style.setProperty('opacity','0','important');

    // Bind the animation to the actual visible future row instead of arbitrary
    // viewport positions. The active title is the final, current chapter slot.
    const fromRect=rectOf(future),activeTitle=active.querySelector('.cc-chapter-name');
    const finalRect=rectOf(activeTitle);
    if(!fromRect?.width||!finalRect?.width){layer.hidden=true;clearOwnership();return}
    setWord(next.querySelector('.cc-chapter-name').textContent,nextIndex);

    const font=getComputedStyle(activeTitle);
    const startFont=parseFloat(getComputedStyle(future).fontSize)||11;
    const finalFont=outgoingBaseline?.size||parseFloat(font.fontSize)||16;
    const sideFont=clamp(startFont*1.13,11,15);
    word.style.fontFamily=font.fontFamily;
    word.style.fontWeight=font.fontWeight==='normal'?'850':String(Math.max(850,Number(font.fontWeight)||850));
    word.style.letterSpacing=font.letterSpacing;
    const start=midpoint(fromRect);
    const endpoint={x:0,y:innerHeight*.235};
    const edgeX=innerWidth-clamp(innerWidth*.053,66,94);
    const lower={x:edgeX,y:innerHeight*.72};
    const upper={x:edgeX,y:innerHeight*.385};
    let x,y,angle,size;
    if(phase<.35){
      const t=smooth((phase-.095)/.255);
      x=lerp(start.x,lower.x,t);y=lerp(start.y,lower.y,t);
      angle=lerp(0,-90,t);size=lerp(startFont,sideFont,t);
    }else if(phase<.72){
      const t=smooth((phase-.35)/.37);
      x=lerp(lower.x,upper.x,t);y=lerp(lower.y,upper.y,t);
      angle=-90;size=sideFont;
    }else{
      const t=smooth((phase-.72)/.28);
      // Measure the fully horizontal word at its final font before deciding
      // the endpoint. This avoids a horizontal jump when chapter activation
      // replaces the overlay with the real bold heading.
      word.style.fontSize=finalFont+'px';
      // offsetWidth is the pre-transform text width. getBoundingClientRect()
      // was returning the *rotated* width and displaced the target on turn-out.
      const finalWidth=word.offsetWidth||finalRect.width;
      const rightEdge=outgoingBaseline?.right||finalRect.right;
      const destinationX=rightEdge-finalWidth/2;
      x=lerp(upper.x,destinationX,t);y=lerp(upper.y,endpoint.y,t);
      angle=lerp(-90,0,t);size=lerp(sideFont,finalFont,t);
    }
    // Measured geometry is stable even when the user reverses scroll, hovers
    // the ruler, switches palettes, or clicks a faraway chapter.
    word.style.fontSize=size.toFixed(2)+'px';
    carrier.style.left=x.toFixed(2)+'px';
    carrier.style.top=y.toFixed(2)+'px';
    carrier.style.setProperty('--cc-flight-angle',angle.toFixed(2)+'deg');
    layer.style.opacity=String(Math.min(1,(phase-.095)/.065).toFixed(3));
    layer.hidden=false;
    layer.dataset.stage=phase<.35?'turn':phase<.72?'side':'unfold';
    if(phase>.68){
      const exit=smooth((phase-.68)/.31);
      if(outgoing!==active){releaseOutgoing();outgoing=active;active.classList.add('cc-flight-outgoing')}
      setVar(active,'--cc-outgoing-y',(23.5+(14.5-23.5)*exit).toFixed(3)+'%');
      setVar(active,'--cc-outgoing-font',(finalFont+(Math.min(12,finalFont)-finalFont)*exit).toFixed(2)+'px');
      setVar(active,'--cc-outgoing-opacity',(1-.51*exit).toFixed(3));
    }else releaseOutgoing();
    const count=Math.max(1,glyphs.length-1);
    glyphs.forEach((el,i)=>{
      // ArtCraft reference: letters temporarily detach/tilt on the turn, then
      // regain their exact word order; make the effect fully scroll reversible.
      const progress=clamp((phase-.69-i/count*.095)/.23);
      const peel=Math.sin(Math.PI*progress);
      const stagger=Math.sin(i*1.73);
      const tilt=phase>.69?stagger*19*peel:Math.sin(i*2.11)*9*Math.sin(Math.PI*clamp((phase-.095)/.255));
      const shift=phase>.69?(-5-Math.abs(stagger)*6)*peel:Math.sin(i*1.8)*4*Math.sin(Math.PI*clamp((phase-.095)/.255));
      el.style.setProperty('--cc-flight-letter-rotation',tilt.toFixed(2)+'deg');
      el.style.setProperty('--cc-flight-letter-y',shift.toFixed(2)+'px');
      el.style.opacity=String(1-.12*Math.abs(peel));
    });
  }
  function paint(){queued=false;move()}
  function schedule(){if(!queued){queued=true;requestAnimationFrame(paint)}}
  function start(){
    rail=document.getElementById('cc-measure-rail');
    if(!rail)return false;
    layer=document.createElement('div');layer.id='cc-ruler-flight';layer.hidden=true;
    layer.setAttribute('aria-hidden','true');
    carrier=document.createElement('div');carrier.className='cc-flight-carrier';
    word=document.createElement('span');word.className='cc-flight-word';
    carrier.append(word);layer.append(carrier);document.body.append(layer);
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    addEventListener('pageshow',schedule);
    document.fonts?.ready?.then(schedule);
    const observer=new MutationObserver(schedule);
    observer.observe(rail,{attributes:true,subtree:true,attributeFilter:['class','style']});
    // Every transition is driven by the existing ruler's section phase. A
    // single animation frame is enough; no independent scroll easing/timer.
    schedule();
    return true;
  }
  if(start())return;
  // Interior ruler is injected asynchronously by site-nav.js. Retry briefly
  // without creating a second ruler or blocking the initial page render.
  let attempts=0;
  const retry=()=>{if(start())return;if(++attempts<120)requestAnimationFrame(retry)};
  requestAnimationFrame(retry);
})();

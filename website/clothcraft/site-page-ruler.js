/* Original ClothCraft implementation of a document-scaled editorial ruler.
 * Coordinates are page progress, not garment dimensions. No external runtime. */
(() => {
  const main=document.querySelector('main');
  if(!main||document.querySelector('.cc-page-ruler'))return;
  const mq=matchMedia('(min-width:1024px)'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const sections=[...main.children].filter(e=>e.tagName==='SECTION');
  const names=['Solutions','Access','Disciplines','Studio','Learning','Workflow','Creators','Scenarios','Design path','Teams','Capabilities','Contribute'];
  const isSolutions=location.pathname.startsWith('/solutions/');
  const title=document.title.split('—')[0].trim();
  document.body.classList.add('cc-ruler-page');
  if(isSolutions)document.body.classList.add('cc-ruler-solutions');
  const make=(tag,cls,parent,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;parent?.append(e);return e};
  sections.forEach((s,i)=>{
    if(!s.id)s.id=`${(location.pathname.split('/').filter(Boolean)[0]||'page')}-section-${i+1}`;
    const heading=s.querySelector('h2,h1');
    s.dataset.rulerLabel=isSolutions?(names[i]||heading?.textContent.trim()||title):(i===0?title:(heading?.getAttribute('aria-label')||heading?.textContent.trim()||`Section ${i+1}`));
    s.dataset.rulerLabel=s.dataset.rulerLabel.replace(/\s+/g,' ').trim().slice(0,56);
    if(isSolutions){
      const line=make('div','cc-section-index',null);
      make('span','',line,`${String(i+1).padStart(2,'0')} / ${s.dataset.rulerLabel.toUpperCase()}`);
      make('span','cc-index-detail',line,i===0?'CLOTHCRAFT STUDIO':'OPEN DESIGN');
      s.prepend(line);
    }
  });
  const rail=make('div','cc-page-ruler',document.body);
  rail.setAttribute('role','scrollbar');rail.setAttribute('aria-controls',main.id||'main');
  if(!main.id)main.id='main';
  rail.setAttribute('aria-label','Page position');rail.setAttribute('aria-orientation','vertical');
  rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.tabIndex=0;
  make('div','cc-ruler-glass',rail).setAttribute('aria-hidden','true');
  const track=make('div','cc-page-scale',rail);track.setAttribute('aria-hidden','true');
  for(let i=0;i<=100;i++){
    const t=make('div',`cc-page-tick${i%5===0?' major':''}`,track);t.style.top=`${i}%`;
    make('i','',t);if(i%5===0)make('span','',t,String(i));
  }
  const cursor=make('div','cc-page-cursor',rail);cursor.setAttribute('aria-hidden','true');
  const digits=make('span','cc-page-counter',cursor),cols=[];
  for(let i=0;i<3;i++){const mask=make('span','cc-digit-mask',digits),col=make('span','cc-digit-col',mask);for(let d=0;d<10;d++)make('span','',col,String(d));cols.push(col)}
  make('span','',digits,'%');
  const hover=make('div','cc-page-hover',rail);hover.setAttribute('aria-hidden','true');
  const labels=make('nav','cc-page-chapters',document.body);labels.setAttribute('aria-label','Solutions sections');
  const links=sections.map(s=>{const a=make('a','cc-page-chapter',labels);a.href=`#${s.id}`;a.setAttribute('aria-label',`Jump to ${s.dataset.rulerLabel}`);a.title=s.dataset.rulerLabel;
    [...s.dataset.rulerLabel.toUpperCase()].forEach(c=>make('span','',a,c));
    a.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const head=document.querySelector('.header')?.offsetHeight||48;scrollTo({top:s.getBoundingClientRect().top+scrollY-head,behavior:reduced.matches?'instant':'smooth'});history.replaceState(null,'',a.hash)});return a});
  // Upcoming headings sit in a muted horizontal row. The nearest title leaves
  // this row and travels to the measuring edge as its section approaches.
  const dock=make('nav','cc-page-futures',document.body);dock.setAttribute('aria-label','Upcoming sections');
  const futureLinks=sections.map((section,i)=>{
    const a=make('a','cc-page-future',dock,section.dataset.rulerLabel.toUpperCase());
    a.href='#'+section.id;a.setAttribute('aria-label','Jump to '+section.dataset.rulerLabel);
    a.addEventListener('click',event=>{event.preventDefault();const offset=(document.querySelector('.header')?.offsetHeight||48)+12;
      scrollTo({top:section.getBoundingClientRect().top+scrollY-offset,behavior:reduced.matches?'instant':'smooth'});
      history.replaceState(null,'',a.hash)});return a;
  });
  for(let i=0;i<=100;i++)if(i%5!==0&&i%2===0){const t=track.children[i];t.classList.add('cc-page-tick-half')}
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  let queued=false,drag=false,inside=false,metrics=[],docHeight=0,focus=0,focusTarget=0,lastFrame=0,pointerY=NaN;
  function measure(){docHeight=document.documentElement.scrollHeight;metrics=sections.map(s=>({top:s.getBoundingClientRect().top+scrollY,height:s.offsetHeight}));request()}
  function draw(){queued=false;rail.hidden=!mq.matches;labels.hidden=!mq.matches;dock.hidden=!mq.matches;if(!mq.matches)return;
    const h=innerHeight,head=document.querySelector('.header')?.offsetHeight||48,start=head+12,end=h-12;
    const range=Math.max(0,docHeight-h),progress=range?clamp(scrollY/range):0;
    // A single continuous expansion state drives track geometry, tick detail
    // and the glass focus. Animating height and transform together avoids the
    // discrete snap that the earlier hover class created.
    focusTarget=inside?1:0;
    const now=performance.now(),dt=lastFrame?Math.min(now-lastFrame,48):16;lastFrame=now;
    focus+=(focusTarget-focus)*(reduced.matches?1:1-Math.exp(-dt/165));
    if(Math.abs(focusTarget-focus)<.001)focus=focusTarget;
    const atRest=Math.max((end-start)*1.95,Math.min(docHeight,(end-start)*4.6));
    const length=atRest+((end-start)-atRest)*focus;
    const offset=start-(length-(end-start))*progress;
    rail.classList.toggle('is-expanded',focus>.03);
    rail.style.setProperty('--ruler-focus',focus.toFixed(4));
    track.style.height=`${length.toFixed(2)}px`;track.style.transform=`translate3d(0,${offset.toFixed(2)}px,0)`;
    if(focus!==focusTarget)request();
    const pointerFraction=inside&&Number.isFinite(pointerY)?clamp((pointerY-start)/(end-start)):progress;
    const position=start+pointerFraction*(end-start);cursor.style.transform=`translate3d(0,${position}px,0)`;
    cursor.style.opacity='1';digits.style.top=position>h-40?'-14px':'4px';
    String(Math.round(pointerFraction*100)).padStart(3,'0').split('').forEach((d,i)=>cols[i].style.transform=`translateY(-${d}em)`);
    rail.setAttribute('aria-valuenow',String(Math.round(progress*100)));
    const current=Math.max(0,metrics.findLastIndex(m=>m.top<=scrollY+head+80));
    const dockItems=futureLinks.filter((_,i)=>i>current);
    futureLinks.forEach((a,i)=>{const approaching=i===current+1&&scrollY>55&&metrics[i]?.top-scrollY<h*.72;const future=i>current&&!approaching;
      a.hidden=!future;a.style.opacity=future?String(Math.max(.28,1-(i-current-1)*.12)):'0';a.classList.toggle('is-next',i===current+1);});
    dock.classList.toggle('is-empty',dockItems.length===0);
    dock.classList.toggle('is-inspecting',inside);
    if(inside){const visible=futureLinks.filter(a=>!a.hidden);visible.forEach((a,i)=>{
      // Each future label owns a fixed numbered division, independent of hover pointer Y.
      const count=visible.length;
      const tick=Math.round((15+70*i/Math.max(1,count-1))/5)*5;
      a.style.setProperty('--future-expanded-y',(start+(end-start)*tick/100).toFixed(1)+'px');
    })}

    futureLinks.forEach((a,i)=>{if(inside&&!a.hidden)a.style.opacity='1';a.classList.toggle('is-inspection-target',inside&&i===Math.max(0,metrics.findLastIndex(m=>m.top<=scrollY+head+80)))});
    links.forEach((a,i)=>{
      const center=metrics[i].top-scrollY+120,target=head+100;
      const distance=metrics[i].top-(scrollY+head+80);
      const u=i<=current?1:clamp(1-distance/Math.max(1,h*.98));
      const show=i<=current?i>=current-5:u>.01;
      a.hidden=!show;a.setAttribute('aria-current',i===current?'location':'false');
      if(!show)return;
      // At the start of the transition, the heading enters from the faded
      // bottom row; on arrival it opens horizontally at the top of the ruler.
      a.style.fontSize=i<current?'clamp(10px, .9vw, 13px)':i===current?'28px':'34px';
      a.style.width='max-content';const fullWidth=a.offsetWidth;
      const rise=u*u*(3-2*u);
      const y=i<current?head+33+Math.max(0,5-(current-i))*22:i===current?target:(h-57-(h-57-target)*rise);
      const angle=i===current?0:(1-rise)*-90;
      const scale=i===current?1:.52+.48*rise;
      const dockSource=futureLinks[i].getBoundingClientRect();
      const fromX=dockSource.left+dockSource.width/2;
      const toX=innerWidth-30-(fullWidth/2+26)*rise;
      a.style.width=fullWidth+'px';a.style.height='42px';
      a.style.left=(i>current?fromX*(1-rise)+toX*rise-fullWidth/2:innerWidth-30-fullWidth-26)+'px';
      a.style.top=(y-21)+'px';
      a.style.transform=`rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      a.style.color=i<current?'#888':`color-mix(in srgb,#eee ${35+65*rise}%,#242424)`;
      a.style.opacity=i<current?String(.28+.26*(1-(current-i)/6)):String(.3+.7*rise);
      // Stagger independent letters as the heading opens into its active state.
      const letters=[...a.children];letters.forEach((glyph,j)=>{
        const fraction=letters.length>1?j/(letters.length-1):0;
        const arrival=clamp((u-fraction*.15)/(.99-fraction*.15));
        const open=arrival*arrival*(3-2*arrival);
        glyph.style.transform=`translate3d(${((1-open)*(letters.length-1-j)*1.7).toFixed(2)}px,${((1-open)*6).toFixed(2)}px,0) rotate(${((1-open)*-9).toFixed(1)}deg)`;
        glyph.style.opacity=String(.45+.55*open);
      });
    });
  }
  function request(){if(!queued){queued=true;requestAnimationFrame(draw)}}
  function seek(y){const head=document.querySelector('.header')?.offsetHeight||48;const ratio=clamp((y-head-12)/Math.max(1,innerHeight-head-24));scrollTo({top:ratio*Math.max(0,docHeight-innerHeight),behavior:'instant'})}
  rail.addEventListener('pointerenter',e=>{inside=true;pointerY=e.clientY;request()});
  rail.addEventListener('pointerdown',e=>{if(e.button!==0)return;inside=true;drag=true;rail.setPointerCapture(e.pointerId);seek(e.clientY);rail.focus({preventScroll:true});e.preventDefault()});
  rail.addEventListener('pointermove',e=>{inside=true;pointerY=e.clientY;hover.style.top=`${e.clientY}px`;hover.style.opacity='1';if(drag)seek(e.clientY)});
  rail.addEventListener('pointerleave',()=>{if(!drag){inside=false;pointerY=NaN;hover.style.opacity='0';request()}});
  function endPointer(){drag=false;if(!rail.matches(':hover')){inside=false;pointerY=NaN;hover.style.opacity='0'}request()}
  rail.addEventListener('pointerup',endPointer);rail.addEventListener('pointercancel',endPointer);rail.addEventListener('lostpointercapture',endPointer);
  rail.addEventListener('keydown',e=>{const step=Math.max(1,(docHeight-innerHeight)/100);const moves={ArrowDown:step,ArrowUp:-step,PageDown:innerHeight*.9,PageUp:-innerHeight*.9,Home:-docHeight,End:docHeight};if(e.key in moves){e.preventDefault();scrollBy({top:moves[e.key],behavior:'instant'})}});
  addEventListener('scroll',request,{passive:true});addEventListener('resize',measure,{passive:true});addEventListener('load',measure,{once:true});mq.addEventListener('change',measure);
  new ResizeObserver(measure).observe(main);document.fonts?.ready.then(measure);measure();
})();

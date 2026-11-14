/* ClothCraft theme selector — one local preference across Studio and Community.
   Does not recolor photographs, simulate uploads or change user project files. */
(()=>{
 'use strict';
 if(window.__ccThemeGridMounted)return;
 window.__ccThemeGridMounted=true;
 const KEY='clothcraft-site-theme-v2';
 const PALETTES=[
  {id:'black',name:'Black',bg:'#101010',panel:'#191919',raised:'#252525',line:'#464646',fg:'#eeeeee',muted:'#adadad',primary:'#e4e4e4',onPrimary:'#111111',scheme:'dark'},
  {id:'deep-charcoal',name:'Deep charcoal',bg:'#191919',panel:'#262626',raised:'#313131',line:'#494949',fg:'#ececec',muted:'#b0b0b0',primary:'#e6e6e6',onPrimary:'#1b1b1b',scheme:'dark'},
  {id:'charcoal',name:'Charcoal',bg:'#242424',panel:'#303030',raised:'#373737',line:'#555555',fg:'#e5e5e5',muted:'#b5b5b5',primary:'#dedede',onPrimary:'#242424',scheme:'dark'},
  {id:'dark-grey',name:'Dark grey',bg:'#373737',panel:'#444444',raised:'#515151',line:'#686868',fg:'#ededed',muted:'#c4c4c4',primary:'#eeeeee',onPrimary:'#292929',scheme:'dark'},
  {id:'grey',name:'Grey',bg:'#737373',panel:'#656565',raised:'#818181',line:'#989898',fg:'#ffffff',muted:'#f0f0f0',primary:'#ffffff',onPrimary:'#303030',scheme:'dark'},
  {id:'light-grey',name:'Light grey',bg:'#d7d7d5',panel:'#e7e7e5',raised:'#f2f2f0',line:'#aaaaa8',fg:'#222322',muted:'#4e5150',primary:'#242525',onPrimary:'#f9f9f9',scheme:'light'},
  {id:'white',name:'White',bg:'#fafafa',panel:'#eeeeee',raised:'#e2e2e2',line:'#c9c9c9',fg:'#1a1a1a',muted:'#545454',primary:'#232323',onPrimary:'#ffffff',scheme:'light'},
  {id:'off-white',name:'Off-white',bg:'#f0eee7',panel:'#e5e2d8',raised:'#d8d5ca',line:'#bebbb1',fg:'#282621',muted:'#5d5951',primary:'#292723',onPrimary:'#f6f3e9',scheme:'light'},
  {id:'stone',name:'Stone',bg:'#bab2a6',panel:'#ccc4b9',raised:'#ded5ca',line:'#8d857b',fg:'#25231e',muted:'#4e483f',primary:'#292620',onPrimary:'#eae4da',scheme:'light'},
  {id:'midnight',name:'Midnight',bg:'#1c2630',panel:'#293541',raised:'#344451',line:'#50606c',fg:'#f1f2f3',muted:'#c1ccd4',primary:'#e0e7eb',onPrimary:'#1d252c',scheme:'dark'},
  {id:'slate',name:'Slate',bg:'#414b53',panel:'#4d5860',raised:'#5b666f',line:'#77828a',fg:'#f4f4f4',muted:'#d2d7d9',primary:'#ebebeb',onPrimary:'#293139',scheme:'dark'},
  {id:'sage',name:'Sage',bg:'#dce4d9',panel:'#edf0e8',raised:'#d0dacb',line:'#a7b6a1',fg:'#263325',muted:'#566853',primary:'#2b3929',onPrimary:'#f2f7ee',scheme:'light'},
  // Mixed palettes use independent canvas, panel and accent tones throughout the site.
  {id:'ivory-ink',name:'Ivory / Ink',bg:'#ede8dc',panel:'#f9f5ed',raised:'#dcd5c7',line:'#aaa399',fg:'#242c30',muted:'#526068',primary:'#25363b',onPrimary:'#f8f4eb',secondary:'#b9c5c2',accent:'#587a79',scheme:'light'},
  {id:'oxide-slate',name:'Oxide / Slate',bg:'#1f252a',panel:'#2e353b',raised:'#3e4b50',line:'#697578',fg:'#f7eee5',muted:'#c9c1b9',primary:'#d59a7b',onPrimary:'#252b31',secondary:'#514c47',accent:'#e0aa87',scheme:'dark'},
  {id:'olive-bone',name:'Olive / Bone',bg:'#252b23',panel:'#343c30',raised:'#474d3c',line:'#696f60',fg:'#f5f0df',muted:'#c8cbb9',primary:'#e1d7b9',onPrimary:'#222a23',secondary:'#6c7862',accent:'#c4ba8f',scheme:'dark'},
  {id:'blueprint',name:'Blueprint',bg:'#dce6ea',panel:'#eff4f5',raised:'#c9d6dd',line:'#94aab6',fg:'#1a303e',muted:'#456171',primary:'#20577b',onPrimary:'#f8fbfc',secondary:'#a8c4d2',accent:'#438bb5',scheme:'light'}
 ];
 const root=document.documentElement;
 const getSaved=()=>{try{return localStorage.getItem(KEY)}catch{return null}};
 const save=id=>{try{localStorage.setItem(KEY,id)}catch{}}
 let current='charcoal';
 function apply(id,persist=true){
  const p=PALETTES.find(x=>x.id===id)||PALETTES[2];current=p.id;
  root.dataset.ccTheme=p.id;root.dataset.ccScheme=p.scheme;
  for(const prop of ['bg','panel','raised','line','fg','muted','primary','onPrimary'])root.style.setProperty('--cc-'+(prop==='onPrimary'?'on-primary':prop),p[prop]);
  root.style.setProperty('--cc-secondary',p.secondary||p.raised);
  root.style.setProperty('--cc-accent',p.accent||p.primary);
  root.style.setProperty('--cc-on-secondary',p.fg);
  root.style.setProperty('--cc-color-scheme',p.scheme);
  root.style.setProperty('--cc-grid-line',p.line);
  // Legacy pages have several high-specificity !important charcoal layers.
  // Apply the base canvas and masthead inline as well, so switching themes
  // visibly changes those surfaces regardless of stylesheet insertion order.
  for(const element of [document.body,document.querySelector('#website.website')]){
   if(!element)continue;
   element.style.setProperty('background-color',p.bg,'important');
   element.style.setProperty('background-image','none','important');
   element.style.setProperty('color',p.fg,'important');
  }
  // Legacy !important declarations require inline tokens, but the header
  // should remain translucent and blurred, not an opaque theme-colored bar.
  const header=document.querySelector('.header#site-header,.website .topbar,.cc-download-grid-header');
  if(header){
   header.style.setProperty('background-color','color-mix(in srgb, '+p.bg+' '+(p.scheme==='light'?'66':'56')+'%, transparent)','important');
   header.style.setProperty('background-image','none','important');
   header.style.setProperty('color',p.fg,'important');
   header.style.setProperty('backdrop-filter','blur(26px) saturate(1.16)','important');
   header.style.setProperty('-webkit-backdrop-filter','blur(26px) saturate(1.16)','important');
  }
  // Marketplace's original dark-navigation CSS uses unusually strong color
  // overrides. Inline theme tokens on its persistent controls ensure readable
  // white/off-white navigation without changing the controls or their actions.
  for(const element of document.querySelectorAll('.website .topbar .nav-link,.website .topbar .brand,.website .topbar .brand small,.website .topbar .nav-search-trigger,.website .topbar .avatar-button,.website .topbar .header-team')){
   element.style.setProperty('color',p.fg,'important');
  }
  const communityLogo=document.querySelector('.website .topbar .brand>img.cc-wordmark');
  if(communityLogo)communityLogo.style.setProperty('filter',p.scheme==='light'?'none':'invert(1)','important');
  const share=document.querySelector('.website .topbar .header-submit');
  if(share){
   share.style.setProperty('background-color',p.primary,'important');
   share.style.setProperty('color',p.onPrimary,'important');
  }
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',p.bg);
  document.querySelectorAll('.cc-theme-option').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.ccThemeOption===p.id)));
  document.querySelectorAll('.cc-theme-trigger').forEach(el=>el.setAttribute('aria-label','Theme: '+p.name+'. Choose another theme'));
  if(persist)save(p.id);
  window.dispatchEvent(new CustomEvent('clothcraft:theme-changed',{detail:{theme:p.id}}));
 }
 // Add overrides after old author styles so the palette can replace hard-coded
 // charcoal, even on legacy pages and marketplace subroutes.
  // A module import has no document.currentScript. Resolve assets from the site
  // root so /marketplace/ loads the same sheets as the static marketing pages.
  const stylesheetBase=document.currentScript?.src||new URL('/site-theme-grid-20261102.js',location.href).href;
  for(const file of ['site-header-grid-themes-20261102.css','site-theme-content-20261102.css','site-theme-deep-20261102.css','site-header-final-20261102.css','site-ruler-contrast-glass-20261102.css','site-header-search-profile-20261102.css']){
   const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL(file,stylesheetBase).href;document.head.append(sheet);
  }
 apply(getSaved()||'charcoal',false);
 // The homepage's dark Earth hero is not recolored by light themes. Ruler
 // markings follow the surface behind them as the user scrolls away from it.
 const heroBehindRuler=document.querySelector('.hero-sticky');
 if(heroBehindRuler){
  let queued=false;
  const syncRulerSurface=()=>{
   queued=false;
   const rect=heroBehindRuler.getBoundingClientRect();
   document.body.classList.toggle('cc-ruler-on-media',rect.top<innerHeight&&rect.bottom>Math.max(170,innerHeight*.58));
  };
  const scheduleRulerSync=()=>{if(!queued){queued=true;requestAnimationFrame(syncRulerSurface)}};
  addEventListener('scroll',scheduleRulerSync,{passive:true});
  addEventListener('resize',scheduleRulerSync,{passive:true});
  scheduleRulerSync();
 }
 function mount(){
  const host=document.querySelector('.header#site-header .nav-actions')||document.querySelector('.website .topbar .top-actions')||document.querySelector('.cc-download-grid-header .cc-download-header-actions');
  if(!host||host.querySelector('.cc-theme-cell'))return;
  const cell=host.querySelector('[data-cc-theme-mount]')||document.createElement('div');
  cell.classList.add('cc-theme-cell');
  const trigger=document.createElement('button');trigger.className='cc-theme-trigger';trigger.type='button';trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','cc-theme-options');trigger.innerHTML='<span class="cc-theme-symbol" aria-hidden="true">◐</span>';trigger.title='Change color theme';
  const panel=document.createElement('div');panel.className='cc-theme-panel';panel.id='cc-theme-options';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Choose color theme');
  const heading=document.createElement('div');heading.className='cc-theme-panel-head';heading.innerHTML='<strong>Color theme</strong><small>NEUTRAL + MIXED TONES</small>';
  const options=document.createElement('div');options.className='cc-theme-options';
  for(const palette of PALETTES){const button=document.createElement('button');button.type='button';button.className='cc-theme-option';button.dataset.ccThemeOption=palette.id;button.setAttribute('aria-pressed',String(palette.id===current));button.innerHTML='<span class="cc-theme-dot" aria-hidden="true"><i style="background:'+palette.bg+'"></i><i style="background:'+palette.panel+'"></i><i style="background:'+(palette.accent||palette.primary)+'"></i></span><span>'+palette.name+'</span>';button.addEventListener('click',()=>{apply(palette.id);setOpen(false);trigger.focus({preventScroll:true})});options.append(button)}
  const help=document.createElement('p');help.className='cc-theme-help';help.textContent='Your choice stays saved in this browser and carries between Studio and Community pages.';
  // Place the selector as a top-level popover. Some legacy marketplace menus
  // create their own high stacking contexts and otherwise block swatch clicks.
  panel.append(heading,options,help);cell.append(trigger);document.body.append(panel);
  // Keep Download/Marketplace aligned as distinct grid cells on the right.
  const found=host.querySelector('.nav-download,.cc-return-download');
  if(!cell.isConnected){if(found&&found.parentElement===host)host.insertBefore(cell,found);else host.prepend(cell)}
  function setOpen(open){
   panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));
   if(open){
    const rect=trigger.getBoundingClientRect();
    panel.style.top=Math.max(0,Math.min(innerHeight-52,rect.bottom+2))+'px';
   // Keep all swatches reachable on narrow screens even when the theme icon
   // sits toward the left of the header rather than at the viewport edge.
   const maxRight=Math.max(10,innerWidth-panel.offsetWidth-12);
   panel.style.right=Math.min(maxRight,Math.max(10,innerWidth-rect.right))+'px';
   }
  }
  if((host.closest('#site-header')||host.closest('.website .topbar'))&&!host.querySelector('.cc-launch-app')){
   const launch=document.createElement('button');launch.type='button';launch.className='cc-launch-app';launch.disabled=true;
   launch.setAttribute('aria-label','Launch App (coming soon)');launch.title='App launcher is coming soon';
   launch.innerHTML='Launch App <span aria-hidden="true">↗</span>';host.append(launch);
  }
  const searchScript=document.createElement('script');
  searchScript.src=new URL('site-header-search-profile-20261102.js',stylesheetBase).href;
  document.body.append(searchScript);
  trigger.addEventListener('click',()=>setOpen(panel.hidden));
  document.addEventListener('pointerdown',e=>{if(!cell.contains(e.target)&&!panel.contains(e.target))setOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){setOpen(false);trigger.focus({preventScroll:true})}});
  apply(current,false);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 window.addEventListener('storage',e=>{if(e.key===KEY)apply(e.newValue||'charcoal',false)});
})();

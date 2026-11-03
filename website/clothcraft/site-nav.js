// Shared navigation for ClothCraft's static interior pages.
const header=document.querySelector('#site-header');
const nav=document.querySelector('#nav');
const menu=document.querySelector('.menu');
const dropdowns=[...document.querySelectorAll('.nav-dropdown')];
function closeMobile(){nav.classList.remove('active');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation menu')}
menu.addEventListener('click',()=>{const active=nav.classList.toggle('active');menu.setAttribute('aria-expanded',String(active));menu.setAttribute('aria-label',active?'Close navigation menu':'Open navigation menu')});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{closeMobile();dropdowns.forEach(d=>d.open=false)}));
function closeDropdowns(except=null){dropdowns.forEach(d=>{if(d!==except)d.open=false})}
dropdowns.forEach(d=>d.addEventListener('toggle',()=>{if(d.open)closeDropdowns(d)}));
document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target))closeDropdowns()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeDropdowns();closeMobile();menu.focus()}});
window.addEventListener('scroll',()=>{header.classList.toggle('is-scrolled',window.scrollY>10)},{passive:true});
// Share the editorial scroll system across every interior page without requiring
// each standalone document to maintain another asset reference.
const ccScrollScript=document.createElement('script');
ccScrollScript.src=new URL('./site-scroll-motion-20261101.js',document.currentScript.src).href;
document.body.append(ccScrollScript);

// Same visual and interaction engine as the homepage on editorial pages.
if(!document.querySelector('#cc-measure-rail')){
 const source=document.currentScript.src;
 for(const name of ['site-artcraft-inspired-20261101.css','site-hero-ruler-20261101.css','ruler-typography-refinement-20261101.css']){
   if([...document.querySelectorAll('link[rel=stylesheet]')].some(x=>x.href===new URL(name,source).href))continue;
   const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(name,source).href;document.head.append(link);
 }
 const script=document.createElement('script');script.src=new URL('site-ruler-shared-20261101.js',source).href;document.body.append(script);
 const flight=document.createElement('script');flight.src=new URL('site-ruler-flight-20261102.js',source).href;document.body.append(flight);
 const finalStyles=document.createElement('link');finalStyles.rel='stylesheet';finalStyles.href=new URL('ruler-typography-refinement-20261101.css',source).href;document.head.append(finalStyles);
}

// Shared persistent theme picker and compact header grid.
const ccThemeScript=document.createElement('script');
ccThemeScript.src=new URL('./site-theme-grid-20261102.js',document.currentScript.src).href;
document.body.append(ccThemeScript);

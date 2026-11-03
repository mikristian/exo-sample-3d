const header=document.querySelector('.header');
const nav=document.querySelector('#nav');
const menu=document.querySelector('.menu');
if(header&&nav&&menu){
 const close=()=>{nav.classList.remove('active');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation menu')};
 menu.addEventListener('click',()=>{const open=nav.classList.toggle('active');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu')});
 nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reducedMotion&&'IntersectionObserver'in window){
 document.documentElement.classList.add('js-enabled');
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.07});
 document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

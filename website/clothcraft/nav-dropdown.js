(() => {
  const header=document.querySelector('#site-header');if(!header)return;
  const details=[...header.querySelectorAll('.nav-dropdown')];
  details.forEach(item=>item.addEventListener('toggle',()=>{if(item.open)details.forEach(other=>{if(other!==item)other.open=false})}));
  header.addEventListener('click',event=>{
    if(event.target.closest('.nav-menu a'))details.forEach(item=>item.open=false);
  });
  document.addEventListener('click',event=>{if(!header.contains(event.target))details.forEach(item=>item.open=false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')details.forEach(item=>item.open=false)});
  window.addEventListener('resize',()=>{if(window.innerWidth>1040)header.querySelector('#nav')?.classList.remove('active')});
  const path=window.location.pathname;
  header.querySelectorAll('a[href]').forEach(link=>{const href=link.getAttribute('href');if(href==='/'?path==='/' :href.startsWith('/')&&href.length>1&&path.startsWith(href))link.setAttribute('aria-current','page')});
  const onScroll=()=>header.classList.toggle('is-scrolled',window.scrollY>8);
  document.addEventListener('scroll',onScroll,{passive:true});onScroll();
})();

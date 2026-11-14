/* Standalone ClothCraft pages can use the same interior ruler without
   importing the main-site navigation or replacing their own application UI. */
(()=>{
  if(location.pathname.startsWith('/marketplace/')||location.pathname.startsWith('/community/'))return;
  if(document.querySelector('.cc-page-ruler,#cc-measure-rail'))return;
  if(!document.querySelector('main > section'))return;
  const base=new URL('./',document.currentScript.src);
  for(const file of ['site-artcraft-inspired-20261101.css','site-hero-ruler-20261101.css','ruler-typography-refinement-20261101.css']){
    if([...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>x.href===new URL(file,base).href))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(file,base).href;document.head.append(link);
  }
  const script=document.createElement('script');script.src=new URL('site-ruler-shared-20261101.js',base).href;document.body.append(script);
  const last=document.createElement('link');last.rel='stylesheet';last.href=new URL('ruler-typography-refinement-20261101.css',base).href;document.head.append(last);
})();

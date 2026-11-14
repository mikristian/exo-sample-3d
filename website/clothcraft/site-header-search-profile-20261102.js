/* Shared, accessible header search for Studio Home and Community. */
(()=>{
  'use strict';
  const icon='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.5"></circle><path d="m16 16 4.3 4.3"></path></svg>';
  function mount(){
    const host=document.querySelector('.header#site-header .nav-actions, .website .topbar .top-actions');
    if(!host||host.querySelector('.cc-header-search'))return;
    const community=!!host.closest('.website .topbar');
    const search=document.createElement('div');
    search.className='cc-header-search';
    let trigger=host.querySelector('#top-search-trigger');
    if(trigger){
      trigger.before(search);
      search.append(trigger);
      trigger.replaceChildren();
    }else{
      trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='nav-search-trigger';
      trigger.setAttribute('aria-label','Search marketplace');
      const theme=host.querySelector('.cc-theme-cell');
      if(theme)theme.before(search);else host.prepend(search);
      search.append(trigger);
    }
    trigger.innerHTML=icon;
    trigger.title='Search';
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls','cc-header-search-panel');
    const form=document.createElement('form');
    form.id='cc-header-search-panel';
    form.className='cc-header-search-panel';
    form.role='search';
    form.method='get';
    form.action='/marketplace/';
    form.hidden=true;
    form.innerHTML='<label for="cc-header-search-input">Search the Marketplace</label><div class="cc-header-search-field"><input id="cc-header-search-input" name="q" type="search" placeholder="Patterns, fabrics, designers…" autocomplete="off" aria-label="Search Marketplace"><button type="submit" aria-label="Submit search">'+icon+'</button></div>';
    search.append(form);
    const field=form.querySelector('input');
    const setOpen=(open,restore=false)=>{
      form.hidden=!open;
      trigger.setAttribute('aria-expanded',String(open));
      if(open)field.focus({preventScroll:true});
      else if(restore)trigger.focus({preventScroll:true});
    };
    trigger.addEventListener('click',()=>setOpen(form.hidden));
    document.addEventListener('pointerdown',event=>{if(!search.contains(event.target)&&!form.hidden)setOpen(false)});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!form.hidden){event.preventDefault();setOpen(false,true)}
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setOpen(true);
      }
    });
    form.addEventListener('submit',event=>{
      const query=field.value.trim();
      if(!query){event.preventDefault();field.focus();return}
      if(community){
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('clothcraft:header-search',{detail:{query}}));
        setOpen(false);
      }
    });
    if(!community&&!host.querySelector('.cc-header-profile')){
      const profile=document.createElement('a');
      profile.className='cc-header-profile';
      profile.href='/marketplace/#profile';
      profile.setAttribute('aria-label','View designer profile');
      profile.title='Designer profile';
      profile.textContent='MK';
      const launch=host.querySelector('.cc-launch-app');
      if(launch)launch.before(profile);else host.append(profile);
    }
    // Launch App remains the final placeholder; the profile is immediately to its left.
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();

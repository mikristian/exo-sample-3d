(()=>{'use strict';if(location.pathname==='/'||location.pathname.endsWith('/clothcraft/index.html'))return;
const main=document.querySelector('main');if(!main)return;
const hero=main.querySelector(':scope > .page-hero, :scope > .about-v2-hero, :scope > .cc-hub-hero');if(!hero)return;
hero.classList.add('cc-interior-hero');
for(const element of hero.querySelectorAll('.cc-hero-geometry,.cc-hero-media,.cc-hero-number,.cc-hero-bottom-rule'))element.remove();
const titles={product:'PRODUCT / STUDIO',features:'FEATURES / TOOLSET',solutions:'SOLUTIONS / WORKFLOWS',about:'ABOUT / THE PROJECT','open-source':'OPEN SOURCE / COMMUNITY',support:'SUPPORT / HELP',investors:'INVESTORS / SUPPORT',development:'DEVELOPMENT / PROGRESS',contribute:'CONTRIBUTE / HELP BUILD',ideas:'COMMUNITY / IDEAS',faq:'RESOURCES / FAQ',news:'RESOURCES / NEWS','press-kit':'RESOURCES / PRESS'};
const slug=location.pathname.split('/').filter(Boolean)[0];const label=titles[slug]||'CLOTHCRAFT / STUDIO';
let overline=hero.querySelector('.cc-hero-overline');if(!overline){overline=document.createElement('span');overline.className='cc-hero-overline';hero.querySelector('h1')?.before(overline)}overline.textContent=label;
})();

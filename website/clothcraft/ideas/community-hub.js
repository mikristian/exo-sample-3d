import {mountForumPage} from '../marketplace/community-social.js';
const tabs=[...document.querySelectorAll('[data-hub-tab]')];
const panels=[...document.querySelectorAll('[data-hub-panel]')];
const forum=document.getElementById('cc-hub-market-forum');
let unmountForum=null;
function activate(){const requested=location.hash.slice(1);const key=['ideas','forum','updates'].includes(requested)?requested:'ideas';for(const tab of tabs){const active=tab.dataset.hubTab===key;tab.classList.toggle('is-active',active);if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current')}for(const panel of panels)panel.hidden=panel.dataset.hubPanel!==key;if(key==='forum'&&!unmountForum){unmountForum=mountForumPage(forum,{projects:[]})}}
window.addEventListener('hashchange',activate);activate();
const updates=[
{date:'2026-11-01',category:'DEVELOPMENT EVIDENCE',title:'Tracking actual checkpoints',text:'The current development dashboard summarizes 31 of 49 presence-based checkpoints across eight areas. Coverage is not certification of fit, factory acceptance or industrial parity.',url:'/development/'},
{date:'2026-11-01',category:'COMMUNITY',title:'Help validate the real workflows',text:'ClothCraft is seeking permitted graded patterns, factory receiving examples, technical packs and accurate material measurements to turn difficult cases into reproducible tests.',url:'/contribute/'},
{date:'2026-11-01',category:'ROADMAP',title:'A more complete developer-facing feature map',text:'Explore existing drafting, grading, simulation, manufacturing and native-desktop work, alongside explicitly identified remaining gaps.',url:'/features/'}
];
const host=document.getElementById('cc-hub-news-list');for(const item of updates){const card=document.createElement('article');card.className='cc-news-card';const date=document.createElement('span');date.textContent=item.date+' / '+item.category;const h=document.createElement('h3');h.textContent=item.title;const p=document.createElement('p');p.textContent=item.text;const a=document.createElement('a');a.href=item.url;a.textContent='Read more ↗';card.append(date,h,p,a);host.append(card)}
window.addEventListener('pagehide',()=>unmountForum?.(),{once:true});

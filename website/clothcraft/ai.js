(() => {
 const target=document.querySelector('.page-section.alt .info-inline');
 if(target&&!document.querySelector('.ai-console'))target.insertAdjacentHTML('afterend',`<div class="ai-console" style="margin-top:35px"><div class="ai-modes" role="tablist" aria-label="AI connection mode"><button type="button" role="tab" id="ai-hosted-tab" aria-selected="true" aria-controls="ai-hosted-panel">Hosted AI credits</button><button type="button" role="tab" id="ai-local-tab" aria-selected="false" aria-controls="ai-local-panel">Local / bring your own</button></div>
 <div class="ai-mode-panel" id="ai-hosted-panel" role="tabpanel" aria-labelledby="ai-hosted-tab"><div class="ai-status-line"><span class="eyetag">CLOTHCRAFT HOSTED AI</span><strong id="ai-hosted-state">Checking service configuration…</strong></div><p>Hosted AI credits require a verified account, server-side provider integration, metering and secure payment fulfillment.</p><div class="ai-balance">Current credit balance <strong id="ai-balance-value">Unavailable</strong></div><button type="button" class="btn btn-glass" id="ai-check-status">Check connection status ↻</button><a class="btn btn-blue" href="/pricing/">Explore credit plans ↗</a><p id="ai-service-message" class="page-note" role="status">Connection status is based on the local server configuration, not a mock sign-in.</p></div>
 <div class="ai-mode-panel" id="ai-local-panel" role="tabpanel" aria-labelledby="ai-local-tab" hidden><div class="ai-status-line"><span class="eyetag">YOUR HARDWARE, YOUR WORKFLOW</span><strong>No subscription required for source access</strong></div><p>Explore local model or third-party provider integrations as they become supported. API keys should only be entered into trusted application settings, never into a public marketing page.</p><a class="btn btn-white" href="https://github.com/erythrofr/ClothCraft" target="_blank" rel="noopener noreferrer">Browse integration source ↗</a></div></div>`);
 const tabs=[...document.querySelectorAll('.ai-modes [role="tab"]')];if(!tabs.length)return;
 function switchTab(tab){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));document.getElementById(t.getAttribute('aria-controls')).hidden=!active})}
 tabs.forEach(tab=>tab.addEventListener('click',()=>switchTab(tab)));
 const state=document.getElementById('ai-hosted-state');
 const balance=document.getElementById('ai-balance-value');
 const message=document.getElementById('ai-service-message');
 const control=document.getElementById('ai-check-status');
 async function check(){control.disabled=true;state.textContent='Checking…';
  try{
   const res=await fetch('/api/commerce/config',{credentials:'same-origin'});if(!res.ok)throw Error('Service is offline');
   const cfg=await res.json();
   if(!cfg.checkoutEnabled){state.textContent='Not yet connected';balance.textContent='Unavailable';message.textContent='Hosted credits are not active. A trusted account service, Stripe billing and usage metering must be configured first.';return}
   state.textContent='Billing configured · account check required';
   const b=await fetch('/api/commerce/balance',{credentials:'same-origin'});
   if(!b.ok){balance.textContent='Sign-in required';message.textContent='Credit balance is available only to a verified account. No demo balance is fabricated.';return}
   const data=await b.json();balance.textContent=Number.isSafeInteger(data.credits)?`${data.credits.toLocaleString()} credits`:'Unavailable';message.textContent='Balance retrieved from the configured server-side credit ledger. AI model generation must be separately enabled.';
  }catch(e){state.textContent='Service unavailable';balance.textContent='Unavailable';message.textContent='This preview has no live AI service configured.'}
  finally{control.disabled=false}
 }
 control.addEventListener('click',check);check();
})();

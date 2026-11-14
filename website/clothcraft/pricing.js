// Concept-only AI pricing preview. Neither billing intervals nor purchase controls
// create an offer or enable checkout until plans are formally launched.
const cycleControls=[...document.querySelectorAll('[data-cycle]')];
const message=document.querySelector('#billing-message');
const buttons=[...document.querySelectorAll('.billing-checkout')];
buttons.forEach(button=>{button.disabled=true;});
cycleControls.forEach(button=>button.addEventListener('click',()=>{
  const yearly=button.dataset.cycle==='yearly';
  cycleControls.forEach(control=>control.setAttribute('aria-pressed',String(control===button)));
  document.querySelectorAll('.ai-plan-grid .plan-card').forEach(card=>{
    const price=card.querySelector('[data-baseprice]');
    if(!price)return;
    const monthly=Number(price.dataset.baseprice);
    price.textContent=yearly?'$'+Math.round(monthly*12*.85):'$'+monthly;
    card.querySelector('.plan-price span').textContent=yearly?'/year':'/month';
  });
  if(message)message.textContent=yearly
    ?'Annual figures are hypothetical estimates with a 15% illustrative discount. No annual plan is available; checkout remains disabled.'
    :'Monthly AI prices are proposals, subject to change. Checkout is disabled and no AI credits can be purchased.';
}));

/* Prepare a GitHub issue; do not invent an asset upload backend. */
(() => {
  'use strict';
  const form=document.getElementById('cc-asset-donation-form');
  if(!form)return;
  const category=form.querySelector('[name="category"]');
  const output=document.getElementById('cc-asset-proposal-result');
  const link=document.getElementById('cc-asset-proposal-link');
  const copyButton=document.getElementById('cc-asset-copy-proposal');
  const issueEndpoint='https://github.com/erythrofr/ClothCraft/issues/new';
  let prepared='';
  function updateSelection(kind){
    if(![...category.options].some(option=>option.value===kind))return;
    category.value=kind;
    output.hidden=true;
    document.getElementById('donation-form').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    category.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-choose-asset]').forEach(button=>button.addEventListener('click',()=>updateSelection(button.dataset.chooseAsset)));
  function prepare(data){
    const line=k=>String(data.get(k)||'').trim();
    const body=[
      '## Community 3D asset donation proposal',
      '',
      '> This is a proposal only. No files have been transferred or approved.',
      '',
      '**Asset:** '+line('asset'),
      '**Category:** '+line('category'),
      '**Creator:** '+line('creator'),
      '**Preferred format:** '+line('format'),
      '**Proposed license:** '+line('license'),
      '**Dimensions & intended use:**',
      line('dimensions'),
      '',
      '**Model details & reuse value:**',
      line('description'),
      '',
      '**Public reference:** '+(line('reference')||'Not provided'),
      '',
      '**Rights confirmation:** I created the asset or have explicit permission to redistribute it. No confidential or unlicensed material is included.',
      '',
      '## Requested maintainer review',
      '- [ ] Confirm redistribution license and provenance',
      '- [ ] Confirm file format and all dependent textures',
      '- [ ] Check dimensions, geometry, normals and UVs',
      '- [ ] Decide whether it fits the proposed native community library',
      '',
      'Please advise on a safe way to share the files after licensing is agreed. The proposal does not authorize automatic publication.'
    ].join('\n');
    const title='[Community 3D asset] '+line('category')+' — '+line('asset');
    const url=new URL(issueEndpoint);
    url.searchParams.set('title',title.slice(0,160));
    url.searchParams.set('body',body);
    return {body,url:url.toString()};
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const data=new FormData(form);
    if(data.get('rights')!=='on')return;
    const proposal=prepare(data);
    prepared=proposal.body;
    link.href=proposal.url;
    output.hidden=false;
    copyButton.textContent='Copy proposal text';
    output.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  form.addEventListener('input',event=>{
    if(event.target!==copyButton)output.hidden=true;
  });
  copyButton.addEventListener('click',async()=>{
    if(!prepared)return;
    try{
      await navigator.clipboard.writeText(prepared);
      copyButton.textContent='Proposal copied';
    }catch{
      copyButton.textContent='Use the GitHub link to review the proposal';
    }
  });
})();

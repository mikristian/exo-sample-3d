// ClothCraft Studio V2 development download is hosted through the verified EXO GitHub release.
const MAC_DMG_URL='https://github.com/mikristian/exo-sample-3d/releases/download/v0.3.0-dev-20261101/EXO-ClothCraft-Studio-V2-macOS-Apple-Silicon-2026-11-01.dmg';
const btn=document.querySelector('#macos-primary-download');
if(btn){btn.href=MAC_DMG_URL;btn.dataset.ready='true';btn.target='_blank';btn.rel='noopener noreferrer';btn.textContent='Download for Mac  ↓'}
const quick=document.querySelector('#hero-macos-download');
if(quick){quick.href=MAC_DMG_URL;quick.target='_blank';quick.rel='noopener noreferrer'}
const state=document.querySelector('#macos-state');if(state)state.textContent='Mac download available · Apple Silicon';
const card=document.querySelector('#macos-downloads');if(card)card.innerHTML='<p class="download-empty">EXO ClothCraft Studio V2 · Apple Silicon · 877 MiB · 1 November 2026. <a href="https://github.com/mikristian/exo-sample-3d/releases/tag/v0.3.0-dev-20261101" target="_blank" rel="noopener noreferrer">Release and checksum details ↗</a></p>';
const status=document.querySelector('#release-heading');if(status)status.textContent='ClothCraft Studio V2 for Mac';
const detail=document.querySelector('#release-detail');if(detail)detail.textContent='Download the packaged Apple Silicon build. This software is under development and is not Apple notarized.';
const live=document.querySelector('#hero-download-live');if(live)live.textContent='APPLE SILICON DOWNLOAD AVAILABLE';
const refresh=document.querySelector('#check-releases');if(refresh)refresh.hidden=true;

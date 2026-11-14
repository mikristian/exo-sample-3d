/* ClothCraft editorial motion — shared by the marketing pages.
 * Native browser APIs only; scroll work is batched into one animation frame.
 * This layer never changes application workspaces, network data, or navigation.
 */
(() => {
  'use strict';
  if (window.__clothcraftEditorialMotion) return;
  window.__clothcraftEditorialMotion = true;

  const main = document.querySelector('main');
  if (!main) return;
  const source = document.currentScript?.src || location.href;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./site-scroll-motion-20261101.css', source).href;
  document.head.append(stylesheet);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsObserver = 'IntersectionObserver' in window;
  const motionEnabled = !reduced.matches && supportsObserver;
  const isLanding = location.pathname === '/' || location.pathname.endsWith('/clothcraft/index.html');
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const ease = value => value * value * (3 - 2 * value);
  const root = document.documentElement;

  const mainSections = [...main.children].filter(element =>
    element.matches('section') &&
    !element.hasAttribute('hidden')
  );
  // Keep scroll motion on major section titles only. Animating letters in
  // smaller card h3 headings was making ordinary information unreadable.
  const allHeadings=[...main.querySelectorAll('section h2')].filter(h=>
    !h.matches('[data-no-kinetic]')&&!h.closest('.story-step,.cc-app-launch,.cc-hero-orbit')&&
    h.textContent.trim().length>=8&&h.textContent.trim().length<165&&
    !h.querySelector('a,button,svg,input,textarea'));
  // SplitType / Codrops-inspired progressive letters. Unlike whole-heading
  // translate/opacity, each glyph receives a bounded scroll-scrubbed reveal.
  // We keep text in the DOM (never flatten headlines into SVG outlines).
  const motionStyles=['letters'];
  const headingEntries=[];
  const activeHeadings=new Set();
  const graphemes=text=>('Segmenter' in Intl?
    [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>s.segment):[...text]);
  function splitReadableHeading(heading){
    // innerText inserts the proper separator for authored <br> line breaks,
    // where textContent would incorrectly join "First line.Second line".
    const label=(heading.innerText||heading.textContent).replace(/\s+/gu,' ').trim();
    if(!label||heading.querySelector('.cc-letter-glyph'))return [];
    heading.setAttribute('aria-label',label);
    const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
    const texts=[];
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.nodeValue?.trim()&&!node.parentElement?.closest('svg,button,a,script,style'))texts.push(node);
    }
    const chars=[],sizedWords=[];
    for(const node of texts){
      const fragment=document.createDocumentFragment();
      const sourceText=node.nodeValue;
      for(const match of sourceText.matchAll(/\s+|[^\s]+/gu)){
        const token=match[0];
        if(/^\s+$/u.test(token)){fragment.append(document.createTextNode(token));continue}
        // Measure BEFORE changing the DOM. This lets each split word occupy
        // its original exact space, avoiding extra line wraps and scroll jumps.
        const range=document.createRange();
        range.setStart(node,match.index);range.setEnd(node,match.index+token.length);
        const originalWidth=range.getBoundingClientRect().width;
        const word=document.createElement('span');
        word.className='cc-letter-word';word.setAttribute('aria-hidden','true');
        if(originalWidth>0)word.style.width=originalWidth.toFixed(3)+'px';
        const paint=document.createElement('span');paint.className='cc-letter-paint';
        for(const symbol of graphemes(token)){
          const glyph=document.createElement('span');
          glyph.className='cc-letter-glyph';glyph.textContent=symbol;
          glyph.style.setProperty('--cc-letter-progress','1');
          paint.append(glyph);chars.push(glyph);
        }
        word.append(paint);sizedWords.push({paint,originalWidth});
        fragment.append(word);
      }
      node.replaceWith(fragment);
    }
    for(const {paint,originalWidth} of sizedWords){
      const width=paint.getBoundingClientRect().width;
      if(width>0&&originalWidth>0)paint.style.setProperty('--cc-word-correction',(originalWidth/width).toFixed(6));
    }
    return chars;
  }
  function assignHeading(heading,index){
    const section=heading.closest('section');
    const sectionIndex=mainSections.indexOf(section);
    // Each page receives a different starting point; individual sections do not all twist.
    const pageKey=[...location.pathname].reduce((acc,char)=>acc+char.charCodeAt(0),0);
    const mode=heading.dataset.motion||motionStyles[(Math.max(0,sectionIndex)*3+index+pageKey)%motionStyles.length];
    heading.classList.add('cc-motion-heading','cc-motion-'+mode);
    heading.dataset.motion=mode;
    // Only the occasional scatter treatment uses character wrapping.
    if(mode==='scatter'){
      const full=heading.textContent.replace(/\s+/g,' ').trim();
      heading.setAttribute('aria-label',full);
      const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);const nodes=[];
      while(walker.nextNode())if(walker.currentNode.nodeValue?.trim())nodes.push(walker.currentNode);
      let charIndex=0;
      for(const node of nodes){const fragment=document.createDocumentFragment();for(const chunk of node.nodeValue.match(/\s+|[^\s]+/gu)||[]){
        if(/^\s+$/.test(chunk)){fragment.append(document.createTextNode(chunk));continue}
        const word=document.createElement('span');word.className='cc-kinetic-word';word.setAttribute('aria-hidden','true');
        for(const char of chunk){const glyph=document.createElement('span');glyph.className='cc-kinetic-char';glyph.textContent=char;
          glyph.style.setProperty('--cc-char-x',`${Math.sin(charIndex*1.3)*8}px`);
          glyph.style.setProperty('--cc-char-y',`${Math.cos(charIndex*.9)*7}px`);word.append(glyph);charIndex++}fragment.append(word)}node.replaceWith(fragment)}
    }
    const originalMarkup=heading.innerHTML;
    const chars=mode==='letters'?splitReadableHeading(heading):[];
    headingEntries.push({heading,mode,chars,originalMarkup});
  }
  const headingGlyphs=new Map();
  if(motionEnabled){allHeadings.forEach((heading,index)=>{assignHeading(heading,index);headingGlyphs.set(heading,headingEntries.at(-1).chars)});const headingObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.isIntersecting)activeHeadings.add(entry.target);else activeHeadings.delete(entry.target)}requestFrame()
  },{rootMargin:'16% 0px 16% 0px',threshold:0});headingEntries.forEach(({heading})=>headingObserver.observe(heading))}
  // Following SplitType's responsive approach: remeasure the natural
  // typography when a font resolves or the viewport changes. Otherwise
  // fixed word widths measured at startup could drift after a resize.
  function reflowLetters(){
    if(!motionEnabled)return;
    for(const entry of headingEntries){
      if(entry.mode!=='letters'||!entry.heading.isConnected)continue;
      entry.heading.innerHTML=entry.originalMarkup;
      entry.chars=splitReadableHeading(entry.heading);
      headingGlyphs.set(entry.heading,entry.chars);
    }
    requestFrame();
  }
  let letterReflowTimer=0;
  if(motionEnabled){
    document.fonts?.ready?.then(reflowLetters);
    window.addEventListener('resize',()=>{
      clearTimeout(letterReflowTimer);
      letterReflowTimer=setTimeout(reflowLetters,170);
    },{passive:true});
  }

  const revealSelectors = [
    '.page-card', '.page-highlight', '.page-screenshot', '.page-split > div',
    '.feature-matrix-row', '.hero-image-strip img',
    '.cc-deep-card', '.cc-deep-table', '.cc-progress-row',
    '.cc-hub-card', '.cc-hub-article', '.cc-news-card', '.cc-faq-category',
    '.about-v2-evidence-card', '.about-v2-honesty-row', '.about-v2-paths > a',
    '.support-list > a', '.download-workflow-grid > article',
    '.platform-card', '.plan-card', '.credit-pack'
  ].join(',');
  const revealNodes = [...main.querySelectorAll(revealSelectors)]
    .filter(el => !el.closest('[hidden]') &&
      !el.classList.contains('reveal') &&
      !el.classList.contains('cc-reveal-target'));
  if (motionEnabled) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('cc-motion-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .06, rootMargin: '0px 0px -32px 0px' });
    revealNodes.forEach((element, index) => {
      element.classList.add('cc-motion-enter');
      element.style.setProperty('--cc-enter-delay', `${(index % 4) * 65}ms`);
      revealObserver.observe(element);
    });
  }

  // Only images whose existing frame already clips content receive parallax.
  const media = [...main.querySelectorAll(
    '.page-screenshot img, .about-v2-image-wrap img, .hero-image-strip img, .download-workflow-grid img'
  )].filter(img => img.closest('section') && !img.closest('a[href*="download"]'));
  const activeMedia = new Set();
  if (motionEnabled) {
    const mediaObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeMedia.add(entry.target);
        else activeMedia.delete(entry.target);
      }
      requestFrame();
    }, { rootMargin: '14% 0px 14% 0px' });
    media.forEach(img => {
      img.classList.add('cc-motion-media');
      mediaObserver.observe(img);
    });
  }

  let queued = false;
  function drawFrame() {
    queued = false;
    const vh = Math.max(1, window.innerHeight);
    for (const heading of activeHeadings) {
      const rect=heading.getBoundingClientRect();
      const entry=ease(clamp((vh*.96-rect.top)/(vh*.68)));
      const departure=ease(clamp((vh*.14-rect.bottom)/(vh*.45)));
      heading.style.setProperty('--cc-motion-progress',entry.toFixed(4));
      heading.style.setProperty('--cc-motion-exit',departure.toFixed(4));
      const glyphs=headingGlyphs.get(heading);
      if(glyphs?.length){
        const stagger=.24/Math.max(1,glyphs.length-1);
        glyphs.forEach((glyph,i)=>{
          // A subtle, reversible sequential reveal; keep glyphs at least 40%
          // visible rather than breaking headline readability during scrolling.
          const local=ease(clamp((entry-i*stagger)/(1-i*stagger)));
          glyph.style.setProperty('--cc-letter-progress',local.toFixed(4));
        });
      }
      // Scatter is now only one editorial treatment among six.
      if(heading.classList.contains('cc-motion-scatter'))heading.style.setProperty('--cc-scatter',((1-entry)*.5+departure*.15).toFixed(4));
    }
    for (const img of activeMedia) {
      const rect = img.getBoundingClientRect();
      const offset = clamp((rect.top + rect.height / 2 - vh / 2) / vh, -1, 1);
      img.style.setProperty('--cc-media-shift', `${Math.round(-offset * 16)}px`);
    }

  }
  function requestFrame() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(drawFrame);
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame, { passive: true });
  window.addEventListener('load', requestFrame, { once: true });
  document.fonts?.ready?.then(requestFrame);
  if (motionEnabled) root.classList.add('cc-motion-on');
  else root.classList.add('cc-motion-reduced');
  requestFrame();
})();

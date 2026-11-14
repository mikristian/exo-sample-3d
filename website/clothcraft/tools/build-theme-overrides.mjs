// Regenerate site-theme-overrides.css after changing the website's source CSS.
// This remaps only interface paint to Studio V2 palette variables; images,
// video, content and layout remain owned by the original stylesheets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const paint=/^(?:color|background(?:-color)?|border(?:-[\w-]+)?|outline(?:-color)?|box-shadow|text-shadow|fill|stroke|text-decoration-color|filter)$/;
const hexColor=/#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})\b/gi;
const allowed=['style.css','site-pages.css'];
const assetDir=path.join(site,'clothcraft-assets');
const assetIndex=fs.readFileSync(path.join(assetDir,'index.html'),'utf8');
const assetCss=[...new Set([...assetIndex.matchAll(/<link[^>]+href="\.\/([\w-]+\.css)"/g)].map(m=>m[1]))];
const appPresets=fs.readFileSync(path.resolve(site,'../../src/core/studioThemePresets.js'),'utf8');
fs.writeFileSync(path.join(site,'site-theme-presets.js'),appPresets);
console.log('site-theme-presets.js: synchronized from original Studio V2 presets');

function parseHex(color){
  let raw=color.slice(1).toLowerCase();
  if(raw.length===3||raw.length===4)raw=[...raw].map(ch=>ch+ch).join('');
  const [r,g,b]=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16));
  const alpha=raw.length===8?parseInt(raw.slice(6,8),16)/255:1;
  const brightness=(r+g+b)/3;
  const blue=b>r*1.18&&b>g*1.06&&b-r>16;
  const vividBlue=b>r*1.20&&b>g*1.04&&b-r>22;
  return {r,g,b,alpha,brightness,blue,vividBlue};
}
function themeColor(color,property){
  const {r,g,b,alpha,brightness,blue,vividBlue}=parseHex(color);
  // Status lights/traffic-light indicators convey state, not the brand theme.
  if((r>g*1.55&&r>b*1.4&&r>110)||(g>r*1.4&&g>b*1.14&&g>110))return color;
  let token;
  if(property==='color'||property==='fill'||property==='stroke'||property==='text-decoration-color'){
    token=vividBlue&&brightness>72?'--site-accent':brightness<94?'--site-on-light':brightness>202?'--site-text':'--site-muted';
  }else if(property.startsWith('border')||property.startsWith('outline')){
    token=blue&&brightness>90?'--site-accent':'--site-border';
  }else if(property.includes('shadow')||property==='filter'){
    if(brightness<38&&!blue)return color;
    token=blue?'--site-accent':'--site-border';
  }else if(brightness>190){
    token='--site-light';
  }else if(vividBlue&&brightness>95){
    token='--site-accent';
  }else if(blue&&brightness>37){
    token='--site-tinted';
  }else if(brightness<17){
    token='--site-bg';
  }else if(brightness<26){
    token='--site-bg-alt';
  }else if(brightness<42){
    token='--site-panel';
  }else if(brightness<72){
    token='--site-raised';
  }else{
    token='--site-tinted';
  }
  const opaque=`var(${token})`;
  return alpha>=.999?opaque:`color-mix(in srgb, ${opaque} ${(alpha*100).toFixed(1)}%, transparent)`;
}
function flatGradient(selector){
  // Keep functional CAD-style rulers/checker grids (not decorative theme fills).
  if(/(?:ar-grid|ar-ruler|checkerboard|ruler-mark|seam-grid)/i.test(selector))return null;
  // A gallery's photographic cover should never be dimmed by a large solid
  // sheet merely because its previous design used a decorative gradient.
  if(/(?:carousel-gradient|gallery-media:after|media-image:after|exh-gallery-horizon)/i.test(selector))return 'transparent';
  if(/(?:overlay|shade|scrim|media:after|gradient|shadow|mask|:before|:after)/i.test(selector))return 'color-mix(in srgb, var(--site-bg) 63%, transparent)';
  if(/(?:hero|landing|cover|stage)/i.test(selector))return 'var(--site-bg)';
  if(/(?:section|workflow|band|footer)/i.test(selector))return 'var(--site-bg-alt)';
  return 'var(--site-panel)';
}
function transform(file){
  const source=postcss.parse(fs.readFileSync(file,'utf8'),{from:file});
  const dest=postcss.root();
  function visit(sourceNode,destNode){
    for(const node of sourceNode.nodes||[]){
      if(node.type==='atrule'){
        if(/keyframes$/i.test(node.name))continue;
        if(node.nodes){const nested=node.clone({nodes:[]});visit(node,nested);if(nested.nodes.length)destNode.append(nested);}
        continue;
      }
      if(node.type!=='rule'||node.selector.trim()===':root')continue;
      const changed=[];
      node.walkDecls(decl=>{
        hexColor.lastIndex=0;
        if(decl.parent===node&&/^(?:background|background-image)$/.test(decl.prop)&&/(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(decl.value)&&!/url\(/i.test(decl.value)){
          const solid=flatGradient(node.selector);
          if(solid!==null)changed.push(decl.clone({prop:'background',value:solid}));
          return;
        }
        if(decl.parent!==node||decl.prop.startsWith('--')||!paint.test(decl.prop)||!hexColor.test(decl.value)||/url\(/i.test(decl.value))return;
        hexColor.lastIndex=0;
        const value=decl.value.replace(hexColor,color=>themeColor(color,decl.prop));
        if(value!==decl.value)changed.push(decl.clone({value}));
        hexColor.lastIndex=0;
      });
      if(!changed.length)continue;
      const copy=postcss.rule({selector:node.selectors.map(sel=>sel.trim().startsWith('html')?sel.trim().replace(/^html\b/,'html[data-site-themed]'):`html[data-site-themed] ${sel.trim()}`).join(',')});
      for(const decl of changed)copy.append(decl);
      destNode.append(copy);
    }
  }
  visit(source,dest);
  return dest.toString();
}
function write(name,base,files){
  const output='/* AUTO-GENERATED by tools/build-theme-overrides.mjs. Do not edit by hand. */\n'+files.map(file=>`/* ${file} */\n${transform(path.join(base,file))}`).join('\n');
  fs.writeFileSync(path.join(site,name),output+'\n');
  console.log(`${name}: ${files.length} stylesheets, ${(output.length/1024).toFixed(1)} KB`);
}
write('site-theme-overrides.css',site,allowed);
write('site-theme-assets-overrides.css',assetDir,assetCss);

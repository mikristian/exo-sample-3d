import React from 'react'

// Never mount raw uploads. Parse, whitelist, and reconstruct a small SVG subset.
// No scripts, external resources, foreignObject, CSS URLs, event handlers or HTML.
export const SVG_FILE_LIMIT=160*1024
export const SVG_LIBRARY_LIMIT=12
const NS='http://www.w3.org/2000/svg'
const TAGS=new Set(['g','svg','defs','path','rect','circle','ellipse','line','polygon','polyline','clipPath','linearGradient','radialGradient','stop','use'])
const SHAPES=new Set(['path','rect','circle','ellipse','line','polygon','polyline'])
const ATTRS=new Set(['id','d','points','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','viewBox','preserveAspectRatio','transform','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','display','clip-path','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','href'])
const PAINT=new Set(['fill','stroke','stop-color'])
const STYLE=new Set(['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','display','clip-path','stop-color','stop-opacity'])
const REF=/^url\(\s*['"]?#([a-zA-Z_][\w.:-]{0,90})['"]?\s*\)$/
const HASH=/^#[a-zA-Z_][\w.:-]{0,90}$/
const COLOR=/^(?:none|currentColor|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,25}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/
const NUM=/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?(?:px|pt|mm|cm|in|%)?$/

function safe(name,value){
  if(typeof value!=='string'||value.length>14000||/[<>\\;]/.test(value))return false
  if(name==='href')return HASH.test(value)
  if(name==='clip-path')return value==='none'||REF.test(value)
  if(PAINT.has(name))return COLOR.test(value)||REF.test(value)
  if(['d'].includes(name))return /^[\d\s.,+\-eE MmLlHhVvCcSsQqTtAaZz]*$/.test(value)
  if(['points','viewBox','stroke-dasharray'].includes(name))return /^[\d\s.,+\-eE]*$/.test(value)
  if(['transform','gradientTransform'].includes(name))return value.length<=1000&&/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\d\s.,+\-eE]*\)\s*)*$/.test(value)
  if(name==='id')return /^[a-zA-Z_][\w.:-]{0,90}$/.test(value)
  if(['x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','offset','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-miterlimit','stroke-dashoffset','stop-opacity'].includes(name))return NUM.test(value)
  if(name==='display')return ['inline','block','none'].includes(value)
  if(name==='preserveAspectRatio')return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value)
  if(name==='gradientUnits')return ['objectBoundingBox','userSpaceOnUse'].includes(value)
  if(name==='spreadMethod')return ['pad','reflect','repeat'].includes(value)
  if(['fill-rule','clip-rule'].includes(name))return ['evenodd','nonzero'].includes(value)
  if(name==='stroke-linecap')return ['butt','round','square'].includes(value)
  if(name==='stroke-linejoin')return ['miter','round','bevel'].includes(value)
  return false
}
function declarations(source){
  const attrs={}
  for(const rule of source.split(';')){
    const i=rule.indexOf(':');if(i<=0)continue
    const key=rule.slice(0,i).trim().toLowerCase(),value=rule.slice(i+1).trim()
    if(STYLE.has(key)&&safe(key,value))attrs[key]=value
  }
  return attrs
}
function classes(root){
  const map=new Map()
  for(const style of root.querySelectorAll('style')){
    const css=style.textContent||''
    if(css.length>25000||/@|(?:expression|behavior|import|javascript|https?:|data:)/i.test(css))throw new Error('Unsupported or unsafe SVG stylesheet.')
    for(const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)){
      const attrs=declarations(rule[2])
      for(const selector of rule[1].split(',')){
        const key=selector.trim()
        if(/^\.[\w-]+$/.test(key)||/^#[\w-]+$/.test(key))map.set(key,{...map.get(key),...attrs})
      }
    }
  }
  return map
}
function validateTree(node,depth=0){
  if(depth>24||!node||!TAGS.has(node.tag)||!node.attrs||typeof node.attrs!=='object'||!Array.isArray(node.children))return false
  if(Object.entries(node.attrs).some(([attr,value])=>!ATTRS.has(attr)||!safe(attr,value)))return false
  return node.children.length<=750&&node.children.every(child=>validateTree(child,depth+1))
}
export function sanitizeSvgTattoo(markup,name){
  if(typeof markup!=='string'||!markup.trim())throw new Error('Choose an SVG drawing.')
  if(markup.length>SVG_FILE_LIMIT)throw new Error('SVG is too large (160 KB maximum).')
  if(/<!\s*(?:DOCTYPE|ENTITY)|<\?xml-stylesheet|<\s*(?:script|foreignObject|iframe|image|animate|set|a)\b/i.test(markup))throw new Error('SVG contains scripts, embedded images, or other unsupported elements.')
  const doc=new DOMParser().parseFromString(markup,'image/svg+xml')
  const root=doc.documentElement
  if(doc.querySelector('parsererror')||root.localName!=='svg'||root.namespaceURI!==NS)throw new Error('File is not a valid SVG.')
  const css=classes(root)
  let viewBox=root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if(!viewBox||viewBox.length!==4||viewBox.some(n=>!Number.isFinite(n)))viewBox=[0,0,parseFloat(root.getAttribute('width'))||100,parseFloat(root.getAttribute('height'))||100]
  if(viewBox.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6)||viewBox[2]<=0||viewBox[3]<=0)throw new Error('SVG has invalid dimensions.')
  let count=0,shapes=0
  const build=(node,depth)=>{
    if(depth>24)throw new Error('Too many nested SVG layers.')
    const tag=node.localName
    if(['style','metadata','desc','title','namedview'].includes(tag))return null
    if(node.namespaceURI!==NS||!TAGS.has(tag))throw new Error('Unsupported SVG element: '+tag+'. Convert complex artwork to paths.')
    if(++count>750)throw new Error('SVG is too complex (750 vector elements maximum).')
    if(SHAPES.has(tag))shapes++
    const attrs={}
    for(const klass of (node.getAttribute('class')||'').split(/\s+/))if(klass)Object.assign(attrs,css.get('.'+klass)||{})
    if(node.getAttribute('id'))Object.assign(attrs,css.get('#'+node.getAttribute('id'))||{})
    if(node.hasAttribute('style')){
      const content=node.getAttribute('style')
      if(/url\s*\(\s*['"]?(?!#)|(?:expression|javascript|data:|https?:|import)/i.test(content))throw new Error('Unsafe SVG style.')
      Object.assign(attrs,declarations(content))
    }
    for(const attr of node.attributes){
      const key=attr.localName==='href'?'href':attr.name
      if(key==='style'||key==='class'||key.startsWith('xmlns'))continue
      if(/^on/i.test(key)||key==='href'&&!HASH.test(attr.value.trim()))throw new Error('SVG cannot load external files or run events.')
      if(ATTRS.has(key)&&safe(key,attr.value.trim()))attrs[key]=attr.value.trim()
    }
    const children=[]
    for(const child of node.children){const value=build(child,depth+1);if(value)children.push(value)}
    return {tag,attrs,children}
  }
  const children=[]
  for(const child of root.children){const item=build(child,0);if(item)children.push(item)}
  if(!shapes)throw new Error('No vector paths or shapes were found in this SVG.')
  const asset={name:String(name||'Uploaded tattoo').replace(/\.svg$/i,'').slice(0,55),viewBox,children}
  if(JSON.stringify(asset).length>SVG_FILE_LIMIT*1.8)throw new Error('SVG is too large to store in the editor.')
  return asset
}
export function normaliseSvgLibrary(raw){
  if(!Array.isArray(raw))return []
  const result=[];let size=0
  for(const item of raw.slice(0,SVG_LIBRARY_LIMIT)){
    if(!item||typeof item.id!=='string'||!/^svg-[\w-]{1,80}$/.test(item.id)||!Array.isArray(item.viewBox)||item.viewBox.length!==4||item.viewBox.some(n=>!Number.isFinite(n))||item.viewBox[2]<=0||item.viewBox[3]<=0||!Array.isArray(item.children)||!item.children.every(node=>validateTree(node)))continue
    size+=JSON.stringify(item).length
    if(size>700000)break
    result.push({...item,name:String(item.name||'Uploaded tattoo').slice(0,55)})
  }
  return result
}
const REACT_ATTR={'clip-path':'clipPath','stop-color':'stopColor','stop-opacity':'stopOpacity'}
function renderTree(node,prefix,key,tint,color){
  if(!validateTree(node))return null
  const props={key}
  for(const [attr,raw] of Object.entries(node.attrs)){
    let value=raw
    if(attr==='id')value=prefix+value
    else if(attr==='href')value='#'+prefix+value.slice(1)
    else if(REF.test(value))value=value.replace(REF,(_,id)=>'url(#'+prefix+id+')')
    else if(tint&&['fill','stroke'].includes(attr)&&value!=='none')value=color
    props[REACT_ATTR[attr]||attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value
  }
  if(tint&&SHAPES.has(node.tag)&&!('fill'in props)&&node.tag!=='line')props.fill=color
  return React.createElement(node.tag,props,...node.children.map((child,i)=>renderTree(child,prefix,i,tint,color)))
}
export function UploadedSvgArtwork({asset,instanceId,tint=false,color='#f2f2f2'}){
  if(!asset||!Array.isArray(asset.children))return null
  const prefix='exo-tattoo-'+String(instanceId).replace(/[^\w-]/g,'')+'-'
  return <svg x={-32} y={-32} width={64} height={64} viewBox={asset.viewBox.join(' ')} preserveAspectRatio="xMidYMid meet" data-uploaded-svg="true">
    {asset.children.map((node,i)=>renderTree(node,prefix,i,tint,color))}
  </svg>
}

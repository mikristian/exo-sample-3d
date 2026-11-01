// Browser SVG editing for Tech Pack graphics. SVG paths stay vectors; bitmap files
// are intentionally never advertised as editable vector artwork.
const NS = 'http://www.w3.org/2000/svg'
const MAX_LENGTH = 2_000_000
const ELEMENTS = new Set(['svg','g','defs','symbol','use','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','linearGradient','radialGradient','stop','clipPath','mask','pattern','title','desc'])
const ATTRS = new Set(['id','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','transform','preserveAspectRatio','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','stroke-miterlimit','opacity','display','visibility','clip-path','mask','gradientUnits','gradientTransform','offset','stop-color','stop-opacity','patternUnits','patternContentUnits','patternTransform','font-size','font-family','font-weight','text-anchor','letter-spacing','paint-order','vector-effect','href','class'])
const PAINT_ATTRS = new Set(['fill','stroke','stop-color','clip-path','mask'])
const REF = /^url\(\s*['"]?#[A-Za-z_][\w.:-]*['"]?\s*\)$/i
const SIMPLE_REF = /^#[A-Za-z_][\w.:-]*$/
const INVALID = /(?:javascript\s*:|data\s*:|https?\s*:|file\s*:|vbscript\s*:|expression\s*\(|@import|\\|[<>])/i
const PAINT = /^(?:none|currentColor|transparent|#[a-f\d]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[-\d.% ,]+\s*\)|[a-z]+)$/i
const WHITE = /^(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const decode64 = s => {
  if (typeof atob !== 'function') throw Error('Base64 SVG decoding requires a browser')
  return decodeURIComponent(Array.from(atob(s), c => '%' + c.charCodeAt(0).toString(16).padStart(2,'0')).join(''))
}
function markupFrom(input) {
  // Imported assets often use `source` for provenance (e.g. a file name),
  // while the actual editable SVG lives in dataUrl. Prefer image payloads.
  const source = typeof input === 'string' ? input : input?.dataUrl ?? input?.svg ?? input?.src ?? input?.source
  if (typeof source !== 'string' || source.length > MAX_LENGTH) throw Error('Unsupported vector artwork')
  if (/^data:image\/(?:png|jpe?g|gif|webp|bmp|avif)/i.test(source)) throw Error('Raster artwork is not an editable SVG')
  if (/^data:image\/svg\+xml(?:;charset=[\w-]+)?;base64,/i.test(source)) return decode64(source.slice(source.indexOf(',') + 1))
  if (/^data:image\/svg\+xml(?:;charset=[\w-]+)?,/i.test(source)) return decodeURIComponent(source.slice(source.indexOf(',') + 1))
  if (/^\s*<svg\b/i.test(source) || /^\s*<\?xml\s/i.test(source)) return source
  throw Error('Artwork must contain real SVG markup')
}
function safeStyle(style) {
  const result = {}
  for (const decl of style.split(';')) {
    const index = decl.indexOf(':')
    if (index < 1) continue
    const key = decl.slice(0,index).trim().toLowerCase(), value = decl.slice(index + 1).trim()
    if (ATTRS.has(key) && validAttr(key,value)) result[key] = value
  }
  return result
}
function validAttr(name,value) {
  if (!value || value.length > 4096 || INVALID.test(value) || /url\s*\(/i.test(value) && !REF.test(value)) return false
  if (name === 'href') return SIMPLE_REF.test(value)
  if (PAINT_ATTRS.has(name) && /^url\s*\(/i.test(value)) return REF.test(value)
  if (['fill','stroke','stop-color'].includes(name)) return PAINT.test(value)
  if (name === 'class') return /^[\w\s-]{1,256}$/.test(value)
  if (name === 'id') return /^[A-Za-z_][\w.:-]*$/.test(value)
  if (name === 'font-family') return /^[\w\s,'"-]+$/.test(value)
  return !/[{};]/.test(value)
}
function normalizedDocument(input) {
  const markup = markupFrom(input)
  if (markup.length > MAX_LENGTH || /<!\s*(?:DOCTYPE|ENTITY)|<\?xml-stylesheet/i.test(markup)) throw Error('Unsafe SVG document')
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw Error('SVG editing requires a browser XML parser')
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName !== 'svg' || root.namespaceURI !== NS || doc.getElementsByTagName('parsererror').length) throw Error('Invalid SVG markup')
  const classPaint = new Map()
  for (const style of Array.from(root.getElementsByTagName('style'))) {
    const css = style.textContent ?? ''
    if (css.length < 100_000 && !/@|url\s*\((?!\s*['"]?#)/i.test(css)) {
      for (const [,selectors,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const selector of selectors.split(',')) {
          const m = /^\.([\w-]+)$/.exec(selector.trim())
          if (m) classPaint.set(m[1],{...classPaint.get(m[1]),...safeStyle(body)})
        }
      }
    }
  }
  let pathCount = 0
  function clean(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        if (child.namespaceURI !== NS || !ELEMENTS.has(child.localName)) node.removeChild(child)
        else clean(child)
      } else if (child.nodeType !== 3 || !['title','desc','text','tspan'].includes(node.localName)) node.removeChild(child)
    }
    if (['path','rect','circle','ellipse','line','polyline','polygon'].includes(node.localName)) pathCount++
    const classes = (node.getAttribute('class') || '').split(/\s+/)
    const inline = safeStyle(node.getAttribute('style') || '')
    for (const klass of classes) for (const [key,value] of Object.entries(classPaint.get(klass) || {})) if (!node.hasAttribute(key)) node.setAttribute(key,value)
    for (const [key,value] of Object.entries(inline)) node.setAttribute(key,value)
    for (const attr of Array.from(node.attributes)) {
      if (attr.namespaceURI || !ATTRS.has(attr.name) || !validAttr(attr.name, attr.value.trim())) node.removeAttributeNode(attr)
    }
    node.removeAttribute('class')
  }
  clean(root)
  root.setAttribute('xmlns',NS)
  const number = raw => { const match = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/.exec(raw || ''); return match ? Number(match[1]) : undefined }
  const dimensions = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const validView = dimensions.length === 4 && dimensions.every(Number.isFinite) && dimensions[2] > 0 && dimensions[3] > 0
  const width = validView ? dimensions[2] : number(root.getAttribute('width')) || 300
  const height = validView ? dimensions[3] : number(root.getAttribute('height')) || 150
  if (!(width > 0 && height > 0 && width <= 1e7 && height <= 1e7)) throw Error('Invalid vector dimensions')
  if (!validView) root.setAttribute('viewBox',`0 0 ${width} ${height}`)
  root.removeAttribute('width'); root.removeAttribute('height')
  return {doc,root,width,height,pathCount,viewBox:root.getAttribute('viewBox')}
}

/** Strict full-page detection. Only an untransformed, first top-level rect
 * which exactly spans the SVG viewBox is a candidate for background removal. */
export function isFullViewportWhiteBackgroundRect(attributes,viewBox) {
  if (!attributes || typeof viewBox !== 'string' || attributes.transform || attributes.opacity && Number(attributes.opacity) !== 1) return false
  const vb = viewBox.trim().split(/[\s,]+/).map(Number)
  if (vb.length !== 4 || vb.some(x => !Number.isFinite(x)) || vb[2] <= 0 || vb[3] <= 0) return false
  const equal = (raw,num) => raw !== undefined && raw !== null && raw !== '' && Number(raw) === num
  return WHITE.test(String(attributes.fill || '')) &&
    equal(attributes.x ?? '0',vb[0]) && equal(attributes.y ?? '0',vb[1]) &&
    equal(attributes.width,vb[2]) && equal(attributes.height,vb[3]) &&
    !attributes.rx && !attributes.ry && !attributes.mask && !attributes['clip-path']
}

function backgroundRect(root,viewBox) {
  const first = Array.from(root.children).find(child => !['title','desc','defs'].includes(child.localName))
  if (!first || first.localName !== 'rect') return null
  const attrs = Object.fromEntries(Array.from(first.attributes, attr => [attr.name,attr.value]))
  return isFullViewportWhiteBackgroundRect(attrs,viewBox) ? first : null
}

/** The SVG's viewBox may include hundreds of units of invisible "paper"
 * beyond a botanical/technical path. Only a mounted SVG has useful getBBox()
 * geometry; trim the derived display source, never the library's original.
 * A conservative margin retains antialiased line caps and stroke joins.
 */
function trimToVectorArtwork(root,options={}) {
  if(typeof document==='undefined'||!document.body)return false
  const raw=root.getAttribute('viewBox')||''
  const v=raw.trim().split(/[\s,]+/).map(Number)
  if(v.length!==4||v.some(n=>!Number.isFinite(n))||v[2]<=0||v[3]<=0)return false
  const mounted=document.importNode(root,true)
  mounted.setAttribute('width',String(v[2]))
  mounted.setAttribute('height',String(v[3]))
  mounted.style.position='fixed'
  mounted.style.left='-100000px'
  mounted.style.top='-100000px'
  mounted.style.visibility='hidden'
  mounted.style.pointerEvents='none'
  document.body.appendChild(mounted)
  let bounds
  try {bounds=mounted.getBBox()}
  catch{return false}
  finally {mounted.remove()}
  if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)||
     bounds.width<=0||bounds.height<=0)return false
  const padding=Number.isFinite(Number(options.trimPadding))?
    Math.max(0.5,Math.min(30,Number(options.trimPadding))):
    Math.max(2,Math.min(15,Math.max(bounds.width,bounds.height)*.018))
  const values=[bounds.x-padding,bounds.y-padding,bounds.width+padding*2,bounds.height+padding*2]
  if(values[2]<=0||values[3]<=0)return false
  const round=n=>String(Math.round(n*1000)/1000)
  root.setAttribute('viewBox',values.map(round).join(' '))
  return true
}

/** Analyze a real SVG string/data URI, rejecting raster files and unsafe markup. */
export function analyzeVectorArtwork(input) {
  const {root,width,height,viewBox,pathCount} = normalizedDocument(input)
  const backgroundRectDetected = Boolean(backgroundRect(root,viewBox))
  return {kind:'svg',editable:true,transparent:!backgroundRectDetected,backgroundRectDetected,width,height,viewBox,pathCount,svg:new XMLSerializer().serializeToString(root)}
}

/** Return a safe local SVG data URI. Override color on graphic groups/shapes while
 * retaining geometry, transforms, masks, gradients and transparent background.
 * options: stroke, fill (CSS color/none), strokeWidth (finite 0..1000).
 */
export function renderVectorArtworkDataUrl(input,options={}) {
  const {root,viewBox} = normalizedDocument(input)
  if (options.removeWhiteBackground === true) backgroundRect(root,viewBox)?.remove()
  const changes = {}
  for (const key of ['stroke','fill']) if (options[key] !== undefined) {
    if (typeof options[key] !== 'string' || !PAINT.test(options[key]) || /url\s*\(/i.test(options[key])) throw Error(`Invalid ${key}`)
    changes[key] = options[key]
  }
  if (options.strokeWidth !== undefined) {
    const value = Number(options.strokeWidth)
    if (!Number.isFinite(value) || value < 0 || value > 1000) throw Error('Invalid stroke width')
    changes['stroke-width'] = String(value)
  }
  const paintNodes = Array.from(root.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use'))
  for (const node of paintNodes) for (const [key,value] of Object.entries(changes)) node.setAttribute(key,value)
  if(options.trimToArtwork===true)trimToVectorArtwork(root,options)
  // Group inherited paint is overridden on shapes, preserving unrelated group transforms.
  // SVG markup is encoded to prevent quote/markup breaks in the data URL.
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(root))
}

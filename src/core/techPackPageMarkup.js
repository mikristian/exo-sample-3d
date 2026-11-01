// Page-scale ink is separate from manufacturing measurements and seam data.
// Fixed approved colors prevent embedding arbitrary SVG/CSS into print files.
export const TECHPACK_MARKER_COLORS=Object.freeze([
  {value:'#f4d03f',label:'Yellow'},
  {value:'#f39c6b',label:'Orange'},
  {value:'#fa8ca5',label:'Pink'},
  {value:'#75d2a0',label:'Green'},
  {value:'#70b9f4',label:'Blue'},
  {value:'#b2a0ec',label:'Lavender'},
])
export const TECHPACK_MARKER_WIDTHS=Object.freeze([12,24,40])
export const TECHPACK_PENCIL_COLORS=Object.freeze([{value:'#e53935',label:'Red'},{value:'#111111',label:'Black'},{value:'#2563eb',label:'Blue'},{value:'#15803d',label:'Green'}])
export const TECHPACK_PENCIL_WIDTHS=Object.freeze([2,4,8])
export const safeMarkerColor=value=>TECHPACK_MARKER_COLORS.some(c=>c.value===value)?value:TECHPACK_MARKER_COLORS[0].value
export const safeMarkerWidth=value=>TECHPACK_MARKER_WIDTHS.includes(Number(value))?Number(value):24
export const safePencilColor=value=>TECHPACK_PENCIL_COLORS.some(c=>c.value===value)?value:TECHPACK_PENCIL_COLORS[0].value
export const safePencilWidth=value=>TECHPACK_PENCIL_WIDTHS.includes(Number(value))?Number(value):4
export const safePageMarkupMode=mode=>mode==='pencil'?'pencil':'highlighter'
export const safePageMarkupColor=(value,mode='highlighter')=>safePageMarkupMode(mode)==='pencil'?safePencilColor(value):safeMarkerColor(value)
export const safePageMarkupWidth=(value,mode='highlighter')=>safePageMarkupMode(mode)==='pencil'?safePencilWidth(value):safeMarkerWidth(value)
export const pageMarkupOpacity=mode=>safePageMarkupMode(mode)==='pencil'?1:0.38
export const safePageMarkPoint=point=>Array.isArray(point)&&point.length===2&&point.every(n=>typeof n==='number'&&Number.isFinite(n))?
  point.map(n=>Math.max(0,Math.min(1000,Math.round(n*10)/10))):null

export function normalizedPageMarkers(annotations=[]){
  return (Array.isArray(annotations)?annotations:[]).filter(a=>(a?.type==='highlighter'||a?.type==='pencil')&&a.scope==='page')
    .map(a=>({...a,color:safePageMarkupColor(a.color,a.type),width:safePageMarkupWidth(a.width,a.type),points:(Array.isArray(a.points)?a.points:[]).slice(0,700).map(safePageMarkPoint).filter(Boolean)}))
    .filter(a=>a.points.length>=2)
}

export function pageMarkerSvgMarkup(annotations=[]){
  const paths=normalizedPageMarkers(annotations).map((item)=>{
    const points=item.points.map(p=>p.join(',')).join(' ')
    return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="${item.width}" stroke-opacity="${pageMarkupOpacity(item.type)}" stroke-linecap="round" stroke-linejoin="round"/>`
  }).join('')
  return paths?`<svg class="seville-page-markup" data-page-highlighter-print="true" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Colored page markup">${paths}</svg>`:''
}

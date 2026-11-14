// Standalone, serializable vector geometry for Tech Pack pages.
// Nothing here mutates the garment's pattern, seam or manufacturing source.
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0))
export const VECTOR_KINDS=['rect','ellipse','text','path','grid']
export const vectorBounds=item=>({x:Number(item.x)||0,y:Number(item.y)||0,width:Math.max(1,Number(item.width)||1),height:Math.max(1,Number(item.height)||1)})
export function createTechPackVector(kind,rect={},id=globalThis.crypto?.randomUUID?.()){
  if(!['rect','ellipse','text','grid'].includes(kind)||!id)throw Error('Unsupported vector object')
  const {x=70,y=95,width=160,height=100}=rect
  return {id,kind,name:kind==='text'?'Text':kind==='rect'?'Rectangle':kind==='grid'?'Rectangular grid':'Ellipse',
    x:clamp(x,-1000,2000),y:clamp(y,-1000,2000),width:clamp(width,4,2500),height:clamp(height,4,2500),
    fill:kind==='grid'?'none':kind==='text'?'#1f242b':'#ec8b33',stroke:kind==='text'?'none':'#242424',strokeWidth:kind==='text'?0:kind==='grid'?1.2:1,
    rows:kind==='grid'?5:undefined,columns:kind==='grid'?5:undefined,
    opacity:1,hidden:false,locked:false,text:'Your text',fontFamily:'Arial',fontSize:24,fontWeight:400,
    lineHeight:1.2,letterSpacing:0,textAlign:'left'}
}
export function alignTechPackVectors(objects,selectedIds,axis,alignment,artboard={width:612,height:792}){
  const selected=objects.filter(x=>selectedIds.includes(x.id)&&!x.locked)
  if(!selected.length)return objects
  const x0=Math.min(...selected.map(o=>o.x)),y0=Math.min(...selected.map(o=>o.y))
  const x1=Math.max(...selected.map(o=>o.x+o.width)),y1=Math.max(...selected.map(o=>o.y+o.height))
  const bound=axis==='page'?{x:0,y:0,width:artboard.width,height:artboard.height}:{x:x0,y:y0,width:x1-x0,height:y1-y0}
  return objects.map(o=>{
    if(!selected.includes(o))return o
    const value=alignment==='left'?bound.x:alignment==='center'?bound.x+(bound.width-o.width)/2:
      alignment==='right'?bound.x+bound.width-o.width:alignment==='top'?bound.y:
      alignment==='middle'?bound.y+(bound.height-o.height)/2:alignment==='bottom'?bound.y+bound.height-o.height:null
    return value===null?o:{...o,[['left','center','right'].includes(alignment)?'x':'y']:Math.round(value*100)/100}
  })
}

// Deterministic, exact orthogonal boolean shape building for rectangular
// regions. Other paths/ellipses are deliberately rejected, not approximated.
export function buildTechPackRectShape(objects,operation='unite',id=globalThis.crypto?.randomUUID?.()){
  if(!id||!['unite','subtract'].includes(operation)||objects.length<2||
     objects.some(o=>o.kind!=='rect'||o.locked||o.hidden||!Number.isFinite(o.x)||!Number.isFinite(o.y)||
       !Number.isFinite(o.width)||!Number.isFinite(o.height)||o.width<=0||o.height<=0))
    throw Error('Shape Builder supports two or more unlocked, visible rectangles')
  const bounds=objects.map(vectorBounds)
  const xs=[...new Set(bounds.flatMap(b=>[b.x,b.x+b.width]))].sort((a,b)=>a-b)
  const ys=[...new Set(bounds.flatMap(b=>[b.y,b.y+b.height]))].sort((a,b)=>a-b)
  if(xs.length*ys.length>10000)throw Error('Shape Builder complexity limit')
  const inside=(r,x,y)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height
  const cells=Array.from({length:ys.length-1},(_,j)=>Array.from({length:xs.length-1},(_,i)=>{
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2
    return operation==='unite'?bounds.some(b=>inside(b,x,y)):inside(bounds[0],x,y)&&!bounds.slice(1).some(b=>inside(b,x,y))
  }))
  const edges=[]
  const add=(a,b)=>edges.push([a,b])
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++)if(cells[j][i]){
    const x=xs[i],x2=xs[i+1],y=ys[j],y2=ys[j+1]
    if(!cells[j-1]?.[i])add([x,y],[x2,y])
    if(!cells[j]?.[i+1])add([x2,y],[x2,y2])
    if(!cells[j+1]?.[i])add([x2,y2],[x,y2])
    if(!cells[j]?.[i-1])add([x,y2],[x,y])
  }
  if(!edges.length)throw Error('Shape Builder result is empty')
  const key=p=>p.join(',')
  const buckets=new Map()
  for(const [a,b] of edges){const k=key(a);buckets.set(k,[...(buckets.get(k)||[]),b])}
  const loops=[]
  while(buckets.size){
    const start=buckets.keys().next().value,points=[start.split(',').map(Number)]
    let cursor=start,guard=0
    do {
      const nexts=buckets.get(cursor)
      if(!nexts?.length||guard++>edges.length)throw Error('Shape Builder topology error')
      const next=nexts.pop()
      if(!nexts.length)buckets.delete(cursor)
      cursor=key(next)
      points.push(next)
    }while(cursor!==start)
    loops.push(points)
  }
  const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys)
  const path=loops.map(points=>'M '+points.map(([x,y])=>`${+(x-left).toFixed(4)} ${+(y-top).toFixed(4)}`).join(' L ')+' Z').join(' ')
  return {...objects[0],id,name:operation==='unite'?'United shape':'Subtracted shape',kind:'path',
    x:left,y:top,width:right-left,height:bottom-top,d:path,fillRule:'evenodd'}
}

// Portable printing keeps designer vector artwork and escapes author text.
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const color=value=>/^(?:#[a-f0-9]{6}|none)$/i.test(value||'')?value:'none'
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback
export function renderTechPackVectorSvg(items=[],width=612,height=792){
  if(!Array.isArray(items)||!items.length)return ''
  const content=items.slice(0,250).filter(o=>o&&!o.hidden&&VECTOR_KINDS.includes(o.kind)).map(o=>{
    const b=vectorBounds(o)
    const appearance=`fill="${color(o.fill)}" stroke="${color(o.stroke)}" stroke-width="${Math.max(0,Math.min(40,numeric(o.strokeWidth)))}" opacity="${Math.max(0,Math.min(1,numeric(o.opacity,1)))}"`
    if(o.kind==='rect')return `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${Math.max(0,Math.min(250,numeric(o.cornerRadius)))}" ${appearance}/>`
    if(o.kind==='grid'){
      const rows=Math.max(1,Math.min(40,Math.trunc(numeric(o.rows,5))))
      const columns=Math.max(1,Math.min(40,Math.trunc(numeric(o.columns,5))))
      const lines=Array.from({length:columns-1},(_,i)=>`<path d="M ${b.x+b.width*(i+1)/columns} ${b.y} V ${b.y+b.height}"/>`).join('')+
        Array.from({length:rows-1},(_,i)=>`<path d="M ${b.x} ${b.y+b.height*(i+1)/rows} H ${b.x+b.width}"/>`).join('')
      return `<g fill="none" stroke="${color(o.stroke)}" stroke-width="${Math.max(0,Math.min(40,numeric(o.strokeWidth,1)))}" opacity="${Math.max(0,Math.min(1,numeric(o.opacity,1)))}"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/>${lines}</g>`
    }
    if(o.kind==='ellipse')return `<ellipse cx="${b.x+b.width/2}" cy="${b.y+b.height/2}" rx="${b.width/2}" ry="${b.height/2}" ${appearance}/>`
    if(o.kind==='path')return /^[MLCZmlcz0-9.,\s+\-]+$/.test(o.d||'')?
      `<path d="${xml(o.d)}" transform="translate(${b.x} ${b.y})" fill-rule="${o.fillRule==='evenodd'?'evenodd':'nonzero'}" ${appearance}/>`:''
    const size=Math.max(6,Math.min(250,numeric(o.fontSize,24)))
    const lines=String(o.text||'').split('\n').slice(0,50)
    const x=o.textAlign==='center'?b.x+b.width/2:o.textAlign==='right'?b.x+b.width:b.x
    const anchor=o.textAlign==='center'?'middle':o.textAlign==='right'?'end':'start'
    const family=['Arial','Helvetica Neue','Inter','Georgia','Times New Roman','Courier New','Futura','Avenir Next','Menlo'].includes(o.fontFamily)?o.fontFamily:'Arial'
    return `<text x="${x}" y="${b.y}" dominant-baseline="hanging" font-family="${xml(family)}" font-size="${size}" font-weight="${Math.max(100,Math.min(900,numeric(o.fontWeight,400)))}" letter-spacing="${Math.max(-5,Math.min(35,numeric(o.letterSpacing)))}" text-anchor="${anchor}" ${appearance}>${lines.map((line,i)=>`<tspan x="${x}" dy="${i?Math.max(.6,Math.min(4,numeric(o.lineHeight,1.2)))*size:0}">${xml(line)}</tspan>`).join('')}</text>`
  }).join('')
  return content?`<svg class="exo-techpack-vector-print" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${numeric(width,612)} ${numeric(height,792)}" preserveAspectRatio="none" aria-label="Authored Tech Pack vector artwork">${content}</svg>`:''
}

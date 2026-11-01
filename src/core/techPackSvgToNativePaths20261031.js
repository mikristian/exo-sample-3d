// A deliberately restricted SVG importer. It never mounts source markup in the DOM.
const number = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
const nre = new RegExp(number, 'y')
const f = n => Number(n.toFixed(8))
const eq = (a,b) => a[0] === b[0] && a[1] === b[1]
const point = (x,y) => [f(x),f(y)]
const readAttrs = text => {
  const attrs = {}
  const re = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gs
  let rest = text.replace(re, (_,name,_q,value) => {if(Object.hasOwn(attrs,name))throw new TypeError('Duplicate SVG attribute');attrs[name]=value;return ' '})
  if(rest.trim())throw new TypeError('Malformed SVG attribute')
  return attrs
}
const numeric = text => {const n=Number(text);if(!String(text).trim()||!Number.isFinite(n))throw new TypeError('Invalid SVG number');return n}
const vector = text => {const a=String(text||'').trim().split(/[\s,]+/).map(numeric);if(a.length!==4||a[2]<=0||a[3]<=0)throw new TypeError('Invalid SVG viewBox');return a}
const transform = text => {
  if(!text)return [0,0]
  const m=/^translate\(\s*([^)]*)\s*\)$/.exec(text)
  if(!m)throw new TypeError('Only SVG translate groups supported')
  const values=m[1].trim().split(/[\s,]+/).map(numeric)
  if(values.length<1||values.length>2)throw new TypeError('Invalid translate')
  return [values[0],values[1]??0]
}
const paint = (attrs,key,inherit,defaultValue) => {
  const value=attrs[key]??inherit??defaultValue
  if(key==='fill'||key==='stroke'){
    if(!/^(?:none|#[\da-fA-F]{3,8})$/.test(value))throw new TypeError('Unsupported SVG color')
  }
  return value
}
function parsePath(d){
  const commands=[];let i=0,command=null,pos=[0,0],start=null,anchors=[],closed=false
  const skip=()=>{while(i<d.length&&/[\s,]/.test(d[i]))i++}
  const num=()=>{skip();nre.lastIndex=i;const m=nre.exec(d);if(!m)throw new TypeError('Missing SVG path coordinate');i=nre.lastIndex;return numeric(m[0])}
  const pair=()=>point(num(),num())
  const more=()=>{skip();return i<d.length&&!/[a-zA-Z]/.test(d[i])}
  while((skip(),i<d.length)){
    if(/[a-zA-Z]/.test(d[i]))command=d[i++]
    if(!command||!/[MLCZmlcz]/.test(command))throw new TypeError('Unsupported SVG path command')
    const relative=command===command.toLowerCase(),op=command.toUpperCase()
    if(op==='Z'){
      if(!start||closed)throw new TypeError('Invalid close path')
      closed=true;pos=start;commands.push('Z');command=null;continue
    }
    if(closed)throw new TypeError('Multiple subpaths unsupported')
    let count=0
    do{
      if(++count>1500)throw new TypeError('SVG path too complex')
      if(op==='M'||op==='L'){
        const p=pair(),next=relative?point(pos[0]+p[0],pos[1]+p[1]):p
        if(op==='M'&&start===null){start=next;anchors.push({p:next,hIn:next.slice(),hOut:next.slice()});commands.push('M')}
        else {if(!start)throw new TypeError('Path must start with M');anchors.push({p:next,hIn:next.slice(),hOut:next.slice()});commands.push('L')}
        pos=next
      }else{
        if(!start)throw new TypeError('Path must start with M')
        const a=pair(),b=pair(),p=pair()
        const c1=relative?point(pos[0]+a[0],pos[1]+a[1]):a
        const c2=relative?point(pos[0]+b[0],pos[1]+b[1]):b
        const next=relative?point(pos[0]+p[0],pos[1]+p[1]):p
        anchors[anchors.length-1].hOut=c1
        anchors.push({p:next,hIn:c2,hOut:next.slice()});commands.push('C');pos=next
      }
      if(op==='M'){command=relative?'l':'L';break}
    }while(more())
  }
  if(anchors.length<2)throw new TypeError('Path needs two or more anchors')
  // Illustrator often closes outlines by repeating the first point without Z.
  if(!closed&&anchors.length>2&&eq(anchors[0].p,anchors.at(-1).p))closed=true
  if(closed&&eq(anchors[0].p,anchors.at(-1).p)){
    const last=anchors.pop();anchors[0].hIn=last.hIn
  }
  if(anchors.length<2)throw new TypeError('Degenerate SVG path')
  return {anchors,closed,commands}
}
const dFrom=(anchors,closed)=>{
  const xy=p=>`${f(p[0])} ${f(p[1])}`
  let d=`M ${xy(anchors[0].p)}`
  const length=closed?anchors.length:anchors.length-1
  for(let i=0;i<length;i++){
    const a=anchors[i],b=anchors[(i+1)%anchors.length]
    d+=eq(a.hOut,a.p)&&eq(b.hIn,b.p)?` L ${xy(b.p)}`:` C ${xy(a.hOut)} ${xy(b.hIn)} ${xy(b.p)}`
  }
  return closed?d+' Z':d
}
/** Explode source-faithful M/L/C/Z SVG artwork into independently editable page paths. */
export function explodeTechPackSvgIntoPaths(svg,{pageId,x=0,y=0,width,height,idFactory,sourceAssetId,groupId}={}){
  if(typeof svg!=='string'||svg.length>300000||!pageId||!Number.isFinite(x)||!Number.isFinite(y)||
    typeof idFactory!=='function')throw new TypeError('Valid SVG, page and ID factory required')
  if(/<!|<\?|&|\b(?:style|href|src|on\w+)\s*=|url\s*\(/i.test(svg))throw new TypeError('Unsupported SVG content')
  const withoutTitles=svg.replace(/<title(?:\s*)>[^<]*<\/title>/g,'<title></title>')
  if(withoutTitles.replace(/<[^>]*>/g,'').trim())throw new TypeError('SVG text content unsupported')
  const tokens=withoutTitles.match(/<[^>]*>/g)||[]
  const stack=[];let root=null,idx=0;const records=[]
  for(const tag of tokens){
    if(/^<\/([\w:-]+)\s*>$/.test(tag)){
      const name=tag.match(/^<\/([\w:-]+)/)[1]
      if(stack.pop()?.name!==name)throw new TypeError('Mismatched SVG element')
      continue
    }
    const m=/^<([\w:-]+)\b([\s\S]*?)(\/?)>$/.exec(tag)
    if(!m)throw new TypeError('Malformed SVG element')
    const [,name,body,selfClose]=m
    if(!['svg','g','path','title'].includes(name)||name==='path'&&!selfClose)throw new TypeError('Unsupported SVG element')
    const attrs=readAttrs(body)
    if(Object.keys(attrs).some(k=>!['xmlns','viewBox','width','height','d','transform','data-mockup-view','stroke','stroke-width','fill','fill-rule','stroke-linejoin','stroke-linecap','opacity','id'].includes(k)))throw new TypeError('Unsupported SVG attribute')
    if(name==='svg'){
      if(root||stack.length)throw new TypeError('Nested SVG unsupported')
      root=vector(attrs.viewBox)
    }else if(!root||!stack.length)throw new TypeError('SVG root required')
    const parent=stack.at(-1)
    const offset=parent?.offset||[0,0],shift=transform(attrs.transform)
    const state={name,offset:[offset[0]+shift[0],offset[1]+shift[1]],paint:{...parent?.paint,...attrs},view:attrs['data-mockup-view']??parent?.view}
    if(name==='path'){
      if(!attrs.d)throw new TypeError('Missing SVG path')
      records.push({attrs,state,geometry:parsePath(attrs.d),index:idx++})
    }
    if(!selfClose)stack.push(state)
  }
  if(!root||stack.length||records.length<1||records.length>1000||
    !Number.isFinite(width??root[2])||!Number.isFinite(height??root[3])||(width??root[2])<=0||(height??root[3])<=0)
    throw new TypeError('Invalid SVG or placement')
  // The complete document's viewBox controls placement, including nonzero PDF offsets.
  const sx=(width??root[2])/root[2],sy=(height??root[3])/root[3]
  if(Math.abs(sx-sy)>1e-8)throw new TypeError('Nonuniform SVG scaling unsupported for faithful stroke widths')
  const ids=new Set()
  return records.map(({attrs,state,geometry,index})=>{
    const transformed=geometry.anchors.map(a=>Object.fromEntries(['p','hIn','hOut'].map(key=>[key,point((a[key][0]+state.offset[0]-root[0])*sx,(a[key][1]+state.offset[1]-root[1])*sy)])))
    const coords=transformed.flatMap(a=>[a.p,a.hIn,a.hOut]);const minX=Math.min(...coords.map(p=>p[0])),minY=Math.min(...coords.map(p=>p[1]))
    const maxX=Math.max(...coords.map(p=>p[0])),maxY=Math.max(...coords.map(p=>p[1]))
    const anchors=transformed.map(a=>({...Object.fromEntries(['p','hIn','hOut'].map(k=>[k,point(a[k][0]-minX,a[k][1]-minY)])),kind:'corner'}))
    const id=idFactory(index,state.view||null)
    if(typeof id!=='string'||!id||ids.has(id))throw new TypeError('Unique native path IDs required')
    ids.add(id)
    const inherited=state.paint
    const stroke=paint(attrs,'stroke',inherited.stroke,'none'),fill=paint(attrs,'fill',inherited.fill,'#000000')
    const strokeWidth=numeric(inherited['stroke-width']??'1')*sx
    const opacity=numeric(inherited.opacity??'1')
    if(strokeWidth<0||opacity<0||opacity>1)throw new TypeError('Invalid SVG paint')
    return {id,pageId,kind:'path',name:`${state.view||'SVG'} path ${index+1}`,x:f(x+minX),y:f(y+minY),
      width:f(Math.max(maxX-minX,.00001)),height:f(Math.max(maxY-minY,.00001)),anchors,
      d:dFrom(anchors,geometry.closed),closed:geometry.closed,fill,stroke,strokeWidth:f(strokeWidth),opacity,
      fillRule:inherited['fill-rule']||'nonzero',groupId:groupId??null,sourceAssetId:sourceAssetId??null,
      sourceRef:{kind:'svg-path',assetId:sourceAssetId??null,pathIndex:index,view:state.view??null,originalD:attrs.d,
        originalAttributes:{...attrs},originalSvg:svg,viewBox:root.slice(),translate:state.offset.slice()}}
  })
}

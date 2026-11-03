// SVG geometry for a proposed pattern. Does not alter project coordinates or approvals.
const finite = n => typeof n === 'number' && Number.isFinite(n)
const fmt = n => Number(n.toFixed(4))

function extrema(a, control, b) {
  const denominator = a - 2 * control + b
  if (Math.abs(denominator) < 1e-12) return []
  const t = (a - control) / denominator
  return t > 0 && t < 1 ? [(1-t)*(1-t)*a + 2*(1-t)*t*control + t*t*b] : []
}

/** Each independently placed piece retains its original quadratic control geometry. */
export function createExoCompanionPatternPreview20261102(project, {paddingCm=3,gapCm=4}={}) {
  if (!Array.isArray(project?.pieces) || !project.pieces.length || !finite(paddingCm) || paddingCm<0 || !finite(gapCm) || gapCm<0)
    throw Error('A populated pattern and nonnegative preview spacing are required.')
  const pieces=[]
  let cursor=paddingCm
  let height=0
  for (const piece of project.pieces) {
    const points=piece.points
    if (!Array.isArray(points) || points.length<3 || points.some(p=>!finite(p?.x)||!finite(p?.y)))
      throw Error(`Invalid panel coordinates: ${piece.id}`)
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y)
    for(let i=0;i<points.length;i++) {
      const curve=piece.curves?.[i]
      if(!curve)continue
      if(!finite(curve.cx)||!finite(curve.cy))throw Error(`Invalid quadratic curve: ${piece.id}/${i}`)
      const a=points[i],b=points[(i+1)%points.length]
      xs.push(...extrema(a.x,curve.cx,b.x))
      ys.push(...extrema(a.y,curve.cy,b.y))
    }
    const bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
    const width=bounds.maxX-bounds.minX, pieceHeight=bounds.maxY-bounds.minY
    if(!(width>0&&pieceHeight>0))throw Error(`Collapsed preview panel: ${piece.id}`)
    const offsetX=cursor-bounds.minX,offsetY=paddingCm-bounds.minY
    const move=p=>`${fmt(p.x+offsetX)} ${fmt(p.y+offsetY)}`
    let path=`M ${move(points[0])}`
    for(let i=0;i<points.length;i++){
      const curve=piece.curves?.[i],next=points[(i+1)%points.length]
      path+=curve?` Q ${move({x:curve.cx,y:curve.cy})} ${move(next)}`:` L ${move(next)}`
    }
    path+=' Z'
    pieces.push({id:piece.id,name:piece.name||piece.id,path,bounds,widthCm:width,heightCm:pieceHeight,
      x:cursor,y:paddingCm,offsetX,offsetY,curveCount:Object.keys(piece.curves||{}).length})
    cursor+=width+gapCm
    height=Math.max(height,pieceHeight)
  }
  return {units:'cm',widthCm:cursor-gapCm+paddingCm,heightCm:height+2*paddingCm,
    pieces,seamCount:project.seams?.length||0,
    // The caller may render <path d={piece.path}/> within viewBox; no injected markup.
    viewBox:`0 0 ${fmt(cursor-gapCm+paddingCm)} ${fmt(height+2*paddingCm)}`}
}

/** Companion-facing nonthrowing API suitable for an SVG JSX view. */
export function buildExoCompanionPatternPreview20261102(project, options) {
  try {
    const data=createExoCompanionPatternPreview20261102(project,options)
    return {ok:true,...data,pieces:data.pieces.map(piece=>({...piece,svgPath:piece.path,viewBox:data.viewBox}))}
  } catch(error) {
    return {ok:false,reason:error instanceof Error?error.message:'Invalid pattern geometry',pieces:[]}
  }
}

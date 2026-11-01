// Manufacturing inputs are validated before legacy drafting normalization.
// Missing legacy fields retain defaults; explicit malformed values never do.
function finite(value, fallback, label) {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`Invalid manufacturing ${label}: expected finite number`)
  return value
}
export function assertManufacturingSource(project) {
  for (const piece of project?.pieces || []) {
    const base = finite(piece.seamAllowance, 0, `seam allowance on ${piece.id}`)
    if (base < 0) throw Error(`Invalid manufacturing seam allowance on ${piece.id}`)
    const overrides = piece.edgeSeamAllowances
    if (overrides !== undefined) {
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error(`Invalid manufacturing edge allowances on ${piece.id}`)
      for (const [key, value] of Object.entries(overrides)) {
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= piece.points.length ||
            typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error(`Invalid manufacturing edge allowance on ${piece.id} edge ${key}`)
      }
    }
    if (piece.buttonholes !== undefined && !Array.isArray(piece.buttonholes)) throw Error(`Invalid manufacturing buttonholes on ${piece.id}`)
    for (const mark of piece.buttonholes || []) buttonholeEndpoints(mark, piece.id)
  }
}
function buttonholeEndpoints(mark, id) {
  if (!mark || typeof mark !== 'object') throw Error(`Invalid manufacturing buttonhole on ${id}`)
  const x = finite(mark.x, 0, `buttonhole x on ${id}`)
  const y = finite(mark.y, 0, `buttonhole y on ${id}`)
  const length = finite(mark.lengthCm, 2.4, `buttonhole length on ${id}`)
  const angle = finite(mark.orientationDeg, 0, `buttonhole orientation on ${id}`) * Math.PI / 180
  if (!(length > 0)) throw Error(`Invalid manufacturing buttonhole length on ${id}`)
  const dx = Math.cos(angle) * length / 2, dy = Math.sin(angle) * length / 2
  const a = { x: x - dx, y: y - dy }, b = { x: x + dx, y: y + dy }
  if (![a.x,a.y,b.x,b.y].every(Number.isFinite) || Math.hypot(b.x-a.x,b.y-a.y) <= 1e-8) throw Error(`Invalid manufacturing buttonhole segment on ${id}`)
  return { a, b }
}
const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
function onSegment(p,a,b) {
  const length = Math.hypot(b.x-a.x,b.y-a.y)
  return Math.abs(cross(a,b,p)) <= 1e-8 * Math.max(1,length) &&
    p.x >= Math.min(a.x,b.x)-1e-8 && p.x <= Math.max(a.x,b.x)+1e-8 &&
    p.y >= Math.min(a.y,b.y)-1e-8 && p.y <= Math.max(a.y,b.y)+1e-8
}
function touches(a,b,c,d) {
  if (onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b)) return true
  return (cross(a,b,c)>0)!==(cross(a,b,d)>0) && (cross(c,d,a)>0)!==(cross(c,d,b)>0)
}
function inside(p, polygon) {
  let result = false
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j]
    if (onSegment(p,a,b)) return false
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result
  }
  return result
}
export function manufacturingButtonholeSegment(mark, polygon, id) {
  const segment=buttonholeEndpoints(mark,id), {a,b}=segment
  // Strictly interior to the exact sampled CUT emitted in this file. Boundary
  // contact is rejected, not treated as an approved factory edge clearance.
  if (!inside(a,polygon)||!inside(b,polygon) || polygon.some((c,i)=>touches(a,b,c,polygon[(i+1)%polygon.length]))) throw Error(`Unsafe manufacturing buttonhole outside or crossing CUT on ${id}`)
  return segment
}
export function coincidentContours(a,b) {
  // 1e-7 cm = 1e-6 mm. Same vertices, allowing reverse/cyclic serialization;
  // equal area alone is never proof of an identical zero-allowance contour.
  if (a.length!==b.length || a.length<3) return false
  const same=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<=1e-7
  for(let start=0;start<b.length;start++) {
    if(!same(a[0],b[start]))continue
    for(const direction of [1,-1])if(a.every((p,i)=>same(p,b[(start+direction*i+b.length)%b.length])))return true
  }
  return false
}

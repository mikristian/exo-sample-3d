import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'

// Bounded, deterministic subset of original Valentina construction geometry.
// Coordinates are in source pattern units, with the same upward-positive angle
// convention as the Valentina XML (270 degrees is downward on the canvas).
const SUPPORTED = new Set(['single', 'endLine', 'alongLine', 'normal', 'pointOfIntersection', 'lineIntersectAxis'])
const LIMIT = 1e7
const number = (value, what) => {
  const v = Number(value)
  if (!Number.isFinite(v) || Math.abs(v) > LIMIT) throw Error(`${what}: invalid or out-of-bounds number`)
  return v
}

/** Safe expression interpreter: no eval, properties, JS execution or implicit symbols. */
export function evaluateValentinaFormula20261031(source, resolve) {
  if (typeof source !== 'string' || source.length > 4096) throw Error('Invalid Valentina formula length')
  const tokens = source.match(/\s*(?:#[A-Za-z][\w]*|[A-Za-z_][\w]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/^,;?:<>!=%-])\s*/g) || []
  if (!tokens.length || tokens.join('').replace(/\s/g, '') !== source.replace(/\s/g, '') || tokens.length > 512)
    throw Error(`Unsupported Valentina expression: ${source.slice(0, 80)}`)
  const t = tokens.map(v => v.trim())
  let i = 0
  const peek = () => t[i]
  const pop = () => t[i++]
  const expect = expected => { if (pop() !== expected) throw Error(`Expected ${expected} in Valentina formula`) }
  function primary() {
    const token = pop()
    if (token === '(') { const v = conditional(); expect(')'); return v }
    if (token === '+' || token === '-') return number((token === '-' ? -1 : 1) * primary(), 'formula')
    if (!token) throw Error('Incomplete Valentina formula')
    if (/^(?:\d|\.)/.test(token)) return number(token, 'formula')
    if (!/^(?:#[A-Za-z]\w*|[A-Za-z_]\w*)$/.test(token)) throw Error(`Unexpected formula token: ${token}`)
    if (peek() === '(') {
      pop()
      const args = []
      if (peek() !== ')') { args.push(conditional()); while (peek() === ';' || peek() === ',') { pop(); args.push(conditional()) } }
      expect(')')
      const operations = { min:Math.min, max:Math.max, abs:Math.abs, sqrt:Math.sqrt, sin:v=>Math.sin(v*Math.PI/180), cos:v=>Math.cos(v*Math.PI/180), tan:v=>Math.tan(v*Math.PI/180) }
      if (!Object.hasOwn(operations, token) || !args.length || args.length > 16) throw Error(`Unsupported Valentina function: ${token}`)
      return number(operations[token](...args), 'formula function')
    }
    return number(resolve(token), `unknown Valentina symbol ${token}`)
  }
  function power() { let v = primary(); if (peek() === '^') { pop(); v = number(v ** power(), 'formula power') } return v }
  function product() { let v = power(); while (['*', '/', '%'].includes(peek())) { const op = pop(), r = power(); v = number(op === '*' ? v*r : op === '/' ? v/r : v%r, 'formula arithmetic') } return v }
  function sum() { let v = product(); while (peek() === '+' || peek() === '-') { const op = pop(), r = product(); v = number(op === '+' ? v+r : v-r, 'formula arithmetic') } return v }
  function compare() { let v = sum(); while (['<','>','<=','>=','==','!='].includes(peek())) { const op=pop(), r=sum(); v=Number(op==='<'?v<r:op==='>'?v>r:op==='<='?v<=r:op==='>='?v>=r:op==='=='?v===r:v!==r) } return v }
  function conditional() { const v = compare(); if (peek() !== '?') return v; pop(); const yes = conditional(); expect(':'); const no = conditional(); return v ? yes : no }
  // Merge the multi-character comparison operators before interpretation.
  for (let at=t.length-2; at>=0; at--) if (['<','>','=','!'].includes(t[at]) && t[at+1]==='=') t.splice(at,2,t[at]+'=')
  const result = conditional()
  if (i !== t.length) throw Error(`Trailing Valentina expression token ${peek()}`)
  return number(result, 'formula result')
}

const delta = (a,b) => ({x:b.x-a.x,y:b.y-a.y})
const length = v => Math.hypot(v.x,v.y)
function direction(a,b) { const d=delta(a,b), len=length(d); if (len < 1e-10) throw Error('Coincident reference points'); return {x:d.x/len,y:d.y/len,length:len} }
const move = (p,d,amount) => ({x:number(p.x+d.x*amount,'point x'),y:number(p.y+d.y*amount,'point y')})
const rotate = (d, angle) => { const r=angle*Math.PI/180; return {x:d.x*Math.cos(r)-d.y*Math.sin(r),y:d.x*Math.sin(r)+d.y*Math.cos(r)} }
const cross = (a,b) => a.x*b.y-a.y*b.x
function intersect(a,ad,b,bd) {
  const denominator=cross(ad,bd)
  if (Math.abs(denominator)<1e-10) throw Error('Parallel or coincident intersection lines')
  return move(a,ad,cross(delta(a,b),bd)/denominator)
}

/** Evaluate source-linked point geometry, independently of unsupported curves/pieces.
 * `reference` may be parsed source or original .val XML. Overrides are keyed by
 * increment name (#L), measurement name (height), or tool id and formula attr.
 */
export function evaluateValentinaConnectedDraft20261031(reference, {increments={},measurements={},formulaEdits={},maxPoints=6000}={}) {
  const doc=typeof reference==='string'?parseValentinaConstructionReference(reference):reference
  if (doc?.format!=='exo-valentina-construction-reference.v1' || !Array.isArray(doc.blocks)) throw Error('Invalid Valentina construction reference')
  if (!Number.isInteger(maxPoints) || maxPoints<1 || maxPoints>6000) throw Error('Invalid point budget')
  const diagnostics=[],blocks=[]
  const edits = formulaEdits || {}
  const definitions=new Map((doc.increments||[]).map(item=>[item.name,item.formula]))
  for (const [key,value] of Object.entries(increments||{})) {
    if (!definitions.has(key)) throw Error(`Unknown Valentina increment ${key}`)
    if (typeof value!=='string' && typeof value!=='number') throw Error(`Invalid increment override ${key}`)
    definitions.set(key,String(value))
  }
  const variables=new Map(),busy=new Set()
  function symbol(name) {
    if (Object.hasOwn(measurements||{},name)) return number(measurements[name],`measurement ${name}`)
    if (variables.has(name)) return variables.get(name)
    if (!definitions.has(name)) throw Error(`Missing Valentina measurement or increment ${name}`)
    if (busy.has(name)) throw Error(`Cyclic increment ${name}`)
    busy.add(name)
    try { const value=evaluateValentinaFormula20261031(definitions.get(name),symbol); variables.set(name,value); return value }
    finally {busy.delete(name)}
  }
  let total=0
  for (const block of doc.blocks) {
    if (!Array.isArray(block.nodes)) throw Error('Invalid Valentina block')
    const nodes=new Map(),points=new Map(),states=new Map(),order=[]
    for (const node of block.nodes) {
      if (!/^\d+$/.test(node.id) || nodes.has(node.id)) throw Error(`Duplicate/invalid source tool ${node.id}`)
      nodes.set(node.id,node)
    }
    const byName=new Map()
    for (const node of block.nodes) if (node.name) { if (byName.has(node.name)) diagnostics.push({block:block.id,id:node.id,code:'DUPLICATE_POINT_NAME',message:`Duplicate name ${node.name}`}); else byName.set(node.name,node.id) }
    function point(id) {
      if (!nodes.has(String(id))) throw Error(`Missing point dependency id ${id}`)
      const node=nodes.get(String(id))
      if (node.family!=='point') throw Error(`Dependency ${id} is not a point`)
      if (states.get(node.id)==='visiting') throw Error(`Cycle in Valentina point dependencies at tool ${node.id}`)
      if (states.get(node.id)==='failed') throw Error(`Unresolved dependency ${node.id}`)
      if (points.has(node.id)) return points.get(node.id)
      states.set(node.id,'visiting')
      try {
        if (!SUPPORTED.has(node.type)) throw Error(`Unsupported point tool ${node.type}`)
        const a=node.attributes||{}
        const value=(name,context={})=>{
          const override=edits[node.id]?.[name]
          const expression=override===undefined?a[name]:override
          if (typeof expression!=='string' && typeof expression!=='number') throw Error(`Missing ${name} formula`)
          return evaluateValentinaFormula20261031(String(expression),key=>{
            if (key==='CurrentLength') return context.currentLength ?? (()=>{throw Error('CurrentLength unavailable')})()
            const line=/^Line_(.+)_(.+)$/.exec(key), angle=/^AngleLine_(.+)_(.+)$/.exec(key)
            if (line||angle) {
              const groups=line||angle
              const first=byName.get(groups[1]),second=byName.get(groups[2])
              if (!first||!second) throw Error(`Unknown named line ${key}`)
              const v=delta(point(first),point(second))
              return line?length(v):((Math.atan2(v.y,v.x)*180/Math.PI+360)%360)
            }
            return symbol(key)
          })
        }
        const get=key=>point(a[key])
        let p
        if (node.type==='single') p={x:value('x'),y:value('y')}
        else if (node.type==='endLine') {
          const origin=get('basePoint'),r=value('angle')*Math.PI/180
          p=move(origin,{x:Math.cos(r),y:Math.sin(r)},value('length'))
        } else if (node.type==='alongLine') {
          const origin=get('firstPoint'),d=direction(origin,get('secondPoint'))
          p=move(origin,d,value('length',{currentLength:d.length}))
        } else if (node.type==='normal') {
          const origin=get('firstPoint'),d=direction(origin,get('secondPoint'))
          p=move(origin,rotate(d,90+value('angle')),value('length',{currentLength:d.length}))
        } else if (node.type==='pointOfIntersection') {
          const first=get('firstPoint'),second=get('secondPoint')
          p={x:first.x,y:second.y}
        } else if (node.type==='lineIntersectAxis') {
          const base=get('basePoint'),one=get('p1Line'),two=get('p2Line'),r=value('angle')*Math.PI/180
          p=intersect(base,{x:Math.cos(r),y:Math.sin(r)},one,delta(one,two))
        }
        points.set(node.id,{id:node.id,name:node.name,x:number(p.x,'x'),y:number(p.y,'y'),type:node.type})
        states.set(node.id,'done');order.push(node.id)
        if (++total>maxPoints) throw Error('Valentina connected point budget exceeded')
        return points.get(node.id)
      } catch (error) { states.set(node.id,'failed'); throw error }
    }
    for (const node of block.nodes) if (node.family==='point') {
      try {point(node.id)} catch(error) { diagnostics.push({block:block.id,id:node.id,name:node.name,code:/[Cc]ycle/.test(error.message)?'CYCLE':/Unsupported/.test(error.message)?'UNSUPPORTED_TOOL':'GEOMETRY_ERROR',message:error.message}) }
    }
    blocks.push({id:block.id,name:block.name,points:[...points.values()],order,sourcePointCount:block.nodes.filter(n=>n.family==='point').length})
  }
  return {format:'exo-valentina-connected-draft.v1',unit:doc.unit,blocks,pointCount:total,diagnostics,supportedPointTypes:[...SUPPORTED]}
}

import {presetForFabric} from "../core/clothcraftFabrics.js"
import React, {useEffect, useId, useMemo, useRef, useState} from 'react'
import ClothCraftCornerTools from './ClothCraftCornerTools.jsx'
import {PatternReferenceImageLayer, PatternReferenceImageControls, usePatternReferenceImage} from './PatternReferenceImage.jsx'
import ClothCraftStudioSilhouette from './ClothCraftStudioSilhouette.jsx'
import './ClothCraftSegmentSewing.css'
import {cursorForTool} from '../core/toolCursors.js'
import {freeSewingPointAtFraction, freeSewingRangePoints, projectFreeSewingPoint} from '../core/freeSewingGeometry.js'
import {getBounds, frontAvatarRegistration, horizontalPatternSpans, verticalPatternSpans, previewPoint, rotatedLayoutAroundCenter, trianglePath, boundarySegments} from '../core/clothcraft2dGeometry.js'
import {sampleInternalCurve,initialInternalTangents} from './nativeInternalCurve.js'
import {cubicLength,editPatternBezierHandle,previewPatternAnchorMove} from '../core/vectorPatternBezier.js'
import {addNativeFreeCurvePoint,closestFreeCurveParameter,evaluateFreeCurve,moveNativeFreeCurvePoint,editNativeFreeCurveTangent,cubicDerivativeAt,freeCurveBase,removeNativeFreeCurvePoint,arclengthToFreeCurvePoint} from '../core/nativeFreeCurvePoints.js'
import {fitPencilStroke,pathCubicControls} from '../core/vectorFreehandFit.js'
import {teeBalanceNotchCommands} from '../core/patternSewingNotches.js'
import {shapePoints} from './FoamPaddingNativeOverlay.jsx'
import {measureNativeSelection} from '../core/clothcraftSelectionMetrics.js'
import {freeTangentDragDelta} from '../core/freeTangentDrag.js'
import {sewingLengthDiagnostic} from '../core/sewingLengthDiagnostics.js'

const COLORS = ['#527e91', '#d29465', '#7a9e79', '#a889b2', '#c3ab5d', '#76a5a4']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
// Solid CAD control-point fills must contrast with light/white fabric.
// Vertex, curve and seam correspondence dots have distinct visual roles.
const POINT_COLORS = {vertex:'#2276a9',selectedVertex:'#f08326',curve:'#8051bd',outline:'#fdfdfc'}
// CLO-style drafting hierarchy; presentation never modifies the pattern UVs.
// CLO-inspired drafting contrast: neutral pattern paper, dark stitch contours,
// and a distinct amber active selection without changing native geometry.
const PATTERN_VISUAL = {paper:'#fdfdfc',selectedPaper:'#fff5cb',outline:'#33383d',selectedOutline:'#d4a126',activeEdge:'#f08326'}
const INITIAL_VIEW = [-1.1, -.24, 2.2, 2]
const finite = value => Number.isFinite(value)
const formatCm = metres => `${(metres * 100).toFixed(1)} cm`
// Readouts use the current tessellated cutline in actual material metres.
// Keep this view-only approximation separate from manufacturing measurements.
function boundaryDisplayLength(indices, positions) {
  const points=indices.map(index=>positions[index]).filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))
  if(points.length<2)return null
  const segments=points.slice(1).map((p,i)=>{
    const a=points[i],dx=p[0]-a[0],dy=p[1]-a[1]
    return {a,dx,dy,length:Math.hypot(dx,dy)}
  }).filter(item=>item.length>1e-9)
  const length=segments.reduce((total,segment)=>total+segment.length,0)
  if(!(length>0))return null
  let remaining=length/2
  for(const segment of segments){
    if(remaining>segment.length){remaining-=segment.length;continue}
    const t=remaining/segment.length
    return {length,midpoint:[segment.a[0]+segment.dx*t,segment.a[1]+segment.dy*t],
      normal:[-segment.dy/segment.length,segment.dx/segment.length]}
  }
  return null
}
const SEWING_CURSOR = "url('/cursors/sewing-machine.svg') 5 3, crosshair"
const PLEAT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M4 3v21M11 3v21M18 3v21" fill="none" stroke="#152b3b" stroke-width="3"/><path d="M4 3v21M11 3v21M18 3v21" fill="none" stroke="#e6f7ff" stroke-width="1.5"/><path d="m21 9 4 4-4 4" fill="none" stroke="#152b3b" stroke-width="2"/></svg>')}") 4 3, crosshair`

function insideTriangle(p, a, b, c) {
  if (!a || !b || !c) return false
  const cross = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])
  const u = cross(a, b, p), v = cross(b, c, p), w = cross(c, a, p)
  const epsilon = 1e-9
  return (u >= -epsilon && v >= -epsilon && w >= -epsilon) ||
    (u <= epsilon && v <= epsilon && w <= epsilon)
}

function transform(panel, range, uv) {
  const a = (panel.layout_rotation_degrees || 0) * Math.PI / 180
  return [range.layout[0] + uv[0] * Math.cos(a) - uv[1] * Math.sin(a),
    range.layout[1] + uv[0] * Math.sin(a) + uv[1] * Math.cos(a)]
}

function weighted(weights, values) {
  if (!Array.isArray(weights) || !values.length) return null
  const result = [0, 0]
  for (const [index, weight] of weights) {
    if (!values[index] || !finite(weight)) return null
    result[0] += values[index][0] * weight
    result[1] += values[index][1] * weight
  }
  return result
}

// Each visible interval owns its own hit target; shared nodes are drawn once
// per connected guide. They follow model-space vertices at any camera zoom.
function GuideSegment({panelId,kind,id,a,b,color='#918fae',dashed=false,nativeLineId=null,selectedGuide,hoveredGuideId,onSelectGuide}) {
  const active=selectedGuide?.id===id
  const hot=hoveredGuideId===id
  const lengthMetres=Math.hypot(b[0]-a[0],b[1]-a[1])
  const selected={id,panelId,kind,lengthMetres,points:[a,b]}
  return <g data-2d-construction={kind} data-guide-id={id} data-guide-kind={kind}
    data-guide-panel={panelId} data-guide-segment={id} data-hovered={String(hot)}
    data-native-line-id={nativeLineId||undefined}>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      stroke={active?'#ed9d26':hot?'#ecab45':color}
      strokeWidth={active||hot?'.0046':'.0021'}
      strokeDasharray={dashed?'.004 .009':undefined} strokeLinecap="round" pointerEvents="none"/>
    {/* Hit testing belongs to the parent SVG in screen pixels. Overlapping
        3mm hem references must not steal each other's mouse target. */}
    {onSelectGuide&&<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent"
      strokeWidth=".018" pointerEvents="none"/>}
  </g>
}

function GuideNodes({panelId,kind,points,selectedGuide}) {
  const active=selectedGuide?.kind===kind||
    (selectedGuide?.nativeLineId&&kind===`native:${selectedGuide.nativeLineId}`)
  return <g data-2d-shared-nodes={kind} pointerEvents="none">
    {points.map((p,i)=><circle key={i} data-2d-shared-node={`${panelId}:${kind}:${i}`}
      cx={p[0]} cy={p[1]} r={active?'.0051':'.0038'} fill={active?'#fff1d5':'#f7f8f7'}
      stroke={active?'#e49a37':'#8c9296'} strokeWidth={active?'.0024':'.0015'}/>)}
  </g>
}

// Physically authored Rust InternalLines render on any garment panel and keep
// stable per-line IDs, independently of the illustrative drafting references.
function NativeInternalLines({panel,range,preview,onSelectGuide,selectedGuide,hoveredGuideId,
  activeInternalLine,curveMode,onSelectCurve,onStartTangent,handlePreview}) {
  return <g data-native-internal-lines-panel={panel.id}>
    {(panel.polygon?.lines||[]).map(line=>{
      const points=(line.points||[]).map(uv=>previewPoint(transform(panel,range,uv),preview))
      if(points.length<2)return null
      return <g key={line.id} data-native-internal-line={`${panel.id}:${line.id}`}>
        {points.slice(1).map((pt,i)=>{
          const sampled=sampleInternalCurve(line.points[i],line.points[i+1],
            line.tangents?.[i],line.tangents?.[i+1])
            .map(p=>previewPoint(transform(panel,range,p),preview))
          const id=`${panel.id}:native:${line.id}:${i}`
          const active=selectedGuide?.id===id
          const hot=hoveredGuideId===id
          const stroke=active?'#ed9d26':hot?'#ecab45':'#7c5bad'
          const shape=sampled.map(p=>p.join(',')).join(' ')
          return <g key={i} data-2d-construction="native-internal-line"
            data-guide-id={id} data-guide-kind="native-internal-line"
            data-guide-panel={panel.id} data-guide-segment={id}
            data-native-line-id={line.id} data-hovered={String(hot)}>
            <polyline data-guide-curve="true" points={shape} stroke={stroke} strokeWidth={active||hot?'.0055':'.0028'}
              strokeLinecap="round" strokeLinejoin="round" fill="none" pointerEvents="none"/>
            {curveMode&&<polyline data-internal-curve-hit={`${panel.id}:${line.id}:${i}`}
              points={shape} stroke="transparent" strokeWidth=".025" fill="none"
              pointerEvents="stroke" style={{cursor:'pointer'}}
              title="Click to edit curve · Option-click to straighten"
              onPointerDown={event=>event.stopPropagation()}
              onClick={event=>{event.stopPropagation();onSelectCurve?.(panel,line,event.altKey)}}/>}
          </g>
        })}
        <GuideNodes panelId={panel.id} kind={`native:${line.id}`} points={points} selectedGuide={selectedGuide}/>
        {curveMode&&activeInternalLine?.panel===panel.id&&activeInternalLine?.line===line.id&&
          points.map((p,i)=>{
            const tangent=line.tangents?.[i]||[0,0]
            const moved=handlePreview?.panelId===panel.id&&handlePreview.anchor===`l:${line.id}:${i}`
              ?handlePreview.delta:[0,0]
            const endUV=line.points[i].map((n,j)=>n+tangent[j]+moved[j])
            const handle=previewPoint(transform(panel,range,endUV),preview)
            return <g key={i} data-internal-control-group={`${panel.id}:${line.id}:${i}`}>
              <line x1={p[0]} y1={p[1]} x2={handle[0]} y2={handle[1]}
                stroke="#537d96" strokeWidth=".002" pointerEvents="none"/>
              <circle cx={handle[0]} cy={handle[1]} r=".011"
                data-internal-curve-handle={`${panel.id}:${line.id}:${i}`}
                data-control-point="internal-curve" fill="#7959b7" stroke="#203449" strokeWidth=".002"
                style={{cursor:'crosshair'}}
                onPointerDown={event=>onStartTangent?.(event,panel,`l:${line.id}:${i}`)}/>
            </g>
          })}
      </g>
    })}
  </g>
}

function guideGeometryAt(group,svg,clientX,clientY) {
  const line=group?.querySelector('polyline[data-guide-curve],line')
  const matrix=line?.getScreenCTM()
  if(!matrix)return null
  const polyline=line.tagName.toLowerCase()==='polyline'
  const pts=polyline
    ?(line.getAttribute('points')||'').trim().split(/\s+/).map(item=>item.split(',').map(Number))
    :[[Number(line.getAttribute('x1')),Number(line.getAttribute('y1'))],
      [Number(line.getAttribute('x2')),Number(line.getAttribute('y2'))]]
  if(pts.length<2||pts.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n))))return null
  const screen=pts.map(([x,y])=>{
    const p=svg.createSVGPoint()
    p.x=x;p.y=y
    return p.matrixTransform(matrix)
  })
  let distance=Infinity,lengthMetres=0
  for(let i=1;i<pts.length;i++){
    const a=screen[i-1],b=screen[i],dx=b.x-a.x,dy=b.y-a.y
    const len2=dx*dx+dy*dy
    if(len2>.001){
      const t=Math.max(0,Math.min(1,((clientX-a.x)*dx+(clientY-a.y)*dy)/len2))
      distance=Math.min(distance,Math.hypot(clientX-a.x-dx*t,clientY-a.y-dy*t))
    }
    lengthMetres+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])
  }
  return {distance,lengthMetres,points:[pts[0],pts.at(-1)]}
}

// Decorative drafting marks remain distinct from physically authored Rust
// notches/seam allowances/internal lines until the user creates native data.
function ConstructionGuides({panel, boundaries, uv, clipId, preview, onSelectGuide, selectedGuide, hoveredGuideId, showNotchReferences=true, onCreateGuideLine}) {
  const identity=`${panel?.id || ''} ${panel?.name || ''}`
  const torso=/front|back|bodice|torso/i.test(identity)
  const sleeve=/sleeve/i.test(identity)
  if (!uv?.length) return null
  const angle=((panel.layout_rotation_degrees||0)*Math.PI/180)+(preview?.kind==='rotate'?preview.angle:0)
  const c=Math.cos(angle),s=Math.sin(angle)
  const local=uv.map(p=>p&&[p[0]*c+p[1]*s,-p[0]*s+p[1]*c])
  const outline=Object.values(boundaries||{}).flat().map(i=>local[i]).filter(Boolean)
  const bounds=getBounds(outline)
  if (!bounds||bounds.width<.12||bounds.height<.10) return null
  const toWorld=([x,y])=>[x*c-y*s,x*s+y*c]
  const blue='#8f91ae',red='#b18a8d'
  const torsoSides=boundaries?.['side-left']&&boundaries?.['side-right']
    ? {'side-left':boundaries['side-left'],'side-right':boundaries['side-right']} : null
  const centerAtY=y=>{
    const sideSpans=torsoSides?horizontalPatternSpans(torsoSides,local,y):[]
    const fullSpans=horizontalPatternSpans(boundaries,local,y)
    const span=[...(sideSpans.length===1?sideSpans:fullSpans)].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]
    return span?(span[0]+span[1])/2:bounds.cx
  }
  const segment=(kind,id,p,q,dashed=false,color=blue)=><GuideSegment key={id}
    panelId={panel.id} kind={kind} id={id} a={p} b={q} dashed={dashed}
    color={color} onSelectGuide={onSelectGuide} selectedGuide={selectedGuide}
    hoveredGuideId={hoveredGuideId}/>
  const horizontal=(fraction,kind)=>{
    const y=bounds.minY+bounds.height*fraction
    const shape=horizontalPatternSpans(boundaries,local,y)
    const inside=torsoSides?horizontalPatternSpans(torsoSides,local,y):[]
    const spans=inside.length===1&&shape.some(([a,b])=>inside[0][0]>=a-.001&&inside[0][1]<=b+.001)?inside:shape
    return spans.filter(([a,b])=>b-a>.025).map(([a,b],i)=>{
      const mid=Math.max(a+.001,Math.min(b-.001,centerAtY(y)))
      const pts=[toWorld([a,y]),toWorld([mid,y]),toWorld([b,y])]
      return <g key={`${kind}:${i}`} data-2d-guide-track={kind}>
        {segment(kind,`${panel.id}:${kind}:${i}:left`,pts[0],pts[1])}
        {segment(kind,`${panel.id}:${kind}:${i}:right`,pts[1],pts[2])}
        <GuideNodes panelId={panel.id} kind={kind} points={pts} selectedGuide={selectedGuide}/>
      </g>
    })
  }
  const center=()=>{
    const chestY=bounds.minY+bounds.height*.46
    const x=centerAtY(chestY)
    const spans=verticalPatternSpans(boundaries,local,x)
    const longest=[...spans].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]
    if (!longest||longest[1]-longest[0]<.14)return null
    // Center nodes and transverse intersections are calculated from the same
    // centerAtY function. There is no second offset orange/yellow 'ghost' dot.
    const levels=[longest[0]+.006,...(torso?[.46,.64,.965,.975].map(f=>bounds.minY+bounds.height*f):[]),longest[1]-.006]
      .filter(y=>y>=longest[0]+.005&&y<=longest[1]-.005).sort((a,b)=>a-b)
    const pts=levels.map(y=>toWorld([centerAtY(y),y]))
    const kind=/back/i.test(identity)?'center-back':'center-front'
    return <g data-2d-guide-track={kind}>
      {pts.slice(1).map((p,i)=>segment(kind,`${panel.id}:${kind}:${i}`,pts[i],p,true,'#293b4d'))}
      {/* Transverse levels draw their one shared dot. Only center endpoints are unique. */}
      <GuideNodes panelId={panel.id} kind={kind} points={[pts[0],pts.at(-1)]} selectedGuide={selectedGuide}/>
    </g>
  }
  const shoulderOffsets=torso?Object.entries(boundaries||{}).flatMap(([name,indices])=>{
    if(!/^shoulder/i.test(name)||panel.polygon?.seam_allowances?.[name]>0)return []
    const vertices=indices.map(i=>local[i]).filter(Boolean)
    if(vertices.length<2)return []
    const offset=vertices.map((p,i)=>{
      const a=vertices[Math.max(0,i-1)],b=vertices[Math.min(vertices.length-1,i+1)]
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1
      const n=[-dy/length,dx/length],toward=[bounds.cx-p[0],bounds.cy-p[1]]
      const sign=n[0]*toward[0]+n[1]*toward[1]>=0?1:-1
      return toWorld([p[0]+n[0]*sign*.011,p[1]+n[1]*sign*.011])
    })
    // A shoulder is ONE drafting guide, even if its mesh has dozens of
    // sampled curve points. Keep those samples for an accurate stroke, but
    // expose ONLY the two true endpoints as Illustrator-like anchors.
    const kind='shoulder-offset-reference',id=`${panel.id}:${kind}:${name}`
    const active=selectedGuide?.id===id,hot=hoveredGuideId===id
    return [<g key={name} data-2d-guide-track={kind} data-guide-boundary={name}>
      <g data-2d-construction={kind} data-guide-id={id} data-guide-kind={kind}
        data-guide-panel={panel.id} data-guide-segment={id} data-hovered={String(hot)}>
        <polyline data-guide-curve="true" points={offset.map(p=>p.join(',')).join(' ')}
          stroke={active?'#ed9d26':hot?'#ecab45':'#8277c5'}
          strokeWidth={active||hot?'.0055':'.0028'} fill="none" pointerEvents="none"/>
      </g>
      <GuideNodes panelId={panel.id} kind={name} points={[offset[0],offset.at(-1)]}
        selectedGuide={selectedGuide}/>
    </g>]
  }):[]
  const marks=showNotchReferences?Object.entries(boundaries||{}).flatMap(([name,indices])=>{
    // Torso guide marks belong to the armhole/underarm attachment, not every
    // sleeve-top/cuff segment of an older one-piece T-shirt pattern. Separate
    // sleeve pieces may use a crown/cap balance notch instead.
    const underarm=/armhole|underarm|sleeve-under/i.test(name)
    const sleeveBalance=!torso&&/sleeve|cap|crown/i.test(name)
    if (!(underarm||sleeveBalance)||panel.polygon?.notches?.[name]?.length)return []
    const path=indices.map(i=>local[i]).filter(Boolean)
    if(path.length<2)return []
    const first=path[0],last=path[path.length-1]
    const length=path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0)
    if(length<.03)return []
    const isBack=/back/i.test(identity)
    const count=torso&&isBack?2:1
    return Array.from({length:count},(_,j)=>{
      const fraction=(/sleeve|cap|crown/i.test(name)?.5:.53)+(j-(count-1)/2)*.035
      const target=length*fraction
      let walked=0
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1])
        if(walked+segment>=target&&segment>0){
          const t=(target-walked)/segment,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
          const dx=(b[0]-a[0])/segment,dy=(b[1]-a[1])/segment
          const inward=((bounds.cx-p[0])*(-dy)+(bounds.cy-p[1])*dx)>=0?1:-1
          const depth=torso ? .028 : .014
          const q=[p[0]-dy*inward*depth,p[1]+dx*inward*depth]
          const worldP=toWorld(p),worldQ=toWorld(q)
          return <line key={`${name}:${j}`} data-2d-construction="notch-tick"
            data-guide-boundary={name} data-reference-mark="notch" data-notch-count={count}
            x1={worldP[0]} y1={worldP[1]} x2={worldQ[0]} y2={worldQ[1]}
            stroke={red} strokeWidth=".0032" strokeLinecap="round" pointerEvents="none"/>
        }
        walked+=segment
      }
      return null
    })
  }):[]
  return <g data-2d-guide-panel={panel.id} clipPath={`url(#${clipId})`}>
    {center()}
    {torso&&<>{horizontal(.46,'chest')}{horizontal(.64,'belly')}
      {horizontal(.965,'hem-upper')}{horizontal(.975,'hem-lower')}</>}
    {shoulderOffsets}
    {marks}
  </g>
}

function Dimensions({points, selected, panel, boundaries, uv, clipId, preview}) {
  if (points.length < 3) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX, height = maxY - minY
  if (!(width > .015 && height > .015)) return null
  const line = '#67767b', offset = .045, arrow = .009
  const y = maxY + offset, x = maxX + offset
  const font = {fontSize: '.019', fill: '#55656a', textAnchor: 'middle', paintOrder: 'stroke', stroke: '#eef0ef', strokeWidth: '.008'}
  return <g pointerEvents="none" opacity={selected ? .95 : .65}>
    <line x1={minX} x2={maxX} y1={y} y2={y} stroke={line} strokeWidth=".002"/>
    <path d={`M${minX + arrow},${y - arrow / 2}L${minX},${y}L${minX + arrow},${y + arrow / 2} M${maxX - arrow},${y - arrow / 2}L${maxX},${y}L${maxX - arrow},${y + arrow / 2}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={minX} x2={minX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <line x1={maxX} x2={maxX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <text x={(minX + maxX) / 2} y={y - .009} {...font}>{formatCm(width)}</text>
    <line x1={x} x2={x} y1={minY} y2={maxY} stroke={line} strokeWidth=".002"/>
    <path d={`M${x - arrow / 2},${minY + arrow}L${x},${minY}L${x + arrow / 2},${minY + arrow} M${x - arrow / 2},${maxY - arrow}L${x},${maxY}L${x + arrow / 2},${maxY - arrow}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={maxX + .012} x2={x + .012} y1={minY} y2={minY} stroke={line} strokeWidth=".001"/>
    <line x1={maxX + .012} x2={x + .012} y1={maxY} y2={maxY} stroke={line} strokeWidth=".001"/>
    <text x={x + .014} y={(minY + maxY) / 2} fontSize=".019" fill="#55656a" paintOrder="stroke" stroke="#eef0ef" strokeWidth=".008">{formatCm(height)}</text>
  </g>
}

function SelectionMarquee2D({points, panel, onStart, disabled}) {
  const b = getBounds(points)
  if (!b || b.width < .02 || b.height < .02) return null
  const handles = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
  const x = sign => sign===-1?b.minX:sign===1?b.maxX:b.cx
  const y = sign => sign===-1?b.minY:sign===1?b.maxY:b.cy
  const rotationY=b.minY-.07
  return <g data-2d-marquee={panel.id} aria-label={`2D transform selection: ${panel.name}`}>
    <rect x={b.minX} y={b.minY} width={b.width} height={b.height}
      fill="none" stroke="#2d646f" strokeWidth=".0025" strokeDasharray=".009 .006" pointerEvents="none"/>
    <rect data-2d-marquee-move={panel.id} x={b.minX} y={b.minY}
      width={b.width} height={b.height} fill="none" stroke="transparent" strokeWidth=".022"
      style={{cursor:disabled?'default':'move'}} pointerEvents="stroke"
      onPointerDown={e => onStart(e,panel,undefined,'move')}/>
    <line x1={b.cx} y1={b.minY} x2={b.cx} y2={rotationY}
      stroke="#2d646f" strokeWidth=".002" pointerEvents="none"/>
    <circle data-2d-rotate={panel.id} cx={b.cx} cy={rotationY} r=".012"
      fill="#fff" stroke="#2d646f" strokeWidth=".003" style={{cursor:'grab'}}
      onPointerDown={e => onStart(e,panel,undefined,'rotate')}/>
    {handles.map(([hx,hy]) => <rect key={`${hx},${hy}`} data-2d-scale-guide={`${hx},${hy}`}
      x={x(hx)-.008} y={y(hy)-.008} width=".016" height=".016"
      fill="#fff" stroke="#2d646f" strokeWidth=".0027" pointerEvents="none"/>)}
    <circle cx={b.cx} cy={b.cy} r=".007" stroke="#2d646f" strokeWidth=".002"
      fill="#fff" pointerEvents="none"/>
    <path d={`M${b.cx-.012} ${b.cy}h.024 M${b.cx} ${b.cy-.012}v.024`}
      stroke="#2d646f" strokeWidth=".0017" pointerEvents="none"/>
  </g>
}

function GraphicMeasurementBox({id, x, y, width, height, enabled, viewWidth}) {
  const line='#1486b7', tick=.008, extension=.018, labelStyle={fontSize:Math.max(.019,viewWidth/48),fontWeight:650,
    fill:'#095d82',stroke:'#f7f8f7',strokeWidth:'.006',paintOrder:'stroke'}
  return <g data-2d-graphic-measure-box={id} data-measurements-visible={String(enabled)}
    data-graphic-width-mm={(width*1000).toFixed(2)} data-graphic-height-mm={(height*1000).toFixed(2)}
    pointerEvents="none">
    {enabled&&<>
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={line}
        strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 3"/>
      <line x1={x} x2={x+width} y1={y-extension} y2={y-extension}
        stroke={line} strokeWidth=".002"/>
      <path d={`M${x} ${y-extension-tick}v${tick*2} M${x+width} ${y-extension-tick}v${tick*2}
        M${x} ${y-.004}v${-extension+.004} M${x+width} ${y-.004}v${-extension+.004}`}
        fill="none" stroke={line} strokeWidth=".002"/>
      <text x={x+width/2} y={y-extension-.008} textAnchor="middle" {...labelStyle}>
        {(width*1000).toFixed(1)} mm
      </text>
      <line x1={x+width+extension} x2={x+width+extension} y1={y} y2={y+height}
        stroke={line} strokeWidth=".002"/>
      <path d={`M${x+width+extension-tick} ${y}h${tick*2}
        M${x+width+extension-tick} ${y+height}h${tick*2}
        M${x+width+.004} ${y}h${extension-.004}
        M${x+width+.004} ${y+height}h${extension-.004}`}
        fill="none" stroke={line} strokeWidth=".002"/>
      <text x={x+width+extension+.012} y={y+height/2} textAnchor="middle"
        transform={`rotate(90 ${x+width+extension+.012} ${y+height/2})`} {...labelStyle}>
        {(height*1000).toFixed(1)} mm
      </text>
    </>}
  </g>
}

/**
 * Linked metric board. Props are compatible with the original ClothCraftWorkspace Board:
 * s, active, pick, hover, edit, mode, busy, onPolygon.
 * Optional overlays: showMeasurements, showSilhouette, showSeamDots (default true).
 * Dimensions measure each panel's current rotated bounding box in material space.
 * Chest and belly guide heights are proportional landmarks; horizontal
 * lengths use the actual cut outline / torso side edges (not circumference).
 */
export default function ClothCraftBoardV2({
  s, active, selection, pick = () => {}, hover = () => {}, edit = () => {},
  onCreateInternalLine = null,
  mode = 'edit', busy = false, onPolygon = () => {},
  graphics = [],
  foamPads = [], onMoveFoamPad = () => {},
  sewingVariant = 'free', sewingFirstEdge = null, sewingCommitting = false,
  onSegmentSewEdge = () => {}, freeSewPoints = [], onFreeSewPoint = () => {},
  editSewing = false, onSelectSewingSeam = () => {},
  onClearFreeSew = () => {}, allowFreeSewEase = false, onChangeFreeSewEase = () => {},
  selectedGraphicId = null, onSelectGraphic = () => {}, onMoveGraphic = () => {},
  showGraphicMeasurements = true, showGraphicMeasurementToggle = true, onToggleGraphicMeasurements = () => {},
  walkSeamId = null, walkFraction = 0,
  onChangeMode = () => {}, onContextMenuRequest = () => {}, onAvatarPick = () => {},
  showMeasurements = true, showSilhouette = true, showSeamDots = true, showAvatar = true, showGrid = true,
}) {
  const svg = useRef(null), drag = useRef(null), tapeDrag = useRef(null), graphicDrag = useRef(null),
    previousMeasureTool = useRef(false), [view, setView] = useState(INITIAL_VIEW), [draft, setDraft] = useState([])
  const [preview, setPreview] = useState(null)
  const foamDrag=useRef(null)
  const [foamPreview,setFoamPreview]=useState(null)
  const [handlePreview,setHandlePreview] = useState(null)
  const [mirrorFreeCurve,setMirrorFreeCurve] = useState(false)
  const [freeCurveStatus,setFreeCurveStatus] = useState('')
  const [hoveredSplitMirrorGroup,setHoveredSplitMirrorGroup] = useState(null)
  const [vectorTangents,setVectorTangents] = useState([])
  const [pencilSamples,setPencilSamples] = useState([])
  const vectorDrag=useRef(null)
  // Selected construction guides are measured from the current UV/boundary
  // geometry. They remain guide objects until explicitly authored as Rust
  // internal lines; selection never mutates a garment or adds false stitches.
  const [selectedGuide, setSelectedGuide] = useState(null)
  const [activeInternalLine,setActiveInternalLine] = useState(null)
  useEffect(()=>setActiveInternalLine(null),[s?.template?.id,s?.template?.name])
  const [hoveredGuideId,setHoveredGuideId] = useState(null)
  const [showReferenceGuides, setShowReferenceGuides] = useState(true)
  const [showInternalLines,setShowInternalLines] = useState(true)
  const [showNativeNotches, setShowNativeNotches] = useState(true)
  const [showNativeAllowances, setShowNativeAllowances] = useState(true)
  const [allowanceWidthMm, setAllowanceWidthMm] = useState(10)
  const displayLayers={reference:showReferenceGuides,internal:showInternalLines,notches:showNativeNotches,allowances:showNativeAllowances}
  const toggleDisplayLayer=name=>{
    if(name==='reference')setShowReferenceGuides(value=>!value)
    if(name==='internal')setShowInternalLines(value=>!value)
    if(name==='notches')setShowNativeNotches(value=>!value)
    if(name==='allowances')setShowNativeAllowances(value=>!value)
    setSelectedGuide(null)
  }
  // Geometry edits invalidate a cached guide measurement. Re-selection always
  // computes a new length from the latest real boundary coordinates.
  useEffect(()=>setSelectedGuide(null),[s?.revision])
  const [graphicPreview, setGraphicPreview] = useState(null)
  const [freeHover, setFreeHover] = useState(null)
  const [tape, setTape] = useState([])
  const [pomStart,setPomStart] = useState(null)
  const [selectedPom,setSelectedPom] = useState(null)
  const [pomLabelDraft,setPomLabelDraft] = useState('')
  // A pending first click is bound to an exact native revision. Discard it
  // after any committed shape edit, Undo/Redo or project load, so the second
  // click cannot submit a stale named-edge reference against new geometry.
  useEffect(()=>{
    setPomStart(null)
    setTape([])
  },[s?.revision,s?.template?.name])
  // Both Edit Points and Edit Curves share the upstream 'edit' mode, but
  // neither should receive the 2D pattern-transform marquee.
  const [tool2d, setTool2d] = useState('select')
  const drawingPanel = useRef(null)
  useEffect(() => {
    const receiveTool = event => {
      const tool = event?.detail?.tool
      const modes = {select:'edit',point:'edit',curve:'edit',split:'edit',notch:'edit',allowance:'edit',annotation:'edit',editAnnotation:'edit',sew:'sew','seam-edit':'edit',internal:'line',line:'line',polygon:'pen','vector-pen':'pen','vector-pencil':'pen',pleat:'edit',measure:'edit','measure-edit':'edit'}
      if (!Object.hasOwn(modes,tool)) return
      setTool2d(tool)
      setFreeCurveStatus('')
      setDraft([])
      setVectorTangents([])
      setPencilSamples([])
      vectorDrag.current=null
      drawingPanel.current = null
      if(!previousMeasureTool.current || !['measure','measure-edit'].includes(tool))setTape([])
      setPomStart(null)
      previousMeasureTool.current=['measure','measure-edit'].includes(tool)
      onChangeMode(modes[tool])
    }
    window.addEventListener('exo-clothcraft-select-2d-tool',receiveTool)
    return () => window.removeEventListener('exo-clothcraft-select-2d-tool',receiveTool)
  },[onChangeMode])
  useEffect(()=>{
    let applying=false
    const placeSewingMarks=async(event)=>{
      if(event?.detail?.tool!=='sewing-match-notches'||busy||applying)return
      const commands=teeBalanceNotchCommands(s?.template)
      if(!commands.length)return
      applying=true
      try{
        // Sequential native edits preserve revision ordering and undo history.
        for(const command of commands){
          const result=await edit(command)
          if(!result)break
        }
        setShowNativeNotches(true)
      }finally{applying=false}
    }
    window.addEventListener('exo-clothcraft-select-2d-tool',placeSewingMarks)
    return()=>window.removeEventListener('exo-clothcraft-select-2d-tool',placeSewingMarks)
  },[busy,s?.template,edit])
  const editSewingActive = editSewing && mode === 'edit' && tool2d === 'seam-edit'
  const selectedSewingMeasurement=editSewingActive&&selection?.seamId?
    sewingLengthDiagnostic(measureNativeSelection(s,{seamId:selection.seamId})) : null
  const transform2d = mode === 'edit' && tool2d === 'select'
  const selectConstructionGuide = guide => {
    setSelectedGuide(guide)
    setActiveInternalLine(guide.nativeLineId?{panel:guide.panelId,line:guide.nativeLineId}:null)
    pick({panel:guide.panelId})
    window.dispatchEvent(new CustomEvent('exo-clothcraft-2d-guide-selection',{detail:guide}))
  }
  // Captured clicks can land on an overlapping pattern fill even when the
  // fine SVG construction line is visible. Resolve guide proximity in screen
  // pixels so selecting a line is stable at any board zoom or resolution.
  const findGuideUnderPointer = event => {
    if(busy || mode!=='edit' || tool2d!=='select' || !(showReferenceGuides||showInternalLines))return null
    // Lower hem references can lie within the broad native boundary hit
    // stroke. Give the precise nearby guide priority in Select mode; active
    // Notch/Seam Allowance/Sew tools still own boundary editing.
    if(event.target?.closest?.('[data-2d-graphic-hit],[data-control-point],[data-2d-marquee-move],[data-2d-rotate],[data-2d-graphic-item]'))return null
    const canvas=svg.current
    if(!canvas)return null
    let best=null,smallest=7
    for(const group of canvas.querySelectorAll('[data-guide-id]')){
      const geom=guideGeometryAt(group,canvas,event.clientX,event.clientY)
      if(!geom)continue
      const id=group.getAttribute('data-guide-id')
      const panelId=group.getAttribute('data-guide-panel')
      if(!id||!panelId)continue
      const {distance,lengthMetres,points}=geom
      if(!Number.isFinite(lengthMetres)||lengthMetres<.001)continue
      const kind=group.getAttribute('data-guide-kind') || id.split(':').at(-2)
      // Centerline intersects horizontal guide nodes. Prefer transverse
      // segments within 2px of shared points, then closest segment otherwise.
      const score=distance+(/center-(front|back)/.test(kind)?2:0)
      if(score>=smallest)continue
      smallest=score
      best={id,panelId,kind,lengthMetres,nativeLineId:group.getAttribute('data-native-line-id')||null,points}
    }
    return best
  }
  const selectGuideUnderPointer = event => {
    // Keep click identity consistent with the segment already highlighted on
    // hover. Native hem outlines often overlap both reference hit ranges.
    const hoveredGroup=hoveredGuideId&&[...(svg.current?.querySelectorAll('[data-guide-id]')||[])]
      .find(group=>group.getAttribute('data-guide-id')===hoveredGuideId)
    const hoveredGeometry=hoveredGroup&&guideGeometryAt(hoveredGroup,svg.current,event.clientX,event.clientY)
    const best=hoveredGeometry?.distance<7?{id:hoveredGuideId,panelId:hoveredGroup.getAttribute('data-guide-panel'),
      kind:hoveredGroup.getAttribute('data-guide-kind'),points:hoveredGeometry.points,
      nativeLineId:hoveredGroup.getAttribute('data-native-line-id')||null,
      lengthMetres:hoveredGeometry.lengthMetres}:findGuideUnderPointer(event)
    if(!best)return false
    event.stopPropagation()
    selectConstructionGuide(best)
    return true
  }
  const createNativeLineFromGuide = guide => {
    if(!guide||guide.nativeLineId)return
    if(onCreateInternalLine)return onCreateInternalLine(guide)
    const range=s?.panels?.find(item=>item.id===guide.panelId)
    const panel=s?.template?.panels?.find(item=>item.id===guide.panelId)
    if(!range||!panel?.polygon||!Array.isArray(guide.points)||guide.points.length!==2)return
    // The board's global SVG positions include layout translation and panel
    // rotation. Rust InternalLine stores canonical panel-local material metres.
    const radians=(panel.layout_rotation_degrees||0)*Math.PI/180
    const c=Math.cos(radians),sin=Math.sin(radians)
    // Reference guides intentionally end at the cut outline, but native Rust
    // requires every authored InternalLine point to lie strictly *inside* it.
    // Inset both ends in physical metres, independent of zoom or canvas size.
    const [[ax,ay],[bx,by]]=guide.points
    const dx=bx-ax,dy=by-ay,distance=Math.hypot(dx,dy)
    if(!Number.isFinite(distance)||distance<.03)return
    const inset=Math.min(.01,distance*.1)
    const inner=[
      [ax+dx/distance*inset,ay+dy/distance*inset],
      [bx-dx/distance*inset,by-dy/distance*inset],
    ]
    const points=inner.map(([x,y])=>{
      const u=x-range.layout[0],v=y-range.layout[1]
      return [u*c+v*sin,-u*sin+v*c]
    })
    if(points.some(p=>p.some(value=>!Number.isFinite(value))))return
    return edit({kind:'InternalLine',panel:guide.panelId,points,tangents:points.map(()=>[0,0])})
  }
  const selectNativeCurve = (panel,line,straighten=false) => {
    if(busy||mode!=='edit'||tool2d!=='curve')return
    pick({panel:panel.id})
    setActiveInternalLine({panel:panel.id,line:line.id})
    const tangents=line.tangents||[]
    if(straighten){
      if(!tangents.some(t=>Math.hypot(...t)>.00001))return
      const polygon=structuredClone(panel.polygon)
      const original=polygon?.lines?.find(entry=>entry.id===line.id)
      if(!original)return
      original.tangents=original.points.map(()=>[0,0])
      void edit({kind:'Shape',panel:panel.id,polygon})
      return
    }
    // Convert a straight internal line to a Bézier without changing its
    // geometry. The first/last collinear handles mirror CLO's curve tool.
    if(tangents.length===line.points.length&&tangents.some(t=>Math.hypot(...t)>.00001))return
    const polygon=structuredClone(panel.polygon)
    const original=polygon?.lines?.find(entry=>entry.id===line.id)
    if(!original)return
    original.tangents=initialInternalTangents(original.points)
    void edit({kind:'Shape',panel:panel.id,polygon})
  }
  const segmentSewing = mode === 'sew' && tool2d === 'sew' && sewingVariant === 'segment'
  const freeSewing = mode === 'sew' && tool2d === 'sew' && sewingVariant !== 'segment'
  const sewingActive = segmentSewing || freeSewing
  useEffect(()=>{if(!freeSewing)setFreeHover(null)},[freeSewing])
  const [viewPreset, setViewPreset] = useState('FRONT')
  // At overview scale a 1cm grid aliases into a flat gray surface; use the
  // coarser CLO drafting grid until the user zooms close enough for 1cm cells.
  const gridMinorStep=view[2]>1.25?.05:.01
  const gridMajorStep=view[2]>1.25?.25:.05
  const uid = useId().replace(/:/g, '')
  const panels = useMemo(() => {
    if (!s?.panels || !s?.template?.panels || !s?.uv) return []
    return s.panels.map((range, i) => {
      const panel = s.template.panels.find(p => p.id === range.id)
      if (!panel) return null
      const localIndices = Object.values(range.boundaries || {}).flat()
      const unique = [...new Set(localIndices)]
      const points = unique.map(n => s.uv[n] && transform(panel, range, s.uv[n])).filter(Boolean)
      return {panel, range, color: COLORS[i % COLORS.length], points}
    }).filter(Boolean)
  }, [s])
  const pomRows=panels.flatMap(({panel})=>(panel.polygon?.measurements||[]).map(measurement=>({
    panelId:panel.id,measurement,
  })))
  const selectedPomRow=pomRows.find(row=>row.panelId===selectedPom?.panel&&row.measurement.id===selectedPom?.id)
  const boardUV = useMemo(() => {
    if (!s?.uv) return []
    const map = []
    for (const item of panels) {
      const [first, last] = item.range.vertices || []
      for (let i = first; i < last; i++) if (s.uv[i])
        map[i] = previewPoint(transform(item.panel, item.range, s.uv[i]),
          preview?.panelId === item.panel.id ? preview : null)
    }
    return map
  }, [s, panels, preview])
  const bounds = useMemo(() => {
    const points = panels.flatMap(p => p.points)
    if (!points.length) return {cx:0, cy:0, minX:-.3, maxX:.3, minY:0, maxY:1}
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
    return {cx:(minX+maxX)/2, cy:(minY+maxY)/2, minX,maxX,minY,maxY}
  },[panels])
  // FRONT matches our original Garment Studio front-body drafting convention:
  // the *front garment* is centered over the avatar on the dark X=0 axis.
  // A whole-board midpoint incorrectly places the body between front and back.
  // GRID keeps the upstream ClothCraft side-by-side layout centered as a set.
  // Both transforms affect presentation only. UVs, seam links, physical metres,
  // pointer inversions and upstream authored panel origins stay unchanged.
  const wholeFront=panels.find(({panel})=>String(panel.id).toLowerCase()==='front')
  const frontPieces=wholeFront?[wholeFront]:panels.filter(({panel})=>/front|bodice/i.test(`${panel.id} ${panel.name}`))
  const frontParts=frontPieces.length?frontPieces:[panels[0]].filter(Boolean)
  const frontBounds=getBounds(frontParts.flatMap(item=>item.points)) || bounds
  const originalAlignment = useRef(null)
  const documentKey = s?.template?.id ?? s?.template?.name ?? null
  const reference = usePatternReferenceImage(`native:${documentKey || 'default'}`)
  if (panels.length && (!originalAlignment.current || originalAlignment.current.key !== documentKey)) {
    const registration=frontAvatarRegistration(frontParts.map(item=>({...item,uv:s?.uv})),s?.avatar)
    const frontOffset=[-(registration?.centerX ?? frontBounds.cx), .76-frontBounds.cy]
    originalAlignment.current = {
      key: documentKey,
      front: frontOffset,
      grid: [-bounds.cx, .76-bounds.cy],
      // Register the actual body mesh shoulder span against the authored front
      // shoulder edges. This guide-only translation is fixed per document so
      // moving a panel never causes the fabric to snap back to the figure.
      avatarX:registration?.matchedShoulders ? registration.avatarX : 0,
      avatarY:registration?.matchedShoulders ? registration.avatarY+frontOffset[1] : .95,
      shoulderY:(registration?.shoulderY ?? frontBounds.minY)+frontOffset[1],
    }
  }
  // Freeze this offset during edits: otherwise moving the front panel would
  // recompute its origin every frame and visually snap the shirt back to X=0.
  const offset = viewPreset === 'FRONT'
    ? (originalAlignment.current?.front || [0,0])
    : (originalAlignment.current?.grid || [0,0])
  const displayed = {minX:bounds.minX+offset[0],maxX:bounds.maxX+offset[0],minY:bounds.minY+offset[1],maxY:bounds.maxY+offset[1]}
  const spanX = displayed.maxX-displayed.minX, spanY=displayed.maxY-displayed.minY
  // The figure remains 1.75m tall in physical board coordinates, registered
  // by actual front shoulders. Never resize its shape to a pattern bounding box.
  const avatarAnchorX = originalAlignment.current?.avatarX ?? 0
  const avatarAnchorY = originalAlignment.current?.avatarY ?? .95
  const avatarVisible = showAvatar && showSilhouette && viewPreset === 'FRONT' && s?.avatar?.positions?.length > 0
  const focus = (onlySelected=false) => {
    let b=displayed
    if(onlySelected && (selection?.panel || active?.panel)){
      const entry=panels.find(p=>p.panel.id===(selection?.panel || active?.panel))
      if(entry?.points.length){
        const xs=entry.points.map(p=>p[0]+offset[0]),ys=entry.points.map(p=>p[1]+offset[1])
        b={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
      }
    } else if (avatarVisible) {
      // Frame all includes the full body, including its feet and head, rather
      // than zooming to only the bodice and cutting away the guide figure.
      b={minX:Math.min(b.minX,avatarAnchorX-.56),maxX:Math.max(b.maxX,avatarAnchorX+.56),
        minY:Math.min(b.minY,avatarAnchorY-.875),maxY:Math.max(b.maxY,avatarAnchorY+.875)}
    }
    const pad=.22
    const w=Math.max(.9,b.maxX-b.minX+pad*2),h=Math.max(.9,b.maxY-b.minY+pad*2)
    const width=Math.max(w,h*1.1)
    setView([(b.minX+b.maxX-width)/2,(b.minY+b.maxY-width/1.1)/2,width,width/1.1])
  }
  const initialized = useRef(null)
  useEffect(()=>{
    const key=s?.template?.id ?? s?.template?.name ?? null
    if(key !== initialized.current && panels.length){
      initialized.current=key
      // FRONT keeps x=0 centered on the visible figure; extend both sides
      // enough to retain the complete neighboring back panel, rather than
      // clipping its sleeve at the right edge of a split viewport.
      const largestExtent = Math.max(Math.abs(displayed.minX),Math.abs(displayed.maxX))
      const w=Math.max(2.15,2*(largestExtent+.17),(spanY+.65)*1.1,
        avatarAnchorY>0 ? (Math.max(displayed.maxY,avatarAnchorY+.875)-Math.min(displayed.minY,avatarAnchorY-.875)+.22)*1.1 : 0)
      setView([-w/2,avatarAnchorY-w/2.2,w,w/1.1])
    }
  },[s?.template?.id,s?.template?.name,panels.length,spanX,spanY])
  const point = e => {
    const el = svg.current
    const matrix = el?.getScreenCTM()
    if (!matrix) return null
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const q = p.matrixTransform(matrix.inverse())
    return [q.x-offset[0], q.y-offset[1]]
  }
  const beginFoamDrag=(event,pad)=>{
    if(busy||tool2d!=='select'||pad.locked||event.button!==0)return
    const p=point(event);if(!p)return
    event.preventDefault();event.stopPropagation()
    foamDrag.current={id:pad.id,pointerId:event.pointerId,start:p,x:pad.x||0,y:pad.y||0,angle:(s?.template?.panels?.find(panel=>panel.id===pad.panel)?.layout_rotation_degrees||0)*Math.PI/180}
    setFoamPreview({id:pad.id,x:pad.x||0,y:pad.y||0})
    svg.current?.setPointerCapture(event.pointerId)
  }
  const moveFoamDrag=event=>{
    const drag=foamDrag.current
    if(!drag||drag.pointerId!==event.pointerId)return false
    const p=point(event);if(!p)return true
    const dx=(p[0]-drag.start[0])*100,dy=(p[1]-drag.start[1])*100,c=Math.cos(drag.angle),s=Math.sin(drag.angle)
    setFoamPreview({id:drag.id,x:drag.x+dx*c+dy*s,y:drag.y-dx*s+dy*c})
    return true
  }
  const endFoamDrag=event=>{
    const drag=foamDrag.current
    if(!drag||drag.pointerId!==event.pointerId)return false
    const p=point(event)
    if(p){const dx=(p[0]-drag.start[0])*100,dy=(p[1]-drag.start[1])*100,c=Math.cos(drag.angle),s=Math.sin(drag.angle)
      onMoveFoamPad(drag.id,{x:Number((drag.x+dx*c+dy*s).toFixed(3)),y:Number((drag.y-dx*s+dy*c).toFixed(3))})}
    foamDrag.current=null;setFoamPreview(null)
    try{svg.current?.releasePointerCapture(event.pointerId)}catch{}
    return true
  }
  const startGraphicDrag = (event, graphic, panel) => {
    // The global editor mode may be 'move3d' while the 2D side remains in
    // Select. The graphic still needs to be editable in its own viewport.
    if (busy || tool2d!=='select' || event.button!==0) return
    const p=point(event)
    if(!p)return
    event.stopPropagation()
    event.preventDefault()
    svg.current.setPointerCapture(event.pointerId)
    // Printing stores the upper-left position in millimetres from the panel's
    // unrotated rest UV. The 2D board uses y-down screen coordinates.
    graphicDrag.current={id:graphic.id,start:p,position:[...(graphic.positionMm||[0,0])],
      angle:(panel.layout_rotation_degrees||0)*Math.PI/180,pointerId:event.pointerId}
    setGraphicPreview(null)
    onSelectGraphic(graphic.id)
    // Selecting an image must not trigger native pattern selection: that can
    // route the right property editor away from the graphic mid-drag.
  }
  const graphicPositionAt = (event,d) => {
    const p=point(event)
    if(!p)return null
    const dx=p[0]-d.start[0],dy=p[1]-d.start[1]
    const c=Math.cos(d.angle),s=Math.sin(d.angle)
    return [d.position[0]+(dx*c+dy*s)*1000,d.position[1]+(dx*s-dy*c)*1000]
      .map(value=>Math.round(Math.max(-2000,Math.min(3000,value))*10)/10)
  }
  const moveGraphicDrag = event => {
    const d=graphicDrag.current
    if(!d||event.pointerId!==d.pointerId)return false
    const positionMm=graphicPositionAt(event,d)
    if(positionMm)setGraphicPreview({id:d.id,positionMm})
    return true
  }
  const endGraphicDrag = event => {
    const d=graphicDrag.current
    if(!d||event.pointerId!==d.pointerId)return false
    const positionMm=graphicPositionAt(event,d)
    graphicDrag.current=null
    setGraphicPreview(null)
    if(positionMm&&Math.hypot(positionMm[0]-d.position[0],positionMm[1]-d.position[1])>=.1)
      onMoveGraphic(d.id,positionMm)
    return true
  }
  const createAnnotation = (e, panel, range) => {
    if (busy || mode !== 'edit' || tool2d !== 'annotation') return false
    const xy = point(e)
    if (!xy) return true
    e.stopPropagation()
    const radians = (panel.layout_rotation_degrees || 0) * Math.PI / 180
    const dx = xy[0] - range.layout[0], dy = xy[1] - range.layout[1]
    const position = [dx * Math.cos(radians) + dy * Math.sin(radians), -dx * Math.sin(radians) + dy * Math.cos(radians)]
    const text = window.prompt('Pattern annotation text')
    if (text?.trim()) { pick({panel:panel.id}); void edit({kind:'Annotation',panel:panel.id,text:text.trim(),position}) }
    return true
  }
  const start = (e, panel, anchor, kind='move', handle=null) => {
    if (busy || ['sew', 'pen', 'line'].includes(mode) || e.button !== 0) return
    if (anchor === undefined && !transform2d) {
      // Point and curve tools select the fabric without translating it.
      e.stopPropagation()
      pick({panel: panel.id})
      return
    }
    const startPoint = point(e)
    if (!startPoint) return
    // Own the pointer gesture; browser text/image drag can cancel pointerup
    // after selection changes between consecutive curve-handle edits.
    e.preventDefault()
    e.stopPropagation()
    svg.current.setPointerCapture(e.pointerId)
    const entry=panels.find(item => item.panel.id===panel.id)
    const b=getBounds(entry?.points)
    drag.current = {panel, anchor, start: startPoint, kind, handle, bounds:b,
      breakTangents:e.altKey, snapAngle:e.shiftKey}
    setPreview(null)
    pick({panel: panel.id,...(typeof anchor==='string'&&(anchor.startsWith('c:')||anchor.startsWith('f:')||anchor.startsWith('ft:'))
      ?{edge:anchor.split(':')[1]}:
      Number.isInteger(anchor)&&tool2d==='curve'?{edge:panel.polygon?.edges?.[anchor]}:{}),
      ...(anchor !== undefined ? {anchor} : {})})
  }
  const updatePreview = (e, d) => {
    const q=point(e)
    if (!q || !d?.bounds) return null
    const delta=q.map((n,i)=>n-d.start[i])
    if (d.kind==='rotate') {
      const b=d.bounds, angle=Math.atan2(q[1]-b.cy,q[0]-b.cx)-
        Math.atan2(d.start[1]-b.cy,d.start[0]-b.cx)
      const normalized=Math.atan2(Math.sin(angle),Math.cos(angle))
      const snapped=e.shiftKey?Math.round(normalized/(Math.PI/12))*(Math.PI/12):normalized
      return {panelId:d.panel.id,kind:'rotate',angle:snapped,center:[b.cx,b.cy]}
    }
    // CLO-like straight-axis / diagonal constraint while translating.
    if (e.shiftKey) {
      const [dx,dy]=delta, ax=Math.abs(dx),ay=Math.abs(dy)
      if(ax>ay*1.75)delta[1]=0
      else if(ay>ax*1.75)delta[0]=0
      else {const length=Math.min(ax,ay);delta[0]=Math.sign(dx)*length;delta[1]=Math.sign(dy)*length}
    }
    return {panelId:d.panel.id,kind:'move',delta}
  }
  const move = e => {
    const d=drag.current
    if (!d || d.pan) return
    if(typeof d.anchor==='string'&&(d.anchor.startsWith('c:')||d.anchor.startsWith('l:')||d.anchor.startsWith('f:')||d.anchor.startsWith('ft:'))){
      const q=point(e)
      if(q){
        const a=-(d.panel.layout_rotation_degrees||0)*Math.PI/180
        const dx=q[0]-d.start[0],dy=q[1]-d.start[1]
        const delta=[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)]
        const polygon=d.anchor.startsWith('ft:')?(()=>{
          const [,edge,id]=d.anchor.split(':')
          const side=d.anchor.split(':')[3]||'out'
          return editNativeFreeCurveTangent(d.panel.polygon,edge,id,freeTangentDragDelta(delta,side),{snapAngle:e.shiftKey||d.snapAngle,side,breakTangents:e.altKey||d.breakTangents})
        })():d.anchor.startsWith('f:')?(()=>{
          const [,edge,id]=d.anchor.split(':')
          return moveNativeFreeCurvePoint(d.panel.polygon,edge,id,delta)
        })():d.anchor.startsWith('c:')?(()=>{
          const [,edge,index]=d.anchor.split(':')
          return editPatternBezierHandle(d.panel.polygon,edge,Number(index),delta,
            {breakTangents:e.altKey,snapAngle:e.shiftKey})
        })():null
        setHandlePreview({panelId:d.panel.id,anchor:d.anchor,delta,polygon})
      }
      return
    }
    if(Number.isInteger(d.anchor)&&tool2d==='curve'){
      const q=point(e)
      if(q){
        const a=-(d.panel.layout_rotation_degrees||0)*Math.PI/180
        const dx=q[0]-d.start[0],dy=q[1]-d.start[1]
        const delta=[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)]
        setHandlePreview({panelId:d.panel.id,anchorIndex:d.anchor,
          polygon:previewPatternAnchorMove(d.panel.polygon,d.anchor,delta)})
      }
      return
    }
    if(d.anchor!==undefined)return
    const next=updatePreview(e,d)
    d.lastPreview=next
    setPreview(next)
  }
  const up = e => {
    const d = drag.current
    drag.current = null
    setPreview(null)
    setHandlePreview(null)
    if (!d) return
    const q = point(e)
    if (!q) return
    const delta = q.map((n, i) => n - d.start[i])
    if (Math.hypot(...delta) < .002) {
      if (d.pan && d.background) pick(null)
      return
    }
    if (d.pan) {
      setView(v => [v[0] - delta[0], v[1] - delta[1], v[2], v[3]])
      return
    }
    const range = s.panels.find(p => p.id === d.panel.id)
    if (!range) return
    if(d.anchor===undefined && d.kind==='rotate') {
      const p=updatePreview(e,d)
      if(!p || Math.abs(p.angle)<.004)return
      const degrees=p.angle*180/Math.PI
      edit({kind:'BoardTransform',panel:d.panel.id,
        origin:rotatedLayoutAroundCenter(range.layout,degrees,p.center),
        rotation_degrees:(d.panel.layout_rotation_degrees||0)+degrees})
      return
    }
    if (d.anchor !== undefined) {
      const a = -(d.panel.layout_rotation_degrees || 0) * Math.PI / 180
      const local = [delta[0] * Math.cos(a) - delta[1] * Math.sin(a), delta[0] * Math.sin(a) + delta[1] * Math.cos(a)]
      if (typeof d.anchor === 'string') {
        let polygon = structuredClone(d.panel.polygon)
        const [, identifier, index] = d.anchor.split(':')
        if(d.anchor.startsWith('ft:')){
          polygon=editNativeFreeCurveTangent(d.panel.polygon,identifier,index,freeTangentDragDelta(local,d.anchor.split(':')[3]||'out'),
            {snapAngle:e.shiftKey||d.snapAngle,side:d.anchor.split(':')[3]||'out',breakTangents:e.altKey||d.breakTangents})
          if(!polygon)return
        }else if(d.anchor.startsWith('f:')){
          polygon=moveNativeFreeCurvePoint(d.panel.polygon,identifier,index,local)
          if(!polygon)return
        }else if(d.anchor.startsWith('l:')){
          const line=polygon.lines?.find(item=>item.id===identifier)
          if(!line?.tangents?.[Number(index)])return
          line.tangents[Number(index)]=line.tangents[Number(index)].map((n,i)=>n+local[i])
        }else{
          polygon=editPatternBezierHandle(d.panel.polygon,identifier,Number(index),local,
            {breakTangents:e.altKey,snapAngle:e.shiftKey})
          if(!polygon)return
        }
        edit({kind: 'Shape', panel: d.panel.id, polygon})
      } else {
        const origin = d.panel.polygon?.points?.[d.anchor]
        if (origin) edit({kind: 'Anchor', panel: d.panel.id, anchor: d.anchor, position: origin.map((n, i) => n + local[i])})
      }
    } else {
      const p=updatePreview(e,d)
      edit({kind: 'BoardTransform', panel: d.panel.id,
        origin: range.layout.map((n, i) => n + (p?.delta?.[i] ?? delta[i])),
        rotation_degrees: d.panel.layout_rotation_degrees || 0})
    }
  }
  const zoom = e => {
    e.preventDefault()
    const localCursor = point(e)
    if (!localCursor) return
    const cursor = [localCursor[0]+offset[0],localCursor[1]+offset[1]]
    const factor = e.deltaY > 0 ? 1.1 : .9
    setView(v => {
      const width = Math.max(.08, Math.min(15, v[2] * factor))
      const scale = width / v[2]
      return [cursor[0] - (cursor[0] - v[0]) * scale, cursor[1] - (cursor[1] - v[1]) * scale, width, v[3] * scale]
    })
  }
  const isDrawing = mode === 'pen' || mode === 'line'
  const invalidInternal = reason => window.dispatchEvent(new CustomEvent('exo-clothcraft-invalid-internal-polygon', {detail:{reason}}))
  // SVG paints later panels above earlier ones. Resolve overlapping hit regions
  // in the same order so the visible, topmost pattern receives canvas tools.
  const panelAt = p => panels.findLast(({panel,range}) => {
    const triangles = (s?.triangles || []).slice(...range.triangles)
    for(const triangle of triangles)
      if(Array.isArray(triangle)&&triangle.length===3&&insideTriangle(p,...triangle.map(index=>boardUV[index])))return true
    return false
  })?.panel.id || null
  const finishDrawing = () => {
    if(mode==='line') {
      if(!drawingPanel.current || draft.some(p=>panelAt(p)!==drawingPanel.current)) {
        invalidInternal('An internal line must stay entirely inside one existing pattern.')
        return
      }
      // A concave pattern may contain both endpoints while the segment passes outside.
      for(let i=1;i<draft.length;i++)for(let k=1;k<16;k++) {
        const t=k/16, p=[draft[i-1][0]*(1-t)+draft[i][0]*t,draft[i-1][1]*(1-t)+draft[i][1]*t]
        if(panelAt(p)!==drawingPanel.current){invalidInternal('The internal line crosses outside the pattern boundary.');return}
      }
    }
    onPolygon(draft,tool2d==='vector-pen'?draft.map((_,i)=>vectorTangents[i]||[0,0]):undefined)
    setDraft([])
    setVectorTangents([])
    setPencilSamples([])
    drawingPanel.current=null
  }
  useEffect(()=>{
    if(!isDrawing)return
    const onKey=event=>{
      if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return
      // Uncommitted vertices are the latest drawing actions. Rewind those
      // before touching the Rust document's committed edit history.
      if(draft.length&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='z'){
        event.preventDefault();event.stopImmediatePropagation()
        setDraft(points=>points.slice(0,-1))
        setVectorTangents(points=>points.slice(0,-1))
        if(draft.length===1)drawingPanel.current=null
        return
      }
      if(event.key==='Escape'&&draft.length){event.preventDefault();event.stopImmediatePropagation();setDraft([]);setVectorTangents([]);setPencilSamples([]);drawingPanel.current=null}
      if(event.key==='Enter'&&draft.length>=(mode==='line'?2:3)&&!busy){event.preventDefault();finishDrawing()}
    }
    window.addEventListener('keydown',onKey,true)
    return()=>window.removeEventListener('keydown',onKey,true)
  },[isDrawing,mode,tool2d,draft,vectorTangents,busy,onPolygon,panels,boardUV])
  const measuring = mode === 'edit' && ['measure','measure-edit'].includes(tool2d)
  const editingTape = measuring && tool2d === 'measure-edit'
  const nativeCursor = busy ? 'default' : sewingActive || editSewingActive ? SEWING_CURSOR :
    mode === 'pen' ? cursorForTool('polygon') :
    mode === 'line' ? cursorForTool('internal') :
    mode === 'edit' && tool2d === 'pleat' ? PLEAT_CURSOR :
    mode === 'edit' && tool2d !== 'select' && tool2d !== 'seam-edit' ? cursorForTool(tool2d) : null
  const splitBoundary = (e,panel,edge,indices) => {
    if(busy || mode!=='edit' || tool2d!=='split')return false
    const p=point(e);if(!p)return true
    let total=0,best=Infinity,at=0
    for(let k=1;k<indices.length;k++){
      const a=boardUV[indices[k-1]],b=boardUV[indices[k]]
      if(!a||!b)continue
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)
      if(!length)continue
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length)))
      const distance=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
      if(distance<best){best=distance;at=total+t*length}total+=length
    }
    if(total>0.0002){
      pick({panel:panel.id,edge})
      void edit({kind:'SplitBoundary',panel:panel.id,edge,at_m:Math.max(.0001,Math.min(total-.0001,at))})
    }
    return true
  }
  // The same sampled material-space boundary used by the Rust compiled mesh
  // determines the notch's fractional arclength, irrespective of 2D zoom.
  // The native authoring layer validates all dimensions and records history.
  const editConstructionEdge = (e,panel,edge,indices) => {
    if(busy||mode!=='edit'||!['notch','allowance'].includes(tool2d))return false
    if(tool2d==='allowance'){
      void edit({kind:'SeamAllowance',panel:panel.id,edge,width_m:e.altKey?0:allowanceWidthMm/1000})
      pick({panel:panel.id,edge})
      return true
    }
    const p=point(e)
    if(!p)return true
    let total=0,best=Infinity,at=0
    for(let k=1;k<indices.length;k++){
      const a=boardUV[indices[k-1]],b=boardUV[indices[k]]
      if(!a||!b)continue
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)
      if(length<1e-9)continue
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length)))
      const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
      if(d<best){best=d;at=total+t*length}
      total+=length
    }
    if(total>.002){
      const t=Math.max(.002,Math.min(.998,at/total))
      if(e.altKey){
        // Removal addresses the original saved fractional arclength exactly.
        // Never pass a fresh imprecise click fraction to Rust's strict match.
        const nearest=(panel.polygon?.notches?.[edge]||[]).reduce((closest,item)=>
          !closest||Math.abs(item.t-t)<Math.abs(closest.t-t)?item:closest,null)
        if(nearest&&Math.abs(nearest.t-t)<.05)
          void edit({kind:'RemoveNotch',panel:panel.id,edge,t:nearest.t})
      }else if(e.shiftKey){
        // Double armhole match marks remain two persisted Rust EdgeNotches.
        // Their spacing is six physical millimetres along the source curve,
        // rather than a screen-pixel offset that drifts with zoom.
        const halfGap=Math.min(.02,.003/total)
        const t1=Math.max(.002,t-halfGap),t2=Math.min(.998,t+halfGap)
        if(t2-t1>.001){
          void (async()=>{
            const created=await edit({kind:'Notch',panel:panel.id,edge,t:t1,depth_m:.006})
            if(created)await edit({kind:'Notch',panel:panel.id,edge,t:t2,depth_m:.006})
          })()
        }
      }else void edit({kind:'Notch',panel:panel.id,edge,t,depth_m:.006})
      pick({panel:panel.id,edge})
    }
    return true
  }
  const boundaryMark = (indices,t) => {
    const path=indices.map(i=>boardUV[i]).filter(Boolean)
    const segments=path.slice(1).map((to,i)=>({a:path[i],b:to,d:Math.hypot(to[0]-path[i][0],to[1]-path[i][1])}))
    const total=segments.reduce((sum,s)=>sum+s.d,0)
    let at=Math.max(0,Math.min(1,t))*total
    for(const segment of segments){
      if(at<=segment.d||segment===segments.at(-1)){
        if(segment.d<1e-10)return null
        const dx=(segment.b[0]-segment.a[0])/segment.d,dy=(segment.b[1]-segment.a[1])/segment.d
        return {p:[segment.a[0]+dx*at,segment.a[1]+dy*at],normal:[dy,-dx]}
      }
      at-=segment.d
    }
    return null
  }
  const closestPomStation = p => {
    let best=null
    for(const {panel,range} of panels){
      for(const [edge,indices] of Object.entries(range.boundaries||{})){
        const path=indices.map(i=>boardUV[i]).filter(Boolean)
        const total=path.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b[0]-path[i][0],b[1]-path[i][1]),0)
        let travelled=0
        for(let i=1;i<path.length;i++){
          const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)
          if(length<1e-9)continue
          const u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length)))
          const location=[a[0]+u*dx,a[1]+u*dy],distance=Math.hypot(p[0]-location[0],p[1]-location[1])
          if(!best||distance<best.distance)best={panel:panel.id,edge,t:(travelled+u*length)/total,p:location,distance}
          travelled+=length
        }
      }
    }
    // Hit radius is visual, not a fixed 35 mm material distance: at high
    // zoom a distant cutline should never silently capture a POM station.
    const matrix=svg.current?.getScreenCTM()
    const pixelsPerMetre=matrix?Math.hypot(matrix.a,matrix.b):0
    const tolerance=pixelsPerMetre>1e-9?Math.min(.035,12/pixelsPerMetre):.012
    return best?.distance<=tolerance?best:null
  }
  const markCanvas = e => {
    if (busy || e.button !== 0 || (!isDrawing && !measuring)) return
    // An existing tape endpoint is edited by dragging its real material-space
    // location. Do not accidentally start a new tape on the capture phase.
    if(editingTape)return
    const p = point(e)
    if (!p) return
    if(measuring && !editingTape){
      e.stopPropagation();e.preventDefault()
      const station=closestPomStation(p)
      if(!station){setPomStart(null);setTape([]);return}
      if(!pomStart){setPomStart(station);setTape([station.p]);return}
      if(pomStart.panel!==station.panel){setPomStart(station);setTape([station.p]);return}
      const id=`pom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`
      const panel=s.template?.panels?.find(item=>item.id===station.panel)
      const label=`POM ${(panel?.polygon?.measurements?.length||0)+1}`
      setTape([pomStart.p,station.p]);setPomStart(null)
      void (async()=>{
        const created=await edit({kind:'SetMeasurement',panel:station.panel,measurement:{
          id,label,a:{edge:pomStart.edge,t:pomStart.t},b:{edge:station.edge,t:station.t},
        }})
        if(created){setSelectedPom({panel:station.panel,id});setPomLabelDraft(label)}
        else setTape([])
      })()
      return
    }
    if(mode==='line') {
      const hit=panelAt(p)
      if(!hit){invalidInternal('Click inside an existing 2D pattern to draw an internal line.');e.stopPropagation();e.preventDefault();return}
      if(drawingPanel.current && drawingPanel.current!==hit){invalidInternal('Continue drawing inside the same pattern. Press Escape to start another line.');e.stopPropagation();e.preventDefault();return}
      if(!drawingPanel.current){drawingPanel.current=hit;pick({panel:hit})}
    }
    // Capture before fabric/edge handlers consume the pointer event. Internal
    // lines must be drawable directly on the selected fabric surface.
    e.stopPropagation()
    e.preventDefault()
    if (tool2d==='vector-pencil') {
      vectorDrag.current={start:p,pointerId:e.pointerId,pencil:true}
      setPencilSamples([p])
      svg.current.setPointerCapture(e.pointerId)
      return
    }
    if(isDrawing){
      if(tool2d==='vector-pen'&&draft.length>=3&&Math.hypot(p[0]-draft[0][0],p[1]-draft[0][1])<.014){
        finishDrawing()
        return
      }
      setDraft(old=>[...old,p])
      if(tool2d==='vector-pen'){
        setVectorTangents(old=>[...old,[0,0]])
        vectorDrag.current={start:p,index:draft.length,pointerId:e.pointerId}
        svg.current.setPointerCapture(e.pointerId)
      }
    }
    else setTape(old => old.length === 1 ? [old[0],p] : [p])
  }
  return <div className="cc-board" aria-busy={busy} data-document-revision={s.revision} data-segment-sewing={String(segmentSewing)} data-free-sewing={String(freeSewing)}
    data-edit-sewing={String(editSewingActive)}
    data-segment-sew-stage={sewingCommitting?'saving':sewingFirstEdge?'second':'first'}
    data-free-sew-stage={sewingCommitting?'saving':String(freeSewPoints.length)}
    data-free-sew-points-count={freeSewPoints.length}
    data-2d-editor-mode={mode}
    data-reference-guides-visible={String(showReferenceGuides)}
    data-internal-lines-visible={String(showInternalLines)}
    data-native-notches-visible={String(showNativeNotches)}
    data-seam-allowances-visible={String(showNativeAllowances)}
    style={{position: 'relative', background: '#c6c7c9'}}>
    <ClothCraftCornerTools dimension="2d" mode={mode} activeTool={tool2d} onChangeMode={onChangeMode}
      displayLayers={displayLayers} onToggleDisplayLayer={toggleDisplayLayer}
      allowanceWidthMm={allowanceWidthMm} onChangeAllowanceWidth={width=>{
        if(Number.isFinite(width)&&width>=.1&&width<=500)setAllowanceWidthMm(width)
      }}
      selectedGuide={selectedGuide} onCreateGuideLine={()=>{void createNativeLineFromGuide(selectedGuide);setSelectedGuide(null)}}
      onRemoveGuideLine={()=>{if(selectedGuide?.nativeLineId)void edit({kind:'RemoveLine',panel:selectedGuide.panelId,line:selectedGuide.nativeLineId});setSelectedGuide(null)}}
      onClearGuide={()=>setSelectedGuide(null)}
      onChangeTool={name => {setTool2d(name);setDraft([]);drawingPanel.current=null;setTape([])}} disabled={busy}/>
    <PatternReferenceImageControls {...reference} unitsPerCm={.01} viewBounds={view} menuOnly editorScope="native"/>
    {mode==='edit'&&tool2d==='curve'&&<div className="cc-native-free-curve-guide" data-free-curve-tool-guide="true">
      <strong>Edit Curve Point</strong>
      <span>Click a cutline to add · Drag orange knots · Drag purple incoming/outgoing handles · Option-drag a handle to break tangents · Shift snaps angles · Option-click orange to remove</span>
      <label><input type="checkbox" checked={mirrorFreeCurve}
        onChange={event=>{setMirrorFreeCurve(event.target.checked);setFreeCurveStatus('')}}/>
        Link mirrored points on symmetric edges</label>
      {freeCurveStatus&&<small role="status">{freeCurveStatus}</small>}
    </div>}
    {mode==='edit'&&tool2d==='split'&&<div className="cc-native-free-curve-guide" data-mirrored-split-guide="true">
      <strong>Add / Split Point</strong>
      <span>Click a linked orange knot to split both mirrored boundaries together.</span>
      {freeCurveStatus&&<small role="status">{freeCurveStatus}</small>}
    </div>}
    {selectedSewingMeasurement?.valid&&<div className="cc-native-sew-pair-readout"
      data-native-selected-sewing-length={selectedSewingMeasurement.seamId} role="status">
      <strong>{selectedSewingMeasurement.seamId}</strong>
      <span>{selectedSewingMeasurement.firstCm.toFixed(2)} / {selectedSewingMeasurement.secondCm.toFixed(2)} cm</span>
      <span>{selectedSewingMeasurement.signedDifferenceCm>=0?'+':''}{selectedSewingMeasurement.signedDifferenceCm.toFixed(2)} cm · {selectedSewingMeasurement.differencePercent.toFixed(1)}%</span>
    </div>}
    {measuring&&<section className="cc-native-pom-inspector" aria-label="Native Points of Measure" data-native-pom-editor="true">
      <strong>POINTS OF MEASURE <small>{pomRows.length}</small></strong>
      <p>Click two cutline positions to save a physical measurement. Select one below to edit or delete it.</p>
      <div className="cc-native-pom-rows" role="group" aria-label="Saved native Points of Measure">
        {pomRows.length===0?<span>No saved POMs yet</span>:pomRows.map(({panelId,measurement})=>
          <button type="button" key={panelId+':'+measurement.id}
            data-native-pom-select={measurement.id}
            aria-pressed={selectedPom?.panel===panelId&&selectedPom?.id===measurement.id}
            onClick={()=>{setSelectedPom({panel:panelId,id:measurement.id});setPomLabelDraft(measurement.label)}}>
            {measurement.label} <small>{panelId}</small>
          </button>)}
      </div>
      {selectedPomRow&&<div className="cc-native-pom-edit">
        <label>Measurement name
          <input aria-label="Edit native POM label" type="text" maxLength={120}
            value={pomLabelDraft} onChange={e=>setPomLabelDraft(e.target.value)} disabled={busy}/>
        </label>
        <div>
          <button type="button" data-native-pom-save-label="true" disabled={busy||!pomLabelDraft.trim()}
            onClick={()=>void edit({kind:'SetMeasurement',panel:selectedPomRow.panelId,
              measurement:{...selectedPomRow.measurement,label:pomLabelDraft.trim()}})}>Save name</button>
          <button type="button" data-native-pom-delete="true" disabled={busy}
            onClick={()=>void (async()=>{
              const removed=await edit({kind:'RemoveMeasurement',panel:selectedPomRow.panelId,
                id:selectedPomRow.measurement.id})
              if(removed){setSelectedPom(null);setPomLabelDraft('');setTape([])}
            })()}>Delete POM</button>
        </div>
      </div>}
    </section>}
    {/* Selection metadata lives in the 2D Pattern Display tool menu, never
        in a panel-covering popup over the working pattern. */}
    <div className="cc-v2-orientation cc-v2-board-orientation" role="group" aria-label="2D board view controls">
      <strong title="Metric 2D drawing orientation">2D</strong>
      <button type="button" aria-label="Front" title="Front drafting view" aria-pressed={viewPreset==='FRONT'} className={viewPreset==='FRONT'?'active':''} onClick={()=>setViewPreset('FRONT')}>FR</button>
      <button type="button" aria-label="Grid" title="Neutral grid drafting view" aria-pressed={viewPreset==='GRID'} className={viewPreset==='GRID'?'active':''} onClick={()=>setViewPreset('GRID')}>GR</button>
      <span className="cc-board-orientation-divider" aria-hidden="true"/>
      <button type="button" aria-label="Frame all" title="Frame all patterns and full avatar" onClick={() => focus()}>F</button>
      <button type="button" aria-label="Focus selected" title="Focus selected pattern" onClick={() => focus(true)}>S</button>
      <button type="button" aria-label="Center axis" title="Center on the 2D front axis" onClick={() => setView(v=>[-v[2]/2,avatarAnchorY-v[3]/2,v[2],v[3]])}>C</button>
    </div>
    {showGraphicMeasurementToggle&&graphics.some(graphic=>graphic.visible!==false)&&<div className="cc-v2-graphic-dimension-toggle"
      style={{position:'absolute',zIndex:12,top:85,right:10}}>
      <button type="button" aria-label="Show graphic measurement box" aria-pressed={showGraphicMeasurements}
        title="Toggle selected graphic dimensions in millimetres"
        onClick={()=>onToggleGraphicMeasurements(!showGraphicMeasurements)}
        style={{fontSize:10,border:'1px solid #7c8c95',borderRadius:3,padding:'5px 8px',
          color:showGraphicMeasurements?'#e0f5ff':'#dadfe2',
          background:showGraphicMeasurements?'#2c7397':'#42484d',cursor:'pointer'}}>
        Graphic measurements {showGraphicMeasurements?'ON':'OFF'}
      </button>
    </div>}
    <svg ref={svg} viewBox={view.join(' ')} preserveAspectRatio="xMidYMid meet"
      style={{background: '#c6c7c9',cursor:nativeCursor||undefined}}
      aria-label="Metric 2D pattern board with linked sewing and measurements" data-native-tool={tool2d}
      onPointerDownCapture={markCanvas}
      onPointerMoveCapture={event=>setHoveredGuideId(findGuideUnderPointer(event)?.id||null)}
      onPointerLeave={()=>setHoveredGuideId(null)}
      onClickCapture={e=>{
        if(selectGuideUnderPointer(e))return
        if(busy||tool2d!=='pleat'||mode!=='edit')return
        const p=point(e),panelId=p&&panelAt(p)
        e.stopPropagation();e.preventDefault()
        if(panelId){pick({panel:panelId});window.dispatchEvent(new CustomEvent('exo-clothcraft-pleat-target',{detail:{panelId}}))}
      }}
      onDoubleClickCapture={e=>{
        const guide=findGuideUnderPointer(e)
        if(guide){e.stopPropagation();void createNativeLineFromGuide(guide);setSelectedGuide(null)}
      }}
      onClick={e => {if (!busy && (isDrawing || measuring)) e.stopPropagation()}}
      onPointerMove={e=>{
        if(moveFoamDrag(e))return
        if(vectorDrag.current?.pointerId===e.pointerId){
          const drag=vectorDrag.current,p=point(e)
          if(p){
            if(drag.pencil)setPencilSamples(old=>old.length&&Math.hypot(p[0]-old.at(-1)[0],p[1]-old.at(-1)[1])<.001?old:[...old,p])
            else if(tool2d==='vector-pen'){
              const delta=[p[0]-drag.start[0],p[1]-drag.start[1]]
              const tangent=e.shiftKey?(()=>{const radius=Math.hypot(...delta),angle=Math.round(Math.atan2(delta[1],delta[0])/(Math.PI/4))*Math.PI/4;return [radius*Math.cos(angle),radius*Math.sin(angle)]})():delta
              setVectorTangents(old=>old.map((v,i)=>i===drag.index&&Math.hypot(...delta)>.002?tangent:v))
            }
          }
          return
        }
        if(drag.current?.anchor?.startsWith?.('ft:')){
          move(e)
          return
        }
        if(moveGraphicDrag(e))return
        if(tapeDrag.current){const p=point(e);if(p)setTape(old=>old.map((v,i)=>i===tapeDrag.current.index?p:v));return}
        move(e)
      }} onPointerUp={e=>{
        if(endFoamDrag(e))return
        if(vectorDrag.current?.pointerId===e.pointerId){
          const drag=vectorDrag.current
          vectorDrag.current=null
          if(drag.pencil){
            // Pencil fitting is applied on release; the source sample stream
            // stays temporary and does not pollute the garment's native data.
            const p=point(e),raw=p?[...pencilSamples,p]:pencilSamples
            const toleranceM=Math.max(.0005,view[2]/1000)
            const closed=raw.length>=4&&Math.hypot(raw[0][0]-raw.at(-1)[0],raw[0][1]-raw.at(-1)[1])<=Math.max(.008,view[2]/180)
            const fitted=fitPencilStroke(raw.map(([x,y])=>({x,y})),{toleranceM,closed})
            if(fitted.length>=3){
              const points=fitted.map(p=>[p.x,p.y])
              const controls=pathCubicControls(fitted)
              const tangents=points.map((p,i)=>{
                const next=controls[i]?.c1,previous=controls[i-1]?.c2
                if(next&&previous)return [(next.x-p[0]+p[0]-previous.x)/2,(next.y-p[1]+p[1]-previous.y)/2]
                if(next)return [next.x-p[0],next.y-p[1]]
                if(previous)return [p[0]-previous.x,p[1]-previous.y]
                return [0,0]
              })
              onPolygon(points,tangents)
            }
            setPencilSamples([])
          }
          try{svg.current?.releasePointerCapture(e.pointerId)}catch{}
          return
        }
        if(endGraphicDrag(e)){try{svg.current?.releasePointerCapture(e.pointerId)}catch{};return}
        if(tapeDrag.current){tapeDrag.current=null;try{svg.current?.releasePointerCapture(e.pointerId)}catch{};return}
        up(e)
      }} onPointerCancel={() => {foamDrag.current=null;setFoamPreview(null);vectorDrag.current=null;setPencilSamples([]);graphicDrag.current=null;setGraphicPreview(null);tapeDrag.current=null;drag.current = null;setPreview(null);setHandlePreview(null)}}
      onContextMenu={e => {
        e.preventDefault()
        const element = e.target.closest?.('[data-edit-seam-guide], [data-edge], [data-panel]')
        const seamId=element?.getAttribute('data-edit-seam-guide')
        const edgeKey=element?.getAttribute('data-edge')
        const panelId=element?.getAttribute('data-panel')
        const [edgePanel, ...edgeParts] = edgeKey ? edgeKey.split(':') : []
        // An annotation, image, or sewing overlay can cover the fill path.
        // Resolve the native pattern beneath the pointer using the same
        // triangle hit test as the drawing tools before offering Delete.
        const canvasPoint=point(e)
        const geometricPanel=canvasPoint?panelAt(canvasPoint):null
        const hit=seamId?{seamId}:edgeKey ? {panel:edgePanel,edge:edgeParts.join(':')} : panelId ? {panel:panelId} : geometricPanel ? {panel:geometricPanel} : null
        onContextMenuRequest({x:e.clientX,y:e.clientY,dimension:'2d',hit,hasBackgroundImage:Boolean(reference.image)})
      }}
      onPointerDown={e => {
        if (isDrawing || measuring) return
        if (e.button !== 0) return
        const p = point(e)
        if (!p) return
        drag.current = {pan: true, background: e.target===svg.current, start: p}
        svg.current.setPointerCapture(e.pointerId)
      }}
      onWheel={zoom}>
      <defs>
        <pattern id={`${uid}-minor`} width={gridMinorStep} height={gridMinorStep} patternUnits="userSpaceOnUse">
          <path d={`M ${gridMinorStep} 0 L 0 0 0 ${gridMinorStep}`} fill="none"
            stroke="rgba(72,76,81,.19)" strokeWidth=".0018"/>
        </pattern>
        <pattern id={`${uid}-major`} width={gridMajorStep} height={gridMajorStep} patternUnits="userSpaceOnUse">
          <path d={`M ${gridMajorStep} 0 L 0 0 0 ${gridMajorStep}`} fill="none"
            stroke="rgba(70,74,79,.25)" strokeWidth=".0026"/>
        </pattern>
      </defs>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill="#c6c7c9" pointerEvents="none"/>
      {showGrid&&<rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-minor)`} opacity={viewPreset==='GRID'?1:.6} pointerEvents="none"/>}
      {showGrid&&<rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-major)`} opacity={viewPreset==='GRID'?1:.65} pointerEvents="none"/>}
      <PatternReferenceImageLayer image={reference.image} setImage={reference.setImage} unitsPerCm={.01}
        interactive={!busy && tool2d === 'select' && mode === 'edit'}/>
      <line x1={view[0]-view[2]} x2={view[0]+view[2]*2} y1=".76" y2=".76" stroke="#9aaeb3" strokeWidth=".002" pointerEvents="none"/>
      <line x1="0" x2="0" y1={view[1]-view[3]} y2={view[1]+view[3]*2} stroke="#424b4f" strokeWidth=".006" pointerEvents="none"/>
      <g pointerEvents="none" fontSize=".022" fill="#6c8188">
        <text x=".02" y=".745">X</text><text x=".015" y=".805">Y</text>
      </g>
      {avatarVisible && s?.avatar?.triangles?.length > 0 && <g opacity=".66" transform={`translate(${avatarAnchorX} ${avatarAnchorY})`} aria-label="Centered front avatar silhouette"
        data-registered-shoulder-y={originalAlignment.current?.shoulderY} data-avatar-anchor-x={avatarAnchorX} data-avatar-anchor-y={avatarAnchorY}>
        <ClothCraftStudioSilhouette avatar={s.avatar}
          onPick={!busy&&!['pen','line','sew'].includes(mode)?onAvatarPick:undefined}/>
      </g>}
      <g transform={`translate(${offset[0]} ${offset[1]})`}>
      {panels.map(({panel, range, color, points}, panelIndex) => {
        const selected = selection !== undefined ? selection?.panel === panel.id : active?.panel === panel.id
        const currentPreview=preview?.panelId===panel.id ? preview : null
        const livePoints=points.map(p=>previewPoint(p,currentPreview))
        const shapePath=trianglePath((s.triangles || []).slice(...range.triangles),boardUV)
        const clipId=`${uid}-pattern-${panelIndex}`
        const label=previewPoint(range.layout,currentPreview)
        return <g key={panel.id} data-2d-pattern-piece={panel.id} data-2d-pattern-selected={String(selected)}
          onPointerEnter={() => hover({panel: panel.id})} onPointerLeave={() => hover(null)}>
          <defs><clipPath id={clipId}><path d={shapePath}/></clipPath></defs>
          {/* CLO drafting paper: a soft selected surface and an opaque white
              unselected surface, independent of physical fabric tint. */}
          <path data-panel={panel.id} data-pattern-surface="drafting-paper" d={shapePath}
            fill={selected?PATTERN_VISUAL.selectedPaper:PATTERN_VISUAL.paper}
            fillOpacity={reference.image?.visible===false||!reference.image?1:.26}
            style={{cursor:busy?'default':nativeCursor||(transform2d?cursorForTool('move'):'default')}}
            onPointerDown={e => {if (tool2d === 'annotation'||editSewingActive) e.stopPropagation(); else start(e, panel)}}
            onClick={e => {if(editSewingActive){e.stopPropagation();return}if (!createAnnotation(e,panel,range)) {e.stopPropagation(); pick({panel: panel.id})}}}/>
          {foamPads.filter(pad=>pad.panel===panel.id&&pad.points?.length>=3).map(pad=>{
            const shift=foamPreview?.id===pad.id?foamPreview:pad
            const moved={...pad,x:shift.x,y:shift.y}
            const points=shapePoints(moved).map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
            if(points.length<3)return null
            return <g key={pad.id} data-native-foam-outline={pad.id} data-foam-locked={String(Boolean(pad.locked))}>
              <polygon points={points.map(p=>p.join(',')).join(' ')} fill="#94d9ef" fillOpacity=".2" stroke="#176d83" strokeWidth=".0035" strokeDasharray=".009 .005" strokeLinejoin="round"
                style={{cursor:pad.locked?'not-allowed':'move'}} pointerEvents="all" onPointerDown={event=>beginFoamDrag(event,pad)} onClick={event=>{event.stopPropagation();pick({panel:panel.id})}}/>
              <text x={points[0][0]} y={points[0][1]-.012} fontSize=".016" fill="#176d83" pointerEvents="none">{pad.name||'Foam'} · {pad.locked?'LOCKED':'DRAG'}</text>
            </g>
          })}
          {/* Printing registration uses native rest-material metres, exactly
              matching the Rust physical dimensions and curved 3D decal. */}
          {graphics.filter(g=>g.panel===panel.id&&g.visible!==false).map(g=>{
            const uv=s.uv.slice(...range.vertices)
            if(!uv.length)return null
            const x=uv.map(p=>p[0]),y=uv.map(p=>p[1])
            const minX=Math.min(...x),maxX=Math.max(...x),maxY=Math.max(...y)
            const w=Number(g.widthMm)/1000,h=Number(g.heightMm)/1000
            if(!(w>0&&h>0&&Number.isFinite(w)&&Number.isFinite(h)))return null
            // Rust positionMm is the print's top-left material-space offset.
            // Convert to the image center only when building the SVG transform.
            const [mx,my]=graphicPreview?.id===g.id?graphicPreview.positionMm:
              g.positionMm||[(.5*(maxX-minX)-w/2)*1000,(.5*(maxY-Math.min(...y))-h/2)*1000]
            const center=previewPoint(transform(panel,range,[minX+mx/1000+w/2,maxY-my/1000-h/2]),currentPreview)
            const rotation=(panel.layout_rotation_degrees||0)+(g.rotation||0)
            const topLeft=[center[0]-w/2,center[1]-h/2]
            const selectable=tool2d==='select'&&!busy
            const selectedGraphic=g.id===selectedGraphicId
            return <g key={g.id} data-2d-graphic-item={g.id} data-graphic-selected={String(selectedGraphic)}>
              <g transform={`rotate(${rotation} ${center[0]} ${center[1]})`}>
                <image data-2d-graphic={g.id}
                  href={g.displayedMap==='normal'&&g.normalMapDataUrl?g.normalMapDataUrl:g.dataUrl}
                  x={topLeft[0]} y={topLeft[1]} width={w} height={h}
                  preserveAspectRatio="none" opacity={g.opacity??1}
                  clipPath={`url(#${clipId})`}
                  pointerEvents="none"/>
                {/* SVG image hit testing varies across browser/clip-path
                    combinations. A transparent rect is the reliable drag hit
                    surface; it covers precisely the printed image bounds. */}
                <rect data-2d-graphic-hit={g.id}
                  x={topLeft[0]} y={topLeft[1]} width={w} height={h}
                  fill="transparent" pointerEvents={selectable?'all':'none'}
                  style={{cursor:selectable?'move':'default'}}
                  onPointerDown={event=>startGraphicDrag(event,g,panel)}
                  onClick={event=>{if(!selectable)return;event.stopPropagation();onSelectGraphic(g.id)}}/>
                {selectedGraphic&&<GraphicMeasurementBox id={g.id} x={topLeft[0]} y={topLeft[1]}
                  width={w} height={h} enabled={showGraphicMeasurements} viewWidth={view[2]}/>}
              </g>
            </g>
          })}
          {(panel.polygon?.annotations || []).map(note => {
            const [x,y]=transform(panel,range,note.position)
            const [tx,ty]=previewPoint([x,y],currentPreview)
            return <g key={note.id} data-pattern-annotation={`${panel.id}:${note.id}`}
              onPointerDown={e=>e.stopPropagation()}
              onClick={e=>{
                e.stopPropagation()
                if(busy)return
                pick({panel:panel.id})
                if(e.altKey){void edit({kind:'RemoveAnnotation',panel:panel.id,id:note.id});return}
                if(tool2d!=='editAnnotation'&&tool2d!=='annotation')return
                const text=window.prompt('Edit annotation (Alt-click to delete)',note.text)
                if(text!==null&&text.trim())void edit({kind:'Annotation',panel:panel.id,id:note.id,text:text.trim(),position:note.position})
              }} style={{cursor:tool2d==='annotation'||tool2d==='editAnnotation'?'text':'pointer'}}>
              <rect x={tx-.009} y={ty-.026} width={Math.max(.06,note.text.length*.009)} height=".038" rx=".005" fill="#fffaf0" stroke="#916e3f" strokeWidth=".0015"/>
              <text x={tx} y={ty} fontSize=".018" fill="#5c4023" pointerEvents="none">{note.text}</text>
            </g>
          })}
          {selected && transform2d && <SelectionMarquee2D
            points={livePoints} panel={panel} onStart={start} disabled={busy}/>}
          {Object.entries(range.boundaries || {}).map(([edge, indices]) => {
            const linkedSeams=(s?.template?.seams||[]).filter(seam=>[seam.a,seam.b].some(side=>side?.panel===panel.id&&side.edge===edge))
            const editingSeam=editSewingActive&&linkedSeams.length>0
            const selectedSeamEdge=editSewingActive&&linkedSeams.some(seam=>seam.id===selection?.seamId)
            const paths=boundarySegments(indices,boardUV).map(points=>points.map(p=>p.join(',')).join(' '))
            const selectedEdge=selected && active?.edge === edge
            const firstSewEdge=segmentSewing&&sewingFirstEdge?.panel===panel.id&&sewingFirstEdge?.edge===edge
            const hoverSewEdge=sewingActive&&active?.panel===panel.id&&active?.edge===edge
            const edgeClick=e => {
              e.stopPropagation()
              if(editSewingActive){
                if(busy||sewingCommitting)return
                if(linkedSeams.length){
                  const activeIndex=linkedSeams.findIndex(item=>item.id===selection?.seamId)
                  const seam=linkedSeams[(activeIndex+1)%linkedSeams.length]
                  onSelectSewingSeam(seam.id)
                }
                return
              }
              if(segmentSewing){onSegmentSewEdge({panel:panel.id,edge});return}
              if(freeSewing){
                if(busy||sewingCommitting)return
                const candidate=projectFreeSewingPoint(indices,boardUV,point(e))
                if(candidate)onFreeSewPoint({panel:panel.id,edge,fraction:candidate.fraction})
                return
              }
              if(mode==='edit'&&tool2d==='curve'&&!busy){
                // CLO-style free curve points are independently persistent
                // controls, attached to the stable boundary ID. Inserting a
                // point on a straight edge preserves its original shape.
                pick({panel:panel.id,edge})
                const xy=point(e)
                if(!xy||!panel.polygon)return
                const angle=(panel.layout_rotation_degrees||0)*Math.PI/180
                const dx=xy[0]-range.layout[0],dy=xy[1]-range.layout[1]
                const local=[dx*Math.cos(angle)+dy*Math.sin(angle),-dx*Math.sin(angle)+dy*Math.cos(angle)]
                const nearest=closestFreeCurveParameter(panel.polygon,edge,local)
                if(!nearest)return
                const added=addNativeFreeCurvePoint(panel.polygon,edge,nearest.t,{mirror:mirrorFreeCurve})
                if(added){
                  setFreeCurveStatus('')
                  void edit({kind:'Shape',panel:panel.id,polygon:added.polygon})
                }else setFreeCurveStatus(mirrorFreeCurve
                  ?'No matching symmetric edge here, or a curve point is too close. Turn off Mirror for an independent point.'
                  :'Choose a different position on the edge; existing points need room.')
                return
              }
              if(!editConstructionEdge(e,panel,edge,indices)&&!splitBoundary(e,panel,edge,indices))pick({panel:panel.id,edge})
            }
            return <g key={edge}>
              {paths.map((path,i)=><polyline key={i} points={path} fill="none" pointerEvents="none"
                stroke={selectedSeamEdge?PATTERN_VISUAL.activeEdge:firstSewEdge?'#1464ac':hoverSewEdge?'#03a7e7':sewingActive?'#3d9bbf':selectedEdge ? PATTERN_VISUAL.activeEdge : selected ? PATTERN_VISUAL.selectedOutline : PATTERN_VISUAL.outline}
                strokeWidth={selectedSeamEdge?2.8:firstSewEdge||hoverSewEdge?2.8:sewingActive?1.9:selectedEdge?2.8:selected?1.9:1.45}
                vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                strokeDasharray={firstSewEdge?'6 4':undefined}
                data-sew-edge-state={sewingActive?(firstSewEdge?'first':hoverSewEdge?'hover':'eligible'):undefined}/>)}
              {paths.map((path,i)=><polyline key={i} data-edge={`${panel.id}:${edge}`} data-2d-edge-hit={`${panel.id}:${edge}`}
                data-segment-sew-candidate={segmentSewing?'true':undefined} data-free-sew-candidate={freeSewing?'true':undefined}
                data-edit-sew-candidate={editSewingActive?'true':undefined}
                data-seam-link={editingSeam?linkedSeams.map(item=>item.id).join(' '):undefined}
                points={path} fill="none" stroke="transparent"
                strokeWidth={Math.max(.016,view[2]*.012)} pointerEvents="stroke"
                style={{cursor:busy?'default':(sewingActive||editSewingActive)&&!sewingCommitting?SEWING_CURSOR:nativeCursor||'pointer'}}
                onPointerDown={e => e.stopPropagation()}
                onPointerEnter={e => {e.stopPropagation();hover({panel:panel.id,edge})}}
                onPointerMove={e=>{
                  if(!freeSewing)return
                  const candidate=projectFreeSewingPoint(indices,boardUV,point(e))
                  if(candidate)setFreeHover({panel:panel.id,edge,fraction:candidate.fraction})
                }}
                onPointerLeave={e=>{e.stopPropagation();hover(null);if(freeSewing)setFreeHover(null)}}
                onClick={edgeClick}/>)}
              {selectedEdge&&!sewingActive&&(()=>{
                const readout=boundaryDisplayLength(indices,boardUV)
                if(!readout)return null
                const fontSize=view[2]*.022
                const x=readout.midpoint[0]+readout.normal[0]*view[2]*.018
                const y=readout.midpoint[1]+readout.normal[1]*view[2]*.018
                return <text data-2d-boundary-readout={`${panel.id}:${edge}`}
                  data-2d-readout-approx-cm={(readout.length*100).toFixed(3)}
                  x={x} y={y} textAnchor="middle" fontSize={fontSize}
                  fill="#744514" stroke="#fffbed" strokeWidth={fontSize*.29}
                  paintOrder="stroke" fontWeight="600" pointerEvents="none">
                  ≈ {(readout.length*100).toFixed(2)} cm
                </text>
              })()}
              {freeSewing&&(()=>{
                const onEdge=freeSewPoints.filter(marker=>marker.panel===panel.id&&marker.edge===edge)
                const ranges=[]
                for(const start of [0,2]){
                  const a=freeSewPoints[start],b=freeSewPoints[start+1]
                  if(a?.panel!==panel.id||a?.edge!==edge)continue
                  const end=b?.panel===panel.id&&b?.edge===edge?b:
                    freeSewPoints.length===start+1&&freeHover?.panel===panel.id&&freeHover.edge===edge?freeHover:null
                  if(end)ranges.push({start:a.fraction,end:end.fraction,confirmed:!!b})
                }
                if(!onEdge.length&&!ranges.length)return null
                return <g data-free-sew-selection={`${panel.id}:${edge}`} pointerEvents="none">
                  {ranges.map((selection,i)=>{
                    const points=freeSewingRangePoints(indices,boardUV,selection.start,selection.end)
                    return points.length>=2&&<polyline key={i}
                      data-free-sew-selected-range={selection.confirmed?'confirmed':'preview'}
                      data-range-start={Math.min(selection.start,selection.end).toFixed(5)}
                      data-range-end={Math.max(selection.start,selection.end).toFixed(5)}
                      points={points.map(p=>p.join(',')).join(' ')}
                      stroke={selection.confirmed?'#1579bd':'#1fbeed'} strokeWidth="4"
                      vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none"
                      strokeDasharray={selection.confirmed?undefined:'6 4'}/>
                  })}
                  {onEdge.map((marker,i)=>{
                    const p=freeSewingPointAtFraction(indices,boardUV,marker.fraction)
                    return p&&<circle key={i} data-free-sew-marker={String(freeSewPoints.indexOf(marker))}
                      cx={p[0]} cy={p[1]} r=".011" stroke="#fff" strokeWidth=".003"
                      fill={freeSewPoints.indexOf(marker)<2?'#1579bd':'#eb953b'}/>
                  })}
                </g>
              })()}
            </g>
          })}
          {showNativeNotches && Object.entries(panel.polygon?.notches||{}).flatMap(([edge,marks])=>{
            const indices=range.boundaries?.[edge]||[]
            return marks.map((mark,index)=>{
              const location=boundaryMark(indices,mark.t)
              if(!location)return null
              return <line key={`notch:${edge}:${index}`} data-native-notch={`${panel.id}:${edge}`}
                x1={location.p[0]} y1={location.p[1]}
                x2={location.p[0]+location.normal[0]*mark.depth_m}
                y2={location.p[1]+location.normal[1]*mark.depth_m}
                stroke="#df3842" strokeWidth=".0038" strokeLinecap="round"
                pointerEvents="none"/>
            })
          })}
          {showNativeAllowances && Object.entries(panel.polygon?.seam_allowances||{}).flatMap(([edge,width])=>{
            const indices=range.boundaries?.[edge]||[]
            const path=indices.map(i=>boardUV[i]).filter(Boolean)
            if(!Number.isFinite(width)||width<=0||path.length<2)return []
            const guide=path.map((p,i)=>{
              const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)]
              const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1
              return [p[0]+dy/length*width,p[1]-dx/length*width]
            })
            return [<polyline key={`allowance:${edge}`} data-native-allowance={`${panel.id}:${edge}`}
              points={guide.map(p=>p.join(',')).join(' ')}
              fill="none" stroke="#9ca0a7" strokeWidth=".0034" strokeDasharray=".014 .01"
              pointerEvents="none"/>]
          })}
          <text data-pattern-piece-label={panel.id} x={label[0]} y={label[1] - .028} fontSize=".016" fill={selected?'#47404a':'#697076'}
            fontWeight={selected?650:500} paintOrder="stroke" stroke="#fbfaf5" strokeWidth=".003" strokeLinejoin="round"
            opacity={selected?1:.85} pointerEvents="none">{panel.name}</text>
          {showReferenceGuides && <g data-2d-reference-layer={panel.id} opacity={selected?.82:.4}>
            <ConstructionGuides panel={panel} boundaries={range.boundaries}
            uv={boardUV} clipId={clipId} preview={currentPreview}
            showNotchReferences={showNativeNotches}
            onSelectGuide={!busy&&mode==='edit'&&tool2d==='select'?selectConstructionGuide:null}
            onCreateGuideLine={!busy&&mode==='edit'&&tool2d==='select'?createNativeLineFromGuide:null}
            selectedGuide={selectedGuide} hoveredGuideId={hoveredGuideId}/>
          </g>}
          {showInternalLines&&<NativeInternalLines panel={panel} range={range} preview={currentPreview}
            onSelectGuide={!busy&&mode==='edit'&&tool2d==='select'?selectConstructionGuide:null}
            selectedGuide={selectedGuide} hoveredGuideId={hoveredGuideId}
            curveMode={!busy&&mode==='edit'&&tool2d==='curve'}
            activeInternalLine={activeInternalLine} onSelectCurve={selectNativeCurve}
            onStartTangent={(event,source,anchor)=>start(event,source,anchor)}
            handlePreview={handlePreview}/>}
          {showMeasurements && <Dimensions points={livePoints} selected={selected}
            panel={panel} boundaries={range.boundaries} uv={boardUV} clipId={clipId} preview={currentPreview}/>}
          {/* CLO also leaves context knots visible on unselected pattern
              pieces. Show real authored corners or native boundary endpoints
              in muted grey; selected corners stay dark. These dots never
              acquire pointer events or modify editable geometry. */}
          {tool2d==='select' && (()=>{
            const corners=panel.polygon?.points?.length
              ?panel.polygon.points.map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
              :Object.values(range.boundaries||{}).flatMap(indices=>[
                boardUV[indices[0]],boardUV[indices[indices.length-1]],
              ]).filter(Boolean)
            const unique=corners.filter((p,i)=>corners.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.0005)===i)
            // Keep visible corner marks stable on screen while zooming,
            // rather than allowing them to overwhelm small pieces.
            const radius=Math.max(.003,Math.min(.012,view[2]*.0035))
            return unique.map((p,n)=><circle key={n} data-2d-visible-corner={`${panel.id}:${n}`}
              cx={p[0]} cy={p[1]} r={radius} fill={selected?'#33383b':'#94999c'}
              stroke="#f9f9f7" strokeWidth="1" vectorEffect="non-scaling-stroke"
              opacity={selected?1:.85} pointerEvents="none"/>)
          })()}
          {selected && mode === 'edit' && ['point','curve'].includes(tool2d) && panel.polygon?.points?.map((uv, n) => {
            const p = previewPoint(transform(panel, range, uv),currentPreview)
            return <circle key={n} data-control-point="vertex" data-panel-id={panel.id}
              data-promoted-vertex-id={panel.polygon?.vertex_ids?.[panel.polygon?.edges?.[n]]||undefined}
              cx={p[0]} cy={p[1]} r={Math.max(.004,Math.min(.012,view[2]*.004))}
              fill={active?.anchor===n ? POINT_COLORS.selectedVertex : POINT_COLORS.vertex}
              stroke={POINT_COLORS.outline} strokeWidth=".003" style={{cursor:nativeCursor||'pointer'}}
              title={tool2d==='curve'?'Drag pattern anchor to reshape curve · Option-click to make a sharp corner':'Drag pattern anchor'}
              onPointerDown={e => {
                if(tool2d==='curve'&&e.altKey){
                  e.stopPropagation();e.preventDefault()
                  if(!busy)void edit({kind:'CurvePoint',panel:panel.id,anchor:n,curved:false})
                  return
                }
                start(e,panel,n)
              }}/>
          })}
          {selected&&tool2d==='curve'&&handlePreview?.panelId===panel.id&&Number.isInteger(handlePreview.anchorIndex)&&
            (()=>{const polygon=handlePreview.polygon,index=handlePreview.anchorIndex
              const uv=polygon?.points?.[index]
              if(!uv)return null
              const p=previewPoint(transform(panel,range,uv),currentPreview)
              return <circle data-pattern-vertex-preview={`${panel.id}:${index}`}
                cx={p[0]} cy={p[1]} r=".013" stroke="#7549a2" strokeWidth=".003"
                fill="#f6d77c" pointerEvents="none"/>
            })()}
          {/* Live native curve preview: dragging a VectorCraft-style handle
              changes the displayed contour immediately, without waiting for
              the next Rust triangulation. Measurements are in material cm. */}
          {selected&&mode==='edit'&&tool2d==='curve'&&selection?.edge&&(()=>{
            const edge=selection.edge,polygon=panel.polygon
            const index=polygon?.edges?.indexOf(edge)??-1
            const previewPolygon=handlePreview?.panelId===panel.id&&handlePreview.polygon||polygon
            const handles=previewPolygon?.curves?.[edge]
            if(index<0||!Array.isArray(handles)||handles.length!==2)return null
            const [a,b]=[previewPolygon.points[index],previewPolygon.points[(index+1)%previewPolygon.points.length]]
            if(![a,b,...handles].every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))return null
            const [start,c1,c2,end]=[a,handles[0],handles[1],b]
              .map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
            const measured=cubicLength(a,handles[0],handles[1],b)
            return <g data-native-cubic-preview={`${panel.id}:${edge}`} pointerEvents="none">
              <path d={`M ${start[0]} ${start[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`}
                fill="none" stroke="#7a56be" strokeWidth=".0045" strokeDasharray=".012 .004"/>
              {Number.isFinite(measured)&&<text x={(start[0]+end[0])/2} y={(start[1]+end[1])/2-.016}
                data-native-cubic-length-cm={(measured*100).toFixed(3)}
                textAnchor="middle" fill="#61459c" stroke="#fff" strokeWidth=".0014"
                paintOrder="stroke" fontSize=".014">{(measured*100).toFixed(2)} cm</text>}
            </g>
          })()}
          {/* Free curve points remain attached to their original named edge,
              independent of the topological corner points and Bézier handles. */}
          {mode==='edit'&&tool2d==='split'&&Object.values(panel.polygon?.free_curve_points||{})
            .flat().some(mark=>mark.mirror_group)&&(()=>{
              const groups=new Map()
              for(const [edge,marks] of Object.entries(panel.polygon.free_curve_points)){
                for(const mark of marks){
                  if(!mark.mirror_group||!Array.isArray(mark.position)||!mark.position.every(Number.isFinite))continue
                  const items=groups.get(mark.mirror_group)||[]
                  items.push({edge,mark})
                  groups.set(mark.mirror_group,items)
                }
              }
              return <g data-mirrored-split-pairs={panel.id} pointerEvents="none">
                {[...groups].filter(([,items])=>items.length===2&&items[0].edge!==items[1].edge).map(([group,items])=>{
                  const positions=items.map(({mark})=>previewPoint(transform(panel,range,mark.position),currentPreview))
                  return <line key={group} data-mirrored-split-pair={group}
                    data-mirrored-split-edges={items.map(item=>item.edge).join('|')}
                    x1={positions[0][0]} y1={positions[0][1]} x2={positions[1][0]} y2={positions[1][1]}
                    stroke={hoveredSplitMirrorGroup===group?'#a94a29':'#b3775e'}
                    strokeWidth={hoveredSplitMirrorGroup===group?'.006':'.0035'}
                    strokeDasharray=".012 .008" opacity={hoveredSplitMirrorGroup===group?1:.7}/>
                })}
              </g>
            })()}
          {mode==='edit'&&['curve','split'].includes(tool2d)&&Object.entries(panel.polygon?.free_curve_points||{})
            .filter(([edge])=>tool2d==='split'||(selected&&selection?.edge===edge))
            .flatMap(([edge,marks])=>marks.map(mark=>{
              const shown=handlePreview?.panelId===panel.id&&handlePreview.polygon?.free_curve_points?.[edge]
                ?.find(candidate=>candidate.id===mark.id)?.position||mark.position
              if(!Array.isArray(shown)||shown.some(v=>!Number.isFinite(v)))return null
              const p=previewPoint(transform(panel,range,shown),currentPreview)
              const shownPolygon=handlePreview?.panelId===panel.id&&handlePreview.polygon||panel.polygon
              const shownMark=shownPolygon?.free_curve_points?.[edge]?.find(item=>item.id===mark.id)||mark
              const cubic=freeCurveBase(shownPolygon,edge)
              const derivative=shownMark.derivative|| (cubic&&cubicDerivativeAt(cubic,mark.t))
              const tangents=['in','out'].map(side=>{
                const vector=shownMark[`derivative_${side}`]||derivative
                const sign=side==='in'?-1:1
                const end=vector?.map((value,i)=>shown[i]+sign*value*.18)
                const point=end?.every(Number.isFinite)?previewPoint(transform(panel,range,end),currentPreview):null
                return {side,point}
              })
              return <g key={`free:${edge}:${mark.id}`} data-control-point="free-curve"
                data-free-curve-point={`${panel.id}:${edge}:${mark.id}`}
                data-free-curve-mirrored={String(Boolean(mark.mirror_group))}
                data-free-curve-mirror-group={mark.mirror_group||undefined}
                data-mirrored-split-highlight={tool2d==='split'&&Boolean(mark.mirror_group)&&hoveredSplitMirrorGroup===mark.mirror_group?'true':'false'}
                data-free-curve-split-candidate={tool2d==='split'?'true':undefined}
                aria-label={tool2d==='split'
                  ?mark.mirror_group?'Split both mirrored boundaries at linked free curve points':'Split boundary at this free curve point'
                  :'Free curve point. Drag to reshape the cutline; Option-click to remove.'}
                style={{cursor:tool2d==='split'?'crosshair':'move'}}
                onPointerEnter={()=>{if(tool2d==='split')setHoveredSplitMirrorGroup(mark.mirror_group||null)}}
                onPointerLeave={()=>{if(tool2d==='split')setHoveredSplitMirrorGroup(null)}}
                onPointerDown={event=>{
                  event.stopPropagation()
                  if(tool2d==='split'){
                    event.preventDefault()
                    if(busy||event.button!==0)return
                    const distance=arclengthToFreeCurvePoint(panel.polygon,edge,mark.t)
                    if(distance){
                      pick({panel:panel.id,edge})
                      void edit({kind:'SplitBoundary',panel:panel.id,edge,at_m:distance.at_m})
                    }else setFreeCurveStatus('Unable to locate this point on the material cutline.')
                    return
                  }
                  if(event.altKey){
                    const polygon=removeNativeFreeCurvePoint(panel.polygon,edge,mark.id)
                    if(polygon)void edit({kind:'Shape',panel:panel.id,polygon})
                    return
                  }
                  start(event,panel,`f:${edge}:${mark.id}`)
                }} onClick={event=>event.stopPropagation()}>
                <circle cx={p[0]} cy={p[1]} r={Math.max(.018,view[2]*.02)}
                  fill="transparent" stroke="none" aria-hidden="true"/>
                {tool2d==='split'&&mark.mirror_group&&<circle cx={p[0]} cy={p[1]} r=".019"
                  fill="none" stroke="#ae6a40" strokeWidth=".0025" strokeDasharray=".005 .004"
                  opacity={hoveredSplitMirrorGroup===mark.mirror_group?1:.8} pointerEvents="none" aria-hidden="true"/>}
                <circle cx={p[0]} cy={p[1]} r=".0125"
                  fill={tool2d==='split'&&mark.mirror_group?'#fce5ab':'#fceae0'}
                  stroke={hoveredSplitMirrorGroup===mark.mirror_group?'#a43924':'#d45632'}
                  strokeWidth={hoveredSplitMirrorGroup===mark.mirror_group?'.005':'.0035'} pointerEvents="none" aria-hidden="true"/>
                {tool2d==='curve'&&<g data-free-curve-tangent={`${panel.id}:${edge}:${mark.id}`}>
                  {tangents.filter(item=>item.point).map(({side,point:tangent})=><g key={side}>
                    <line x1={p[0]} y1={p[1]} x2={tangent[0]} y2={tangent[1]}
                      stroke="#7654ac" strokeWidth=".0025" pointerEvents="none"/>
                    <circle cx={tangent[0]} cy={tangent[1]} r=".012"
                      fill={side==='in'?'#a883d2':'#8253bd'} stroke="#fff" strokeWidth=".0025"
                      style={{cursor:'crosshair'}}
                      aria-label={`Drag ${side==='in'?'incoming':'outgoing'} curve tangent · Option breaks smooth link · Shift snaps to 45 degrees`}
                      data-free-curve-tangent-handle={`${panel.id}:${edge}:${mark.id}:${side}`}
                      onPointerDown={event=>{
                        event.stopPropagation()
                        start(event,panel,`ft:${edge}:${mark.id}:${side}`)
                      }}/>
                  </g>)}
                </g>}
              </g>
            }))}
          {selected&&mode==='edit'&&tool2d==='curve'&&selection?.edge&&
            handlePreview?.panelId===panel.id&&handlePreview.anchor?.startsWith('f:')&&(()=>{
              const polygon=handlePreview.polygon
              const edge=selection.edge
              if(!polygon?.free_curve_points?.[edge]?.length)return null
              const [,anchorEdge,anchorId]=handlePreview.anchor.split(':')
              const group=polygon.free_curve_points[anchorEdge]?.find(item=>item.id===anchorId)?.mirror_group
              const shownEdges=group?Object.entries(polygon.free_curve_points)
                .filter(([_,marks])=>marks.some(mark=>mark.mirror_group===group)).map(([edge])=>edge):[edge]
              return <g data-native-free-curve-preview={`${panel.id}:${edge}`} pointerEvents="none">
                {shownEdges.map(shownEdge=>{
                  const points=Array.from({length:97},(_,i)=>evaluateFreeCurve(polygon,shownEdge,i/96))
                    .filter(Boolean).map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
                  if(points.length<2)return null
                  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0)
                  const midpoint=points[Math.floor(points.length/2)]
                  return <g key={shownEdge} data-preview-curve-edge={shownEdge}>
                    <polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#cc533c"
                      strokeWidth=".005" strokeDasharray=".011 .004"/>
                    <text x={midpoint[0]} y={midpoint[1]-.02} textAnchor="middle"
                      fill="#9c3729" stroke="#fff" strokeWidth=".0014" paintOrder="stroke"
                      fontSize=".015" data-native-free-curve-length-cm={(length*100).toFixed(3)}>
                      {(length*100).toFixed(2)} cm
                    </text>
                  </g>
                })}
              </g>
            })()}
          {selected && mode === 'edit' && tool2d === 'curve' && Object.entries(panel.polygon?.curves || {})
            .filter(([edge])=>selection?.edge===edge)
            .flatMap(([edge, controls]) => controls.map((uv, index) => {
            const moved=handlePreview?.panelId===panel.id
              ?handlePreview.polygon?.curves?.[edge]?.[index]||uv:uv
            const p = previewPoint(transform(panel, range, moved),currentPreview)
            const edgeIndex = panel.polygon.edges.indexOf(edge)
            const original = panel.polygon.points[(edgeIndex + index) % panel.polygon.points.length]
            if (!original) return null
            const anchor = previewPoint(transform(panel, range, original),currentPreview)
            return <g key={`${edge}-${index}`}>
              <line x1={anchor[0]} y1={anchor[1]} x2={p[0]} y2={p[1]} stroke="#6f6690" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
              <circle data-control-point="curve" data-curve-handle={`${panel.id}:${edge}:${index}`}
                data-panel-id={panel.id} cx={p[0]} cy={p[1]} r={Math.max(.004,Math.min(.012,view[2]*.004))}
                fill={POINT_COLORS.curve} stroke={POINT_COLORS.outline} strokeWidth=".002" style={{cursor:nativeCursor||'pointer'}}
                aria-label="Bézier handle · Shift for angle snap · Option to break tangent"
                onPointerDown={e => start(e, panel, `c:${edge}:${index}`)}/>
            </g>
          }))}
        </g>
      })}
      {(s?.seams || []).flatMap((seam, i) => {
        const spec = s.template?.seams?.find(item => item.id === seam.id)
        if (!spec) return []
        // A selected *piece* should not flood the board with hundreds of
        // cross-panel correspondence lines. Spotlight full seam structure
        // only when an actual colored boundary is hovered/selected.
        const chosen=editSewingActive&&selection?.seamId===seam.id
        const emphasized = chosen || (!!active?.edge && [spec.a, spec.b].some(b => b?.panel === active.panel && b.edge === active.edge))
        const color = SEAM_COLORS[i % SEAM_COLORS.length]
        return (seam.guides || []).filter((_, j) => j % (emphasized ? 3 : 16) === 0).flatMap((pair, j) => {
          const a = weighted(pair[0], boardUV), b = weighted(pair[1], boardUV)
          if (!a || !b) return []
          return <g key={`${seam.id}-${j}`} pointerEvents="none">
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={emphasized ? '#ef6339' : color}
              strokeWidth={emphasized ? '.003' : '.00125'} strokeDasharray=".01 .012" opacity={emphasized ? 1 : .42}/>
            {editSewingActive&&<line data-edit-seam-guide={seam.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
              fill="none" stroke="transparent" strokeWidth=".013" pointerEvents="stroke"
              style={{cursor:SEWING_CURSOR}} onPointerDown={event=>event.stopPropagation()}
              onClick={event=>{event.stopPropagation();onSelectSewingSeam(seam.id)}}/>}
            {showSeamDots && <>
              <circle data-control-point="seam" cx={a[0]} cy={a[1]} r={emphasized ? '.008' : '.006'} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".0015"/>
              <circle data-control-point="seam" cx={b[0]} cy={b[1]} r={emphasized ? '.008' : '.006'} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".0015"/>
            </>}
          </g>
        })
      })}
      {walkSeamId&&(()=>{
        const seam=s?.template?.seams?.find(item=>item.id===walkSeamId)
        if(!seam)return null
        const clamped=Math.max(0,Math.min(1,walkFraction))
        const locations=[seam.a,seam.b].map((side,i)=>{
          const indices=s.panels?.find(panel=>panel.id===side.panel)?.boundaries?.[side.edge||side.side]
          const interval=Array.isArray(side.range)&&side.range.length===2?side.range:[0,1]
          const t=interval[0]+clamped*(interval[1]-interval[0])
          return indices?.length>1?boundaryMark(indices,t)?.p:null
        })
        if(locations.some(p=>!p))return null
        return <g data-native-walk-overlay={walkSeamId} pointerEvents="none">
          <line x1={locations[0][0]} y1={locations[0][1]} x2={locations[1][0]} y2={locations[1][1]} stroke="#b05b26" strokeWidth=".003" strokeDasharray=".012 .006"/>
          {locations.map((p,i)=><g key={i} data-native-walk-marker={i}>
            <circle cx={p[0]} cy={p[1]} r=".013" fill={i?'#f1c874':'#49a8be'} stroke="#27313a" strokeWidth=".003"/>
            <text x={p[0]} y={p[1]-.019} fontSize=".022" textAnchor="middle" fontWeight="700" fill="#27313a" paintOrder="stroke" stroke="#f4eee7" strokeWidth=".006">{i?'B':'A'}</text>
          </g>)}
        </g>
      })()}
      {(draft.length > 0||pencilSamples.length>0) && <polyline data-vector-draft={tool2d==='vector-pencil'?'pencil':tool2d==='vector-pen'?'pen':'pattern'}
        points={(pencilSamples.length?pencilSamples:draft).map(p => p.join(',')).join(' ')}
        fill="none" stroke="#ef6339" strokeWidth=".005" pointerEvents="none"/>}
      {tool2d==='vector-pen'&&draft.map((p,i)=>{const t=vectorTangents[i]||[0,0];return <g key={i} data-vector-pen-anchor={i} pointerEvents="none">
        <circle cx={p[0]} cy={p[1]} r=".008" fill="#fff" stroke="#7854be" strokeWidth=".002"/>
        {Math.hypot(...t)>.001&&<><line x1={p[0]-t[0]} y1={p[1]-t[1]} x2={p[0]+t[0]} y2={p[1]+t[1]} stroke="#7758bd" strokeDasharray=".005 .003" strokeWidth=".002"/>
          <circle cx={p[0]+t[0]} cy={p[1]+t[1]} r=".006" fill="#795aba"/></>}
      </g>})}
      {measuring && tape.map((p,i)=><circle key={i} data-tape-point={i} aria-label={`Measurement endpoint ${i+1}`} cx={p[0]} cy={p[1]} r={editingTape?'.014':'.010'} fill="#fff" stroke="#166478" strokeWidth=".003" pointerEvents={editingTape?'all':'none'} style={{cursor:editingTape?'move':'default'}} onPointerDown={e=>{
        if(!editingTape||busy)return
        e.stopPropagation();e.preventDefault()
        tapeDrag.current={index:i}
        svg.current?.setPointerCapture(e.pointerId)
      }}/>)}
      {measuring && tape.length===2 && <g data-tape-measurement="true" pointerEvents="none">
        <line x1={tape[0][0]} y1={tape[0][1]} x2={tape[1][0]} y2={tape[1][1]} stroke="#166478" strokeWidth=".004" strokeDasharray=".012 .007"/>
        <text x={(tape[0][0]+tape[1][0])/2} y={(tape[0][1]+tape[1][1])/2-.025} textAnchor="middle" fontSize=".029" fontWeight="600" fill="#164654" stroke="#eaf0f0" strokeWidth=".008" paintOrder="stroke">{formatCm(Math.hypot(tape[1][0]-tape[0][0],tape[1][1]-tape[0][1]))}</text>
      </g>}
      {panels.flatMap(({panel,range})=>(panel.polygon?.measurements||[]).map(measurement=>{
        const a=boundaryMark(range.boundaries?.[measurement.a?.edge]||[],measurement.a?.t)?.p
        const b=boundaryMark(range.boundaries?.[measurement.b?.edge]||[],measurement.b?.t)?.p
        if(!a||!b)return null
        const isSelected=selectedPom?.panel===panel.id&&selectedPom?.id===measurement.id
        return <g key={`${panel.id}:${measurement.id}`} data-native-pom={measurement.id} data-native-pom-panel={panel.id} pointerEvents="none">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={isSelected?'#f68c35':'#126c79'} strokeWidth={isSelected?'.006':'.004'} strokeDasharray=".012 .005"/>
          {[a,b].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r=".007" fill="#fff" stroke="#126c79" strokeWidth=".003"/>)}
          <text x={(a[0]+b[0])/2} y={(a[1]+b[1])/2-.019} textAnchor="middle" fontSize=".020" fill="#164654" stroke="#f8faf8" strokeWidth=".006" paintOrder="stroke">{measurement.label}: {formatCm(Math.hypot(b[0]-a[0],b[1]-a[1]))}</text>
        </g>
      }))}
      </g>
    </svg>
  </div>
}

import {presetForFabric} from "../core/clothcraftFabrics.js"
import React, {useEffect, useId, useMemo, useRef, useState} from 'react'
import ClothCraftCornerTools from './ClothCraftCornerTools.jsx'
import {PatternReferenceImageLayer, PatternReferenceImageControls, usePatternReferenceImage} from './PatternReferenceImage.jsx'
import ClothCraftStudioSilhouette from './ClothCraftStudioSilhouette.jsx'
import './ClothCraftSegmentSewing.css'
import {cursorForTool} from '../core/toolCursors.js'
import {freeSewingPointAtFraction, freeSewingRangePoints, projectFreeSewingPoint} from '../core/freeSewingGeometry.js'
import {getBounds, frontAvatarRegistration, horizontalPatternSpans, previewPoint, rotatedLayoutAroundCenter, trianglePath, boundarySegments} from '../core/clothcraft2dGeometry.js'
import {horizontalGuideTracks,verticalGuideTracks,sharedTorsoGuideX,patternGuideLocalFrame,armpitChestReference} from '../core/patternGuideTracks.js'
import {sampleInternalCurve,initialInternalTangents} from './nativeInternalCurve.js'
import {cubicLength,editPatternBezierHandle,previewPatternAnchorMove,patternEditingControls,visibleTangent} from '../core/vectorPatternBezier.js'
import {addNativeFreeCurvePoint,closestFreeCurveParameter,evaluateFreeCurve,moveNativeFreeCurvePoint,editNativeFreeCurveTangent,cubicDerivativeAt,freeCurveBase,removeNativeFreeCurvePoint,arclengthToFreeCurvePoint} from '../core/nativeFreeCurvePoints.js'
import {fitPencilStroke,pathCubicControls} from '../core/vectorFreehandFit.js'
import {teeBalanceNotchCommands} from '../core/patternSewingNotches.js'
import {shapePoints} from './FoamPaddingNativeOverlay.jsx'
import {measureNativeSelection} from '../core/clothcraftSelectionMetrics.js'
import {freeTangentDragDelta} from '../core/freeTangentDrag.js'
import {sewingLengthDiagnostic} from '../core/sewingLengthDiagnostics.js'
import {samplePatternSewingGuideIndices} from '../core/patternSewingGuideSampling.js'
import {seamAllowancePreviewPoints} from '../core/patternAllowancePreview.js'
import {placePatternLabel} from '../core/patternLabelPlacement.js'
import {sideCurveStation,torsoSideCurveStations,curveDraftDimensions} from '../core/patternCurveDrafting.js'
import {sampleGuideHalfCurve} from '../core/patternGuideHalfCurves.js'
import {vectorcraftAnchorKind} from '../core/vectorcraftAnchorPort.js'
import './PatternAuditRefinements.css'
import {PATTERN_VISUAL,PATTERN_METRICS,pointRadiusInView,patternCutlinePresentation,patternPointGlyph,patternSemanticStroke} from '../core/patternVisualTokens.js'

const COLORS = ['#527e91', '#d29465', '#7a9e79', '#a889b2', '#c3ab5d', '#76a5a4']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
const CLO_HOVER_BLUE = '#009dff'
const CLO_CURVE_ACTIVE_YELLOW = '#ffe600'
// Solid CAD control-point fills must contrast with light/white fabric.
// Vertex, curve and seam correspondence dots have distinct visual roles.
const POINT_COLORS = {vertex:PATTERN_VISUAL.vertex,selectedVertex:PATTERN_VISUAL.selectedVertex,curve:PATTERN_VISUAL.curveControlOutline,outline:PATTERN_VISUAL.vertexOutline}
// CLO-style drafting hierarchy; presentation never modifies the pattern UVs.
// CLO-inspired drafting contrast: neutral pattern paper, dark stitch contours,
// and a distinct amber active selection without changing native geometry.
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

// A yellow handle alone is not a real CLO-style shape preview. Build the
// temporarily filled pattern outline directly from the same canonical cubic
// and free-point evaluator Rust compiles. Only native Shape success changes
// the saved mesh; until Apply, this is explicitly a visual proposal.
function proposedPaperOutline(panel,range,polygon,preview=null) {
  if(!polygon?.edges?.length||!Array.isArray(polygon.points)||
    polygon.edges.length!==polygon.points.length)return null
  const points=[]
  for(const edge of polygon.edges){
    for(let sample=0;sample<24;sample++){
      const local=evaluateFreeCurve(polygon,edge,sample/24)
      if(!Array.isArray(local)||local.some(v=>!Number.isFinite(v)))return null
      const global=previewPoint(transform(panel,range,local),preview)
      if(global?.length!==2||global.some(v=>!Number.isFinite(v)))return null
      points.push(global)
    }
  }
  return points.length>=3?`M${points.map(p=>p.join(',')).join('L')}Z`:null
}

// Each visible interval owns its own hit target; shared nodes are drawn once
// per connected guide. They follow model-space vertices at any camera zoom.
function GuideSegment({panelId,kind,id,a,b,color='#918fae',dashed=false,nativeLineId=null,selectedGuide,hoveredGuideId,onSelectGuide,screenUnit=1,curveOffset=null,curveAngle=0,curveMode=false,curveDragging=false}) {
  const active=selectedGuide?.id===id
  const hot=hoveredGuideId===id
  const lengthMetres=Math.hypot(b[0]-a[0],b[1]-a[1])
  // Real CLO-style guide strokes run all the way between the actual dots.
  // Previous midpoint shortening created false, floating visual endpoints.
  // Individual half IDs still select and color only their own line.
  const selected={id,panelId,kind,lengthMetres,points:[a,b]}
  const editable=curveMode&&['chest','belly'].includes(kind)
  const bent=Array.isArray(curveOffset)&&Math.hypot(...curveOffset)>.000025
  const guideCurve=editable||bent?sampleGuideHalfCurve(a,b,curveOffset||[0,0],curveAngle):null
  const pathPoints=guideCurve?.points.map(p=>p.join(',')).join(' ')
  const stroke=curveDragging||editable&&active?CLO_CURVE_ACTIVE_YELLOW:
    hot?CLO_HOVER_BLUE:active?'#ed9d26':color
  return <g data-2d-construction={kind} data-guide-id={id} data-guide-kind={kind}
    data-guide-panel={panelId} data-guide-segment={id} data-hovered={String(hot)}
    data-native-line-id={nativeLineId||undefined}>
    {guideCurve?<polyline data-guide-curve="true" data-curvable-guide-half={id}
      points={pathPoints} fill="none"
      {...patternSemanticStroke('guide',{selected:active,hovered:hot})}
      stroke={stroke} strokeWidth={curveDragging||active&&editable?2.75:hot?3:1.15}
      strokeLinejoin="round" pointerEvents="none"/>:
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
      {...patternSemanticStroke('guide',{selected:active,hovered:hot})}
      stroke={stroke}
      strokeWidth={hot?3:dashed?2.5:1.15}
      // Non-scaling strokes use CSS-pixel dash lengths, not material metres.
      // Previous dash lengths multiplied by screenUnit became microscopic
      // and could look like a faint solid or disappear completely.
      strokeDasharray={dashed?'6 4':undefined} pointerEvents="none"/>}
    {editable&&(hot||active||curveDragging)&&guideCurve&&
      <g data-guide-half-curve-knob={id} pointerEvents="none">
        <line x1={guideCurve.middle[0]} y1={guideCurve.middle[1]}
          x2={guideCurve.control[0]} y2={guideCurve.control[1]}
          stroke={CLO_CURVE_ACTIVE_YELLOW} strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"/>
        <circle cx={guideCurve.points[Math.floor(guideCurve.points.length/2)][0]}
          cy={guideCurve.points[Math.floor(guideCurve.points.length/2)][1]}
          r={3*screenUnit} fill="#fff8b4" stroke={CLO_CURVE_ACTIVE_YELLOW}
          strokeWidth="1.25" vectorEffect="non-scaling-stroke"/>
      </g>}
    {/* Hit testing belongs to the parent SVG in screen pixels. Overlapping
        3mm hem references must not steal each other's mouse target. */}
    {onSelectGuide&&<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent"
      strokeWidth=".018" pointerEvents="none"/>}
  </g>
}

function GuideNodes({panelId,kind,points,selectedGuide,hoveredGuideId=null,screenUnit=1,reuseNativeEndpoints=false}) {
  const active=selectedGuide?.kind===kind||
    (selectedGuide?.nativeLineId&&kind===`native:${selectedGuide.nativeLineId}`)
  return <g data-2d-shared-nodes={kind} pointerEvents="none">
    {points.map((p,i)=>{
      // The real authored armpit corner dot already exists at each chest end.
      // Never draw a second guide dot on the exact same pixel.
      if(reuseNativeEndpoints&&(i===0||i===points.length-1))return null
      const onLeft=hoveredGuideId?.endsWith(':left'),onRight=hoveredGuideId?.endsWith(':right')
      const sameTrack=hoveredGuideId?.startsWith(panelId+':'+kind+':')
      // The midpoint belongs to BOTH half segments: keep it neutral so a
      // hover never appears to tint the opposite half through the shared dot.
      const hot=sameTrack&&((i===0&&onLeft)||(i===points.length-1&&onRight))
      const selectedHere=active&&(!selectedGuide?.id||
        (i===0&&selectedGuide.id.endsWith(':left'))||
        (i===points.length-1&&selectedGuide.id.endsWith(':right'))||
        (i>0&&i<points.length-1))
      return <circle key={i} data-2d-shared-node={`${panelId}:${kind}:${i}`}
        data-guide-node-hovered={String(Boolean(hot))}
        cx={p[0]} cy={p[1]} r={(selectedHere?3:2.25)*screenUnit}
        fill={hot?'#eefaff':selectedHere?'#fff1d5':'#f7f8f7'}
        stroke={hot?CLO_HOVER_BLUE:selectedHere?'#e49a37':'#8c9296'}
        strokeWidth={hot?1.6:selectedHere?1.1:.8} vectorEffect="non-scaling-stroke"/>
    })}
  </g>
}

// Physically authored Rust InternalLines render on any garment panel and keep
// stable per-line IDs, independently of the illustrative drafting references.
function NativeInternalLines({panel,range,preview,onSelectGuide,selectedGuide,hoveredGuideId,screenUnit=1,
  activeInternalLine,curveMode,onSelectCurve,onStartTangent,handlePreview}) {
  return <g data-native-internal-lines-panel={panel.id}>
    {(panel.polygon?.lines||[]).map(line=>{
      const points=(line.points||[]).map(uv=>previewPoint(transform(panel,range,uv),preview))
      if(points.length<2)return null
      return <g key={line.id} data-native-internal-line={`${panel.id}:${line.id}`}>
        {points.slice(1).map((pt,i)=>{
          const liveTangent=index=>{
            const tangent=line.tangents?.[index]||[0,0]
            const moved=handlePreview?.panelId===panel.id&&
              handlePreview.anchor===`l:${line.id}:${index}`
            return moved?tangent.map((v,j)=>v+(handlePreview.delta?.[j]||0)):tangent
          }
          const sampled=sampleInternalCurve(line.points[i],line.points[i+1],
            liveTangent(i),liveTangent(i+1))
            .map(p=>previewPoint(transform(panel,range,p),preview))
          const id=`${panel.id}:native:${line.id}:${i}`
          const active=selectedGuide?.id===id
          const hot=hoveredGuideId===id
          const stroke=hot?CLO_HOVER_BLUE:active?'#ed9d26':'#7c5bad'
          const shape=sampled.map(p=>p.join(',')).join(' ')
          return <g key={i} data-2d-construction="native-internal-line"
            data-guide-id={id} data-guide-kind="native-internal-line"
            data-guide-panel={panel.id} data-guide-segment={id}
            data-native-line-id={line.id} data-hovered={String(hot)}>
            <polyline data-guide-curve="true" points={shape} {...patternSemanticStroke('internal',{selected:active,hovered:hot})}
              stroke={handlePreview?.panelId===panel.id&&handlePreview.anchor?.startsWith(`l:${line.id}:`)
                ?'#facc15':stroke}
              strokeLinecap="round" strokeLinejoin="round" fill="none" pointerEvents="none"/>
            {curveMode&&<polyline data-internal-curve-hit={`${panel.id}:${line.id}:${i}`}
              points={shape} stroke="transparent" strokeWidth="10" vectorEffect="non-scaling-stroke" fill="none"
              pointerEvents="stroke" style={{cursor:'pointer'}}
              title="Click to edit curve · Option-click to straighten"
              onPointerDown={event=>event.stopPropagation()}
              onClick={event=>{event.stopPropagation();onSelectCurve?.(panel,line,event.altKey)}}/>}
          </g>
        })}
        <GuideNodes panelId={panel.id} kind={`native:${line.id}`} points={points} selectedGuide={selectedGuide} screenUnit={screenUnit}/>
        {curveMode&&activeInternalLine?.panel===panel.id&&activeInternalLine?.line===line.id&&
          points.map((p,i)=>{
            const tangent=line.tangents?.[i]||[0,0]
            const activeHandle=handlePreview?.panelId===panel.id&&handlePreview.anchor===`l:${line.id}:${i}`
            const moved=handlePreview?.panelId===panel.id&&handlePreview.anchor===`l:${line.id}:${i}`
              ?handlePreview.delta:[0,0]
            const endUV=line.points[i].map((n,j)=>n+tangent[j]+moved[j])
            const handle=previewPoint(transform(panel,range,endUV),preview)
            return <g key={i} data-internal-control-group={`${panel.id}:${line.id}:${i}`}>
              <line x1={p[0]} y1={p[1]} x2={handle[0]} y2={handle[1]}
                stroke={activeHandle?'#facc15':PATTERN_VISUAL.curveArm} strokeWidth={activeHandle?2:1} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
              <circle cx={handle[0]} cy={handle[1]} r={PATTERN_METRICS.curvePointRadius*screenUnit}
                data-internal-curve-handle={`${panel.id}:${line.id}:${i}`}
                data-control-point="internal-curve" data-active-curve-handle={String(Boolean(activeHandle))}
                fill={activeHandle?'#fef08a':PATTERN_VISUAL.curveControlFill} stroke={activeHandle?'#eab308':PATTERN_VISUAL.curveControlOutline} strokeWidth={activeHandle?1.6:.8} vectorEffect="non-scaling-stroke"
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
function ConstructionGuides({panel, range, boundaries, uv, triangles, clipId, preview, onSelectGuide, selectedGuide, hoveredGuideId, showNotchReferences=true, onCreateGuideLine,screenUnit=1,nativeCornerNodesVisible=false,editableSideStations=false,curveMode=false,curveOffsets=null,curveDraft=null}) {
  const identity=`${panel?.id || ''} ${panel?.name || ''}`
  const torso=/front|back|bodice|torso/i.test(identity)
  if (!uv?.length) return null
  const angle=((panel.layout_rotation_degrees||0)*Math.PI/180)+(preview?.kind==='rotate'?preview.angle:0)
  const origin=previewPoint(transform(panel,range,[0,0]),preview)
  const {local,toWorld}=patternGuideLocalFrame(uv,origin,angle)
  const outline=Object.values(boundaries||{}).flat().map(i=>local[i]).filter(Boolean)
  const bounds=getBounds(outline)
  if (!bounds||bounds.width<.12||bounds.height<.10) return null
  const blue='#8f91ae',red='#b18a8d'
  const torsoSides=boundaries?.['side-left']&&boundaries?.['side-right']
    ? {'side-left':boundaries['side-left'],'side-right':boundaries['side-right']} : null
  const centerAtY=y=>{
    const sideSpans=torsoSides?horizontalPatternSpans(torsoSides,local,y):[]
    const fullSpans=horizontalPatternSpans(boundaries,local,y)
    const span=[...(sideSpans.length===1?sideSpans:fullSpans)].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]
    return span?(span[0]+span[1])/2:bounds.cx
  }
  const underarms=torso?armpitChestReference(panel.polygon):null
  const chestY=underarms?.y??bounds.minY+bounds.height*.46
  const waistY=bounds.minY+bounds.height*.64
  // The visually required center axis is not optional just because a very
  // concave edited panel has no column shared at two stations. Fall back to
  // its physical chest-side center and keep each visible material interval
  // separately clipped rather than drawing through empty cloth.
  const centerX=torso?(sharedTorsoGuideX(triangles,local,chestY,waistY,centerAtY(chestY))
    ??centerAtY(chestY)):null
  const segment=(kind,id,p,q,dashed=false,color=blue)=><GuideSegment key={id}
    panelId={panel.id} kind={kind} id={id} a={p} b={q} dashed={dashed}
    color={color} onSelectGuide={onSelectGuide} selectedGuide={selectedGuide}
    hoveredGuideId={hoveredGuideId} screenUnit={screenUnit}
    curveMode={curveMode} curveAngle={angle}
    curveOffset={curveDraft?.id===id?curveDraft.offset:curveOffsets?.[id]}
    curveDragging={curveDraft?.id===id}/>
  const horizontal=(fraction,kind)=>{
    const y=kind==='chest'&&underarms?chestY:bounds.minY+bounds.height*fraction
    const bellySides=kind==='belly'
      ?[sideCurveStation(panel.polygon,'side-left',y),sideCurveStation(panel.polygon,'side-right',y)]:null
    const stations=kind==='belly'&&bellySides?.every(Boolean)&&Number.isFinite(centerX)&&
      centerX>bellySides[0].position[0]+.001&&centerX<bellySides[1].position[0]-.001
      ?[[bellySides[0].position,[centerX,y],bellySides[1].position]]
      :kind==='chest'&&underarms&&Number.isFinite(centerX)&&
      centerX>underarms.left[0]+.001&&centerX<underarms.right[0]-.001
      ?[[underarms.left,[centerX,chestY],underarms.right]]
      :horizontalGuideTracks(boundaries,local,y,centerX,torsoSides,triangles,true)
    return stations.map((localPts,i)=>{
      const pts=localPts.map(toWorld)
      return <g key={`${kind}:${i}`} data-2d-guide-track={kind}
        data-chest-anatomical-endpoints={kind==='chest'&&Boolean(underarms)?'underarm-side-corners':undefined}>
        {segment(kind,`${panel.id}:${kind}:${i}:left`,pts[0],pts[1])}
        {segment(kind,`${panel.id}:${kind}:${i}:right`,pts[1],pts[2])}
        <GuideNodes panelId={panel.id} kind={kind} points={pts} selectedGuide={selectedGuide}
          hoveredGuideId={hoveredGuideId} screenUnit={screenUnit}
          reuseNativeEndpoints={kind==='chest'&&Boolean(underarms)&&nativeCornerNodesVisible||
            kind==='belly'&&editableSideStations&&Boolean(bellySides?.every(Boolean))}/>
      </g>
    })
  }
  const center=()=>{
    const levels=torso?[chestY,waistY,bounds.minY+bounds.height*.965,bounds.minY+bounds.height*.975]:[]
    const tracks=verticalGuideTracks(boundaries,local,centerX,levels,triangles)
    if(!tracks.length)return null
    // All occupied cutline intervals share one straight garment-local axis.
    // Physical gaps stay empty; chest/waist rings intersect a drawn interval.
    const kind=/back/i.test(identity)?'center-back':'center-front'
    return <g data-2d-guide-track={kind} data-center-vertical-dotted="true">
      {tracks.map((straight,trackIndex)=>{
        const pts=straight.map(toWorld)
        return <g key={trackIndex} data-center-guide-interval={trackIndex}>
          {pts.slice(1).map((p,i)=>segment(kind,`${panel.id}:${kind}:${trackIndex}:${i}`,pts[i],p,true,'#0e2634'))}
          {/* Transverse levels draw one shared ring; interval endpoints get dots. */}
          <GuideNodes panelId={panel.id} kind={kind} points={[pts[0],pts.at(-1)]} selectedGuide={selectedGuide} screenUnit={screenUnit}/>
        </g>
      })}
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
          stroke={hot?CLO_HOVER_BLUE:active?'#ed9d26':'#8277c5'}
          strokeWidth={active||hot?'.0055':'.0028'} fill="none" pointerEvents="none"/>
      </g>
      <GuideNodes panelId={panel.id} kind={name} points={[offset[0],offset.at(-1)]} screenUnit={screenUnit}
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
    {torso&&center()}
    {torso&&<>{horizontal(.46,'chest')}{horizontal(.64,'belly')}
      {horizontal(.965,'hem-upper')}{horizontal(.975,'hem-lower')}</>}
    {shoulderOffsets}
    {marks}
  </g>
}

function Dimensions({points, selected, panel, boundaries, uv, clipId, preview,screenUnit=1}) {
  if (points.length < 3) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX, height = maxY - minY
  if (!(width > .015 && height > .015)) return null
  const line = '#67767b', offset = .045, arrow = .009
  const measureStroke={stroke:line,strokeWidth:.75,vectorEffect:'non-scaling-stroke'}
  const faintStroke={stroke:line,strokeWidth:.55,vectorEffect:'non-scaling-stroke'}
  const y = maxY + offset, x = maxX + offset
  const font = {fontSize: '.019', fill: '#55656a', textAnchor: 'middle', paintOrder: 'stroke', stroke: '#eef0ef', strokeWidth: '.008'}
  return <g pointerEvents="none" opacity={selected ? .95 : .65}>
    <line x1={minX} x2={maxX} y1={y} y2={y} {...measureStroke}/>
    <path d={`M${minX + arrow},${y - arrow / 2}L${minX},${y}L${minX + arrow},${y + arrow / 2} M${maxX - arrow},${y - arrow / 2}L${maxX},${y}L${maxX - arrow},${y + arrow / 2}`} {...measureStroke} fill="none"/>
    <line x1={minX} x2={minX} y1={maxY + .012} y2={y + .012} {...faintStroke}/>
    <line x1={maxX} x2={maxX} y1={maxY + .012} y2={y + .012} {...faintStroke}/>
    <text x={(minX + maxX) / 2} y={y - .009} {...font}>{formatCm(width)}</text>
    <line x1={x} x2={x} y1={minY} y2={maxY} {...measureStroke}/>
    <path d={`M${x - arrow / 2},${minY + arrow}L${x},${minY}L${x + arrow / 2},${minY + arrow} M${x - arrow / 2},${maxY - arrow}L${x},${maxY}L${x + arrow / 2},${maxY - arrow}`} {...measureStroke} fill="none"/>
    <line x1={maxX + .012} x2={x + .012} y1={minY} y2={minY} {...faintStroke}/>
    <line x1={maxX + .012} x2={x + .012} y1={maxY} y2={maxY} {...faintStroke}/>
    <text x={x + .014} y={(minY + maxY) / 2} fontSize=".019" fill="#55656a" paintOrder="stroke" stroke="#eef0ef" strokeWidth=".008">{formatCm(height)}</text>
  </g>
}

function SelectionMarquee2D({points, panel, onStart, disabled, screenUnit}) {
  const b = getBounds(points)
  if (!b || b.width < .02 || b.height < .02) return null
  const handles = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
  const x = sign => sign===-1?b.minX:sign===1?b.maxX:b.cx
  const y = sign => sign===-1?b.minY:sign===1?b.maxY:b.cy
  const rotationY=b.minY-32*screenUnit
  const lineColor='#526873',handleSize=7*screenUnit
  return <g data-2d-marquee={panel.id} aria-label={`2D transform selection: ${panel.name}`}>
    <rect x={b.minX} y={b.minY} width={b.width} height={b.height}
      fill="none" stroke={lineColor} strokeWidth=".9" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    <rect data-2d-marquee-move={panel.id} x={b.minX} y={b.minY}
      width={b.width} height={b.height} fill="none" stroke="transparent" strokeWidth="10" vectorEffect="non-scaling-stroke"
      style={{cursor:disabled?'default':'move'}} pointerEvents="stroke"
      onPointerDown={e => onStart(e,panel,undefined,'move')}/>
    <line x1={b.cx} y1={b.minY} x2={b.cx} y2={rotationY}
      stroke={lineColor} strokeWidth=".9" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    <circle data-2d-rotate={panel.id} cx={b.cx} cy={rotationY} r={5*screenUnit}
      fill="#fff" stroke={lineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{cursor:'grab'}}
      onPointerDown={e => onStart(e,panel,undefined,'rotate')}/>
    {handles.map(([hx,hy]) => <rect key={`${hx},${hy}`} data-2d-scale-guide={`${hx},${hy}`}
      x={x(hx)-handleSize/2} y={y(hy)-handleSize/2} width={handleSize} height={handleSize}
      fill="#fff" stroke={lineColor} strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}
    <circle cx={b.cx} cy={b.cy} r={3.5*screenUnit} stroke={lineColor} strokeWidth=".8" vectorEffect="non-scaling-stroke"
      fill="#fff" pointerEvents="none"/>
    <path d={`M${b.cx-6*screenUnit} ${b.cy}h${12*screenUnit} M${b.cx} ${b.cy-6*screenUnit}v${12*screenUnit}`}
      stroke={lineColor} strokeWidth=".8" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
  </g>
}

function GraphicMeasurementBox({id, x, y, width, height, enabled, screenUnit}) {
  const line='#1486b7', tick=5*screenUnit, extension=12*screenUnit
  const labelStyle={fontSize:11*screenUnit,fontWeight:600,
    fill:'#095d82',stroke:'#fff',strokeWidth:2*screenUnit,paintOrder:'stroke'}
  return <g data-2d-graphic-measure-box={id} data-measurements-visible={String(enabled)}
    data-graphic-width-mm={(width*1000).toFixed(2)} data-graphic-height-mm={(height*1000).toFixed(2)}
    pointerEvents="none">
    {enabled&&<>
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={line}
        strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 3"/>
      <line x1={x} x2={x+width} y1={y-extension} y2={y-extension}
        stroke={line} strokeWidth=".75" vectorEffect="non-scaling-stroke"/>
      <path d={`M${x} ${y-extension-tick}v${tick*2} M${x+width} ${y-extension-tick}v${tick*2}
        M${x} ${y-3*screenUnit}v${-extension+3*screenUnit} M${x+width} ${y-3*screenUnit}v${-extension+3*screenUnit}`}
        fill="none" stroke={line} strokeWidth=".75" vectorEffect="non-scaling-stroke"/>
      <text x={x+width/2} y={y-extension-5*screenUnit} textAnchor="middle" {...labelStyle}>
        {(width*1000).toFixed(1)} mm
      </text>
      <line x1={x+width+extension} x2={x+width+extension} y1={y} y2={y+height}
        stroke={line} strokeWidth=".75" vectorEffect="non-scaling-stroke"/>
      <path d={`M${x+width+extension-tick} ${y}h${tick*2}
        M${x+width+extension-tick} ${y+height}h${tick*2}
        M${x+width+3*screenUnit} ${y}h${extension-3*screenUnit}
        M${x+width+3*screenUnit} ${y+height}h${extension-3*screenUnit}`}
        fill="none" stroke={line} strokeWidth=".75" vectorEffect="non-scaling-stroke"/>
      <text x={x+width+extension+8*screenUnit} y={y+height/2} textAnchor="middle"
        transform={`rotate(90 ${x+width+extension+8*screenUnit} ${y+height/2})`} {...labelStyle}>
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
  onEnableCurveSeamEase = null,
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
  const [canvasSize,setCanvasSize] = useState([800,800])
  useEffect(()=>{
    if(!svg.current)return
    const observer=new ResizeObserver(([entry])=>setCanvasSize([entry.contentRect.width,entry.contentRect.height]))
    observer.observe(svg.current)
    return ()=>observer.disconnect()
  },[])
  // SVG uses meet scaling: controls remain the same screen size at any zoom.
  const screenUnit=Math.max(view[2]/Math.max(1,canvasSize[0]),view[3]/Math.max(1,canvasSize[1]))

  const foamDrag=useRef(null)
  const [foamPreview,setFoamPreview]=useState(null)
  const [handlePreview,setHandlePreview] = useState(null)
  // A sewn edge edit must not be thrown away when strict native seam matching
  // is enabled. Retain the actual proposed polygon until the user explicitly
  // accepts easing; clicking Accept commits THAT curve, no second drag needed.
  const [pendingCurveCommit,setPendingCurveCommit] = useState(null)
  const [mirrorFreeCurve,setMirrorFreeCurve] = useState(true)
  const [showRedDartGuides,setShowRedDartGuides] = useState(true)
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
  const [hoveredGuideGeometry,setHoveredGuideGeometry] = useState(null)
  // A curved drafting reference is NOT a native sewn edge. Store its
  // independent half-interval control in the local editor, scoped to the
  // material template; leave the Rust garment and the cutline untouched.
  const halfCurveKey=`exo-v2-half-curves:${s?.template?.id||s?.template?.name||'unnamed'}`
  const [guideHalfCurves,setGuideHalfCurves]=useState({})
  const [guideHalfCurveDraft,setGuideHalfCurveDraft]=useState(null)
  const guideHalfCurveDrag=useRef(null)
  useEffect(()=>{
    let restored={}
    try{
      const parsed=JSON.parse(localStorage.getItem(halfCurveKey)||'{}')
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))
        restored=Object.fromEntries(Object.entries(parsed).filter(([id,p])=>
          /:(chest|belly):\d+:(left|right)$/.test(id)&&
          Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<.5)))
    }catch{}
    setGuideHalfCurves(restored)
    setGuideHalfCurveDraft(null)
    guideHalfCurveDrag.current=null
  },[halfCurveKey])
  const [showReferenceGuides, setShowReferenceGuides] = useState(true)
  const [showInternalLines,setShowInternalLines] = useState(true)
  const [showNativeNotches, setShowNativeNotches] = useState(true)
  const [showNativeAllowances, setShowNativeAllowances] = useState(true)
  const [precisionDrafting,setPrecisionDrafting]=useState(true)
  const [autoFocusDrafting,setAutoFocusDrafting]=useState(true)
  const [editPatternHintDismissed,setEditPatternHintDismissed]=useState(false)
  const [contextNodesInEdit,setContextNodesInEdit]=useState(true)
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
  // A hover acquired in Select mode must never survive into sewing, notch,
  // allowance, point or free-drawing tools and steal their next click.
  useEffect(()=>{
    setHoveredGuideId(null)
    setHoveredGuideGeometry(null)
  },[tool2d,mode,busy,showReferenceGuides,showInternalLines])
  const curveEditing = ['point','curve'].includes(tool2d)
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
    if(busy || mode!=='edit' || !['select','point','curve'].includes(tool2d) ||
      !(showReferenceGuides||showInternalLines))return null
    // Lower hem references can lie within the broad native boundary hit
    // stroke. Give the precise nearby guide priority in Select mode; active
    // Notch/Seam Allowance/Sew tools still own boundary editing.
    // Graphic print hit boxes often overlap chest/belly construction guides.
    // They own CLICK/DRAG, but their transparent rect must not suppress the
    // underlying guide's independent blue HOVER.
    if(event.target?.closest?.('[data-control-point],[data-2d-marquee-move],[data-2d-rotate]'))return null
    const canvas=svg.current
    if(!canvas)return null
    // Reference strokes have a deliberately generous screen-pixel search
    // radius. Never let a guide on an underlying/hidden pattern win through
    // the topmost real fabric at the cursor, or select off-paper ghost lines.
    const location=point(event)
    const visiblePanel=location&&panelAt(location)
    if(!visiblePanel)return null
    let best=null,smallest=7
    for(const group of canvas.querySelectorAll('[data-guide-id]')){
      const id=group.getAttribute('data-guide-id')
      const panelId=group.getAttribute('data-guide-panel')
      if(!id||panelId!==visiblePanel)continue
      const geom=guideGeometryAt(group,canvas,event.clientX,event.clientY)
      if(!geom)continue
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
  const beginGuideHalfCurve = event => {
    if(busy||event.button!==0||mode!=='edit'||tool2d!=='curve')return false
    if(event.target?.closest?.('[data-control-point],[data-side-edit-station],[data-2d-edge-hit],[data-internal-curve-hit],[data-native-pom]'))return false
    const guide=findGuideUnderPointer(event)
    if(!guide||!['chest','belly'].includes(guide.kind)||guide.points?.length!==2)return false
    const group=[...(svg.current?.querySelectorAll('[data-guide-id]')||[])]
      .find(e=>e.getAttribute('data-guide-id')===guide.id)
    const line=group?.querySelector('polyline[data-guide-curve],line')
    const matrix=line?.getScreenCTM()
    if(!matrix)return false
    const endpoints=guide.points.map(([x,y])=>{
      const p=svg.current.createSVGPoint();p.x=x;p.y=y
      return p.matrixTransform(matrix)
    })
    // Shared midpoint and physical side anchors remain owned by the actual
    // pattern point/side-curve tools, never by a fake guide control.
    if(endpoints.some(p=>Math.hypot(p.x-event.clientX,p.y-event.clientY)<10))return false
    const start=point(event)
    const panel=s?.template?.panels?.find(p=>p.id===guide.panelId)
    if(!start||!panel)return false
    const angle=(panel.layout_rotation_degrees||0)*Math.PI/180
    const initial=guideHalfCurves[guide.id]||[0,0]
    guideHalfCurveDrag.current={id:guide.id,initial,start,angle,pointerId:event.pointerId}
    setGuideHalfCurveDraft({id:guide.id,offset:initial})
    setSelectedGuide(guide)
    pick({panel:guide.panelId})
    event.preventDefault();event.stopPropagation()
    svg.current?.setPointerCapture(event.pointerId)
    return true
  }
  const moveGuideHalfCurve = event => {
    const d=guideHalfCurveDrag.current
    if(!d||d.pointerId!==event.pointerId)return false
    const q=point(event)
    if(!q)return true
    const dx=q[0]-d.start[0],dy=q[1]-d.start[1],c=Math.cos(d.angle),s=Math.sin(d.angle)
    const offset=[d.initial[0]+dx*c+dy*s,d.initial[1]-dx*s+dy*c]
      .map(v=>Math.max(-.2,Math.min(.2,v)))
    setGuideHalfCurveDraft({id:d.id,offset})
    return true
  }
  const finishGuideHalfCurve = (event,cancelled=false) => {
    const d=guideHalfCurveDrag.current
    if(!d||event.pointerId!==d.pointerId)return false
    guideHalfCurveDrag.current=null
    if(!cancelled){
      const proposed=guideHalfCurveDraft?.id===d.id?guideHalfCurveDraft.offset:d.initial
      const next={...guideHalfCurves,[d.id]:proposed}
      setGuideHalfCurves(next)
      try{localStorage.setItem(halfCurveKey,JSON.stringify(next))}catch{}
    }
    setGuideHalfCurveDraft(null)
    try{svg.current?.releasePointerCapture(event.pointerId)}catch{}
    return true
  }
  const selectGuideUnderPointer = event => {
    if(busy||mode!=='edit'||tool2d!=='select'||!(showReferenceGuides||showInternalLines))
      return false
    // Unlike hover, clicking the transparent graphic bounds must continue to
    // select/drag that print rather than hijacking the click for a guide.
    if(event.target?.closest?.('[data-2d-graphic-hit],[data-2d-graphic-item]'))return false
    // Keep click identity consistent with the segment already highlighted on
    // hover. Native hem outlines often overlap both reference hit ranges.
    const location=point(event)
    const visiblePanel=location&&panelAt(location)
    const hoveredGroup=hoveredGuideId&&[...(svg.current?.querySelectorAll('[data-guide-id]')||[])]
      .find(group=>group.getAttribute('data-guide-id')===hoveredGuideId&&
        group.getAttribute('data-guide-panel')===visiblePanel)
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
  const sewingOverlayVisible = sewingActive || editSewingActive
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
  const avatarVisible = !precisionDrafting && showAvatar && showSilhouette && viewPreset === 'FRONT' && s?.avatar?.positions?.length > 0
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
    const pad=precisionDrafting?.065:.22
    const w=Math.max(precisionDrafting?.32:.9,b.maxX-b.minX+pad*2),h=Math.max(precisionDrafting?.32:.9,b.maxY-b.minY+pad*2)
    const aspect=canvasSize[0]/Math.max(1,canvasSize[1])
    const width=Math.max(w,h*aspect),height=width/aspect
    setView([(b.minX+b.maxX-width)/2,(b.minY+b.maxY-height)/2,width,height])
  }
  const previousEditingTool=useRef(null)
  useEffect(()=>{
    if(previousEditingTool.current!==tool2d&&['point','curve'].includes(tool2d)&&precisionDrafting)
      setAutoFocusDrafting(true)
    previousEditingTool.current=tool2d
  },[tool2d,precisionDrafting])
  const initialized = useRef(null)
  useEffect(()=>{
    if(!autoFocusDrafting||!precisionDrafting||!panels.length)return
    focus(Boolean(selection?.panel))
    setAutoFocusDrafting(false)
  },[autoFocusDrafting,precisionDrafting,canvasSize[0],canvasSize[1],panels.length])
  useEffect(()=>{
    const key=s?.template?.id ?? s?.template?.name ?? null
    if(key !== initialized.current && panels.length){
      initialized.current=key
      focus()
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
  const editingPolygon = panel => {
    const polygon=panel.polygon
    const n=polygon?.edges?.length||0
    const anchor=selection?.panel===panel.id&&Number.isInteger(selection?.anchor)?selection.anchor:null
    const edges=anchor!==null?[polygon.edges[anchor],polygon.edges[(anchor+n-1)%n]]:
      selection?.panel===panel.id&&selection?.edge?[selection.edge]:[]
    return patternEditingControls(polygon,edges)
  }
  // Rust validates sewn arclengths for EVERY contour changed by a gesture.
  // New knots and dragged physical vertices must use the same explicit
  // Shape + seam-ease workflow as cubic handles (previously they bypassed it
  // and silently snapped back at sides/shoulders).
  const applyOrStagePatternCurve = async (panel,polygon,primaryEdge) => {
    if(!polygon||!panel?.polygon)return false
    const original=panel.polygon,n=original.edges?.length||0
    const changedEdges=new Set([primaryEdge].filter(Boolean))
    for(let i=0;i<n;i++){
      const edge=original.edges[i],next=(i+1)%n
      if(JSON.stringify(original.curves?.[edge])!==JSON.stringify(polygon.curves?.[edge])||
        JSON.stringify(original.free_curve_points?.[edge])!==JSON.stringify(polygon.free_curve_points?.[edge])||
        JSON.stringify(original.points?.[i])!==JSON.stringify(polygon.points?.[i])||
        JSON.stringify(original.points?.[next])!==JSON.stringify(polygon.points?.[next]))
        changedEdges.add(edge)
    }
    const strict=(s?.template?.seams||[]).filter(seam=>!seam.allow_ease&&
      [seam.a,seam.b].some(b=>b?.panel===panel.id&&changedEdges.has(b.edge)))
    if(strict.length&&onEnableCurveSeamEase){
      setPendingCurveCommit({panelId:panel.id,edge:primaryEdge,polygon,
        affectedEdges:[...changedEdges],revision:s.revision,
        strictSeams:strict.map(seam=>seam.id)})
      setHandlePreview({panelId:panel.id,anchor:`proposal:${primaryEdge}`,polygon})
      setFreeCurveStatus('The yellow paper shape is a pending proposal, not yet sewn. Click Apply this curve to update the required sewing relationships and rebuild the actual pattern.')
      return false
    }
    const ok=await edit({kind:'Shape',panel:panel.id,polygon})
    setHandlePreview(null)
    setPendingCurveCommit(null)
    setFreeCurveStatus(ok?'':'Native Rust rejected the shape; original fabric retained. Inspect sewn edges or adjust the curve.')
    return Boolean(ok)
  }
  const start = (e, panel, anchor, kind='move', handle=null) => {
    if (busy || ['sew', 'pen', 'line'].includes(mode) || e.button !== 0) return
    if (anchor === undefined && !transform2d) {
      // Point and curve tools select the fabric without translating it.
      e.stopPropagation()
      pick({panel: panel.id})
      return
    }
    if(typeof anchor==='string'&&anchor.startsWith('c:'))panel={...panel,polygon:editingPolygon(panel)}
    const startPoint = point(e)
    if (!startPoint) return
    // Own the pointer gesture; browser text/image drag can cancel pointerup
    // after selection changes between consecutive curve-handle edits.
    e.preventDefault()
    e.stopPropagation()
    setPendingCurveCommit(null)
    setHandlePreview(null)
    svg.current.setPointerCapture(e.pointerId)
    const entry=panels.find(item => item.panel.id===panel.id)
    const b=getBounds(entry?.points)
    drag.current = {panel, anchor, start: startPoint, kind, handle, bounds:b,
      breakTangents:e.altKey, snapAngle:e.shiftKey, controlScale:Number(e.currentTarget.dataset.controlScale)||1}
    setPreview(null)
    pick({panel: panel.id,...(typeof anchor==='string'&&(anchor.startsWith('c:')||anchor.startsWith('f:')||anchor.startsWith('ft:'))
      ?{edge:anchor.split(':')[1]}:
      Number.isInteger(anchor)&&curveEditing?{edge:panel.polygon?.edges?.[anchor]}:{}),
      // An old numeric vertex selection must not override a newly pressed
      // Bézier handle on another edge. That stale anchor caused side/hem
      // handles to disappear while the geometry was being dragged.
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
        const delta=[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)].map(v=>v/(d.controlScale||1))
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
            {breakTangents:e.altKey,snapAngle:e.shiftKey,mirrorTangents:false,
              mirrorAcrossPattern:mirrorFreeCurve})
        })():null
        setHandlePreview({panelId:d.panel.id,anchor:d.anchor,delta,polygon})
      }
      return
    }
    if(Number.isInteger(d.anchor)&&curveEditing){
      const q=point(e)
      if(q){
        const a=-(d.panel.layout_rotation_degrees||0)*Math.PI/180
        const dx=q[0]-d.start[0],dy=q[1]-d.start[1]
        const delta=[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)].map(v=>v/(d.controlScale||1))
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
  const up = async e => {
    const d = drag.current
    drag.current = null
    setPreview(null)
    const shapeGesture=typeof d?.anchor==='string'&&/^(c|f|ft|l):/.test(d.anchor)
    if(!shapeGesture)setHandlePreview(null)
    if (!d) return
    const q = point(e)
    if (!q){setHandlePreview(null);return}
    const delta = q.map((n, i) => n - d.start[i])
    if (Math.hypot(...delta) < .002) {
      if (d.pan && d.background) pick(null)
      if(d.stationDraft){
        // A click creates the side's actual free-knot geometry at exactly the
        // belly/intermediate guide intersection; the next drag edits it.
        await applyOrStagePatternCurve(d.originalPanel,d.panel.polygon,d.stationEdge)
      }else setHandlePreview(null)
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
      const local = [delta[0] * Math.cos(a) - delta[1] * Math.sin(a), delta[0] * Math.sin(a) + delta[1] * Math.cos(a)].map(v=>v/(d.controlScale||1))
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
            {breakTangents:e.altKey,snapAngle:e.shiftKey,mirrorTangents:false,
              mirrorAcrossPattern:mirrorFreeCurve})
          if(!polygon)return
        }
        await applyOrStagePatternCurve(d.originalPanel||d.panel,polygon,identifier)
      } else {
        const origin = d.panel.polygon?.points?.[d.anchor]
        if(origin&&curveEditing){
          const polygon=previewPatternAnchorMove(d.panel.polygon,d.anchor,local)
          if(polygon)await applyOrStagePatternCurve(d.panel,polygon,d.panel.polygon.edges[d.anchor])
        }else if(origin)edit({kind:'Anchor',panel:d.panel.id,anchor:d.anchor,
          position:origin.map((n,i)=>n+local[i])})
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
  const nativeCursor = busy ? 'default' : mode==='edit' && tool2d==='point' ? 'default' : sewingActive || editSewingActive ? SEWING_CURSOR :
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
    data-precision-drafting={String(precisionDrafting)}
    style={{position: 'relative', background: PATTERN_VISUAL.canvas}}>
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
    {mode==='edit'&&tool2d==='point'&&!precisionDrafting&&!editPatternHintDismissed&&<div className="cc-native-free-curve-guide cc-pattern-compact-hint" data-edit-pattern-guide="true">
      <strong>Edit Pattern</strong>
      <span>Click a point: incoming + outgoing handles appear automatically. Drag either endpoint to curve the pattern. Option-drag breaks tangents; Shift snaps angles.</span>
      <button type="button" aria-label="Dismiss Edit Pattern hint" onClick={()=>setEditPatternHintDismissed(true)}>×</button>
    </div>}
    {mode==='edit'&&tool2d==='curve'&&<div className="cc-native-free-curve-guide" data-free-curve-tool-guide="true">
      <strong>Edit Curve Point</strong>
      <span>Drag either half of the chest or belly guide to curve ONLY that point-to-point construction interval (saved locally, not sewn) · Drag coral side dots or orange knots to reshape the actual cutline · Apply sewn cutlines to update 3D · Live edge lengths appear during curve edits</span>
      <label><input type="checkbox" checked={mirrorFreeCurve}
        onChange={event=>{setMirrorFreeCurve(event.target.checked);setPendingCurveCommit(null);setHandlePreview(null);setFreeCurveStatus('')}}/>
        Link mirrored points on symmetric edges</label>
      <label><input type="checkbox" checked={showRedDartGuides}
        onChange={event=>setShowRedDartGuides(event.target.checked)}/>
        Red short point markers (construction only)</label>
      {selection?.panel&&selection?.edge&&(()=>{
        const staged=pendingCurveCommit?.panelId===selection.panel&&
          pendingCurveCommit.edge===selection.edge?pendingCurveCommit:null
        const strict=(s?.template?.seams||[]).filter(seam=>!seam.allow_ease&&(
          staged?staged.strictSeams.includes(seam.id):
          [seam.a,seam.b].some(boundary=>boundary?.panel===selection.panel&&boundary?.edge===selection.edge)))
        if(!strict.length)return null
        return <div data-curve-strict-seams={strict.map(seam=>seam.id).join(' ')}>
          <small>Attached sewn edge: {strict.map(seam=>seam.id).join(', ')}. A reshaped curve can change the seam length, which Rust normally rejects.</small>
          {onEnableCurveSeamEase&&<button type="button" disabled={busy}
            data-enable-curve-seam-ease={selection.panel+':'+selection.edge}
            onClick={async()=>{
              const ok=await onEnableCurveSeamEase({panelId:selection.panel,edge:selection.edge,
                mirror:staged?.mirror??mirrorFreeCurve,
                polygon:staged?.polygon,expectedRevision:staged?.revision,
                affectedEdges:staged?.affectedEdges})
              if(ok){setPendingCurveCommit(null);setHandlePreview(null)}
              setFreeCurveStatus(ok
                ?staged?'Native Rust committed this curve and enabled seam easing. Save/reopen will preserve the reshaped cutline. Undo is available.'
                  :'Seam easing explicitly enabled for this sewn boundary. You can now drag its curves.'
                :'The sewing permission or curve commit was not accepted. The shape was not saved; check the error and retry or Undo any sewing changes.')
            }}>{pendingCurveCommit?.panelId===selection.panel&&pendingCurveCommit.edge===selection.edge
              ?'Apply this yellow curve and allow seam easing'
              :'Allow different sewn-edge lengths so this curve can be edited'}</button>}
        </div>
      })()}
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
      <button type="button" aria-label="Precision drafting" title="Enlarge pattern drawing, remove avatar and reduce clutter" aria-pressed={precisionDrafting} className={precisionDrafting?'active':''} onClick={()=>{setPrecisionDrafting(value=>!value);setAutoFocusDrafting(!precisionDrafting);setEditPatternHintDismissed(true)}}>CAD</button>
      <button type="button" aria-label="Show contextual pattern nodes" title="Show compact geometry knots on non-selected patterns while editing" aria-pressed={contextNodesInEdit} className={contextNodesInEdit?'active':''} onClick={()=>setContextNodesInEdit(value=>!value)}>PTS</button>
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
      style={{background: PATTERN_VISUAL.canvas,cursor:nativeCursor||undefined}}
      aria-label="Metric 2D pattern board with linked sewing and measurements" data-native-tool={tool2d}
      onPointerDownCapture={event=>{
        markCanvas(event)
        beginGuideHalfCurve(event)
      }}
      onPointerMoveCapture={event=>{
        const guide=findGuideUnderPointer(event)
        setHoveredGuideId(guide?.id||null)
        setHoveredGuideGeometry(guide&&['chest','belly'].includes(guide.kind)?guide:null)
      }}
      onPointerLeave={()=>{setHoveredGuideId(null);setHoveredGuideGeometry(null)}}
      onClickCapture={e=>{
        if(selectGuideUnderPointer(e))return
        if(busy||tool2d!=='pleat'||mode!=='edit')return
        const p=point(e),panelId=p&&panelAt(p)
        e.stopPropagation();e.preventDefault()
        if(panelId){pick({panel:panelId});window.dispatchEvent(new CustomEvent('exo-clothcraft-pleat-target',{detail:{panelId}}))}
      }}
      onDoubleClickCapture={e=>{
        if(tool2d!=='select'||mode!=='edit')return
        const guide=findGuideUnderPointer(e)
        if(guide){e.stopPropagation();void createNativeLineFromGuide(guide);setSelectedGuide(null)}
      }}
      onClick={e => {if (!busy && (isDrawing || measuring)) e.stopPropagation()}}
      onPointerMove={e=>{
        if(moveGuideHalfCurve(e))return
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
        if(finishGuideHalfCurve(e))return
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
      }} onPointerCancel={e => {finishGuideHalfCurve(e,true);foamDrag.current=null;setFoamPreview(null);vectorDrag.current=null;setPencilSamples([]);graphicDrag.current=null;setGraphicPreview(null);tapeDrag.current=null;drag.current = null;setPreview(null);setHandlePreview(null)}}
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
            stroke={PATTERN_VISUAL.gridMinor} strokeWidth=".45" vectorEffect="non-scaling-stroke"/>
        </pattern>
        <pattern id={`${uid}-major`} width={gridMajorStep} height={gridMajorStep} patternUnits="userSpaceOnUse">
          <path d={`M ${gridMajorStep} 0 L 0 0 0 ${gridMajorStep}`} fill="none"
            stroke={PATTERN_VISUAL.gridMajor} strokeWidth=".65" vectorEffect="non-scaling-stroke"/>
        </pattern>
      </defs>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={PATTERN_VISUAL.canvas} pointerEvents="none"/>
      {showGrid&&<rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-minor)`} opacity={viewPreset==='GRID'?1:.6} pointerEvents="none"/>}
      {showGrid&&<rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-major)`} opacity={viewPreset==='GRID'?1:.65} pointerEvents="none"/>}
      <PatternReferenceImageLayer image={reference.image} setImage={reference.setImage} unitsPerCm={.01}
        interactive={!busy && tool2d === 'select' && mode === 'edit'}/>
      {!precisionDrafting&&<line x1={view[0]-view[2]} x2={view[0]+view[2]*2} y1=".76" y2=".76" stroke="#9aaeb3" strokeWidth=".6" opacity=".5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
      {!precisionDrafting&&<line x1="0" x2="0" y1={view[1]-view[3]} y2={view[1]+view[3]*2} stroke="#424b4f" strokeWidth=".8" opacity=".4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
      {!precisionDrafting&&<g pointerEvents="none" fontSize=".022" fill="#6c8188">
        <text x=".02" y=".745">X</text><text x=".015" y=".805">Y</text>
      </g>}
      {avatarVisible && s?.avatar?.triangles?.length > 0 && <g opacity=".42" transform={`translate(${avatarAnchorX} ${avatarAnchorY})`} aria-label="Centered front avatar silhouette"
        data-registered-shoulder-y={originalAlignment.current?.shoulderY} data-avatar-anchor-x={avatarAnchorX} data-avatar-anchor-y={avatarAnchorY}>
        <ClothCraftStudioSilhouette avatar={s.avatar}
          onPick={!busy&&!['pen','line','sew'].includes(mode)?onAvatarPick:undefined}/>
      </g>}
      <g transform={`translate(${offset[0]} ${offset[1]})`}>
      {panels.map(({panel, range, color, points}, panelIndex) => {
        const selected = selection !== undefined ? selection?.panel === panel.id : active?.panel === panel.id
        const currentPreview=preview?.panelId===panel.id ? preview : null
        const livePoints=points.map(p=>previewPoint(p,currentPreview))
        const nativePaperPath=trianglePath((s.triangles || []).slice(...range.triangles),boardUV)
        const editablePreview=handlePreview?.panelId===panel.id&&handlePreview.polygon
          ||pendingCurveCommit?.panelId===panel.id&&pendingCurveCommit.polygon||null
        const shapePath=editablePreview?proposedPaperOutline(panel,range,editablePreview,currentPreview)||nativePaperPath:nativePaperPath
        const clipId=`${uid}-pattern-${panelIndex}`
        const labelBounds=getBounds(livePoints)
        const label=[labelBounds.cx,labelBounds.maxY+16*screenUnit]
        return <g key={panel.id} data-2d-pattern-piece={panel.id} data-2d-pattern-selected={String(selected)}
          onPointerEnter={() => hover({panel: panel.id})} onPointerLeave={() => hover(null)}>
          <defs><clipPath id={clipId}><path d={shapePath}/></clipPath></defs>
          {/* CLO drafting paper: a soft selected surface and an opaque white
              unselected surface, independent of physical fabric tint. */}
          <path data-panel={panel.id} data-pattern-surface="drafting-paper"
            data-paper-preview-state={editablePreview?'uncommitted-curve':'native-mesh'} d={shapePath}
            fill={selected?PATTERN_VISUAL.selectedPaper:PATTERN_VISUAL.paper}
            fillOpacity={reference.image?.visible===false||!reference.image?1:.26}
            style={{cursor:busy?'default':nativeCursor||(transform2d?cursorForTool('move'):'default')}}
            onPointerDown={e => {if (tool2d === 'annotation'||editSewingActive) e.stopPropagation(); else start(e, panel)}}
            onClick={e => {if(editSewingActive){e.stopPropagation();return}if (!createAnnotation(e,panel,range)) {e.stopPropagation();
              if(mode==='edit'&&tool2d==='point'&&panel.polygon?.points?.length){
                const click=point(e),vertices=panel.polygon.points.map(uv=>transform(panel,range,uv))
                const index=click?vertices.findIndex(uv=>Math.hypot(uv[0]-click[0],uv[1]-click[1])<=13*screenUnit):-1
                pick({panel:panel.id,...(index>=0?{anchor:index,edge:panel.polygon.edges[index]}:{})})
              }else pick({panel: panel.id})}}}/>
          {/* Drafting references are a PAPER underlay. The authored cutline,
              notch marks and native entities later in this panel must retain
              visual priority. Reference hits are resolved at the SVG root,
              not by overpainting or intercepting native boundary clicks. */}
          {(showReferenceGuides||mode==='edit') && <g data-2d-reference-layer={panel.id} opacity={selected?.97:.86}>
            <ConstructionGuides panel={panel} range={range} boundaries={range.boundaries}
              uv={boardUV} triangles={(s.triangles||[]).slice(...range.triangles)}
              clipId={clipId} preview={currentPreview}
              showNotchReferences={showNativeNotches}
              onSelectGuide={!busy&&mode==='edit'&&tool2d==='select'?selectConstructionGuide:null}
              onCreateGuideLine={!busy&&mode==='edit'&&tool2d==='select'?createNativeLineFromGuide:null}
              screenUnit={screenUnit} selectedGuide={selectedGuide} hoveredGuideId={hoveredGuideId}
              curveMode={mode==='edit'&&tool2d==='curve'}
              curveOffsets={guideHalfCurves} curveDraft={guideHalfCurveDraft}
              nativeCornerNodesVisible={tool2d==='select'||
                (mode==='edit'&&['point','curve'].includes(tool2d)&&
                  (selected||contextNodesInEdit))}
              editableSideStations={tool2d==='curve'&&mode==='edit'}/>
          </g>}
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
                  width={w} height={h} enabled={showGraphicMeasurements} screenUnit={screenUnit}/>}
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
              <rect data-annotation-background="true" x={tx-5*screenUnit} y={ty-13*screenUnit} width={Math.max(30,note.text.length*6.6+10)*screenUnit} height={19*screenUnit} rx={2*screenUnit} fill="#ffffff" fillOpacity=".92" stroke="#b5b9bd" strokeWidth=".65" vectorEffect="non-scaling-stroke"/>
              <text x={tx} y={ty} fontSize={11*screenUnit} fontFamily="Arial,sans-serif" fill="#42484f" pointerEvents="none">{note.text}</text>
            </g>
          })}
          {selected && transform2d && <SelectionMarquee2D
            points={livePoints} panel={panel} onStart={start} disabled={busy} screenUnit={screenUnit}/>}
          {Object.entries(range.boundaries || {}).map(([edge, indices]) => {
            const linkedSeams=(s?.template?.seams||[]).filter(seam=>[seam.a,seam.b].some(side=>side?.panel===panel.id&&side.edge===edge))
            const editingSeam=editSewingActive&&linkedSeams.length>0
            const selectedSeamEdge=editSewingActive&&linkedSeams.some(seam=>seam.id===selection?.seamId)
            const paths=boundarySegments(indices,boardUV).map(points=>points.map(p=>p.join(',')).join(' '))
            const selectedEdge=selected && selection?.edge === edge
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
                // Select an actual named cutline before inserting material
                // knots. Previously EVERY click inserted a new free knot,
                // repeatedly rebuilding side panels when the user only meant
                // to choose an edge or its existing Bézier handles.
                const alreadySelected=selection?.panel===panel.id&&selection?.edge===edge
                pick({panel:panel.id,edge})
                if(!alreadySelected&&!e.shiftKey){
                  setFreeCurveStatus('Edge selected. Drag its yellow handles, or click the same edge again to insert a curve point.')
                  return
                }
                const xy=point(e)
                if(!xy||!panel.polygon)return
                const angle=(panel.layout_rotation_degrees||0)*Math.PI/180
                const dx=xy[0]-range.layout[0],dy=xy[1]-range.layout[1]
                const local=[dx*Math.cos(angle)+dy*Math.sin(angle),-dx*Math.sin(angle)+dy*Math.cos(angle)]
                const nearest=closestFreeCurveParameter(panel.polygon,edge,local)
                if(!nearest)return
                if(nearest.distance>Math.max(.003,10*screenUnit)){
                  setFreeCurveStatus('Add points on the actual cutline, not on nearby material or an old preview.')
                  return
                }
                const mirrored=mirrorFreeCurve?addNativeFreeCurvePoint(panel.polygon,edge,nearest.t,{mirror:true}):null
                // Center seams, asymmetric cuts and many independent collars
                // have no mirrored edge. Editing must still work there.
                const added=mirrored||addNativeFreeCurvePoint(panel.polygon,edge,nearest.t,{mirror:false})
                if(added){
                  setFreeCurveStatus(mirrorFreeCurve&&!mirrored?'No symmetric partner for this edge; curve point added independently.':'')
                  void applyOrStagePatternCurve(panel,added.polygon,edge)
                }else setFreeCurveStatus('Choose another position on the edge; a nearby point may already exist.')
                return
              }
              if(!editConstructionEdge(e,panel,edge,indices)&&!splitBoundary(e,panel,edge,indices))pick({panel:panel.id,edge})
            }
            return <g key={edge}>
              {paths.map((path,i)=>{
                const hovered=active?.panel===panel.id&&active?.edge===edge
                const curveFocused=mode==='edit'&&curveEditing&&selectedEdge
                const curveHovered=mode==='edit'&&tool2d==='curve'&&hovered
                const presentation=patternCutlinePresentation({selected,selectedEdge:selectedEdge||selectedSeamEdge,hovered,expressive:firstSewEdge})
                return <polyline key={i} points={path} fill="none" pointerEvents="none"
                  {...presentation}
                  stroke={curveFocused||curveHovered?CLO_CURVE_ACTIVE_YELLOW:hovered?CLO_HOVER_BLUE:presentation.stroke}
                  strokeWidth={curveFocused||curveHovered?2.5:hovered?2.2:presentation.strokeWidth}
                  data-active-curve-edge={String(Boolean(curveFocused||curveHovered))}
                  data-cutline-hover-blue={String(Boolean(hovered&&!curveFocused&&!curveHovered))}
                  data-sew-edge-state={sewingActive?(firstSewEdge?'first':hoverSewEdge?'hover':'eligible'):undefined}/>
              })}
              {paths.map((path,i)=><polyline key={i} data-edge={`${panel.id}:${edge}`} data-2d-edge-hit={`${panel.id}:${edge}`}
                data-segment-sew-candidate={segmentSewing?'true':undefined} data-free-sew-candidate={freeSewing?'true':undefined}
                data-edit-sew-candidate={editSewingActive?'true':undefined}
                data-seam-link={editingSeam?linkedSeams.map(item=>item.id).join(' '):undefined}
                points={path} fill="none" stroke="transparent"
                strokeWidth="10" vectorEffect="non-scaling-stroke" pointerEvents="stroke"
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
                const fontSize=11*screenUnit
                const text=`≈ ${(readout.length*100).toFixed(2)} cm`
                const obstacles=(panel.polygon?.points||[]).map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
                for(const [edgeName,controls] of Object.entries(editingPolygon(panel)?.curves||{})){
                  const k=panel.polygon.edges.indexOf(edgeName)
                  controls.forEach((uv,j)=>{
                    const origin=previewPoint(transform(panel,range,panel.polygon.points[(k+j)%panel.polygon.points.length]),currentPreview)
                    obstacles.push(visibleTangent(origin,previewPoint(transform(panel,range,uv),currentPreview),screenUnit).point)
                  })
                }
                const {x,y}=placePatternLabel(readout.midpoint,readout.normal,text,screenUnit,obstacles,
                  [view[0]-offset[0],view[1]-offset[1],view[2],view[3]])
                return <text data-2d-boundary-readout={`${panel.id}:${edge}`}
                  data-2d-readout-approx-cm={(readout.length*100).toFixed(3)}
                  x={x} y={y} textAnchor="middle" fontSize={fontSize}
                  fill="#343b40" stroke="#ffffff" strokeWidth={1.8*screenUnit}
                  paintOrder="stroke" fontWeight="400" pointerEvents="none">
                  {text}
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
                      cx={p[0]} cy={p[1]} r={3.5*screenUnit} stroke="#fff" strokeWidth=".8" vectorEffect="non-scaling-stroke"
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
                {...patternSemanticStroke('notch')} data-pattern-role="notch"
                pointerEvents="none"/>
            })
          })}
          {showNativeAllowances && Object.entries(panel.polygon?.seam_allowances||{}).flatMap(([edge,width])=>{
            const indices=range.boundaries?.[edge]||[]
            if(!Number.isFinite(width)||width<=0)return []
            // Split incomplete cutlines instead of bridging a missing vertex.
            // Corner miters are bounded in preview geometry; Rust owns the
            // actual allowance width and production pattern data.
            return boundarySegments(indices,boardUV).flatMap((run,runIndex)=>{
              const guide=seamAllowancePreviewPoints(run,width)
              if(guide.length<2)return []
              return [<polyline key={`allowance:${edge}:${runIndex}`}
                data-native-allowance={`${panel.id}:${edge}`}
                data-seam-allowance-preview="true"
                points={guide.map(p=>p.join(',')).join(' ')}
                {...patternSemanticStroke('seam-allowance')} data-pattern-role="seam-allowance"
                pointerEvents="none"/>]
            })
          })}
          <text data-pattern-piece-label={panel.id} x={label[0]} y={label[1]} textAnchor="middle" fontSize={10*screenUnit} fill={selected?'#47404a':'#697076'}
            fontWeight="400" paintOrder="stroke" stroke="#fff" strokeWidth={1.5*screenUnit} strokeLinejoin="round"
            opacity={selected?1:.85} pointerEvents="none">{panel.name}</text>
          {showInternalLines&&<NativeInternalLines panel={panel} range={range} preview={currentPreview} screenUnit={screenUnit}
            onSelectGuide={!busy&&mode==='edit'&&tool2d==='select'?selectConstructionGuide:null}
            selectedGuide={selectedGuide} hoveredGuideId={hoveredGuideId}
            curveMode={!busy&&mode==='edit'&&tool2d==='curve'}
            activeInternalLine={activeInternalLine} onSelectCurve={selectNativeCurve}
            onStartTangent={(event,source,anchor)=>start(event,source,anchor)}
            handlePreview={handlePreview}/>}
          {/* Selected guide halves remain visually above prints and their
              transparent graphic-hit rectangles. This is paint only:
              no duplicate hit target and no native internal-line creation. */}
          {hoveredGuideGeometry?.panelId===panel.id&&
            hoveredGuideGeometry.points?.length===2&&
            (()=>{
              const offset=guideHalfCurveDraft?.id===hoveredGuideGeometry.id
                ?guideHalfCurveDraft.offset:guideHalfCurves[hoveredGuideGeometry.id]
              const curve=sampleGuideHalfCurve(...hoveredGuideGeometry.points,offset||[0,0],
                ((panel.layout_rotation_degrees||0)*Math.PI/180)+
                  (currentPreview?.kind==='rotate'?currentPreview.angle:0))
              if(!curve)return null
              const yellow=tool2d==='curve'&&(guideHalfCurveDraft?.id===hoveredGuideGeometry.id||
                selectedGuide?.id===hoveredGuideGeometry.id)
              return <polyline data-frontmost-half-hover={hoveredGuideGeometry.id}
                data-frontmost-hover-curve="true" points={curve.points.map(p=>p.join(',')).join(' ')}
                fill="none" stroke={yellow?CLO_CURVE_ACTIVE_YELLOW:CLO_HOVER_BLUE}
                strokeWidth="3" vectorEffect="non-scaling-stroke"
                strokeLinecap="butt" pointerEvents="none"/>
            })()}
          {showMeasurements && <Dimensions points={livePoints} selected={selected}
            panel={panel} boundaries={range.boundaries} uv={boardUV} clipId={clipId} preview={currentPreview} screenUnit={screenUnit}/>}
          {selected&&mode==='edit'&&curveEditing&&(()=>{
            // CLO-like per-edge measurements appear while an edge is being
            // curved. These are material-space lengths of the exact authored
            // spline proposal, not straight-line chord estimates.
            const livePolygon=editablePreview||panel.polygon
            const rows=curveDraftDimensions(livePolygon)
            const cornerBounds=getBounds(rows.flatMap(row=>[
              [row.bounds.minX,row.bounds.minY],[row.bounds.maxX,row.bounds.maxY]]))
            if(!cornerBounds||!rows.length)return null
            const total=rows.reduce((sum,item)=>sum+item.length,0)
            return <g data-curve-pattern-measurements={panel.id}
              data-measured-native-state={editablePreview?'uncommitted-curve':'native-mesh'}
              data-total-perimeter-cm={(total*100).toFixed(3)} pointerEvents="none">
              {rows.map(row=>{
                const toward=[row.midpoint[0]-cornerBounds.cx,row.midpoint[1]-cornerBounds.cy]
                const span=Math.hypot(...toward)||1
                const projected=[row.midpoint[0]+.013*toward[0]/span,row.midpoint[1]+.013*toward[1]/span]
                const p=previewPoint(transform(panel,range,projected),currentPreview)
                return <text key={row.edge} data-curve-measured-edge={row.edge}
                  data-curve-measured-length-cm={(row.length*100).toFixed(3)}
                  x={p[0]} y={p[1]} fontSize={10*screenUnit}
                  textAnchor="middle" fill="#5c4315" stroke="#fff8db"
                  strokeWidth={3.1*screenUnit} paintOrder="stroke"
                  fontWeight="650">{(row.length*100).toFixed(2)} cm</text>
              })}
              {(()=>{
                const top=previewPoint(transform(panel,range,[cornerBounds.cx,cornerBounds.minY-.044]),currentPreview)
                const base=previewPoint(transform(panel,range,[cornerBounds.cx,cornerBounds.maxY+.048]),currentPreview)
                return <>
                  <text data-curve-width-cm={(cornerBounds.width*100).toFixed(3)}
                    x={top[0]} y={top[1]} textAnchor="middle" fontSize={12*screenUnit}
                    fill="#6c4b18" stroke="#fff7da" strokeWidth={4*screenUnit}
                    paintOrder="stroke" fontWeight="700">
                    Width {(cornerBounds.width*100).toFixed(1)} cm · Height {(cornerBounds.height*100).toFixed(1)} cm
                  </text>
                  <text data-curve-perimeter-cm={(total*100).toFixed(3)}
                    x={base[0]} y={base[1]} textAnchor="middle" fontSize={11*screenUnit}
                    fill="#6c4b18" stroke="#fff7da" strokeWidth={4*screenUnit}
                    paintOrder="stroke">Outline {(total*100).toFixed(2)} cm · 2D cutline</text>
                </>
              })()}
            </g>
          })()}
          {mode==='edit'&&tool2d==='curve'&&/front|back|torso|bodice/i.test(panel.id+' '+panel.name)&&(()=>{
            const angle=(panel.layout_rotation_degrees||0)*Math.PI/180+
              (currentPreview?.kind==='rotate'?currentPreview.angle:0)
            const {local}=patternGuideLocalFrame(boardUV,
              previewPoint(transform(panel,range,[0,0]),currentPreview),angle)
            const outline=Object.values(range.boundaries||{}).flat().map(i=>local[i]).filter(Boolean)
            const b=getBounds(outline)
            if(!b)return null
            const chest=armpitChestReference(panel.polygon)?.y??b.minY+b.height*.46
            const belly=b.minY+b.height*.64
            const stations=torsoSideCurveStations(panel.polygon,chest,belly)
            return <g data-editable-side-stations={panel.id}>
              {stations.map(item=>{
                const p=previewPoint(transform(panel,range,item.position),currentPreview)
                return <g key={item.edge+':'+item.level}
                  data-side-edit-station={panel.id+':'+item.edge+':'+item.level}
                  data-side-edit-station-t={item.t.toFixed(8)}>
                  <circle cx={p[0]} cy={p[1]} r={7.5*screenUnit}
                    fill="transparent" stroke="none" style={{cursor:'crosshair'}}
                    aria-label={item.level==='belly'
                      ?'Add and drag real curve point at belly guide endpoint'
                      :'Add and drag real curve point between chest and belly'}
                    onPointerDown={event=>{
                      if(busy||event.button!==0)return
                      const paired=mirrorFreeCurve
                        ?addNativeFreeCurvePoint(panel.polygon,item.edge,item.t,{mirror:true}):null
                      const added=paired||addNativeFreeCurvePoint(panel.polygon,item.edge,item.t,{mirror:false})
                      if(!added?.mark){setFreeCurveStatus('A curve point already exists nearby, or this side cannot accept another point.');return}
                      start(event,{...panel,polygon:added.polygon},`f:${item.edge}:${added.mark.id}`)
                      if(drag.current){drag.current.stationDraft=true;drag.current.stationEdge=item.edge;drag.current.originalPanel=panel}
                    }}/>
                  <circle cx={p[0]} cy={p[1]} r={4*screenUnit}
                    fill="#fff8db" stroke="#e25532" strokeWidth={1.65}
                    vectorEffect="non-scaling-stroke" pointerEvents="none"/>
                </g>
              })}
            </g>
          })()}
          {mode==='edit'&&showRedDartGuides&&/front|back|torso|bodice/i.test(panel.id+' '+panel.name)&&(()=>{
            // The supplied CLO reference has SHORT RED TICKS extending inward
            // from actual upper-side construction vertices. It does NOT show
            // floating red triangles at arbitrary points across the belly.
            // Use the authored underarm vertices shared by the chest bar.
            const polygon=editablePreview||panel.polygon
            const edges=polygon?.edges||[]
            const left=edges.indexOf('side-left'),right=edges.indexOf('side-right')
            if(left<0||right<0)return null
            const positions=[
              {edge:'side-left',uv:polygon.points[(left+1)%edges.length],direction:1},
              {edge:'side-right',uv:polygon.points[right],direction:-1},
            ]
            if(positions.some(item=>!Array.isArray(item.uv)||item.uv.some(n=>!Number.isFinite(n))))return null
            return <g data-red-dart-guides={panel.id} data-dart-kind="construction"
              data-dart-physical="false" data-dart-style="short-point-tick" pointerEvents="none">
              {positions.map(({edge,uv,direction})=>{
                const a=previewPoint(transform(panel,range,uv),currentPreview)
                const b=previewPoint(transform(panel,range,[uv[0]+direction*.042,uv[1]-.002]),currentPreview)
                return <line key={edge} data-red-dart={panel.id+':'+edge}
                  data-red-dart-anchor-edge={edge}
                  x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                  stroke="#e03c42" strokeWidth="2.75"
                  vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
              })}
            </g>
          })()}
          {/* CLO also leaves context knots visible on unselected pattern
              pieces. Show real authored corners or native boundary endpoints
              in muted grey; selected corners stay dark. These dots never
              acquire pointer events or modify editable geometry. */}
          {(tool2d==='select'||(contextNodesInEdit&&mode==='edit'&&['point','curve'].includes(tool2d)&&!selected)) && (()=>{
            const corners=panel.polygon?.points?.length
              ?panel.polygon.points.map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
              :Object.values(range.boundaries||{}).flatMap(indices=>[
                boardUV[indices[0]],boardUV[indices[indices.length-1]],
              ]).filter(Boolean)
            const unique=corners.filter((p,i)=>corners.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.0005)===i)
            // Keep visible corner marks stable on screen while zooming,
            // rather than allowing them to overwhelm small pieces.
            const radius=pointRadiusInView(selected?PATTERN_METRICS.contextPointRadius:PATTERN_METRICS.inactivePointRadius,screenUnit)
            const appearance=patternPointGlyph('boundary-corner',{state:selected?'normal':'inactive'})
            return unique.map((p,n)=><circle key={n} data-2d-visible-corner={`${panel.id}:${n}`}
              cx={p[0]} cy={p[1]} r={radius} fill={appearance.fill}
              stroke={appearance.stroke} strokeWidth={appearance.strokeWidth} vectorEffect="non-scaling-stroke"
              opacity={appearance.opacity} pointerEvents="none"/>)
          })()}
          {selected && mode === 'edit' && ['point','curve'].includes(tool2d) && panel.polygon?.points?.map((uv, n) => {
            const livePolygon=handlePreview?.panelId===panel.id&&handlePreview.polygon||panel.polygon
            const livePoint=livePolygon.points?.[n]||uv
            const p = previewPoint(transform(panel, range, livePoint),currentPreview)
            const inControl=livePolygon.curves?.[panel.polygon.edges[(n+panel.polygon.points.length-1)%panel.polygon.points.length]]?.[1]||livePoint
            const outControl=livePolygon.curves?.[panel.polygon.edges[n]]?.[0]||livePoint
            const role=vectorcraftAnchorKind(livePoint,inControl,outControl)==='smooth'?'smooth-curve':'boundary-corner'
            const appearance=patternPointGlyph(role,{state:selection?.panel===panel.id&&selection?.anchor===n?'selected':active?.anchor===n?'hovered':'normal'})
            return <circle key={n} data-control-point="vertex" data-pattern-point-role={role} data-panel-id={panel.id}
              data-promoted-vertex-id={panel.polygon?.vertex_ids?.[panel.polygon?.edges?.[n]]||undefined}
              cx={p[0]} cy={p[1]} r={pointRadiusInView(selection?.panel===panel.id&&selection?.anchor===n?PATTERN_METRICS.selectedPointRadius:PATTERN_METRICS.editPointRadius,screenUnit)}
              fill={appearance.fill}
              stroke={appearance.stroke} strokeWidth={appearance.strokeWidth} vectorEffect="non-scaling-stroke" style={{cursor:'default'}}
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
          {selected&&curveEditing&&handlePreview?.panelId===panel.id&&Number.isInteger(handlePreview.anchorIndex)&&
            (()=>{const polygon=handlePreview.polygon,index=handlePreview.anchorIndex
              const uv=polygon?.points?.[index]
              if(!uv)return null
              const p=previewPoint(transform(panel,range,uv),currentPreview)
              return <circle data-pattern-vertex-preview={`${panel.id}:${index}`}
                cx={p[0]} cy={p[1]} r={4*screenUnit} stroke="#7549a2" strokeWidth="1" vectorEffect="non-scaling-stroke"
                fill="#f6d77c" pointerEvents="none"/>
            })()}
          {/* Live native curve preview: dragging a VectorCraft-style handle
              changes the displayed contour immediately, without waiting for
              the next Rust triangulation. Measurements are in material cm. */}
          {selected&&mode==='edit'&&curveEditing&&
            handlePreview?.panelId===panel.id&&handlePreview.anchor?.startsWith('c:')&&
            handlePreview.polygon&&(()=>{
              const polygon=handlePreview.polygon
              const editedEdge=handlePreview.anchor.split(':')[1]
              const baseline=editingPolygon(panel)
              return <g data-native-cubic-preview={panel.id} pointerEvents="none">
                {Object.entries(polygon.curves||{})
                  .filter(([edge,controls])=>edge===editedEdge||
                    JSON.stringify(controls)!==JSON.stringify(baseline.curves?.[edge]))
                  .map(([edge,handles])=>{
                    const index=polygon.edges?.indexOf(edge)??-1
                    if(index<0||!Array.isArray(handles)||handles.length!==2)return null
                    const a=polygon.points[index],b=polygon.points[(index+1)%polygon.points.length]
                    if(![a,b,...handles].every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))return null
                    const [start,c1,c2,end]=[a,handles[0],handles[1],b]
                      .map(uv=>previewPoint(transform(panel,range,uv),currentPreview))
                    const measured=cubicLength(a,handles[0],handles[1],b)
                    return <g key={edge} data-preview-curve-edge={edge}>
                      <path data-active-bezier-contour={`${panel.id}:${edge}`}
                        d={`M ${start[0]} ${start[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`}
                        fill="none" stroke={CLO_CURVE_ACTIVE_YELLOW} strokeWidth="2.25"
                        strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                      {Number.isFinite(measured)&&<text x={(start[0]+end[0])/2} y={(start[1]+end[1])/2-12*screenUnit}
                        data-native-cubic-length-cm={(measured*100).toFixed(3)}
                        textAnchor="middle" fill="#5a4612" stroke="#fff" strokeWidth={2*screenUnit}
                        paintOrder="stroke" fontSize={11*screenUnit}>{(measured*100).toFixed(2)} cm</text>}
                    </g>
                  })}
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
                    strokeWidth={hoveredSplitMirrorGroup===group?1.1:.75} vectorEffect="non-scaling-stroke"
                    strokeDasharray="4 3" opacity={hoveredSplitMirrorGroup===group?1:.7}/>
                })}
              </g>
            })()}
          {mode==='edit'&&['point','curve','split'].includes(tool2d)&&Object.entries(
            handlePreview?.panelId===panel.id&&handlePreview.polygon?.free_curve_points
              ?handlePreview.polygon.free_curve_points:panel.polygon?.free_curve_points||{})
            .filter(([edge])=>tool2d==='split'||(selected&&selection?.edge===edge)||
              (selected&&handlePreview?.panelId===panel.id&&
                /^(f|ft):/.test(handlePreview.anchor||'')&&
                (handlePreview.anchor.split(':')[1]===edge||
                  (handlePreview.polygon?.free_curve_points?.[edge]||[]).some(mark=>
                    mark.mirror_group&&mark.mirror_group===
                    handlePreview.polygon?.free_curve_points?.[handlePreview.anchor.split(':')[1]]
                      ?.find(item=>item.id===handlePreview.anchor.split(':')[2])?.mirror_group))))
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
                const key=`ft:${edge}:${mark.id}:${side}`
                const visual=point?visibleTangent(p,point,screenUnit,drag.current?.anchor===key?drag.current.controlScale:null):null
                return {side,point:visual?.point,scale:visual?.scale}
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
                <circle cx={p[0]} cy={p[1]} r={10*screenUnit}
                  fill="transparent" stroke="none" aria-hidden="true"/>
                {tool2d==='split'&&mark.mirror_group&&<circle cx={p[0]} cy={p[1]} r={7*screenUnit}
                  fill="none" stroke="#ae6a40" strokeWidth=".8" vectorEffect="non-scaling-stroke" strokeDasharray="2 2"
                  opacity={hoveredSplitMirrorGroup===mark.mirror_group?1:.8} pointerEvents="none" aria-hidden="true"/>}
                <circle cx={p[0]} cy={p[1]} r={3.5*screenUnit}
                  fill={tool2d==='split'&&mark.mirror_group?'#fce5ab':'#fceae0'}
                  stroke={mark.mirror_group&&hoveredSplitMirrorGroup===mark.mirror_group?'#a43924':'#d45632'}
                  strokeWidth={mark.mirror_group&&hoveredSplitMirrorGroup===mark.mirror_group?1.25:.9} vectorEffect="non-scaling-stroke" pointerEvents="none" aria-hidden="true"/>
                {curveEditing&&<g data-free-curve-tangent={`${panel.id}:${edge}:${mark.id}`}>
                  {tangents.filter(item=>item.point).map(({side,point:tangent,scale})=><g key={side}>
                    {/* A live tangent owns its own arm. Opposite arms remain
                        independently addressable and never both glow by hover. */}
                    <line x1={p[0]} y1={p[1]} x2={tangent[0]} y2={tangent[1]}
                      stroke={handlePreview?.anchor===`ft:${edge}:${mark.id}:${side}`?CLO_CURVE_ACTIVE_YELLOW:PATTERN_VISUAL.curveArm}
                      strokeWidth={handlePreview?.anchor===`ft:${edge}:${mark.id}:${side}`?2:PATTERN_METRICS.curveArm}
                      vectorEffect="non-scaling-stroke" pointerEvents="none"/>
                    <circle cx={tangent[0]} cy={tangent[1]} r={PATTERN_METRICS.curvePointRadius*screenUnit} data-control-scale={scale}
                      data-active-curve-handle={String(handlePreview?.anchor===`ft:${edge}:${mark.id}:${side}`)}
                      fill={handlePreview?.anchor===`ft:${edge}:${mark.id}:${side}`?'#fef08a':PATTERN_VISUAL.curveControlFill}
                      stroke={handlePreview?.anchor===`ft:${edge}:${mark.id}:${side}`?CLO_CURVE_ACTIVE_YELLOW:PATTERN_VISUAL.curveControlOutline}
                      strokeWidth="1.15" vectorEffect="non-scaling-stroke"
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
          {selected&&mode==='edit'&&curveEditing&&
            handlePreview?.panelId===panel.id&&
            (handlePreview.anchor?.startsWith('f:')||handlePreview.anchor?.startsWith('ft:'))&&(()=>{
              const polygon=handlePreview.polygon
              const [,edge,anchorId]=handlePreview.anchor.split(':')
              if(!polygon?.free_curve_points?.[edge]?.length)return null
              const group=polygon.free_curve_points[edge]?.find(item=>item.id===anchorId)?.mirror_group
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
                    <polyline points={points.map(p=>p.join(',')).join(' ')} fill="none"
                      stroke={CLO_CURVE_ACTIVE_YELLOW} strokeWidth="2.25" vectorEffect="non-scaling-stroke"/>
                    <text x={midpoint[0]} y={midpoint[1]-12*screenUnit} textAnchor="middle"
                      fill="#46536b" stroke="#fff" strokeWidth={2*screenUnit} paintOrder="stroke"
                      fontSize={11*screenUnit} data-native-free-curve-length-cm={(length*100).toFixed(3)}>
                      {(length*100).toFixed(2)} cm
                    </text>
                  </g>
                })}
              </g>
            })()}
          {selected && mode === 'edit' && curveEditing &&
            Object.entries(handlePreview?.panelId===panel.id&&handlePreview.polygon?.curves
              ?handlePreview.polygon.curves:editingPolygon(panel)?.curves || {})
            .filter(([edge])=>Number.isInteger(selection?.anchor)
              ?[panel.polygon.edges[selection.anchor],panel.polygon.edges[(selection.anchor+panel.polygon.edges.length-1)%panel.polygon.edges.length]].includes(edge)
              :selection?.edge===edge||
                (handlePreview?.anchor?.startsWith('c:')&&
                  JSON.stringify(handlePreview.polygon?.curves?.[edge])!==JSON.stringify(panel.polygon.curves?.[edge])))
            .flatMap(([edge, controls]) => controls.map((uv, index) => {
            const edgeIndex=panel.polygon.edges.indexOf(edge)
            const vertex=(edgeIndex+index)%panel.polygon.points.length
            if(Number.isInteger(selection?.anchor)&&vertex!==selection.anchor)return null
            const moved=handlePreview?.panelId===panel.id?handlePreview.polygon?.curves?.[edge]?.[index]||uv:uv
            const original=handlePreview?.panelId===panel.id&&handlePreview.polygon?.points?.[vertex]||
              panel.polygon.points[vertex]
            if(!original)return null
            const anchor=previewPoint(transform(panel,range,original),currentPreview)
            const control=previewPoint(transform(panel,range,moved),currentPreview)
            const key=`c:${edge}:${index}`
            const activeHandle=handlePreview?.panelId===panel.id&&handlePreview.anchor===key
            const selectedEdgeHandle=selection?.edge===edge
            const shown=visibleTangent(anchor,control,screenUnit,drag.current?.anchor===key?drag.current.controlScale:null)
            const p=shown.point
            return <g key={`${edge}-${index}`} data-bezier-arm={`${panel.id}:${edge}:${index}`}>
              <line data-bezier-tangent-line="true" x1={anchor[0]} y1={anchor[1]} x2={p[0]} y2={p[1]}
                stroke={activeHandle||selectedEdgeHandle?CLO_CURVE_ACTIVE_YELLOW:PATTERN_VISUAL.curveArm}
                strokeWidth={activeHandle?2:PATTERN_METRICS.curveArm} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
              <circle data-control-point="curve" data-curve-handle={`${panel.id}:${edge}:${index}`}
                data-active-curve-handle={String(Boolean(activeHandle))}
                data-control-scale={shown.scale} data-bezier-anchor-index={vertex}
                data-panel-id={panel.id} cx={p[0]} cy={p[1]} r={pointRadiusInView(PATTERN_METRICS.curvePointRadius,screenUnit)}
                fill={activeHandle?'#fef08a':PATTERN_VISUAL.curveControlFill}
                stroke={activeHandle||selectedEdgeHandle?CLO_CURVE_ACTIVE_YELLOW:PATTERN_VISUAL.curveControlOutline}
                strokeWidth={activeHandle?1.8:1.2} vectorEffect="non-scaling-stroke"
                style={{cursor:'default'}} aria-label={`${index===0?'Outgoing':'Incoming'} Bézier handle · Option to break tangent · Shift to snap`}
                onClick={e=>e.stopPropagation()}
                onPointerDown={e=>start(e,panel,key)}/>
            </g>
          }))}
        </g>
      })}
      {sewingOverlayVisible && (s?.seams || []).flatMap((seam, i) => {
        const spec = s.template?.seams?.find(item => item.id === seam.id)
        if (!spec) return []
        // A selected *piece* should not flood the board with hundreds of
        // cross-panel correspondence lines. Spotlight full seam structure
        // only when an actual colored boundary is hovered/selected.
        const chosen=editSewingActive&&selection?.seamId===seam.id
        const emphasized = chosen || (!!active?.edge && [spec.a, spec.b].some(b => b?.panel === active.panel && b.edge === active.edge))
        const color = SEAM_COLORS[i % SEAM_COLORS.length]
        const pairs=seam.guides||[]
        // In normal sewing mode show the eligible cutline, not a net of
        // cross-garment threads. The correspondence is a contextual preview
        // of one hovered/selected seam; Edit Sewing can inspect the others.
        if (!emphasized) return []
        return samplePatternSewingGuideIndices(pairs.length,{emphasized}).flatMap(j => {
          const pair=pairs[j]
          const a = weighted(pair[0], boardUV), b = weighted(pair[1], boardUV)
          if (!a || !b) return []
          return <g key={`${seam.id}-${j}`} data-sewing-guide-index={j} pointerEvents="none">
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={emphasized ? '#ef6339' : color}
              strokeWidth={emphasized?1:.65} vectorEffect="non-scaling-stroke" strokeDasharray="4 5" opacity={emphasized ? 1 : .42}/>
            {editSewingActive&&<line data-edit-seam-guide={seam.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
              fill="none" stroke="transparent" strokeWidth=".013" pointerEvents="stroke"
              style={{cursor:SEWING_CURSOR}} onPointerDown={event=>event.stopPropagation()}
              onClick={event=>{event.stopPropagation();onSelectSewingSeam(seam.id)}}/>}
            {showSeamDots && <>
              <circle data-control-point="seam" cx={a[0]} cy={a[1]} r={(emphasized?2.5:1.9)*screenUnit} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
              <circle data-control-point="seam" cx={b[0]} cy={b[1]} r={(emphasized?2.5:1.9)*screenUnit} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
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
          <line x1={locations[0][0]} y1={locations[0][1]} x2={locations[1][0]} y2={locations[1][1]} stroke="#b05b26" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 3"/>
          {locations.map((p,i)=><g key={i} data-native-walk-marker={i}>
            <circle cx={p[0]} cy={p[1]} r={4*screenUnit} fill={i?'#f1c874':'#49a8be'} stroke="#27313a" strokeWidth=".8" vectorEffect="non-scaling-stroke"/>
            <text x={p[0]} y={p[1]-9*screenUnit} fontSize={11*screenUnit} textAnchor="middle" fontWeight="700" fill="#27313a" paintOrder="stroke" stroke="#f4eee7" strokeWidth={2*screenUnit}>{i?'B':'A'}</text>
          </g>)}
        </g>
      })()}
      {(draft.length > 0||pencilSamples.length>0) && <polyline data-vector-draft={tool2d==='vector-pencil'?'pencil':tool2d==='vector-pen'?'pen':'pattern'}
        points={(pencilSamples.length?pencilSamples:draft).map(p => p.join(',')).join(' ')}
        fill="none" stroke="#6888bf" strokeWidth="1.2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
      {tool2d==='vector-pen'&&draft.map((p,i)=>{const t=vectorTangents[i]||[0,0];return <g key={i} data-vector-pen-anchor={i} pointerEvents="none">
        <circle cx={p[0]} cy={p[1]} r={3*screenUnit} fill="#fff" stroke="#6888bf" strokeWidth=".8" vectorEffect="non-scaling-stroke"/>
        {Math.hypot(...t)>.001&&<><line x1={p[0]-t[0]} y1={p[1]-t[1]} x2={p[0]+t[0]} y2={p[1]+t[1]} stroke="#6888bf" strokeDasharray="4 3" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
          <circle cx={p[0]+t[0]} cy={p[1]+t[1]} r={3.5*screenUnit} fill="#fff" stroke="#6888bf" strokeWidth=".8" vectorEffect="non-scaling-stroke"/></>}
      </g>})}
      {measuring && tape.map((p,i)=><circle key={i} data-tape-point={i} aria-label={`Measurement endpoint ${i+1}`} cx={p[0]} cy={p[1]} r={(editingTape?4:3)*screenUnit} fill="#fff" stroke="#166478" strokeWidth=".8" vectorEffect="non-scaling-stroke" pointerEvents={editingTape?'all':'none'} style={{cursor:editingTape?'move':'default'}} onPointerDown={e=>{
        if(!editingTape||busy)return
        e.stopPropagation();e.preventDefault()
        tapeDrag.current={index:i}
        svg.current?.setPointerCapture(e.pointerId)
      }}/>)}
      {measuring && tape.length===2 && <g data-tape-measurement="true" pointerEvents="none">
        <line x1={tape[0][0]} y1={tape[0][1]} x2={tape[1][0]} y2={tape[1][1]} stroke="#166478" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 3"/>
        <text x={(tape[0][0]+tape[1][0])/2} y={(tape[0][1]+tape[1][1])/2-10*screenUnit} textAnchor="middle" fontSize={11*screenUnit} fontWeight="500" fill="#37464d" stroke="#fff" strokeWidth={2*screenUnit} paintOrder="stroke">{formatCm(Math.hypot(tape[1][0]-tape[0][0],tape[1][1]-tape[0][1]))}</text>
      </g>}
      {panels.flatMap(({panel,range})=>(panel.polygon?.measurements||[]).map(measurement=>{
        const a=boundaryMark(range.boundaries?.[measurement.a?.edge]||[],measurement.a?.t)?.p
        const b=boundaryMark(range.boundaries?.[measurement.b?.edge]||[],measurement.b?.t)?.p
        if(!a||!b)return null
        const isSelected=selectedPom?.panel===panel.id&&selectedPom?.id===measurement.id
        return <g key={`${panel.id}:${measurement.id}`} data-native-pom={measurement.id} data-native-pom-panel={panel.id} pointerEvents="none">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={isSelected?'#f68c35':'#126c79'} strokeWidth={isSelected?1.2:.8} vectorEffect="non-scaling-stroke" strokeDasharray="5 3"/>
          {[a,b].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={2.5*screenUnit} fill="#fff" stroke="#126c79" strokeWidth=".8" vectorEffect="non-scaling-stroke"/>)}
          <text x={(a[0]+b[0])/2} y={(a[1]+b[1])/2-10*screenUnit} textAnchor="middle" fontSize={11*screenUnit} fill="#37464d" stroke="#fff" strokeWidth={2*screenUnit} paintOrder="stroke">{measurement.label}: {formatCm(Math.hypot(b[0]-a[0],b[1]-a[1]))}</text>
        </g>
      }))}
      </g>
    </svg>
  </div>
}

import React from 'react'
import {TECHPACK_MIDDLE_TEMPLATES,createTechPackMiddleTemplate} from '../core/techPackMiddleTemplates20261031.js'
import './TechPackMiddleTemplatePreview20261031.css'

/** Inert previews: rectangles represent editable image / swatch slots. */
export default function TechPackMiddleTemplatePreview({templateId='middle-color-details',orientation='portrait',bottomTop=591,paperSize='Letter'}){
  const selected=TECHPACK_MIDDLE_TEMPLATES.find(item=>item.id===templateId)
  if(!selected)return null
  const data=createTechPackMiddleTemplate(templateId,{orientation,bottomTop,paperSize})
  const {width,height}=data.pageSize
  const frameWidth=width-52
  const tableTop=Math.max(200,Math.min(bottomTop,height-157))
  const tableHeight=height-tableTop-62
  return <svg className="tpws-middle-preview" viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`${selected.name} framed Tech Pack page layout preview`}>
    <rect x="26" y="34" width={frameWidth} height={height-86} fill="white" stroke="#202020" strokeWidth="1.5"/>
    <rect x="26" y="34" width={frameWidth} height="72" fill="#fafafa" stroke="#333"/>
    <line x1="26" y1="82" x2={width-26} y2="82" stroke="#bbb"/>
    <text x={width/2} y="99" textAnchor="middle" fontSize="11" fill="#333">TECHNICAL DETAILS</text>
    {data.pageBoxes.map((b,i)=><g key={b.id}>
      <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="2" fill={b.slot.contentType==='swatch'?(b.slot.swatchHex||'#e9e9e7'):'#f7f7f7'} stroke={b.slot.contentType==='swatch'?'#999':'#a2a7ab'} strokeDasharray={b.slot.contentType==='swatch'?undefined:'4 4'}/>
      {b.slot.contentType==='photo'&&<g stroke="#aeb4b8" fill="none" strokeWidth="1.2">
        <rect x={b.x+b.width/2-17} y={b.y+b.height/2-18} width="34" height="29" rx="2"/>
        <circle cx={b.x+b.width/2-7} cy={b.y+b.height/2-9} r="3"/>
        <path d={`M${b.x+b.width/2-14} ${b.y+b.height/2+6} l10 -10 8 7 5 -5 6 8`}/>
      </g>}
      {b.slot.contentType==='photo'&&<text x={b.x+b.width/2} y={b.y+b.height/2+31} textAnchor="middle" fontSize="9" fill="#8c9195">REFERENCE {b.referenceNumber||i+1}</text>}
      {b.slot.contentType==='swatch'&&<text x={b.x+b.width/2} y={b.y+b.height+15} fontSize="8" textAnchor="middle" fill="#51565a">{b.slot.swatchLabel||`SWATCH ${i+1}`}</text>}
    </g>)}
    {data.annotations.map(a=><g key={a.id}>
      <line x1={a.points[0][0]} y1={a.points[0][1]} x2={a.points[1][0]} y2={a.points[1][1]} stroke="#222" strokeWidth="2"/>
      <circle cx={a.points[0][0]} cy={a.points[0][1]} r="12" fill="white" stroke="#222"/>
      <text x={a.points[0][0]} y={a.points[0][1]+4} fontSize="12" textAnchor="middle">{a.label}</text>
      <circle cx={a.points[1][0]} cy={a.points[1][1]} r="3" fill="#222"/>
    </g>)}
    <rect x="39" y={tableTop} width={width-78} height={tableHeight} fill="none" stroke="#ddd" strokeDasharray="5 4"/>
    <text x={width/2} y={tableTop+tableHeight/2} fill="#aaa" fontSize="11" textAnchor="middle">OPTIONAL BOTTOM TABLE</text>
  </svg>
}

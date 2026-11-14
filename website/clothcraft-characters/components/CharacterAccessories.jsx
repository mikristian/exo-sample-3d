import React from 'react'
import {ACCESSORY_COLLECTION} from './characterAccessories.js'
import {UploadedSvgArtwork} from './svgTattooImport.jsx'

// Consistent coordinate system: -25..25 square view space, no images/fonts.
export function AccessoryGlyph({type,color='#ededed',secondary='#9fa7af'}){
  const line={fill:'none',stroke:color,strokeWidth:2.9,strokeLinecap:'round',strokeLinejoin:'round'}
  const metal={fill:'none',stroke:color,strokeWidth:5,strokeLinecap:'round'}
  const second={fill:secondary}
  switch(type){
    case 'sigil':return <g {...line}><path d="M0 -26 V26 M-21 -10 L0 -24 21 -10 0 12 -21 -10Z M-16 20 L0 5 16 20 M-8 -5H8 M-18 2H18"/><circle cx="0" cy="0" r="4" fill={color} stroke="none"/></g>
    case 'bolt':return <path d="M2 -28 L-18 1 H-2 L-9 27 21 -8 H3Z" fill={color}/>
    case 'star':return <path d="M0 -28 L6 -8 24 -21 12 -3 29 0 10 7 22 24 3 12 0 30 -7 10 -24 22 -12 3 -29 0 -10 -7 -22 -24 -3 -12Z" fill={color}/>
    case 'barbed':return <g {...line}><path d="M-27 -8Q-7 -24 10 -8T28 -8 M-27 8 Q-7 -8 10 8T28 8 M-17 -20l8 13 -8 9 M5 -18l10 13 -9 9 M-14 4l8 13 -8 8 M14 3l8 13 -8 9"/></g>
    case 'butterfly':return <g><path d="M-2 -4 C-8 -28 -33 -25 -28 -6 Q-25 6 -5 5 C-30 6 -30 25 -17 25 Q-5 24 -2 7Z" fill={color}/><path d="M2 -4 C8 -28 33 -25 28 -6 Q25 6 5 5 C30 6 30 25 17 25 Q5 24 2 7Z" fill={secondary}/><path d="M0 -16 V20 M0 -10l-9 -14 M0 -10l9 -14" {...line}/></g>
    case 'cross':return <path d="M-7 -27 H7 V-7 H27 V7 H7 V27 H-7 V7 H-27 V-7 H-7Z" fill={color}/>
    case 'crescent':return <path d="M14 -26 A27 27 0 1 0 25 20 A22 22 0 1 1 14 -26Z" fill={color}/>
    case 'serpent':return <g {...line}><path d="M-19 -22 Q28 -29 11 -8 Q-17 9 12 19 Q23 23 8 30 M8 30l-9 -3 M8 30l-1 -10 M-8 -11l6 -4"/><circle cx="-14" cy="-22" r="2.5" fill={color}/></g>
    case 'heart':return <path d="M0 26 C-12 16 -28 4 -26 -12 C-24 -27 -8 -30 0 -16 C8 -30 24 -27 26 -12 C28 4 12 16 0 26Z" fill={color}/>
    case 'rune':return <g {...line}><path d="M-12 -27V26 M-12 -20L18 -2 -12 10 17 26 M-11 -7L13 -23 M-18 26H-5"/></g>
    case 'diamond':return <g><path d="M0 -29 L23 -7 0 28 -23 -7Z" fill={color}/><path d="M0 -29 L10 -7 H-10Z" fill={secondary}/><path d="M-23 -7 H23 L0 28Z" fill={color}/><path d="M-10 -7 H10 L0 28Z" fill={secondary}/></g>
    case 'teardrop':return <g><path d="M0 -30 C6 -15 22 -1 21 12 C20 27 8 30 0 30 C-15 30 -22 20 -21 9 C-20 -3 -5 -18 0 -30Z" fill={color}/><path d="M0 -24 L-8 5 0 24 8 5Z" fill={secondary}/></g>
    case 'trinity':return <g>{[-16,0,16].map((x,i)=><g transform={`translate(${x} ${i===1?-9:6}) scale(${i===1?1:.7})`} key={x}><path d="M0 -21 L12 0 0 22 -12 0Z" fill={color}/><path d="M0 -21 V22 L12 0Z" fill={secondary}/></g>)}</g>
    case 'opal':return <g><circle r="23" fill={color}/><circle r="17" fill={secondary}/><path d="M0 -16L13 0 0 16 -13 0Z" fill={color}/></g>
    case 'gemstar':return <g><path d="M0 -29 L10 -9 30 0 10 9 0 29 -10 9 -30 0 -10 -9Z" fill={color}/><path d="M0 -24 L0 23 L13 0Z" fill={secondary}/></g>
    case 'crystal':return <g><path d="M-17 -22 L13 -26 25 -9 3 28 -23 5Z" fill={color}/><path d="M-17 -22 L-23 5 3 28 -3 -5Z" fill={secondary}/><path d="M-17 -22L-3 -5 13 -26" {...line} strokeWidth="1"/></g>
    case 'brow-hoop':return <g><path d="M-16 -7 A21 21 0 1 1 16 -7" {...metal}/><circle cx="-16" cy="-7" r="5" fill={secondary}/><circle cx="16" cy="-7" r="5" fill={secondary}/></g>
    case 'brow-studs':return <g><circle cx="-13" cy="0" r="8" fill={color}/><circle cx="13" cy="0" r="8" fill={color}/><circle cx="-13" cy="0" r="3" fill={secondary}/><circle cx="13" cy="0" r="3" fill={secondary}/></g>
    case 'hoop':return <g><circle cx="0" cy="1" r="23" {...metal}/><path d="M-5 -21L5 -21" {...line}/></g>
    case 'barbell':return <g><path d="M-23 -5 L23 5" {...metal}/><circle cx="-24" cy="-5" r="9" fill={color}/><circle cx="24" cy="5" r="9" fill={color}/><circle cx="-24" cy="-5" r="3" fill={secondary}/><circle cx="24" cy="5" r="3" fill={secondary}/></g>
    case 'septum':return <g><path d="M-20 -16 V3 A20 20 0 0 0 20 3 V-16" {...metal}/><circle cx="-20" cy="-16" r="7" fill={secondary}/><circle cx="20" cy="-16" r="7" fill={secondary}/></g>
    case 'stud':return <g><circle r="16" fill={color}/><circle r="9" fill={secondary}/><circle r="3" fill={color}/></g>
    case 'chain':return <g {...metal}><ellipse cx="-11" cy="-11" rx="12" ry="20" transform="rotate(35 -11 -11)"/><ellipse cx="11" cy="11" rx="12" ry="20" transform="rotate(35 11 11)"/></g>
    default:return <circle r="14" fill={color}/>
  }
}

export default function CharacterAccessories({items=[],tattooLibrary=[],selectedId=null,onSelect=()=>{},onMove=()=>{},editable=false}){
  const onPointerDown=(event,item)=>{
    if(!editable)return
    if(event.button!==undefined&&event.button!==0)return
    event.preventDefault();event.stopPropagation()
    onSelect(item.id)
    const origin={x:item.x,y:item.y,clientX:event.clientX,clientY:event.clientY}
    const element=event.currentTarget
    const svg=element.ownerSVGElement
    element.setPointerCapture?.(event.pointerId)
    const move=e=>{
      if(!svg)return
      const matrix=svg.getScreenCTM()
      if(!matrix)return
      const delta=matrix.inverse()
      const dx=(e.clientX-origin.clientX)*delta.a+(e.clientY-origin.clientY)*delta.c
      const dy=(e.clientX-origin.clientX)*delta.b+(e.clientY-origin.clientY)*delta.d
      onMove(item.id,Math.max(85,Math.min(515,origin.x+dx)),Math.max(85,Math.min(515,origin.y+dy)))
    }
    const done=()=>{element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',done);element.removeEventListener('pointercancel',done)}
    element.addEventListener('pointermove',move)
    element.addEventListener('pointerup',done,{once:true})
    element.addEventListener('pointercancel',done,{once:true})
  }
  return <g className="character-accessories" data-accessory-count={items.length}>
    {items.map(item=>{
      const variant=ACCESSORY_COLLECTION.find(entry=>entry.id===item.type)||(item.type==='user-svg'?tattooLibrary.find(v=>v.id===item.assetId):null)
      if(!variant)return null
      return <g key={item.id} data-accessory-id={item.id} data-accessory-type={item.type}
        transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.flip?-item.scale:item.scale} ${item.scale})`}
        onPointerDown={event=>onPointerDown(event,item)}
        style={{cursor:editable?'grab':'default',touchAction:editable?'none':undefined}}>
        <g data-accessory-art="true">{item.type==='user-svg'?<UploadedSvgArtwork asset={variant} instanceId={item.id} tint={item.tint} color={item.color}/>:<AccessoryGlyph type={item.type} color={item.color} secondary={item.secondary}/>}</g>
        {editable&&<circle data-editor-only="true" cx="0" cy="0" r="35" fill="transparent" stroke={selectedId===item.id?'#81a7b8':'transparent'} strokeWidth="1.2" strokeDasharray="3 4"/>}
      </g>
    })}
  </g>
}

import React,{useId} from 'react'
import {EYE_SHAPES,normaliseCircle} from './circleEyeData.js'
import CharacterAccessories from './CharacterAccessories.jsx'

/** Flat, original SVG eye rig informed by the public STARBOY eye gallery.
 * Big near-touching color fields with an inset contrasting pupil are the
 * baseline; realistic iris/ring/white highlights are not baked into the art.
 * Not the proprietary CREATURE/Lark engine or its source artwork.
 */
export default function CircleEyes({settings,emotion='idle',look={x:0,y:0},compact=false,motion=true,selectedAccessoryId=null,onAccessorySelect,onAccessoryMove,...rest}){
  const s=normaliseCircle(settings)
  const design=EYE_SHAPES.find(eye=>eye.id===s.shape)||EYE_SHAPES[0]
  const uid=useId().replace(/:/g,'')
  const eyeScale=s.eyeScale*1.94*(emotion==='surprised'?1.11:emotion==='happy'?1.03:1)
  const gap=91*s.spacing
  const gazeX=(Number(look.x)||0)*10
  const gazeY=(Number(look.y)||0)*7

  function irisShape(fill,r){
    switch(s.iris){
      case 'diamond':return <rect data-layer="iris" x={-r*.72} y={-r*.72} width={r*1.44} height={r*1.44} transform="rotate(45)" fill={fill}/>
      case 'square':return <rect data-layer="iris" x={-r} y={-r} width={r*2} height={r*2} rx={r*.1} fill={fill}/>
      case 'slit':return <ellipse data-layer="iris" rx={r*.74} ry={r*2.15} fill={fill}/>
      default:return <circle data-layer="iris" r={r} fill={fill}/>
    }
  }

  const eachEye=(sign)=>{
    const id=`eye-cut-${uid}-${sign===-1?'left':'right'}`
    const side=sign===-1?'left':'right'
    const useIndependent=s.eyeMode==='independent'
    const white=useIndependent?(sign===-1?s.leftEyeColor:s.rightEyeColor):s.eyeColor
    const irisColor=useIndependent?(sign===-1?s.leftIrisColor:s.rightIrisColor):s.irisColor
    const pupilColor=useIndependent?(sign===-1?s.leftPupilColor:s.rightPupilColor):s.pupilColor
    const angle=(design.tilt||0)*sign
    const transform=`translate(${300+gap*sign} 282) rotate(${angle}) scale(${(eyeScale*design.scaleX).toFixed(4)} ${(eyeScale*design.scaleY).toFixed(4)})`
    const irisRadius=16*s.irisScale
    const pupilRadius=6.5*s.pupilScale
    return <g key={sign} data-eye-side={side} transform={transform}>
      <defs><clipPath id={id}><path d={design.path}/></clipPath></defs>
      <path data-layer="eye-white" d={design.path} fill={white}/>
      {s.iris!=='none'&&<g clipPath={`url(#${id})`}>
        <g data-eye-gaze={side} transform={`translate(${(-sign*17*s.irisOffset+gazeX).toFixed(3)} ${gazeY.toFixed(3)})`}>
          {irisShape(irisColor,irisRadius)}
          {s.pupilVisible&&<circle data-layer="pupil" r={pupilRadius} fill={pupilColor}/>}
          {s.glint&&<circle data-layer="glint" cx={-irisRadius*.35} cy={-irisRadius*.36} r={Math.max(2,irisRadius*.15)} fill={s.glintColor}/>}
        </g>
      </g>}
      {emotion==='sleepy'&&<g clipPath={`url(#${id})`}><path d="M-65 -80 H65 V-13 Q0 -4 -65 -13Z" fill={s.color} data-layer="eyelid"/></g>}
      {emotion==='curious'&&sign===1&&<g clipPath={`url(#${id})`}><path d="M-65 -80 H65 V-18 Q0 -6 -65 -18Z" fill={s.color} data-layer="eyelid"/></g>}
    </g>
  }

  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"
    className={`circle-character-svg ${motion&&!compact?'eyes-moving':''} ${emotion==='blink'?'is-blinking':''}`}
    role="img" aria-label="Flat 2D circle with multicolor animated eyes"
    data-circle-character="true" data-eye-shape={s.shape} data-emotion={emotion}
    style={{width:'100%',height:'100%',display:'block',overflow:'visible'}} {...rest}>
    <circle data-flat-body="true" cx="300" cy="300" r="220" fill={s.color}/>
    <g className="circle-eye-pair">{eachEye(-1)}{eachEye(1)}</g>
    <CharacterAccessories items={s.accessories} tattooLibrary={s.tattooLibrary} selectedId={selectedAccessoryId} editable={!compact&&!!onAccessorySelect} onSelect={onAccessorySelect} onMove={onAccessoryMove}/>
  </svg>
}

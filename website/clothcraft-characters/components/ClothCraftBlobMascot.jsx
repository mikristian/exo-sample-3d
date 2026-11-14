import React,{useEffect,useRef} from 'react'
import {CLOTHCRAFT_CHARACTERS,CLOTHCRAFT_CHARACTER_COLORS,DEFAULT_CLOTHCRAFT_CHARACTER,normalizeClothCraftCharacter} from './characterData.js'
import './ClothCraftBlobMascot.css'

// A family of original alien silhouettes: a generously curved cranium,
// tapered cheeks and a small, softly pointed chin. All surfaces are flat SVG
// fills; no gradients, glass, textures, highlights, or separate body parts.
const PROFILES={
  stitch:{width:1,height:1,crown:1,jaw:1,phase:0},
  patch:{width:1.04,height:.96,crown:1.09,jaw:.94,phase:.5},
  bobbin:{width:1.08,height:.91,crown:1.08,jaw:1.08,phase:1.1},
  forma:{width:.96,height:1.06,crown:.97,jaw:.85,phase:2.2},
}

const EYE_FINISH={
  lime:'#090f13', // Obsidian — the signature emoji-like eye
  ice:'#10212d',  // Deep midnight
  orchid:'#211827',
  amber:'#261e19',
}

// The right-hand side of the head, from its crown to its chin. Reflecting
// these landmarks gives a smooth intentional silhouette, not an oval blob.
const RIGHT_CONTOUR=[
  [180,35],[222,39],[263,57],[294,88],[310,124],[312,162],
  [305,198],[288,237],[266,272],[240,300],[207,323],[180,335],
]
const CONTOUR=[...RIGHT_CONTOUR,...RIGHT_CONTOUR.slice(1,-1).reverse().map(([x,y])=>[360-x,y])]

// This almond is pinched at its outer upper corner and falls inward, like the
// unmistakable slanted black eyes of the alien emoji. Mirror for the right eye.
const ALIEN_EYE='M -37 -35 C -23 -44 5 -28 23 -11 C 38 5 40 27 27 36 C 13 47 -13 32 -29 12 C -43 -7 -47 -27 -37 -35 Z'

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))

function headPoints(profile,time=0,energy=0,bands=[0,0,0],moving=false){
  const bass=bands[0]||0,mid=bands[1]||0,high=bands[2]||0
  return CONTOUR.map(([px,py],i)=>{
    const angle=i/CONTOUR.length*Math.PI*2
    const upper=clamp((195-py)/160,0,1)
    const lower=clamp((py-195)/140,0,1)
    const taper=1+upper*(profile.crown-1)+lower*(profile.jaw-1)
    const breath=moving?.005*Math.sin(time*1.5+angle*2+profile.phase):0
    const sound=energy*(.034*Math.sin(time*8.1+angle*3.1)+.016*Math.sin(time*11.7-angle*5)+.018*bass+.014*mid+.012*high)
    const scale=1+breath+sound
    return {
      x:180+(px-180)*profile.width*taper*scale,
      y:190+(py-190)*profile.height*(1+breath*.5+sound*.65),
    }
  })
}

function closedCurve(points){
  return points.map((p,i)=>{
    const before=points[(i+points.length-1)%points.length]
    const after=points[(i+1)%points.length]
    const afterNext=points[(i+2)%points.length]
    const c1x=p.x+(after.x-before.x)/6
    const c1y=p.y+(after.y-before.y)/6
    const c2x=after.x-(afterNext.x-p.x)/6
    const c2y=after.y-(afterNext.y-p.y)/6
    return `${i===0?`M${p.x.toFixed(2)} ${p.y.toFixed(2)}`:''}C${c1x.toFixed(2)} ${c1y.toFixed(2)},${c2x.toFixed(2)} ${c2y.toFixed(2)},${after.x.toFixed(2)} ${after.y.toFixed(2)}`
  }).join(' ')+' Z'
}

export default function ClothCraftBlobMascot({
  config=DEFAULT_CLOTHCRAFT_CHARACTER,
  mood='idle',compact=false,look=null,emotion='happy',
  audioLevelRef=null,audioBandsRef=null,intensity=1,
}){
  const settings=normalizeClothCraftCharacter(config)
  const profile=PROFILES[settings.character]
  const shell=CLOTHCRAFT_CHARACTER_COLORS.find(c=>c.id===settings.color)
  const eyes=EYE_FINISH[settings.eyeColor]
  const pathRef=useRef(null)
  const groupRef=useRef(null)
  const rootRef=useRef(null)
  const shadowRef=useRef(null)
  const neutral=closedCurve(headPoints(profile))
  const wave=settings.motion&&!compact
  const eyeScale=settings.eyeSize==='minimal'?.73:settings.eyeSize==='balanced'?.88:1
  const eyeShapeX=settings.eyes==='focused'?.84:1
  const eyeShapeY=settings.eyes==='sleepy'?.76:settings.eyes==='focused'?1.06:1
  const offset={x:clamp((look?.x||0)*.95,-4.8,4.8),y:clamp((look?.y||0)*.85,-3.5,3.5)}

  useEffect(()=>{
    const node=pathRef.current
    if(!node)return
    let raf=0,smoothed=0,phase=0
    let previous=performance.now()
    const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches
    if(compact||reduced){node.setAttribute('d',neutral);return}
    const step=now=>{
      const dt=Math.min(.06,Math.max(0,(now-previous)/1000));previous=now
      const target=clamp((audioLevelRef?.current||0)*intensity,0,1)
      smoothed+=(target-smoothed)*(1-Math.exp(-dt*(target>smoothed?21:7)))
      phase+=dt
      const path=closedCurve(headPoints(profile,phase,smoothed,audioBandsRef?.current||[0,0,0],settings.motion))
      node.setAttribute('d',path)
      if(rootRef.current){
        rootRef.current.style.setProperty('--blob-energy',smoothed.toFixed(3))
        rootRef.current.setAttribute('data-audio-level',smoothed.toFixed(3))
      }
      if(groupRef.current){
        const talk=mood==='speaking'?smoothed:0
        groupRef.current.style.transform=`translateY(${(-2*talk).toFixed(2)}px) scale(${(1+talk*.023).toFixed(3)},${(1-talk*.011).toFixed(3)})`
      }
      if(shadowRef.current)shadowRef.current.style.transform=`scaleX(${(1+smoothed*.1).toFixed(3)})`
      raf=requestAnimationFrame(step)
    }
    raf=requestAnimationFrame(step)
    return()=>cancelAnimationFrame(raf)
  },[settings.character,settings.motion,compact,neutral,audioLevelRef,audioBandsRef,intensity,mood])

  return <div ref={rootRef} data-character={settings.character} data-mood={mood} data-premium="true" data-blob="true" data-design="alien-matte" data-audio-level="0" className={`cc-character-avatar cc-blob-character cc-blob-${settings.character} ${wave?'cc-character-animated':''} cc-character-${mood} cc-character-emotion-${emotion} ${compact?'cc-character-mini':''}`}>
    <svg viewBox="0 0 360 390" role="img" aria-label={`${shell.label} ${CLOTHCRAFT_CHARACTERS.find(item=>item.id===settings.character).name} alien with matte head and black almond eyes`}>
      <ellipse ref={shadowRef} cx="180" cy="356" rx="80" ry="5" fill="#050b11" opacity=".14" className="cc-character-shadow"/>
      <g ref={groupRef} className="cc-blob-rig">
        <path className="cc-blob-body" ref={pathRef} d={neutral} fill={shell.base}/>
        <g className="cc-blob-eyes">
          <g className="cc-character-blink cc-character-eye-pair">
            <g className="cc-blob-eye-breath">
              <g className="cc-character-pupils" style={{transform:`translate(${offset.x}px,${offset.y}px)`}}>
                <g transform={`translate(127 181) scale(${eyeScale*eyeShapeX} ${eyeScale*eyeShapeY})`}><path className="cc-alien-eye" d={ALIEN_EYE} fill={eyes}/></g>
                <g transform={`translate(233 181) scale(${-eyeScale*eyeShapeX} ${eyeScale*eyeShapeY})`}><path className="cc-alien-eye" d={ALIEN_EYE} fill={eyes}/></g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  </div>
}

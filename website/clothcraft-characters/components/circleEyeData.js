/** Entirely original, flat 2D eye-shape library. No image assets or shading. */
import {normaliseAccessories} from './characterAccessories.js'
import {normaliseSvgLibrary} from './svgTattooImport.jsx'
export const EYE_FAMILIES=[
  {id:'oval',name:'Oval',category:'Soft',path:'M0 -51 C28 -51 42 -30 42 0 C42 31 25 51 0 51 C-25 51 -42 31 -42 0 C-42 -30 -28 -51 0 -51Z'},
  {id:'round',name:'Round',category:'Soft',path:'M0 -43 A43 43 0 1 1 0 43 A43 43 0 1 1 0 -43Z'},
  {id:'pill',name:'Pill',category:'Soft',path:'M-31 -48 H31 C48 -48 48 -30 48 -17 V17 C48 30 48 48 31 48 H-31 C-48 48 -48 30 -48 17 V-17 C-48 -30 -48 -48 -31 -48Z'},
  {id:'bean',name:'Bean',category:'Soft',path:'M-39 -14 C-52 -47 -4 -58 24 -46 C53 -34 47 -3 34 24 C19 57 -29 57 -43 25 C-49 9 -45 0 -39 -14Z'},
  {id:'squircle',name:'Squircle',category:'Soft',path:'M-22 -48 Q-48 -48 -48 -24 V24 Q-48 48 -22 48 H22 Q48 48 48 24 V-24 Q48 -48 22 -48Z'},
  {id:'diamond',name:'Diamond',category:'Graphic',path:'M0 -53 L47 0 L0 53 L-47 0Z'},
  {id:'pixel',name:'Pixel',category:'Graphic',path:'M-43 -46 H43 V46 H-43Z'},
  {id:'triangle',name:'Triangle',category:'Graphic',path:'M0 -55 L49 43 Q0 50 -49 43Z'},
  {id:'spark',name:'Spark',category:'Graphic',path:'M0 -53 Q11 -13 44 -5 Q13 9 0 53 Q-13 9 -44 -5 Q-11 -13 0 -53Z'},
  {id:'heart',name:'Heart',category:'Graphic',path:'M0 45 C-12 34 -49 9 -49 -19 C-49 -51 -13 -59 0 -32 C13 -59 49 -51 49 -19 C49 9 12 34 0 45Z'},
  {id:'narrow',name:'Slit',category:'Expressive',path:'M-48 -7 Q0 -27 48 -7 Q0 26 -48 -7Z'},
  {id:'wink',name:'Wink',category:'Expressive',path:'M-47 12 Q-7 -29 45 -16 Q20 -4 -5 3 Q-29 11 -47 12Z'},
  {id:'crescent',name:'Crescent',category:'Expressive',path:'M-45 20 Q-16 -52 47 -27 Q13 -15 5 6 Q-10 38 -45 20Z'},
  {id:'sleepy',name:'Sleepy',category:'Expressive',path:'M-49 -4 Q0 -31 49 -4 Q43 25 0 29 Q-38 25 -49 -4Z'},
  {id:'droplet',name:'Drop',category:'Expressive',path:'M13 -54 C30 -27 47 -9 45 16 C43 41 25 52 1 52 C-28 52 -46 35 -45 11 C-43 -19 -8 -35 13 -54Z'},
  {id:'wing',name:'Wing',category:'Expressive',path:'M-51 24 Q-29 -43 48 -43 C26 -28 26 18 4 34 Q-17 47 -51 24Z'},
]

export const EYE_MODIFIERS=[
  {id:'classic',name:'Classic',scaleX:1,scaleY:1,tilt:0},
  {id:'wide',name:'Wide',scaleX:1.28,scaleY:.76,tilt:0},
  {id:'tall',name:'Tall',scaleX:.76,scaleY:1.16,tilt:0},
  {id:'tilted',name:'Tilted',scaleX:1.02,scaleY:1.02,tilt:15},
  {id:'petite',name:'Petite',scaleX:.72,scaleY:.72,tilt:-12},
]

// The four prominent digital-display silhouettes come first. These describe
// the public reference's big, near-touching eyes, not its proprietary artwork.
export const DISPLAY_SHAPES=[
  {id:'display-tall',name:'Display / Tall',category:'Display',family:'display',path:'M0 -51 C32 -51 44 -31 44 0 C44 31 29 51 0 51 C-29 51 -44 31 -44 0 C-44 -31 -32 -51 0 -51Z',scaleX:1,scaleY:1,tilt:0},
  {id:'display-round',name:'Display / Round',category:'Display',family:'display',path:'M0 -46 C32 -46 46 -26 46 0 C46 26 32 46 0 46 C-32 46 -46 26 -46 0 C-46 -26 -32 -46 0 -46Z',scaleX:1,scaleY:1,tilt:0},
  {id:'display-wide',name:'Display / Wide',category:'Display',family:'display',path:'M0 -39 C36 -39 49 -20 49 0 C49 20 36 39 0 39 C-36 39 -49 20 -49 0 C-49 -20 -36 -39 0 -39Z',scaleX:1,scaleY:1,tilt:0},
  {id:'display-sleepy',name:'Display / Sleepy',category:'Display',family:'display',path:'M-49 -1 Q0 13 49 -1 C43 43 19 44 0 44 C-19 44 -43 43 -49 -1Z',scaleX:1,scaleY:1,tilt:0},
]

export const EYE_SHAPES=[...DISPLAY_SHAPES,...EYE_FAMILIES.flatMap(family=>EYE_MODIFIERS.map(modifier=>({
  id:`${family.id}-${modifier.id}`,
  name:`${family.name} / ${modifier.name}`,
  family:family.id,
  category:family.category,
  path:family.path,
  scaleX:modifier.scaleX,
  scaleY:modifier.scaleY,
  tilt:modifier.tilt,
})))]

export const EYE_CATEGORIES=['All','Display','Soft','Graphic','Expressive']
export const LEGACY_SHAPES={oval:'oval-classic',tall:'oval-tall',pill:'pill-classic',narrow:'narrow-classic',wide:'round-wide',pixel:'pixel-classic'}

// Original EXO interpretations of the luminous two-tone digital-eye aesthetic.
// These are manually authored palettes, not exported STARBOY assets or Lark code.
const CURATED_EYE_COLORWAYS=[
  {id:'signal',name:'Signal',eye:'#d2f31c',iris:'#94151b',irisRight:'#124ce9',pupil:'#94151b',glint:'#ffffff'},
  {id:'magenta-green',name:'Neon Duo',eye:'#bb00d9',iris:'#e8fb00',pupil:'#4800a9',glint:'#ffffff'},
  {id:'chrome-red',name:'Chrome',eye:'#9aa2a0',iris:'#ff202a',pupil:'#5b0813',glint:'#ffffff'},
  {id:'orange-violet',name:'Ember',eye:'#fc4826',iris:'#60005b',pupil:'#26012d',glint:'#ffffff'},
  {id:'aqua',name:'Aqua',eye:'#e4fffb',iris:'#29ddcb',pupil:'#0c8a92',glint:'#ffffff'},
  {id:'bubblegum',name:'Bubblegum',eye:'#ffeaff',iris:'#fd77e8',pupil:'#a13cba',glint:'#ffffff'},
  {id:'lilac',name:'Lilac',eye:'#f4e8ff',iris:'#ae80ff',pupil:'#554ed2',glint:'#ffffff'},
  {id:'lime',name:'Lime',eye:'#efffdc',iris:'#83e235',pupil:'#32974f',glint:'#ffffff'},
  {id:'sunset',name:'Sunset',eye:'#fff4da',iris:'#ff9c77',pupil:'#dd5367',glint:'#ffffff'},
  {id:'azure',name:'Azure',eye:'#e0faff',iris:'#52baff',pupil:'#276ac5',glint:'#ffffff'},
  {id:'rose',name:'Rose',eye:'#ffeef2',iris:'#ff6b95',pupil:'#a42362',glint:'#ffffff'},
  {id:'gold',name:'Gold',eye:'#fffbdc',iris:'#ffcf56',pupil:'#da8036',glint:'#ffffff'},
  {id:'ice',name:'Ice',eye:'#ffffff',iris:'#a8eaff',pupil:'#4bb4db',glint:'#ffffff'},
  {id:'violet',name:'Violet',eye:'#eadfff',iris:'#9871ff',pupil:'#6a33bd',glint:'#ffffff'},
  {id:'coral',name:'Coral',eye:'#fff5f0',iris:'#ff8675',pupil:'#db494b',glint:'#ffffff'},
  {id:'mono',name:'Mono',eye:'#fafafa',iris:'#8797af',pupil:'#172333',glint:'#ffffff'},
]

// 84 additional reproducible EXO combinations (14 × 6). Together with the
// sixteen curated palettes this provides 100 editable colorways, while the
// original four display shapes offer 400 display-led combinations. These are
// not CREATURE's actual colorway assignments.
const BASE_COLOR_FIELDS=['#ff512c','#dafe16','#b917dc','#0e66f4','#f95caa','#0a734a','#f6cb19','#696bea','#e9f1f6','#931b26','#259de8','#bc6934','#baf489','#f2aaed']
const INSET_COLOR_FIELDS=['#130a56','#fcf927','#971415','#19ea83','#f7e3fb','#035bcf']
const GENERATED_EYE_COLORWAYS=BASE_COLOR_FIELDS.flatMap((eye,a)=>INSET_COLOR_FIELDS.map((iris,b)=>({
  id:`exo-${a+1}-${b+1}`,
  name:`Mix ${String(a*6+b+1).padStart(2,'0')}`,
  eye,iris,pupil:iris,glint:'#ffffff',
})))
export const EYE_COLORWAYS=[...CURATED_EYE_COLORWAYS,...GENERATED_EYE_COLORWAYS]

export const CIRCLE_PRESETS=[
  {id:'glass',name:'Signal',tag:'01 / Display study',color:'#0a0a0b',eyeColor:'#d2f31c',irisColor:'#94151b',leftIrisColor:'#94151b',rightIrisColor:'#124ce9',pupilColor:'#140712',shape:'display-tall',eyeScale:1,spacing:1,eyeMode:'independent',iris:'slit',pupilVisible:false,glint:false},
  {id:'orbit',name:'Orbit',tag:'02 / Display study',color:'#151029',eyeColor:'#bb00d9',irisColor:'#e8fb00',pupilColor:'#29104f',shape:'display-round',eyeScale:1,spacing:1,iris:'round',pupilVisible:false,glint:false},
  {id:'soft',name:'Soft',tag:'03 / Display study',color:'#eddabb',eyeColor:'#f8fff2',irisColor:'#ff7454',pupilColor:'#a62d4a',shape:'display-tall',eyeScale:.98,spacing:1,iris:'round',pupilVisible:false,glint:false},
  {id:'narrow',name:'Narrow',tag:'04 / Display study',color:'#18353c',eyeColor:'#fc83b6',irisColor:'#167f88',pupilColor:'#102638',shape:'display-sleepy',eyeScale:1,spacing:1,iris:'slit',pupilVisible:false,glint:false},
  {id:'miso',name:'Miso',tag:'05 / Display study',color:'#e2b4bd',eyeColor:'#39245d',irisColor:'#ffb94f',pupilColor:'#a42362',shape:'display-round',eyeScale:1,spacing:1,iris:'round',pupilVisible:false,glint:false},
  {id:'digital',name:'Pixel',tag:'06 / EXO variation',color:'#a5b3ee',eyeColor:'#102f79',irisColor:'#4dc6ef',pupilColor:'#276ac5',shape:'pixel-classic',eyeScale:1,spacing:1,iris:'round',pupilVisible:false,glint:false},
]

export const IRIS_SHAPES=[
  {id:'none',name:'None'},
  {id:'round',name:'Round'},
  {id:'diamond',name:'Diamond'},
  {id:'slit',name:'Slit'},
  {id:'square',name:'Square'},
]
export const EMOTIONS=[
  {id:'idle',label:'Neutral'},
  {id:'happy',label:'Happy'},
  {id:'sleepy',label:'Sleepy'},
  {id:'surprised',label:'Surprised'},
  {id:'curious',label:'Curious'},
  {id:'blink',label:'Blink'},
]

export const COLOR_SWATCHES=['#0a0a0b','#151029','#d3e3ea','#b1d1c4','#eddabb','#d5c8f0','#a5b3ee','#e2b4bd','#f8f5ef','#222a39']
export const EYE_COLOR_SWATCHES=['#d2f31c','#ff512c','#bb00d9','#ffffff','#9aa2a0','#14263b','#0e66f4','#f95caa','#244a41','#ffd462']
export const PUPIL_SWATCHES=['#94151b','#124ce9','#e8fb00','#141723','#44dcd8','#645bff','#f0834e','#105b52','#e35d8e','#0e7fca']
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))
export const isHexColor=v=>typeof v==='string'&&/^#[a-fA-F0-9]{6}$/.test(v)

export const normaliseCircle=(value={})=>{
  const base=CIRCLE_PRESETS[0]
  const raw={...base,...value}
  const shape=LEGACY_SHAPES[raw.shape]||raw.shape
  const tattooLibrary=normaliseSvgLibrary(raw.tattooLibrary)
  return {
    ...raw,
    color:isHexColor(raw.color)?raw.color:base.color,
    eyeColor:isHexColor(raw.eyeColor)?raw.eyeColor:base.eyeColor,
    irisColor:isHexColor(raw.irisColor)?raw.irisColor:base.irisColor,
    pupilColor:isHexColor(raw.pupilColor)?raw.pupilColor:base.pupilColor,
    glintColor:isHexColor(raw.glintColor)?raw.glintColor:'#ffffff',
    shape:EYE_SHAPES.some(v=>v.id===shape)?shape:base.shape,
    iris:IRIS_SHAPES.some(v=>v.id===raw.iris)?raw.iris:'round',
    eyeScale:clamp(Number(raw.eyeScale)||1,.55,1.35),
    spacing:clamp(Number(raw.spacing)||1,.75,1.30),
    irisScale:clamp(Number(raw.irisScale)||1,.35,1.5),
    pupilScale:clamp(Number(raw.pupilScale)||.57,.2,1.5),
    glint:Boolean(raw.glint??false),
    pupilVisible:Boolean(raw.pupilVisible??false),
    irisOffset:clamp(Number.isFinite(Number(raw.irisOffset))?Number(raw.irisOffset):.55,0,1),
    eyeMode:raw.eyeMode==='independent'?'independent':'matched',
    leftEyeColor:isHexColor(raw.leftEyeColor)?raw.leftEyeColor:raw.eyeColor,
    rightEyeColor:isHexColor(raw.rightEyeColor)?raw.rightEyeColor:raw.eyeColor,
    leftIrisColor:isHexColor(raw.leftIrisColor)?raw.leftIrisColor:(raw.irisColor||base.irisColor),
    rightIrisColor:isHexColor(raw.rightIrisColor)?raw.rightIrisColor:(raw.irisColor||base.irisColor),
    leftPupilColor:isHexColor(raw.leftPupilColor)?raw.leftPupilColor:raw.pupilColor,
    rightPupilColor:isHexColor(raw.rightPupilColor)?raw.rightPupilColor:raw.pupilColor,
    headScale:1,
    highlight:false,
    gloss:0,
    display:'flat',
    tattooLibrary,
    accessories:normaliseAccessories(raw.accessories,tattooLibrary),
  }
}

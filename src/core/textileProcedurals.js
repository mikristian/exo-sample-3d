import * as THREE from 'three'

const TWO_PI = Math.PI * 2
const fract = x => x - Math.floor(x)
const periodicNoise = (u, v) => {
  // Periodic, deterministic fine fibre irregularity. Seamless at the 3 cm
  // tile edges and stable across renders; no per-frame random noise/flicker.
  const a = Math.sin(TWO_PI * (13*u+19*v))
  const b = Math.cos(TWO_PI * (37*u-23*v))
  const c = Math.sin(TWO_PI * (59*u+43*v))
  return (a*.52+b*.31+c*.17)
}

export function describeTextileSurface(fabric={}) {
  const name = String(fabric.name || fabric.id || '').toLowerCase()
  let family = 'plain-weave'
  if (/rib/.test(name)) family = 'rib-knit'
  else if (/jersey|single.?knit|cotton.?knit|tee/.test(name)) family = 'jersey-knit'
  else if (/fleece|terry/.test(name)) family = 'terry-knit'
  else if (/denim|jean|twill/.test(name)) family = 'twill'
  else if (/suede|nap/.test(name)) family = 'suede'
  else if (/leather/.test(name)) family = 'leather'
  else if (/silk|satin/.test(name)) family = 'silk'
  else if (/nylon|ripstop|polyester/.test(name)) family = 'synthetic'
  const tileCm = 3
  const normalGain = {
    'jersey-knit': .76, 'rib-knit': .88, 'terry-knit': 1.04,
    twill: .88, 'plain-weave': .75, synthetic: .46,
    silk: .30, suede: .66, leather: .67,
  }[family]
  return {family, tileCm, normalGain}
}

export function textileRelief(family, u, v) {
  const wx = TWO_PI * 28*u, wy = TWO_PI * 31*v
  const n = periodicNoise(u, v)
  if (family==='jersey-knit') return .42*Math.cos(wx+.64*Math.sin(wy))+.27*Math.cos(wy)+.10*n
  if (family==='rib-knit') return .56*Math.cos(TWO_PI*15*u)+.23*Math.cos(wx+.52*Math.sin(wy))+.13*n
  if (family==='terry-knit') return .32*Math.cos(wx+.61*Math.sin(wy))+.23*Math.cos(wy)+.21*Math.cos(TWO_PI*(11*u+11*v))+.18*n
  if (family==='twill') return .50*Math.cos(TWO_PI*(28*u+10*v))+.22*Math.cos(wy)+.13*n
  if (family==='silk') return .18*Math.cos(TWO_PI*(48*u+12*v))+.12*Math.cos(TWO_PI*43*v)+.07*n
  if (family==='synthetic') return .20*Math.cos(TWO_PI*42*u)*Math.cos(TWO_PI*40*v)+.08*n
  if (family==='leather') return .23*Math.sin(TWO_PI*(7*u+13*v))*.5+.26*Math.cos(TWO_PI*(9*u-5*v))+.15*n
  if (family==='suede') return .23*n+.18*Math.sin(TWO_PI*(19*u+17*v))
  return .38*Math.cos(TWO_PI*31*u)+.34*Math.cos(TWO_PI*32*v)+.13*n
}

function makeCanvasTexture(canvas, colorSpace, repeat, orientation=0) {
  const texture=new THREE.CanvasTexture(canvas)
  texture.wrapS=THREE.RepeatWrapping
  texture.wrapT=THREE.RepeatWrapping
  texture.colorSpace=colorSpace
  texture.anisotropy=8
  texture.repeat.set(repeat.x,repeat.y)
  texture.center.set(.5,.5)
  texture.rotation=orientation
  texture.needsUpdate=true
  return texture
}

// Default physical-fibre micro-normal + micro-roughness, without painting a
// fake photo over the swatch's real dyed color. Uploads always override the
// corresponding generated channel. Grain follows the same measured 3D UVs.
export function makeProceduralTextileMaps(fabric={}) {
  if (typeof document==='undefined') return null
  const spec=describeTextileSurface(fabric)
  const resolution=256
  const count=resolution*resolution
  const heights=new Float32Array(count)
  let minimum=Infinity,maximum=-Infinity
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
    const value=textileRelief(spec.family,x/resolution,y/resolution)
    heights[y*resolution+x]=value
    minimum=Math.min(minimum,value);maximum=Math.max(maximum,value)
  }
  const normalCanvas=document.createElement('canvas')
  const roughnessCanvas=document.createElement('canvas')
  normalCanvas.width=normalCanvas.height=roughnessCanvas.width=roughnessCanvas.height=resolution
  const normalCtx=normalCanvas.getContext('2d', {willReadFrequently:false})
  const roughnessCtx=roughnessCanvas.getContext('2d', {willReadFrequently:false})
  if (!normalCtx || !roughnessCtx) return null
  const normalPixels=normalCtx.createImageData(resolution,resolution)
  const roughPixels=roughnessCtx.createImageData(resolution,resolution)
  const gain=spec.normalGain*Math.max(.4,Math.min(1.6,Number(fabric.thickness||.002)/.002))
  const norm=(x,y)=>heights[((y+resolution)%resolution)*resolution+((x+resolution)%resolution)]
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
    const idx=(y*resolution+x)*4
    const dx=(norm(x+1,y)-norm(x-1,y))*.5
    const dy=(norm(x,y+1)-norm(x,y-1))*.5
    const nx=-dx*gain*2,ny=-dy*gain*2,nz=1
    const inverse=1/Math.hypot(nx,ny,nz)
    normalPixels.data[idx]=Math.round(127.5+127.5*nx*inverse)
    normalPixels.data[idx+1]=Math.round(127.5+127.5*ny*inverse)
    normalPixels.data[idx+2]=Math.round(127.5+127.5*nz*inverse)
    normalPixels.data[idx+3]=255
    const variation=(heights[y*resolution+x]-minimum)/Math.max(1e-6,maximum-minimum)
    const roughness=Math.round(230+Math.min(23,Math.max(0,variation*22)))
    roughPixels.data[idx]=roughPixels.data[idx+1]=roughPixels.data[idx+2]=roughness
    roughPixels.data[idx+3]=255
  }
  normalCtx.putImageData(normalPixels,0,0)
  roughnessCtx.putImageData(roughPixels,0,0)
  // createGeometry produces UV = localPatternCm / fabric.repeatWidthCm.
  // Scale the procedural map so one yarn tile is truly 3 cm, even alongside
  // a large user-uploaded photographic color texture with its own repeat.
  const repeat={
    x:Math.max(.5,Number(fabric.texture?.repeatWidthCm??20))/spec.tileCm,
    y:Math.max(.5,Number(fabric.texture?.repeatHeightCm??20))/spec.tileCm,
  }
  const rotation=THREE.MathUtils.degToRad(Number(fabric.texture?.rotationDeg || 0))
  return {
    normalMap:makeCanvasTexture(normalCanvas,THREE.NoColorSpace,repeat,rotation),
    roughnessMap:makeCanvasTexture(roughnessCanvas,THREE.NoColorSpace,repeat,rotation),
    family:spec.family,
    tileCm:spec.tileCm,
  }
}

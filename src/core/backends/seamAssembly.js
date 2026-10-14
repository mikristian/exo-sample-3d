import { inspectNativeAssemblyPose } from './nativeAssemblyPreflight.js'
import * as THREE from 'three'
import { avatarClearance } from '../physics.js'

// Experimental nonrigid pre-assembly on a COPY of the native payload.
// This uses the same rest-edge lengths and explicitly paired sewing samples
// that the XPBD solver will use. No 2D patterns or saved garments are edited.
// A result is a staging candidate, NOT a collision-safe fitted garment.
function uniqueRestEdges(payload) {
  const edges = []
  const seen = new Set()
  for (const piece of payload.pieces) {
    const ids = piece.particleIndices
    const flat = piece.flatVerticesM
    for (const triangle of piece.faces) {
      for (let i = 0; i < 3; i++) {
        const a = triangle[i]
        const b = triangle[(i + 1) % 3]
        const ai = ids[a], bi = ids[b]
        const key = ai < bi ? `${ai}:${bi}` : `${bi}:${ai}`
        if (seen.has(key)) continue
        seen.add(key)
        const dx = flat[a][0] - flat[b][0]
        const dy = flat[a][1] - flat[b][1]
        const length = Math.hypot(dx, dy)
        if (length > 1e-7) edges.push({ a: ai, b: bi, length })
      }
    }
  }
  return edges
}

function projectDistance(positions, invMasses, a, b, rest, stiffness, maxMove) {
  const wa = invMasses[a], wb = invMasses[b], mass = wa+wb
  if(mass<=0)return
  const ai = a * 3, bi = b * 3
  const dx = positions[bi] - positions[ai], dy = positions[bi + 1] - positions[ai + 1], dz = positions[bi + 2] - positions[ai + 2]
  const distance = Math.hypot(dx, dy, dz)
  if (!(distance > 1e-10)) return
  const error = (distance - rest) / distance
  const correction = Math.max(-maxMove/Math.max(wa/mass,wb/mass),Math.min(maxMove/Math.max(wa/mass,wb/mass),distance*error*stiffness)) / distance
  const mx = dx * correction, my = dy * correction, mz = dz * correction
  positions[ai] += mx*(wa/mass); positions[ai + 1] += my*(wa/mass); positions[ai + 2] += mz*(wa/mass)
  positions[bi] -= mx*(wb/mass); positions[bi + 1] -= my*(wb/mass); positions[bi + 2] -= mz*(wb/mass)
}

export function assembleNativeSeams(payload, {
  iterations = 90,
  seamStiffness = .3,
  restStiffness = .7,
  positionStiffness = .002,
  maxMoveM = .012,
  seamPasses = 2,
  contactConstrained = false,
  contactMarginM = .004,
} = {}) {
  const output = structuredClone(payload)
  const n = output.particles.length
  const initial = new Float64Array(n * 3)
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) initial[i * 3 + j] = output.particles[i].position[j]
  const positions = initial.slice()
  const invMasses=output.particles.map(p=>Math.max(0,Number(p.invMass)||0))
  const restEdges = uniqueRestEdges(output)
  const seams = output.constraints.filter(item => item.type === 'seam')
  const hints=output.particles.map(p=>({wrapMode:p.wrapMode,seamIds:p.seamIds,collisionSideZ:p.collisionSideZ,patternV:0}))
  for(const piece of output.pieces){const ys=piece.flatVerticesM.map(v=>v[1]),lo=Math.min(...ys),span=Math.max(1e-7,Math.max(...ys)-lo);piece.particleIndices.forEach((idx,i)=>{hints[idx].patternV=(ys[i]-lo)/span})}
  const sample=new THREE.Vector3(),epsilon=.0006
  function projectBody(){
    for(let i=0;i<n;i++){
      if(invMasses[i]<=0)continue
      const k=i*3,x=positions[k],y=positions[k+1],z=positions[k+2]
      sample.set(x,y,z)
      const clearance=avatarClearance(sample,output.avatar,hints[i])
      if(clearance>=contactMarginM)continue
      sample.set(x+epsilon,y,z);const gx=(avatarClearance(sample,output.avatar,hints[i])-clearance)/epsilon
      sample.set(x,y+epsilon,z);const gy=(avatarClearance(sample,output.avatar,hints[i])-clearance)/epsilon
      sample.set(x,y,z+epsilon);const gz=(avatarClearance(sample,output.avatar,hints[i])-clearance)/epsilon
      const norm=Math.hypot(gx,gy,gz)
      if(norm<1e-7)continue
      const move=Math.min(maxMoveM,contactMarginM-clearance)/norm
      positions[k]+=gx*move;positions[k+1]+=gy*move;positions[k+2]+=gz*move
    }
  }
  const safeIterations = Math.max(0, Math.min(1000,Math.floor(iterations)))
  for (let iteration = 0; iteration < safeIterations; iteration++) {
    const reverse = iteration % 2 === 1
    for (let pass = 0; pass < seamPasses; pass++) {
      for (let i = 0; i < seams.length; i++) {
        const edge = seams[reverse ? seams.length - 1 - i : i]
        projectDistance(positions, invMasses, edge.a, edge.b, 0, seamStiffness, maxMoveM)
      }
    }
    for (let i = 0; i < restEdges.length; i++) {
      const edge = restEdges[reverse ? restEdges.length - 1 - i : i]
      projectDistance(positions, invMasses, edge.a, edge.b, edge.length, restStiffness, maxMoveM)
    }
    if(contactConstrained)projectBody()
    if (positionStiffness > 0) for (let i = 0; i < positions.length; i++) if(invMasses[Math.floor(i/3)]>0)positions[i] += (initial[i] - positions[i]) * positionStiffness
  }
  for (let i = 0; i < n; i++) {
    const p = [positions[i * 3],positions[i * 3 + 1],positions[i * 3 + 2]]
    if (!p.every(Number.isFinite)) throw new Error(`Seam assembly made invalid particle ${i}`)
    output.particles[i].position = p
    output.particles[i].previous = p.slice() // no artificial acceleration at handoff
  }
  const before = inspectNativeAssemblyPose(payload)
  const after = inspectNativeAssemblyPose(output)
  const collision = inspectStagedAvatarContact(output)
  output.assemblyExperiment = {
    algorithm: 'seam-aware-rest-edge-relaxation-v1',
    iterations: safeIterations,
    input: before,
    output: after,
    collision,
    contactConstrained,
    seamGapImproved:after.initialSeamGapMaximumMm<before.initialSeamGapMaximumMm,
    restStrainImproved:after.initialMeshPeakEdgeStrainPercent<before.initialMeshPeakEdgeStrainPercent,
    collisionCertified: false,
    safeToAutoApply: false, // Requires continuous body & cloth triangle CCD.
    enabledForProduction: false,
  }
  output.initialAssembly = after
  return output
}

// Samples every staged vertex and face centroid against the analytic body.
// This is an explicit rejection screen only, NOT continuous triangle CCD.
export function inspectStagedAvatarContact(payload) {
  const sample=new THREE.Vector3()
  let checked=0, penetrating=0, maximumIntrusionMm=0
  const position=(index)=>payload.particles[index].position
  const check=(point,hint)=>{
    sample.set(point[0],point[1],point[2])
    const value=avatarClearance(sample,payload.avatar,hint)
    checked++
    if(value<-.0005){penetrating++;maximumIntrusionMm=Math.max(maximumIntrusionMm,-value*1000)}
  }
  const hints=payload.particles.map(p=>({wrapMode:p.wrapMode,seamIds:p.seamIds,collisionSideZ:p.collisionSideZ,patternV:0}))
  for(const piece of payload.pieces) {
    const ys=piece.flatVerticesM.map(v=>v[1]), min=Math.min(...ys), span=Math.max(1e-7,Math.max(...ys)-min)
    piece.particleIndices.forEach((index,i)=>{hints[index].patternV=(ys[i]-min)/span;check(position(index),hints[index])})
    for(const face of piece.faces) {
      const [a,b,c]=face.map(i=>piece.particleIndices[i]);const pa=position(a),pb=position(b),pc=position(c)
      const centroid=[(pa[0]+pb[0]+pc[0])/3,(pa[1]+pb[1]+pc[1])/3,(pa[2]+pb[2]+pc[2])/3]
      check(centroid,{...hints[a],patternV:(hints[a].patternV+hints[b].patternV+hints[c].patternV)/3})
    }
  }
  return {checked,penetrating,maximumIntrusionMm:+maximumIntrusionMm.toFixed(2),sampledAvatarClearanceOnly:true,sweptCollisionCertified:false}
}

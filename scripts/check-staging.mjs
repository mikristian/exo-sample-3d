import assert from 'node:assert/strict'
import { createSimulationSession } from '../src/core/backends/registry.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createPantsTemplate } from '../src/data/templates.js'
import { stagedPanelPositions } from '../src/core/staging.js'

function check(project, label) {
  const { session, backend } = createSimulationSession(project, 'browser-pbd')
  const rows=[]
  for (const piece of session.simulation.pieces.values()) {
    const positions=stagedPanelPositions(piece,project.avatar)
    assert.equal(positions.length,piece.particles.length,`${label}: particle count ${piece.id}`)
    assert.ok(positions.every(p=>p.x>=-5&&p.x<=5&&p.y>=-1&&p.y<=4&&p.z>=-5&&p.z<=5&&p.isVector3),`${label}: invalid positions ${piece.id}`)
    const minX=Math.min(...positions.map(p=>p.x)), maxX=Math.max(...positions.map(p=>p.x))
    const yMin=Math.min(...positions.map(p=>p.y)), yMax=Math.max(...positions.map(p=>p.y))
    const zMin=Math.min(...positions.map(p=>p.z)), zMax=Math.max(...positions.map(p=>p.z))
    assert.ok(Math.abs(zMax-zMin)<0.0001,`${label}: panel must begin perfectly flat ${piece.id}`)
    rows.push({id:piece.id,wrap:piece.piece.arrangement3d?.wrap,minX,maxX,yMin,yMax,z:zMin})
  }
  backend.dispose?.(session)
  const find=wrap=>rows.find(x=>x.wrap===wrap)
  const front=find('front'),back=find('back')
  if(front&&back){assert.ok(front.z>0.30 && back.z < -0.30, `${label}: torso panels must be away from avatar, not wrapped`)}
  const left=find('left-arm'),right=find('right-arm')
  if(left&&right&&front){assert.ok(left.maxX<front.minX + 0.1,`${label}: left sleeve is not outside torso`);assert.ok(right.minX>front.maxX - 0.1,`${label}: right sleeve is not outside torso`)}
  const leftLegFront=find('left-leg-front'),rightLegFront=find('right-leg-front')
  if(leftLegFront&&rightLegFront)assert.ok(leftLegFront.maxX<rightLegFront.maxX,`${label}: left/right leg placements overlap incorrectly`)
  console.log(`${label}: ${rows.length} flat panels`, JSON.stringify(rows))
}
check(createDefaultProject(),'foundation tee')
check(createPantsTemplate(),'straight pants')
console.log('PASS: all garment panels are planar and located in front/back/beside the correct body parts')

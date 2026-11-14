/**
 * Fail-closed validation of a proposed CLO-origin website avatar.
 * The existing no-animation CLO Thomas export is not walk-ready, and a
 * different head does not erase the source-body's ownership or attribution.
 *
 * Usage: node integrations/clothcraft/qa-clo-headswap-web-eligibility-20261102.mjs path/to/file.glb
 * Does NOT publish or redistribute any CLO asset.
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const REQUIRED_ATTRIBUTION='CLO Virtual Fashion, Inc. owns all rights to the avatar displayed'
const supportedPaths=['translation','rotation','scale']

function parseGlb(file){
 const data=fs.readFileSync(file)
 if(data.length<20||data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)
  throw Error('Invalid GLB v2 header')
 let offset=12,json=null,bin=null
 while(offset<data.length){
  const size=data.readUInt32LE(offset),type=data.readUInt32LE(offset+4)
  offset+=8
  if(type===0x4E4F534A)json=JSON.parse(data.toString('utf8',offset,offset+size))
  if(type===0x004E4942)bin=data.subarray(offset,offset+size)
  offset+=size
 }
 if(!json||!bin)throw Error('Missing glTF JSON or binary payload')
 return {json,bin}
}

function quaternionVariation(json,bin,channel,animation){
 if(channel.target?.path!=='rotation')return 0
 const sample=animation.samplers?.[channel.sampler]
 const accessor=json.accessors?.[sample?.output]
 if(!accessor||accessor.type!=='VEC4'||accessor.componentType!==5126||accessor.count<2||accessor.sparse)return 0
 const view=json.bufferViews?.[accessor.bufferView]
 if(!view||view.byteStride)return 0
 const start=(view.byteOffset||0)+(accessor.byteOffset||0)
 if(start+accessor.count*16>bin.length)return 0
 let top=0
 for(let i=1;i<accessor.count;i++){
  let sum=0
  for(let k=0;k<4;k++)sum+=(bin.readFloatLE(start+i*16+k*4)-bin.readFloatLE(start+k*4))**2
  top=Math.max(top,Math.sqrt(sum))
 }
 return top
}

export function auditCloHeadSwapWebEligibility(file,{
  licenseApproval=false,
  licenseClass='academic',
  downloadableDerivativeClearance=false,
  attribution=REQUIRED_ATTRIBUTION
}={}){
 const {json,bin}=parseGlb(file)
 const rigs=json.skins||[],animations=json.animations||[]
 const nodes=json.nodes||[]
 const topRig=Math.max(0,...rigs.map(s=>s.joints?.length||0))
 const animated=new Set()
 for(const animation of animations)for(const channel of animation.channels||[]){
  if(!supportedPaths.includes(channel.target?.path))continue
  if(quaternionVariation(json,bin,channel,animation)>.015)animated.add(nodes[channel.target?.node]?.name||'')
 }
 const meshNodes=nodes.filter(n=>n.mesh!==undefined)
 const body=meshNodes.filter(n=>/body|torso|avatar|human/i.test(n.name||''))
 const newHead=meshNodes.filter(n=>/exo.*head.*(replacement|swap)|replacement.*head/i.test(n.name||''))
 const garments=meshNodes.filter(n=>/jean|denim|shirt|dress|skirt|trouser|pants/i.test(n.name||''))
 const gaitLegs=[...animated].filter(n=>/leg|thigh|shin|knee|foot|ankle/i.test(n))
 const problems=[]
 if(!body.length)problems.push('No recognizable CLO body mesh')
 if(!newHead.length)problems.push('No visibly marked original replacement head mesh')
 if(topRig<50)problems.push('No sufficiently complete skinned full-body skeleton')
 if(gaitLegs.length<4)problems.push('No verified walking animation affecting both leg chains')
 if(garments.length<2)problems.push('Missing separately named shirt/jeans or dress components')
 if(attribution!==REQUIRED_ATTRIBUTION)problems.push('Missing exact CLO website attribution')
  if(!['individual-commercial','business-commercial'].includes(licenseClass))
    problems.push('Commercial license not verified: current CLO session is Academic')
  if(!downloadableDerivativeClearance)
    problems.push('Permission to distribute an extractable CLO-derived GLB to website visitors not verified')
 if(!licenseApproval)problems.push('Interactive website distribution/attribution clearance not recorded')
 return {file:path.basename(file),
  originalCloRightsRemain:true,
  attribution:REQUIRED_ATTRIBUTION,
  completeRigBones:topRig,
  animationCount:animations.length,
  changingJointRotations:animated.size,
  changingLegJointRotations:gaitLegs.length,
  bodyMeshes:body.length,replacementHeads:newHead.length,garmentMeshes:garments.length,
  eligible:problems.length===0,
  problems}
}

if(process.argv[1]?.endsWith('qa-clo-headswap-web-eligibility-20261102.mjs')){
 const input=process.argv[2]
 if(!input){console.error('Usage: node qa-clo-headswap-web-eligibility-20261102.mjs <file.glb>');process.exit(2)}
 const report=auditCloHeadSwapWebEligibility(input,{
  licenseApproval:process.env.EXO_CLO_RELEASE_CLEARANCE==='explicitly-approved',
  licenseClass:process.env.EXO_CLO_LICENSE_CLASS||'academic',
  downloadableDerivativeClearance:process.env.EXO_CLO_RAW_GLB_RIGHTS==='express-permission'
 })
 console.log('EXO_CLO_HEADSWAP_WEB_GATE',JSON.stringify(report,null,2))
 if(!report.eligible)process.exitCode=1
}

// Rig compatibility is a hard precondition to playback. Merely loading a GLB
// animation does not prove it can drive a different rig or plant its feet.
const namedNode=track=>String(track?.name||'').replace(/\.[^.]+$/,'')
const canonicalNode=name=>String(name||'').replace(/[^A-Za-z0-9]/g,'').toLowerCase()

export function inspectExoMotionRig20261102(scene,clip){
  if(!scene?.traverse||!Array.isArray(clip?.tracks)||!(clip.duration>0))
    return {compatible:false,reason:'Missing skeletal animation or GLB rig',matched:0,tracks:0}
  const bones=[]
  scene.traverse(node=>{if(node.isBone)bones.push(node)})
  const boneIds=new Set(bones.map(b=>canonicalNode(b.name)))
  const trackIds=new Set(clip.tracks.map(t=>canonicalNode(namedNode(t))))
  const matched=[...trackIds].filter(id=>boneIds.has(id))
  const exactFamily=bones.length>=150&&['root','footl','footr','upperleg01l','upperleg01r','head']
    .every(name=>boneIds.has(name))
  const required=['root','footl','footr','upperleg01l','upperleg01r','lowerleg01l','lowerleg01r']
  const missing=required.filter(id=>!boneIds.has(id)||!trackIds.has(id))
  const compatible=exactFamily&&missing.length===0&&matched.length>=60
  return {compatible,rigFamily:exactFamily?'makehuman-163':'unmapped',
    reason:compatible?'Matching MakeHuman skeleton names; physical gait still requires contact QA'
      :'Unmapped skeleton: requires a verified retarget and contact calibration',
    bones:bones.length,tracks:clip.tracks.length,matched:matched.length,missing,
    clipSeconds:clip.duration}
}

export const EXO_MOTION_CLIPS_20261102=Object.freeze([
  Object.freeze({id:'none',label:'Rest posture · no recorded walk',url:null,review:'none'}),
  Object.freeze({id:'slow-footlock-v6',label:'Slow foot-contact study · experimental, not runway-quality',
    url:'/avatars/exo/motions/EXO_Runway_Walk_v6_SoleContactSafetyMargin.glb',
    review:'research-slow',speedMps:.24,
    // Stance-height offsets measured on actual skin-sole vertices after
    // glTF clip transfer, not inferred from skeletal foot-tip elevations.
    bodyGroundOffsets:Object.freeze({'exo-feminine-02-exact':-.007,
      'exo-masculine-02-exact':-.0065,'exo-shape-02-exact':-.0055,
      'exo-masculine-03-hybrid':-.0065})}),
  Object.freeze({id:'turn-180-v3',label:'180° planted step-turn · motion preview',
    url:'/avatars/exo/motions/EXO_Contact_StepTurn_180_v3.glb',review:'preview'}),
  Object.freeze({id:'turn-360-v3',label:'360° planted step-turn · motion preview',
    url:'/avatars/exo/motions/EXO_Contact_StepTurn_360_v3.glb',review:'preview'}),
  Object.freeze({id:'walk-original',label:'Original walk · FOOT SLIDING — experimental',
    url:'/avatars/exo/motions/EXO_Runway_Walk_Original.glb',review:'failed-contact'}),
])
export const exoMotionClip20261102=id=>EXO_MOTION_CLIPS_20261102.find(clip=>clip.id===id)||EXO_MOTION_CLIPS_20261102[0]

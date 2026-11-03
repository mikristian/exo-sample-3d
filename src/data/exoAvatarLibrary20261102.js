// Only generated, provenance-checked MakeHuman CC0 pilot avatars belong here.
// Native collision bodies are Y-up-metre copies of the same Blender base mesh
// as the visual GLB (which separately contains eyes and hair).
// These are experimental fitting fixtures, NOT certified body scans or CLO assets.
export const EXO_CC0_AVATAR_MODELS_20261102 = Object.freeze([
  Object.freeze({id:'exo-feminine-02-exact',label:'EXO Feminine · matched rig + collider',
    visual:'/avatars/exo/exo-feminine-02-exact.glb',collider:'public/avatars/exo/exo-feminine-02-exact.obj',
    bodyHeightM:1.613919,rig:'MakeHuman 163 bones · masked/shape baked',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-masculine-02-exact',label:'EXO Masculine · matched rig + collider',
    visual:'/avatars/exo/exo-masculine-02-exact.glb',collider:'public/avatars/exo/exo-masculine-02-exact.obj',
    bodyHeightM:1.751835,rig:'MakeHuman 163 bones · masked/shape baked',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-masculine-02-pose-a',label:'EXO Masculine · physical A pose',
    visual:'/avatars/exo/exo-masculine-02-exact.glb',
    poseClipUrl:'/avatars/exo/motions/EXO_Fit_A.glb',physicalPose:'fit-a',
    collider:'public/avatars/exo/poses/exo-masculine-fit-a.obj',
    bodyHeightM:1.751835,rig:'MakeHuman 163 bones · fit pose action',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-masculine-02-pose-t',label:'EXO Masculine · physical T pose',
    visual:'/avatars/exo/exo-masculine-02-exact.glb',
    poseClipUrl:'/avatars/exo/motions/EXO_Fit_T.glb',physicalPose:'fit-t',
    collider:'public/avatars/exo/poses/exo-masculine-fit-t.obj',
    bodyHeightM:1.751835,rig:'MakeHuman 163 bones · fit pose action',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-masculine-02-pose-relaxed',label:'EXO Masculine · physical relaxed pose',
    visual:'/avatars/exo/exo-masculine-02-exact.glb',
    poseClipUrl:'/avatars/exo/motions/EXO_Fit_Relaxed.glb',physicalPose:'fit-relaxed',
    collider:'public/avatars/exo/poses/exo-masculine-fit-relaxed.obj',
    bodyHeightM:1.751835,rig:'MakeHuman 163 bones · fit pose action',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-masculine-03-hybrid',label:'EXO Masculine · experimental hybrid hair',
    visual:'/avatars/exo/exo-masculine-03-hybrid.glb',collider:'public/avatars/exo/exo-masculine-03-hybrid.obj',
    bodyHeightM:1.751835,rig:'MakeHuman 163 bones · individually skinned hair fibers',
    fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-shape-02-exact',label:'EXO Fuller Body · matched rig + collider',
    visual:'/avatars/exo/exo-shape-02-exact.glb',collider:'public/avatars/exo/exo-shape-02-exact.obj',
    bodyHeightM:1.765826,rig:'MakeHuman 163 bones · masked/shape baked',fitCertified:false,alignmentToleranceM:.002}),
  Object.freeze({id:'exo-feminine-01',label:'EXO Feminine 01 · CC0 fitting pilot',
    visual:'/avatars/exo/exo-feminine-01.glb',collider:'public/avatars/exo/exo-feminine-01.obj',
    bodyHeightM:1.6139,rig:'MakeHuman default 163 bones',fitCertified:false}),
  Object.freeze({id:'exo-masculine-01',label:'EXO Masculine 01 · CC0 fitting pilot',
    visual:'/avatars/exo/exo-masculine-01.glb',collider:'public/avatars/exo/exo-masculine-01.obj',
    bodyHeightM:1.7518,rig:'MakeHuman default 163 bones',fitCertified:false}),
  Object.freeze({id:'exo-shape-01',label:'EXO Fuller Body 01 · CC0 fitting pilot',
    visual:'/avatars/exo/exo-shape-01.glb',collider:'public/avatars/exo/exo-shape-01.obj',
    bodyHeightM:1.7658,rig:'MakeHuman default 163 bones',fitCertified:false}),
])

export const exoCc0Avatar20261102 = id => EXO_CC0_AVATAR_MODELS_20261102.find(item=>item.id===id)||null
export const exoCc0AvatarIds20261102 = () => EXO_CC0_AVATAR_MODELS_20261102.map(item=>item.id)

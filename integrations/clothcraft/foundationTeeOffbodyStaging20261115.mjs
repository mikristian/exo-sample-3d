// Opt-in, source-preserving INITIAL 3D staging for the built-in four-piece tee.
// This changes ONLY arrangement3d, not the EXO 2D material cut/sew geometry.
// A collision-free first step is NOT an accepted long-run fit/strain result.
export function stageFoundationTeeOffbody20261115(document) {
 if(document?.productionSpec?.format!=='garment-studio.tee-production-development.v1'||
    document.productionSpec?.approvalStatus!=='FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED'||
    document.pieces?.length!==4||document.seams?.length!==14 ||
    new Set(document.pieces.map(p=>p.id)).size!==4 ||
    new Set(document.seams.map(s=>s.id)).size!==14)
   throw Error('Off-body staging is supported only for unapproved four-piece EXO Foundation Tee')
 // First-frame Rust OGC trials on the neutral avatar showed that the
 // original sleeve z=0 placement intersects the body. Only spread the two
 // sleeves 22 cm in Z, leaving front/back and sleeve X/Y/2D coordinates exact.
 // This is the smallest tested opt-in change; it is not a fitted drape.
 const pose={
  front:{wrap:'front'},
  back:{wrap:'back'},
  'sleeve-left':{z:0.22,wrap:'left-arm'},
  'sleeve-right':{z:-0.22,wrap:'right-arm'},
 }
 const copy=structuredClone(document)
 for(const piece of copy.pieces){
  const planned=pose[piece.id]
  if(!planned || piece.arrangement3d?.wrap!==planned.wrap ||
     !Number.isFinite(piece.arrangement3d?.y) ||
     !piece.points?.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)))
    throw Error('Off-body staging cannot be applied to unknown or malformed tee geometry')
  piece.arrangement3d={...piece.arrangement3d,...planned}
 }
 return {document:copy,
  originalSourceUnchanged:true,
  initialArrangementOnly:true,
  optInRequired:true,
  verifiedPhysicalFit:false,
  manufacturingApproved:false,
  note:'Opt-in neutral-avatar sleeve separation of 22 cm along Z; unchanged EXO 2D pattern, original front/back pose and sleeve X/Y. This removes first-step self/body intersections but does not qualify seam closure, material strain or garment fit.'}
}

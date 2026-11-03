/**
 * Deployment decision for transparent avatar-frame media in the ClothCraft
 * Earth hero. A rendered image can be displayed without shipping a model,
 * but that does NOT cure an unauthorized source license (e.g. CLO Academic).
 *
 * This is a content-provenance and implementation guard, not legal advice.
 */
import {assessExoCloAvatarWebsiteUse20261102} from './exoCloAvatarWebsiteUsage20261102.js'

const allowedImageTypes=/\.(?:webp|png|avif)(?:\?.*)?$/i
const forbiddenModelTypes=/\.(?:glb|gltf|obj|fbx|blend|avt|avte|usd|usdz)(?:\?.*)?$/i

export function assessExoRenderedEarthMedia20261102({
  sourceKind,
  license,
  sourceIsCommerciallyAuthorized=false,
  renderedOnly=false,
  framesPerDirection,
  directions,
  atlasFiles=[],
  attribution,
  rawModelPermission=false,
}={}){
  const issues=[]
  if(!renderedOnly)issues.push('Delivery must contain rendered images only, not downloadable model geometry')
  if(!Array.isArray(atlasFiles)||!atlasFiles.length||
    atlasFiles.some(p=>typeof p!=='string'||!allowedImageTypes.test(p)||forbiddenModelTypes.test(p)))
    issues.push('Rendered-media collection must reference only PNG/WebP/AVIF images')
  if(!Number.isInteger(framesPerDirection)||framesPerDirection<2)
    issues.push('A motion atlas needs at least two independently rendered gait frames per direction')
  if(!Array.isArray(directions)||!directions.length||directions.some(n=>!Number.isFinite(n)))
    issues.push('A motion atlas must declare its rendered viewpoints')

  let cloTerms=null
  if(sourceKind==='clo-default'||sourceKind==='clo-derived'){
    cloTerms=assessExoCloAvatarWebsiteUse20261102({
      delivery:'rendered-images',
      licenseClass:license,
      attribution,
      commercialPurpose:true,
      rawModelPermission,
    })
    issues.push(...cloTerms.issues)
    if(!sourceIsCommerciallyAuthorized)
      issues.push('CLO-derived frames are not authorized until commercially licensed source rights are verified')
  }else if(sourceKind==='original-cc0'){
    if(license!=='CC0'||!sourceIsCommerciallyAuthorized)
      issues.push('CC0 source and commercial-use provenance must be confirmed')
  }else{
    issues.push('Unrecognized or unverified avatar media provenance')
  }
  return {
    allowed:issues.length===0,
    sourceKind,
    renderedOnly,
    cloTerms,
    issues,
    notice:'Images-only avoids delivery of source mesh bytes; it does not waive CLO ownership, Academic restrictions, or required CLO credit.',
  }
}

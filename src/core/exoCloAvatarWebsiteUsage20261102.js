/**
 * CLO default-avatar website use decision aid — NOT a legal opinion.
 *
 * CLO's support page explicitly permits posting default avatars on websites
 * with attribution. That does not establish that raw GLB body geometry can
 * be delivered to visitors. The authenticated local Academic license cannot
 * be assumed to cover the ClothCraft commercial website.
 *
 * Official terms: https://legal.clo-set.com/additional-clo
 * Official support: https://support.clo3d.com/hc/en-us/articles/900005482586-
 *   Can-I-use-CLO-s-default-avatars-for-posting-on-my-website
 */
export const EXO_CLO_AVATAR_ATTRIBUTION_20261102=
  'CLO Virtual Fashion, Inc. owns all rights to the avatar displayed'

export function assessExoCloAvatarWebsiteUse20261102({
  licenseClass='academic',
  delivery='browser-glb',
  attribution=EXO_CLO_AVATAR_ATTRIBUTION_20261102,
  rawModelPermission=false,
  commercialPurpose=true,
}={}){
  const deliveryModes=['rendered-video','rendered-images','browser-glb']
  const validLicense=['individual-commercial','business-commercial'].includes(licenseClass)
  const issues=[]
  if(!deliveryModes.includes(delivery))issues.push('Unknown presentation format')
  if(commercialPurpose&&!validLicense)
    issues.push('The confirmed Academic CLO installation is not licensed for commercial website work')
  if(attribution!==EXO_CLO_AVATAR_ATTRIBUTION_20261102)
    issues.push('CLO requires its specified avatar attribution for website publication')
  if(delivery==='browser-glb'&&!rawModelPermission)
    issues.push('CLO has not expressly confirmed public delivery of an extractable default-avatar 3D model')
  const isRendered=['rendered-video','rendered-images'].includes(delivery)
  return Object.freeze({
    delivery,
    publicDisplayAllowedInPrinciple:isRendered,
    sendsUnderlyingMeshToVisitor:delivery==='browser-glb',
    licenseIsCommercial:validLicense,
    canProceedUnderCheckedAssumptions:issues.length===0,
    issues,
    notice:'Terms-based engineering gate, not legal clearance. CLO owns default-avatar derivatives; website display attribution does not remove Academic license restrictions.',
  })
}

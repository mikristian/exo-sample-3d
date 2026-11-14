// Verify a generated display body's bounding geometry against the ACTUAL
// native Rust collision snapshot; independent hair/eyes are excluded.
// The visual actor is accepted only at unit scale, without a silent rescale.
export function inspectExoAvatarVisualCollider20261102(THREE, visualRoot, nativeRoot, toleranceM=.035){
  if(!THREE?.Box3||!visualRoot||!nativeRoot||!Number.isFinite(toleranceM)||toleranceM<=0)
    throw Error('Invalid EXO visual/collider alignment inputs')
  visualRoot.updateMatrixWorld(true)
  nativeRoot.updateMatrixWorld(true)
  const nativeBounds=new THREE.Box3().setFromObject(nativeRoot)
  if(nativeBounds.isEmpty())throw Error('Native fitting body has no measurable bounds')
  const candidates=[]
  visualRoot.traverse(node=>{
    if(!node.isMesh||!node.geometry?.attributes?.position) return
    // The character body is an independently skinned mesh; do not use hair
    // or eyelash geometry merely because the total actor looks similar.
    const name=String(node.name||'').toLowerCase()
    if(/hair|short0|eyebrow|eyelash|high.poly|eye|teeth|tongue/.test(name))return
    const box=new THREE.Box3().setFromObject(node)
    if(box.isEmpty())return
    const six=[box.min.x-nativeBounds.min.x,box.min.y-nativeBounds.min.y,
      box.min.z-nativeBounds.min.z,box.max.x-nativeBounds.max.x,
      box.max.y-nativeBounds.max.y,box.max.z-nativeBounds.max.z]
    const maximumM=Math.max(...six.map(n=>Math.abs(n)))
    candidates.push({node,maxErrorM:maximumM,visualBounds:box})
  })
  candidates.sort((a,b)=>a.maxErrorM-b.maxErrorM)
  const best=candidates[0]
  if(!best||!Number.isFinite(best.maxErrorM))throw Error('EXO visual body mesh is missing or invalid')
  return {matched:best.maxErrorM<=toleranceM,maxErrorM:best.maxErrorM,
    meshName:best.node.name,bodyVertices:best.node.geometry.attributes.position.count,
    toleranceM,visualBounds:best.visualBounds,nativeBounds}
}

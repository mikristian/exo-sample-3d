// Reversible appearance-only control over rigged hair meshes. This must
// NEVER mutate the native solver's collision mesh or avatar skin mesh.
export const DEFAULT_EXO_HAIR_STYLE_20261102=Object.freeze({
  visible:true,color:'#66615e',volume:1,length:1,
})
const clamp=(v,a,b)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):1
// Blender's glTF exporter can remove the separator from a dotted object
// name (`Body.short01` becomes `Bodyshort01`). Match its known terminal
// MakeHuman asset name without tagging unrelated body/eyebrow meshes.
const isHairMesh=node=>node?.isMesh&&(/(?:hair|short0[1-9]|bob0[1-9]|afro0[1-9]|ponytail0[1-9]|braid0[1-9]|long0[1-9])(?:_\d+)?$/i.test(String(node.name||'')) || /hair.*(?:fiber|cap|strand)/i.test(String(node.name||'')))

export function styleExoAvatarHair20261102(THREE,root,style=DEFAULT_EXO_HAIR_STYLE_20261102){
  if(!THREE?.Color||!root?.traverse)throw Error('An imported 3D character is required to style hair')
  const color=typeof style.color==='string'&&/^#[0-9a-f]{6}$/i.test(style.color)?style.color:DEFAULT_EXO_HAIR_STYLE_20261102.color
  const volume=clamp(style.volume,.75,1.3),length=clamp(style.length,.75,1.35)
  let count=0
  root.traverse(node=>{
    if(!isHairMesh(node))return
    count++
    if(!node.userData.exoHairRest){
      const center=node.geometry?.boundingBox?.getCenter?.(new THREE.Vector3()) ||
        (node.geometry?.computeBoundingBox?.(),node.geometry?.boundingBox?.getCenter(new THREE.Vector3())) ||
        new THREE.Vector3()
      node.userData.exoHairRest={pos:node.position.clone(),scale:node.scale.clone(),center,
        originalMaterial:node.material}
      const originals=Array.isArray(node.material)?node.material:[node.material]
      node.material=Array.isArray(node.material)?originals.map(m=>m?.clone?.()||m):originals[0]?.clone?.()||originals[0]
    }
    const rest=node.userData.exoHairRest
    node.visible=style.visible!==false
    // Fit/scalp contact stays on the original body. This is a mild stylistic
    // preview-scale approximation, not a simulated strand groom.
    node.scale.copy(rest.scale).multiply(new THREE.Vector3(volume,1+(length-1)*.45,volume))
    node.position.copy(rest.pos).add(new THREE.Vector3(
      rest.center.x*(1-volume),rest.center.y*(1-(1+(length-1)*.45)),
      rest.center.z*(1-volume)))
    const materials=Array.isArray(node.material)?node.material:[node.material]
    for(const m of materials){if(m?.color)m.color.set(color)}
    node.updateMatrix()
  })
  return {hairMeshes:count,visible:style.visible!==false,color,volume,length,
    certifiedHairSimulation:false}
}

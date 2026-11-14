// UE5 MetaHuman interoperability stage 1: GLB body preview. This format is
// independent of Unreal's native .uasset/.dna, which EXO cannot read.
// The imported mesh is never forwarded to the Rust collision solver.
export const EXO_META_HUMAN_GLB_LIMIT_BYTES_20261029 = 120 * 1024 * 1024

export function inspectMetaHumanGlb20261029(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 ||
      buffer.byteLength > EXO_META_HUMAN_GLB_LIMIT_BYTES_20261029)
    throw Error('Choose a GLB smaller than 120 MB. Export a lower-detail body LOD from Unreal if necessary.')
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== buffer.byteLength)
    throw Error('Not a valid glTF 2.0 binary GLB file.')
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength < 2 ||
      jsonLength > 4 * 1024 * 1024 || 20 + jsonLength > buffer.byteLength)
    throw Error('GLB is missing valid embedded glTF metadata.')
  let gltf
  try {
    gltf = JSON.parse(new TextDecoder('utf-8', {fatal:true})
      .decode(new Uint8Array(buffer, 20, jsonLength)))
  } catch {
    throw Error('GLB has unreadable glTF metadata.')
  }
  if (gltf?.asset?.version !== '2.0' || !Array.isArray(gltf.meshes) ||
      gltf.meshes.length === 0 || !Array.isArray(gltf.nodes) || !gltf.nodes.length ||
      !gltf.meshes.some(mesh=>Array.isArray(mesh.primitives)&&mesh.primitives.length))
    throw Error('GLB must contain a glTF 2.0 body mesh and scene nodes.')
  if (gltf.extensionsRequired?.length)
    throw Error('This GLB needs a custom glTF extension. Export a standard GLB with ordinary mesh and skin weights.')
  const skins = Array.isArray(gltf.skins) ? gltf.skins : []
  const joints = skins.reduce((count, skin) => count+(Array.isArray(skin.joints)?skin.joints.length:0),0)
  const boneNames = gltf.nodes.map(n=>String(n?.name||'').toLowerCase())
  const metahumanBoneCount = boneNames.filter(name=>/^(root|pelvis|spine_0[1-9]|neck_0[1-9]|thigh_[lr]|calf_[lr]|upperarm_[lr]|lowerarm_[lr])$/.test(name)).length
  return {
    format:'glb',
    meshCount:gltf.meshes.length,
    skinCount:skins.length,
    jointCount:joints,
    metahumanRigLikely:metahumanBoneCount>=5,
    warnings: [
      ...(skins.length===0?['No skin/joints found: this will be a static visual avatar.']:[]),
      'Visual preview only: Rust simulation still collides with the selected native fitting body.',
      'MetaHuman materials, DNA facial rigs and groom strands cannot round-trip through GLB.',
    ],
  }
}

// GLTFLoader produces metre-based Y-up geometry. Fit the imported figure to
// the ACTUAL native solver body, preserving uniformly scaled skeletal meshes.
export function fitImportedAvatarToNative20261029(THREE, importedRoot, nativeBody) {
  importedRoot.updateMatrixWorld(true)
  nativeBody.updateMatrixWorld(true)
  const current = new THREE.Box3().setFromObject(importedRoot)
  const nativeBounds = new THREE.Box3().setFromObject(nativeBody)
  // The Native 3D viewport may be open before its Rust body snapshot arrives.
  // A nominal adult visual placeholder is safe; it never affects collision.
  const target = nativeBounds.isEmpty()
    ?new THREE.Box3(new THREE.Vector3(-.25,0,-.2),new THREE.Vector3(.25,1.75,.2))
    :nativeBounds
  const currentHeight = current.max.y-current.min.y
  const nativeHeight = target.max.y-target.min.y
  if (!Number.isFinite(currentHeight) || currentHeight<=.01 ||
      !Number.isFinite(nativeHeight) || nativeHeight<=.2)
    throw Error('No measurable body height; export a full-body mesh in an upright rest pose.')
  const scale = nativeHeight/currentHeight
  if (!Number.isFinite(scale) || scale<.00001 || scale>100000)
    throw Error('GLB avatar has invalid scale.')
  importedRoot.scale.multiplyScalar(scale)
  importedRoot.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(importedRoot)
  const midpoint = new THREE.Vector3()
  const nativeMidpoint = new THREE.Vector3()
  scaled.getCenter(midpoint)
  target.getCenter(nativeMidpoint)
  importedRoot.position.add(new THREE.Vector3(
    nativeMidpoint.x-midpoint.x,
    target.min.y-scaled.min.y,
    nativeMidpoint.z-midpoint.z,
  ))
  importedRoot.updateMatrixWorld(true)
  return {sourceHeightM:currentHeight,targetHeightM:nativeHeight,uniformScale:scale}
}

// Standard Mixamo and UE MetaHuman body bones; never touch facial DNA nodes.
export function canonicalImportedWalkBone20261029(name) {
  const n=String(name||'').toLowerCase().replace(/^.*?mixamorig[_:]?/,'').replace(/^.*:/,'')
  const match=/^(thigh|calf|upperarm|lowerarm)_(l|r)$/.exec(n)
  if(match) {
    const part={thigh:'thigh',calf:'leg',upperarm:'arm',lowerarm:'forearm'}[match[1]]
    return (match[2]==='l'?'left':'right')+part
  }
  return /^(left|right)(upleg|leg|thigh|arm|forearm)$/.test(n)?n:null
}

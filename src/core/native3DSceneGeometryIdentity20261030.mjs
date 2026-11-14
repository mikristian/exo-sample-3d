// Pure read-only identity for a native Rust 3D cloth snapshot. Coordinates: metres.
// This is diagnostic metadata; it never transforms the solver's vertex arrays.
const MAX_VERTICES=2_000_000
const MAX_TRIANGLES=4_000_000
export function selectNative3DSceneGeometryIdentity20261030(snapshot){
  if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||
     !Array.isArray(snapshot.positions)||snapshot.positions.length>MAX_VERTICES||
     !Array.isArray(snapshot.triangles)||snapshot.triangles.length>MAX_TRIANGLES)
    return null
  const finitePoint=p=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite)
  if(!snapshot.positions.every(finitePoint)||!snapshot.triangles.every(t=>
    Array.isArray(t)&&t.length===3&&t.every(i=>Number.isSafeInteger(i)&&i>=0&&i<snapshot.positions.length)))return null
  return Object.freeze({format:'exo.native-3d-scene-identity.v1',sourceRevision:snapshot.revision,
    nativeCoordinateUnit:'m',vertexCount:snapshot.positions.length,triangleCount:snapshot.triangles.length})
}

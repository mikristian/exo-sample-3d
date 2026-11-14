// A CUT LWPOLYLINE is physical XY vertex data, not two independently
// indexable lists of group-10 and group-20 values. Refuse ambiguous pairing.
// This is a source-only inspection invariant, not factory release approval.
export function assertOrderedCutLightVertexPairs20261029(record) {
  let awaitingY = false
  let vertexCount = 0
  for (const {code} of record) {
    if (awaitingY) {
      if (code !== 20) throw Error('CUT LWPOLYLINE group 10 must be immediately followed by group 20')
      awaitingY = false
      continue
    }
    if (code === 20) throw Error('orphan or duplicate CUT LWPOLYLINE group 20')
    if (code === 10) {
      awaitingY = true
      vertexCount++
    }
  }
  if (awaitingY) throw Error('CUT LWPOLYLINE final group 10 has no group 20')
  return vertexCount
}

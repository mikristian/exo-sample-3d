// Versioned Node/Swift/editor bridge contract; NOT an attestation of the
// native Rust solver executable or a substitute for release provenance.
// A breaking workspace HTTP, DTO or authentication change must bump this ID.
export const EXO_WORKSPACE_BRIDGE_PROTOCOL='exo.workspace.bridge.v2'
export const EXO_WORKSPACE_BRIDGE_CAPABILITIES=Object.freeze([
  'workspace-bearer-required',
  'native-snapshot-revision',
  'native-2d-edit-and-undo',
  'six-size-grade-run',
  'native-linked-history',
  'native-mirror-exclusive-owner',
  'snapshot-metadata-v1',
  'agent-ui-bearer-required',
])

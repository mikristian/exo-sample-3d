# Simulation Backend API

The backend API allows multiple cloth engines to simulate the same garment document.

## Protocol

Defined in `src/core/backends/protocol.js`.

A request contains:

- protocol/version
- project identity/revision
- avatar measurements/reference
- normalized physical fabrics
- pieces with centimeter pattern geometry and sampled boundaries
- sewing constraints and treatment metadata
- fasteners/attachments
- simulation settings
- requested output channels

## JavaScript backend shape

A registered backend implements at minimum:

```js
{
  id,
  create(project),
  step(session, dt)
}
```

Recommended methods:

```js
reset(session, project)
getStats(session)
getPieceState(session, pieceId)
dispose(session)
```

Backends publish a capabilities object so UI and tests can degrade gracefully instead of assuming every solver supports every feature.

## Output convention

World-space positions use meters. Pattern authoring remains centimeters in the canonical document. Piece IDs must remain stable. Results should expose finite positions and, where supported, normals, contact/pressure and strain.

## External backends

Native/CUDA/remote backends should consume the serialized protocol rather than application-specific React state. They may return streamed frames, cache files or a final state, but must retain piece/vertex provenance.

## Validation

`npm run check:backend` verifies the current backend contract. `npm run check:native-xpbd` validates the native PositionBasedDynamics integration proof on supported developer machines.

# Architecture

## Principle

The garment document is the product. Solvers, renderers and editors are replaceable views/processors of that document.

## Canonical layers

### Garment document

Owns pattern points/curves, seams, allowances, internal lines, grading, trims, fabrics, avatar references, POMs, marker settings and production metadata.

### Pattern engine

The existing JavaScript CAD layer remains directly editable. GarmentCode/PyGarment is bridged through `src/core/garmentCode.js` for parametric garment generation and interchange.

### Simulation backend API

`src/core/backends/` defines a backend-neutral request and registry. The current browser PBD implementation is the first backend. Native XPBD/PBD, Metal, XRTailor and learned backends are expected to conform to the same document-level contract.

### 3D platform

The current web viewport remains useful for rapid iteration. Blender is the target native 3D platform for mature scene management, avatars/rigging, animation, Eevee/Cycles, UVs/materials and broad format interoperability.

### Production engine

DXF, markers, POMs, grading, tech packs and factory packages remain Garment Studio-owned so production data does not depend on a renderer or simulation engine.

## Dependency direction

UI -> garment document -> adapters/backends

A backend must not import application UI code. Production exporters must not require a particular simulation backend. Research backends should live behind an adapter until proven stable.

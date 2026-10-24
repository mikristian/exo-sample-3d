# Modified ClothCraft source snapshot

This directory records the 184-file source snapshot from the EXO developer checkout, including the previously unpublished modified Rust solver and exo-session/cutline implementation, Cargo manifests and lockfile, WGSL shaders, tests, scripts, and upstream licensed assets. Upstream base: `20b4db9064e5195f1843a9d75708fb77b6989eba` of `erythrofr/ClothCraft`.

The manifest records SHA256 of every captured file. The complete upstream MIT LICENSE is retained; MakeHuman asset CC0 notices and provenance are retained. The older upstream THIRD_PARTY_NOTICES source-license paragraph predates the explicit MIT LICENSE and is preserved verbatim, not treated as permission to relicense third-party assets. Cargo dependencies retain their own licenses.

## Scope and release limits

This is a reviewable source snapshot, NOT a certificate that the existing internal r5 DMG was built from this revision. The Swift shell, JavaScript frontend, C++ components, WASM kernels and all binary dependencies still require a complete pinned build manifest and clean rebuild before public installer release. The draft installer remains unpublished. No notarization is required for the disclosed beta, but the native Swift app still needs independent clean first-launch testing.

The new source CI checks the Rust fork independently; it does not certify the full desktop installer, asset licensing, Gatekeeper behavior, industrial fit or manufacturing readiness. No private CLO assets, developer build artifacts, nested git metadata or credentials are included in this snapshot.

# Blender Bridge

This bridge imports a canonical Garment Studio garment document into Blender without making Blender the owner of production data.

Current proof imports:

- editable 2D pattern meshes
- separate 3D arranged garment meshes
- fabric/material metadata
- seam relationship objects and seam custom properties
- avatar measurements and a temporary measurement-driven mannequin proxy
- garment/piece/fabric/layer custom properties
- solidify thickness for preview rendering

The 2D pattern and sewing-guide collections are hidden from beauty renders but remain in the `.blend` scene.

## Run

```bash
node scripts/export-blender-fixture.mjs tee blender_bridge/fixtures/tee.garment.json
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python blender_bridge/import_garment.py -- \
  --input blender_bridge/fixtures/tee.garment.json \
  --output blender_bridge/output/tee.blend \
  --render blender_bridge/output/tee-preview.png
```

Or:

```bash
npm run check:blender
```

Future bridge work should replace the temporary avatar proxy with a rigged parametric avatar and should feed simulated garment meshes/caches into the same scene objects rather than changing the production document schema.

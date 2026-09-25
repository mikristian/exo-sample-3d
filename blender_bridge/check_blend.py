import json
import sys
import bpy

expected_pieces = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 0
expected_seams = int(sys.argv[sys.argv.index('--') + 2]) if '--' in sys.argv else 0
patterns = bpy.data.collections.get('Patterns_2D')
garment = bpy.data.collections.get('Garment_3D')
seams = bpy.data.collections.get('Sewing_Relationships')
actual_patterns = len(patterns.objects) if patterns else 0
actual_garment = len(garment.objects) if garment else 0
actual_seams = len(seams.objects) if seams else 0
piece_metadata_ok = bool(garment) and all(obj.get('garment_piece_id') for obj in garment.objects)
seam_metadata_ok = bool(seams) and all(obj.get('garment_seam_id') for obj in seams.objects)
passed = (
    actual_patterns == expected_pieces and
    actual_garment == expected_pieces and
    actual_seams == expected_seams and
    piece_metadata_ok and seam_metadata_ok
)
print(json.dumps({
    'patterns': actual_patterns,
    'garmentPieces': actual_garment,
    'seams': actual_seams,
    'pieceMetadata': piece_metadata_ok,
    'seamMetadata': seam_metadata_ok,
    'passed': passed,
}))
if not passed:
    raise SystemExit(1)

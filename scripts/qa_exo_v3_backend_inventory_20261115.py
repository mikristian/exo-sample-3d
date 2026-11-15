#!/usr/bin/env python3
"""Auditable, deterministic 41-system EXO V3 Rust migration inventory. Not completion claims."""
import argparse,csv,re
from pathlib import Path
from io import StringIO
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'docs/rust-migration'
CSV=DIR/'EXO_V3_41_SYSTEM_RUST_STATUS_20261115.csv'
DOC=DIR/'EXO_V3_STAGE_A_STATUS_20261115.md'
EVIDENCE={
 '003':('IN_PROGRESS_RUST_PEN_WASM','Rust VectorCraft pen tangent/Bézier/nearest-curve kernel loads in React; other geometry buttons pending'),
 '002':('PARTIAL_RUST_PEN_PREVIEW','Pen smooth/corner and handle math use source-built Rust/WASM; snapping and other 2D tools need parity'),
 '037':('PARTIAL_EXISTING_RUST','Rust ClothCraft engine exists; canonical V3 EXO model not unified'),
 '001':('BLOCKED_CANONICAL_MODEL','EXO React JS draft and ClothCraft session may diverge'),
 '033':('IN_PROGRESS_TYPED_BRIDGE','React hook now invokes typed command dispatcher; 4 JS and 10 Rust tests pass'),
 '029':('PARTIAL_EXISTING_RUST','Native document/history linked in tee QA, not full V2 import parity'),
 '006':('PARTIAL_EXISTING_RUST','Native six-size grading in real tee QA; all button parity not verified'),
 '008':('PARTIAL_EXISTING_RUST','Native seam references present; full UI sewing parity not verified'),
 '010':('PARTIAL_EXISTING_RUST','Notches, allowances, cutlines in scoped native tee QA'),
 '011':('PARTIAL_EXISTING_RUST','Rust six-size mesh generation exists; full topology parity open'),
 '012':('RUST_PHYSICAL_FIT_FAIL','Native CPU solver runs; tee strain and 3D seam closure fail'),
 '013':('PARTIAL_EXPERIMENTAL','Rust contact path exists; fit not certified'),
 '014':('PHYSICAL_FIT_BLOCKED','Six-size tee physical fit rejected'),
 '023':('PARTIAL_EXISTING_RUST','Native DXF exported; receiving CAD approval open'),
 '025':('PARTIAL_EXISTING_RUST','Native grading QA exists; factory approval open'),
 '039':('PARTIAL_REACT_RUST_BRIDGE','Native workspace hook connected to typed Rust command route'),
}
def produce():
    with (DIR/'systems.csv').open(newline='') as f: systems=list(csv.DictReader(f))
    assert len(systems)==41 and len({s['issueId'] for s in systems})==41
    source=(ROOT/'src/components/ClothCraftWorkspace.jsx').read_text()
    ops=[(m.group(2),source.count('\n',0,m.start())+1) for m in re.finditer(r"\brequest\s*\(\s*\{\s*op\s*:\s*(['\"])([a-z][a-z0-9-]+)\1",source)]
    names=sorted({name for name,_ in ops})
    assert ops and {'snapshot','edit','undo'}<=set(names)
    assert 'dispatchRustWorkspaceCommand20261115' in (ROOT/'src/hooks/useNativeWorkspaceRequest.js').read_text()
    assert 'check_native_workspace_command' in (ROOT/'rust/exo_command_contract/src/workspace.rs').read_text()
    fields=['system_id','priority','name','phase','historical_rust_lines_percent','status','evidence_or_blocker','verified_all_buttons']
    buf=StringIO(newline='');w=csv.DictWriter(buf,fieldnames=fields,lineterminator=chr(10));w.writeheader()
    rows=[]
    for s in systems:
        n=s['issueId'][-3:]
        phase='B_DEFER_UI' if n in ('036','040') else 'A_THEN_B' if n=='039' else 'A_BACKEND'
        state,note=EVIDENCE.get(n,('NOT_VERIFIED','Needs actual UI handler, Rust parity and negative tests'))
        if phase=='B_DEFER_UI':state='DEFER_UNTIL_RUST_BACKEND_PASSES';note='Existing React/macos host remains until Stage A complete'
        row=dict(system_id=s['issueId'],priority=s['priority'],name=s['name'],phase=phase,
                 historical_rust_lines_percent=s['rustSourcePercent'],status=state,
                 evidence_or_blocker=note,verified_all_buttons='NO')
        rows.append(row);w.writerow(row)
    lines=[
     '# EXO V3 41-system React/Rust/ClothCraft conversion status',
     '',
     'Date: 2026-11-15; baseline EXO GitHub commit 7a06468f037292fd02161b268ff4a8ef7b61f77c.',
     '',
     'Scope: existing active EXO functionality first, keep React unchanged, migrate authoritative backends to Rust/ClothCraft, then gradually migrate UI.',
     '',
     'No system is currently marked full per-button Rust parity. Existing Rust code, 2D/3D simulation smokes, and historical source-language percentages are not complete feature-conversion metrics.',
     '',
     'The V3 React Hybrid today launches the exact V2 React interface and V2-derived Rust/ClothCraft exo-session. The separate native egui V3 is not yet the same canonical garment backend.',
     '',
     'New Expansion source change: native React request hook now dispatches through validated command serializer; 4 JavaScript and 10 Rust command-contract tests passed. This source change has not been installed into the already-running V3 hybrid preview.',
     'New VectorCraft-derived Rust pen kernel: tangent snapping, cubic Bézier evaluation, anchor smooth/corner classification and opposite handle math execute in WASM when the source-built module loads; 7 native Rust tests, 29 focused JavaScript pen regressions, and real Rust Polygon commit/Undo/Redo QA pass. This preserves the original JS preview before WASM startup. The final Polygon edit goes to the native Rust session, but browser pointer-event and full pen system parity are not yet certified.',
     '',
     'Observed static native request calls in ClothCraftWorkspace.jsx: '+str(len(ops))+' occurrences with '+str(len(names))+' distinct literal op names. Dynamic commands and UI events are NOT included, so no total-button count is claimed.',
     '',
     'Literal ops: '+', '.join(names)+'.',
     '',
     'Six-size tee Rust physics remains physically rejected (large seam gap/excess strain); migrated source does not certify garment fit.',
     '',
     '| ID | Priority | System | Status |',
     '|---|---|---|---|'
    ]
    for row in rows:lines.append('| '+row['system_id']+' | '+row['priority']+' | '+row['name'].replace('|','/')+' | '+row['status']+' |')
    lines.extend(['','## Required next gates','',
      '1. One authoritative versioned Rust garment document shared by EXO and ClothCraft. Stable piece, seam, grade IDs and units; verified V2 import and cold-open Undo/Redo.',
      '2. Complete per-UI-button inventory and move each actual drafting, grading, sewing, measuring and manufacturing computation to Rust.',
      '3. Test each command via React -> authenticated Rust RPC -> same revised garment/mesh -> save/reopen/Undo/Redo, including malformed and stale input.',
      '4. Validate mesh, real ClothCraft solver and independent factory receiver/physical fit gates separately. Current physical tee fit is a known rejection.',
      '5. Only after Stage A passes, convert React screens incrementally into Rust egui/wgpu views.',
      '',
      'Machine-readable status: EXO_V3_41_SYSTEM_RUST_STATUS_20261115.csv. Regenerate: python3 scripts/qa_exo_v3_backend_inventory_20261115.py --write; verify: --check.',
      ''])
    return buf.getvalue(),'\n'.join(lines)
def main():
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');p.add_argument('--check',action='store_true');a=p.parse_args()
    csv_text,doc=produce()
    if a.write:CSV.write_text(csv_text);DOC.write_text(doc);print('GENERATED',CSV.name,DOC.name)
    if a.check:
        assert CSV.read_text()==csv_text,'CSV stale'
        assert DOC.read_text()==doc,'Report stale'
        print('PASS: 41 systems, native React hook, Rust workspace contract, static request audit')
    if not(a.write or a.check):print(doc[:1200])
if __name__=='__main__':main()

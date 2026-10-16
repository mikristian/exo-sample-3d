# EXO CLO-class rebuild: complete remaining-work engineering specification

**Snapshot:** 2026-10-16. **Nature:** detailed execution plan with dated source annexes. It is not a claim of verified CLO equivalence, certified physics, or factory approval.

## Deliverables

- `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.pdf`: primary paginated reference, **270 pages**, 188 PDF bookmarks, about 99,000 extracted words.
- `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.docx`: editable Word version, with 94,000+ extracted words.
- `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.html`: source for print layout and linked index.
- `EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16.md`: easy-to-edit planning index and individually enumerated catalog/tool entries.
- `manifest.json`: exact 70-slot CLO7 capability inventory, code-linked domain sections, 400-material evidence counts, official references, and navigation IDs.
- `render-validation.json`: actual page count, bookmark count, extracted word count, and QA results.
- `qa/`: selected PDF page previews for visual review.

## Coverage

The primary document contains 176 indexed requirement sections (45 core architecture, 15 integration, 70 individual live CLO7 toolbar slots, 40 groups of ten exact fabric records, and introductory/verification sections) plus 11 dated research annexes. Native support classification comes from `src/core/clo7NativeToolCapabilities.js` at this snapshot: 11 native routes, 9 inspection-only, 50 unavailable. The 400 fabric records are construction estimates; physical calibration and external manufacturing acceptance remain explicit gaps.

## Rebuild

```bash
python3 docs/master-spec-2026-10-16/render_master_spec.py
```

Requirements: repository-local Node modules, Python 3 with PyMuPDF, macOS `textutil`, and Google Chrome. The command reads current repository sources, regenerates HTML/Markdown, prints PDF and DOCX, adds navigation bookmarks, and validates the PDF page count and content index. No EXO application source files are modified.

Do not treat an older pass claim in the dated annexes as a current native or solver acceptance. The current dated source paths and exact QA fixtures remain authoritative.

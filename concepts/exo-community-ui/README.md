# EXO Community + Pattern Lab — UI Research Prototype

**Status:** Isolated local interaction prototype, not the deployed EXO application or connected marketplace. Edition Three redesign completed October 16, 2026, with editorial dark discovery, interactive reference garments, an immersive specimen book, and linked Pattern Lab. Nothing in this folder imports assets into the native EXO engine.

## Launch and test

From the EXO repository root:

1. Run a local-only static server: `python3 -m http.server 5499 --bind 127.0.0.1 --directory concepts/exo-community-ui`
2. On the same Mac, visit `http://127.0.0.1:5499/`.
3. Run the isolated browser QA: `node concepts/exo-community-ui/qa-ui.mjs`.

The QA starts its own ephemeral local server, uses installed Google Chrome in headless mode, generates screenshots in `previews/`, and shuts down after testing. It never touches the EXO Rust service, saved garments, or any remote accounts. No dependencies beyond existing project `playwright-core` and locally installed Chrome were introduced.

## Prototype interactions

### Fabric Store / CLO-SET Connect reference

- The **Fabrics** navigation opens the dark EXO Fabric Store; a refreshable direct link is http://127.0.0.1:5499/#fabrics. It is inspired by [CLO-SET Connect's public Fabric Store](https://connect.clo-set.com/store/fabric) but uses an original EXO layout, colors and procedural imagery.
- The store reads fabric-index.json, generated from the actual EXO FABRIC_PRESETS: **400 specifications (80 archetypes, 320 derived variations)**. Physical values remain estimates until validated. The source does not specify precise fiber composition, so composition family and suggested uses are marked inferred.
- The ten public CONNECT filter headings are supported (Fabric Type, Composition, Usage Type, Season, Color, Pattern, Physical Property, Supplier, Official, Price), with options grounded in the local EXO catalog. Search, sort by mass/name or derived treatment, filter chips/reset, saved-only view, 24-at-a-time pagination and an expanded fabric information inspector work in the local concept.
- Fabric bookmarks remain on the same browser in local storage across reloads; they are private to that browser origin and cannot be shared or purchased. The detail inspector has Escape-to-close, focus containment, and a fixed close control on small screens.
- Mobile includes an expandable filter sheet and touch-friendly material card/detail layout. The rest of the existing EXO Community and Pattern Lab workflows are retained.
- After EXO source presets change, regenerate the static fabric index from the repo root with: node concepts/exo-community-ui/scripts/export-exo-fabrics.mjs. The prototype server does not automatically rebuild it.
- The external CLO-SET CONNECT link opens the real marketplace. **There is no account login, CLO-SET API integration, third-party seller inventory, purchase flow, licensed scan import or automated synchronization.**
- CLO_CONNECT_FABRIC_REFERENCE.md distinguishes verified public interface details from unverified content hidden behind dynamic storefront loading.

### Edition Three / full redesign

- Brand-new editorial homepage: graphite/forest-black and pale-chartreuse palette, 3D draggable hero garment, oversized typographic lead, curated pattern-and-material features, and functioning entry to Pattern Lab.
- Completely recomposed discovery: three-column full-bleed model/material previews on desktop, two-column responsive mobile cards, numbered objects, clearly distinguished creator/category/source details, readable descriptions and concise controls. The material category uses tactile layered textile studies rather than the previous generic swatch icon.
- Product detail pages use an enlarged 3D/2D reference stage, a quieter specification hierarchy, clear access and rights controls, and a matching dark specimen-book materials workroom. Materials have their own large textile-sheet hero view.
- Garment-specific previews for Arc Shoulder Hoodie, padded cropped Moto Layer, Selvedge Straight Denim and modular Rib Collar System. Their 2D flat reference shapes and material defaults match the design object.
- Existing category, filter, search, grid toggle, studio navigation, creator profile, technical package and rights wizard remain working and were tested after the redesign. The site keeps all interaction data local.
- Visual review evidence lives in `previews/01-website-desktop.png`, `previews/04-website-mobile.png`, `previews/09-full-asset-page.png`, and `previews/15-moto-garment-detail.png`. Detailed change rationale and verification are in `EDITION_THREE_QA.md`.

- Main site: Discover, Patterns, Materials, Studios and Creators, filter discipline, license, file format and remix status, clear individual/all filters, search, sorting and grid density.
- Detail: click a card, switch Overview / Specifications / License, save to a session-local sample collection, and inspect asset in Pattern Lab.
- EXO app concept: click `Preview Pattern Lab`, open the resizable-in-future dark dock mock, search/filter assets, view compatibility/rights, show a harmless 2D overlay, and add a **free demo asset only** to an in-memory library counter.
- Restricted assets: View Only and paid examples are not downloadable or actually importable; the prototype explains why.
- Team: `For teams` → `Interactive Tech Pack`; compare illustrative R01/R02 cuff measurements, switch Designer/Manufacturer, inspect 2D/3D/Reference display modes, and submit an in-memory demo note.
- Creator profile: use the MK avatar in the header; switch featured Work, Patterns, Materials and About, and view the source-protected editorial portfolio. No actual follow or social account is created.
- Publishing wizard: `Share your work` walks through an asset description, private/view-only/free/paid rights, explicit file selection, and a final anonymous preview. In **visual-only** mode, editable DXF patterns, grading, and factory Tech Packs are locked; no real upload is possible.
- Mobile: catalog grid, two-row header with all five categories visible, filter drawer and Pattern Lab overlay are responsive; keyboard search `/` or `Cmd/Ctrl+K`, Escape dismisses modal. Production color-contrast auditing remains planned.
- Complete asset detail: procedural rotating 3D garment study with select/highlight panel regions, switchable 2D cut-piece diagrams and wireframe controls. An **Expand View** action opens a keyboard-accessible full-screen study, with explicit 3D / 2D / wireframe view modes, focus containment, Escape-to-close and mobile layout. Mouse/pointer orbit and keyboard arrow orbit work without external libraries. The jeans study has separate leg sections and a waistband; the Rib Collar System uses ring/cuff geometry and corresponding flat panel references.
- Materials: six study swatches (French terry, denim, cotton twill, nylon ripstop, leather and canvas), with deterministic close-up textures, four colorways apiece, zoom, and separate optical appearance/illustrative physical fields. Selecting a material in the full pattern asset updates the 3D preview material.
- Pattern Lab: linked interactive reference garment viewport and compact textile inspection panel, with garment-aware 2D boards for denim legs and rib collars/cuffs. Select a 2D panel to highlight its region in the reference 3D viewport and update the mock Property Inspector. The original hoodie 2D drafting illustration remains the default. Demo preview and mock library never alter native garment state.

## Files

- `fabric-store.js` / `fabric-store.css`: custom dark fabric catalog, ten filters, search, saved references, detailed inspector, mobile behavior.
- `fabric-index.json` / `scripts/export-exo-fabrics.mjs`: source-derived, lightweight index of all 400 EXO specifications, exportable again when source changes.
- `index.html`: stand-alone semantic markup for both public site and simulated CAD workspace.
- `styles.css`: editorial website, responsive cards and modal, dark Pattern Lab, sample Technical Pack UI.
- `dark-studio.css`: unified charcoal/slate visual design across the public site, asset details, creator profiles, technical packages and editor mock.
- `edition-three.css`: third-edition editorial system, reorganized discovery page, large technical preview cards, responsive homepage, quieter full asset page, fully dark specimen-book atlas and mobile legibility fixes.
- `pattern-visualizer.js` / `pattern-visualizer.css`: stand-alone offline procedural 3D garment and 2D panel reference viewer.
- `materials-experience.js` / `materials-experience.css`: stand-alone procedural textile atlas, colorway selector, surface/physical data inspector.
- `screens-v2.css` / `screens-v2.js`: fully designed asset-detail page, role-aware Tech Pack extension, and four-stage privacy-first publishing wizard; no real upload or account actions.
- `app.js`: eight original fake sample assets, custom vector garment illustrations and client-only interaction state.
- `qa-ui.mjs`: deterministic browser interaction and screenshots.
- `previews/01-website-desktop.png` and `04-website-mobile.png`: public site.
- `previews/02-asset-detail.png`: sample detail.
- `previews/03-app-pattern-lab.png` and `05-app-pattern-lab-mobile.png`: in-app concept.
- `previews/06-web-techpack.png`: manufacturer and revision sample.
- `previews/07-creator-profile.png`: complete editorial creator profile.
- `previews/08-publish-rights-wizard.png`: sample source protection and publish preview.
- `previews/09-full-asset-page.png` / `previews/10-full-asset-mobile.png`: expanded asset-detail design on desktop and mobile.
- `previews/12-denim-pattern-preview.png`, `previews/13-rib-collar-cuff-preview.png`, `previews/15-moto-garment-detail.png`: silhouette-specific 3D/2D studies.
- `previews/16-expanded-pattern-studio.png`, `previews/17-expanded-pattern-mobile.png`: desktop/mobile inspection mode.

The full product design system, source-of-truth boundary and implementation milestones live in [EXO premium Community / Pattern Lab UI master](../../docs/EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_MASTER_2026-10-16.md).
The [round-two screen evidence and production acceptance plan](../../docs/EXO_COMMUNITY_UI_ROUND2_SCREEN_EVIDENCE_AND_BUILD_PLAN_2026-10-16.md) explains the ten reviewed screenshots and the exact security, import and collaboration boundaries.
The complementary [UI/UX production specification](../../docs/EXO_COMMUNITY_PATTERN_LAB_PREMIUM_UI_UX_SYSTEM_2026-10-16.md) details access rights, type-specific imports, responsive behavior, future component/API boundaries and complete asset flows.

## Explicit limitations

No real accounts, backend, purchased licenses, payment settlement, social features, source upload, downloadable patterns, dynamic cloth, physics contact, production Tech Pack release, or app-native import bridge. Assets, prices, names and manufacturing measurements are fictional design samples. Interactive mesh and flat pattern geometries are original procedural references, **not** CLO files, fitted real garments, validated sewing lines or actual DXF imports. PBR surfaces and physical metrics are illustrative, not measured supplier swatches. Preview is a UI study, not a working pattern import. No external model images, proprietary marketplace assets or network fonts are loaded.

The proposed production Pattern Lab must be added with typed, version-guarded, rights-checked actions to the existing EXO workspace; do not swap the actual Pieces/Seams/Library/History editor controls with this mock.

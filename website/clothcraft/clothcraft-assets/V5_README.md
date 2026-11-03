# ClothCraft Assets V5 — Homepage navigation + media pass

**Preview:** http://127.0.0.1:8100/clothcraft-assets/

## Navigation (purposeful distinction)

- The new top-level **← ClothCraft Home** button always goes to the main ClothCraft website at `/`.
- The logo and the **Home ↗** header link also go to the main ClothCraft website.
- **Assets Home** remains inside the Assets marketplace and navigates to `#home`.
- The site switcher also offers Studio, Features and AI Credits, matching routes on the ClothCraft main site.
- Marketplace, Discover, community, creator pages and the Pattern Lab workflow retain their existing internal controls. The original prototype in `concepts/exo-community-ui/` has not been changed.

## Media and motion

- Featured card order now prioritizes the original denim garment study, moto construction reference, architectural stage and fabric research instead of showing only environment stages.
- The denim and moto features have authentic multi-angle project-detail galleries with thumbnails and previous/next navigation. They are correctly labeled digital development renders, not photographed physical products or verified fit results.
- `project-media/denim501-editorial.webp` is a close editorial crop of the original `project-media/digital-denim-501.jpg`, with mild tonal/detail enhancement.
- `project-media/moto-editorial.webp` is a shadow-lifted original garment development render based on `moto-concept-front.webp`. Neither asset adds fabricated detail.
- `assets-v5.js` adds a native horizontal scroll-snap editorial photo rail with six curated images, keyboard support, buttons, touch swipe and image click-to-inspect interactions.
- A fast-cut montage of **real ClothCraft Studio V2 footage** appears in its own cinematic panel. It tilts at the beginning and straightens as the section scrolls into view. Media plays only when visible, includes a play/pause control, and honors reduced-motion preferences. Source is `../assets/feature-montage.mp4` built from 12 recorded interface chapters in the website V3 milestone.
- `assets-v5.css` aligns the portal with the main ClothCraft site's black / graphite / electric-blue design palette without replacing the existing marketplace filters, item views, or content.

## Integration

Changes are scoped to `website/clothcraft/clothcraft-assets/` only. New modules are imported in this standalone copy's `app.js` after the original `mountProjectHomepage()` initialization, so every section stays inside `#project-home` and automatically hides when browsing other community routes. The original source project remains untouched; a pre-V5 snapshot of the copied site's key files is preserved at `website/clothcraft/.snapshots/v4-assets/`.

## QA

```sh
node website/clothcraft/qa/assets-v5-check.mjs
```

The browser test verifies navigation home, the two distinct Home links, six photo cards, image gallery next buttons, project details, video playback, responsive overflow, and reduced-motion opt-in playback at 390 / 768 / 1440 pixels. Additionally checked 320 / 390 / 768 / 1100 / 1440 pixel widths. No external image licenses or proprietary CLO3D media were introduced.

**Still prototype-only:** user accounts, live publishing, community submissions, backend assets purchases or production-ready workflows are not enabled merely by this marketing update.

## V6 verified-media curation (2026-10-22)

The V5 material was too broad for the quality bar. V6 narrows the *promoted gallery and the Assets project catalog* to **actual ClothCraft program captures**, with one specific exception requested by the user: the Nike graphic T-shirt recovered from a saved ClothCraft project and rendered as a still (its provenance is labeled and it is not presented as a direct screenshot).

- **Removed from the live curated media:** 501 denim study, concept moto hoodie, cathedral/architectural gallery, and draft stage presets R02, R03, S01, S10. Those original media files remain in the archival source folders but are no longer featured in the running Assets site.
- **One approved studio:** `stage-EXO01` is the only native stage asset in the marketplace catalog. A separate `capture-stage` is a *screenshot of the app's stage workflow*, not a second studio environment.
- **Verified captures:** `app-captures/*.webp` are 10 optimized WebP conversions from the project's existing screen-recorded ClothCraft Studio video and original app screenshots. Original images are unchanged. They portray live UI, garment pattern lines, connected 2D/3D views, material panels, construction controls, and avatar editing.
- **Hero and selection:** curated cards draw from saved Nike reference + actual UI screenshots. The weak multi-angle denim-only section was removed entirely. The **approved EXO01 poster remains available within the Scenes marketplace**, but is excluded from the rotating visual hero to keep it focused on the real application.
- **Site functionality unchanged:** gallery orbit, detail modal, horizontal editorial cards, video showcase, filters, real garment preview, marketplace routing, and ClothCraft Home link remain functional.

Updated browser checks:

```sh
node website/clothcraft/qa/assets-v6-curation.mjs
node website/clothcraft/qa/assets-v5-check.mjs
node website/clothcraft/qa/assets-v5-regression.mjs
```

`assets-v6-curation.mjs` checks the approved studio allowlist, no unsupported images in the hero/curation, 5 widths (320–1440px), browser page errors, missing images and layout overflow. The demo is still a local concept site; publishing, licensing and real community-backed accounts are separate future tasks.

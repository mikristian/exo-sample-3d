# ClothCraft Studio — Website V3

A self-contained, dark graphite / blue / white marketing page inspired by the quality and motion language of premium software websites. The page is **independently designed**, uses original ClothCraft copy and shows only the real recorded ClothCraft software UI, not proprietary CLO screenshots, videos, or code.

## Local preview

From the EXO root:

```bash
node website/clothcraft/serve.mjs
```

Open **http://127.0.0.1:8100/** on the connected Mac. The preview server is loopback-only, not public hosting. It supports byte range responses for media playback. No front-end package install or build step is needed.

## Official ClothCraft brand identity

- `assets/clothcraft-logo.svg` is the official full **CLOTHCRAFT** wordmark supplied by the project owner (original black SVG paths, custom geometric A and segmented C). Do not retypeset it with a substitute font.
- `favicon.svg` contains the same five-piece C from the wordmark, in white on a charcoal rounded-square tile for small-screen recognizability.
- `site-brand-logo-20261101.css` sizes the shared identity across the homepage, editorial pages, download page, Marketplace and Assets. Light-on-dark treatments use CSS inversion; the source vector remains black.
- The homepage hero uses background slices of the **actual SVG**, preserving the existing individual-letter scroll motion. The Press Kit links to both downloadable source vectors.

## Studio V2 appearance preview (site-wide)

The optional website **Studio themes** feature is currently archived and disabled across the site. Its JavaScript, presets, and CSS adapters are preserved at `.archives/20261101-studio-themes/` so the full implementation can be restored later. No page currently loads the Studio theme widget, and this change does not affect theme controls inside the native ClothCraft app.

The theme build and QA scripts remain in `tools/` and `qa/`, but depend on restoring the archived assets before use. Existing browser `localStorage` entries for theme preferences are deliberately left untouched; they are ignored while the feature is disabled.

## Clear-glass navigation and About-page editorial redesign

- Shared Product, Open Source and About dropdowns have different Studio-palette-aware blue, green and violet **clear dyed glass**. Unlike frosted surfaces, normal menus use ~28% tint with 3px blur; when Liquid Glass is on, they use ~20% tint with **2px blur**. Backdrop brightness and a subtle page dimmer during desktop menu interactions improve readability while keeping the underlying layout visible. Thin glass highlight borders and darker translucent link rows preserve contrast. Assets Discover receives the same treatment in its own hue. Other website Liquid Glass surfaces now use ~32% tint with 3px blur rather than cloudy 74% opacity / 19px blur.
- The homepage's bottom final CTA/footnote now uses flat colors. The previous 100px blurred glow element is disabled, as are decorative gradients across themed pages.
- `/about/` uses a dedicated `about-editorial.css` rather than the generic multi-card inner-page template. It features real Studio screenshots, a visual mission, an honest account of experimental capabilities and clear contribution journeys. No fictional social proof, fabricated team biography or invented production certifications are added.
- Local visual audit and next prioritized redesign steps: `qa/visual-audit-2026-10-22.md`.

```bash
node website/clothcraft/qa/nav-liquid-glass.mjs
node website/clothcraft/qa/studio-v2-theme.mjs
node website/clothcraft/qa/multipage.mjs
```

## V3 changes

- Sticky Apple-inspired navigation with white `Download` and blue `Start free` controls, responsive collapsed menu, keyboard Escape support, and active section indicator.
- New cinematic hero: 3D perspective tilt (`rotateX/Y/Z`) transitions into a flat, full-size UI showcase as the page scrolls. The hero title gently fades while the software screen moves upward. This is original CSS and a lightweight `requestAnimationFrame` scroll handler, not copied source code.
- Original **12-cut, ~18s** high-speed montage, composed from authentic ClothCraft screen recordings. Live chapter labels, a progress rail and a play/pause control accompany the footage. Source shots are indexed in `qa/build-montage.py`.
- A horizontal workflow gallery of **six** demonstrations, navigable by touch swipe, keyboard arrows, mouse wheel, and prev/next arrows. Active media plays automatically when visible unless the user requests reduced motion; any visitor can manually play/pause it.
- Six deeper detailed chapters: linked workspace, materials, stage presentation, 2D drafting, construction, 3D view.
- Complete site palette converted to near-black, graphite, steel and electric blue, including features, cards, FAQ, source section, pricing example, and CTAs. All prior green styling removed.
- Expanded accessible control labels, reduced-motion support, lazy video loading for gallery cards, scroll-limited playback, semantic headings, and focus rings.

## Media source and reproduction

`assets/studio.webm` originates from `promo/clothcraft/capture/actual-ui.webm`. Evidence is documented in `promo/clothcraft/capture/evidence.json`. All six short H.264 recordings in `assets/chapters/*.mp4` and associated posters are *real UI screen recordings* produced with:

```bash
python3 website/clothcraft/qa/build-chapters.py
```

The V3 montage is generated with:

```bash
python3 website/clothcraft/qa/build-montage.py
```

Both commands use `imageio_ffmpeg` already present on the connected Mac. Source montage consists of 12 clips from the six chapter recordings. No made-up footage of a finished cloth simulation is used.

## Repeatable QA

```bash
CLOTHCRAFT_SITE_URL=http://127.0.0.1:8100/ node website/clothcraft/qa/site-smoke.mjs
node website/clothcraft/qa/hero-and-gallery.mjs
```

The scripts rely on the existing `playwright-core` and Google Chrome installation. They verify working navigation, responsive layout, six chapter playback, calculator controls and FAQ. The V3 audit checks scroll-induced video rotation to a flat presentation, gallery arrows, live clips, reduced-motion pause behavior, and overflow at **320, 360, 390, 768, 1024, 1440 and 1920 pixels**. Screenshots and results go into `qa/`.

## Publication and legal accuracy

- The site's `Download` button opens `/download/`, which checks the official GitHub Releases API and displays verified platform assets **only when actually published**. The official project had no releases when this page was implemented. Start free and open-source links remain independent of AI subscriptions.
- The canonical public repository `erythrofr/ClothCraft` publishes its original source under the **MIT License**. Local EXO workspace components may have their own, different licensing terms; verify rights to any separately bundled assets before public redistribution.
- ClothCraft Studio V2 currently has experimental solver, fitting, and production capabilities. Nothing on the marketing site claims full feature or simulation parity with CLO3D.
- Budget projections are **user-entered illustrative calculations**, not verified pricing comparisons or guaranteed savings.
- Review rights to any third-party pattern, asset or brand visible inside the original ClothCraft screen captures before public release.
- For public hosting, copy `index.html`, `style.css`, `main.js`, `favicon.svg`, and `assets/` (except unused source-only `assets/studio.webm` if not needed for rebuilding). Set the final absolute public OG image URL. Exclude `.snapshots/`, `qa/`, and `serve.mjs` from production deployments.
- Keep project and brand distinction clear. ClothCraft is independent of CLO Virtual Fashion and Seamly; the interface uses inspiration, not copied IP.

## Previous versions

The pre-redesign site is preserved in `.snapshots/v2/`, and the original V1 files remain in `.snapshots/v1/`. No edits to the actual ClothCraft software are part of this website pass.

## V4 — Multi-page ClothCraft website

V4 adds a genuine local multi-page website sharing the dark ClothCraft design system:

- `/product/` — detailed ClothCraft Studio product overview, screenshots, downloadable source/build links.
- `/features/` — capability deep dive, roadmap-level feature matrix, experimental vs demonstrated distinctions.
- `/solutions/` — independent designers, education, studios, patternmakers, 3D artists and researchers.
- `/about/` — mission, open development philosophy, and limitations.
- `/open-source/` — primary **Open Source & Community** hub with code/contribution links; `/community/` points here.
- `/clothcraft-assets/` — a **self-contained, renamed ClothCraft Assets** marketplace copied from the existing EXO community preview (`concepts/exo-community-ui/`) without modifying the original. Includes marketplace, creator profiles, patterns, materials, and its other existing local prototype experiences. Return link leads back to main ClothCraft website. See the assets packaging workflow under `tools/`.
- `/investors/` — sponsor/donation/investor information, not a claim of active fundraising or tax-deductible donations.
- `/support/` — documentation, releases, open issues, contribution and licensing links.
- `/ai/` — optional AI-service roadmap and truthful connection status; **AI inference is not yet connected**.
- `/pricing/` — proposed open-source/free plan, hosted AI tiers, one-time credit packs, annual estimation view, and explanatory billing status. **No checkout is live in the local preview.**

### Navigation and generation

Shared global navigation with Product, Open Source and About dropdowns is available on the homepage and every secondary page. `site-nav.js` handles inner-page mobile navigation and dropdown interaction. Secondary HTML pages are generated from `tools/build-pages.py` (which extracts the homepage header/footer, so links remain consistent):

```bash
python3 website/clothcraft/tools/build-pages.py
```

Edit `tools/build-pages.py` to change secondary-page marketing content, then regenerate. Do not directly edit generated secondary `index.html` files, as regeneration overwrites them. Page styles live in `site-pages.css`.

### Secure credit billing foundation

The server-side module is in `commerce/index.mjs`, with integration information and security limitations described in `commerce/README.md`. It supports preconfigured Stripe Checkout SKUs, raw-body webhook signature verification, and idempotent paid-credit recording, **but does not activate charges** without all of:

1. A trustworthy authenticated account resolver (never accept account IDs supplied by the browser);
2. Stripe secret key, signed webhook secret, verified products/prices and HTTPS origin;
3. A secure private ledger path (production multiple instances require a proper transactional database);
4. `CLOTHCRAFT_COMMERCE_LIVE_ENABLED=yes` as an explicit launch gate, **only after verifying real payment prices, model access, and credit usage deduction**;
5. Published policies for AI credit consumption, expiry, recurring resets, cancellations, refunds, and chargebacks;
6. A genuine hosted inference gateway and auditable usage deduction, which are **not yet implemented**.

The local `serve.mjs` includes `/api/commerce/status`, `/api/commerce/config`, `/api/commerce/checkout`, `/api/commerce/webhook`, `/api/commerce/balance`. The status endpoint returns disabled until the trusted account integration and configuration are supplied. Unauthenticated checkout returns HTTP 503; no fake credit balance or demo checkout can charge users. The client never stores Stripe secrets or AI provider keys. Avoid advertising buy-now as production-ready until payment and access-control testing is complete.

**Tests:**

```bash
node --test website/clothcraft/commerce/index.test.mjs
node website/clothcraft/qa/multipage.mjs
node website/clothcraft/qa/site-smoke.mjs
node website/clothcraft/qa/hero-and-gallery.mjs
```

`qa/multipage.mjs` verifies 11 routes across 390, 1100 and 1440 pixels (33 route-viewport combinations), working navigation, mobile dropdowns, all pricing cards, and safe checkout rejection. It writes `qa/v4-multipage.json` and screenshots. Preview is at `http://127.0.0.1:8100/` on the connected computer. No external deployment, DNS change, GitHub push, donation collection, or user payment happened as part of V4.

### Pre-launch merchant configuration

See `commerce/README.md` for the required `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, configured Price IDs and credit amounts, `CLOTHCRAFT_PUBLIC_ORIGIN`, and `CLOTHCRAFT_LEDGER_PATH`. A trusted server-side account resolver is loaded using the absolute `CLOTHCRAFT_AUTH_MODULE` path and must validate actual sessions. The local Node server additionally requires `CLOTHCRAFT_COMMERCE_LIVE_ENABLED=yes`, deliberately **unset** here. Checkout cannot collect funds until all gates are met. The billing UI will not enable a hypothetical yearly subscription without a separately configured yearly Stripe price. Before launch, implement authentication, metered AI generation/credit consumption and refunds, verify exact advertised prices, migrate the JSONL credit ledger to a transactional production database, and run real Stripe test-mode integration checks. No actual charges, credits or donations were issued during this work.


## V7 — Canonical GitHub and Mac / Windows downloads

The canonical public ClothCraft repository is **https://github.com/erythrofr/ClothCraft**. Its original source uses the **MIT License**. This is separate from the local EXO development workspace whose existing `origin` points to `mikristian/exo-sample-3d`; do not force-push that unrelated local repository to the canonical project.

- `/download/` is a responsive, standalone page for macOS and Windows, reached via the homepage Download button, Product dropdown, footer, and ClothCraft Assets navigation.
- `download.js` fetches GitHub's public release data directly and only renders clickable downloads for non-draft release assets whose URLs match `https://github.com/erythrofr/ClothCraft/releases/download/...`. No artificial installer links, unverified download mirrors, or misleading OS availability claims.
- When GitHub reports **zero published release assets**, both platforms accurately say no verified installer yet. The site links the official cross-platform GitHub Actions workflow (artifacts are development builds, not guaranteed signed/notarized installers) and documents the Rust source launch command from the official README.
- The Mac and Windows cards identify platform/architecture from the published filename when available. A GitHub API failure also fails closed and directs users to official releases rather than inventing assets.
- Homepage/open-source/pricing pages now describe the official source as **MIT-licensed**, correcting an earlier GPL claim that belonged to a different local project lineage. Third-party assets/dependencies still retain their own licenses.

### Download and link QA

```bash
node website/clothcraft/qa/download.mjs
node website/clothcraft/qa/multipage.mjs
```

`qa/download.mjs` verifies a true no-release state, desktop/mobile widths, secure simulated future macOS/Windows GitHub asset links, rejection of off-GitHub URLs, and graceful API failure. A real OS installer has **not** been created or published by this website pass. Mac/Windows release publication requires cross-platform build verification, packaging, licensing review, and signing/notarization decisions with project maintainers.

## V8 — Actually downloadable Mac / Windows desktop previews

A polished direct-download experience is available locally at **http://127.0.0.1:8100/download/** with immediate top-of-page **Download for Mac** and **Download for Windows** buttons. Both actually initiate files from this website instead of only linking to the GitHub source.

The previews were repackaged from verified artifacts of the canonical ClothCraft GitHub Actions workflow run **39828874228**. They are not a vetted consumer release. See `tools/DOWNLOAD_DEPLOYMENT.md` for full technical provenance, exact input/output SHA256s, packaging instructions, test evidence and limitations.

| Platform | Local downloadable file | Installation | Security limitations |
| --- | --- | --- | --- |
| Apple silicon Mac | `/downloads/ClothCraft-macOS-AppleSilicon-Preview.dmg` | Mount DMG, drag `.app` into Applications, launch | Ad-hoc signed, **NOT Apple Developer ID signed/notarized**. Mac UI/CLI smoke-tested; experimental |
| Windows x64 | `/downloads/ClothCraft-Windows-x64-Portable-Preview.zip` | Unzip, double-click `ClothCraft/Start ClothCraft.cmd` | Unsigned portable console-launch package, NOT a Windows MSI. Native Windows runtime **not tested in this session** |

Features of the updated page:

- Real source and file provenance, download sizes, SHA256 disclosure and build/run link.
- Correct native binary file response headers, byte ranges, direct browser download behavior, no fake installers.
- One primary button per platform, plus immediate shortcuts in the hero. Buttons only point to binaries **after verifying** same-origin manifest + actual served file size.
- Fallback to official GitHub Releases and the official free source archive if the preview files are unavailable; official releases will take precedence if later published.
- A screenshot captured from **the exact Mac build** (`assets/clothcraft-native-macos-preview.webp`) rather than relying only on an unrelated aspirational marketing UI. The broader real ClothCraft V2 showcase remains below the downloads and is labeled separately.
- Improved mobile layout, clear launch instructions, experimental safety notices, and reduced-motion compatible video playback.

Verification: `node website/clothcraft/qa/download.mjs`, `node website/clothcraft/qa/multipage.mjs`, `node website/clothcraft/qa/github-links.mjs`, plus `node --test website/clothcraft/commerce/index.test.mjs`. macOS DMG was mounted read-only and its app bundle signature, metadata and executable validated; native UI smoke ran and generated the screenshot. **No public site deploy, official GitHub release, Git push or production security certification was performed.**


## V8 — Direct downloadable preview builds and accurate screenshots

**Local preview:** [http://127.0.0.1:8100/download/](http://127.0.0.1:8100/download/) on the machine serving the development site. The URL is loopback-only; other computers and phones cannot reach it until the website and installer files are deployed on a public host.

A successful official CI workflow from [`erythrofr/ClothCraft`, run 39828874228](https://github.com/erythrofr/ClothCraft/actions/runs/39828874228), produced the native cross-platform executables. These verified archives are retained as local release inputs under `tools/release-input/` and were repackaged into:

- `downloads/ClothCraft-macOS-AppleSilicon-Preview.dmg` — an **ad-hoc-signed but NOT notarized** `ClothCraft.app` for arm64 Macs, with bundled assets, icon, a standard Applications drag target, and a single executable launcher. Intel Mac compatibility is not verified.
- `downloads/ClothCraft-Windows-x64-Portable-Preview.zip` — portable compiled Windows x64 `cloth-fit.exe`, bundled assets, a double-clickable `Start ClothCraft.cmd`, and plain-English setup notes. **Not** a signed Windows installer; no native Windows GUI boot acceptance test was performed here.
- `downloads/manifest.json` and `downloads/SHA256SUMS.txt` — provenance, exact filenames, bytes and SHA256 checksums. The site checks the manifest and HEAD response sizes, then offers a browser download of the exact local file. Official GitHub Release assets, when actually published, take priority. The development page does not fabricate GitHub Releases.

The macOS DMG was mounted read-only and its app binary, assets, Info.plist and ad-hoc code signature were checked. The CLI help and the native `--ui-smoke` completed locally and generated a screenshot from **the actual packaged app** at `assets/clothcraft-native-macos-preview.webp`, distinct from the separate marketing montage. The Windows ZIP passed archive CRC, binary magic, bundled asset and launcher checks; Windows interactive behavior is still unverified.

### Rebuild and verify local packages

```bash
python3 website/clothcraft/tools/package-development-downloads.py
python3 website/clothcraft/tools/verify-public-downloads.py
node website/clothcraft/qa/download.mjs
node website/clothcraft/qa/multipage.mjs
```

Packaging must run on macOS with `iconutil`, `codesign`, `hdiutil`, and the Python Pillow library. The release packaging script rejects input archives whose SHA256 does not match the two reviewed upstream GitHub Actions artifacts. Rebuilding will update the manifest and public download files; do not publish a new build without corresponding tests. For production, distribute only reviewed binaries over HTTPS and consider Developer ID signing/notarization and Windows signing, real-platform QA, versioned release notes and a public update mechanism.

The user-facing Download page includes two main direct-download controls, detailed installation instructions, workflow footage, real app images, and separate free open-source fallback. Other site routes link back to `/download/`. No public domain deployment or GitHub release was performed during V8.

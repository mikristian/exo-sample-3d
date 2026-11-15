# EXO V2 — companion character hidden when opening the desktop app

**QA date:** November 14, 2026. **Scope:** optional floating EXO AI companion character, *not* the editable 3D garment avatar or cloth collision mannequin.

## Expected desktop startup behavior

- The floating companion character is **off by default** for new installs and settings resets.
- Each desktop-app page launch (`?desktop=1`) hides the companion even if the previous launch saved `enabled:true`. Its color, eyes, movement, accessories and other appearance settings are preserved.
- The **Settings → Character → Show character** switch can turn the companion on during the running session. The next app launch starts with it hidden again.
- The visible 3D mannequin and garment simulation are unaffected. The assistant's conversation feature is not deleted.
- A normal browser visit without the desktop parameter continues to respect the user's previously stored visibility choice, if any.

## Implementation

- `src/core/exoCompanionCharacterPreferences20261102.js`: default `enabled:false`; exported `startExoCompanionCharacterHidden20261114` reloads existing settings and saves `enabled:false` without discarding appearance.
- `src/components/ExoAppCharacterAssistant20261102.jsx`: on initialization, the desktop UI applies that startup override; normal browser visits read the stored preference. Settings updates still synchronize through the existing preference event.
- `src/core/exoCompanionCharacterPreferences20261102.test.mjs`: covers fresh defaults, persisted previously-on preferences, appearance retention, user turning it back on and next launch hiding it again, including unavailable local storage.

## Verification

- `node --test src/core/exoCompanionCharacterPreferences20261102.test.mjs`: **10/10 passed**, zero failures.
- Production Vite frontend build: **2,735 modules transformed**, build succeeded. Only temporary QA build files were created; it was not installed into the running personal application.
- Real headless Chrome test of the new compiled frontend, URL `?desktop=1&engine=clothcraft`: first page load with a previously stored `enabled:true` started **hidden** (`[data-exo-ai-character=true]` absent), retained custom eye color, a user preference event toggled it **visible**, and a new page load automatically hid it **again**. **Zero browser script errors.**
- Local Git source differences against the immediately preceding published main revision were audited: exactly the three intended source/test files, with no unrelated development branch files needed.

## Deployment boundary

This is an **application source-code update**, not a silent modification to the currently installed private `EXO ClothCraft Studio V2.app`. Merely pushing to GitHub does not update that installed application's compiled JavaScript. To guarantee this new startup behavior there, a source-built compatible release must be installed through the independently reviewed native app update workflow. Avoid replacing the running installed app with a source-unverified bundle, and do not publish private CLO3D assets, personal paths or project files.

# ClothCraft Character Atelier

An **independent local character preview**. This version is deliberately **not connected to ClothCraft Studio, ARAI, or the garment engine**.

## Launch

- On the connected Mac, double-click `Start Character Atelier.command`.
- Or, from the `exo-clothcraft-v2` repository, run:

  ```bash
  node website/clothcraft-characters/serve.mjs --open
  ```

- Visit **http://127.0.0.1:5288/**. Bound to `127.0.0.1` only; it is not publicly hosted.
- The independent **Circle Character Studio** at **http://127.0.0.1:5288/circle.html** now uses the same color token values, neutral grid header and icon-only theme selector as the main ClothCraft website (`clothcraft-site-theme-v2`, 16 official palettes). The top-right Launch App button is intentionally disabled until there is an app launcher; the profile button describes the local-only session. The editor is divided into Eyes, Colors, and Details, keeping its 84 selectable eye shapes, 100 EXO colorways, expressions, tracking and 2D SVG exports. The new Details tab offers 23 original flat SVG designs: 10 tattoos, 6 gems and 7 piercings, plus four editable quick looks (Gothic, Crystalline, Pierced, Nightfall). Add up to 16 separate details, drag to reposition, use placement presets, change x/y/size/rotation/flip and both flat colors, duplicate, remove or clear all. Decorations remain when switching starting faces or generating a variation; Reset explicitly clears them. All decoration art is included in PNG/SVG/JSON exports, with editor-only selection guides excluded. Theme selections use the same palette and storage key as main ClothCraft when hosted on the same web origin. The original 3D Alien Studio remains separate and unchanged. No STARBOY/Lark proprietary code or source art is included.
- **Upload custom SVG tattoos:** In **Details → Tattoos**, choose **Upload your own SVG**, and select a local `.svg` drawing (up to 160 KB, maximum 750 vector elements). The SVG is parsed into a restricted internal vector tree; external images, embedded scripts, event handlers, remote references, HTML/foreign objects, and unsupported SVG features are rejected. The editor supports paths, groups, standard vector shapes, internal clip paths, simple gradients, and many Illustrator-style class fills/strokes. The uploaded design appears automatically on the character, with the same drag/size/rotate/flip controls as built-in details. Imported colors stay intact by default; check **Recolor SVG using detail color** for a single-color tattoo. Up to **12 reusable imported tattoos** are kept in **My SVG Tattoos** alongside the character's saved browser settings. Character Reset clears placed details but keeps the custom SVG library. Delete removes both the library design and its existing placements. These uploads stay in this local browser only and are included as actual inline vector shapes in SVG/PNG exports and as editable drawing trees in JSON settings. Text objects, images, filters, linked resources, animations and other non-vector SVG constructs should be converted to paths before upload.
- This uses the existing repository's installed Vite/React dependencies. No remote images, external fonts, API keys, accounts, AI models or cameras are required. Microphone input is **optional** and only starts after you press **Use microphone** and approve browser permission.

## Interactions

- Switch between Stitch, Patch, Bobbin and Forma. Each character is a **real procedurally sculpted 3D mesh** with distinct cranium width, cheek and chin proportions, inspired by the familiar 👽 emoji.
- Move the pointer across the large preview to see the head turn gently toward it. **Drag the character to rotate the 3D mesh** and inspect its side profile; double-click to return to the front. Automatic breathing, floating and blinking remain supported.
- Each character has a smooth gray-green or selected pastel 3D skull, **two actual curved glass-black lens meshes**, and a small dark smiling mouth. The face is physically lit with studio lights and PBR materials. There are no borrowed emoji assets, liquid-glass overlays, or CSS character gradients. The stage background remains a single flat color.
- Use **Eye close-up** above the stage to inspect expressions. Choose **Immersive**, **Balanced**, or **Subtle** size, three almond variants and four restrained dark eye finishes.
- Try Blink, Wave, Jump, Talk and Dance. The **Talk** button starts a short, audible synthesized-voice-tone demonstration and animates the 3D model using the actual analysed Web Audio signal. It is a nonverbal sound preview, not text-to-speech or an AI assistant.
- **Use microphone:** explicit opt-in live audio reaction. The analyser reads your microphone level and frequency energy locally in the browser; the microphone is *not* played back through your speakers. Press **Stop microphone** to end capture; capture also stops when the page is hidden or closed.
- **Try an audio file:** choose a local MP3/WAV/M4A or other browser-supported format (up to 75 MB). The sound plays through the browser and drives the 3D head's breathing and expression while playing, without uploading the file. **Stop file** halts playback and releases the object URL.
- **Body response** changes how strongly the character pulses, floats and compresses with sound. The live percentage meter shows the analysed audio level.
- Choose one of six **matte body colors**, four emotional expressions, three eye shapes, four dark eye finishes, three eye sizes and a nickname. Toggle idle animation and eye tracking.
- Customizations auto-save to **this website origin's local browser storage**. Reset restores defaults.
- Reduced-motion accessibility setting stops idle 3D movement. The canvas responds to browser resizing, supports touch dragging and falls back to a vector illustration when WebGL is unavailable.

The characters are original **Three.js/WebGL 3D meshes** with procedural geometry and Web Audio-reactive poses, not imported Apple emoji assets, external mesh downloads, video or simulated physics. No extra dependency installation was necessary: Three.js is already included in the project.

## QA

```bash
node website/clothcraft-characters/qa.mjs
node website/clothcraft-characters/qa-circle.mjs
node website/clothcraft-characters/qa-details.mjs
node website/clothcraft-characters/qa-svg-import.mjs
```

The QA suite exercises real WebGL character rendering, orbit drag/reset, gaze motion, manual animations, analyser-driven 3D movement, local WAV playback, microphone capture lifecycle with a fake test device, customization persistence and phone sizing in Chromium and saves screenshots to `qa/`.

Circle Eye Lab QA verifies all 84 eye shapes, 100 custom colorways, blink/gaze controls, multicolor and independent left/right eye colors, exports, local persistence and responsive layouts. Run `node website/clothcraft-characters/qa-details.mjs` to verify the new design tools: 16 ClothCraft theme palettes, the three accessory categories, four quick looks, drag/placement, styling colors, duplicate/remove, SVG/PNG/JSON export, persistence, preservation across presets, Reset, no JS errors and layouts at 390/768/1200/1440px.

SVG import QA verifies Illustrator-style class fills/strokes, downloaded PNG/SVG/JSON fidelity, independent edit/drag/recolor, local persistence, Reset preserving reusable SVGs, reapplication/deletion, 390px responsive layout, and rejection of SVG scripts/events/remote images/foreignObject/external references.

## Build

From the repository root:

```bash
./node_modules/.bin/vite build website/clothcraft-characters
```

This builds to `website/clothcraft-characters/dist` without changing the main ClothCraft application build.

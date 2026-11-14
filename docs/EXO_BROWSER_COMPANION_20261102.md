# EXO browser companion — developer preview

Open the already-running local Vite site at `http://127.0.0.1:5174/` and use the floating orb or the header AI control.

The original Next/Previous tutorial has been replaced with contextual conversation. Asking about Pattern, Fabric, Grading, Tech packs, or a first T-shirt/hoodie points the orb toward the relevant existing control. **Explore interface** lets the orb follow tool hover and focus, explain a hovered control after a short pause, and highlight real buttons while preserving their ordinary click behavior. Verified application commands continue through `runCommand`; the local AI is read-only guidance.

The character retains the **original flat 2D CircleEyes artwork**, dark circular body, lime eyes and purple/cyan iris colors, with small sway and flight motion. There is no hand, shading, 3D body, or deformation of its circular silhouette. When an assistant-authorized task runs in the drafting editor, the actual 2D viewport gets a moving multicolor perimeter and real toolbar targets are highlighted.

## The liquid-glass companion panel

The chat shell uses a translucent, tinted glass background with backdrop blur and a fine reflective border. Assistant speech is in blue conversation bubbles; your messages are violet. The main message area remains glass, while the composer input has a darker filled surface for readable text. Drag the grip/header to float the panel anywhere on screen. The move/dock button offers **Float, Dock left, Dock right, Dock top, Dock bottom**. The selected location persists in browser local storage. The orbiting character moves outside a docked panel when resting, and may fly to whichever tool is being used.

In **Explore interface**, a hover/focus over a real button now creates a bright glow and small tool name next to the button. After a brief dwell, EXO explains its function out loud. Clicking a button also triggers the explanation while preserving the button's actual behavior. Common CAD commands get fashion-specific explanations, while unfamiliar controls use their own accessible label/title without inventing functionality.

The 2D workspace gets a stronger moving lime/cyan/purple perimeter while EXO creates or edits a pattern, plus an animated draft silhouette and temporarily glowing real pattern objects. Animation can be disabled with the operating system's reduced-motion setting.

## Design a first T-shirt conversationally

1. Ask aloud or type **"Can you make my first T-shirt pattern?"**. The companion remembers that you requested a T-shirt, asks whether to start from the existing foundation template, and moves to the Pattern control.
2. Reply **"OK do the pattern"**, **"yes"**, or **"start with a basic template"**, either by microphone or text. The assistant calls the same `applyGarmentTemplate('tee')` as the working EXO template tile, which creates **four real editable drafting pieces and their actual seam relationships**, with the usual undo checkpoint.
3. It switches to the 2D workspace, illuminates the whole drawing window, and reports the actual result returned from the project/template loader. If the native converter fails, it reports the failure and does not pretend success.
4. Follow up with **"show it in 3D"**, **"simulate"**, or **"save"** to invoke the existing verified editor commands. The T-shirt template is a **foundation starting block**, not free-form AI-generated pattern geometry or a factory fit approval.

Try **"make it oversized and slightly cropped"**, **"make it boxy"**, or **"crop the T-shirt by 6 cm"** after opening a Foundation Tee. EXO interprets a bounded designer-style request, commits an undoable change to the real 2D garment project, and glows the pattern/workspace while working. For the first example, the current safe edit widens each front/back hem by 6 cm and raises the body hems by 4 cm. It deliberately leaves the armhole/shoulder/sleeve-cap and neckline geometry intact, so the result is a roomier/boxier hem with a cropped body. **Dropped shoulders, sleeve-cap re-engineering, and full-chest oversized fit are still future capabilities.** Physical fit and size-grading validation remain necessary.

Recent messages are included in bounded form when calling the browser's local Ollama model, so short conversational follow-ups have context. The Ollama endpoint continues to be read-only, while authorized, deterministic template creation happens inside the editor.

## Speak and hear

Click the microphone in the companion panel and permit browser microphone access. The page uses browser `SpeechRecognition`/`webkitSpeechRecognition`, shows interim words, deduplicates repeated recognition results, and automatically sends a completed utterance. You may instead type a reply at any point; entering text stops the active recognition session to prevent overlapping messages. Chrome/Edge are the most promising browsers; recognition availability and processing vary by platform. In browsers without recognition, typed input remains available. Some browser speech recognition services process audio through a remote provider.

The voice selector lists available English speech voices, preferring installed Microsoft voices where available, and otherwise a stronger available macOS/browser voice. The speaker toggle mutes/unmutes; the waveform button previews the selected voice. Output is delivered through `speechSynthesis`, with cancellation and failure fallback. This works without any API key, although voice quality depends on the browser and OS. High-quality Microsoft Neural Speech requires an Azure resource; there is no Azure key configured in the current development server.

For higher-quality **Microsoft Azure Neural Speech**, set these **server-side only** environment variables before starting or restarting Vite:

```sh
EXO_AZURE_SPEECH_KEY=<your Azure Speech resource key>
EXO_AZURE_SPEECH_REGION=eastus
```

The Vite local middleware provides `/api/exo-assistant/speech/status` and `/api/exo-assistant/speech`, calling the official Azure Neural voice `en-US-JennyNeural`. Never put the key in a `VITE_` variable, client bundle, chat, or committed file. Azure usage may incur charges. The UI only offers Azure voice when the server reports it configured, and falls back to a browser voice if cloud synthesis fails.

**Local neural voice (installed on this Mac):** The developer browser now discovers the locally cached **Kokoro 82M quantized** speech model through `GET /api/exo-assistant/speech-neural/status`. The new server endpoint synthesizes 24 kHz mono WAV audio entirely on this machine, with selectable Heart, Bella, Michael and Adam. The macOS runtime and downloaded neural weights live outside the repository at `~/Library/Application Support/EXO/NeuralVoice`, and requests use the already cached model (no network fetch at speech time). This is the default when neither Microsoft Neural nor another selected option takes priority. It is experimental, and spoken quality should be assessed by listening; no physical microphone/audio playback quality guarantee is implied. The model must be installed separately on other machines. Its speech endpoint limits requests to 400 printable characters, has one active synthesis at a time, and falls back to a macOS/browser voice when busy or unsupported.

**Additional local fallback:** `/api/exo-assistant/speech-local` synthesizes a PCM WAV file using approved macOS Samantha, Flo, Reed or Eddy voices, with no cloud credentials. The actual WAV endpoint has been verified on the Creative Mac. These remain selectable if you prefer a system voice.

## Local conversational AI

The **browser preview** uses an installed local Ollama model through `/api/exo-assistant/chat`, via the existing `integrations/clothcraft/exoAppAssistantLocal20261102.mjs`. Its current model is `qwen3-vl-instruct:2b` on the loopback Ollama endpoint at port `11434`. This endpoint can explain EXO and suggest navigation, and cannot execute arbitrary scripts or alter garment data. The editor's own verified command router handles supported user-requested operations. When Ollama is unavailable, built-in contextual explanations still work. The browser page does not require the native app bridge.

## Boundaries

This is a **local development preview**; no packaged macOS app or public deployment was updated. The assistant can fly to and spotlight existing controls, run the existing Foundation Tee creation command, apply bounded T-shirt style edits and issue supported EXO commands with user requests. It is not yet a general autonomous computer-use agent and cannot independently author arbitrary patterns, redesign complex armscyes/sleeves, run unverified grading, certify fit, or perform unrestricted multi-screen tasks. Speech recognition, voice playback, and the local model depend on their respective OS/browser and service availability.

## 2D editing, workspace tools, and mini tour (November 2 update)

The companion now sends the verified editor a camera-focus request (`exo-companion-focus-pattern`) when working on front and back panels. The legacy PatternEditor interpolates its actual SVG `viewBox` over 850 ms, and the source pattern outline gets a temporary lime/cyan/purple glow. This is a real editor camera move rather than an animation that merely enlarges an unrelated illustration. Native Rust 2D camera focusing will need its own equivalent adapter. Respects reduced-motion preferences.

The widget now uses smaller type, reduced internal padding, a narrower glass frame, and approximately 9 px of backdrop blur; it remains repositionable and dockable. On-screen work highlights can follow legacy 2D and 3D views, the Studio Settings dialog, the Tech Pack canvas, or the File Library. Tool tips remain contextual.

Verified conversational commands are parsed through `src/core/exoCompanionCommands20261102.js`. Examples: `please turn off nest grading lines`, `show 3D workspace`, `change theme to purple`, `open theme settings`, `open techpack`, `apply cotton jersey`, `change fabric to denim`, `choose Nora`, `add a button`, `add a zipper`. Each is forwarded to the corresponding App-owned state/handler; changes are reported only after that handler returns. Nest hides the **overlay** and preserves size rules. Material presets affect the selected or all actual pieces through existing fabric functions; button/zipper placement creates editable draft annotations. Native engine limitations are surfaced instead of fabricating physical fixture behavior.

**Quick tour** is an automatically advancing eight-stop tour of real UI controls and workspaces, with the 2D orb flying, screen and tool outlines, and a short explanation per stop. `Quick tour` starts it, `Stop tour` stops it. **Celebrate** provides brief flashing UI borders and an original synthesized four-bar 124 BPM house-influenced groove using Web Audio; the music ends automatically or through `Stop party`. These effects are local and reduced-motion friendly.

**Saved project awareness:** The companion indexes accessible File Library project metadata when opened, then can name currently indexed projects or open File Library for more details. It does not silently read every saved garment's private data or claim unrestricted long-term knowledge of all unindexed designs. Detailed cross-project search and memory require explicit opt-in indexing/retrieval with access control, refresh handling, and document-level citations in a future phase.

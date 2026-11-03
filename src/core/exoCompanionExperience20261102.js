/** Guided stops bind to App.jsx's existing data-exo-guide-target IDs. */
export const EXO_COMPANION_INTRO_STOPS = Object.freeze([
  { id: 'welcome', title: 'Welcome to EXO', target: 'assistant-launch', section: null, navigate: null, dwellMs: 3200, explanation: 'Ask EXO how to use tools, or describe the garment you want to create.' },
  { id: 'pattern', title: 'Draft your pattern', target: 'pattern', section: 'Pattern', navigate: 'pattern', dwellMs: 4600, explanation: 'Open the Pattern workspace to create and edit actual 2D garment pieces, curves and measurements.' },
  { id: 'canvas', title: 'Shape in 2D', target: '2d-canvas', section: 'Pattern', navigate: 'pattern', dwellMs: 4400, explanation: 'Select a pattern piece in the 2D editor to inspect its shape, seam relationships and dimensions.' },
  { id: 'fabric', title: 'Choose your fabric', target: 'fabric-tool', section: 'Fabric', navigate: 'fabric', dwellMs: 4200, explanation: 'Choose fabric properties and see how the garment appearance and behavior may change.' },
  { id: 'grading', title: 'Build size ranges', target: 'grading-tool', section: 'Production', navigate: 'grading', dwellMs: 4200, explanation: 'Open Production to develop graded sizes and check measurements before exporting.' },
  { id: 'modes', title: 'Simulation and tech packs', target: 'workspace-modes', section: null, navigate: null, dwellMs: 4400, explanation: 'Use workspace modes to reach simulation, animation, print layout and tech packs.' },
  { id: 'search', title: 'Find any command', target: 'command-search', section: null, navigate: null, dwellMs: 3500, explanation: 'Search available commands without needing to memorize every tool location.' },
  { id: 'save', title: 'Save your work', target: 'save', section: null, navigate: null, dwellMs: 3600, explanation: 'Save changes to your project before switching tasks or leaving the studio.' },
].map(stop => Object.freeze(stop)))

export const EXO_COMPANION_TOUR_DURATION_MS = EXO_COMPANION_INTRO_STOPS.reduce((duration, stop) => duration + stop.dwellMs, 0)

export function getExoCompanionIntroStop(id) {
  return EXO_COMPANION_INTRO_STOPS.find(stop => stop.id === id) ?? null
}

/** Topic tours reuse guide targets already present in the application.
 * The UI can offer these by key without changing the existing quick tour contract.
 */
const topicStop = (id, title, target, navigate, explanation) => Object.freeze({
  id, title, target, navigate, section: navigate, dwellMs: 4800, explanation,
})
export const EXO_COMPANION_TUTORIAL_MODES = Object.freeze({
  gettingStarted: Object.freeze([...EXO_COMPANION_INTRO_STOPS]),
  patternDrafting: Object.freeze([
    topicStop('draft-start', 'Open the pattern editor', 'pattern', 'pattern', 'Start by choosing the Pattern workspace and selecting an existing piece or creating a new one.'),
    topicStop('draft-canvas', 'Edit garment pieces', '2d-canvas', 'pattern', 'Use the two dimensional canvas to select points, edit curves, and check seam lengths and measurements.'),
    topicStop('draft-search', 'Find drafting commands', 'command-search', null, 'Search for a named drafting command when a tool is difficult to find in the toolbar.'),
    topicStop('draft-save', 'Save your pattern', 'save', null, 'Save your pattern edits and inspect the result before moving into simulation.'),
  ]),
  fabricAndFit: Object.freeze([
    topicStop('fit-pattern', 'Review garment shape', '2d-canvas', 'pattern', 'Check pattern proportions and ease before testing them on a three dimensional avatar.'),
    topicStop('fit-fabric', 'Explore material properties', 'fabric-tool', 'fabric', 'Open Fabric to examine material choices and how fabric settings influence garment drape.'),
    topicStop('fit-modes', 'Enter simulation', 'workspace-modes', null, 'Open workspace modes to explore garment simulation and animation workflows.'),
  ]),
  gradingAndProduction: Object.freeze([
    topicStop('grade-workspace', 'Open production', 'grading-tool', 'grading', 'Open Production and inspect the grading tools available for your selected pattern.'),
    topicStop('grade-pattern', 'Inspect graded pieces', '2d-canvas', 'pattern', 'Return to the pattern editor to check nested sizes, important measurement points and seam alignment.'),
    topicStop('grade-export', 'Prepare deliverables', 'workspace-modes', null, 'Locate your production, print layout and tech pack workflows through workspace modes.'),
    topicStop('grade-save', 'Save before exporting', 'save', null, 'Save the current project and verify the desired sizes and measurements before export.'),
  ]),
  workspaceAndAssistant: Object.freeze([
    topicStop('nav-assistant', 'Meet the assistant', 'assistant-launch', null, 'Ask EXO to explain a tool or describe a garment modification in everyday language.'),
    topicStop('nav-workspace', 'Switch workspaces', 'workspace', null, 'Use the workspace selector to move between available sections while keeping your project context.'),
    topicStop('nav-modes', 'Simulation and animation', 'workspace-modes', null, 'Use workspace modes to find simulation, animation, print layout and technical package tools.'),
    topicStop('nav-commands', 'Search all commands', 'command-search', null, 'Use command search to reach tools quickly by their names.'),
  ]),
})
export function getExoCompanionTutorialMode(mode) {
  return EXO_COMPANION_TUTORIAL_MODES[mode] ?? null
}
// The full studio tour covers each major EXO workspace. Navigation points to
// real workspace destinations; spotlight labels use current guide target IDs
// or visible workspace panes, and tutorial steps never execute garment edits.
export const EXO_COMPANION_FULL_STOPS = Object.freeze([
  ...EXO_COMPANION_INTRO_STOPS.slice(0,3),
  topicStop('full-sewing','Sewing and construction','workspace','sewing','Open Sewing to inspect seam relationships, stitches, buttons and zippers. Join the correct edges before fitting.'),
  topicStop('full-fabric','Fabric library and properties','fabric-tool','fabric','Explore material libraries, properties, thickness and appearance. Real-world fabric testing remains important.'),
  topicStop('full-avatar','Avatars and measurements','workspace','avatar','Select an avatar and check body measurements. A realistic fitting model needs accurate dimensions and collisions.'),
  topicStop('full-fit','3D fitting and simulation','3d-canvas','fit','Open Fit and the three-dimensional viewport to evaluate draping and strain using the available solver.'),
  topicStop('full-grade','Production grading','grading-tool','grading','Review base size, size rules and the complete graded nest before manufacturing.'),
  topicStop('full-render','Renders and presentation','workspace','render','Render helps present garment materials, lighting and camera views for design review.'),
  topicStop('full-animation','Animation and motion','workspace','animation','Animation provides moving avatar and garment presentations. Check drape across movement, not only neutral poses.'),
  topicStop('full-techpack','Technical packages','techpack-window','techpack','Bring measurements, materials, construction and grading details into a technical package for production review.'),
  topicStop('full-library','Saved project library','library-window','library','Use File Library to revisit design projects, reference assets and saved work.'),
  ...EXO_COMPANION_INTRO_STOPS.slice(6),
])
export const EXO_COMPANION_TOUR_MODES = Object.freeze({
  full: EXO_COMPANION_FULL_STOPS,
  pattern: EXO_COMPANION_TUTORIAL_MODES.patternDrafting,
  grading: EXO_COMPANION_TUTORIAL_MODES.gradingAndProduction,
  fabric: EXO_COMPANION_TUTORIAL_MODES.fabricAndFit,
  '3d': Object.freeze([
    topicStop('3d-pattern', 'Prepare the garment pattern', '2d-canvas', 'pattern', 'Check pieces and seam relationships in the two dimensional canvas before entering simulation.'),
    topicStop('3d-modes', 'Open three dimensional simulation', 'workspace-modes', null, 'Use the workspace mode menu to enter simulation, inspect garment drape and explore avatar fitting.'),
    topicStop('3d-save', 'Save fit adjustments', 'save', null, 'Save your project after checking fit and adjusting the underlying pattern.'),
  ]),
  techpack: Object.freeze([
    topicStop('techpack-pattern', 'Check source measurements', '2d-canvas', 'pattern', 'Review your garment measurements and piece details before documenting production specifications.'),
    topicStop('techpack-modes', 'Locate technical packs', 'workspace-modes', null, 'Open workspace modes and select the tech pack tools to organize construction and manufacturing information.'),
    topicStop('techpack-save', 'Save production documentation', 'save', null, 'Save the current garment and verify specification details before sharing with a manufacturer.'),
  ]),
  navigation: EXO_COMPANION_TUTORIAL_MODES.workspaceAndAssistant,
  theme: Object.freeze([
    topicStop('theme-open','Open Theme settings','settings-window','theme','This is the Theme and Color Palettes window. You can change the EXO interface colors without changing garment fabrics, patterns, or other project materials.'),
    topicStop('theme-main','View the active palette','theme-active','theme','The active color palette displays the current interface theme. Click an editable swatch to customize its role, including sidebar, accent, and text colors.'),
    topicStop('theme-presets','Explore installed themes','theme-presets','theme','The color palette library contains the installed theme presets. Browse the real palette cards, choose a color category, and click a preset to apply it.'),
    topicStop('theme-search','Search and filter colors','theme-search','theme','Use theme search and category filters to narrow options by name or family. You can also ask me to list purple, light, dark, or neutral themes.'),
    topicStop('theme-icons','Customize tool icons','theme-icons','theme','Choose icon colors across the EXO toolbars and Object Browser. Individual toolbar icons can also be adjusted in Custom Toolbar settings.'),
    topicStop('theme-custom','Create a custom palette','theme-custom','theme','Build your own interface palette by editing the sidebar, property panel, icon accent, muted reference, and text colors. Then save the combination.'),
    topicStop('theme-saved','Review saved themes','theme-saved','theme','Saved custom themes can be reapplied from this library and exported or imported as JSON.'),
    topicStop('theme-daynight','Set day and night themes','theme-daynight','theme','Choose automatic day and night color profiles if you want the interface to change with your preferred theme schedule.'),
    topicStop('theme-contrast','Check accessibility','theme-contrast','theme','The contrast audit helps you inspect readability before settling on your color combination.'),
  ]),
  sewing: Object.freeze([
    topicStop('sew-open','Open the Sewing workspace','workspace','sewing','The Sewing workspace contains seam attachment, stitch, hardware, and fastener tools for editable garment pieces.'),
    topicStop('sew-edges','Select matching pattern edges','2d-canvas','sewing','Select corresponding pattern edges and inspect their lengths, orientation, and seam allowances before adding sewing relationships.'),
    topicStop('sew-hardware','Inspect trim and closures','workspace-modes','sewing','Explore buttons, buttonholes, zippers, trims, and topstitch settings for your garment construction plan.'),
    topicStop('sew-save','Review and save construction','save',null,'Check that attachments are correct, then save your project and review the assembly in the three-dimensional viewport.'),
  ]),
  avatar: Object.freeze([
    topicStop('avatar-open','Open Avatar','workspace','avatar','The Avatar workspace contains body models and measurements used during garment fitting.'),
    topicStop('avatar-fit','Check fitting proportions','3d-canvas','avatar','Inspect body shape, height, and key measurements before evaluating how your garment fits on a chosen avatar.'),
    topicStop('avatar-drape','Review in three dimensions','workspace-modes','fit','Open fitting or simulation once the garment and its avatar are ready for a movement and collision review.'),
  ]),
  render: Object.freeze([
    topicStop('render-open','Open Render','workspace','render','The Render workspace helps you present garments with deliberate lighting, camera views, and material appearance.'),
    topicStop('render-view','Inspect the 3D scene','3d-canvas','render','Frame the garment in the three-dimensional viewport, inspect its materials, and choose a useful camera angle.'),
    topicStop('render-save','Save the design','save',null,'Save the garment project before preparing presentation images or exports.'),
  ]),
  animation: Object.freeze([
    topicStop('animation-open','Open Animation','workspace','animation','The Animation workspace lets you review moving avatar and garment presentations, including different motions when available.'),
    topicStop('animation-view','Inspect garment motion','3d-canvas','animation','Watch the garment throughout a motion, checking collisions and fabric behavior through movement and turns.'),
    topicStop('animation-check','Verify animation and fit','workspace-modes','fit','Recheck movement against the 3D fitting view and review any artifacts before approving a presentation.'),
  ]),
  print: Object.freeze([
    topicStop('print-open','Open print layout','workspace-modes','print','The print layout prepares full-scale pattern pieces for tiled paper or larger-format physical plotting.'),
    topicStop('print-pages','Inspect print tiles','print-layout-window','print','Check sheet size, orientation, scale and overlap. Ensure pattern tiles include appropriate assembly marks.'),
    topicStop('print-save','Save before printing','save',null,'Check paper calibration and dimensions before exporting pages or printing at actual size.'),
  ]),
  library: Object.freeze([
    topicStop('library-open','Open File Library','library-window','library','The File Library holds saved projects and attached image references that you have added to EXO.'),
    topicStop('library-files','Search your assets','library-window','library','Use project names or reference keywords to locate saved designs, source images, and related production documents.'),
    topicStop('library-work','Return to design','pattern','pattern','Open your selected project when you are ready to continue editing its patterns and materials.'),
  ]),
  widgets: Object.freeze([
    topicStop('widget-open','Open Custom Widget Studio','widget-window','widgets','The Custom Widget Studio lets you assemble custom panels from available EXO tools and approved actions.'),
    topicStop('widget-preview','Preview your new panel','widget-window','widgets','Choose controls, inspect the widget preview, and check each action before saving a custom tool.'),
    topicStop('widget-save','Save your custom widget','widget-window','widgets','Save the configured widget to your local library, where it can be reopened and edited.'),
  ]),
})
export const EXO_COMPANION_TUTORIALS = EXO_COMPANION_TOUR_MODES

/**
 * A short, original house-influenced rhythm made from oscillator/noise synthesis.
 * Call start() from an actual click/tap to satisfy browser audio gesture policies.
 * Audio is optional: unsupported browsers return a silent, safely stoppable handle.
 */
export function createExoCompanionGroove({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, tempo = 116, bars = 4, volume = 0.11 } = {}) {
  if (!Number.isFinite(tempo) || tempo < 60 || tempo > 180) throw new RangeError('tempo must be between 60 and 180 BPM')
  if (!Number.isInteger(bars) || bars < 1 || bars > 32) throw new RangeError('bars must be an integer between 1 and 32')
  if (!Number.isFinite(volume) || volume < 0 || volume > 0.3) throw new RangeError('volume must be between 0 and 0.3')

  let context = null
  let nodes = new Set()
  let ending = null
  let scheduler = null
  let currentGeneration = 0
  let started = false
  const durationSeconds = bars * 4 * 60 / tempo

  function cleanup() {
    if (scheduler !== null) clearInterval(scheduler)
    scheduler = null
    for (const node of nodes) { try { node.stop?.() } catch {} try { node.disconnect?.() } catch {} }
    nodes.clear()
    const old = context
    context = null
    started = false
    if (old) { try { void old.close?.() } catch {} }
  }

  function sound(time, { frequency, endFrequency = frequency, length = 0.12, gain = 0.5, type = 'sine' }) {
    const oscillator = context.createOscillator()
    const amplitude = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, time)
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + length)
    // Headroom for layered voices and a predictable ceiling across all tempos.
    amplitude.gain.setValueAtTime(Math.max(0.0001, gain * volume * 0.42), time)
    amplitude.gain.exponentialRampToValueAtTime(0.0001, time + length)
    oscillator.connect(amplitude)
    amplitude.connect(context.destination)
    oscillator.start(time)
    oscillator.stop(time + length + 0.005)
    nodes.add(oscillator)
    nodes.add(amplitude)
    oscillator.onended = () => {
      oscillator.disconnect?.(); amplitude.disconnect?.()
      nodes.delete(oscillator); nodes.delete(amplitude)
    }
  }

  return {
    get isPlaying() { return started },
    get durationMs() { return Math.round(durationSeconds * 1000) },
    async start() {
      if (started) return true
      if (typeof AudioContextClass !== 'function') return false
      const generation = ++currentGeneration
      try {
        context = new AudioContextClass()
        if (typeof context.resume === 'function') await context.resume()
        if (generation !== currentGeneration) { cleanup(); return false }
        const beat = 60 / tempo
        const startTime = context.currentTime + 0.035
        // Schedule a small lookahead window. Oscillators are released as they end,
        // avoiding thousands of live audio nodes for a full 32-bar performance.
        let nextBar = 0
        const chordRoots = [55, 65.41, 73.42, 61.74]
        function scheduleBar(bar) {
          const root = chordRoots[Math.floor(bar / 4) % chordRoots.length]
          const breakBar = bar % 8 === 7
          for (let step = 0; step < 16; step++) {
            const time = startTime + (bar * 16 + step) * beat / 4
            if (step % 4 === 0 && !(breakBar && step === 12))
              sound(time, { frequency: 165, endFrequency: 46, length: 0.18, gain: 0.9 }) // kick
            if (step === 4 || step === 12)
              sound(time, { frequency: 310, endFrequency: 115, length: 0.095, gain: 0.34, type: 'triangle' }) // snare
            if (step % 2 === 0 || (bar % 4 === 3 && step >= 12))
              sound(time, { frequency: step % 4 === 2 ? 3900 : 2800, endFrequency: 1050, length: 0.028, gain: step % 4 === 2 ? 0.16 : 0.085, type: 'square' }) // hats
            if ([0, 3, 6, 10, 12, 14].includes(step) && !breakBar)
              sound(time, { frequency: root * [1, 1.5, 2, 1.25][Math.floor(step / 4) % 4], length: beat * 0.3, gain: 0.29, type: 'triangle' }) // bass
            if ((step === 0 || step === 8) && bar % 4 !== 3) {
              sound(time, { frequency: root * 4, length: beat * 0.62, gain: 0.1, type: 'sine' })
              sound(time, { frequency: root * 5, length: beat * 0.62, gain: 0.07, type: 'sine' })
            }
          }
        }
        function scheduleAhead() {
          if (generation !== currentGeneration || !context) return
          while (nextBar < bars && startTime + nextBar * beat * 4 < context.currentTime + beat * 8 + 0.1) scheduleBar(nextBar++)
          if (nextBar >= bars && scheduler !== null) { clearInterval(scheduler); scheduler = null }
        }
        scheduleAhead()
        if (nextBar < bars) scheduler = setInterval(scheduleAhead, Math.max(80, Math.round(beat * 1000)))
        started = true
        // Reclaim voices after the last beat; no global timers are left running on stop.
        ending = setTimeout(() => { if (generation === currentGeneration) cleanup() }, (durationSeconds + 0.25) * 1000)
        return true
      } catch {
        currentGeneration++
        if (ending !== null) clearTimeout(ending)
        ending = null
        cleanup()
        return false
      }
    },
    stop() {
      currentGeneration++
      if (ending !== null) clearTimeout(ending)
      ending = null
      cleanup()
    },
  }
}

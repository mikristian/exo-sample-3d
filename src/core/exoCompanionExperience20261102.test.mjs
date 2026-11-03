import assert from 'node:assert/strict'
import test from 'node:test'
import { EXO_COMPANION_INTRO_STOPS, EXO_COMPANION_TOUR_DURATION_MS, EXO_COMPANION_TOUR_MODES, createExoCompanionGroove, getExoCompanionIntroStop } from './exoCompanionExperience20261102.js'

test('every guided topic uses real UI targets and useful captions', () => {
  const targets = new Set(['assistant-launch', 'pattern', '2d-canvas', '3d-canvas', 'techpack-window', 'library-window', 'widget-window', 'print-layout-window', 'settings-window', 'theme-active', 'theme-presets', 'theme-search', 'theme-icons', 'theme-custom', 'theme-saved', 'theme-daynight', 'theme-contrast', 'fabric-tool', 'grading-tool', 'workspace-modes', 'command-search', 'save', 'workspace'])
  for (const [name, stops] of Object.entries(EXO_COMPANION_TOUR_MODES)) {
    assert.ok(stops.length >= 3, name)
    assert.equal(new Set(stops.map(stop => stop.id)).size, stops.length)
    for (const stop of stops) {
      assert.ok(targets.has(stop.target), `${name}: ${stop.target}`)
      assert.ok(stop.explanation.length > 50)
      assert.ok(Object.isFrozen(stop))
    }
  }
})

test('tour stops have unique IDs, actual guide target names, useful dwell and immutable definitions', () => {
  const knownTargets = new Set(['assistant-launch', 'pattern', '2d-canvas', 'fabric-tool', 'grading-tool', 'workspace-modes', 'command-search', 'save'])
  assert.equal(EXO_COMPANION_INTRO_STOPS.length, knownTargets.size)
  assert.equal(new Set(EXO_COMPANION_INTRO_STOPS.map(stop => stop.id)).size, EXO_COMPANION_INTRO_STOPS.length)
  for (const stop of EXO_COMPANION_INTRO_STOPS) {
    assert.ok(knownTargets.has(stop.target))
    assert.ok(stop.explanation.length >= 50)
    assert.ok(stop.dwellMs >= 3000 && stop.dwellMs <= 5000)
    assert.ok(Object.isFrozen(stop))
    assert.equal(getExoCompanionIntroStop(stop.id), stop)
  }
  assert.equal(getExoCompanionIntroStop('unknown'), null)
  assert.equal(EXO_COMPANION_TOUR_DURATION_MS, EXO_COMPANION_INTRO_STOPS.reduce((sum, stop) => sum + stop.dwellMs, 0))
})

test('silent fallback is safe and start/stop are repeatable', async () => {
  const groove = createExoCompanionGroove({ AudioContextClass: null })
  assert.equal(await groove.start(), false)
  assert.equal(groove.isPlaying, false)
  groove.stop()
  groove.stop()
  assert.throws(() => createExoCompanionGroove({ tempo: 300 }), RangeError)
  assert.throws(() => createExoCompanionGroove({ bars: 0 }), RangeError)
  assert.throws(() => createExoCompanionGroove({ bars: 33 }), RangeError)
  assert.throws(() => createExoCompanionGroove({ volume: 1 }), RangeError)
})

test('32-bar party groove schedules a bounded lookahead and stops immediately', async () => {
  let created = 0, stopped = 0, disconnected = 0, closed = 0
  class AudioContext {
    currentTime = 0
    destination = {}
    resume() { return Promise.resolve() }
    close() { closed++; return Promise.resolve() }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { disconnected++ } } }
    createOscillator() {
      created++
      return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { disconnected++ }, start() {}, stop() { stopped++ } }
    }
  }
  const groove = createExoCompanionGroove({ AudioContextClass: AudioContext, bars: 32, tempo: 138, volume: 0.16 })
  assert.equal(groove.durationMs, Math.round(32 * 4 * 60 / 138 * 1000))
  assert.equal(await groove.start(), true)
  assert.ok(created > 30)
  assert.ok(created < 120, `Expected limited lookahead, got ${created} scheduled voices`)
  groove.stop()
  assert.equal(groove.isPlaying, false)
  assert.equal(stopped, created * 2) // scheduled stop plus immediate cancellation
  assert.equal(disconnected, created * 2)
  assert.equal(closed, 1)
  groove.stop()
})

test('groove schedules finite tones and closes audio on stop', async () => {
  const tones = []
  const contexts = []
  class MockAudioContext {
    currentTime = 12
    destination = {}
    closed = false
    constructor() { contexts.push(this) }
    resume() { return Promise.resolve() }
    createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} } }
    createOscillator() {
      const tone = { frequency: { setValueAtTime: (frequency, at) => { assert.ok(frequency > 0); assert.ok(at >= 12) }, exponentialRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {}, start: at => { tone.started = at }, stop: at => { tone.stopped = at } }
      tones.push(tone)
      return tone
    }
    close() { this.closed = true; return Promise.resolve() }
  }
  const groove = createExoCompanionGroove({ AudioContextClass: MockAudioContext, bars: 1, tempo: 120 })
  assert.equal(groove.durationMs, 2000)
  assert.equal(await groove.start(), true)
  assert.equal(await groove.start(), true)
  assert.equal(contexts.length, 1)
  assert.ok(tones.length >= 15)
  assert.ok(tones.every(tone => tone.stopped > tone.started))
  groove.stop()
  assert.equal(groove.isPlaying, false)
  assert.equal(contexts[0].closed, true)
  assert.equal(await groove.start(), true)
  assert.equal(contexts.length, 2)
  groove.stop()
})

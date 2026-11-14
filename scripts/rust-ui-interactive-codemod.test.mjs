import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const cwd = join(dirname(fileURLToPath(import.meta.url)), '..')
const converter = fileURLToPath(new URL('./rust-ui-interactive-codemod.mjs', import.meta.url))
const rustc = join(process.env.HOME, '.cargo/bin/rustc')
const run = (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000 })

test('extracts bounded real EXO panel state actions without changing source', () => {
  const input = join(cwd, 'src/components/PatternDesignToolPanel.jsx')
  const before = readFileSync(input)
  const result = run(process.execPath, [converter, '--file', input, '--json'])
  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(result.stdout)
  assert.equal(data.stateControls, 3)
  assert.equal(data.textControls, 1)
  assert.equal(data.gatedControls, 2)
  assert.ok(data.rejectedControls > 0)
  assert.deepEqual(readFileSync(input), before)
})

test('generated native Rust Boolean controls and callback dispatch compile and execute correctly', t => {
  const rustVersion = run(rustc, ['--version'])
  if (rustVersion.status !== 0) return t.skip('Rust compiler not installed')
  const dir = mkdtempSync(join(tmpdir(), 'exo-guarded-rust-ui-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const jsxFile = join(dir, 'GuardedPanel.jsx')
  writeFileSync(jsxFile, `
    import React, { useState } from 'react';
    export default function GuardedPanel({ onClose }) {
      const [expanded, setExpanded] = useState(false);
      const [confirmed, setConfirmed] = useState(true);
      const [query, setQuery] = useState('');
      const [layout, setLayout] = useState('split');
      const [intensity, setIntensity] = useState(2.8);
      return <section>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>More options</button>
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> Confirm preview</label>
        <button type="button" onClick={() => setExpanded(false)}>Collapse</button>
        <button type="button" aria-label="Close panel" onClick={() => onClose()}>Close</button>
        {expanded && <label>Search<input value={query} onChange={e => setQuery(e.target.value)}/></label>}
        {expanded && <button type="button" onClick={() => onClose()}>Exit expanded</button>}
        {expanded && <select aria-label="Viewport layout" value={layout} onChange={e => setLayout(e.target.value)}>
          <option value="split">Side by side</option>
          <option value="3d">3D only</option>
          <option value="2d">2D only</option>
        </select>}
        {expanded && <label>Lighting strength<input type="range" min="0.3" max="5" step="0.1" value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}/></label>}
        <button disabled={expanded} onClick={() => onClose()}>Must reject dynamic disabled</button>
      </section>;
    }
  `)
  const converted = run(process.execPath, [converter, '--file', jsxFile, '--emit', dir, '--json'])
  assert.equal(converted.status, 0, converted.stderr)
  const report = JSON.parse(converted.stdout)
  assert.equal(report.stateControls, 6)
  assert.equal(report.commandControls, 2)
  assert.equal(report.textControls, 1)
  assert.equal(report.selectControls, 1)
  assert.equal(report.sliderControls, 1)
  assert.equal(report.gatedControls, 4)
  assert.equal(report.rejectedControls, 1)
  assert.ok(existsSync(report.output))
  const output = readFileSync(report.output, 'utf8')
  assert.match(output, /ui\.selectable_label\(state\./)
  assert.match(output, /ui\.checkbox\(&mut state\./)
  assert.match(output, /sink\.dispatch\("onClose", &\[\]\)/)
  assert.doesNotMatch(output, /Must reject dynamic disabled/)
  const expanded = output.match(/pub (expanded_\d+): bool/)[1]
  const confirmed = output.match(/pub (confirmed_\d+): bool/)[1]
  const query = output.match(/pub (query_\d+): String/)[1]
  const layout = output.match(/pub (layout_\d+): String/)[1]
  const intensity = output.match(/pub (intensity_\d+): f64/)[1]
  const harness = join(dir, 'harness.rs')
  writeFileSync(harness, `
    mod egui {
      pub struct Ui { pub clicked: bool, pub check_flip: bool, pub select_choice: Option<String> }
      pub struct Response(pub bool);
      impl Response { pub fn clicked(&self) -> bool { self.0 } }
      pub struct ComboBox;
      impl ComboBox {
        pub fn from_id_salt(_id: &str) -> Self { Self }
        pub fn selected_text(self, _text: String) -> Self { self }
        pub fn show_ui(self, ui: &mut Ui, callback: impl FnOnce(&mut Ui)) { callback(ui); }
      }
      pub struct Slider<'a> { value: &'a mut f64 }
      impl<'a> Slider<'a> {
        pub fn new(value: &'a mut f64, _bounds: std::ops::RangeInclusive<f64>) -> Self { Self { value } }
        pub fn step_by(self, _step: f64) -> Self { self }
        pub fn text(self, _label: &str) -> Self { self }
      }
      impl Ui {
        pub fn label(&mut self, _text: &str) {}
        pub fn text_edit_singleline(&mut self, value: &mut String) -> Response {
          value.push_str("native"); Response(true)
        }
        pub fn button(&mut self, _text: &str) -> Response { Response(self.clicked) }
        pub fn selectable_label(&mut self, _selected: bool, _text: &str) -> Response { Response(self.clicked) }
        pub fn checkbox(&mut self, value: &mut bool, _text: &str) -> Response {
          if self.check_flip { *value = !*value; }
          Response(self.check_flip)
        }
        pub fn selectable_value(&mut self, current: &mut String, next: String, _label: &str) -> Response {
          if self.select_choice.as_deref() == Some(next.as_str()) { *current = next; Response(true) }
          else { Response(false) }
        }
        pub fn add(&mut self, slider: Slider<'_>) -> Response { *slider.value = 4.0; Response(true) }
      }
    }
    mod generated { use super::egui; include!(${JSON.stringify(report.output)}); }
    struct Sink(Vec<(String, Vec<String>)>);
    impl generated::UiCommandSink for Sink {
      fn dispatch(&mut self, command: &str, args: &[&str]) {
        self.0.push((command.into(), args.iter().map(|s| String::from(*s)).collect()));
      }
    }
    #[test] fn state_and_events_match_the_supported_jsx_subsets() {
      let mut state = generated::MigratedUiState::default();
      assert!(!state.${expanded});
      assert!(state.${confirmed});
      assert_eq!(state.${query}, "");
      assert_eq!(state.${layout}, "split");
      assert!((state.${intensity}-2.8).abs() < 0.000001);
      let mut ui = egui::Ui { clicked: true, check_flip: false, select_choice: Some("3d".into()) };
      generated::render_control_5(&mut ui, &mut state);
      assert_eq!(state.${query}, "");
      generated::render_control_7(&mut ui, &mut state);
      assert_eq!(state.${layout}, "split");
      generated::render_control_8(&mut ui, &mut state);
      assert!((state.${intensity}-2.8).abs() < 0.000001);
      let mut sink = Sink(Vec::new());
      generated::render_control_6(&mut ui, &state, &mut sink);
      assert!(sink.0.is_empty());
      generated::render_control_1(&mut ui, &mut state);
      assert!(state.${expanded});
      generated::render_control_5(&mut ui, &mut state);
      assert_eq!(state.${query}, "native");
      generated::render_control_7(&mut ui, &mut state);
      assert_eq!(state.${layout}, "3d");
      generated::render_control_8(&mut ui, &mut state);
      assert_eq!(state.${intensity}, 4.0);
      generated::render_control_6(&mut ui, &state, &mut sink);
      assert_eq!(sink.0.len(), 1);
      ui.check_flip = true;
      generated::render_control_2(&mut ui, &mut state);
      assert!(!state.${confirmed});
      generated::render_control_3(&mut ui, &mut state);
      assert!(!state.${expanded});
      generated::render_control_4(&mut ui, &mut sink);
      assert_eq!(sink.0, vec![("onClose".to_string(), vec![]), ("onClose".to_string(), vec![])]);
      ui.clicked = false;
      generated::render_control_4(&mut ui, &mut sink);
      assert_eq!(sink.0.len(), 2);
    }
  `)
  const binary = join(dir, 'ui-test')
  const compile = run(rustc, ['--edition=2021', '--test', '-o', binary, harness])
  assert.equal(compile.status, 0, compile.stderr)
  const execute = run(binary, ['--nocapture'])
  assert.equal(execute.status, 0, execute.stdout + execute.stderr)
  assert.match(execute.stdout, /1 passed/)
})

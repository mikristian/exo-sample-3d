#!/usr/bin/env node
// Install a separate launchd job for source-only Rust UI code generation on a mounted external volume.
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const requested = process.argv.includes('--volume') ? process.argv[process.argv.indexOf('--volume') + 1] : ''
const activate = process.argv.includes('--activate')
const volume = requested ? resolve(requested) : ''
if (!volume || volume === '/Volumes' || !volume.startsWith('/Volumes/')) throw Error('Pass --volume /Volumes/<actual mounted expansion drive>')
if (!existsSync(volume) || !statSync(volume).isDirectory()) throw Error('Expansion volume is missing')
const mounted = spawnSync('/sbin/mount', [], { encoding: 'utf8' })
if (mounted.status !== 0 || !mounted.stdout.split('\n').some(line => line.includes(` on ${volume} (`))) {
  throw Error('Requested path is not a mounted volume; refusing internal disk fallback')
}
const resolvedVolume = realpathSync(volume)
if (resolvedVolume === '/' || resolvedVolume === '/System/Volumes/Data') throw Error('Internal boot volume is forbidden')
const destination = join(volume, 'EXO-Rust-UI-Autopilot')
const node = process.execPath
const runner = join(project, 'scripts/autopilot/rust-ui-drive-runner.mjs')
const launchAgents = join(homedir(), 'Library/LaunchAgents')
const label = 'com.exo.clothcraft.rust-ui-drive'
const plistPath = join(launchAgents, label + '.plist')
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>${escape(node)}</string>
    <string>${escape(runner)}</string>
    <string>--once</string>
    <string>--output</string><string>${escape(destination)}</string>
    <string>--limit</string><string>12</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>${escape(join(destination, 'runner.stdout.log'))}</string>
  <key>StandardErrorPath</key><string>${escape(join(destination, 'runner.stderr.log'))}</string>
</dict></plist>
`
mkdirSync(destination, { recursive: true })
mkdirSync(launchAgents, { recursive: true })
if (existsSync(plistPath) && readFileSync(plistPath, 'utf8') !== plist) {
  throw Error('Existing LaunchAgent differs; inspect before replacing: ' + plistPath)
}
writeFileSync(plistPath, plist)
const verify = spawnSync('/usr/bin/plutil', ['-lint', plistPath], { encoding: 'utf8' })
if (verify.status !== 0) throw Error('Invalid LaunchAgent plist: ' + verify.stderr)
if (activate) {
  const bootstrap = spawnSync('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plistPath], { encoding: 'utf8' })
  if (bootstrap.status !== 0) throw Error('launchctl bootstrap failed: ' + bootstrap.stderr)
}
console.log(JSON.stringify({ installed: true, active: activate, volume, destination, plistPath, intervalSeconds: 300 }, null, 2))

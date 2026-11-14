// Test-only OS-crash simulation: the transaction creator is no longer alive.
// Never import this helper into a service, desktop app, or user project path.
import fs from 'node:fs'
export function simulateDeadMirrorWriter(mirror) {
  const file=`${mirror}.native-mirror-owner-v1.json`
  if (!fs.existsSync(file)) return false
  const owner=JSON.parse(fs.readFileSync(file,'utf8'))
  // ESRCH on supported Unix/macOS runtimes; no process owns this PID.
  owner.pid=2147483647
  fs.writeFileSync(file,JSON.stringify(owner))
  return true
}

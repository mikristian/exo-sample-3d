import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('hybrid native history never presents legacy revision buttons or restores legacy snapshots',async()=>{
  const app=await readFile(new URL('../App.jsx',import.meta.url),'utf8')
  assert.match(app,/const restoreHistorySnapshot = \(index\) => \{\s*if \(clothcraftHybrid\) return/)
  assert.match(app,/Current · revision \{clothcraftHybrid\?\(clothcraftLive\?\.revision\?\?'—'\)/)
  assert.match(app,/\{!clothcraftHybrid&&undoStack\.map\(/)
  assert.match(app,/Native revision listing is unavailable/)
  assert.match(app,/Native Undo and Redo use Rust garment history/)
  assert.match(app,/const undoForVisibleEngine = \(\) => clothcraftHybrid \? rustCommand\('undo'\) : undo\(\)/)
  assert.match(app,/const redoForVisibleEngine = \(\) => clothcraftHybrid \? rustCommand\('redo'\) : redo\(\)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {transformSync} from 'esbuild'

const workspace=readFileSync(new URL('./ClothCraftWorkspace.jsx',import.meta.url),'utf8')

test('actual 2D workspace JSX compiles with grade-history priority import and guarded Rust history route',()=>{
  assert.doesNotThrow(()=>transformSync(workspace,{loader:'jsx',format:'esm'}))
  assert.match(workspace,/import \{resolveModaris2DHistoryPriority20261029\} from '\.\.\/core\/modaris2DHistoryPriority20261029\.js'/)
  const history=workspace.slice(workspace.indexOf('const requestHistory=async op=>'),workspace.indexOf('const canUndo2D='))
  assert.match(history,/resolveModaris2DHistoryPriority20261029\(/)
  assert.match(history,/if\(route\.route==='draft'\)\{[\s\S]*?restoreNativeGradeDraft\(op\)[\s\S]*?return restored\?[\s\S]*?\}/)
  assert.match(history,/if\(route\.route==='blocked'\)/)
  assert(history.indexOf('while(lock.current)')<history.indexOf('resolveModaris2DHistoryPriority20261029('),
    'An in-flight native edit must finish before mixed-history ownership is decided')
  assert(history.indexOf("if(route.route==='blocked')")<history.indexOf('let current=state.current'),
    'An ambiguous mixed history must fail closed before native Rust history is consulted')
  assert.match(history,/nativeUndoAvailable:Boolean\(state\.current\?\.canUndo\),nativeRedoAvailable:Boolean\(state\.current\?\.canRedo\)/)
})

test('keyboard and 2D command rails route through the same guarded history entry point',()=>{
  assert.match(workspace,/case 'undo':if\(!playing\)void requestHistory\('undo'\)/)
  assert.match(workspace,/case 'redo':if\(!playing\)void requestHistory\('redo'\)/)
  assert.match(workspace,/data-native-history-action="undo"[\s\S]*?requestHistory\('undo'\)/)
  assert.match(workspace,/data-native-history-action="redo"[\s\S]*?requestHistory\('redo'\)/)
  assert.match(workspace,/disabled=\{busy\|\|playing\|\|!canUndo2D\}/)
  assert.match(workspace,/disabled=\{busy\|\|playing\|\|!canRedo2D\}/)
  assert.match(workspace,/contextMenu,gradeDraftHistoryRevision,nativeRuleDraftKey/)
})

test('2D workspace recovers and persists local grading history only under the matching native source key',()=>{
  assert.match(workspace,/import \{persistModaris2DGradeDraftJournal20261029,decodeModaris2DGradeDraftJournal20261029,clearModaris2DGradeDraftJournal20261029\}/)
  assert.match(workspace,/nativeGradeDraftJournalKey=nativeRuleDraftKey\?`\$\{nativeRuleDraftKey\}:history-v1`/)
  const recovery=workspace.slice(workspace.indexOf('// Autosaved separate rule sidecars'),workspace.indexOf('const commitNativeGradeRuleSet=next=>'))
  assert.match(recovery,/localStorage\.getItem\(nativeGradeDraftJournalKey\)/)
  assert.match(recovery,/decodeModaris2DGradeDraftJournal20261029\(journal,\{/)
  assert.match(recovery,/current:stored,validate:validateNativeGradeDraftEntry/)
  const commit=workspace.slice(workspace.indexOf('const commitNativeGradeRuleSet=next=>'),workspace.indexOf('const restoreNativeGradeDraft=direction=>'))
  assert(commit.indexOf('persistNativeGradeDraftJournal(next,history,{')<commit.indexOf('nativeGradeRulesRef.current=next'),
    'Storage must be committed before the UI reports a successful grading edit')
  assert.match(commit,/persistNativeGradeDraftJournal\(next,history,\{[\s\S]*?current:nativeGradeRulesRef\.current,undo:previous\.undo,redo:previous\.redo/,
    'The edit must compare both the observed current grade and history before overwriting another workspace')
  assert.match(commit,/catch\(error\)\{[\s\S]*?return false/)
  const restore=workspace.slice(workspace.indexOf('const restoreNativeGradeDraft=direction=>'),workspace.indexOf('const clearNativeGradeRuleSet=()=>'))
  assert(restore.indexOf('persistNativeGradeDraftJournal(next,revised,{')<restore.indexOf('nativeGradeDraftHistory.current=revised'),
    'Undo/Redo must not mutate visible history until both local storage writes succeed')
  assert.match(restore,/persistNativeGradeDraftJournal\(next,revised,\{[\s\S]*?current:nativeGradeRulesRef\.current,undo:history\.undo,redo:history\.redo/)
  const clear=workspace.slice(workspace.indexOf('const clearNativeGradeRuleSet=()=>'),workspace.indexOf('const ensureNativeOptitexGradeRules=()=>'))
  assert.match(clear,/clearModaris2DGradeDraftJournal20261029\(localStorage,nativeRuleDraftKey,\{[\s\S]*?expected:\{current:nativeGradeRulesRef\.current/)
  assert(clear.indexOf('clearModaris2DGradeDraftJournal20261029')<clear.indexOf('nativeGradeRulesRef.current=null'),
    'A storage-clear failure must leave the current grading draft visible')
})

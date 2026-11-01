import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {auditSourceOwnershipBudget,countSourceLines,SOURCE_OWNERSHIP_BUDGETS} from './appSourceOwnershipBudget20261030.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')

test('source line accounting handles trailing newlines and empty files',()=>{
  assert.equal(countSourceLines(''),0)
  assert.equal(countSourceLines('one'),1)
  assert.equal(countSourceLines('one\n'),1)
  assert.equal(countSourceLines('one\ntwo\n'),2)
})

test('budget fails closed on oversized source with actionable overage',()=>{
  const result=auditSourceOwnershipBudget(()=> 'one\ntwo\nthree\n',[{path:'example.jsx',maxLines:2}])
  assert.deepEqual(result,{ok:false,rows:[{path:'example.jsx',lines:3,maxLines:2,overage:1,ok:false}]})
})

test('production UI entrypoints remain within extraction budgets',()=>{
  const result=auditSourceOwnershipBudget(sourcePath=>readFileSync(path.join(root,sourcePath),'utf8'))
  assert.equal(result.rows.length,SOURCE_OWNERSHIP_BUDGETS.length)
  assert.equal(result.ok,true,JSON.stringify(result.rows))
})

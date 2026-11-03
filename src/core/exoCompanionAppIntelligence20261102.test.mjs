import test from 'node:test'
import assert from 'node:assert/strict'
import {interpretExoAppQuestion20261102,EXO_APP_KNOWLEDGE_20261102} from './exoCompanionAppIntelligence20261102.js'
import {EXO_COMPANION_TOUR_MODES} from './exoCompanionExperience20261102.js'

test('every topic resolves to an existing tour while retaining dedicated future keys',()=>{
  assert.equal(EXO_APP_KNOWLEDGE_20261102.length,13)
  for(const topic of EXO_APP_KNOWLEDGE_20261102)assert.ok(EXO_COMPANION_TOUR_MODES[interpretExoAppQuestion20261102('teach me '+topic.name).tourMode],topic.id)
  for(const [topic,mode] of Object.entries({sewing:'sewing',avatar:'avatar',render:'render',animation:'animation',library:'library','widget-studio':'widgets',print:'print'}))
    assert.equal(EXO_APP_KNOWLEDGE_20261102.find(entry=>entry.id===topic).tour,mode)
})
test('focused sewing instructions never trigger full studio tour',()=>{
  const result=interpretExoAppQuestion20261102('how to sew zipper')
  assert.equal(result.kind,'tour')
  assert.equal(result.topic,'sewing')
  assert.notEqual(result.tourMode,'full')
})
test('where is queries are safe navigation even when topic is an action verb',()=>{
  for(const query of ['where is render','where is the sewing panel','where can I find the widget studio','where is print layout','where is the file library']){
    const result=interpretExoAppQuestion20261102(query)
    assert.equal(result.kind,'navigate',query)
    assert.match(result.message,/No action has been taken/)
    assert.equal(result.requiresVerifiedAction,undefined)
  }
})
test('guided requests resolve specific topics before broad tours',()=>{
  assert.deepEqual([interpretExoAppQuestion20261102('walk me through theme settings').kind,interpretExoAppQuestion20261102('walk me through theme settings').topic],['tour','settings'])
  assert.equal(interpretExoAppQuestion20261102('teach me the 2d pattern workflow').topic,'pattern')
  assert.equal(interpretExoAppQuestion20261102('can you show me how to use the tech pack').tourMode,'techpack')
  assert.equal(interpretExoAppQuestion20261102('walk me through the entire app').tourMode,'full')
})
test('navigation requests do not imply execution',()=>{
  const result=interpretExoAppQuestion20261102('open the avatar workspace')
  assert.equal(result.kind,'navigate')
  assert.equal(result.section,'Avatar')
  assert.deepEqual(result.availableActions,['avatar.library','avatar.properties'])
})
test('questions name only real registered command identifiers',()=>{
  const result=interpretExoAppQuestion20261102('what tools are available for sewing')
  assert.equal(result.kind,'answer')
  assert.ok(result.availableActions.includes('sewing.sew'))
  assert.equal(interpretExoAppQuestion20261102('simulate cloth now').requiresVerifiedAction,true)
  assert.equal(interpretExoAppQuestion20261102('').kind,'unrecognized')
})

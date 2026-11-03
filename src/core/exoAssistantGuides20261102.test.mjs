import test from 'node:test'
import assert from 'node:assert/strict'
import {EXO_GUIDES_20261102,resolveExoGuide20261102,classifyExoAssistantRequest20261102} from './exoAssistantGuides20261102.js'

test('all guide steps have actual target and navigation reference',()=>{
 for(const [id,guide] of Object.entries(EXO_GUIDES_20261102)){
  assert(guide.steps.length>=3,id)
  for(const step of guide.steps)assert(step.target&&step.navigate&&step.detail&&step.title)
 }
})
test('guide understands techpack, pattern, grading and materials',()=>{
 assert.equal(resolveExoGuide20261102('How do I edit a tech pack?'),'techpack')
 assert.equal(resolveExoGuide20261102('Help me with garment grading'),'grading')
 assert.equal(resolveExoGuide20261102('Where is the fabric panel?'),'material')
 assert.equal(resolveExoGuide20261102('Teach me 2D patterns'),'pattern')
})
test('does not confuse actual editing command with tutorial',()=>{
 assert.equal(classifyExoAssistantRequest20261102('Make the fabric heavier').kind,'command')
 assert.equal(classifyExoAssistantRequest20261102('Show me how to grade a pattern').kind,'guide')
 assert.equal(classifyExoAssistantRequest20261102('Take me to the Techpack workspace').kind,'navigate')
})

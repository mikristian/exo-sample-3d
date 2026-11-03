import test from 'node:test'
import assert from 'node:assert/strict'
import {interpretExoCompanionWorkflow20261102 as decide} from './exoCompanionWorkflow20261102.js'
import {listExoCompanionWorkflows20261102,resolveExoCompanionWorkflow20261102,validateExoCompanionCustomWorkflow20261102,readExoCompanionCustomWorkflows20261102,saveExoCompanionCustomWorkflows20261102,advanceExoCompanionWorkflow20261102} from './exoCompanionWorkflow20261102.js'
test('remembers a garment across short typed or spoken confirmations',()=>{
 const opening=decide('Can you make my first T-shirt pattern?')
 assert.deepEqual(opening,{kind:'offer',templateId:'tee'})
 for(const response of ['OK do the pattern','Yes','go ahead','start with a basic template','do it','Yeah, make it'])assert.deepEqual(decide(response,{pendingTemplateId:opening.templateId}),{kind:'create',templateId:'tee'},response)
})
test('built-in workflows expose real actions and manual checkpoints',()=>{
 const workflows=listExoCompanionWorkflows20261102()
 assert.ok(workflows.length>=4)
 const grade=resolveExoCompanionWorkflow20261102('pattern-grading')
 assert.deepEqual(grade.steps.map(step=>step.id),['inspect','grading','autoGrade','nest','techpack'])
 assert.deepEqual(grade.steps[2].action,{type:'autoGrade',sizes:['XS','S','M','L','XL','XXL']})
 assert.equal(grade.steps[3].action.type,'gradingNest')
 assert.ok(resolveExoCompanionWorkflow20261102('garment-development').steps.some(step=>step.id==='autoGrade'))
 assert.equal(validateExoCompanionCustomWorkflow20261102({id:'custom-grade',title:'Grade',steps:['autoGrade']}).ok,true)
 assert.ok(grade.steps[1].checkpoint)
 const creation=resolveExoCompanionWorkflow20261102('pattern-creation')
 assert.equal(advanceExoCompanionWorkflow20261102(creation,0,{ok:true}).needsConfirmation,true)
 assert.equal(advanceExoCompanionWorkflow20261102(creation,0,{ok:false},{confirmed:true}).ok,false)
 assert.equal(advanceExoCompanionWorkflow20261102(creation,0,{ok:true},{confirmed:true}).index,1)
})
test('custom workflow storage sanitizes records and rejects unsafe actions',()=>{
 const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)}
 const custom={id:'custom-first-fit',title:'First fitting',steps:['create','inspect','grading','preview']}
 assert.equal(validateExoCompanionCustomWorkflow20261102(custom).ok,true)
 assert.equal(saveExoCompanionCustomWorkflows20261102(storage,[custom]).ok,true)
 assert.deepEqual(readExoCompanionCustomWorkflows20261102(storage),[custom])
 assert.equal(resolveExoCompanionWorkflow20261102(custom.id,[custom]).steps.length,4)
 assert.equal(validateExoCompanionCustomWorkflow20261102({...custom,steps:['shell']}).ok,false)
 assert.equal(validateExoCompanionCustomWorkflow20261102({...custom,steps:['inspect'],evil:true}).ok,false)
 assert.equal(saveExoCompanionCustomWorkflows20261102(storage,[custom,custom]).ok,false)
 assert.deepEqual(readExoCompanionCustomWorkflows20261102(storage),[custom])
 memory.set('exo.companion.customWorkflows.v1','{"__proto__":{"steps":["shell"]}}')
 assert.deepEqual(readExoCompanionCustomWorkflows20261102(storage),[])
})
test('immediate creation, choice and cancellation stay explicit',()=>{
 assert.deepEqual(decide('create a hoodie now'),{kind:'create',templateId:'hoodie'})
 assert.deepEqual(decide('draw a pants pattern'),{kind:'offer',templateId:'pants'})
 assert.deepEqual(decide('create a pattern'),{kind:'choose'})
 assert.deepEqual(decide('no',{pendingTemplateId:'tee'}),{kind:'cancel'})
 assert.deepEqual(decide('I have my measurements',{pendingTemplateId:'tee'}),{kind:'measurements',templateId:'tee'})
 assert.deepEqual(decide('What does the pattern button do?'),{kind:'none'})
 assert.deepEqual(decide('tell me about a T-shirt'),{kind:'none'})
})

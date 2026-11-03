import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceExoCompanionPatternConversation20261102 as advance,handleExoCompanionPatternTurn20261102 as handle,createExoCompanionPatternConversation20261102 as create} from './exoCompanionPatternConversation20261102.js'

const start=(text='make an oversized hoodie')=>{
  const result=handle(text)
  assert.equal(result.ok,true,result.message)
  assert.equal(result.kind,'draft')
  return result
}
const sketch={
  ok:true,normalizedContour:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],
  silhouetteAspectRatio:1.15,evidence:{possibleSleeveExtension:{detected:false}},
  manufacturingApproved:false,measurementCalibrationVerified:false,
}
test('creates editable QA-checked hoodie draft without mutating supplied context',()=>{
  const initial=create(),snapshot=structuredClone(initial)
  const created=advance({context:initial,message:'make an oversized hoodie'})
  assert.equal(created.ok,true,created.message)
  assert.equal(created.proposal.qa.status,'pass')
  assert.equal(created.proposal.project.patternGeneration.manufacturingApproved,false)
  assert.equal(created.context.design.fit,'oversized')
  assert.deepEqual(initial,snapshot)
})
test('relative cropping recomputes canonical complete design and keeps fit',()=>{
  const a=start(),b=handle('crop it 8 cm',a.context)
  assert.equal(b.ok,true,b.message)
  assert.equal(b.kind,'revise')
  assert.equal(b.context.design.fit,'oversized')
  assert.equal(b.context.design.lengthCm,63)
  assert.equal(b.proposal.qa.status,'pass')
  assert.equal(a.context.design.lengthCm,null)
})
test('repeated crops recompute from canonical length, no transforms on prior project',()=>{
  const a=start(),b=handle('crop it 4 cm',a.context),c=handle('make it shorter 4 cm',b.context)
  assert.equal(b.ok,true,b.message)
  assert.equal(c.ok,true,c.message)
  assert.equal(c.context.design.lengthCm,63)
  assert.equal(c.context.history.length,2)
  assert.notEqual(c.proposal.project.id,b.proposal.project.id)
})
test('navy is styling metadata; the editable pattern remains QA-checked',()=>{
  const a=start(),b=handle('make it navy',a.context)
  assert.equal(b.ok,true,b.message)
  assert.equal(b.context.design.color,'navy')
  assert.equal(b.proposal.report.sourceTemplateId,'hoodie')
  assert.deepEqual(b.proposal.project.pieces.map(p=>p.points),a.proposal.project.pieces.map(p=>p.points))
})
test('converts hoodie to authored zip hoodie and preserves fit',()=>{
  const a=start(),b=handle('convert it to zip hoodie',a.context)
  assert.equal(b.ok,true,b.message)
  assert.equal(b.context.design.templateId,'zip-hoodie')
  assert.equal(b.context.design.fit,'oversized')
  assert.equal(b.proposal.report.sourceTemplateId,'zip-hoodie')
})
test('undo restores exact preceding design and proposal; revision advances',()=>{
  const a=start(),b=handle('make it navy',a.context),c=handle('undo last design revision',b.context)
  assert.equal(c.ok,true,c.message)
  assert.equal(c.context.design.color,null)
  assert.deepEqual(c.proposal.project.pieces,a.proposal.project.pieces)
  assert.equal(c.context.revision,3)
  assert.notEqual(c.context.proposalKey,b.context.proposalKey)
})
test('preview and explicit confirmation preserve proposal and never install project',()=>{
  const a=start(),p=handle('show preview',a.context),c=handle('confirm pattern',p.context)
  assert.equal(p.kind,'preview')
  assert.equal(c.kind,'ready_to_install')
  assert.deepEqual(p.context,a.context)
  assert.deepEqual(c.context,a.context)
  assert.ok(c.proposal.project)
  assert.equal(c.project,undefined)
})
test('cancel clears draft, confirms no prior candidate and bumps revision',()=>{
  const a=start(),b=handle('cancel pattern',a.context)
  assert.equal(b.kind,'cancelled')
  assert.equal(b.context.proposal,null)
  assert.equal(b.context.design,null)
  assert.equal(handle('confirm pattern',b.context).ok,false)
})
test('unsupported construction cannot replace existing accepted preview',()=>{
  const a=start(),b=handle('make it padded trapunto hoodie',a.context)
  assert.equal(b.ok,false)
  assert.deepEqual(b.context,a.context)
})
test('negative prompts cannot silently reverse design intent',()=>{
  const a=start()
  for(const phrase of ['do not crop it','make it not oversized','remove the hood']){
    const b=advance({context:a.context,message:phrase})
    assert.equal(b.ok,false,phrase)
    assert.deepEqual(b.context,a.context)
  }
})
test('conflicting fits and measurements leave original candidate untouched',()=>{
  const a=start()
  for(const phrase of ['make it slim and oversized','crop and lengthen it','body length 55 cm and body length 60 cm']){
    const b=advance({context:a.context,message:phrase})
    assert.equal(b.ok,false,phrase)
    assert.deepEqual(b.context,a.context)
  }
})
test('unsafe dimensions fail digital QA without changing candidate',()=>{
  const a=start(),b=handle('body length 1000 cm',a.context)
  assert.equal(b.ok,false)
  assert.deepEqual(b.context,a.context)
})
test('stale revision and proposal key reject edits',()=>{
  const a=start()
  assert.equal(advance({context:a.context,message:'make it navy',expectedRevision:0}).kind,'stale')
  assert.equal(advance({context:a.context,message:'confirm pattern',expectedProposalKey:'old'}).kind,'stale')
})
test('unrelated assistant requests are not intercepted',()=>{
  const a=start()
  for(const prompt of ['change theme to blue','open my saved hoodie projects','how to crop tee','navigate to the dashboard','what is a sleeve cap?']){
    assert.equal(handle(prompt,a.context).handled,false,prompt)
  }
})
test('not every command-like sentence is a standalone pattern action',()=>{
  const a=start()
  const result=handle('can you confirm this pattern needs changes?',a.context)
  assert.equal(result.handled,false)
})
test('unsupported family changes and standalone editing without a draft are rejected',()=>{
  const a=start()
  assert.equal(advance({context:a.context,message:'change to a dress'}).ok,false)
  assert.equal(advance({message:'crop it 8 cm'}).ok,false)
})
test('undo after initial draft refuses safely',()=>{
  const a=start(),b=handle('undo',a.context),c=handle('preview pattern',a.context)
  assert.equal(b.ok,false)
  assert.equal(c.ok,true)
})
test('sketch follow-up revises same canonical hoodie and records guided generation',()=>{
  const a=start(),snapshot=structuredClone(a.context)
  for(const instruction of ['use this sketch','make pattern from my sketch','draft from uploaded sketch']){
    const b=handle(instruction,a.context,{sketch})
    assert.equal(b.handled,true,instruction)
    assert.equal(b.ok,true,b.message)
    assert.equal(b.kind,'revise')
    assert.equal(b.proposal.project.patternGeneration.method,'sketch_guided_template_conditioned_v1')
    assert.equal(b.context.design.templateId,'hoodie')
    assert.equal(b.context.design.fit,'oversized')
    assert.notEqual(b.context.proposalKey,a.context.proposalKey)
    assert.equal(b.context.revision,a.context.revision+1)
  }
  assert.deepEqual(a.context,snapshot)
})
test('initial combined sketch and garment text is recognized without residual parser errors',()=>{
  for(const instruction of ['make me an oversized hoodie using this sketch','make a boxy cropped tee from my sketch']){
    const created=handle(instruction,null,{sketch})
    assert.equal(created.handled,true)
    assert.equal(created.ok,true,created.message)
    assert.equal(created.proposal.project.patternGeneration.method,'sketch_guided_template_conditioned_v1')
  }
})
test('initial sketch only asks for garment family and does not invent design',()=>{
  for(const instruction of ['use this sketch','make pattern from my sketch','draft from uploaded sketch']){
    const before=create(),result=handle(instruction,before,{sketch})
    assert.equal(result.handled,true)
    assert.equal(result.ok,false)
    assert.match(result.message,/choose a garment type/i)
    assert.deepEqual(result.context,before)
  }
})
test('sketch revision supports undo of exact old proposal and sketch evidence',()=>{
  const a=start(),b=handle('use this sketch',a.context,{sketch}),c=handle('undo',b.context)
  assert.equal(b.ok,true,b.message)
  assert.equal(c.ok,true,c.message)
  assert.deepEqual(c.context.design,a.context.design)
  assert.equal(c.context.sketch,null)
  assert.deepEqual(c.proposal.project.pieces,a.proposal.project.pieces)
  assert.equal(c.proposal.project.patternGeneration.method,'text_prompt_template_conditioned_v1')
})
test('sketch evidence remains used during subsequent text refinement',()=>{
  const a=start(),b=handle('use this sketch',a.context,{sketch}),c=handle('make it navy',b.context)
  assert.equal(c.ok,true,c.message)
  assert.equal(c.context.design.color,'navy')
  assert.equal(c.proposal.project.patternGeneration.method,'sketch_guided_template_conditioned_v1')
})
test('malformed sketch, stale sketch update and missing sketch cannot mutate active candidate',()=>{
  const a=start(),before=structuredClone(a.context)
  for(const request of [
    handle('use this sketch',a.context,{sketch:{...sketch,measurementCalibrationVerified:true}}),
    handle('use this sketch',a.context),
    handle('use this sketch',a.context,{sketch,expectedRevision:0}),
    handle('draft from uploaded sketch',a.context,{sketch,expectedProposalKey:'stale'}),
  ]){
    assert.equal(request.ok,false)
    assert.deepEqual(request.context,before)
  }
})
test('cancelling sketch guided candidate clears sketch and proposal without application',()=>{
  const a=start(),b=handle('use this sketch',a.context,{sketch}),c=handle('cancel',b.context)
  assert.equal(c.kind,'cancelled')
  assert.equal(c.context.sketch,null)
  assert.equal(c.context.proposal,null)
  assert.equal(c.context.design,null)
  assert.equal(c.project,undefined)
})

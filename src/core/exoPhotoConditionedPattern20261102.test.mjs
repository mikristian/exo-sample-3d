import test from 'node:test'
import assert from 'node:assert/strict'
import {interpretExoGarmentPhotoRgba20261102 as interpret,draftExoPhotoConditionedPattern20261102 as draft} from './exoPhotoConditionedPattern20261102.js'
import {projectToDxf} from './dxf.js'
import {handleExoCompanionPatternTurn20261102 as handle} from './exoCompanionPatternConversation20261102.js'

function image(mode='single'){
  const width=160,height=160,rgba=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const garment=y>=18&&y<=135&&(y<=48?x>=19&&x<=140:x>=51&&x<=108)
    const second=mode==='multiple'&&x>=8&&x<=32&&y>=80&&y<=135
    const busy=mode==='busy'&&(x<10||x>149)
    const i=(y*width+x)*4
    rgba[i]=garment||second?35:busy?(y%2?220:80):245
    rgba[i+1]=garment||second?65:busy?(y%2?30:200):245
    rgba[i+2]=garment||second?95:busy?(y%2?10:150):245
    rgba[i+3]=255
  }
  return {rgba,width,height}
}

test('single isolated garment photo produces reviewed silhouette only; output is QA-checked editable DXF',()=>{
  const photo=interpret(image())
  assert.equal(photo.ok,true,photo.reason)
  assert.equal(photo.kind,'photo-reference')
  assert.equal(photo.manufacturingApproved,false)
  assert.equal(photo.measurementCalibrationVerified,false)
  const result=draft({prompt:'Create a crew neck T-shirt',photo})
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.qa.status,'pass')
  assert.equal(result.project.patternGeneration.method,'photo_guided_template_conditioned_v1')
  assert.equal(result.project.patternGeneration.trainedPhotoDecoderUsed,false)
  assert.equal(result.project.patternGeneration.photoUncalibrated,true)
  assert.equal(result.project.patternGeneration.physicalFitVerified,false)
  assert.equal(result.project.patternGeneration.sourceTopologyRetained,true)
  assert.ok(projectToDxf(result.project,'M').includes('ENTITIES'))
})

test('rejects complex background, separated objects, invalid or forged evidence',()=>{
  assert.equal(interpret(image('busy')).ok,false)
  assert.equal(interpret(image('multiple')).ok,false)
  const photo=interpret(image())
  assert.equal(draft({prompt:'Create hoodie',photo:{...photo,measurementCalibrationVerified:true}}).ok,false)
  assert.equal(draft({prompt:'Create hoodie',photo:{...photo,source:'unknown'}}).ok,false)
  assert.equal(draft({prompt:'Create a padded trapunto hoodie',photo}).ok,false)
  assert.equal(draft({prompt:'Create shirt and jeans',photo}).ok,false)
})

test('photo guided conversation revises across turns, preserves evidence and undo/cancel semantics',()=>{
  const photo=interpret(image())
  assert.equal(photo.ok,true,photo.reason)
  const initial=handle('make an oversized hoodie')
  assert.equal(initial.ok,true,initial.message)
  const before=structuredClone(initial.context)
  const revised=handle('use this photo',initial.context,{photo})
  assert.equal(revised.ok,true,revised.message)
  assert.equal(revised.kind,'revise')
  assert.equal(revised.proposal.project.patternGeneration.method,'photo_guided_template_conditioned_v1')
  assert.notEqual(revised.context.proposalKey,initial.context.proposalKey)
  assert.deepEqual(initial.context,before)
  const colored=handle('make it navy',revised.context)
  assert.equal(colored.ok,true,colored.message)
  assert.equal(colored.proposal.project.patternGeneration.method,'photo_guided_template_conditioned_v1')
  const undone=handle('undo',colored.context)
  assert.equal(undone.ok,true)
  assert.equal(undone.context.design.color,null)
  assert.equal(undone.context.photo?.kind,'photo-reference')
  const undoneAgain=handle('undo',undone.context)
  assert.equal(undoneAgain.ok,true)
  assert.equal(undoneAgain.context.photo,null)
  assert.equal(undoneAgain.proposal.project.patternGeneration.method,'text_prompt_template_conditioned_v1')
  const cancelled=handle('cancel',colored.context)
  assert.equal(cancelled.context.photo,null)
  assert.equal(cancelled.context.proposal,null)
})

test('first photo-only turn requires garment family, combined photo text is supported, stale revisions block',()=>{
  const photo=interpret(image())
  const missing=handle('make pattern from this photo',null,{photo})
  assert.equal(missing.handled,true)
  assert.equal(missing.ok,false)
  const created=handle('make a boxy cropped tee from this photo',null,{photo})
  assert.equal(created.ok,true,created.message)
  assert.equal(created.proposal.project.patternGeneration.method,'photo_guided_template_conditioned_v1')
  const stale=handle('use this photo',created.context,{photo,expectedRevision:0})
  assert.equal(stale.ok,false)
  assert.deepEqual(stale.context,created.context)
})

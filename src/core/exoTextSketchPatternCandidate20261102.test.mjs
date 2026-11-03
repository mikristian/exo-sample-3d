import test from 'node:test'
import assert from 'node:assert/strict'
import {createTemplateProject} from '../data/templates.js'
import {projectToDxf} from './dxf.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {interpretExoSketchRgba20261102} from './exoSketchPatternInterpreter20261102.js'
import {draftExoTextSketchPattern20261102 as draft} from './exoTextSketchPatternCandidate20261102.js'

const body='Create an oversized cropped hoodie with long sleeves and kangaroo pocket, body length 58 cm'
const source=()=>{
  const width=120,height=120,rgba=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const black=y>=15&&y<=103&&(y<=38?x>=10&&x<=109:x>=37&&x<=82)
    const i=(y*width+x)*4
    rgba[i]=rgba[i+1]=rgba[i+2]=black?0:255
    rgba[i+3]=255
  }
  return interpretExoSketchRgba20261102({rgba,width,height})
}

test('generates a new oversized cropped hoodie with 32 independently QA-passing authored seams and DXF',()=>{
  const before=createTemplateProject('hoodie'),snapshot=structuredClone(before)
  const result=draft({prompt:body})
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.report.sourceTemplateId,'hoodie')
  assert.equal(result.report.panels,10)
  assert.equal(result.report.seams,32)
  assert.equal(result.qa.status,'pass')
  assert.ok(projectToDxf(result.project,result.report.baseSize).length>20000)
  assert.equal(result.project.patternGeneration.method,'text_prompt_template_conditioned_v1')
  assert.equal(result.project.patternGeneration.trainedTextDecoderUsed,false)
  assert.equal(result.project.patternGeneration.manufacturingApproved,false)
  assert.equal(result.project.patternGeneration.fitVerified,false)
  assert.equal(result.project.patternGeneration.gradingVerified,false)
  assert.deepEqual(before,snapshot)
})

test('text-to-pattern covers independent T-shirt, zip hoodie, skirt, trousers, and authored denim families',()=>{
  const samples=[
    ['Make a boxy cropped crew neck T-shirt with short sleeves','tee',4,14],
    ['Create a zip-up hoodie','zip-hoodie',10,34],
    ['Create an A-line skirt','skirt',2,2],
    ['Make straight leg trousers','jeans-501-fit',4,10],
    ['Draft classic straight-leg denim jeans','jeans-501',24,28],
  ]
  for(const [prompt,template,pieces,seams] of samples){
    const result=draft({prompt})
    assert.equal(result.ok,true,`${template}: ${result.reason}`)
    assert.equal(result.report.sourceTemplateId,template)
    assert.equal(result.project.pieces.length,pieces)
    assert.equal(result.project.seams.length,seams)
    assert.equal(inspectIndustrialPatterns(result.project,{sizes:[result.report.baseSize]}).status,'pass')
    assert.ok(projectToDxf(result.project,result.report.baseSize).includes('ENTITIES'))
  }
})

test('sketch-derived evidence actually changes geometry of an editable but uncalibrated tee candidate',()=>{
  const sketch=source()
  assert.equal(sketch.ok,true,JSON.stringify(sketch))
  const base=draft({prompt:'Create crew neck T-shirt'})
  const combined=draft({prompt:'Create crew neck T-shirt',sketch})
  assert.equal(base.ok,true,base.reason)
  assert.equal(combined.ok,true,combined.reason)
  assert.equal(combined.project.patternGeneration.method,'sketch_guided_template_conditioned_v1')
  assert.equal(combined.project.patternGeneration.sketchUncalibrated,true)
  assert.equal(combined.project.patternGeneration.manufacturingApproved,false)
  assert.equal(combined.report.sketchCues.slightlyCropped,true)
  const front=id=>id.project.pieces.find(x=>x.id==='front')
  assert.notDeepEqual(front(combined).points,front(base).points)
  assert.equal(combined.qa.status,'pass')
  assert.ok(projectToDxf(combined.project,'M').length>5000)
})

test('unlabeled sketch must be associated with a human-selected family; incompatible selection blocks',()=>{
  const sketch=source()
  assert.equal(draft({sketch}).ok,false)
  const proposal=draft({sketch,forcedTemplateId:'tee'})
  assert.equal(proposal.ok,true,proposal.reason)
  assert.equal(proposal.project.patternGeneration.sketchUncalibrated,true)
  assert.equal(draft({sketch,prompt:'Create a tee',forcedTemplateId:'hoodie'}).ok,false)
})

test('unavailable designs and invented construction details never become successful patterns',()=>{
  for(const prompt of [
    'Create a padded trapunto hoodie with mold-embossed sections',
    'Draft a drop shoulder hoodie with unmatched sleeve caps',
    'Make a pleated wrap skirt',
    'Design a custom technical winter jacket with asymmetric closure',
    'Make a midi dress with fitted princess seams',
    'Create an oversized cargo jumpsuit with utility pockets',
    'Create slim jeans with altered waist and hardware',
    'Make a T-shirt with a tall collar and zipper',
    'Create both a hoodie and trousers',
    'Book me a table at a restaurant',
  ]){
    const result=draft({prompt})
    assert.equal(result.ok,false,prompt)
    assert.equal(result.manufacturingApproved,false)
    assert.equal(result.project,undefined)
  }
})

test('incomplete sketch, inconsistent specifications and unsafe sizes are rejected',()=>{
  const sketch=source()
  const malformed={...sketch,measurementCalibrationVerified:true}
  assert.equal(draft({prompt:'Make a T-shirt',sketch:malformed}).ok,false)
  assert.equal(draft({prompt:'Create a hoodie with body length 1000 cm'}).ok,false)
  assert.equal(draft({prompt:'Create a hoodie, body length 42 cm'}).ok,false)
  assert.equal(draft({prompt:'Create a T-shirt with seam allowance 10 cm'}).ok,false)
  assert.equal(draft({prompt:'Create a hoodie and jeans'}).ok,false)
})

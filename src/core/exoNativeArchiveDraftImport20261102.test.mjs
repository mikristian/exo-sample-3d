import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareVerifiedNativeArchiveDraft,openVerifiedNativeArchiveDraft} from './exoNativeArchiveDraftImport20261102.js'
import {decodeVerifiedGarmentProject} from './exoDecodedGarmentProject20261102.js'
import {createDefaultProject} from '../data/defaultProject.js'
import {draftExoTextSketchPattern20261102} from './exoTextSketchPatternCandidate20261102.js'
import {interpretExoGarmentPhotoRgba20261102} from './exoGarmentPhotoReference20261102.js'
import {draftExoPhotoConditionedPattern20261102} from './exoPhotoConditionedPattern20261102.js'

function candidate(){
  const spec={pattern:{panels:{Front:{vertices:[[0,0],[10,0],[10,10],[0,10]],edges:[{endpoints:[0,1]},{endpoints:[1,2]},{endpoints:[2,3]},{endpoints:[3,0]}]},Back:{vertices:[[0,0],[10,0],[10,10],[0,10]],edges:[{endpoints:[0,1]},{endpoints:[1,2]},{endpoints:[2,3]},{endpoints:[3,0]}]}},stitches:[[{panel:'Front',edge:0},{panel:'Back',edge:0}]]},properties:{units_in_meter:100,curvature_coords:'relative',normalized_edge_loops:true}}
  const result=decodeVerifiedGarmentProject({ok:true,verified:true,sourceId:'default/00/a',source:{dataset:'GarmentCodeData v2',sourceId:'default/00/a',sha256:'a'.repeat(64)},spec},createDefaultProject())
  assert.equal(result.ok,true,result.reason)
  return result.project
}

test('preflight blocks unverified source before native conversion',()=>{
  const draft=candidate()
  draft.patternGeneration.sourceVerified=false
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(draft),/verified archive, independently QA-passing/)
})

test('native open preserves captured FittingProject fields, validates conversion and clears history state',async()=>{
  const draft=candidate(),calls=[]
  draft.pieces[0].arrangement3d.wrap=null
  assert.equal(draft.pieces[0].arrangement3d.wrap,null)
  const old={name:'Current native project',avatar:{height:180},state:{history:['old']},mesh_signature:'old-mesh',print_graphics:[1],imported_hardware:[2]}
  const result=await openVerifiedNativeArchiveDraft(draft,{
    bridgeOrigin:'http://127.0.0.1:5193',
    bridgeFetch:async(_url,options)=>{calls.push('convert');const exported=JSON.parse(options.body).document;assert.ok(exported.pieces.length);assert.equal(exported.pieces[0].arrangement3d.wrap,'');return {ok:true,json:async()=>({ok:true,template:{panels:[{},{}],seams:[{}]}})}},
    requestProject:async(action,data)=>{calls.push(action);if(action==='capture')return {project:old};assert.equal(data.name,old.name);assert.equal(data.state,null);assert.equal(data.mesh_signature,null);assert.deepEqual(data.print_graphics,[]);assert.deepEqual(data.imported_hardware,[]);return {ok:true}},
    persistBackup:async snapshot=>{calls.push('backup');assert.deepEqual(snapshot,old);return {id:'library-safe-backup'}},
  })
  assert.deepEqual(calls,['convert','capture','backup','open'])
  assert.equal(result.panels,2)
  assert.equal(result.backupId,'library-safe-backup')
  assert.equal(draft.pieces[0].arrangement3d.wrap,null)
  assert.deepEqual(old.state,{history:['old']})
})

test('converter rejection and invalid QA never capture or mutate native editor',async()=>{
  const draft=candidate(),calls=[]
  await assert.rejects(openVerifiedNativeArchiveDraft(draft,{
    bridgeOrigin:'http://127.0.0.1:5193',bridgeFetch:async()=>({ok:false,json:async()=>({error:'converter failed'})}),
    requestProject:async action=>{calls.push(action);return {}},
  }),/converter failed/)
  assert.deepEqual(calls,[])
  draft.seams[0].b.edgeIndex=99
  await assert.rejects(openVerifiedNativeArchiveDraft(draft,{
    bridgeOrigin:'http://127.0.0.1:5193',bridgeFetch:async()=>{calls.push('convert');throw Error('unexpected')},
    requestProject:async action=>{calls.push(action);return {}},
  }),/Pattern QA blocked/)
  assert.deepEqual(calls,[])
})

test('failed durable backup aborts native replacement',async()=>{
  const calls=[]
  await assert.rejects(openVerifiedNativeArchiveDraft(candidate(),{
    bridgeOrigin:'http://127.0.0.1:5193',
    bridgeFetch:async()=>({ok:true,json:async()=>({ok:true,template:{panels:[{},{}],seams:[{}]}})}),
    requestProject:async action=>{calls.push(action);return {project:{name:'old garment'}}},
    persistBackup:async()=>{calls.push('backup');throw Error('File Library unavailable')},
  }),/File Library unavailable/)
  assert.deepEqual(calls,['capture','backup'])
})

test('native preflight accepts only QA-passing, independently evidenced neural research drafts',()=>{
  const draft=candidate()
  draft.patternGeneration={
    method:'trained_contour_research_seam_constrained_v1',trainedDecoderUsed:true,
    originalSourceVerified:true,candidateSourceVerified:false,sourceGraphPreserved:true,
    sourceId:'default/00/research',sourceSha256:'a'.repeat(64),modelCheckpointSha256:'b'.repeat(64),
    trainingGarments:23,heldOutTestGarments:8,heldOutContourRmseCm:0.086,
    acceptedResidualFraction:0.5,noveltyMaxDisplacementCm:0.6,reviewRequired:true,qaStatus:'pass',
    fitVerified:false,physicalFitVerified:false,gradingVerified:false,manufacturingApproved:false,
    gradedProductionApproved:false,
  }
  const prepared=prepareVerifiedNativeArchiveDraft(draft)
  assert.equal(prepared.document.pieces.length,2)
  const falseClaims=structuredClone(draft)
  falseClaims.patternGeneration.manufacturingApproved=true
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(falseClaims),/constrained neural research draft/)
  const noHeldout=structuredClone(draft)
  noHeldout.patternGeneration.heldOutTestGarments=0
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(noHeldout),/constrained neural research draft/)
  const invalidSeam=structuredClone(draft)
  invalidSeam.seams[0].b.edgeIndex=999
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(invalidSeam),/Pattern QA blocked/)
})

test('reviewed text-conditioned authored hoodie and jeans drafts pass native conversion preflight',()=>{
  for(const prompt of ['Create an oversized cropped hoodie, body length 58 cm',
                       'Create a zip-up hoodie','Create a straight-leg denim jeans']){
    const result=draftExoTextSketchPattern20261102({prompt})
    assert.equal(result.ok,true,`${prompt}: ${result.reason}`)
    const converted=prepareVerifiedNativeArchiveDraft(result.project)
    assert.equal(converted.document.pieces.length,result.project.pieces.length)
    assert.equal(converted.document.seams.length,result.project.seams.length)
    assert.equal(converted.report.removedSeams,0)
    assert.equal(result.project.patternGeneration.manufacturingApproved,false)
  }
})

test('native text/sketch preflight rejects fabricated model claims, missing reviewed geometry, and broken sewing',()=>{
  const candidate=draftExoTextSketchPattern20261102({prompt:'Make a crew neck T-shirt'})
  assert.equal(candidate.ok,true)
  const forged=structuredClone(candidate.project)
  forged.patternGeneration.trainedTextDecoderUsed=true
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(forged),/authored-template text\/sketch/)
  const bypass=structuredClone(candidate.project)
  bypass.patternGeneration.qaStatus='blocked'
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(bypass),/authored-template text\/sketch/)
  const unsafe=structuredClone(candidate.project)
  unsafe.seams[0].a.edgeIndex=1000
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(unsafe),/Pattern QA blocked/)
})

test('reviewed local garment photo generates native-ready editable DXF with preserved seams, without factory claims',()=>{
  const width=150,height=150,rgba=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const garment=y>=15&&y<=128&&(y<45?x>=18&&x<=131:x>=48&&x<=101)
    const i=(y*width+x)*4
    rgba[i]=garment?32:245;rgba[i+1]=garment?62:245;rgba[i+2]=garment?90:245;rgba[i+3]=255
  }
  const photo=interpretExoGarmentPhotoRgba20261102({width,height,rgba})
  assert.equal(photo.ok,true,photo.reason)
  const result=draftExoPhotoConditionedPattern20261102({prompt:'Create an oversized hoodie',photo})
  assert.equal(result.ok,true,result.reason)
  const converted=prepareVerifiedNativeArchiveDraft(result.project)
  assert.equal(converted.document.pieces.length,result.report.panels)
  assert.equal(converted.document.seams.length,result.report.seams)
  assert.equal(converted.report.removedSeams,0)
  assert.equal(result.project.patternGeneration.photoUncalibrated,true)
  assert.equal(result.project.patternGeneration.manufacturingApproved,false)
  const forged=structuredClone(result.project)
  forged.patternGeneration.trainedPhotoDecoderUsed=true
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(forged),/reviewed authored-template/)
  const badSource=structuredClone(result.project)
  badSource.patternGeneration.photoSegmentationMethod='made-up-vision-model'
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(badSource),/reviewed authored-template/)
  const falseApproval=structuredClone(result.project)
  falseApproval.patternGeneration.physicalFitVerified=true
  assert.throws(()=>prepareVerifiedNativeArchiveDraft(falseApproval),/reviewed authored-template/)
})

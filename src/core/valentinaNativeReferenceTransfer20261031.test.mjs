import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createTeeTemplate} from '../data/templates.js'
import {transferValentinaNativeReference20261031 as transfer} from './valentinaNativeReferenceTransfer20261031.js'

const root=new URL('../../research/oss/pattern-cad/',import.meta.url)
const read=path=>readFileSync(new URL(path,root),'utf8')
const hash=s=>createHash('sha256').update(s).digest('hex')
const dxf=read('runtime/verified-exports/male-shirt-engine-aama_pieces.dxf')
const sample=(identity)=>({
  patternXml:read(`ValentinaDevelop20261031/src/app/share/collection/${identity}/${identity}.val`),
  measurementsXml:read(`ValentinaDevelop20261031/src/app/share/collection/${identity}/${identity==='Trousers'?'trousers':'MaleShirt'}.vit`),
})
const report=(sources,identity='MaleShirt')=>({
  ok:true,engine:'Seamly2D',originEngine:'Valentina',format:'aama-r10',
  bridge:identity==='MaleShirt'?'verified-maleshirt-reference':'verified-trousers-reference',
  sourceMapping:`Valentina ${identity}.val -> independently ported Seamly2D construction`,
  sourceUnit:'mm',manufacturingApproved:false,factoryExportAllowed:false,
  inputSha256:hash(sources.patternXml),measurementsSha256:hash(sources.measurementsXml),
  artifacts:[{name:'calculated_pieces.dxf',content:dxf,sha256:hash(dxf),
    localInspection:{status:'LOCAL_INSPECTION_ONLY',sourceUnit:'mm',sourceCutPieces:17}}],
})

test('original MaleShirt source and verified AAMA become a reversible EXO reference draft',async()=>{
  const sources=sample('MaleShirt'),base=createTeeTemplate(),before=JSON.stringify(base)
  const {project,source}=await transfer(base,{...sources,engineResult:report(sources)})
  assert.equal(project.pieces.length,17)
  assert.equal(source.identity,'MaleShirt')
  assert.equal(project.patternSource.originalPatternXml,sources.patternXml)
  assert.equal(project.patternSource.originalMeasurementsXml,sources.measurementsXml)
  assert(project.patternSource.constructionReference?.toolCount>0)
  assert.equal(project.patternSource.measurementReference.measurementCount,9)
  assert(project.pieces.every(p=>p.locked&&p.patternImportProvenance.productionExportAllowed===false))
  assert.equal(JSON.stringify(base),before)
})

test('original large Trousers source is retained without lossy reconstruction',async()=>{
  const sources=sample('Trousers')
  const {project,source}=await transfer(createTeeTemplate(),{...sources,engineResult:report(sources,'Trousers')})
  assert.equal(source.identity,'Trousers')
  assert.equal(project.patternSource.originalPatternSha256,hash(sources.patternXml))
  assert.equal(project.patternSource.originalPatternXml,sources.patternXml)
  assert.equal(project.patternSource.constructionGraphParsed,false)
  assert.equal(project.patternSource.measurementReference.measurementCount,8)
})

test('refuse mismatched source, AAMA edits, forged CUT counts and wrong source identity',async()=>{
  const sources=sample('MaleShirt'),valid=report(sources)
  await assert.rejects(transfer(createTeeTemplate(),{...sources,patternXml:sources.patternXml+' ',engineResult:valid}),/do not match/)
  await assert.rejects(transfer(createTeeTemplate(),{...sources,engineResult:{...valid,artifacts:[{...valid.artifacts[0],content:dxf+'\n'}]}}),/digest mismatch/)
  await assert.rejects(transfer(createTeeTemplate(),{...sources,engineResult:{...valid,artifacts:[{...valid.artifacts[0],localInspection:{...valid.artifacts[0].localInspection,sourceCutPieces:2}}]}}),/count differs/)
  await assert.rejects(transfer(createTeeTemplate(),{...sources,engineResult:{...valid,bridge:'verified-trousers-reference'}}),/identity mismatch/)
})

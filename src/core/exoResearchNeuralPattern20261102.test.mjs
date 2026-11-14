import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createDefaultProject} from '../data/defaultProject.js'
import {projectToDxf} from './dxf.js'
import {buildExperimentalSizeRun20261102} from './exoGeneratedPatternGradeFit20261102.js'
import {prepareNeuralContourResearchCandidate20261102 as prepare} from './exoResearchNeuralPattern20261102.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const dataset=path.join(repo,'download/garment-dxf-library-20261023/garmentcodedata-v2')
const script=path.join(repo,'download/garment-dxf-library-20261023/tools/exo_contour_decoder_20261102.py')
const model=path.join(dataset,'training/contour-decoder-research-20261102/model.npz')
const manifest=path.join(dataset,'training/contour-decoder-research-20261102/manifest.json')
const sourceId='default/00/rand_V7F8J43Q5G'
const sourceFile=path.join(dataset,'specifications/default/batch-00/rand_V7F8J43Q5G_specification.json')
const available=[script,model,manifest,sourceFile].every(fs.existsSync)

function evidence() {
  const meta=JSON.parse(fs.readFileSync(manifest,'utf8'))
  return {model:meta.modelType,checkpointSha256:crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex'),
    trainingGarments:meta.metrics.splits.train.length,heldOutTestGarments:meta.metrics.splits.test.length,
    heldOutContourRmseCm:meta.metrics.vertexControlRmseCm.test}
}

function realPacket() {
  const bytes=fs.readFileSync(sourceFile)
  return {ok:true,verified:true,sourceId,source:{sourceId,dataset:'GarmentCodeData v2',
    sha256:crypto.createHash('sha256').update(bytes).digest('hex')},spec:JSON.parse(bytes)}
}

function realModelProposal(){
  const result=spawnSync('python3',[script,'generate','--root',dataset,'--checkpoint',model,
    '--source-id',sourceId,'--seed','11','--strength','0.12'],{encoding:'utf8',maxBuffer:2*1024*1024,timeout:30000})
  assert.equal(result.status,0,result.stderr||result.stdout)
  return {...JSON.parse(result.stdout),researchModelEvidence:evidence()}
}

test('actual trained decoder needs residual damping before a genuine new DXF clears seam QA',
  {skip:!available&&'Local verified research checkpoint/corpus unavailable'},()=>{
    const source=realPacket(),proposal=realModelProposal(),snapshot=structuredClone(source)
    const result=prepare(source,proposal,createDefaultProject())
    assert.equal(result.ok,true,result.reason)
    assert.deepEqual(source,snapshot)
    assert.equal(result.project.patternGeneration.trainedDecoderUsed,true)
    assert.equal(result.project.patternGeneration.candidateSourceVerified,false)
    assert.ok(result.report.acceptedResidualFraction<1)
    assert.ok(result.report.noveltyMaxDisplacementCm>0.02)
    assert.equal(result.qa.status,'pass')
    assert.equal(result.project.seams.length,14)
    assert.equal(result.project.pieces.length,4)
    assert.ok(projectToDxf(result.project,'M').length>1000)
    const run=buildExperimentalSizeRun20261102(result.project)
    assert.equal(run.ok,true,run.reason)
    assert.equal(run.sizeReports.length,3)
    assert.equal(run.gradedProductionApproved,false)
    assert.equal(run.physicalFitVerified,false)
    assert.equal(result.project.patternGeneration.manufacturingApproved,false)
    const raw=prepare(source,proposal,createDefaultProject(),{fractions:[1]})
    assert.equal(raw.ok,false)
    assert.ok(raw.attempts.some(a=>a.firstIssue==='SEAM_LENGTH_MISMATCH'))
  })

test('blocks fabricated checkpoint evidence and any model attempt to change sewing topology',
  {skip:!available&&'Local verified research checkpoint/corpus unavailable'},()=>{
    const source=realPacket(),proposal=realModelProposal()
    const invalid={...proposal,researchModelEvidence:{...proposal.researchModelEvidence,checkpointSha256:'forged'}}
    assert.match(prepare(source,invalid,createDefaultProject()).reason,/checkpoint/)
    const altered=structuredClone(proposal)
    altered.generatedSpec.pattern.stitches.splice(0,1)
    assert.match(prepare(source,altered,createDefaultProject()).reason,/stitch graph/)
    const unverified={...source,verified:false}
    assert.match(prepare(unverified,proposal,createDefaultProject()).reason,/Original source failed/)
  })

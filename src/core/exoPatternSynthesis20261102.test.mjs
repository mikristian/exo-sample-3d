import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {decodeVerifiedGarmentProject} from './exoDecodedGarmentProject20261102.js'
import {createDefaultProject} from '../data/defaultProject.js'
import {projectToDxf} from './dxf.js'
import {synthesizeExoPatternCandidate20261102 as synthesize} from './exoPatternSynthesis20261102.js'

const project=(lift=0)=>({id:'archive',name:'Shirt',units:'cm',pieces:['front','back'].map(id=>({id,points:[{id:'p0',x:0,y:0},{id:'p1',x:20+lift,y:0},{id:'p2',x:20+lift,y:30},{id:'p3',x:0,y:30}],curves:{2:{cx:10+lift*0.4,cy:32+lift*0.3}},edgeNames:['top','right','bottom','left']})),seams:[{id:'shoulder',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:0}}]})
const source=(id,p)=>({sourceId:id,sourceVerified:true,verification:{status:'pass',digest:id},project:p})

test('synthesizes curved new editable geometry; preserves source inputs and authored seams',()=>{
  const sources=[source('A',project()),source('B',project(3))],snapshot=structuredClone(sources)
  const result=synthesize(sources,{weight:0.5,learnedNeighborEvidence:[{sourceId:'B',score:0.93}]})
  assert.equal(result.ok,true,JSON.stringify(result.reason||result.qa?.issues))
  assert.deepEqual(sources,snapshot)
  assert.equal(result.project.patternGeneration.method,'learned_neighbor_conditioned_interpolation_v1')
  assert.equal(result.project.patternGeneration.trainedDecoderUsed,false)
  assert.equal(result.project.patternGeneration.candidateSourceVerified,false)
  assert.deepEqual(result.project.seams,sources[0].project.seams)
  assert.ok(result.project.pieces[0].points[1].x>20.02 && result.project.pieces[0].points[1].x<23)
  assert.ok(result.project.pieces[0].curves[2].cy>32)
  assert.equal(result.qa.status,'pass')
})

test('blocks unverified, identical, mismatched topology, unsupported curves, invalid interpolation and poor QA',()=>{
  const a=source('A',project()),b=source('B',project(3))
  assert.match(synthesize([a,{...b,sourceVerified:false}]).reason,/verification/)
  assert.match(synthesize([a,{...b,sourceId:'A'}]).reason,/Independent/)
  assert.match(synthesize([a,source('B',project())]).reason,/identity output/)
  assert.match(synthesize([a,b],{weight:0}).reason,/weight/)
  const broken=structuredClone(b);broken.project.seams[0].a.edgeIndex=1
  assert.match(synthesize([a,broken]).reason,/topology/)
  const cubic=structuredClone(b);cubic.project.pieces[0].curves[2]={cx:5,cy:33,cp2x:8}
  assert.match(synthesize([a,cubic]).reason,/Unsupported curve/)
  const qaFail=structuredClone(b);qaFail.project.seams[0].b.edgeIndex=1
  assert.equal(synthesize([a,qaFail]).ok,false)
})

test('maps independently assigned archive panel and seam IDs by semantic names and sewing endpoints',()=>{
  const a=source('A',project()),p=project(3)
  for(const piece of p.pieces) { const id=piece.id;piece.name=id;piece.id=`other-${id}`;piece.points.forEach((point,i)=>point.id=`other-${i}`) }
  p.seams[0].id='different-seam-id'
  p.seams[0].a.pieceId='other-front';p.seams[0].b.pieceId='other-back'
  const left=structuredClone(a)
  left.project.pieces.forEach(piece=>{piece.name=piece.id})
  const result=synthesize([left,source('B',p)])
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.project.seams[0].a.pieceId,'front')
  assert.equal(result.project.pieces[0].points[0].id,'p0')
})

test('real archive pair passes topology alignment, novel QA and editable DXF export',t=>{
  const sources=[]
  for(const id of ['rand_V7F8J43Q5G','rand_TZ17I25M8T']){
    const sourceId=`default/00/${id}`
    const read=spawnSync('python3',['integrations/clothcraft/pattern-source-geometry-20261102.py'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),input:JSON.stringify({sourceId}),encoding:'utf8',timeout:16000})
    assert.equal(read.status,0,read.stderr)
    const packet=JSON.parse(read.stdout)
    if(['archive_index_unavailable','source_specification_not_local','source_not_indexed'].includes(packet.error))return t.skip('Local verified archive corpus unavailable')
    assert.equal(packet.ok,true,packet.error)
    const decoded=decodeVerifiedGarmentProject(packet,createDefaultProject())
    assert.equal(decoded.ok,true,decoded.reason)
    sources.push({sourceId,sourceVerified:true,verification:{status:'pass',sha256:packet.source.sha256},project:decoded.project})
  }
  const original=structuredClone(sources)
  const result=synthesize(sources,{weight:0.5})
  assert.equal(result.ok,true,JSON.stringify(result.qa?.issues||result.reason))
  assert.equal(result.project.pieces.length,4)
  assert.equal(result.project.seams.length,14)
  assert.equal(result.qa.status,'pass')
  assert.ok(result.report.noveltyMaxDisplacementCmFromA>0.02)
  assert.ok(result.report.noveltyMaxDisplacementCmFromB>0.02)
  assert.ok(projectToDxf(result.project,'M').length>1000)
  assert.deepEqual(sources,original)
})

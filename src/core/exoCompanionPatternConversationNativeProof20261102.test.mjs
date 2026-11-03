import test from 'node:test'
import assert from 'node:assert/strict'
import {handleExoCompanionPatternTurn20261102 as turn,createExoCompanionPatternConversation20261102 as initial} from './exoCompanionPatternConversation20261102.js'
import {buildExoCompanionPatternPreview20261102 as preview} from './exoCompanionPatternPreview20261102.js'
import {prepareVerifiedNativeArchiveDraft,openVerifiedNativeArchiveDraft} from './exoNativeArchiveDraftImport20261102.js'

test('real character messages create a multi-turn revised pattern and a noncollapsing preview without native side effects',()=>{
  const creation=turn('Make an oversized hoodie',initial())
  assert.equal(creation.handled,true)
  assert.equal(creation.ok,true,creation.message)
  assert.equal(creation.kind,'draft')
  assert.equal(creation.context.revision,1)
  assert.equal(creation.proposal.project.patternGeneration.reviewRequired,true)
  const first=preview(creation.proposal.project)
  assert.equal(first.ok,true,first.reason)
  assert.equal(first.pieces.length,10)
  const second=turn('crop it 5 cm',creation.context,{expectedRevision:creation.context.revision,expectedProposalKey:creation.context.proposalKey})
  assert.equal(second.ok,true,second.message)
  assert.equal(second.kind,'revise')
  assert.equal(second.context.revision,2)
  assert.notEqual(second.context.proposalKey,creation.context.proposalKey)
  const current=preview(second.proposal.project)
  assert.equal(current.ok,true,current.reason)
  assert.notDeepEqual(second.proposal.project.pieces,creation.proposal.project.pieces)
  assert.equal(second.proposal.project.seams.length,creation.proposal.project.seams.length)
  assert.equal(prepareVerifiedNativeArchiveDraft(second.proposal.project).document.seams.length,second.proposal.project.seams.length)
  const display=turn('preview',second.context,{expectedRevision:2,expectedProposalKey:second.context.proposalKey})
  assert.equal(display.ok,true)
  assert.equal(display.kind,'preview')
  assert.equal(display.context.revision,2)
  assert.equal(display.proposal,second.context.proposal)
})

test('stale revision and proposal keys block edits, and undo restores previous geometry but invalidates newer keys',()=>{
  const a=turn('Make a crew neck T-shirt',initial())
  assert.equal(a.ok,true,a.message)
  const b=turn('make it oversized',a.context,{expectedRevision:a.context.revision,expectedProposalKey:a.context.proposalKey})
  assert.equal(b.ok,true,b.message)
  for(const options of [{expectedRevision:a.context.revision},{expectedProposalKey:a.context.proposalKey}]){
    const stale=turn('crop it 5 cm',b.context,options)
    assert.equal(stale.handled,true)
    assert.equal(stale.ok,false)
    assert.equal(stale.context,b.context)
  }
  const undone=turn('undo',b.context,{expectedRevision:b.context.revision,expectedProposalKey:b.context.proposalKey})
  assert.equal(undone.ok,true,undone.message)
  assert.equal(undone.kind,'undone')
  assert.equal(undone.context.revision,3)
  assert.notEqual(undone.context.proposalKey,a.context.proposalKey)
  assert.notEqual(undone.context.proposalKey,b.context.proposalKey)
  assert.deepEqual(undone.proposal.project.pieces,a.proposal.project.pieces)
  const ghost=turn('confirm pattern',undone.context,{expectedRevision:b.context.revision,expectedProposalKey:b.context.proposalKey})
  assert.equal(ghost.ok,false)
  assert.equal(ghost.context,undone.context)
  assert.equal(prepareVerifiedNativeArchiveDraft(undone.proposal.project).document.seams.length,undone.proposal.project.seams.length)
})

test('native handoff conversion, backup and open happen only after reviewed current proposal is explicitly selected',async()=>{
  const draft=turn('Create a zip-up hoodie',initial())
  assert.equal(draft.ok,true,draft.message)
  const revision=draft.context.revision,key=draft.context.proposalKey
  const confirmed=turn('confirm pattern',draft.context,{expectedRevision:revision,expectedProposalKey:key})
  assert.equal(confirmed.ok,true,confirmed.message)
  assert.equal(confirmed.kind,'ready_to_install')
  const old={name:'prior garment',state:{undo:['before']},avatar:{height:177}}
  const events=[]
  // Caller enforces a second install confirmation and freshness check before the native open.
  const install=async({approved,context,expectedRevision,expectedProposalKey})=>{
    if(!approved||context.revision!==expectedRevision||context.proposalKey!==expectedProposalKey)return {ok:false}
    return openVerifiedNativeArchiveDraft(context.proposal.project,{
      bridgeOrigin:'http://127.0.0.1:5193',
      bridgeFetch:async(_,opts)=>{
        events.push('convert')
        const prepared=JSON.parse(opts.body).document
        assert.equal(prepared.seams.length,draft.proposal.project.seams.length)
        return {ok:true,json:async()=>({ok:true,template:{panels:prepared.pieces.map(()=>({})),seams:prepared.seams.map(()=>({}))}})}
      },
      requestProject:async(action,value)=>{
        events.push(action)
        if(action==='capture')return {project:old}
        assert.equal(value.state,null)
        assert.deepEqual(value.avatar,old.avatar)
        return {ok:true}
      },
      persistBackup:async project=>{
        events.push('backup')
        assert.deepEqual(project,old)
        return {id:'durable-backup'}
      },
    })
  }
  assert.deepEqual(await install({approved:false,context:draft.context,expectedRevision:revision,expectedProposalKey:key}),{ok:false})
  assert.deepEqual(events,[])
  const revised=turn('make it relaxed',draft.context,{expectedRevision:revision,expectedProposalKey:key})
  assert.equal(revised.ok,true,revised.message)
  assert.deepEqual(await install({approved:true,context:revised.context,expectedRevision:revision,expectedProposalKey:key}),{ok:false})
  assert.deepEqual(events,[])
  const applied=await install({approved:true,context:draft.context,expectedRevision:revision,expectedProposalKey:key})
  assert.equal(applied.ok,true)
  assert.deepEqual(events,['convert','capture','backup','open'])
})

test('cancellation invalidates pending preview, confirmation and stale revision handles',()=>{
  const draft=turn('Create a crew neck T-shirt',initial())
  assert.equal(draft.ok,true,draft.message)
  const display=turn('preview',draft.context)
  assert.equal(display.ok,true)
  const cancelled=turn('cancel',display.context,{expectedRevision:draft.context.revision,expectedProposalKey:draft.context.proposalKey})
  assert.equal(cancelled.ok,true,cancelled.message)
  assert.equal(cancelled.kind,'cancelled')
  assert.equal(cancelled.context.proposal,null)
  assert.equal(cancelled.context.proposalKey,null)
  assert.equal(cancelled.context.revision,draft.context.revision+1)
  const confirm=turn('confirm pattern',cancelled.context)
  assert.equal(confirm.ok,false)
  const stale=turn('preview',cancelled.context,{expectedRevision:draft.context.revision,expectedProposalKey:draft.context.proposalKey})
  assert.equal(stale.ok,false)
  assert.equal(stale.context,cancelled.context)
})

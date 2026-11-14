/** Real compiled Rust: artwork edits share native garment/grade Undo/Redo and durable history. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {createAccuMarkNativeRuleSet} from '../../src/core/accumarkNativePointRuleSet20261023.js'
import {prepareNativeGradeCatalog20261025} from '../../src/core/nativeGradeCatalogBridge20261025.js'

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-artwork-history-'))
let workspace=createWorkspace(directory),revision=0
const request=async(op,fields={})=>{
 const reply=await workspace.request({op,revision,...fields})
 assert(reply.ok,`${op}: ${reply.error||'native Rust rejected request'}`)
 if(Number.isSafeInteger(reply.data?.revision))revision=reply.data.revision
 return reply.data
}
const save=async()=>(await request('save')).project
const grade=async()=>{
 const source=await request('open',{preset:'tshirt'})
 const rule=createAccuMarkNativeRuleSet(source,{sizes:['XS','S','M','L','XL','XXL'],baseSize:'M'})
 assert(rule.ok,rule.reason)
 const prepared=prepareNativeGradeCatalog20261025(source,await save(),rule.ruleSet)
 assert(prepared.ok,prepared.reason)
 await request('grade-run-commit',{gradeRun:prepared.gradeRun})
 return (await save()).grade_run
}
try{
 const catalog=await grade()
 const before=await save()
 const panel=before.template.panels[0].id
 const artwork={id:'run48-print',name:'Artwork history test',panel,
  dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XqkAAAAASUVORK5CYII=',
  width:1,height:1,widthMm:10,heightMm:10,positionMm:[20,30]}
 const failed=await workspace.request({op:'graphics-set',revision,printGraphics:[{...artwork,widthMm:-10}]})
 assert.equal(failed.ok,false,'Invalid physical print width was accepted')
 assert.deepEqual(await save(),before,'Invalid artwork modified the garment')
 const afterAdd=await request('graphics-set',{printGraphics:[artwork]})
 assert.equal(afterAdd.canUndo,true,'Artwork must be a real native history edit')
 const added=await save()
 assert.equal(added.printGraphics.length,1)
 assert.deepEqual(added.grade_run,catalog,'Artwork commit changed the six-size catalog')
 const afterNoop=await request('graphics-set',{printGraphics:added.printGraphics})
 assert.equal(afterNoop.revision,afterAdd.revision,'Identical artwork must not create a phantom history revision')
 await request('undo')
 const undone=await save()
 assert.equal(undone.printGraphics.length,0,'Undo did not remove the most recent artwork edit')
 assert.deepEqual(undone.grade_run,catalog,'Artwork Undo reverted older grading')
 await request('redo')
 assert.deepEqual((await save()).printGraphics,added.printGraphics,'Redo failed to restore artwork')
 assert.deepEqual((await save()).grade_run,catalog,'Artwork Redo changed grading')
 // Leave a real redo entry on disk and verify that it survives process restart.
 await request('undo')
 const journal=path.join(directory,'workspace','fitting-project.json.native.undo-v1.json')
 assert(fs.existsSync(journal),'Native durable history sidecar missing')
 workspace.close()
 workspace=createWorkspace(directory)
 revision=0
 await request('snapshot')
 const reopened=await save()
 assert.equal(reopened.printGraphics.length,0,'Reopen lost the undone artwork state')
 assert.deepEqual(reopened.grade_run,catalog,'Reopen changed graded geometry')
 await request('redo')
 assert.deepEqual((await save()).printGraphics,added.printGraphics,'Durable Redo lost artwork')
 await request('undo')
 assert.deepEqual((await save()).grade_run,catalog,'Durable Undo damaged graded source')
 // A removed print host must not persist as orphaned manufacturing artwork.
 // The same native history entry must restore both host geometry and artwork.
 await request('grade-run-clear')
 await request('graphics-set',{printGraphics:[artwork]})
 await request('edit',{command:{kind:'RemovePanel',panel}})
 const removed=await save()
 assert(!removed.template.panels.some(item=>item.id===panel),'Host panel was not removed')
 assert.equal(removed.printGraphics.length,0,'Deleted host left orphaned artwork')
 await request('undo')
 const restored=await save()
 assert(restored.template.panels.some(item=>item.id===panel),'Undo did not restore host panel')
 assert.equal(restored.printGraphics.length,1,'Undo did not restore hosted artwork')
 await request('redo')
 assert.equal((await save()).printGraphics.length,0,'Redo restored orphaned artwork')
 console.log(JSON.stringify({passed:true,compiledRust:true,gradedSizes:catalog.sizes.length,
  artworkUndoRedo:true,unchangedNoop:true,invalidRejected:true,durableRedo:true,
  hostDeletionAtomic:true,
  licensedReceivingCad:false,physicalCutterSignoff:false,installedAppRebuilt:false}))
}finally{
 workspace.close()
 fs.rmSync(directory,{recursive:true,force:true})
}

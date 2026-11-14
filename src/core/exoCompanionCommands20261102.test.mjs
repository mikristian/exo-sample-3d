import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyExoCompanionCommand as classify,executeExoCompanionWorkflowStep20261102 as execute } from './exoCompanionCommands20261102.js'

test('nest grading visibility commands explicitly set the requested state', () => {
  for (const phrase of ['please turn off nest grading lines', 'hide grading outlines', 'disable nested size lines', 'remove grade nest overlays']) {
    assert.deepEqual([classify(phrase).type, classify(phrase).value], ['gradingNest', false], phrase)
  }
  for (const phrase of ['turn on nest grading lines', 'show grading outlines', 'enable nest guides']) {
    assert.deepEqual([classify(phrase).type, classify(phrase).value], ['gradingNest', true], phrase)
  }
  assert.equal(classify('toggle grading nest lines').value, null)
})

test('recognizes actual workspace layout IDs without confusing models with layouts', () => {
  for (const [phrase, id] of [['switch to 2D workspace','2d'],['show me the 3D viewport','3d'],['open split screen','split'],['show 2D and 3D side by side','split'],['use stacked layout','stack']]) {
    assert.deepEqual([classify(phrase).type, classify(phrase).value, classify(phrase).tool], ['workspace', id, 'app.workspace.setLayout'])
  }
  assert.equal(classify('turn the 3D model').type, 'unknown')
})

test('settings/theme mapping selects installed theme IDs', () => {
  assert.deepEqual([classify('open settings').type, classify('open settings').tab], ['navigate','workspace'])
  assert.equal(classify('show me the theme settings').tab, 'theme')
  for (const [phrase, id] of [['change the theme to midnight blue','midnight'],['make the UI green','forest'],['switch theme to sapphire night','sapphire-night'],['use soft cream theme','cream-light'],['change theme color to violet','violet']]) {
    assert.deepEqual([classify(phrase).type, classify(phrase).value], ['theme',id], phrase)
  }
  assert.equal(classify('change the theme to ultraviolet').type, 'unknown')
  assert.deepEqual([classify('change the theme to another color').type,classify('change the theme to another color').tab],['navigate','theme'])
  for(const utterance of ['change my hoodie color to red','make the garment colors purple','change the avatar color to blue','turn the fabric pink']){
    assert.notEqual(classify(utterance).type,'theme',utterance)
  }
})

test('avatar, fabric, sewing hardware, techpack and guided assistant actions', () => {
  assert.deepEqual([classify('choose CLO Thomas avatar').value, classify('choose CLO Thomas avatar').operation], ['clo-thomas', 'setAvatarModel'])
  assert.equal(classify('select Nora avatar').value, 'nora')
  assert.equal(classify('open avatar settings').target, 'settings')
  assert.equal(classify('open the fabric library').type, 'fabric')
  assert.equal(classify('change fabric to denim').presetId, 'denim')
  assert.equal(classify('apply cotton jersey').presetId, 'jersey')
  assert.equal(classify('use silk').presetId, 'silk')
  assert.equal(classify('assign a fabric to this panel').requiresSelection, true)
  for (const [phrase, target] of [['add a zipper','Zipper'],['open buttons','Button'],['place a buttonhole','Buttonhole'],['show hardware','Trim']]) {
    assert.deepEqual([classify(phrase).type, classify(phrase).target], ['hardware', target], phrase)
  }
  assert.equal(classify('open tech pack workspace').target, 'techpack')
  assert.equal(classify('walk me through the app').type, 'tour')
  assert.equal(classify('celebrate!').type, 'celebrate')
  assert.equal(classify('stop').type, 'stop')
})

test('classifier is inert and rejects unrecognized or hostile input', () => {
  for (const text of ['', undefined, null, 42, 'delete my project', 'run shell command', 'hello', 'grading', 'I bought a blue fabric', '2D model of a zipper']) {
    assert.equal(classify(text).type, 'unknown', String(text))
  }
  assert.equal(classify('a'.repeat(1001)).type, 'unknown')
})
test('workflow executor delegates only supported operations and enforces confirmation',async()=>{
 const calls=[]
 const handlers={onCreateGarment:async id=>{calls.push(['create',id]);return {ok:true}},onCompanionAction:async action=>{calls.push(['editor',action]);return {ok:true}},onNavigate:async target=>{calls.push(['navigate',target]);return {ok:true}}}
 const create={action:{type:'createGarment'}}
 assert.equal((await execute(create,handlers,{templateId:'tee'})).needsConfirmation,true)
 assert.equal(calls.length,0)
 assert.equal((await execute(create,handlers,{templateId:'shirt',confirmed:true})).ok,false)
 assert.equal((await execute(create,handlers,{templateId:'tee',confirmed:true})).ok,true)
 assert.equal((await execute({action:{type:'gradingNest',value:true}},handlers)).ok,true)
 assert.equal((await execute({action:{type:'autoGrade',sizes:['XS','S','M','L','XL','XXL']}},handlers)).ok,true)
 assert.deepEqual(calls[2],['editor',{type:'autoGrade',sizes:['XS','S','M','L','XL','XXL']}])
 assert.equal((await execute({action:{type:'autoGrade',sizes:['XS','S']}},handlers)).ok,false)
 assert.equal((await execute({action:{type:'navigate',target:'grading'}},handlers)).ok,true)
 assert.equal((await execute({action:{type:'deleteProject'}},handlers)).ok,false)
 assert.equal(calls.length,4)
 assert.deepEqual(calls[3],['navigate','grading'])
})

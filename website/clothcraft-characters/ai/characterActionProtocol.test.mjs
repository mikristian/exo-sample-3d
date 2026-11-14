import test from 'node:test'
import assert from 'node:assert/strict'
import {planCharacterActions,CHARACTER_ACTION_SCHEMA} from './characterActionProtocol.mjs'

const snapshot=()=>({revision:7,emotion:'idle',config:{id:'custom',color:'#101010',eyeColor:'#ffffff',irisColor:'#aaaaaa',pupilColor:'#222222',shape:'display-tall',eyeScale:1,spacing:1,eyeMode:'matched',accessories:[],tattooLibrary:[{id:'svg-sigil',name:'Own sigil',viewBox:[0,0,100,100],children:[]}]}})
const catalog={eyeShapes:['display-tall','display-round'],accessoryTypes:['diamond','sigil','bolt']}
const proposal=actions=>({schema:CHARACTER_ACTION_SCHEMA,expectedRevision:7,actions})

test('valid edits produce atomic preview; original state unchanged',()=>{
  const state=snapshot()
  const result=planCharacterActions(proposal([
    {action:'set_eye_colors',eyeColor:'#bb00ff',irisColor:'#44ffee',pupilColor:'#ee99aa'},
    {action:'set_eye_shape',shape:'display-round'},
    {action:'add_accessory',type:'diamond',x:300,y:125},
    {action:'add_saved_svg',assetId:'svg-sigil',x:452,y:412},
    {action:'set_expression',expression:'happy'},
  ]),state,catalog)
  assert.equal(result.ok,true)
  assert.equal(result.requiresConfirmation,true)
  assert.equal(result.preview.config.shape,'display-round')
  assert.equal(result.preview.config.accessories.length,2)
  assert.equal(result.preview.emotion,'happy')
  assert.equal(state.config.accessories.length,0)
  assert.equal(state.config.shape,'display-tall')
})

test('rejects stale revisions and unknown operations',()=>{
  assert.equal(planCharacterActions({...proposal([{action:'set_body_color',color:'#ffffff'}]),expectedRevision:6},snapshot(),catalog).code,'STALE_REVISION')
  assert.equal(planCharacterActions(proposal([{action:'execute_code',code:'fetch("https://evil.invalid")'}]),snapshot(),catalog).code,'UNSUPPORTED_ACTION')
  assert.equal(planCharacterActions(proposal([{action:'set_body_color',color:'#fff',url:'https://evil.invalid'}]),snapshot(),catalog).code,'UNSUPPORTED_ACTION')
})

test('one invalid action rejects entire proposal without partial edits',()=>{
  const state=snapshot()
  const result=planCharacterActions(proposal([{action:'set_body_color',color:'#ffaabb'},{action:'add_accessory',type:'invented',x:300,y:300}]),state,catalog)
  assert.equal(result.ok,false)
  assert.equal(result.index,1)
  assert.equal(state.config.color,'#101010')
})

test('refuses unapproved SVGs or unknown existing items',()=>{
  assert.equal(planCharacterActions(proposal([{action:'add_saved_svg',assetId:'svg-not-in-library',x:300,y:300}]),snapshot(),catalog).code,'UNKNOWN_SVG')
  assert.equal(planCharacterActions(proposal([{action:'move_accessory',id:'unknown',x:300,y:300}]),snapshot(),catalog).code,'UNKNOWN_DETAIL')
  assert.equal(planCharacterActions(proposal([{action:'set_eye_shape',shape:'model-hallucination'}]),snapshot(),catalog).code,'UNKNOWN_SHAPE')
})

test('validates bounds and enforces detail count',()=>{
  assert.equal(planCharacterActions(proposal([{action:'set_eye_geometry',eyeScale:9,spacing:1}]),snapshot(),catalog).code,'INVALID_GEOMETRY')
  const state=snapshot()
  state.config.accessories=Array.from({length:16},(_,i)=>({id:'existing-'+i,type:'sigil',x:300,y:300}))
  assert.equal(planCharacterActions(proposal([{action:'add_accessory',type:'diamond',x:300,y:300}]),state,catalog).code,'DETAIL_LIMIT')
})

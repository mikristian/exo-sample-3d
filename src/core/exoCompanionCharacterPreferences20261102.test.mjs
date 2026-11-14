import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXO_COMPANION_CHARACTER_DEFAULTS_20261102 as defaults,
  EXO_COMPANION_CHARACTER_PREFERENCES_STORAGE_KEY_20261102 as key,
  EXO_COMPANION_CHARACTER_EYE_SHAPE_OPTIONS_20261102 as shapes,
  normalizeExoCompanionCharacterPreferences20261102 as normalize,
  parseExoCompanionCharacterPreferences20261102 as parse,
  readExoCompanionCharacterPreferences20261102 as read,
  saveExoCompanionCharacterPreferences20261102 as save,
  toExoCompanionCircleEyesSettings20261102 as toRenderer,
  addExoCompanionSvgArtwork20261102 as addSvg,
  removeExoCompanionSvgArtwork20261102 as removeSvg,
} from './exoCompanionCharacterPreferences20261102.js'

test('defaults and supported choices map to CircleEyes',()=>{
  assert.deepEqual(normalize(),defaults)
  assert(shapes.some(({value})=>value==='display-tall'))
  assert.equal(toRenderer(defaults).shape,'display-tall')
  assert.equal(toRenderer(defaults).eyeMode,'independent')
})

test('accepts genuine user edits and known renderer shape aliases',()=>{
  const changed=normalize({enabled:false,movement:'steady',showTitle:false,color:'#Ab12CD',eyeColor:'#123456',irisColor:'#123456',leftIrisColor:'#abcdef',rightIrisColor:'#fedcba',eyeShape:'wide',eyeMode:'matched',iris:'diamond',pupilVisible:true,pupilColor:'#abcdef',glint:true,glintColor:'#999999'})
  assert.equal(changed.enabled,false)
  assert.equal(changed.movement,'steady')
  assert.equal(changed.showTitle,false)
  assert.equal(changed.color,'#ab12cd')
  assert.equal(changed.eyeShape,'round-wide')
  assert.equal(changed.glint,true)
  assert.equal(toRenderer(changed).shape,'round-wide')
})

test('invalid values cannot corrupt preferences, prototype or renderer settings',()=>{
  const raw=JSON.parse('{"enabled":"false","movement":"fly","eyeColor":"red","iris":"unsupported","eyeShape":"<svg/>","pupilVisible":1,"__proto__":{"polluted":true},"unknown":"ignored"}')
  const output=normalize(raw)
  assert.deepEqual(output,defaults)
  assert.equal(Object.hasOwn(output,'unknown'),false)
  assert.equal({}.polluted,undefined)
  assert.deepEqual(parse('{not JSON'),defaults)
  assert.deepEqual(parse(JSON.stringify(4)),defaults)
  assert.deepEqual(parse('x'.repeat(16385)),defaults)
})

test('storage round trip and blocked storage access are safe',()=>{
  const entries=new Map()
  const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}
  const result=save({movement:'steady',enabled:false,eyeShape:'heart-classic'},storage)
  assert.equal(entries.has(key),true)
  assert.deepEqual(read(storage),result)
  assert.deepEqual(read({getItem(){throw Error('denied')}}),defaults)
  assert.deepEqual(save({enabled:false},{setItem(){throw Error('denied')}}),{...defaults,enabled:false})
})

test('movement choices persist and accessory presets render supported glyphs',()=>{
  for(const movement of ['steady','roam','gentle','energetic','pointer-follow'])assert.equal(normalize({movement}).movement,movement)
  for(const accessory of ['sigil','bolt','butterfly','star','diamond','opal','crystal','trinity']){
    const result=toRenderer({accessory})
    assert.equal(result.accessories.length,1)
    assert.equal(result.accessories[0].type,accessory)
    assert(Number.isFinite(result.accessories[0].x))
  }
  assert.deepEqual(toRenderer({accessory:'untrusted'}).accessories,[])
})

test('independent gemstone and tattoo settings appear together and invalid entries are rejected',()=>{
  const value=normalize({gem:'ruby',tattoo:'lightning',movement:'follow'})
  assert.equal(value.movement,'pointer-follow')
  assert.deepEqual(toRenderer(value).accessories.map(item=>item.type),['diamond','bolt'])
  assert.deepEqual(toRenderer({gem:'sapphire',tattoo:'crescent'}).accessories.map(item=>item.type),['diamond','crescent'])
  assert.deepEqual(toRenderer({gem:'inject',tattoo:'inject'}).accessories,[])
})

const safeAsset={name:'New tattoo.svg',viewBox:[0,0,100,100],children:[{tag:'path',attrs:{d:'M0 0 L100 100',fill:'#abc'},children:[]}]}
test('sanitized uploaded vector round trips, selects and deletes each placement',()=>{
  const tattoo=addSvg(defaults,safeAsset,'tattoo')
  const gem=addSvg(tattoo,safeAsset,'gem')
  assert.equal(gem.tattooLibrary.length,2)
  assert.notEqual(gem.tattooAssetId,gem.gemAssetId)
  assert.equal(toRenderer(gem).accessories.filter(v=>v.type==='user-svg').length,2)
  assert.equal(toRenderer(gem).tattooLibrary[0].category,'tattoo')
  assert.deepEqual(parse(JSON.stringify(gem)),gem)
  const removed=removeSvg(gem,gem.tattooAssetId)
  assert.equal(removed.tattooAssetId,null)
  assert.equal(removed.tattooLibrary.length,1)
  assert.equal(toRenderer(removed).accessories.filter(v=>v.type==='user-svg').length,1)
})
test('malicious vectors are rejected before storage and when reading persisted data',()=>{
  const attacks=[
    {tag:'script',attrs:{},children:[]},
    {tag:'foreignObject',attrs:{},children:[]},
    {tag:'image',attrs:{href:'https://host/image'},children:[]},
    {tag:'path',attrs:{d:'M0 0',onload:'alert(1)'},children:[]},
    {tag:'path',attrs:{d:'M0 0',fill:'url(https://evil)'},children:[]},
    {tag:'use',attrs:{href:'javascript:alert(1)'},children:[]},
    {tag:'path',attrs:{style:'background:url(https://evil)',d:'M0 0'},children:[]},
    {tag:'path',attrs:{d:'M0 0',fill:'red;filter:url(#x)'},children:[]},
  ]
  for(const tree of attacks){
    assert.throws(()=>addSvg(defaults,{...safeAsset,children:[tree]}))
    const serialized=JSON.stringify({...defaults,tattooLibrary:[{...safeAsset,id:'svg-danger',category:'tattoo',children:[tree]}],tattooAssetId:'svg-danger'})
    assert.deepEqual(parse(serialized).tattooLibrary,[])
    assert.equal(parse(serialized).tattooAssetId,null)
  }
  assert.throws(()=>addSvg(defaults,{...safeAsset,markup:'<svg/>'}))
  assert.throws(()=>addSvg(defaults,safeAsset,'unknown'))
})
test('oversized, deep, duplicate, and excessive artwork stays bounded',()=>{
  let nested={tag:'path',attrs:{d:'M0 0'},children:[]}
  for(let i=0;i<26;i++)nested={tag:'g',attrs:{},children:[nested]}
  assert.throws(()=>addSvg(defaults,{...safeAsset,children:[nested]}))
  assert.throws(()=>addSvg(defaults,{...safeAsset,name:'x'.repeat(50),children:[{tag:'path',attrs:{d:'M'.repeat(200000)},children:[]}]}))
  let settings=defaults
  for(let i=0;i<12;i++)settings=addSvg(settings,safeAsset,'tattoo')
  assert.equal(settings.tattooLibrary.length,12)
  assert.throws(()=>addSvg(settings,safeAsset))
  const duplicates=normalize({...defaults,tattooLibrary:[settings.tattooLibrary[0],settings.tattooLibrary[0]]})
  assert.equal(duplicates.tattooLibrary.length,1)
})

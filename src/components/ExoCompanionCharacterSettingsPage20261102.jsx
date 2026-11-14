import React,{useEffect,useRef,useState} from 'react'
import CircleEyes from '../../website/clothcraft-characters/components/CircleEyes.jsx'
import {sanitizeSvgTattoo,SVG_FILE_LIMIT,SVG_LIBRARY_LIMIT,UploadedSvgArtwork} from '../../website/clothcraft-characters/components/svgTattooImport.jsx'
import {
 EXO_COMPANION_CHARACTER_DEFAULTS_20261102 as DEFAULTS,
 EXO_COMPANION_CHARACTER_EYE_SHAPE_OPTIONS_20261102 as SHAPES,
 EXO_COMPANION_CHARACTER_IRIS_OPTIONS_20261102 as IRISES,
 normalizeExoCompanionCharacterPreferences20261102 as normalize,
 addExoCompanionSvgArtwork20261102 as addArtwork,
 removeExoCompanionSvgArtwork20261102 as deleteArtwork,
 readExoCompanionCharacterPreferences20261102 as read,
 saveExoCompanionCharacterPreferences20261102 as save,
 toExoCompanionCircleEyesSettings20261102 as toEyes,
} from '../core/exoCompanionCharacterPreferences20261102.js'
import './ExoCompanionCharacterSettingsPage20261102.css'

const storage=()=>typeof window==='undefined'?null:window.localStorage
const colors=['#111317','#243041','#a8775e','#eac9a7','#f3d6dc','#624ead','#45b8c7','#c9cccf','#ffffff','#000000','#d9ed74','#6c4ddc','#20bacc','#fd8ea4','#ffb747','#30d158','#7c98ff','#f84e75']
const colorFields=[['color','Face / body'],['eyeColor','Eye color'],['irisColor','Iris color'],['leftIrisColor','Left iris'],['rightIrisColor','Right iris'],['pupilColor','Pupil color'],['glintColor','Eye glint']]
const motions=[{value:'roam',label:'Explore',detail:'Move around the workspace',glyph:'↝'},{value:'steady',label:'Stay still',detail:'Rest in one position',glyph:'◎'},{value:'gentle',label:'Gentle',detail:'Slow, relaxed movement',glyph:'〜'},{value:'energetic',label:'Lively',detail:'Playful frequent motion',glyph:'✧'},{value:'pointer-follow',label:'Follow',detail:'Respond to your pointer',glyph:'⌁'}]
const gems=[{value:'none',label:'None',glyph:'○'},{value:'ruby',label:'Ruby',glyph:'◆'},{value:'sapphire',label:'Sapphire',glyph:'◆'},{value:'emerald',label:'Emerald',glyph:'◆'},{value:'amethyst',label:'Amethyst',glyph:'◆'}]
const tattoos=[{value:'none',label:'None',glyph:'○'},{value:'star',label:'Star',glyph:'★'},{value:'crescent',label:'Moon',glyph:'☾'},{value:'lightning',label:'Bolt',glyph:'ϟ'}]

function ArtworkThumbnail({asset}){
 return <svg viewBox="-38 -38 76 76" aria-hidden="true" className="exo-character-artwork-thumbnail"><g><UploadedSvgArtwork asset={asset} instanceId={`thumbnail-${asset.id}`}/></g></svg>
}

function ChoiceGrid({label,options,value,onPreview,onClear,onSelect,render}){
 return <div className="exo-character-choice-grid" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" className={`exo-character-choice ${value===option.value?'is-selected':''}`} aria-pressed={value===option.value} onMouseEnter={()=>onPreview(option.value)} onMouseLeave={onClear} onFocus={()=>onPreview(option.value)} onBlur={onClear} onClick={()=>onSelect(option.value)}><span className="exo-character-choice-art" aria-hidden="true">{render?render(option):option.glyph||'◉'}</span><strong>{option.label}</strong>{option.detail&&<small>{option.detail}</small>}</button>)}</div>
}

export default function ExoCompanionCharacterSettingsPage20261102(){
 const [settings,setSettings]=useState(()=>read(storage()))
 const [preview,setPreview]=useState(null)
 const [voices,setVoices]=useState([])
 const [voice,setVoice]=useState(()=>{try{return localStorage.getItem('exo-ai-voice')||'auto'}catch{return 'auto'}})
 const [voicePreview,setVoicePreview]=useState(null)
 const [speechStatus,setSpeechStatus]=useState('')
 const [artworkKind,setArtworkKind]=useState('tattoo')
 const [artworkError,setArtworkError]=useState('')
 const uploadRef=useRef(null)
 const shown=preview||settings
 const publish=detail=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('exo-companion-character-preferences-preview',{detail}))}
 const clear=()=>{setPreview(null);publish(null)}
 const hover=(key,value)=>{const next=normalize({...settings,[key]:value});setPreview(next);publish(next)}
 const persist=next=>{clear();const saved=save(next,storage());setSettings(saved);window.dispatchEvent(new CustomEvent('exo-companion-character-preferences-updated',{detail:saved}))}
 const update=(key,value)=>persist({...settings,[key]:value})
 const artworkLibrary=Array.isArray(settings.tattooLibrary)?settings.tattooLibrary:[]
 const artworkChoice=(kind,id)=>{
  const key=kind==='gem'?'gemAssetId':'tattooAssetId'
  const next={...settings,[key]:id}
  if(id){next[kind]='none'}
  persist(next)
 }
 const previewArtwork=(kind,id)=>{
  const key=kind==='gem'?'gemAssetId':'tattooAssetId'
  hover(key,id)
 }
 const uploadArtwork=async event=>{
  const input=event.currentTarget
  const file=input.files?.[0]
  input.value=''
  if(!file)return
  setArtworkError('')
  if(file.type&&file.type!=='image/svg+xml'&&!file.name.toLowerCase().endsWith('.svg')){setArtworkError('Choose an SVG file (.svg).');return}
  if(!/\.svg$/i.test(file.name)){setArtworkError('Choose an SVG file (.svg).');return}
  if(file.size>SVG_FILE_LIMIT){setArtworkError('SVG files must be 160 KB or smaller.');return}
  if(artworkLibrary.length>=SVG_LIBRARY_LIMIT){setArtworkError(`You can store up to ${SVG_LIBRARY_LIMIT} designs. Remove one to add another.`);return}
  try{
   const asset=sanitizeSvgTattoo(await file.text(),file.name)
   const next={...addArtwork(settings,asset,artworkKind),[artworkKind]:'none'}
   persist(next)
   setArtworkError('')
  }catch(error){setArtworkError(error instanceof Error?error.message:'Could not import this SVG artwork.')}
 }
 const removeArtwork=id=>{
  const next=deleteArtwork(settings,id)
  if(next.tattooAssetId===id)next.tattooAssetId=null
  if(next.gemAssetId===id)next.gemAssetId=null
  persist(next)
  setArtworkError('')
 }
 useEffect(()=>{
  const sync=event=>{setSettings(normalize(event.detail??read(storage())));setPreview(null)}
  const storageSync=event=>{if(event.key==='exo-companion-character-preferences-20261102')setSettings(read(storage()));if(event.key==='exo-ai-voice')setVoice(event.newValue||'auto')}
  window.addEventListener('exo-companion-character-preferences-updated',sync)
  window.addEventListener('storage',storageSync)
  return()=>{window.removeEventListener('exo-companion-character-preferences-updated',sync);window.removeEventListener('storage',storageSync);publish(null)}
 },[])
 useEffect(()=>{if(!('speechSynthesis'in window))return;const synth=window.speechSynthesis;const refresh=()=>setVoices(synth.getVoices().filter(v=>/^en[-_]/i.test(v.lang)));refresh();synth.addEventListener?.('voiceschanged',refresh);return()=>{synth.removeEventListener?.('voiceschanged',refresh)}},[])
 const voiceOptions=[{value:'auto',label:'Best available',detail:'Automatically choose a voice',glyph:'♫'},...voices.map(v=>({value:v.voiceURI,label:v.name,detail:v.lang,glyph:'◉'}))]
 const chooseVoice=value=>{setVoice(value);try{localStorage.setItem('exo-ai-voice',value)}catch{}window.dispatchEvent(new CustomEvent('exo-companion-voice-updated',{detail:{choice:value}}))}
 const testVoice=()=>{if(!('speechSynthesis'in window)){setSpeechStatus('Voice playback is unavailable in this browser.');return}const synthesis=window.speechSynthesis;synthesis.cancel();const utterance=new SpeechSynthesisUtterance('Hi, I am EXO. Ready when you are.');const selected=voices.find(v=>v.voiceURI===(voicePreview||voice));if(selected)utterance.voice=selected;utterance.onstart=()=>setSpeechStatus(`Playing ${selected?.name||'default voice'}…`);utterance.onend=()=>setSpeechStatus('Voice preview finished.');utterance.onerror=()=>setSpeechStatus('Voice preview could not play.');synthesis.speak(utterance)}
 const grid=(label,key,options,render)=> <ChoiceGrid label={label} options={options} value={settings[key]} onPreview={value=>hover(key,value)} onClear={clear} onSelect={value=>update(key,value)} render={render}/>
 return <section className="exo-character-page" aria-label="Character settings" data-testid="exo-character-settings-page">
  <header className="exo-character-page-heading"><div><h3>Character</h3><p>Make your EXO companion your own. Hover to try an option; select it to save.</p></div><span className="exo-character-page-tag">PERSONALIZE</span></header>
  <div className="exo-character-page-hero"><div className="exo-character-page-preview" aria-label="Live character appearance preview"><CircleEyes settings={toEyes(shown)} compact motion={false}/></div><div className="exo-character-page-preview-label"><strong>{preview?'Previewing appearance':'Your companion'}</strong><span>{settings.enabled?'Visible':'Hidden'} · {settings.movement==='steady'?'Still':'Active'}</span><small>Changes save automatically</small></div></div>
  <div className="studio-settings-group"><h4>Visibility & behavior</h4>
   <label className="exo-character-page-row"><span><strong>Show character</strong><small>Hide the entire companion when switched off.</small></span><input className="exo-character-apple-switch" type="checkbox" role="switch" aria-label="Character on or off" checked={settings.enabled} onChange={e=>update('enabled',e.target.checked)}/></label>
   <label className="exo-character-page-row"><span><strong>Show title</strong><small>Display the companion title bubble.</small></span><input className="exo-character-apple-switch" type="checkbox" role="switch" aria-label="Show character title" checked={settings.showTitle} onChange={e=>update('showTitle',e.target.checked)}/></label>
   <div className="exo-character-page-subhead"><strong>Movement</strong><small>Choose how your companion behaves.</small></div>{grid('Character movement','movement',motions)}
  </div>
  <div className="studio-settings-group"><h4>Eyes & face</h4>
   <div className="exo-character-page-subhead"><strong>Eye shape</strong><small>Hover a shape to see it on your character.</small></div>{grid('Eye shape','eyeShape',SHAPES,option=><span className={`exo-eye-symbol ${option.value}`}>● ●</span>)}
   <div className="exo-character-page-subhead"><strong>Iris shape</strong></div>{grid('Iris shape','iris',IRISES,option=><span className="exo-iris-symbol">{({none:'○',round:'●',diamond:'◆',slit:'┃',square:'■'})[option.value]}</span>)}
   <div className="exo-character-page-subhead"><strong>Eyes</strong></div>{grid('Eye color mode','eyeMode',[{value:'matched',label:'Matching',glyph:'● ●'},{value:'independent',label:'Independent',glyph:'● ◉'}])}
   <div className="exo-character-page-colors">{colorFields.filter(([key])=>settings.eyeMode==='independent'||!['leftIrisColor','rightIrisColor'].includes(key)).map(([key,label])=><div className="exo-character-palette" key={key}><div className="exo-character-page-subhead"><strong>{label}</strong><span>{settings[key]}</span></div><div className="exo-character-swatches" role="group" aria-label={`${label} palette`}>{colors.map(c=><button key={c} type="button" title={`${label} ${c}`} aria-label={`${label} ${c}`} aria-pressed={settings[key]===c} className={`exo-character-swatch ${settings[key]===c?'is-selected':''}`} style={{'--swatch':c}} onMouseEnter={()=>hover(key,c)} onMouseLeave={clear} onFocus={()=>hover(key,c)} onBlur={clear} onClick={()=>update(key,c)}/>) }<label className="exo-character-custom-color" title={`Custom ${label}`}><span>+</span><input aria-label={`Custom ${label} color`} type="color" value={settings[key]} onChange={e=>update(key,e.target.value)}/></label></div></div>)}</div>
   <label className="exo-character-page-row"><span><strong>Show pupils</strong></span><input className="exo-character-apple-switch" type="checkbox" role="switch" checked={settings.pupilVisible} onChange={e=>update('pupilVisible',e.target.checked)}/></label>
   <label className="exo-character-page-row"><span><strong>Eye highlights</strong></span><input className="exo-character-apple-switch" type="checkbox" role="switch" checked={settings.glint} onChange={e=>update('glint',e.target.checked)}/></label>
  </div>
  <div className="studio-settings-group"><h4>Details & accessories</h4><div className="exo-character-page-subhead"><strong>Gemstone</strong><small>Add an accent to the character.</small></div>{grid('Gemstones','gem',gems,option=><span style={{color:({ruby:'#f26479',sapphire:'#80aaff',emerald:'#54cb91',amethyst:'#ad91fb'})[option.value]||'inherit'}}>{option.glyph}</span>)}<div className="exo-character-page-subhead"><strong>Tattoo motif</strong></div>{grid('Tattoo motif','tattoo',tattoos)}
   <div className="exo-character-page-subhead"><strong>Your SVG artwork</strong><small>{artworkLibrary.length} of {SVG_LIBRARY_LIMIT} designs</small></div>
   <p className="exo-character-page-hint">Import your own vector art. Hover over a design to see it on EXO, then select it to apply as a tattoo or gemstone.</p>
   <div className="exo-character-artwork-upload"><div className="exo-character-artwork-kinds" role="group" aria-label="Artwork placement">{[{value:'tattoo',label:'Tattoo'},{value:'gem',label:'Gemstone'}].map(item=><button key={item.value} type="button" className={artworkKind===item.value?'is-selected':''} aria-pressed={artworkKind===item.value} onClick={()=>setArtworkKind(item.value)}>{item.label}</button>)}</div><button type="button" className="exo-character-artwork-upload-button" onClick={()=>uploadRef.current?.click()} disabled={artworkLibrary.length>=SVG_LIBRARY_LIMIT}>+ Import SVG</button><input ref={uploadRef} type="file" accept=".svg,image/svg+xml" aria-label="Import SVG artwork" onChange={uploadArtwork}/></div>
   <p className="exo-character-artwork-file-note">SVG only · 160 KB maximum · Paths and basic shapes supported</p>
   {artworkError&&<p className="exo-character-artwork-error" role="alert">{artworkError}</p>}
   {artworkLibrary.length>0?<div className="exo-character-artwork-grid" aria-label="Imported SVG artwork">{artworkLibrary.map(asset=>{const category=asset.category==='gem'?'gem':'tattoo';const chosen=settings[category==='gem'?'gemAssetId':'tattooAssetId']===asset.id;return <div className={`exo-character-artwork-card ${chosen?'is-selected':''}`} key={asset.id}><button type="button" className="exo-character-artwork-choice" aria-label={`Apply ${asset.name} as ${category}`} aria-pressed={chosen} onMouseEnter={()=>previewArtwork(category,asset.id)} onMouseLeave={clear} onFocus={()=>previewArtwork(category,asset.id)} onBlur={clear} onClick={()=>artworkChoice(category,chosen?null:asset.id)}><ArtworkThumbnail asset={asset}/><strong title={asset.name}>{asset.name}</strong><small>{category==='gem'?'Gemstone':'Tattoo'} · {chosen?'Applied':'Select to apply'}</small></button><button type="button" className="exo-character-artwork-delete" aria-label={`Remove ${asset.name}`} title={`Remove ${asset.name}`} onClick={()=>removeArtwork(asset.id)}>×</button></div>})}</div>:<p className="exo-character-artwork-empty">Your imported designs will appear here.</p>}
  </div>
  <div className="studio-settings-group"><h4>Voice</h4><p className="exo-character-page-hint">Available voices from this browser. Hover to inspect, select to save, then press Test voice to hear it.</p><div className="exo-character-voice-scroll"><ChoiceGrid label="Voice options" options={voiceOptions} value={voice} onPreview={setVoicePreview} onClear={()=>setVoicePreview(null)} onSelect={chooseVoice}/></div><div className="exo-character-voice-actions"><button type="button" onClick={testVoice}>▶ Test voice</button><span role="status">{speechStatus||`${voices.length} browser voices available`}</span></div></div>
  <div className="exo-character-page-reset"><button type="button" onClick={()=>persist({...DEFAULTS})}>Reset character to defaults</button></div>
 </section>
}

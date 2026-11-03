import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {
  ArrowDownRight, ArrowUpRight, Check, ChevronRight, CircleHelp,
  Eye, EyeClosed, Heart, MousePointer2, MoveUpRight, Palette,
  Pause, Play, RotateCcw, ScanEye, SlidersHorizontal, Smile,
  Sparkles, Volume2, WandSparkles, Waves, Zap, Mic, MicOff, AudioLines, Upload,
} from 'lucide-react'
import {
  CLOTHCRAFT_CHARACTERS,
  CLOTHCRAFT_CHARACTER_COLORS,
  DEFAULT_CLOTHCRAFT_CHARACTER,
  normalizeClothCraftCharacter,
} from './components/characterData.js'
import ClothCraftAlien3D from './components/ClothCraftAlien3D.jsx'
import useBlobAudio from './useBlobAudio.js'
import './site.css'

const STORAGE_KEY='clothcraft-character-atelier-preview-v1'
const INTRO={
  stitch:{description:'The original studio alien: focused, curious, quietly iconic.',detail:'Otherworldly form. Made for making.',number:'01'},
  patch:{description:'Our fabric-obsessed explorer with a striking wide cranium.',detail:'A different perspective on every material.',number:'02'},
  bobbin:{description:'A precision-minded alien with a bolder, broader silhouette.',detail:'Precision from another planet.',number:'03'},
  forma:{description:'The elegant, elongated extraterrestrial of the family.',detail:'An eye for every silhouette.',number:'04'},
}

const ACTIONS=[
  {id:'blinking',label:'Blink',icon:EyeClosed,caption:'Quick double blink',duration:550},
  {id:'waving',label:'Wave',icon:Waves,caption:'A friendly hello',duration:1450},
  {id:'bouncing',label:'Jump',icon:Zap,caption:'Tiny happy leap',duration:1350},
  {id:'speaking',label:'Talk',icon:Volume2,caption:'Audio-reactive speaking preview',duration:3900},
  {id:'dancing',label:'Dance',icon:Sparkles,caption:'Little victory dance',duration:2800},
]

function initialConfig() {
  try {return normalizeClothCraftCharacter(JSON.parse(localStorage.getItem(STORAGE_KEY)))}
  catch {return {...DEFAULT_CLOTHCRAFT_CHARACTER}}
}

function BrandMark(){return <svg viewBox="0 0 43 43" width="35" height="35" fill="none" aria-hidden="true"><rect x="1" y="1" width="41" height="41" rx="12" stroke="#8296b3" strokeOpacity=".35"/><path d="M10 13h23M10 21.5h23M10 30h23" stroke="#c7dbf4" strokeWidth="2.1" strokeLinecap="round"/><path d="M14 10c-5 6-5 17 0 23M29 10c5 6 5 17 0 23" stroke="#8ebdf3" strokeWidth="2.4" strokeLinecap="round"/><circle cx="21.5" cy="21.5" r="4.5" fill="#b8d9ff"/></svg>}

function App(){
  const [config,setConfig]=useState(initialConfig)
  const [emotion,setEmotion]=useState('happy')
  const [mood,setMood]=useState('idle')
  const [focusEyes,setFocusEyes]=useState(false)
  const [look,setLook]=useState({x:0,y:0})
  const [tracking,setTracking]=useState(true)
  const [sensitivity,setSensitivity]=useState(1.2)
  const [lastAction,setLastAction]=useState('Idle animation')
  const timeout=useRef(null)
  const gazeIdle=useRef(null)
  const stageRef=useRef(null)
  const audioFileInput=useRef(null)
  const audio=useBlobAudio()
  const speaking=audio.mode!=='idle'
  const visualMood=speaking?'speaking':mood
  const character=CLOTHCRAFT_CHARACTERS.find(item=>item.id===config.character)
  const colors=CLOTHCRAFT_CHARACTER_COLORS.find(item=>item.id===config.color)
  const displayName=config.nickname.trim()||character.name
  const reducedMotion=typeof window!=='undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(config))}catch {/* private mode */}},[config])
  useEffect(()=>()=>{clearTimeout(timeout.current);clearInterval(gazeIdle.current)},[])
  useEffect(()=>{
    clearInterval(gazeIdle.current)
    if(!tracking || !config.motion || reducedMotion){setLook({x:0,y:0});return}
    gazeIdle.current=setInterval(()=>{
      if(stageRef.current?.matches(':hover'))return
      setLook({x:Math.sin(Date.now()/1800)*2.5,y:Math.cos(Date.now()/2300)*1.4})
    },2300)
    return ()=>clearInterval(gazeIdle.current)
  },[tracking,config.motion,reducedMotion])

  const update=(key,value)=>setConfig(previous=>normalizeClothCraftCharacter({...previous,[key]:value}))
  const selectCharacter=id=>{
    if(id===config.character)return
    update('character',id);setEmotion('happy');setMood('idle');setLastAction(`Meet ${CLOTHCRAFT_CHARACTERS.find(c=>c.id===id).name}`)
    setLook({x:0,y:0});clearTimeout(timeout.current)
  }
  const enact=(id)=>{
    if(id==='speaking'){
      clearTimeout(timeout.current)
      setMood('idle')
      setLastAction('Generated voice tones · live waveform')
      void audio.playDemo()
      return
    }
    audio.stop()
    clearTimeout(timeout.current)
    const action=ACTIONS.find(item=>item.id===id)
    setMood('idle')
    // Reset the animation key by clearing state for a frame before retriggering.
    requestAnimationFrame(()=>{
      setMood(id)
      setLastAction(action?.caption||'Motion preview')
      timeout.current=setTimeout(()=>{setMood('idle');setLastAction('Idle animation')},action?.duration||1100)
    })
  }
  const handleGaze=event=>{
    if(!tracking || reducedMotion)return
    const target=stageRef.current?.querySelector('.cc-character-avatar')
    if(!target)return
    const r=target.getBoundingClientRect()
    const dx=(event.clientX-(r.left+r.width*.5))/(r.width*.5)
    const dy=(event.clientY-(r.top+r.height*.44))/(r.height*.5)
    setLook({x:Math.max(-4.5,Math.min(4.5,dx*3.7)),y:Math.max(-3.2,Math.min(3.2,dy*2.5))})
  }
  const reset=()=>{audio.stop();clearTimeout(timeout.current);setConfig({...DEFAULT_CLOTHCRAFT_CHARACTER});setEmotion('happy');setMood('idle');setTracking(true);setLook({x:0,y:0});setLastAction('Reset to defaults');setSensitivity(1.2)}
  const setExpression=value=>{
    setEmotion(value)
    setLastAction(value==='happy'?'Feeling happy':value==='surprised'?'A little surprised':value==='sleepy'?'Time for a nap':'Bursting with excitement')
  }

  return <div className="atelier-app" style={{'--character-accent':colors.base,'--character-light':colors.light,'--character-shadow':colors.shadow,'--character-glow':colors.glow}}>
    <header className="site-header">
      <div className="brand"><BrandMark/><div className="brand-wordmark"><strong>clothcraft<span className="brand-dot">.</span></strong><small>CHARACTER ATELIER</small></div></div>
      <div className="header-middle"><span className="header-circle"/> YOUR LOCAL CREATIVE PLAYGROUND <span className="header-mini-rule"/> V 0.1</div>
      <div className="header-actions"><a href="./circle.html" className="eye-lab-entry"><ScanEye size={16}/> CIRCLE EYE LAB <ArrowUpRight size={14}/></a><span className="standalone-pill"><span/> STANDALONE PREVIEW</span><button className="header-reset" type="button" onClick={reset} aria-label="Reset all character customizations" title="Reset all"><RotateCcw size={15}/></button></div>
    </header>

    <div className="page-container">
      <div className="page-intro"><div className="intro-overline"><span className="intro-line"/> CLOTHCRAFT CREATURE LAB <span className="intro-counter">001—004</span></div>
        <div className="intro-content"><h1>A new kind of<br/><em>life form.</em></h1><p>Meet four living 3D alien companions. Sculpted faces, expressive glass-black eyes, a little smile, and natural movement that responds to you and your sound.</p></div>
      </div>

      <main className="atelier-layout" aria-label="ClothCraft interactive character playground">
        <aside className="cast-panel panel-card">
          <div className="panel-kicker">01 / THE COMPANIONS</div>
          <div className="panel-heading"><h2>Choose your character</h2><span>4 ORIGINALS</span></div>
          <div className="character-list" role="group" aria-label="Choose a ClothCraft character">
            {CLOTHCRAFT_CHARACTERS.map((item,index)=><button key={item.id} type="button" className={`character-card ${config.character===item.id?'is-selected':''}`} onClick={()=>selectCharacter(item.id)} aria-pressed={config.character===item.id}>
              <div className="character-thumbnail"><ClothCraftAlien3D config={{...config,character:item.id,color:['blue','mint','gold','lilac'][index]}} compact/></div>
              <div className="character-card-text"><span>0{index+1} <span className="character-card-asterisk">✳</span></span><strong>{item.name}</strong><small>{item.specialty}</small></div>
              <span className="character-card-arrow">{config.character===item.id?<Check size={15}/>:<ChevronRight size={16}/>}</span>
            </button>)}
          </div>
          <div className="cast-panel-foot"><span className="dotted-star">✳</span><p>Four original alien forms. One unmistakable expression: those eyes.</p></div>
        </aside>

        <section className="demo-column" aria-label="Interactive animated character preview">
          <div className={`showcase-stage ${focusEyes?'is-eye-focus':''}`} ref={stageRef} onPointerMove={handleGaze} onPointerLeave={()=>{if(tracking)setLook({x:0,y:0})}}>
            <div className="showcase-grid" aria-hidden="true"/>
            <div className="showcase-orbit showcase-orbit-one" aria-hidden="true"/>
            <div className="showcase-orbit showcase-orbit-two" aria-hidden="true"/>
            <div className="showcase-top"><span className="showcase-live"><span className="live-pulse"/> ALIEN / 01</span><div className="showcase-top-right"><span className="showcase-state">{speaking?'AUDIO / REACTIVE':mood==='idle'?'IDLE / BREATHING':mood.toUpperCase()}</span><button className={`eye-focus-toggle ${focusEyes?'is-active':''}`} type="button" onClick={()=>setFocusEyes(previous=>!previous)} aria-pressed={focusEyes} aria-label="Toggle eye close-up"><ScanEye size={15}/>{focusEyes?'FULL FORM':'EYE CLOSE-UP'}</button></div></div>
            <div className="showcase-ambient ambient-a" aria-hidden="true"/><div className="showcase-ambient ambient-b" aria-hidden="true"/>
            <div className="showcase-mascot-wrap"><ClothCraftAlien3D config={config} look={look} mood={visualMood} emotion={emotion} audioLevelRef={audio.levelRef} audioBandsRef={audio.bandsRef} intensity={sensitivity}/></div>
            {speaking&&<div className="blob-stage-meter" aria-label={`Audio level ${audio.meter} percent`}><AudioLines size={14}/><div className="blob-stage-meter-track"><span style={{width:`${audio.meter}%`}}/></div><span>{String(audio.meter).padStart(2,'0')}%</span></div>}
            <div className="stage-interaction-hint"><MousePointer2 size={13}/><span>DRAG TO ROTATE 3D · DOUBLE-CLICK TO RESET</span></div>
            <div className="showcase-bottom"><div><span>MEET</span><h2>{displayName}</h2><p>{INTRO[character.id].detail}</p></div><div className="character-stage-tag"><span>CC—0{CLOTHCRAFT_CHARACTERS.findIndex(c=>c.id===character.id)+1}</span><span>ORIGINAL</span></div></div>
          </div>

          <section className="motion-panel panel-card" aria-label="Animation controls">
            <div className="motion-heading"><div><div className="panel-kicker">02 / THE ANIMATIONS</div><h2>Make {displayName} move<span className="motion-asterisk">✳</span></h2></div><span className="motion-status"><span/> {speaking?'Reacting to sound':lastAction}</span></div>
            <div className="action-buttons">{ACTIONS.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-label={`${item.label} animation`} aria-pressed={visualMood===item.id} className={`motion-action ${visualMood===item.id?'is-playing':''}`} onClick={()=>enact(item.id)}><Icon size={20} strokeWidth={1.8}/><span>{item.label}</span><i/></button>})}</div>
            <div className="motion-foot"><span><ScanEye size={15}/> {tracking?'EYE TRACKING ACTIVE':'EYE TRACKING PAUSED'}</span><span>{config.motion?'IDLE LOOP: ON':'IDLE LOOP: OFF'} <span className="foot-separator">·</span> TRUE 3D / WEBGL</span></div>
          </section>
          <section className="blob-audio-panel panel-card" aria-label="Audio-reactive body controls">
            <div className="blob-audio-head"><div><div className="panel-kicker">03 / SOUND TO SHAPE</div><h2>Let the form speak.</h2><p>Real audio makes the sculpted 3D head breathe, float and respond in real time.</p></div><span className={`blob-audio-indicator ${speaking?'on':''}`}><span/>{speaking?audio.mode.toUpperCase():'READY'}</span></div>
            <div className="blob-audio-actions">
              <button type="button" className={`blob-audio-demo ${audio.mode==='demo'?'active':''}`} onClick={()=>audio.mode==='demo'?audio.stop():enact('speaking')}><AudioLines size={17}/>{audio.mode==='demo'?'Stop demo':'Hear voice demo'}</button>
              <button type="button" className={`blob-audio-secondary ${audio.mode==='microphone'?'active':''}`} onClick={()=>audio.mode==='microphone'?audio.stop():void audio.startMicrophone()}><Mic size={16}/>{audio.mode==='microphone'?'Stop microphone':'Use microphone'}</button>
              <button type="button" className={`blob-audio-secondary ${audio.mode==='file'?'active':''}`} onClick={()=>audio.mode==='file'?audio.stop():audioFileInput.current?.click()}><Upload size={16}/>{audio.mode==='file'?'Stop file':'Try an audio file'}</button>
              <input ref={audioFileInput} hidden type="file" accept="audio/*" aria-label="Choose local audio file" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void audio.playFile(file)}}/>
            </div>
            <div className="blob-audio-footer"><label htmlFor="blob-audio-sensitivity">BODY RESPONSE <strong>{Math.round(sensitivity*100)}%</strong></label><input id="blob-audio-sensitivity" type="range" min=".5" max="2.4" step=".1" value={sensitivity} onChange={event=>setSensitivity(Number(event.target.value))}/><span>Quiet sound = soft breathing. Louder sound = stronger squish and ripple.</span></div>
            {audio.mode==='microphone'&&<p className="blob-audio-notice"><Mic size={13}/> Microphone is active locally. It is not uploaded or played through speakers.</p>}
            {audio.mode==='file'&&<p className="blob-audio-notice"><AudioLines size={13}/> Playing locally: {audio.fileName}</p>}
            {audio.mode==='demo'&&<p className="blob-audio-notice"><Volume2 size={13}/> Demo plays original robot-like voice tones, not generated speech.</p>}
            {audio.error&&<p className="blob-audio-error" role="alert">{audio.error}</p>}
          </section>
        </section>

        <aside className="customize-panel panel-card" aria-label="Customize selected character">
          <div className="panel-kicker">04 / MAKE IT YOURS</div>
          <div className="customize-heading"><div><h2>Personalize</h2><p>Every detail is yours to change.</p></div><SlidersHorizontal size={19}/></div>
          <div className="settings-section"><label className="settings-label" htmlFor="character-nickname">CHARACTER NAME <span>01</span></label><input type="text" id="character-nickname" maxLength={18} placeholder={character.name} value={config.nickname} onChange={event=>update('nickname',event.target.value)}/></div>
          <div className="settings-section"><div className="settings-label">COLORWAY <span>02</span></div><div className="swatch-list" role="group" aria-label="Character colorway">{CLOTHCRAFT_CHARACTER_COLORS.map(color=><button key={color.id} className={`color-swatch ${config.color===color.id?'is-selected':''}`} style={{'--swatch-color':color.base}} onClick={()=>update('color',color.id)} type="button" title={color.label} aria-label={color.label} aria-pressed={config.color===color.id}><span/>{config.color===color.id&&<Check size={15}/>}</button>)}</div><div className="selected-color-name"><Palette size={12}/>{colors.label}</div></div>
          <div className="settings-section"><div className="settings-label">EXPRESSIONS <span>03</span></div><div className="expression-picks" role="group" aria-label="Character emotion">{[
            {id:'happy',label:'Happy',face:'☺'},{id:'excited',label:'Excited',face:'✦'},{id:'surprised',label:'Surprised',face:'○'},{id:'sleepy',label:'Sleepy',face:'◡'},
          ].map(item=><button type="button" key={item.id} className={emotion===item.id?'is-selected':''} aria-pressed={emotion===item.id} onClick={()=>setExpression(item.id)}><span>{item.face}</span>{item.label}</button>)}</div></div>
          <div className="settings-section"><label className="settings-label" htmlFor="character-eyes">EYE SHAPE <span>04</span></label><div className="select-wrap"><Eye size={15}/><select id="character-eyes" value={config.eyes} onChange={event=>update('eyes',event.target.value)}><option value="bright">Iconic almond</option><option value="focused">Sharp almond</option><option value="sleepy">Relaxed almond</option></select></div></div>
          <div className="settings-section"><div className="settings-label">EYE SIZE <span>05</span></div><div className="expression-picks eye-size-picks" role="group" aria-label="Eye size">{[
            {id:'expressive',label:'Immersive'},{id:'balanced',label:'Balanced'},{id:'minimal',label:'Subtle'},
          ].map(item=><button type="button" key={item.id} className={config.eyeSize===item.id?'is-selected':''} aria-pressed={config.eyeSize===item.id} onClick={()=>update('eyeSize',item.id)}>{item.label}</button>)}</div></div>
          <div className="settings-section"><div className="settings-label">EYE FINISH <span>06</span></div><div className="eye-light-picks" role="group" aria-label="Eye finish">{[
            {id:'lime',label:'Obsidian',color:'#090f13'}, {id:'ice',label:'Midnight',color:'#10212d'},
            {id:'orchid',label:'Deep plum',color:'#211827'}, {id:'amber',label:'Umber',color:'#261e19'},
          ].map(item=><button key={item.id} type="button" aria-label={item.label} title={item.label} aria-pressed={config.eyeColor===item.id} className={config.eyeColor===item.id?'is-selected':''} style={{'--eye-light':item.color}} onClick={()=>update('eyeColor',item.id)}><span/>{config.eyeColor===item.id&&<Check size={14}/>}</button>)}</div></div>
          <div className="toggles"><label className="toggle-row"><span><Eye size={17}/><span><strong>Follow my cursor</strong><small>3D face turns toward your pointer</small></span></span><input type="checkbox" aria-label="Follow my cursor" checked={tracking} onChange={event=>setTracking(event.target.checked)}/><i/></label>
          <label className="toggle-row"><span><Waves size={17}/><span><strong>Idle animations</strong><small>Subtle movement and natural blinks</small></span></span><input type="checkbox" aria-label="Idle animations" checked={config.motion} onChange={event=>update('motion',event.target.checked)}/><i/></label></div>
          <div className="customize-footer"><button type="button" onClick={reset}><RotateCcw size={14}/> Reset design</button><span><Check size={13}/> Auto-saved locally</span></div>
        </aside>
      </main>

      <div className="atelier-bottom"><div><span className="bottom-symbol">✳</span><strong>Alive in three dimensions.</strong><span>Original procedural 3D alien sculptures, deep glossy eyes, and real audio-driven movement.</span></div><span>CHARACTER ATELIER / INDEPENDENT EXPERIMENT</span></div>
      <footer className="site-footer"><span>© ClothCraft Character Atelier</span><span>LOCAL PROTOTYPE <span>·</span> NOT YET CONNECTED TO CLOTHCRAFT STUDIO</span></footer>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)

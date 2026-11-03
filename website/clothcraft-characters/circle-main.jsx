import React,{useEffect,useRef,useState,useCallback} from 'react'
import {createRoot} from 'react-dom/client'
import {ArrowUpRight,Check,ChevronLeft,Download,Eye,EyeClosed,Focus,MoveUpRight,Play,RotateCcw,Shuffle,SlidersHorizontal,Sparkles,Trash2,Copy,FlipHorizontal,Palette,Shapes,Diamond,UserCircle2,ChevronsUpDown,Upload,FileCode2} from 'lucide-react'
import CircleEyes from './components/CircleEyes.jsx'
import {AccessoryGlyph} from './components/CharacterAccessories.jsx'
import {sanitizeSvgTattoo,UploadedSvgArtwork,SVG_FILE_LIMIT,SVG_LIBRARY_LIMIT} from './components/svgTattooImport.jsx'
import {ACCESSORY_COLLECTION,ACCESSORY_CATEGORIES,ACCESSORY_COLORS,ACCESSORY_MAX,ACCESSORY_LOOKS,createAccessory} from './components/characterAccessories.js'
import {useClothCraftTheme,ThemePicker} from './components/clothcraftTheme.jsx'
import {CIRCLE_PRESETS,COLOR_SWATCHES,EYE_COLOR_SWATCHES,PUPIL_SWATCHES,EYE_COLORWAYS,EYE_SHAPES,EYE_CATEGORIES,IRIS_SHAPES,EMOTIONS,normaliseCircle,clamp} from './components/circleEyeData.js'
import './circle.css'
import './clothcraft-ui.css'

const KEY='exo-circle-eye-lab-display-v4'
let accessorySerial=0
function readSaved(){try{const saved=JSON.parse(localStorage.getItem(KEY));return saved?normaliseCircle(saved):normaliseCircle(CIRCLE_PRESETS[0])}catch{return normaliseCircle(CIRCLE_PRESETS[0])}}
function store(config){try{localStorage.setItem(KEY,JSON.stringify(config))}catch{/* no storage */}}
function useCircleEditor(){
  const [config,setConfig]=useState(readSaved)
  const [emotion,setEmotion]=useState('idle')
  const [look,setLook]=useState({x:0,y:0})
  const [tracking,setTracking]=useState(true)
  const [animated,setAnimated]=useState(true)
  const [background,setBackground]=useState('light')
  const [selectedAccessoryId,setSelectedAccessoryId]=useState(null)
  const blinkTimer=useRef(null)
  useEffect(()=>store(config),[config])
  useEffect(()=>()=>clearTimeout(blinkTimer.current),[])
  const edit=(key,value)=>setConfig(old=>normaliseCircle(key==='eyeMode'&&value==='independent'?{
    ...old,id:'custom',eyeMode:'independent',
    leftEyeColor:old.eyeColor,rightEyeColor:old.eyeColor,
    leftIrisColor:old.irisColor,rightIrisColor:old.irisColor,
    leftPupilColor:old.pupilColor,rightPupilColor:old.pupilColor,
  }:{...old,[key]:value,id:'custom'}))
  const preset=next=>{setConfig(old=>normaliseCircle({...next,accessories:old.accessories,tattooLibrary:old.tattooLibrary}));setEmotion('idle');setLook({x:0,y:0})}
  const colorway=palette=>setConfig(old=>normaliseCircle({...old,id:'custom',eyeMode:palette.irisRight?'independent':'matched',eyeColor:palette.eye,leftEyeColor:palette.eye,rightEyeColor:palette.eye,irisColor:palette.iris,leftIrisColor:palette.iris,rightIrisColor:palette.irisRight||palette.iris,pupilColor:palette.pupil,glintColor:palette.glint,iris:old.iris==='none'?'slit':old.iris,glint:false,pupilVisible:false}))
  const play=name=>{clearTimeout(blinkTimer.current);setEmotion(name);if(name==='blink'){blinkTimer.current=setTimeout(()=>setEmotion('idle'),460)}}
  const reset=()=>{setConfig(old=>normaliseCircle({...CIRCLE_PRESETS[0],tattooLibrary:old.tattooLibrary}));setEmotion('idle');setLook({x:0,y:0});setSelectedAccessoryId(null);setTracking(true);setAnimated(true);setBackground('light')}
  const shuffle=()=>{
    const pick=a=>a[Math.floor(Math.random()*a.length)]
    const base=pick(CIRCLE_PRESETS)
    const palette=pick(EYE_COLORWAYS)
    setConfig(old=>normaliseCircle({...base,id:'custom',color:pick(COLOR_SWATCHES),eyeColor:palette.eye,irisColor:palette.iris,pupilColor:palette.pupil,glintColor:palette.glint,eyeMode:'matched',iris:pick(['round','slit']),pupilVisible:false,glint:false,accessories:old.accessories,tattooLibrary:old.tattooLibrary,
      eyeScale:.72+Math.random()*.49,spacing:.8+Math.random()*.45,
      shape:pick(EYE_SHAPES).id}))
    setEmotion('idle')
  }
  const addAccessory=type=>{
    if(config.accessories.length>=ACCESSORY_MAX)return
    const id=`exo-ac-${Date.now()}-${++accessorySerial}`
    const item=createAccessory(type,id)
    if(!item)return
    setConfig(old=>normaliseCircle({...old,id:'custom',accessories:[...old.accessories,item]}))
    setSelectedAccessoryId(id)
  }
  const updateAccessory=(id,change)=>setConfig(old=>normaliseCircle({...old,id:'custom',accessories:old.accessories.map(a=>a.id===id?{...a,...change}:a)}))
  const moveAccessory=(id,x,y)=>updateAccessory(id,{x,y})
  const removeAccessory=id=>{setConfig(old=>normaliseCircle({...old,id:'custom',accessories:old.accessories.filter(a=>a.id!==id)}));setSelectedAccessoryId(null)}
  const clearAccessories=()=>{setConfig(old=>normaliseCircle({...old,id:'custom',accessories:[]}));setSelectedAccessoryId(null)}
  const duplicateAccessory=id=>{
    const item=config.accessories.find(a=>a.id===id)
    if(!item||config.accessories.length>=ACCESSORY_MAX)return
    const nextId=`exo-ac-${Date.now()}-${++accessorySerial}`
    setConfig(old=>normaliseCircle({...old,id:'custom',accessories:[...old.accessories,{...item,id:nextId,x:Math.min(515,item.x+20),y:Math.min(515,item.y+20)}]}))
    setSelectedAccessoryId(nextId)
  }
  const applyAccessoryLook=look=>{
    const accessories=look.items.map(piece=>({...createAccessory(piece.type,`exo-ac-${Date.now()}-${++accessorySerial}`),...piece}))
    setConfig(old=>normaliseCircle({...old,id:'custom',accessories}))
    setSelectedAccessoryId(null)
  }
  const uploadSvgTattoo=asset=>{
    if(config.tattooLibrary.length>=SVG_LIBRARY_LIMIT)throw new Error('Your SVG library is full (12 designs). Delete one before uploading another.')
    if(config.accessories.length>=ACCESSORY_MAX)throw new Error('Your character already has 16 details. Remove one to place this tattoo.')
    const total=JSON.stringify([...config.tattooLibrary,asset]).length
    if(total>700000)throw new Error('Your SVG library is full. Try a smaller SVG or remove an older design.')
    const assetId=`svg-${Date.now()}-${++accessorySerial}`
    const placedId=`exo-ac-${Date.now()}-${++accessorySerial}`
    setConfig(old=>normaliseCircle({...old,id:'custom',tattooLibrary:[...old.tattooLibrary,{...asset,id:assetId}],accessories:[...old.accessories,{type:'user-svg',assetId,id:placedId,x:300,y:432,scale:1,rotation:0,color:'#f2f2f2',secondary:'#9a9a9a',tint:false,flip:false}]}))
    setSelectedAccessoryId(placedId)
    return assetId
  }
  const addUploadedTattoo=assetId=>{
    if(config.accessories.length>=ACCESSORY_MAX||!config.tattooLibrary.some(a=>a.id===assetId))return
    const placedId=`exo-ac-${Date.now()}-${++accessorySerial}`
    setConfig(old=>normaliseCircle({...old,id:'custom',accessories:[...old.accessories,{type:'user-svg',assetId,id:placedId,x:300,y:432,scale:1,rotation:0,color:'#f2f2f2',secondary:'#9a9a9a',tint:false,flip:false}]}))
    setSelectedAccessoryId(placedId)
  }
  const removeUploadedTattoo=assetId=>{
    setConfig(old=>normaliseCircle({...old,id:'custom',tattooLibrary:old.tattooLibrary.filter(a=>a.id!==assetId),accessories:old.accessories.filter(a=>a.assetId!==assetId)}))
    setSelectedAccessoryId(null)
  }
  return {config,edit,colorway,emotion,look,setLook,tracking,setTracking,animated,setAnimated,background,setBackground,preset,play,reset,shuffle,selectedAccessoryId,setSelectedAccessoryId,addAccessory,updateAccessory,moveAccessory,removeAccessory,clearAccessories,duplicateAccessory,applyAccessoryLook,uploadSvgTattoo,addUploadedTattoo,removeUploadedTattoo}
}

function Range({title,value,min,max,step=.01,onChange,suffix='',format}){
  const shown=format?format(value):`${Math.round(value*100)}${suffix}`
  const percentage=100*(value-min)/(max-min)
  return <label className="circle-range"><span><strong>{title}</strong><output>{shown}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} style={{'--fill':`${percentage}%`}} onChange={e=>onChange(Number(e.target.value))}/>
  </label>
}

function Swatches({title,options,value,onChange}){
  return <div className="eye-control-block"><div className="eye-section-label">{title}</div><div className="eye-swatches">{options.map(color=><button type="button" key={color} style={{'--color':color}} title={color} aria-label={`${title} ${color}`} aria-pressed={value===color} className={`eye-swatch ${value===color?'selected':''}`} onClick={()=>onChange(color)}><span/>{value===color&&<Check size={13}/>}</button>)}<label className="eye-custom-color" title={`Custom ${title.toLowerCase()}`} aria-label={`Pick custom ${title.toLowerCase()}`}><input type="color" value={value} onChange={e=>onChange(e.target.value)}/><span>+</span></label></div></div>
}

function SelectTiles({title,options,value,onChange}){
  return <div className="eye-control-block"><div className="eye-section-label">{title}</div><div className="eye-tile-grid">{options.map(option=><button type="button" key={option.id} className={`eye-tile ${option.id===value?'selected':''}`} aria-pressed={option.id===value} onClick={()=>onChange(option.id)}>{option.name}</button>)}</div></div>
}

function EyeLibrary({value,onChange,colors}){
  const [category,setCategory]=useState('All')
  const [search,setSearch]=useState('')
  const visible=EYE_SHAPES.filter(eye=>(category==='All'||eye.category===category)&&`${eye.name} ${eye.category}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="eye-control-block eye-library" aria-label="Eye shape library">
    <div className="eye-library-heading"><div className="eye-section-label">EYE SHAPES <span>{EYE_SHAPES.length} DESIGNS</span></div><small>Click any eyes to preview them instantly.</small></div>
    <input type="search" aria-label="Search eye shapes" placeholder={`Search ${EYE_SHAPES.length} eye designs...`} value={search} onChange={ev=>setSearch(ev.target.value)} className="eye-library-search" />
    <div className="eye-library-filters" role="group" aria-label="Eye shape categories">{EYE_CATEGORIES.map(item=><button type="button" key={item} className={category===item?'selected':''} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    <div className="eye-library-count">SHOWING {visible.length} / {EYE_SHAPES.length}</div>
    <div className="eye-library-grid" role="group" aria-label="Choose an eye design">
      {visible.map((eye,index)=><button type="button" className={`eye-library-item ${eye.id===value?'is-selected':''}`} key={eye.id}
        aria-label={`Eye design ${eye.name}`} aria-pressed={eye.id===value} title={eye.name} onClick={()=>onChange(eye.id)}>
        <svg viewBox="0 0 120 78" aria-hidden="true" className="eye-library-icon">
          <circle cx="60" cy="39" r="37" fill={colors.color}/>
          {[-1,1].map(sign=><g key={sign} transform={`translate(${60+sign*15.5} 37) rotate(${eye.tilt*sign}) scale(${eye.scaleX*.33} ${eye.scaleY*.33})`}>
            <path d={eye.path} fill={colors.eyeColor}/><ellipse cx={-sign*13} rx="7" ry="23" fill={colors.eyeMode==='independent'?(sign<0?colors.leftIrisColor:colors.rightIrisColor):colors.irisColor}/>
          </g>)}
        </svg>
        <span>{eye.name}</span>
      </button>)}
    </div>
    {visible.length===0&&<p className="eye-library-empty">No matching eyes. Try another name or category.</p>}
  </section>
}

function EyeColorways({selected,onSelect}){
  const [expanded,setExpanded]=useState(false)
  const visible=expanded?EYE_COLORWAYS:EYE_COLORWAYS.slice(0,16)
  return <div className="eye-control-block eye-colorways" aria-label="Eye colorway library">
    <div className="eye-section-label">EYE COLORWAYS <span>{EYE_COLORWAYS.length} SETS</span></div>
    <div className={`eye-colorways-grid ${expanded?'is-expanded':''}`}>{visible.map(item=><button key={item.id} type="button" aria-label={`Apply ${item.name} eye colorway`} title={`${item.name}: outer eye and colored inset`} aria-pressed={selected.eyeColor===item.eye&&selected.irisColor===item.iris&&(selected.eyeMode==='matched'||selected.rightIrisColor===(item.irisRight||item.iris))} className={`eye-colorway ${selected.eyeColor===item.eye&&selected.irisColor===item.iris?'is-active':''}`} onClick={()=>onSelect(item)}>
      <span className="eye-colorway-dots"><i style={{background:item.eye}}><b style={{background:item.iris}}/></i><i style={{background:item.eye}}><b style={{background:item.irisRight||item.iris}}/></i></span><span>{item.name}</span>
    </button>)}</div>
    <button className="eye-colorways-more" type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?'Show featured colorways':`View all ${EYE_COLORWAYS.length} colorways`}</button>
  </div>
}

function EyeColorsEditor({settings,edit}){
  const independent=settings.eyeMode==='independent'
  return <>
    <div className="eye-control-block"><div className="eye-section-label">EYE COLOR CONTROL</div><div className="eye-mode-tabs" role="group" aria-label="Eye color link mode"><button type="button" className={!independent?'is-selected':''} onClick={()=>edit('eyeMode','matched')} aria-pressed={!independent}>Both eyes</button><button type="button" className={independent?'is-selected':''} onClick={()=>edit('eyeMode','independent')} aria-pressed={independent}>Left / right separately</button></div></div>
    {independent?<div className="eye-split-controls">
      <div className="eye-split-label">LEFT EYE</div>
      <Swatches title="Left outer eye" options={EYE_COLOR_SWATCHES} value={settings.leftEyeColor} onChange={v=>edit('leftEyeColor',v)}/>
      <Swatches title="Left iris" options={PUPIL_SWATCHES} value={settings.leftIrisColor} onChange={v=>edit('leftIrisColor',v)}/>
      <Swatches title="Left pupil" options={PUPIL_SWATCHES} value={settings.leftPupilColor} onChange={v=>edit('leftPupilColor',v)}/>
      <div className="eye-split-label">RIGHT EYE</div>
      <Swatches title="Right outer eye" options={EYE_COLOR_SWATCHES} value={settings.rightEyeColor} onChange={v=>edit('rightEyeColor',v)}/>
      <Swatches title="Right iris" options={PUPIL_SWATCHES} value={settings.rightIrisColor} onChange={v=>edit('rightIrisColor',v)}/>
      <Swatches title="Right pupil" options={PUPIL_SWATCHES} value={settings.rightPupilColor} onChange={v=>edit('rightPupilColor',v)}/>
    </div>:<>
      <Swatches title="OUTER EYE COLOR" options={EYE_COLOR_SWATCHES} value={settings.eyeColor} onChange={v=>edit('eyeColor',v)}/>
      <Swatches title="IRIS COLOR" options={PUPIL_SWATCHES} value={settings.irisColor} onChange={v=>edit('irisColor',v)}/>
      <Swatches title="PUPIL COLOR" options={PUPIL_SWATCHES} value={settings.pupilColor} onChange={v=>edit('pupilColor',v)}/>
    </>}
    <SelectTiles title="IRIS SHAPE" options={IRIS_SHAPES} value={settings.iris} onChange={v=>edit('iris',v)}/>
    {settings.iris!=='none'&&<div className="eye-sliders"><Range title="Colored inset size" value={settings.irisScale} min={.35} max={1.5} onChange={v=>edit('irisScale',v)} format={v=>`${Math.round(v*100)}%`}/><Range title="Inset toward center" value={settings.irisOffset} min={0} max={1} onChange={v=>edit('irisOffset',v)} format={v=>`${Math.round(v*100)}%`}/>{settings.pupilVisible&&<Range title="Extra pupil size" value={settings.pupilScale} min={.2} max={1.5} onChange={v=>edit('pupilScale',v)} format={v=>`${Math.round(v*100)}%`}/>}</div>}
    <label className="eye-glint-toggle"><input type="checkbox" checked={settings.pupilVisible} onChange={ev=>edit('pupilVisible',ev.target.checked)}/><span>Optional third-color pupil</span></label>
    <label className="eye-glint-toggle"><input type="checkbox" checked={settings.glint} onChange={ev=>edit('glint',ev.target.checked)}/><span>Optional highlight (off by default)</span></label>
  </>
}

function AccessoryStudio({editor}){
  const [category,setCategory]=useState('Tattoo')
  const [uploadMessage,setUploadMessage]=useState('')
  const [uploadError,setUploadError]=useState(false)
  const tattooFile=useRef(null)
  const decorations=editor.config.accessories
  const selected=decorations.find(item=>item.id===editor.selectedAccessoryId)||null
  const selectedType=selected&&(ACCESSORY_COLLECTION.find(item=>item.id===selected.type)||editor.config.tattooLibrary.find(asset=>asset.id===selected.assetId))
  const edit=(field,value)=>selected&&editor.updateAccessory(selected.id,{[field]:value})
  const categories=[{name:'Tattoo',label:'Tattoos'},{name:'Gem',label:'Gemstones'},{name:'Piercing',label:'Piercings'}]
  const handleSvgUpload=async event=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    setCategory('Tattoo')
    setUploadError(false)
    try{
      if(!/\.svg$/i.test(file.name))throw new Error('Select an .svg vector file.')
      if(file.size>SVG_FILE_LIMIT)throw new Error('SVG exceeds the 160 KB file limit. Simplify the artwork before importing.')
      const asset=sanitizeSvgTattoo(await file.text(),file.name)
      editor.uploadSvgTattoo(asset)
      setUploadMessage(`Added "${asset.name}" to the character and tattoo library.`)
    }catch(error){setUploadError(true);setUploadMessage(error.message||'Unable to import this SVG.')}
  }
  return <div className="cc-accessory-studio" aria-label="2D character details editor">
    <div className="cc-accessory-intro"><strong>STYLE YOUR CHARACTER</strong><p>Flat vector tattoos, jewels and piercings. Add up to {ACCESSORY_MAX} pieces, then drag them on the character.</p></div>
    <div className="cc-quick-looks" aria-label="Ready-made 2D styles"><div className="cc-decoration-head"><strong>QUICK LOOKS</strong><span>REPLACES CURRENT DETAILS</span></div><div className="cc-quick-looks-grid">{ACCESSORY_LOOKS.map(look=><button type="button" key={look.id} aria-label={`Apply ${look.name} look`} onClick={()=>editor.applyAccessoryLook(look)}><span className="cc-quick-look-avatar"><CircleEyes settings={{...editor.config,accessories:look.items.map((item,i)=>({...createAccessory(item.type,`look-${i}`),...item}))}} compact motion={false}/></span><span><strong>{look.name}</strong><small>{look.description}</small></span></button>)}</div></div>
    <div className="cc-accessory-categories" role="group" aria-label="Accessory categories">{categories.map(c=><button type="button" key={c.name} onClick={()=>setCategory(c.name)} aria-pressed={category===c.name} className={category===c.name?'active':''}>{c.label}</button>)}</div>
    {category==='Tattoo'&&<section className="cc-svg-import" aria-label="Import custom SVG tattoos">
      <input ref={tattooFile} type="file" accept=".svg,image/svg+xml" aria-label="Choose SVG tattoo file" onChange={handleSvgUpload} className="cc-svg-file-input"/>
      <button type="button" className="cc-svg-upload-button" onClick={()=>tattooFile.current?.click()}><Upload size={17}/><span><strong>Upload your own SVG</strong><small>Illustrator / SVG vector artwork · max 160 KB</small></span><span className="cc-svg-upload-plus">+</span></button>
      <p className="cc-svg-import-explainer">Uploaded designs stay editable as flat vector tattoos. No external images, scripts or embedded fonts.</p>
      {uploadMessage&&<p className={uploadError?'cc-svg-import-error':'cc-svg-import-ok'} role="status">{uploadMessage}</p>}
      {editor.config.tattooLibrary.length>0&&<><div className="cc-decoration-head"><strong>MY SVG TATTOOS</strong><span>{editor.config.tattooLibrary.length} / {SVG_LIBRARY_LIMIT}</span></div>
        <div className="cc-svg-library">{editor.config.tattooLibrary.map(asset=><div key={asset.id} className="cc-svg-library-entry">
          <svg viewBox="-38 -38 76 76" aria-hidden="true"><UploadedSvgArtwork asset={asset} instanceId={asset.id}/></svg>
          <span title={asset.name}>{asset.name}</span>
          <button type="button" title={`Add ${asset.name} again`} aria-label={`Add uploaded tattoo ${asset.name}`} disabled={decorations.length>=ACCESSORY_MAX} onClick={()=>editor.addUploadedTattoo(asset.id)}>Add</button>
          <button type="button" className="cc-svg-remove" aria-label={`Delete uploaded tattoo ${asset.name}`} title="Remove tattoo from library and character" onClick={()=>{editor.removeUploadedTattoo(asset.id);setUploadMessage('Removed uploaded tattoo from the library.');setUploadError(false)}}><Trash2 size={14}/></button>
        </div>)}</div></>}
    </section>}
    <div className="cc-accessory-grid" aria-label={`${category} designs`}>{ACCESSORY_COLLECTION.filter(item=>item.category===category).map(item=><button key={item.id} type="button" className="cc-accessory-choice" aria-label={`Add ${item.name}`} disabled={decorations.length>=ACCESSORY_MAX} onClick={()=>editor.addAccessory(item.id)}>
      <svg viewBox="-38 -38 76 76" aria-hidden="true"><AccessoryGlyph type={item.id} color={item.color} secondary={item.secondary}/></svg><span>{item.name}</span><i>+</i>
    </button>)}</div>
    <div className="cc-decoration-head"><strong>ON YOUR CHARACTER</strong><span>{decorations.length} / {ACCESSORY_MAX}</span></div>
    {decorations.length?<div className="cc-decoration-list" aria-label="Applied details">{decorations.map(item=>{
      const entry=ACCESSORY_COLLECTION.find(v=>v.id===item.type)||editor.config.tattooLibrary.find(v=>v.id===item.assetId)
      return <button type="button" className={`cc-decoration-entry ${item.id===selected?.id?'selected':''}`} key={item.id} onClick={()=>editor.setSelectedAccessoryId(item.id)} aria-pressed={item.id===selected?.id}>
        <svg viewBox="-32 -32 64 64" aria-hidden="true">{item.type==='user-svg'?<UploadedSvgArtwork asset={entry} instanceId={'list-'+item.id} tint={item.tint} color={item.color}/>:<AccessoryGlyph type={item.type} color={item.color} secondary={item.secondary}/>}</svg><span>{entry?.name}</span><small>EDIT</small>
      </button>
    })}</div>:<div className="cc-accessory-empty"><Diamond size={17}/><span>No details yet. Choose a design above.</span></div>}
    {selected&&<section className="cc-accessory-properties" aria-label="Selected accessory settings">
      <div className="cc-accessory-properties-title"><strong>{selectedType?.name}</strong><span>SELECTED</span></div>
      <p>Drag the piece directly on the character, or adjust its placement precisely.</p>
      <div className="cc-position-presets" role="group" aria-label="Quick accessory placement">
        {[['Forehead',300,145],['Left cheek',146,411],['Right cheek',450,411],['Chin',300,454],['Left brow',161,186],['Right brow',448,186]].map(([label,x,y])=><button key={label} type="button" onClick={()=>editor.updateAccessory(selected.id,{x,y})}>{label}</button>)}
      </div>
      <Range title="Horizontal position" value={selected.x} min={85} max={515} step={1} onChange={v=>edit('x',v)} format={v=>`${Math.round(v)}`}/>
      <Range title="Vertical position" value={selected.y} min={85} max={515} step={1} onChange={v=>edit('y',v)} format={v=>`${Math.round(v)}`}/>
      <Range title="Detail size" value={selected.scale} min={.45} max={2.5} step={.01} onChange={v=>edit('scale',v)} format={v=>`${Math.round(v*100)}%`}/>
      <Range title="Rotate" value={selected.rotation} min={-180} max={180} step={1} onChange={v=>edit('rotation',v)} format={v=>`${Math.round(v)}°`}/>
      {selected.type==='user-svg'&&<label className="eye-glint-toggle"><input type="checkbox" checked={selected.tint} onChange={ev=>edit('tint',ev.target.checked)}/><span>Recolor SVG using detail color (default: preserve original colors)</span></label>}
      <Swatches title="DETAIL COLOR" options={ACCESSORY_COLORS} value={selected.color} onChange={v=>edit('color',v)}/>
      {selected.type!=='user-svg'&&<Swatches title="SECONDARY COLOR" options={ACCESSORY_COLORS} value={selected.secondary} onChange={v=>edit('secondary',v)}/>}
      <div className="cc-accessory-edit-actions"><button type="button" onClick={()=>edit('flip',!selected.flip)}><FlipHorizontal size={14}/> Flip</button><button type="button" disabled={decorations.length>=ACCESSORY_MAX} onClick={()=>editor.duplicateAccessory(selected.id)}><Copy size={14}/> Duplicate</button><button type="button" onClick={()=>editor.removeAccessory(selected.id)}><Trash2 size={14}/> Remove</button></div>
    </section>}
    {decorations.length>0&&<button type="button" className="cc-accessory-clear" onClick={editor.clearAccessories}>Clear all details</button>}
  </div>
}

function renderDownload(element,format){
  if(!element)return
  const clone=element.cloneNode(true)
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg')
  clone.setAttribute('width','1200')
  clone.setAttribute('height','1200')
  clone.setAttribute('viewBox','0 0 600 600')
  clone.style.removeProperty('transform')
  clone.querySelectorAll('[data-editor-only="true"]').forEach(node=>node.remove())
  const text=new XMLSerializer().serializeToString(clone)
  const uri=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}))
  const save=(url,ext)=>{const a=document.createElement('a');a.href=url;a.download=`EXO-Character-Design.${ext}`;document.body.append(a);a.click();a.remove()}
  if(format==='svg'){save(uri,'svg');setTimeout(()=>URL.revokeObjectURL(uri),1500);return}
  const image=new Image()
  image.onload=()=>{
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200
    canvas.getContext('2d').drawImage(image,0,0,1200,1200)
    canvas.toBlob(blob=>{if(blob){const blobUrl=URL.createObjectURL(blob);save(blobUrl,'png');setTimeout(()=>URL.revokeObjectURL(blobUrl),1500)}URL.revokeObjectURL(uri)},'image/png')
  }
  image.onerror=()=>URL.revokeObjectURL(uri)
  image.src=uri
}

function App(){
  const e=useCircleEditor()
  const theme=useClothCraftTheme()
  const [inspectorTab,setInspectorTab]=useState('eyes')
  const [profileOpen,setProfileOpen]=useState(false)
  const stage=useRef(null)
  const characterRef=useRef(null)
  const [savedNotice,setSavedNotice]=useState('')
  const name=CIRCLE_PRESETS.find(s=>s.id===e.config.id)?.name||'Custom 01'
  const onPointerMove=useCallback(event=>{
    if(!e.tracking)return
    const box=characterRef.current?.getBoundingClientRect()
    if(!box)return
    const x=(event.clientX-(box.left+box.width*.5))/(box.width*.5)
    const y=(event.clientY-(box.top+box.height*.5))/(box.height*.5)
    e.setLook({x:clamp(x,-1,1),y:clamp(y,-1,1)})
  },[e.tracking,e.setLook])
  const download=format=>renderDownload(stage.current?.querySelector('svg[data-circle-character]'),format)
  const saveSettings=()=>{
    const blob=new Blob([JSON.stringify({version:1,kind:'exo-circle-eyes',config:e.config,emotion:e.emotion},null,2)],{type:'application/json'})
    const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download='EXO-Character-Settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1500)
    setSavedNotice('Settings downloaded');setTimeout(()=>setSavedNotice(''),1800)
  }
  const selectAccessory=id=>{e.setSelectedAccessoryId(id);setInspectorTab('details')}
  return <div className="circle-app">
    <header className="eye-header">
      <div className="eye-brand"><span className="eye-brand-symbol" aria-hidden="true">✳</span><span className="eye-brand-title">CLOTHCRAFT<span className="brand-divider">/</span><small>CHARACTER STUDIO</small></span></div>
      <nav className="eye-nav" aria-label="Character studio sections"><a href="./circle.html" className="eye-nav-current" aria-current="page">Circle Studio</a><a href="./" className="eye-nav-link">Alien Studio</a></nav>
      <div className="eye-header-actions">
        <ThemePicker themeId={theme.themeId} onChange={theme.change}/>
        <button className="eye-launch" type="button" disabled title="EXO application launcher is not connected yet">Launch App <ArrowUpRight size={13}/></button>
        <div className="eye-profile"><button className="eye-profile-trigger" aria-label="Profile and local session information" type="button" aria-expanded={profileOpen} onClick={()=>setProfileOpen(v=>!v)}><UserCircle2 size={20}/></button>{profileOpen&&<div className="eye-profile-pop"><strong>LOCAL STUDIO</strong><p>Your character changes are saved in this browser. Account profiles are not connected yet.</p><button type="button" onClick={()=>setProfileOpen(false)}>Close</button></div>}</div>
      </div>
    </header>
    <div className="circle-container">
      <section className="eye-hero">
        <div><div className="eye-eyebrow"><span className="eyebrow-rule"/> EXO DESIGN SYSTEM / CHARACTER ATELIER <span className="eye-hero-counter">002 — FLAT VECTOR</span></div>
          <h1>Character <em>Studio.</em></h1></div>
        <p>Shape the eyes. Make it yours with tattoos, gems and piercings. One 2D workspace, every detail editable. <strong>{EYE_SHAPES.length} eyes / {EYE_COLORWAYS.length} colors / {ACCESSORY_COLLECTION.length} details.</strong></p>
      </section>

      <main className="circle-workbench">
        <aside className="eye-variants eye-panel" aria-label="Circle character presets">
          <div className="eye-panel-header"><span>01 / STARTING FORMS</span><strong>06 PRESETS</strong></div>
          <div className="eye-panel-title"><h2>Pick a circle.</h2><p>One solid color, two flat eyes.</p></div>
          <div className="eye-variant-list">{CIRCLE_PRESETS.map((item,index)=><button type="button" className={`eye-variant ${e.config.id===item.id?'is-active':''}`} key={item.id} aria-label={`Select ${item.name} circle character`} aria-pressed={e.config.id===item.id} onClick={()=>e.preset(item)}>
            <span className="eye-variant-thumbnail"><CircleEyes settings={item} compact motion={false}/></span>
            <span className="eye-variant-text"><small>{item.tag}</small><strong>{item.name}</strong></span>
            <span className="eye-variant-arrow">{e.config.id===item.id?<Check size={16}/>:<ArrowUpRight size={16}/>}</span>
          </button>)}</div>
          <div className="eye-panel-foot"><Sparkles size={17}/><span>Independent eyes, flat artwork and editable accessories.</span></div>
        </aside>

        <section className="eye-stage-column" aria-label="Character animation stage">
          <div className={`eye-stage ${e.background==='light'?'is-light':''}`} ref={stage} onPointerMove={onPointerMove} onPointerLeave={()=>e.setLook({x:0,y:0})}>
            <div className="eye-stage-grid" aria-hidden="true"/>
            <div className="eye-stage-top"><span className="eye-stage-live"><i/> STUDIO / LIVE PREVIEW</span><span className="eye-stage-frame"><Focus size={14}/> VECTOR CANVAS</span></div>
            <div className="eye-stage-ring eye-stage-ring-a" aria-hidden="true"/><div className="eye-stage-ring eye-stage-ring-b" aria-hidden="true"/>
            <div className="eye-stage-avatar" ref={characterRef}><CircleEyes settings={e.config} emotion={e.emotion} look={e.look} motion={e.animated} selectedAccessoryId={e.selectedAccessoryId} onAccessorySelect={selectAccessory} onAccessoryMove={e.moveAccessory}/></div>
            <div className="eye-stage-footer"><div><span>CHARACTER / CURRENT</span><strong>{name}</strong></div><div className="stage-footer-right"><span>{e.tracking?'GAZE / TRACKING':'GAZE / LOCKED'}</span><span>{e.animated?'ANIMATION / ON':'ANIMATION / OFF'}</span></div></div>
          </div>

          <div className="eye-motion eye-panel"><div className="eye-panel-header"><span>02 / EXPRESSION ENGINE</span><strong>LIVE</strong></div><div className="eye-motion-header"><h2>Bring it to life.</h2><p>Choose an expression. Move your cursor over the character to guide its eyes.</p></div>
            <div className="eye-emotions">{EMOTIONS.map(option=><button type="button" key={option.id} className={e.emotion===option.id?'selected':''} aria-label={`${option.label} expression`} aria-pressed={e.emotion===option.id} onClick={()=>e.play(option.id)}>{option.id==='blink'?<EyeClosed size={17}/>:<Eye size={17}/>}<span>{option.label}</span></button>)}</div>
            <div className="eye-motion-switches"><label className="eye-toggle"><span>Pointer tracking</span><input type="checkbox" checked={e.tracking} onChange={ev=>e.setTracking(ev.target.checked)}/><i/></label><label className="eye-toggle"><span>Auto blink</span><input type="checkbox" checked={e.animated} onChange={ev=>e.setAnimated(ev.target.checked)}/><i/></label><button className="eye-stage-toggle" type="button" onClick={()=>e.setBackground(e.background==='dark'?'light':'dark')}>{e.background==='dark'?'Light stage':'Dark stage'} <MoveUpRight size={14}/></button></div>
          </div>
        </section>

        <aside className="eye-controls eye-panel" aria-label="Edit eye system">
          <div className="eye-panel-header"><span>03 / DESIGN INSPECTOR</span><SlidersHorizontal size={16}/></div>
          <div className="eye-inspector-tabs" role="tablist" aria-label="Character design tools">
            <button role="tab" aria-selected={inspectorTab==='eyes'} type="button" onClick={()=>setInspectorTab('eyes')}><Shapes size={15}/> Eyes</button>
            <button role="tab" aria-selected={inspectorTab==='color'} type="button" onClick={()=>setInspectorTab('color')}><Palette size={15}/> Colors</button>
            <button role="tab" aria-selected={inspectorTab==='details'} type="button" onClick={()=>setInspectorTab('details')}><Diamond size={15}/> Details{e.config.accessories.length>0&&<b>{e.config.accessories.length}</b>}</button>
          </div>
          <div role="tabpanel" aria-label={`${inspectorTab} controls`} className="eye-inspector-content">
          {inspectorTab==='eyes'&&<>
            <div className="eye-panel-title"><h2>Shape your eyes.</h2><p>{EYE_SHAPES.length} selectable eye designs, with custom spacing and proportions.</p></div>
            <EyeLibrary value={e.config.shape} colors={e.config} onChange={v=>e.edit('shape',v)}/>
            <div className="eye-sliders"><Range title="Eye size" value={e.config.eyeScale} min={.55} max={1.35} onChange={v=>e.edit('eyeScale',v)} format={v=>`${Math.round(v*100)}%`}/><Range title="Eye spacing" value={e.config.spacing} min={.75} max={1.3} onChange={v=>e.edit('spacing',v)} format={v=>`${Math.round(v*100)}%`}/></div>
          </>}
          {inspectorTab==='color'&&<>
            <div className="eye-panel-title"><h2>Color your character.</h2><p>{EYE_COLORWAYS.length} colorways and completely independent left/right eyes.</p></div>
            <EyeColorways selected={e.config} onSelect={e.colorway}/>
            <Swatches title="SOLID BODY COLOR" options={COLOR_SWATCHES} value={e.config.color} onChange={v=>e.edit('color',v)}/>
            <EyeColorsEditor settings={e.config} edit={e.edit}/>
          </>}
          {inspectorTab==='details'&&<AccessoryStudio editor={e}/>}
          </div>
          <div className="eye-export"><button type="button" className="eye-export-primary" onClick={()=>download('png')}><Download size={16}/> Export PNG</button><button type="button" onClick={()=>download('svg')}>SVG</button><button type="button" onClick={saveSettings}>JSON</button></div>
          <div className="eye-bottom-actions"><button onClick={e.shuffle} type="button"><Shuffle size={15}/> New variation</button><button onClick={e.reset} type="button"><RotateCcw size={15}/> Reset</button></div>
          <small className="eye-autosave">{savedNotice||'Changes auto-save locally · SVG imports stay on this device'}</small>
        </aside>
      </main>
      <footer className="eye-footer"><div><span>✳</span><strong>EXO / EYE EXPERIMENTS</strong><small>Original procedural characters. Not affiliated with Starboy or CREATURE.</small></div><a href="./">RETURN TO 3D ALIEN STUDIO <ArrowUpRight size={16}/></a></footer>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)

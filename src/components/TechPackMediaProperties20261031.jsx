import React,{useMemo,useState} from 'react'
import {getLinkedFabricMedia,normalizeTechPackFillHex,patchTechPackMediaSlot,selectTechPackMediaAssets,TECHPACK_MEDIA_PALETTE} from '../core/techPackFabricMediaBridge20261031.js'
import {isTechPackVectorAsset20261031} from '../core/techPackArtworkPresentation20261031.js'
import './TechPackMediaProperties20261031.css'

// onChange receives {slot:{...}}; onAssetChange receives an asset ID.
export default function TechPackMediaProperties({box,slot:providedSlot,kind:providedKind,assets=[],fabrics=[],colorways=[],project,onChange=()=>{},onAssetChange,onChooseAsset,onRemoveWhiteBackground,selectedAssetId:providedAssetId,disabled=false}){
  const slot=providedSlot||box?.slot||{}
  const kind=providedKind||(slot.contentType==='swatch'?(slot.swatchMode==='fabric'||slot.linkedFabricId?'fabric-swatch':'color-swatch'):(box?.semanticRole==='front-view'||box?.semanticRole==='back-view'?'technical-flat':'mockup'))
  const selectedAssetId=providedAssetId??box?.assetId??''
  const [hexDraft,setHexDraft]=useState('')
  const [search,setSearch]=useState('')
  const fabric=getLinkedFabricMedia(slot.linkedFabricId,fabrics,assets)
  const isFabric=kind==='fabric-swatch'||(slot.contentType==='swatch'&&(slot.swatchMode==='fabric'||Boolean(slot.linkedFabricId)))
  const isColor=slot.contentType==='swatch'&&!isFabric
  const fill=normalizeTechPackFillHex(slot.swatchHex)||'#080808'
  const change=patch=>onChange({slot:patchTechPackMediaSlot(slot,patch)})
  const assignHex=raw=>{const hex=normalizeTechPackFillHex(raw);if(hex){change({swatchHex:hex,swatchOverride:true});setHexDraft('')}}
  const pickerKind=kind==='technical-flat'?'technical-flat':isFabric?'fabric':'mockup'
  const choices=useMemo(()=>selectTechPackMediaAssets(assets,{kind:pickerKind,role:slot.assetRole||'',tags:slot.requiredTags||[]}),[assets,pickerKind,slot.assetRole,slot.requiredTags])
  const chooseAsset=assetId=>{if(!assetId)return; if(onChooseAsset)onChooseAsset(assetId);else if(onAssetChange)onAssetChange(assetId);else onChange({assetId})}
  const filtered=choices.filter(a=>(a.name+' '+(a.caption||'')+' '+(a.tags||[]).join(' ')).toLowerCase().includes(search.toLowerCase()))
  const current=assets.find(a=>a.id===selectedAssetId)
  const sourceUrl=current?.dataUrl||current?._src||current?.src||box?.assetSrc||''
  const isVector=isTechPackVectorAsset20261031(sourceUrl)
  const isRaster=typeof sourceUrl==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(sourceUrl)
  const displayed=selectedAssetId&&current&&!filtered.some(a=>a.id===selectedAssetId)?[current,...filtered]:filtered
  return <section className="tpws-media-properties" aria-label="Selected media properties">
    <header><strong>{isFabric?'FABRIC SWATCH':isColor?'COLOR FILL':kind==='technical-flat'?'TECHNICAL FLAT':'IMAGE / MOCKUP'}</strong><small>Appearance</small></header>
    {slot.contentType==='swatch'&&<label>Swatch type<select aria-label="Selected swatch type" value={isFabric?'fabric':'color'} disabled={disabled}
      onChange={e=>change({swatchMode:e.target.value,...(e.target.value==='color'?{linkedFabricId:''}:{swatchOverride:false})})}>
      <option value="color">Color object</option><option value="fabric">Linked fabric</option>
    </select></label>}
    {(isColor||isFabric)&&<>
      <label className="tpws-media-fill">Fill <input aria-label="Swatch fill color" type="color" disabled={disabled} value={fill} onChange={e=>assignHex(e.target.value)}/></label>
      <label>HEX <input aria-label="Swatch fill HEX" spellCheck="false" disabled={disabled} value={hexDraft||fill} onChange={e=>setHexDraft(e.target.value)} onBlur={()=>assignHex(hexDraft)} onKeyDown={e=>{if(e.key==='Enter'){assignHex(hexDraft);e.currentTarget.blur()}}}/></label>
      <div className="tpws-media-palette" role="group" aria-label="Fill color swatches">{TECHPACK_MEDIA_PALETTE.map(hex=><button type="button" aria-label={`Use ${hex}`} title={hex} key={hex} disabled={disabled} onClick={()=>assignHex(hex)} style={{background:hex}} className={fill.toLowerCase()===hex.toLowerCase()?'active':''}/>)}</div>
      <div className="tpws-media-stroke-panel" aria-label="Color square stroke and fill">
        <strong>APPEARANCE · FILL &amp; STROKE</strong>
        <label>Stroke <select aria-label="Swatch stroke mode" value={slot.swatchStrokeMode||'none'} disabled={disabled} onChange={e=>change({swatchStrokeMode:e.target.value})}>
          <option value="none">No stroke</option><option value="color">Solid stroke</option>
        </select></label>
        {slot.swatchStrokeMode==='color'&&<>
          <label>Stroke color <input type="color" aria-label="Swatch stroke color" disabled={disabled}
            value={normalizeTechPackFillHex(slot.swatchStrokeHex)||'#171717'}
            onChange={e=>change({swatchStrokeHex:e.target.value})}/></label>
          <label>Stroke width <input type="number" min="0" max="24" step=".5" aria-label="Swatch stroke width" disabled={disabled}
            value={slot.swatchStrokeWidth??1} onChange={e=>change({swatchStrokeWidth:e.target.value})}/></label>
        </>}
      </div>
    </>}
    {isColor&&colorways.length>0&&<label>Colorway <select disabled={disabled} aria-label="Linked colorway" value={slot.linkedColorwayId||''} onChange={e=>{const item=colorways.find(c=>c.id===e.target.value);change({linkedColorwayId:e.target.value,...(normalizeTechPackFillHex(item?.hex)?{swatchHex:item.hex}:{})})}}><option value="">Custom fill</option>{colorways.map(c=><option value={c.id} key={c.id}>{c.name||c.id}</option>)}</select></label>}
    {isFabric&&<>
      <label>EXO fabric <select disabled={disabled} aria-label="Linked EXO fabric" value={slot.linkedFabricId||''} onChange={e=>{const f=fabrics.find(item=>item.id===e.target.value);change({linkedFabricId:e.target.value,swatchOverride:false,...(normalizeTechPackFillHex(f?.color)?{swatchHex:f.color}:{})})}}><option value="">Choose fabric</option>{fabrics.filter(f=>f.id).map(f=><option key={f.id} value={f.id}>{f.name||f.id}</option>)}</select></label>
      {fabric?<div className="tpws-media-fabric-details"><strong>{fabric.name}</strong><span className="tpws-media-verification">{fabric.verification} · {fabric.source}</span>{Object.entries(fabric.metadata).map(([key,val])=><div key={key}><span>{key==='gsm'?'GSM':key.replace(/([A-Z])/g,' $1')}</span><b>{String(val)}{key==='gsm'?' g/m²':''}</b></div>)}<div><span>Texture</span><b>{fabric.texture?'Linked appearance':'Not supplied'}</b></div></div>:<small>Choose an existing EXO fabric to show its linked measurements. Unverified values are not lab results.</small>}
      <label>Swatch display <select aria-label="Fabric swatch display" disabled={disabled} value={slot.swatchDisplay||'color'} onChange={e=>change({swatchDisplay:e.target.value})}><option value="color">Color fill</option><option value="photo">Linked photo</option></select></label>
    </>}
    {(!isColor||isFabric)&&<div className="tpws-media-chooser"><label>{isFabric?'Fabric photo':kind==='technical-flat'?'Technical flat':'Mockup / photo'}<input aria-label="Search media assets" placeholder="Search tagged assets" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <select aria-label="Replace media asset" disabled={disabled} value={selectedAssetId||''} onChange={e=>chooseAsset(e.target.value)}><option value="">Choose from project assets</option>{displayed.map(a=><option key={a.id} value={a.id}>{a.caption||a.name||a.id}</option>)}</select>
      {selectedAssetId&&<small>Selected source asset: {selectedAssetId}</small>}
    </div>}
    {isVector&&<div className="tpws-media-vector-editor" aria-label="Technical drawing stroke and fill">
      <strong>VECTOR ARTWORK · FILL &amp; STROKE</strong>
      <small>Editable SVG paths. Changes are local appearance overrides; the original asset stays unchanged.</small>
      <label>Fill type<select aria-label="Drawing fill mode" disabled={disabled} value={slot.vectorFillMode||'original'}
        onChange={e=>change({vectorFillMode:e.target.value})}>
        <option value="original">Original source fills</option><option value="color">Custom fill color</option><option value="none">No fill / transparent</option>
      </select></label>
      <label>Fill color<input aria-label="Drawing fill color" type="color" disabled={disabled}
        value={normalizeTechPackFillHex(slot.vectorFill)||'#FFFFFF'} onChange={e=>change({vectorFillMode:'color',vectorFill:e.target.value})}/></label>
      <label>Stroke type<select aria-label="Drawing stroke mode" disabled={disabled} value={slot.vectorStrokeMode||'original'}
        onChange={e=>change({vectorStrokeMode:e.target.value})}>
        <option value="original">Original source strokes</option><option value="color">Custom stroke color</option><option value="none">No stroke</option>
      </select></label>
      <label>Stroke color<input aria-label="Drawing stroke color" type="color" disabled={disabled}
        value={normalizeTechPackFillHex(slot.vectorStroke)||'#101010'} onChange={e=>change({vectorStrokeMode:'color',vectorStroke:e.target.value})}/></label>
      <label>Stroke width <input aria-label="Drawing stroke width" type="number" min="0" max="50" step="0.25" disabled={disabled}
        value={slot.vectorStrokeWidth??''} placeholder="Use source width"
        onChange={e=>change({vectorStrokeWidth:e.target.value===''?null:Math.min(50,Math.max(0,Number(e.target.value)||0))})}/></label>
      <label className="tpws-vector-background-toggle"><input aria-label="Remove SVG white paper background" type="checkbox"
        disabled={disabled} checked={slot.vectorRemoveWhite===true}
        onChange={e=>change({vectorRemoveWhite:e.target.checked})}/> Remove full-page white SVG background (preserve garment white fills)</label>
      <label className="tpws-vector-background-toggle"><input aria-label="Trim SVG to visible paths" type="checkbox"
        disabled={disabled} checked={slot.vectorTrimToArtwork!==false&&
          (slot.vectorTrimToArtwork===true||/technical[ -]?flat|technical[ -]?drawing|botanical|line[ -]?art/i.test(String(current?.category||'')))}
        onChange={e=>change({vectorTrimToArtwork:e.target.checked})}/> Trim transparent SVG artboard to visible paths</label>
      <button type="button" disabled={disabled} onClick={()=>change({vectorFillMode:'original',vectorStrokeMode:'original',
        vectorStrokeWidth:null,vectorRemoveWhite:false})}>Restore source colors</button>
    </div>}
    {isRaster&&<div className="tpws-media-vector-editor" aria-label="Raster drawing transparency">
      <strong>RASTER TECHNICAL DRAWING</strong>
      <small>PNG/JPEG/WebP pixels do not contain editable vector paths. Make a transparent reference copy without changing the original.</small>
      <button type="button" disabled={disabled||!onRemoveWhiteBackground} onClick={()=>onRemoveWhiteBackground?.(current)}>
        Remove solid background and trim to drawing
      </button>
      <small>Works on uniform white or gray paper backgrounds, preserves enclosed garment fills, and retains the original file. Complex gradients need a separate mask.</small>
    </div>}
  </section>
}

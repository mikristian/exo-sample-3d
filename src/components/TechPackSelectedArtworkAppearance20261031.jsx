import React, {useEffect,useState} from 'react'
import {isTechPackVectorAsset20261031} from '../core/techPackArtworkPresentation20261031.js'
import {normalizeTechPackFillHex, TECHPACK_MEDIA_PALETTE} from '../core/techPackFabricMediaBridge20261031.js'
import './TechPackSelectedArtworkAppearance20261031.css'

const sourceOf = asset => typeof asset === 'string' ? asset :
  [asset?.dataUrl,asset?._src,asset?.src,asset?.url,asset?.imageUrl,asset?.previewUrl,asset?.svg,asset?.source].find(x=>typeof x==='string'&&x.trim()) || ''

/** Appearance overrides are stored by the owning placed artwork slot, not on the source asset.
 * onChange receives a partial slot patch, e.g. {vectorFillMode:'color',vectorFill:'#FF0000'}.
 * onRasterRecolor receives {lineInk:'#...', garmentFill:'#...'} on explicit Apply.
 */
export default function TechPackSelectedArtworkAppearance20261031({
  selectedAsset, appearanceOverrides={}, onChange, onRasterRecolor, disabled=false,
}) {
  const asset = selectedAsset || null
  const overrides = appearanceOverrides || {}
  const source = sourceOf(asset)
  const vector = !!asset && isTechPackVectorAsset20261031(source)
  const locked = disabled || !asset || typeof onChange!=='function'
  const [rasterDraft,setRasterDraft] = useState({lineInk:'#080808',garmentFill:'#FFFFFF'})
  useEffect(()=>setRasterDraft({
    lineInk:normalizeTechPackFillHex(overrides.rasterLineInk||overrides.lineInk)||'#080808',
    garmentFill:normalizeTechPackFillHex(overrides.rasterGarmentFill||overrides.garmentFill)||'#FFFFFF',
  }),[asset?.id,overrides.rasterLineInk,overrides.rasterGarmentFill,overrides.lineInk,overrides.garmentFill])
  const rasterInk = rasterDraft.lineInk
  const rasterFill = rasterDraft.garmentFill
  const patch = value => {if(!locked)onChange(value)}
  const paintControl = (label,prefix,initial) => {
    const modeKey=`vector${prefix}Mode`, colorKey=`vector${prefix}`
    const mode=['original','color','none'].includes(overrides[modeKey])?overrides[modeKey]:'original'
    const color=normalizeTechPackFillHex(overrides[colorKey])||initial
    return <div className="exo-art-appearance-paint" key={prefix}>
      <div className="exo-art-appearance-line"><strong>{label}</strong><span className="exo-art-appearance-swatch" style={{background:mode==='none'?'transparent':mode==='original'?'linear-gradient(135deg,#999 50%,#eee 50%)':color}} aria-hidden="true"/></div>
      <div className="exo-art-appearance-modes" role="group" aria-label={`${label} paint mode`}>
        {['original','color','none'].map(option=><button key={option} type="button" className={mode===option?'is-active':''}
          aria-pressed={mode===option} disabled={locked} onClick={()=>patch({[modeKey]:option})}>{option==='original'?'Original':option==='color'?'Color':'None'}</button>)}
      </div>
      <div className="exo-art-appearance-color">
        <input type="color" aria-label={`${label} color picker`} value={color} disabled={locked} onChange={e=>patch({[modeKey]:'color',[colorKey]:e.target.value.toUpperCase()})}/>
        <input type="text" aria-label={`${label} hex color`} value={color} maxLength={7} disabled={locked}
          onChange={e=>{const hex=normalizeTechPackFillHex(e.target.value);if(hex)patch({[modeKey]:'color',[colorKey]:hex})}} />
      </div>
    </div>
  }
  if(!asset)return <section className="exo-art-appearance" aria-label="Artwork appearance"><header>Appearance</header><p className="exo-art-appearance-muted">Select artwork to edit its appearance.</p></section>
  return <section className="exo-art-appearance" aria-label="Artwork appearance" data-artwork-kind={vector?'vector':'raster'}>
    <header><span>Appearance</span><small>{vector?'SVG artwork':'Image artwork'}</small></header>
    <div className="exo-art-appearance-selected" title={asset?.name||'Selected artwork'}>{asset?.name||'Selected artwork'}</div>
    {vector ? <>
      {paintControl('Fill','Fill','#FFFFFF')}
      {paintControl('Stroke','Stroke','#080808')}
      <label className="exo-art-appearance-width">Stroke width <span><input type="number" min="0" max="50" step="0.25" aria-label="SVG stroke width" disabled={locked}
        value={overrides.vectorStrokeWidth??''} placeholder="Source" onChange={e=>patch({vectorStrokeWidth:e.target.value===''?null:Number(e.target.value)})}/> px</span></label>
      <div className="exo-art-appearance-palette" aria-label="Quick artwork colors">
        {TECHPACK_MEDIA_PALETTE.map(color=><button type="button" key={color} style={{background:color}} title={`Set fill ${color}`} aria-label={`Set SVG fill to ${color}`} disabled={locked}
          onClick={()=>patch({vectorFillMode:'color',vectorFill:color})}/>)}
      </div>
      <p className="exo-art-appearance-muted">Colors apply to this placement. The original SVG is preserved.</p>
    </> : <>
      <p className="exo-art-appearance-muted">Image recoloring creates a separate edited appearance. The original image stays intact.</p>
      {[['lineInk','Line ink',rasterInk],['garmentFill','Garment fill',rasterFill]].map(([key,label,color])=><label className="exo-art-appearance-raster" key={key}>{label}<span>
        <input type="color" value={color} aria-label={`${label} color picker`} disabled={disabled||typeof onRasterRecolor!=='function'} onChange={e=>setRasterDraft(old=>({...old,[key]:e.target.value.toUpperCase()}))}/>
        <span>{color}</span>
      </span></label>)}
      <button type="button" className="exo-art-appearance-apply" disabled={disabled||typeof onRasterRecolor!=='function'}
        onClick={()=>onRasterRecolor({lineInk:rasterDraft.lineInk,garmentFill:rasterDraft.garmentFill})}>Apply image recolor</button>
    </>}
  </section>
}

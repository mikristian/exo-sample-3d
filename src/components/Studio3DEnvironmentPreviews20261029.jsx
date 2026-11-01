import React from 'react'
import {STUDIO_3D_ENVIRONMENT_PRESETS_20261029,applyStudio3DEnvironmentChoice20261029,isStudio3DEnvironmentChoiceActive20261029} from '../core/studio3DEnvironmentPresets20261029.js'
import './Studio3DEnvironmentPreviews20261029.css'

export default function Studio3DEnvironmentPreviews20261029({appearance={},onChange,onPreview}){
  return <section className="studio-3d-environment-quick" aria-label="3D Environment previews" data-testid="studio-3d-environment-previews">
    <strong>3D Environment</strong>
    <small>Hover or focus to preview the real 3D scene. Click to keep a background, floor or lighting preset. Leaving restores your saved appearance.</small>
    {STUDIO_3D_ENVIRONMENT_PRESETS_20261029.map(group=><div className="studio-3d-environment-group" key={group.id} role="group" aria-label={group.label}>
      <span className="studio-3d-environment-label">{group.label}</span>
      <div className="studio-3d-environment-choices">
        {group.options.map(option=>{
          const selected=isStudio3DEnvironmentChoiceActive20261029(appearance,group.id,option)
          return <button type="button" key={option.id} className={selected?'selected':''} aria-pressed={selected}
            aria-label={`${group.label}: ${option.label}`} data-env-group={group.id} data-env-option={option.id}
            onMouseEnter={()=>onPreview?.(option.appearance)} onMouseLeave={()=>onPreview?.(null)}
            onFocus={()=>onPreview?.(option.appearance)} onBlur={()=>onPreview?.(null)}
            onClick={()=>{onChange?.(applyStudio3DEnvironmentChoice20261029(appearance,option));onPreview?.(null)}}>
            <span className={`studio-3d-environment-swatch studio-3d-environment-swatch--${group.id}`} style={{'--env-swatch':option.swatch}} aria-hidden="true"><i/></span>
            <span>{option.label}</span>
          </button>
        })}
      </div>
    </div>)}
  </section>
}

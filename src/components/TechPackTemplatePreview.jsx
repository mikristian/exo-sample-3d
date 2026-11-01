import React from 'react'
import {TECHPACK_THEMES} from '../core/techPackTemplatePresets.js'
import {FRAMED_HEADER_PRESETS} from '../core/techPackVisualThemes20261031.js'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES} from '../core/techPackComposablePageTemplates20261031.js'

// Declarative, inert sample artboards: the preview shows layout only. No
// garment measurements, fabric tests or approval statuses are invented.
export default function TechPackTemplatePreview({preset={},compact=false}){
  if(preset.kind==='production-page-recipe'){
    const composition=TECHPACK_COMPOSABLE_PAGE_TEMPLATES.find(item=>item.id===preset.compositionId)
    return <div className={`tpws-template-preview-stage tpws-production-recipe-preview ${compact?'is-compact':''}`} data-template-preview={preset.id}>
      <div className="tpws-production-recipe-paper">
        {(composition?.regions||[]).map((region,i)=>{
          const b=region.rect||{},kind=region.role||region.type||'photo'
          return <div key={i} className={`tpws-production-region tpws-production-region-${kind}`}
            style={{left:`${(Number(b.x)||0)/612*100}%`,top:`${(Number(b.y)||0)/792*100}%`,
              width:`${Math.max(0,Number(b.width)||0)/612*100}%`,height:`${Math.max(0,Number(b.height)||0)/792*100}%`}}>
            {['table','bottom-table'].includes(kind)?<div className="tpws-production-region-grid"><b/><i/><i/><i/></div>:
              kind==='swatch'?<span className="tpws-production-region-swatch"/>:
              ['drawing','photo','artwork','reference','mockup'].includes(kind)?<span className="tpws-production-region-media"><svg width="56%" viewBox="0 0 50 60" aria-hidden="true"><path d="M16 9 L23 6 L27 6 L34 9 L44 21 L37 27 L33 22 L33 52 L17 52 L17 22 L13 27 L6 21 Z" fill="none" stroke="#222a31" strokeWidth="1.2"/></svg></span>:null}
          </div>
        })}
      </div>
    </div>
  }
  if(preset.kind==='production-pack-recipe'){
    return <div className={`tpws-template-preview-stage tpws-production-pack-preview ${compact?'is-compact':''}`} data-template-preview={preset.id}>
      <div className="tpws-production-mini-stack">{[0,1,2].map((index)=><div key={index} className="tpws-production-mini-page">
        <div/><b/><i/><i/><small>{String(index+1).padStart(2,'0')}</small>
      </div>)}</div>
      <small className="tpws-production-pack-count">{preset.pageRecipeIds?.length||0} source-linked pages</small>
    </div>
  }
  if(preset.category==='boxes'&&['photo','swatch','text','vector'].includes(preset.kind)){
    const ink='#20262e'
    return <div className={`tpws-template-preview-stage tpws-direct-object-preview ${compact?'is-compact':''}`} data-template-preview={preset.id}>
      <div className="tpws-direct-object-art" aria-label={`${preset.name} direct object preview`}>
        {preset.kind==='swatch'?<div className="tpws-direct-swatch" style={{background:preset.color||'#d9d7d2'}}/>:
          preset.kind==='photo'?<svg viewBox="0 0 160 140" width="100%" height="100%" aria-hidden="true">
            {preset.id==='media-artwork'?<g fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M55 21 Q80 12 105 21 L131 37 148 68 131 80 118 61 118 126 42 126 42 61 29 80 12 68 29 37 Z"/>
              <path d="M56 21 Q80 49 104 21 M42 61 L29 37 M118 61 L131 37"/>
            </g>:<g fill="none" stroke={ink} strokeWidth="1.7"><rect x="19" y="19" width="122" height="101" rx="1"/>
              <circle cx="112" cy="44" r="9"/><path d="M25 106 L66 65 87 85 101 76 135 111"/></g>}
          </svg>:
          preset.kind==='text'?<div className="tpws-direct-annotation"><strong>{preset.id==='text-factory-note'?'FACTORY SPECIFICATION':'CONSTRUCTION NOTE 01'}</strong><span>Editable annotation text</span></div>:
          <svg viewBox="0 0 160 140" width="100%" height="100%" aria-hidden="true">
            {preset.vectorKind==='ellipse'?<ellipse cx="80" cy="70" rx={preset.id==='circle'?49:63} ry={preset.id==='circle'?49:40} fill="none" stroke={ink} strokeWidth="2"/>:
              <rect x={preset.id==='square'?37:20} y={preset.id==='square'?27:38} width={preset.id==='square'?86:120} height={preset.id==='square'?86:66}
                fill={preset.id==='outline-frame'?'none':'#d9d7d2'} stroke={ink} strokeWidth="2"/>}
          </svg>}
      </div>
    </div>
  }
  if(preset.kind==='framed-header-variant'){
    const style=FRAMED_HEADER_PRESETS.find(item=>item.id===preset.id)||FRAMED_HEADER_PRESETS[0]
    return <div className={`tpws-template-preview-stage tpws-framed-header-stage ${compact?'is-compact':''}`} data-template-preview={preset.id}>
      <div className="tpws-framed-header-sample" style={{'--header-accent':style.header,'--header-fg':style.text,'--header-body':style.body,'--header-line':style.border,background:style.body,border:`1px solid ${style.border}`}}>
        <div className="tpws-framed-header-cells" style={{gridTemplateColumns:'44fr 63fr 56fr 78fr 56fr 43fr 45fr 84fr 37fr 67fr'}}>
          {['SEASON','—','STYLE NO.','—','CATEGORY','—','FABRIC','—','DATE','—',
            'BRAND','—','NAME','—','','','SIZE','—','MAT.','—'].map((value,i)=>
            <span key={i} className={i===13&&style.nameMerge==='wide'?'wide':''} style={{minHeight:i<10?style.firstHeight:i<20?style.secondHeight:undefined,
              background:style.id==='graphite-reverse'&&i<10?style.header:style.body,
              color:style.id==='graphite-reverse'&&i<10?'#ffffff':style.body==='#ffffff'?'#171717':'#292929',
              fontWeight:i%2===0?700:400,fontSize:style.firstHeight<=20?'.55em':'.65em'}}>{value}</span>)}
        </div>
        <strong style={{background:style.header,color:style.text,minHeight:style.titleHeight,display:'flex',alignItems:'center',
          justifyContent:style.titleAlign==='center'?'center':'flex-start',paddingLeft:style.titleAlign==='center'?0:8,
          width:style.band==='full'?'100%':style.band==='split'?'70%':'50%',letterSpacing:style.titleHeight>=35?'0.09em':'normal'}}>
          TECHNICAL DETAILS</strong>
      </div>
    </div>
  }
  if(preset.kind==='canonical-gallery-table')return <div className={`tpws-template-preview-stage tpws-gallery-grid-stage ${compact?'is-compact':''}`} data-template-preview={preset.id}>
    <div className="tpws-gallery-grid-preview"><div>{preset.headings.slice(0,4).map((h,i)=><b key={i}>{h}</b>)}</div>
      {preset.rowLabels.slice(0,4).map((label,i)=><div key={i}>{preset.headings.slice(0,4).map((_,j)=><span key={j}>{j===0?label:'—'}</span>)}</div>)}
    </div>
  </div>
  if(preset.kind==='minimal-frame-page')return <div className={`tpws-template-preview-stage tpws-minimal-frame-stage ${compact?'is-compact':''}`} data-template-preview={preset.id}>
    <div className="tpws-minimal-frame-paper" role="img" aria-label="Blank US Letter portrait sheet with enclosing black frame, two-row metadata header, centered section title, empty drawing area, optional blank table and footer">
      <div className="tpws-minimal-frame-border">
        <div className="tpws-minimal-frame-metadata">{['STYLE / REF','GARMENT / CATEGORY','DATE / REVISION','PAGE'].map(label=><div key={label}><span>{label}</span><i aria-hidden="true"/></div>)}</div>
        <div className="tpws-minimal-frame-heading">SECTION TITLE</div>
        <div className="tpws-minimal-frame-body"><span>Technical drawing / drag asset from Assets</span></div>
        <div className="tpws-minimal-frame-spec"><span>OPTIONAL SPECIFICATION TABLE</span><div><i/><i/><i/></div></div>
      </div>
      <div className="tpws-minimal-frame-footer">BRAND / LOGO <span>FOOTER</span></div>
    </div>
  </div>
  const theme=TECHPACK_THEMES.find(item=>item.id===preset.theme)||TECHPACK_THEMES[0]
  const color=preset.colors?.accent||preset.lineColor||theme.accent
  const wash=preset.colors?.wash||theme.wash
  const layout=preset.layout||'balanced'
  const type=preset.category||'pages'
  const id=preset.pageId||''
  const table=type==='tables'||['measurement-table','grading','construction-operations','pattern-cutlist','materials','packaging'].includes(id)||layout==='specification'
  const fabric=id==='fabrics'||layout==='gallery'
  const pattern=id==='patterns'||id==='flats'||id==='measurements'||layout==='illustration'
  const boxed=type==='boxes'
  const title=type==='headers'?'DOCUMENT HEADER':boxed?'FRAMED DETAIL':type==='tables'?'CUSTOM SPECIFICATION':
    id?String(preset.name||'').toUpperCase():'TECHNICAL SPECIFICATION'
  const rows=type==='tables'?Math.min(7,Math.max(3,preset.rows||4)):5
  return <div className={`tpws-template-preview-stage ${compact?'is-compact':''}`} data-template-preview={preset.id||preset.name}>
    <div className="tpws-template-preview-paper" style={{'--tpl-accent':color,'--tpl-wash':wash}} data-preview-header={preset.header||'seville'} data-preview-layout={layout}>
      <div className="tpws-template-preview-folio">01</div>
      <div className="tpws-template-preview-rule">
        <div className="tpws-template-preview-records"><span>STYLE NO.<b>EXO / SAMPLE</b></span><span>CATEGORY<b>GARMENT</b></span><span>FABRIC<b>REFERENCE</b></span><span>REV.<b>01</b></span></div>
        <div className="tpws-template-preview-heading"><strong>{title}</strong><small>DEVELOPMENT REFERENCE · LAYOUT PREVIEW</small></div>
        <div className="tpws-template-preview-content">
          {boxed?<div className="tpws-template-preview-box" style={{borderStyle:preset.border||'solid',borderColor:color}}><b>{preset.name||'DETAIL BOX'}</b><span>DETAIL / REFERENCE</span><i/><i/></div>:
          table?<div className="tpws-template-preview-table"><div className="tpws-template-preview-table-head">{(preset.headers||['ITEM / REF','SPECIFICATION','NOTES']).slice(0,6).map((item,i)=><b key={i}>{item}</b>)}</div>{Array.from({length:rows},(_,i)=><div className="tpws-template-preview-table-row" key={i}>{(preset.headers||['ITEM / REF','SPECIFICATION','NOTES']).slice(0,6).map((_,j)=><span key={j}><i style={{width:`${50+(i+j)%3*15}%`}}/></span>)}</div>)}</div>:
          fabric?<div className="tpws-template-preview-swatches">{[color,wash,'#bdc6ca','#d0cabf'].map((swatch,i)=><div key={i}><span style={{background:swatch}}/><b>FAB {String(i+1).padStart(2,'0')}</b><small>REFERENCE</small></div>)}</div>:
          pattern?<div className="tpws-template-preview-pattern"><svg viewBox="0 0 380 160" fill="none" aria-hidden="true"><path d="M64 27 L101 18 L122 34 L164 27 L188 118 L175 133 L145 123 L144 143 L41 143 L41 123 L18 133 L4 118 L24 29 L64 27 Z" stroke={color} strokeWidth="2"/><path d="M101 18 C104 44 123 44 122 34 M41 123 L144 123 M83 17 V145 M4 118 L188 118" stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity=".5"/><path d="M220 34 L340 34 L347 143 L214 143 Z M218 128 L344 128" stroke={color} strokeWidth="2"/><path d="M280 34 V143" stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity=".5"/></svg><div>FRONT / BACK · VECTOR REFERENCE</div></div>:
          <div className="tpws-template-preview-balanced"><div className="tpws-template-preview-drawing"><svg viewBox="0 0 130 128" fill="none" aria-hidden="true"><path d="M42 15 L54 7 L72 7 L85 15 L108 38 L94 55 L83 45 L85 117 L41 117 L43 45 L30 55 L17 38 Z" stroke={color} strokeWidth="2"/><path d="M54 7 Q63 28 72 7" stroke={color}/></svg></div><div className="tpws-template-preview-mini-table">{Array.from({length:6},(_,i)=><i key={i}/>)}</div></div>}
          {type==='headers'&&<div className="tpws-template-preview-header-detail">HEADER DESIGN ONLY · MEASUREMENTS UNCHANGED</div>}
        </div>
      </div>
      <div className="tpws-template-preview-footer"><strong>EXO TECHPACK</strong><span>WORKING TEMPLATE · NOT FACTORY APPROVED</span></div>
    </div>
  </div>
}

import React,{useEffect,useRef,useState} from 'react'

// Exact color tokens from ClothCraft site-theme-grid-20261102.js. This page is
// intentionally an independent React app, without injecting the marketing DOM.
export const CC_THEME_KEY='clothcraft-site-theme-v2'
export const CC_THEMES=[
  {id:'black',name:'Black',bg:'#101010',panel:'#191919',raised:'#252525',line:'#464646',fg:'#eeeeee',muted:'#adadad',primary:'#e4e4e4',onPrimary:'#111111',scheme:'dark'},
  {id:'deep-charcoal',name:'Deep charcoal',bg:'#191919',panel:'#262626',raised:'#313131',line:'#494949',fg:'#ececec',muted:'#b0b0b0',primary:'#e6e6e6',onPrimary:'#1b1b1b',scheme:'dark'},
  {id:'charcoal',name:'Charcoal',bg:'#242424',panel:'#303030',raised:'#373737',line:'#555555',fg:'#e5e5e5',muted:'#b5b5b5',primary:'#dedede',onPrimary:'#242424',scheme:'dark'},
  {id:'dark-grey',name:'Dark grey',bg:'#373737',panel:'#444444',raised:'#515151',line:'#686868',fg:'#ededed',muted:'#c4c4c4',primary:'#eeeeee',onPrimary:'#292929',scheme:'dark'},
  {id:'grey',name:'Grey',bg:'#737373',panel:'#656565',raised:'#818181',line:'#989898',fg:'#ffffff',muted:'#f0f0f0',primary:'#ffffff',onPrimary:'#303030',scheme:'dark'},
  {id:'light-grey',name:'Light grey',bg:'#d7d7d5',panel:'#e7e7e5',raised:'#f2f2f0',line:'#aaaaa8',fg:'#222322',muted:'#4e5150',primary:'#242525',onPrimary:'#f9f9f9',scheme:'light'},
  {id:'white',name:'White',bg:'#fafafa',panel:'#eeeeee',raised:'#e2e2e2',line:'#c9c9c9',fg:'#1a1a1a',muted:'#545454',primary:'#232323',onPrimary:'#ffffff',scheme:'light'},
  {id:'off-white',name:'Off-white',bg:'#f0eee7',panel:'#e5e2d8',raised:'#d8d5ca',line:'#bebbb1',fg:'#282621',muted:'#5d5951',primary:'#292723',onPrimary:'#f6f3e9',scheme:'light'},
  {id:'stone',name:'Stone',bg:'#bab2a6',panel:'#ccc4b9',raised:'#ded5ca',line:'#8d857b',fg:'#25231e',muted:'#4e483f',primary:'#292620',onPrimary:'#eae4da',scheme:'light'},
  {id:'midnight',name:'Midnight',bg:'#1c2630',panel:'#293541',raised:'#344451',line:'#50606c',fg:'#f1f2f3',muted:'#c1ccd4',primary:'#e0e7eb',onPrimary:'#1d252c',scheme:'dark'},
  {id:'slate',name:'Slate',bg:'#414b53',panel:'#4d5860',raised:'#5b666f',line:'#77828a',fg:'#f4f4f4',muted:'#d2d7d9',primary:'#ebebeb',onPrimary:'#293139',scheme:'dark'},
  {id:'sage',name:'Sage',bg:'#dce4d9',panel:'#edf0e8',raised:'#d0dacb',line:'#a7b6a1',fg:'#263325',muted:'#566853',primary:'#2b3929',onPrimary:'#f2f7ee',scheme:'light'},
  {id:'ivory-ink',name:'Ivory / Ink',bg:'#ede8dc',panel:'#f9f5ed',raised:'#dcd5c7',line:'#aaa399',fg:'#242c30',muted:'#526068',primary:'#25363b',onPrimary:'#f8f4eb',secondary:'#b9c5c2',accent:'#587a79',scheme:'light'},
  {id:'oxide-slate',name:'Oxide / Slate',bg:'#1f252a',panel:'#2e353b',raised:'#3e4b50',line:'#697578',fg:'#f7eee5',muted:'#c9c1b9',primary:'#d59a7b',onPrimary:'#252b31',secondary:'#514c47',accent:'#e0aa87',scheme:'dark'},
  {id:'olive-bone',name:'Olive / Bone',bg:'#252b23',panel:'#343c30',raised:'#474d3c',line:'#696f60',fg:'#f5f0df',muted:'#c8cbb9',primary:'#e1d7b9',onPrimary:'#222a23',secondary:'#6c7862',accent:'#c4ba8f',scheme:'dark'},
  {id:'blueprint',name:'Blueprint',bg:'#dce6ea',panel:'#eff4f5',raised:'#c9d6dd',line:'#94aab6',fg:'#1a303e',muted:'#456171',primary:'#20577b',onPrimary:'#f8fbfc',secondary:'#a8c4d2',accent:'#438bb5',scheme:'light'},
]

function readTheme(){try{const value=localStorage.getItem(CC_THEME_KEY);return CC_THEMES.find(p=>p.id===value)?.id||'charcoal'}catch{return 'charcoal'}}

export function useClothCraftTheme(){
  const [themeId,setThemeId]=useState(readTheme)
  const palette=CC_THEMES.find(p=>p.id===themeId)||CC_THEMES[2]
  useEffect(()=>{
    const el=document.documentElement
    el.dataset.ccTheme=palette.id
    el.dataset.ccScheme=palette.scheme
    for(const field of ['bg','panel','raised','line','fg','muted','primary'])el.style.setProperty(`--cc-${field}`,palette[field])
    el.style.setProperty('--cc-on-primary',palette.onPrimary)
    el.style.setProperty('--cc-accent',palette.accent||palette.primary)
    el.style.setProperty('--cc-secondary',palette.secondary||palette.raised)
    el.style.setProperty('--cc-on-secondary',palette.fg)
    el.style.colorScheme=palette.scheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette.bg)
  },[palette])
  useEffect(()=>{
    const change=event=>{if(event.key===CC_THEME_KEY)setThemeId(readTheme())}
    window.addEventListener('storage',change)
    return()=>window.removeEventListener('storage',change)
  },[])
  const change=id=>{
    if(!CC_THEMES.some(p=>p.id===id))return
    setThemeId(id)
    try{localStorage.setItem(CC_THEME_KEY,id)}catch{}
  }
  return {themeId,palette,change}
}

export function ThemePicker({themeId,onChange}){
  const [open,setOpen]=useState(false)
  const host=useRef(null)
  const choice=CC_THEMES.find(item=>item.id===themeId)
  useEffect(()=>{
    if(!open)return
    const away=event=>{if(!host.current?.contains(event.target))setOpen(false)}
    const escape=event=>{if(event.key==='Escape'){setOpen(false);host.current?.querySelector('.cc-circle-theme-trigger')?.focus()}}
    document.addEventListener('pointerdown',away)
    document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',escape)}
  },[open])
  return <div className="cc-circle-theme" ref={host}>
    <button type="button" className="cc-circle-theme-trigger" aria-label={`Theme: ${choice?.name||'Charcoal'}. Choose another theme`} aria-expanded={open} aria-haspopup="true" title="Change ClothCraft color theme" onClick={()=>setOpen(v=>!v)}><span aria-hidden="true">◐</span></button>
    {open&&<div className="cc-circle-theme-menu" role="group" aria-label="Choose color theme"><div className="cc-theme-title"><strong>COLOR THEME</strong><small>ClothCraft palettes</small></div><div className="cc-circle-theme-grid">{CC_THEMES.map(p=><button key={p.id} type="button" title={p.name} aria-label={`Use ${p.name} theme`} aria-pressed={themeId===p.id} onClick={()=>{onChange(p.id);setOpen(false)}}><span className="cc-theme-color" aria-hidden="true"><i style={{background:p.bg}}/><i style={{background:p.panel}}/><i style={{background:p.accent||p.primary}}/></span><span>{p.name}</span></button>)}</div><p>Uses the same color selections as ClothCraft.</p></div>}
  </div>
}

import React, {useState} from 'react'
import {
  Box, Grid2X2, Ruler, Scissors, Shirt, Sun, Layers3,
  PenLine, SlidersHorizontal, CircleDot, Sparkles, Link2,
  Settings2, Camera, Tag, Move3D, UserRound, Activity,
} from 'lucide-react'
import {BulletListIcon, OBJECT_HIERARCHY} from './CloUI.jsx'
import './ObjectBrowserCategoryRail.css'

const CATEGORY_ICONS = {
  '2D Pattern':Grid2X2,
  'Sewing':Scissors,
  '3D Form':Box,
  'Material':Shirt,
  'Environment':Sun,
}
const CHILD_ICONS = {
  'Pattern Pieces':Grid2X2,
  'Internal Lines':PenLine,
  'Grading & Measurements':Ruler,
  'Sewing Relationships':Link2,
  'Buttons':CircleDot,
  'Buttonholes':CircleDot,
  'Topstitch':Scissors,
  'Arrangement':Move3D,
  'Avatar':UserRound,
  'Simulation & Fit':Activity,
  'Fabric Editor':SlidersHorizontal,
  'Graphics & Texture':Sparkles,
  'Trims':Tag,
  'Studio Lighting':Sun,
  'Render Settings':Camera,
}

/**
 * The exact Object Browser three-bullet category selector, relocated into
 * the main two-column right-hand tools palette before the Scene button.
 * Expanding shows original categories and their nested actions as ordinary
 * side-rail icon slots. No floating menu covers the Object Browser.
 */
export default function ObjectBrowserCategoryRail({sceneButton,onChoose}) {
  const [open,setOpen]=useState(false)
  const [expanded,setExpanded]=useState('2D Pattern')
  const current=OBJECT_HIERARCHY.find(category=>category.title===expanded)
  return <>
    <button type="button" className={`clo-object-category-trigger ${open?'active':''}`}
      aria-label="Object Browser category list" aria-expanded={open} title="Object Browser categories"
      onClick={()=>setOpen(value=>!value)}><BulletListIcon/></button>
    {sceneButton}
    {open && <>
      {OBJECT_HIERARCHY.map(category=>{
        const Icon=CATEGORY_ICONS[category.title]||Layers3
        return <button key={category.title} type="button"
          className={`clo-object-category-choice ${expanded===category.title?'active':''}`}
          aria-label={category.title} title={category.title}
          aria-pressed={expanded===category.title} onClick={()=>setExpanded(category.title)}>
          <Icon size={19}/></button>
      })}
      {current?.children.map(([label,section,objectTab])=>{
        const Icon=CHILD_ICONS[label]||Settings2
        return <button key={label} type="button" className="clo-object-category-subtool"
          aria-label={label} title={label} onClick={()=>onChoose(section,objectTab)}>
          <Icon size={18}/></button>
      })}
    </>}
  </>
}

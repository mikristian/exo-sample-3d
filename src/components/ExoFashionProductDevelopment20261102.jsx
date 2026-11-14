import React, {useMemo, useState} from 'react'
import {buildExoFashionProductDevelopment20261102} from '../core/exoFashionProductDevelopment20261102.js'
import './ExoFashionProductDevelopment20261102.css'

const STEPS = ['Brief', 'Pattern', 'BOM', 'Cost / feasibility', 'Handoff']
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)
const label = piece => String(piece?.name || piece?.id || 'Unnamed pattern')

function geometry(piece) {
  const points = (Array.isArray(piece?.points) ? piece.points : []).filter(p => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
  if (points.length < 3) return null
  let twiceArea = 0
  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i+1) % points.length]
    twiceArea += number(a.x)*number(b.y)-number(b.x)*number(a.y)
    perimeter += Math.hypot(number(b.x)-number(a.x),number(b.y)-number(a.y))
  }
  const xs = points.map(p => number(p.x)), ys = points.map(p => number(p.y))
  return {id:piece.id,name:label(piece),vertices:points.length,areaCm2:Math.abs(twiceArea)/2,perimeterCm:perimeter,widthCm:Math.max(...xs)-Math.min(...xs),heightCm:Math.max(...ys)-Math.min(...ys)}
}

function exportJson(payload) {
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'exo-product-development-handoff.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function ExoFashionProductDevelopment20261102({pieces = [], selectedPiece, onSelectPiece, projectFabrics = [], seams = [], project}) {
  const [expanded,setExpanded] = useState(false)
  const [step,setStep] = useState(0)
  const [brief,setBrief] = useState({name:'New garment concept',type:'Hoodie',fit:'Relaxed',size:'M',description:'',targetPrice:'90',quantity:'50'})
  const [assumptions,setAssumptions] = useState({fabricPrice:'12',fabricWidth:'150',efficiency:'75',sewing:'7',trims:'2.5',packaging:'1',other:'1.5',markup:'2.5',seamAllowance:'1'})
  const [extraItems,setExtraItems] = useState([{id:'label',name:'Brand / care labels',quantity:'1',unitCost:'0.75'},{id:'thread',name:'Thread allowance',quantity:'1',unitCost:'0.35'}])
  const [notes,setNotes] = useState('')
  const [status,setStatus] = useState('')
  const measured = useMemo(() => (Array.isArray(pieces) ? pieces : []).map(geometry).filter(Boolean),[pieces])
  const totalArea = measured.reduce((sum,p)=>sum+p.areaCm2,0)
  const fabricMeters = totalArea > 0 ? totalArea / (Math.max(1,number(assumptions.fabricWidth))*100*Math.max(0.01,number(assumptions.efficiency)/100)) : 0
  const fabricCost = fabricMeters*number(assumptions.fabricPrice)
  const extrasCost = extraItems.reduce((sum,item)=>sum+Math.max(0,number(item.quantity))*Math.max(0,number(item.unitCost)),0)
  const unitCost = fabricCost + number(assumptions.sewing)+number(assumptions.trims)+number(assumptions.packaging)+number(assumptions.other)+extrasCost
  const retail = number(brief.targetPrice)
  const margin = retail > 0 ? 100*(retail-unitCost)/retail : null
  const engine = useMemo(() => buildExoFashionProductDevelopment20261102({
    project,
    retailPrice: Math.max(0,number(brief.targetPrice)),
    orderQuantity:Math.max(1,Math.trunc(number(brief.quantity,1))),
    materials:extraItems.filter(item=>number(item.quantity)>0).map(item=>({id:item.id,name:item.name||'Unnamed material',category:'trim',quantityPerUnit:number(item.quantity),unit:'each',costPerUnit:Math.max(0,number(item.unitCost))})),
    laborCostPerUnit:Math.max(0,number(assumptions.sewing)),
    otherCostPerUnit:Math.max(0,number(assumptions.trims)+number(assumptions.packaging)+number(assumptions.other)),
    fabricWidthsCm:Object.fromEntries([...new Set((project?.pieces||[]).map(piece=>piece.fabricId||'main'))].map(id=>[id,Math.max(1,number(assumptions.fabricWidth))])),
    fabricCostPerMeter:Object.fromEntries([...new Set((project?.pieces||[]).map(piece=>piece.fabricId||'main'))].map(id=>[id,Math.max(0,number(assumptions.fabricPrice))])),
  }),[project,brief.targetPrice,brief.quantity,extraItems,assumptions.sewing,assumptions.trims,assumptions.packaging,assumptions.other,assumptions.fabricWidth,assumptions.fabricPrice])
  const updateBrief = (key,value) => setBrief(current=>({...current,[key]:value}))
  const updateAssumption = (key,value) => setAssumptions(current=>({...current,[key]:value}))
  const makeHandoff = () => ({schema:'exo.product-development.v1',generatedAt:new Date().toISOString(),brief,pattern:{measurementUnits:'cm',coordinateSource:'current EXO project outlines',validPieces:measured,totalAreaCm2:totalArea,seamCount:Array.isArray(seams)?seams.length:0,selectedPieceId:selectedPiece?.id??null,seamAllowanceCm:number(assumptions.seamAllowance),verifiedProductionPattern:false},bom:{projectFabricEntries:Array.isArray(projectFabrics)?projectFabrics.map(f=>({id:f.id??null,name:f.name||f.label||'Project material'})):[],items:extraItems},engineReport:engine,costingAssumptions:assumptions,notes,limitations:['Outline coordinates are treated as centimeters; verify imported geometry units.','Native marker is a preliminary single-layer preview and requires manual review.','Cost and sewing assumptions are user estimates, not vendor quotations.','Handoff does not create or validate a factory-ready DXF or production tech pack.']})
  const field = (name,value,onChange,type='text',stepValue='any') => <label className="exo-fpd-field"><span>{name}</span><input type={type} step={type==='number'?stepValue:undefined} value={value} onChange={event=>onChange(event.target.value)}/></label>
  return <section className="exo-fpd" aria-label="EXO fashion product development">
    <header className="exo-fpd-header">
      <div><span className="exo-fpd-kicker">EXO / PRODUCT DEVELOPMENT</span><h3>Fashion Development Studio <span className="exo-fpd-beta">Preview</span></h3><p>Connect your garment brief to current pattern geometry, materials, costing and a documented handoff.</p></div>
      <button type="button" className="exo-fpd-launch" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?'Close workflow':'Open workflow'} <span aria-hidden="true">{expanded?'−':'↗'}</span></button>
    </header>
    <div className="exo-fpd-summary"><span><strong>{measured.length}</strong> valid project pieces</span><span><strong>{Array.isArray(seams)?seams.length:0}</strong> project seams</span><span><strong>{totalArea ? totalArea.toFixed(0) : '—'}</strong> cm² measured outline area</span></div>
    {expanded&&<>
      <nav className="exo-fpd-nodes" aria-label="Product development stages">{STEPS.map((name,index)=><button type="button" key={name} className={step===index?'exo-fpd-node is-active':'exo-fpd-node'} onClick={()=>setStep(index)} aria-current={step===index?'step':undefined}><span className="exo-fpd-node-index">{String(index+1).padStart(2,'0')}</span><span>{name}</span></button>)}</nav>
      <div className="exo-fpd-body">
      {step===0&&<><div className="exo-fpd-section-title"><h4>01 / Design brief</h4><p>Define the style and commercial target. These entries are editable planning inputs.</p></div><div className="exo-fpd-fields">{field('Working style name',brief.name,value=>updateBrief('name',value))}<label className="exo-fpd-field"><span>Garment type</span><select value={brief.type} onChange={event=>updateBrief('type',event.target.value)}>{['Hoodie','T-shirt','Jeans','Dress','Jacket','Pants','Skirt','Other'].map(type=><option key={type}>{type}</option>)}</select></label>{field('Fit / silhouette',brief.fit,value=>updateBrief('fit',value))}{field('Base sample size',brief.size,value=>updateBrief('size',value))}{field('Target retail · USD',brief.targetPrice,value=>updateBrief('targetPrice',value),'number')}{field('Planned order quantity',brief.quantity,value=>updateBrief('quantity',value),'number','1')}</div><label className="exo-fpd-field exo-fpd-wide"><span>Construction, mood, special features and constraints</span><textarea rows="3" value={brief.description} onChange={event=>updateBrief('description',event.target.value)} placeholder="Example: cropped fit, raised padded applique, heavy cotton french terry, zipper specifications…"/></label></>}
      {step===1&&<><div className="exo-fpd-section-title"><h4>02 / Current pattern evidence</h4><p>Real outline measurements from this open EXO project. Geometry is not drafted from the text brief automatically.</p></div><div className="exo-fpd-measure-note">Measured from project outlines (assumed centimeters). Verify scale and dimensions after DXF/SVG import.</div>{measured.length?<div className="exo-fpd-patterns">{measured.map(piece=><button type="button" key={piece.id} className="exo-fpd-pattern-row" onClick={()=>onSelectPiece?.(piece.id)}><strong>{piece.name}</strong><span>{piece.widthCm.toFixed(1)} × {piece.heightCm.toFixed(1)} cm</span><span>{piece.areaCm2.toFixed(0)} cm²</span><small>{piece.vertices} vertices</small>{selectedPiece?.id===piece.id&&<b>Selected</b>}</button>)}</div>:<p className="exo-fpd-empty">No measurable current pattern pieces. Import or open a garment template in the Patterns Library to populate this stage.</p>}<div className="exo-fpd-fields">{field('Planned seam allowance · cm (estimate)',assumptions.seamAllowance,value=>updateAssumption('seamAllowance',value),'number')}</div><p className="exo-fpd-subtle">Seam allowance is only recorded as an assumption. It is not applied to outlines. Use the existing EXO pattern editing and export tools to modify or export actual geometry.</p></>}
      {step===2&&<><div className="exo-fpd-section-title"><h4>03 / Bill of materials</h4><p>Start with the current project's referenced materials and edit quantities or estimated costs for trims.</p></div><div className="exo-fpd-materials">{Array.isArray(projectFabrics)&&projectFabrics.length?projectFabrics.map((fabric,index)=><div key={fabric.id||index}><strong>{fabric.name||fabric.label||'Project fabric'}</strong><span>Referenced in current project · price requires verification</span></div>):<p>No saved project fabrics identified. Assign materials in EXO's Fabric Library.</p>}</div><div className="exo-fpd-table-head"><span>BOM line</span><span>Qty / unit</span><span>USD / unit</span><span></span></div>{extraItems.map(item=><div key={item.id} className="exo-fpd-bom-row"><input aria-label="BOM material" value={item.name} onChange={event=>setExtraItems(items=>items.map(row=>row.id===item.id?{...row,name:event.target.value}:row))}/><input aria-label={item.name+' quantity'} type="number" min="0" step="0.1" value={item.quantity} onChange={event=>setExtraItems(items=>items.map(row=>row.id===item.id?{...row,quantity:event.target.value}:row))}/><input aria-label={item.name+' unit cost'} type="number" min="0" step="0.01" value={item.unitCost} onChange={event=>setExtraItems(items=>items.map(row=>row.id===item.id?{...row,unitCost:event.target.value}:row))}/><button type="button" aria-label={'Remove '+item.name} onClick={()=>setExtraItems(items=>items.filter(row=>row.id!==item.id))}>×</button></div>)}<button type="button" className="exo-fpd-secondary" onClick={()=>setExtraItems(items=>[...items,{id:'bom-'+Date.now(),name:'New material',quantity:'1',unitCost:'0'}])}>+ Add BOM line</button><p className="exo-fpd-subtle">Separate line items are estimates unless validated with supplier pricing and consumption.</p></>}
      {step===3&&<><div className="exo-fpd-section-title"><h4>04 / Estimate and feasibility</h4><p>Native EXO geometry QA, marker placement and editable commercial assumptions.</p></div><div className="exo-fpd-fields">{field('Fabric cost · USD/m',assumptions.fabricPrice,value=>updateAssumption('fabricPrice',value),'number')}{field('Usable fabric width · cm',assumptions.fabricWidth,value=>updateAssumption('fabricWidth',value),'number')}{field('Sewing labor · USD/unit',assumptions.sewing,value=>updateAssumption('sewing',value),'number')}{field('Other trims · USD/unit',assumptions.trims,value=>updateAssumption('trims',value),'number')}{field('Packaging · USD/unit',assumptions.packaging,value=>updateAssumption('packaging',value),'number')}{field('Other costs · USD/unit',assumptions.other,value=>updateAssumption('other',value),'number')}</div><div className="exo-fpd-figures"><div><small>Native marker yield</small><strong>{engine.markers.length&&engine.markers.every(m=>m.complete)?engine.markers.reduce((sum,m)=>sum+m.lengthMeters,0).toFixed(2)+' m':'Pending placement'}</strong></div><div><small>Estimated unit cost</small><strong>{engine.costing.totalCostPerUnit===null?'Incomplete':money(engine.costing.totalCostPerUnit)}</strong></div><div><small>Estimated order cost</small><strong>{engine.costing.orderCost===null?'Incomplete':money(engine.costing.orderCost)}</strong></div><div><small>Indicative gross margin</small><strong>{engine.costing.grossMarginPercent===null?'—':engine.costing.grossMarginPercent.toFixed(1)+'%'}</strong></div></div><div className="exo-fpd-measure-note"><strong>Native feasibility: {engine.status.replace('_',' ')} · {engine.feasibility.score}/100</strong><div>{engine.markers.map(marker=><p key={marker.fabricId}>Fabric {marker.fabricId}: {marker.placedPieces}/{marker.requestedPieces} placed · {Math.round(marker.efficiency*100)}% marker efficiency · {marker.lengthMeters.toFixed(2)} m</p>)}</div>{engine.blockers.map((issue,i)=><p key={'b'+i}>Needs correction: {issue.message}</p>)}{engine.warnings.map((issue,i)=><p key={'w'+i}>Review: {issue.message}</p>)}</div><p className="exo-fpd-subtle">Single-layer native marker estimates require confirmation for shrinkage, grain, lay planning, supplier pricing, construction and production tolerances. No factory approval is implied.</p></>}
      {step===4&&<><div className="exo-fpd-section-title"><h4>05 / Production handoff</h4><p>Export a reviewable snapshot with actual EXO marker QA, BOM, costing and open approvals.</p></div><label className="exo-fpd-field exo-fpd-wide"><span>Production notes, sourcing questions, open approvals</span><textarea rows="5" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Record fabrication notes, grading decisions, supplier questions and sampling approvals."/></label><div className="exo-fpd-handoff-list"><div><strong>Brief</strong><span>{brief.name} · {brief.type} · {brief.fit}</span></div><div><strong>Pattern reference</strong><span>{measured.length} measured pieces; {Array.isArray(seams)?seams.length:0} project seams</span></div><div><strong>Native review status</strong><span>{engine.status} · {engine.blockers.length} blockers · {engine.warnings.length} warnings</span></div>{engine.handoff.checklist.map(item=><div key={item.id}><strong>{item.label}</strong><span>{item.complete?'Recorded complete':'Review required'}</span></div>)}</div><button type="button" className="exo-fpd-primary" onClick={()=>{try{exportJson(makeHandoff());setStatus('JSON handoff downloaded.')}catch(error){setStatus('Export failed: '+error.message)}}}>Export development handoff (.json)</button>{status&&<p role="status" className="exo-fpd-subtle">{status}</p>}<p className="exo-fpd-subtle">This export includes native EXO assessment and unverified inputs. It is not a DXF or a certified factory tech pack.</p></>}
      </div><footer className="exo-fpd-footer"><span>Live project outlines + editable planning estimates</span><div><button type="button" disabled={step===0} onClick={()=>setStep(n=>Math.max(0,n-1))}>Previous</button><button type="button" disabled={step===STEPS.length-1} onClick={()=>setStep(n=>Math.min(STEPS.length-1,n+1))}>Next stage →</button></div></footer>
    </>}
  </section>
}

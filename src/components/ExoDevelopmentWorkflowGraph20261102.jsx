import React,{useMemo,useState} from 'react'
import {buildExoDevelopmentWorkflowGraph20261102} from '../core/exoDevelopmentWorkflowGraph20261102.js'
import './ExoDevelopmentWorkflowGraph20261102.css'

function downloadReport(graph) {
  const file = new Blob([JSON.stringify(graph,null,2)],{type:'application/json'})
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = 'exo-development-workflow-review.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function ExoDevelopmentWorkflowGraph20261102({project,onOpenTechPack}) {
  const [expanded,setExpanded] = useState(false)
  const [selected,setSelected] = useState('pattern')
  const [message,setMessage] = useState('')
  const graph = useMemo(()=>buildExoDevelopmentWorkflowGraph20261102(project),[project])
  const current = graph.nodes.find(node=>node.id===selected) || graph.nodes[1]
  const openStage = node => {
    if(node.id==='techpack' && onOpenTechPack) {
      onOpenTechPack()
      setMessage('Opened the existing Tech Pack workspace for editing.')
      return
    }
    const studio = document.querySelector('.exo-fpd')
    if(!studio) {setMessage('Open the Patterns Library to access Fashion Development Studio.');return}
    const opener = studio.querySelector('.exo-fpd-launch')
    if(opener?.getAttribute('aria-expanded')==='false') opener.click()
    // Studio stage navigation renders after its panel expands.
    requestAnimationFrame(()=>{
      const buttons=studio.querySelectorAll('.exo-fpd-nodes button')
      buttons[node.studioStep]?.click()
      studio.scrollIntoView({behavior:'smooth',block:'start'})
    })
    setMessage(`Opened Fashion Development Studio: ${node.title}.`)
  }
  return <section className="exo-dwg" aria-label="EXO development workflow graph">
    <header className="exo-dwg-header">
      <div><small>EXO / DEVELOPMENT PIPELINE</small><h3>Connected workflow <span>Live project evidence</span></h3><p>Inspect dependencies, review native checks and continue work in the corresponding studio.</p></div>
      <button type="button" className="exo-dwg-toggle" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?'Close graph':'Open graph'}</button>
    </header>
    <div className="exo-dwg-counts"><span>{graph.nodes.filter(node=>node.status==='blocked').length} blocked</span><span>{graph.nodes.filter(node=>node.status==='missing'||node.status==='incomplete').length} missing / incomplete</span><span>{graph.report.geometry.pieceCount} pattern pieces</span></div>
    {expanded&&<><div className="exo-dwg-graph" aria-label="Select a workflow node">
      {graph.nodes.map((node,index)=><React.Fragment key={node.id}>{index>0&&<span className="exo-dwg-edge" aria-hidden="true">→</span>}<button type="button" aria-pressed={current.id===node.id} className={`exo-dwg-node ${current.id===node.id?'selected':''}`} onClick={()=>{setSelected(node.id);setMessage('')}}><span className="exo-dwg-index">{String(index+1).padStart(2,'0')}</span><strong>{node.title}</strong><small>{node.status.replaceAll('_',' ')}</small></button></React.Fragment>)}
    </div><div className="exo-dwg-inspector">
      <div className="exo-dwg-inspector-head"><h4>{current.title} / Inspector</h4><span>{current.status.replaceAll('_',' ')}</span></div>
      <p>Depends on: {current.dependsOn.length?current.dependsOn.map(id=>graph.nodes.find(node=>node.id===id)?.title).join(', '):'Starting stage'}</p>
      <ul>{current.evidence.map((item,index)=><li key={index}>{item}</li>)}{current.issues.slice(0,5).map((issue,index)=><li key={'issue'+index}>{issue.message}</li>)}</ul>
      <div className="exo-dwg-actions"><button type="button" onClick={()=>openStage(current)}>{current.action} ↗</button><button type="button" onClick={()=>{try{downloadReport(graph);setMessage('Workflow report exported.')}catch(error){setMessage(`Export failed: ${error.message}`)}}}>Export evidence JSON</button></div>
      {message&&<p role="status" className="exo-dwg-message">{message}</p>}
      <p className="exo-dwg-disclaimer">Statuses reflect existing project evidence and native estimates. Physical fit, supplier prices and production approvals remain open until independently verified.</p>
    </div></>}
  </section>
}

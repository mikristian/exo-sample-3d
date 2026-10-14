import React, { useEffect, useState } from 'react'
import CadToolIcon from './CadToolIcon.jsx'
import { MoreHorizontal } from 'lucide-react'

// A 34-slot, original-icon workspace palette. This inventory is not a claim
// that the proprietary CLO toolbar contains exactly these controls, nor that
// unfinished features work. Planned commands are explicitly disabled.
export const RIGHT_PALETTE_TOOLS = [
  ['select-3d','Select and transform 3D fabric','transform'],
  ['move-3d','Move 3D fabric','move'],
  ['rotate-3d','Rotate 3D fabric','rotate'],
  ['hand','Fabric hand','hand'],
  ['surface','Surface / strain view','analysis'],
  ['wireframe','Toggle mesh wireframe','wireframe'],
  ['seam-links','3D sewing correspondence','seams'],
  ['select-2d','2D pattern select','select'],
  ['points','Edit pattern points','point'],
  ['split','Split pattern edge','split'],
  ['curve','Adjust pattern curve','curve'],
  ['internal','Internal line / dart','internal'],
  ['notch','Pattern notch','notch'],
  ['measure','Tape measure / ruler','measure'],
  ['pin','Cloth pin','pin'],
  ['sew','Free sewing','sew'],
  ['fastener','Button or snap fastener','fastener'],
  ['fabric','Fabric browser','Fabric'],
  ['graphics','Graphic browser','Graphic'],
  ['buttons','Button browser','Button'],
  ['buttonholes','Buttonhole browser','Buttonhole'],
  ['topstitch','Topstitch browser','Topstitch'],
  ['trim','Trims / zipper','Trim'],
  ['grading','Grading browser','Grading'],
  ['pom','Points of measure','POM'],
  ['scene','Scene hierarchy','Scene'],
  ['material','Fabric physical properties','fabric-edit'],
  ['fit','Fit analysis','fit'],
  ['simulate','Simulate / pause','simulate'],
  ['reset','Reset flat arrangement','reset'],
  ['camera','Fit 3D view','camera'],
  ['mirror','Create mirrored pattern copy','mirror-pattern'],
  ['export','Export garment file','export'],
  ['seam-weld','Physical seam-closure tool',null],
]

// Workflows affect the *layout*, not the underlying editing actions. Every
// original command remains accessible in All tools, including planned/disabled
// functionality. An action appears in exactly one group within a workflow.
const FOCUSED_GROUPS = {
  Pattern: [
    ['DRAFT', ['select-2d','points','split','curve','internal','notch','measure','mirror']],
    ['ON BODY', ['select-3d','move-3d','rotate-3d','hand','camera']],
    ['DISPLAY', ['scene','seam-links','wireframe']],
  ],
  Sewing: [
    ['SEW & ATTACH', ['sew','seam-links','pin','fastener','buttons','buttonholes','topstitch','trim']],
    ['PATTERN', ['select-2d','points','measure']],
    ['SIMULATION', ['simulate','reset','camera']],
  ],
  Fabric: [
    ['MATERIALS', ['fabric','material','graphics','trim']],
    ['INSPECT', ['select-3d','hand','surface','wireframe','camera']],
    ['SIMULATION', ['simulate','reset']],
  ],
  Avatar: [
    ['VIEW AVATAR', ['select-3d','move-3d','rotate-3d','hand','camera']],
    ['DISPLAY', ['scene','surface','wireframe','seam-links']],
    ['FIT', ['fit','simulate','reset']],
  ],
  Fit: [
    ['ANALYZE', ['surface','wireframe','seam-links','fit']],
    ['SIMULATION', ['simulate','reset']],
    ['VIEW', ['select-3d','move-3d','hand','camera']],
  ],
  Production: [
    ['PRODUCTION', ['grading','pom','measure','export']],
    ['DRAFT', ['select-2d','points','split','curve','mirror']],
    ['SCENE', ['scene','camera']],
  ],
  Render: [
    ['CAMERA & VIEW', ['select-3d','hand','camera','surface','wireframe']],
    ['PROJECT', ['scene','fabric','graphics','export']],
  ],
}
const ALL_GROUPS = [
  ['3D GARMENT', ['select-3d','move-3d','rotate-3d','hand','surface','wireframe','seam-links']],
  ['2D PATTERN', ['select-2d','points','split','curve','internal','notch','measure','pin','mirror']],
  ['SEWING', ['sew','fastener','buttons','buttonholes','topstitch','trim','seam-weld']],
  ['BROWSERS', ['fabric','graphics','grading','pom','scene','material','fit']],
  ['RUN & EXPORT', ['simulate','reset','camera','export']],
]
// CLO Creator's Field Guide (2022), p.146: pattern transforms and point/curve
// edits precede internal markings, sewing and finishing. The app implements a
// subset. These lists deliberately retain all 34 existing actions rather than
// relabeling unrelated features as CLO-only commands.
export const CLO_REFERENCE_LEFT_COLUMN = [
  'select-2d','points','curve','split','internal','mirror','notch','measure',
  'grading','pom','scene','fabric','material','graphics','camera','fit','export',
]
export const CLO_REFERENCE_RIGHT_COLUMN = [
  // Sewing leads the second 2D strip. Existing 3D controls are retained at
  // the bottom as compatibility actions pending a complete CLO command set.
  'seam-links','sew','seam-weld','topstitch','fastener','buttons','buttonholes',
  'trim','pin','simulate','reset','select-3d','move-3d','rotate-3d',
  'hand','surface','wireframe',
]
const TOOL_BY_ID = new Map(RIGHT_PALETTE_TOOLS.map(item => [item[0], item]))
const WORKFLOW_TABS = [
  ['Pattern', 'select-2d'],
  ['Sewing', 'sew'],
  ['Fabric', 'fabric'],
  ['Fit', 'fit'],
]
// v2 defaults to the complete CLO-inspired 34-slot palette, matching the
// requested desktop workspace. Compact workflow subsets remain optional.
const MODE_KEY = 'garment-studio-right-tools-mode-v2'

export default function RightToolPalette({ activeSection, viewportTool, tool, setViewportTool, setTool, setActiveSection, setObjectTab, onRevealBrowser, showSewingGuides, setShowSewingGuides, wireframe, setWireframe, analysisMode, setAnalysisMode, toggleSimulation, resetSimulation, exportProject, onFitCamera, onMirrorSelected, running }) {
  const [showAll, setShowAll] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) !== 'focused' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, showAll ? 'all' : 'focused') } catch { /* private mode */ }
  }, [showAll])
  const activateWorkflow = (section) => {
    setActiveSection(section)
    setObjectTab(section === 'Fabric' ? 'Fabric' : 'Scene')
    onRevealBrowser?.()
  }
  const click = (action) => {
    if (['orbit','transform','move','rotate','hand'].includes(action)) return setViewportTool(action)
    if (['select','point','split','curve','internal','notch','measure','pin','sew','fastener'].includes(action)) {
      setTool(action)
      if (action === 'sew' || action === 'fastener') setActiveSection('Sewing')
      else setActiveSection('Pattern')
      return
    }
    if (['Scene','Fabric','Graphic','Button','Buttonhole','Topstitch','Trim','Grading','POM'].includes(action)) {
      setObjectTab(action)
      onRevealBrowser?.()
      setActiveSection(action === 'Fabric' || action === 'Graphic' ? 'Fabric' : ['Button','Buttonhole','Topstitch','Trim'].includes(action) ? 'Sewing' : ['Grading','POM'].includes(action) ? 'Production' : 'Pattern')
      return
    }
    if (action === 'analysis') return setAnalysisMode(analysisMode === 'strain' ? 'surface' : 'strain')
    if (action === 'wireframe') return setWireframe(!wireframe)
    if (action === 'seams') return setShowSewingGuides(!showSewingGuides)
    if (action === 'fabric-edit') { setObjectTab('Fabric'); onRevealBrowser?.(); return setActiveSection('Fabric') }
    if (action === 'fit') return setActiveSection('Fit')
    if (action === 'simulate') return toggleSimulation()
    if (action === 'reset') return resetSimulation()
    if (action === 'export') return exportProject()
    if (action === 'camera') return onFitCamera?.()
    if (action === 'mirror-pattern') return onMirrorSelected?.()
  }
  const active = (action) => action === viewportTool || (action === tool && (activeSection === 'Pattern' || activeSection === 'Sewing')) || (action === 'wireframe' && wireframe) || (action === 'seams' && showSewingGuides) || (action === 'analysis' && analysisMode === 'strain') || (action === 'simulate' && running)
  const groups = showAll ? ALL_GROUPS : (FOCUSED_GROUPS[activeSection] || FOCUSED_GROUPS.Pattern)
  const visibleCount = groups.reduce((count, [, ids]) => count + ids.length, 0)
  const renderAction = (id) => {
    const item = TOOL_BY_ID.get(id)
    if (!item) return null
    const [itemId, label, action] = item
    return <button key={itemId} type="button" title={action ? label : `${label} · planned`} aria-label={label} aria-pressed={Boolean(action && active(action))} disabled={!action} className={active(action) ? 'active' : ''} onClick={() => click(action)}><CadToolIcon id={itemId} size={20}/></button>
  }
  return <nav className="clo-right-tool-palette" aria-label="Right workspace tools">
    <div className="clo-tool-palette-label"><span className="clo-palette-workflow-title" title={showAll ? 'All workspace tools' : activeSection}>{showAll ? 'ALL' : activeSection.toUpperCase()}</span><button type="button" className={showAll ? 'active' : ''} aria-label={showAll ? 'Show focused tools' : 'Show all tools'} aria-pressed={showAll} title={showAll ? 'Show focused tools for this workspace' : 'Show all 34 workspace tools'} onClick={() => setShowAll(value => !value)}><MoreHorizontal size={15}/></button></div>
    <div className="clo-palette-workflows" aria-label="Quick workflow switching">
      {WORKFLOW_TABS.map(([section, iconId]) => <button key={section} type="button" aria-label={`Switch to ${section} tools`} aria-pressed={activeSection === section} title={`${section} tools`} className={activeSection === section ? 'active' : ''} onClick={() => activateWorkflow(section)}><CadToolIcon id={iconId} size={19}/></button>)}
    </div>
    <div className="clo-palette-scroll" aria-live="off">
      {showAll ? <div className="clo-reference-dual-bars" aria-label="CLO-inspired independent drafting and sewing tool columns">
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO left drafting bar">{CLO_REFERENCE_LEFT_COLUMN.map(renderAction)}</div>
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO right sewing and fabric bar">{CLO_REFERENCE_RIGHT_COLUMN.map(renderAction)}</div>
      </div> : groups.map(([name, ids]) => <div className="clo-palette-group" key={name}>
        <div className="clo-palette-group-label" title={name}>{name}</div>
        <div className="clo-right-tool-grid">{ids.map(renderAction)}</div>
      </div>)}
    </div>
    <div className="clo-palette-count" title={`${visibleCount} tools in view, ${RIGHT_PALETTE_TOOLS.length} in total`}>{visibleCount}<span>/{RIGHT_PALETTE_TOOLS.length}</span></div>
  </nav>
}

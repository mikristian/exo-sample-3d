import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowRight,AudioLines,Check,Compass,Grip,ImagePlus,Mic,MicOff,Move,PanelBottom,PanelLeft,PanelRight,PanelTop,Send,Volume2,VolumeX,X,Play,Pause,BookOpen,Settings2,Music2,PanelsTopLeft} from 'lucide-react'
import CircleEyes from '../../website/clothcraft-characters/components/CircleEyes.jsx'
import {CIRCLE_PRESETS} from '../../website/clothcraft-characters/components/circleEyeData.js'
import {resolveExoGuide20261102} from '../core/exoAssistantGuides20261102.js'
import {EXO_GARMENTS_20261102,interpretExoCompanionWorkflow20261102,listExoCompanionWorkflows20261102,resolveExoCompanionWorkflow20261102,readExoCompanionCustomWorkflows20261102,saveExoCompanionCustomWorkflows20261102,advanceExoCompanionWorkflow20261102} from '../core/exoCompanionWorkflow20261102.js'
import {createCompanionVoice} from '../core/exoCompanionVoice20261102.js'
import {interpretExoFashionTeeCommand} from '../core/exoFashionPatternEdits20261102.js'
import {classifyExoCompanionCommand,executeExoCompanionWorkflowStep20261102} from '../core/exoCompanionCommands20261102.js'
import {answerExoToolQuestion20261102} from '../core/exoToolTutor20261102.js'
import {executeExoCompanionProviderProposal20261102} from '../core/exoCompanionProviderOrchestrator20261102.js'
import {executeExoCompanionAnimatedAction20261102} from '../core/exoCompanionActionAnimation20261102.js'
import {interpretExoFashionIntent} from '../core/exoFashionIntent20261102.js'
import {EXO_COMPANION_TOUR_MODES,createExoCompanionGroove} from '../core/exoCompanionExperience20261102.js'
import {STUDIO_THEME_PRESETS} from '../core/studioThemePresets.js'
import {classifyExoThemeRequest20261102} from '../core/exoCompanionThemeIntelligence20261102.js'
import {interpretExoAppQuestion20261102} from '../core/exoCompanionAppIntelligence20261102.js'
import {diagnoseExoGarment20261102} from '../core/exoGarmentIntelligence20261102.js'
import {planExoAssistantRequest20261102} from '../core/exoAssistantPlanner20261102.js'
import {EXO_COMPANION_SPECIALISTS_20261102} from '../core/exoCompanionSpecialists20261102.js'
import {getExoCompanionDockDrop20261102} from '../core/exoCompanionDockDrop20261102.js'
import {createExoCompanionPatternConversation20261102,handleExoCompanionPatternTurn20261102} from '../core/exoCompanionPatternConversation20261102.js'
import {interpretExoSketchFile20261102} from '../core/exoSketchPatternInterpreter20261102.js'
import {interpretExoGarmentPhotoFile20261102} from '../core/exoGarmentPhotoReference20261102.js'
import {analyzeLocalGarmentPhotoWithVision20261102,reviewLocalPhotoVision20261102} from '../core/exoLocalPhotoVisionClient20261102.js'
import ExoCompanionPatternReview20261102 from './ExoCompanionPatternReview20261102.jsx'
import {EXO_COMPANION_CHARACTER_DEFAULTS_20261102,EXO_COMPANION_CHARACTER_MOVEMENT_OPTIONS_20261102,EXO_COMPANION_CHARACTER_EYE_SHAPE_OPTIONS_20261102,EXO_COMPANION_CHARACTER_IRIS_OPTIONS_20261102,normalizeExoCompanionCharacterPreferences20261102,readExoCompanionCharacterPreferences20261102,saveExoCompanionCharacterPreferences20261102,toExoCompanionCircleEyesSettings20261102} from '../core/exoCompanionCharacterPreferences20261102.js'
import './ExoAppCharacterAssistant20261102.css'

// Familiar original EXO eyes, with a fluid body and no pointing hand or staged slide tutorial.
const avatar={...CIRCLE_PRESETS[0],color:'#111317',eyeColor:'#d9ed74',irisColor:'#6c4ddc',leftIrisColor:'#6c4ddc',rightIrisColor:'#20bacc',eyeMode:'independent',iris:'slit',pupilVisible:false,glint:false,accessories:[],tattooLibrary:[]}
const TARGETS={pattern:'pattern',material:'fabric-tool',fabric:'fabric-tool',grading:'grading-tool',techpack:'techpack-window',search:'command-search',save:'save',workspace:'workspace',sewing:'2d-canvas',avatar:'3d-canvas',fit:'3d-canvas',render:'3d-canvas',animation:'3d-canvas',library:'library-window',settings:'settings-window',print:'print-layout-window',widgets:'widget-window'}
const TOPICS={
 pattern:{title:'Pattern drafting',target:'pattern',navigate:'pattern',reply:'This Pattern control opens your drafting tools. You can draw and adjust garment pieces in 2D, then inspect them in 3D. If you want to make your first pattern, what are you designing: a T-shirt, hoodie, or pants?'},
 material:{title:'Fabric and materials',target:'fabric-tool',navigate:'fabric',reply:'Fabric controls let you inspect and change material properties for the garment. You can compare weight, appearance, and assigned materials. Want to try cotton, denim, or something else?'},
 grading:{title:'Size grading',target:'grading-tool',navigate:'grading',reply:'Grading builds other sizes from a base pattern. This control opens the grading area. Choose your base size and check the measurements and seam relationships before export. Would you like to work on a size range?'},
 techpack:{title:'Tech packs',target:'workspace-modes',navigate:'techpack',reply:'Tech packs bring the design specifications together: measurements, materials, construction, and production notes. I can take you into the workspace, then explain the section you want to work on.'},
 basics:{title:'Getting around EXO',target:'pattern',navigate:'pattern',reply:'This is your design studio. Pattern is where you draft, Fabric is where you explore materials, and the workspace menus take you into specialized tools. Point at any button and I can tell you what it does. Want to start with a T-shirt, hoodie, or pants?'}
}
const STARTERS=['Make my first T-shirt','Show me the Pattern tools','Explain what this button does','Explore the interface']
const TUTORIAL_OPTIONS=[['full','Full EXO Tour'],['theme','Themes & colors'],['pattern','Pattern drafting'],['sewing','Sewing & construction'],['grading','Grading & sizes'],['fabric','Fabric & fit'],['avatar','Avatars'],['3d','3D & simulation'],['render','Rendering'],['animation','Animation'],['techpack','Tech pack'],['print','Pattern printing'],['library','File Library'],['widgets','Widget Studio'],['navigation','Navigation & AI']]
const THEME_GUIDE_SELECTORS={
 'theme-active':'.studio-active-palette-copy',
 'theme-presets':'#studio-theme-presets h4',
 'theme-search':'#studio-theme-presets .studio-theme-search',
 'theme-icons':'#studio-theme-icon-colors h4',
 'theme-custom':'#studio-theme-custom-palettes h4',
 'theme-saved':'#studio-theme-saved h5',
 'theme-daynight':'#studio-theme-day-night h4',
 'theme-contrast':'#studio-theme-audit h4',
}
const CONTROLS={
 'pattern':TOPICS.pattern.reply,
 'fabric-tool':TOPICS.material.reply,
 'grading-tool':TOPICS.grading.reply,
 'workspace-modes':'This menu opens other workspaces, including animation, simulation and technical documentation. What would you like to work on?',
 'command-search':'Search helps you find tools and commands without memorizing their location. I can show you the search field if you like.',
 'save':'This saves the current project. I can point to it, and I will only save when you ask me to.',
 'assistant-launch':'This opens our conversation. You can speak, type, or have me describe any tool you point at.',
 'workspace':'This control changes your active workspace. Each workspace groups tools for a different part of the garment design process.'
}
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max))
const getControl=target=>{
 if(!target)return null
 if(THEME_GUIDE_SELECTORS[target]){
  return document.querySelector(THEME_GUIDE_SELECTORS[target])||null
 }
 const windows={
  'print-layout-window':'.exo-legacy-print-viewport,.exo-print-viewport,.exo-print-paper-pages',
  '3d-canvas':'.cc-viewport-3d,.clo-viewport-3d,.viewport-shell,.three-mount,.viewport-3d',
  'techpack-window':'.tpws-native-canvas,.tpws-center,.tpws-root,.dtp-panel,[data-focus-workspace="techpack"] .center-panel',
  'settings-window':'.studio-settings-dialog',
  'widget-window':'.exo-cws',
  'library-window':'.exo-files,.clo-library-panel,.clo-library-top,.asset-browser,.file-library-overlay',
  '2d-canvas':'.cc-viewport-2d,.pattern-editor-shell,.clo-viewport-2d,.pattern-canvas',
 }
 if(windows[target]){
  return [...document.querySelectorAll(windows[target])].find(el=>{
   const r=el.getBoundingClientRect()
   return r.width>145&&r.height>105&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight
  })||null
 }
 return [...document.querySelectorAll(`[data-exo-guide-target="${target}"]`)].find(el=>{
  const r=el.getBoundingClientRect()
  return r.width>10&&r.height>10&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0
 })||null
}
const escapeSpoken=text=>String(text||'').replace(/\s+/g,' ').slice(0,850)
const DOCKS=[{id:'left',label:'Dock left',Icon:PanelLeft},{id:'right',label:'Dock right',Icon:PanelRight},{id:'top',label:'Dock top',Icon:PanelTop},{id:'bottom',label:'Dock bottom',Icon:PanelBottom},{id:'center-wide',label:'Center wide',Icon:PanelsTopLeft}]
const DOCK_HOVER_MS=550
const preciseDockTarget=(x,y)=>{
 const targets=document.querySelectorAll('.exo-ai-dock-target')
 for(const element of targets){
  const rect=element.getBoundingClientRect()
  // Only the visible label is an intentional drop target; the shaded zone is a guide.
  const label=element.querySelector('span')?.getBoundingClientRect()
  const hit=label||rect
  const margin=12
  if(x>=hit.left-margin&&x<=hit.right+margin&&y>=hit.top-margin&&y<=hit.bottom+margin){
   return DOCKS.find(item=>element.classList.contains(`exo-ai-dock-target--${item.id}`))?.id||null
  }
 }
 return null
}
const getDockDrop=(x,y)=>{
 const shell=document.getElementById('exo-pattern-glass-shell')
 const shellRect=shell?.getBoundingClientRect()
 const viewport=[...document.querySelectorAll('.cc-viewport-2d,.pattern-editor-shell,.clo-viewport-2d,.pattern-canvas,.cc-viewport-3d,.clo-viewport-3d,.viewport-shell')].find(element=>{
  const bounds=element.getBoundingClientRect()
  return bounds.width>170&&bounds.height>120
 })?.getBoundingClientRect()||shellRect
 return getExoCompanionDockDrop20261102({pointer:{x,y},shell:shellRect,viewport,bounds:{left:0,top:0,width:innerWidth,height:innerHeight}})
}
const TOOL_MEANINGS=[
 [/select|pointer|move/i,'This selects and moves items in your design. Select a pattern piece before editing its geometry.'],
 [/curve|bezier/i,'This adjusts a drafted curve. Designers use curves for armholes, necklines, waist shaping and other smooth edges.'],
 [/split edge|add point/i,'This adds a point along an existing edge, allowing finer control of the pattern outline.'],
 [/polygon|add pattern/i,'This creates a new editable pattern outline in the 2D workspace.'],
 [/notch/i,'Notches help align cut fabric pieces when sewing and assembling a garment.'],
 [/measure|ruler|tape/i,'This measures distances on the pattern so you can check garment dimensions.'],
 [/seam|stitch|sew/i,'This opens sewing or seam tools. Sewing relationships tell the garment simulator which edges join.'],
 [/grading|grade|size/i,'Grading lets you develop multiple sizes from a base pattern while checking the intended measurements.'],
 [/fabric|material/i,'This opens the material controls used to choose fabrics and inspect their properties.'],
 [/pattern/i,'This opens or edits the 2D pattern. You can adjust panels, curves, seam allowances and measurements.'],
 [/simulation|drape|fit/i,'This opens fitting or cloth simulation tools. Virtual fit still needs physical validation.'],
 [/save/i,'This saves your project. I will only make a save action when you request it.'],
 [/undo/i,'Undo reverses your last editable change.'],
 [/redo/i,'Redo reapplies an undone change.'],
 [/search/i,'Search finds commands and tools without needing to know which menu contains them.'],
]
const explainTool=(element,id)=>{
 if(id&&CONTROLS[id])return CONTROLS[id]
 const name=element?.getAttribute('aria-label')||element?.getAttribute('title')||element?.textContent?.trim().replace(/\s+/g,' ').slice(0,65)||''
 const detail=TOOL_MEANINGS.find(([regex])=>regex.test(name))?.[1]
 return detail?`${name}. ${detail}`:`This is the “${name||'unnamed'}” control. You can select it normally; ask me about the design task you're trying to complete and I’ll show you the relevant tools.`
}
const readableLabel=element=>String(element?.getAttribute('aria-label')||element?.getAttribute('title')||element?.textContent||'Tool').replace(/\s+/g,' ').trim().slice(0,65)
const defaultPlacement=()=>({mode:'floating',x:null,y:null})
const readPlacement=()=>{
	 try{const saved=JSON.parse(localStorage.getItem('exo-ai-companion-placement')||'null');if(saved&&['floating','left','right','top','bottom','center-wide'].includes(saved.mode))return {mode:saved.mode,x:Number.isFinite(saved.x)?saved.x:null,y:Number.isFinite(saved.y)?saved.y:null}}catch{}
 return defaultPlacement()
}

export default function ExoAppCharacterAssistant20261102({
 open,onOpenChange,commandResult,lastPrompt,onCommand,onCreateGarment,onFashionEdit,onCompanionAction,onPatternDraft,nativePatternMode=false,onOpenCustomWidgets,gradingNestVisible,savedProjectContext=[],activeTemplateId,garmentContext,projectSnapshot,projectUndoAvailable=false,projectRedoAvailable=false,onLocalAsk,onNavigate,activeSection,workspaceLayout,selectedPieceName,currentThemeId='graphite',
}){
 const [text,setText]=useState('')
 const [messages,setMessages]=useState([{from:'assistant',text:'Hi, I’m EXO. Tell me what you want to create, or point to a tool and I’ll explain it. Want to make your first pattern?'}])
 const [patternConversation,setPatternConversation]=useState(createExoCompanionPatternConversation20261102)
 const patternConversationRef=useRef(patternConversation)
 const [patternPreviewVisible,setPatternPreviewVisible]=useState(false)
 const [patternPreviewSourceSignature,setPatternPreviewSourceSignature]=useState('')
 const [patternSketch,setPatternSketch]=useState({state:'idle'})
 const [photoVision,setPhotoVision]=useState({state:'idle'})
 const patternSketchInput=useRef(null)
 const patternPhotoInput=useRef(null)
 useEffect(()=>{
  const url=patternSketch.previewUrl
  return()=>{if(typeof url==='string'&&url.startsWith('blob:'))URL.revokeObjectURL(url)}
 },[patternSketch.previewUrl])
 const editorSignature=useMemo(()=>JSON.stringify({id:projectSnapshot?.id,revision:projectSnapshot?.revision,
  updatedAt:projectSnapshot?.updatedAt,
  panels:(projectSnapshot?.pieces||[]).map(p=>[p.id,p.points,p.curves,p.notches]),
  seams:projectSnapshot?.seams}),[projectSnapshot,projectSnapshot?.revision,projectSnapshot?.updatedAt])
 const [focus,setFocus]=useState(null)
 const [spotlight,setSpotlight]=useState(null)
 const [workspaceOutline,setWorkspaceOutline]=useState(null)
 const [workspaceActive,setWorkspaceActive]=useState(false)
 const [workspaceTarget,setWorkspaceTarget]=useState('2d-canvas')
 const [taskStatus,setTaskStatus]=useState('')
 const [tourIndex,setTourIndex]=useState(-1)
 const [tourMode,setTourMode]=useState('full')
 const [tutorialOpen,setTutorialOpen]=useState(false)
 const [tourPaused,setTourPaused]=useState(false)
 const [themeExplorerOpen,setThemeExplorerOpen]=useState(false)
 const [themeExplorerQuery,setThemeExplorerQuery]=useState('')
 const [themeExplorerCategory,setThemeExplorerCategory]=useState('All')
 const [themeExplorerMode,setThemeExplorerMode]=useState('All')
 const [themeContext,setThemeContext]=useState(null)
 const [themeExplorerLimit,setThemeExplorerLimit]=useState(12)
 const [workflowOpen,setWorkflowOpen]=useState(false)
 const [customWorkflows,setCustomWorkflows]=useState(()=>readExoCompanionCustomWorkflows20261102(typeof window==='undefined'?null:window.localStorage))
 const [workflowId,setWorkflowId]=useState('pattern-creation')
 const [workflowIndex,setWorkflowIndex]=useState(0)
 const [workflowConfirm,setWorkflowConfirm]=useState(false)
 const [workflowTemplateId,setWorkflowTemplateId]=useState('tee')
 const [workflowBusy,setWorkflowBusy]=useState(false)
 const [customEditing,setCustomEditing]=useState(false)
 const [customName,setCustomName]=useState('')
 const [customSteps,setCustomSteps]=useState(['create','inspect','grading','autoGrade','nest'])
 const [stepToAdd,setStepToAdd]=useState('inspect')
 const [celebrating,setCelebrating]=useState(false)
 const [characterSettings,setCharacterSettings]=useState(()=>readExoCompanionCharacterPreferences20261102(typeof window==='undefined'?null:window.localStorage))
 const [characterPreview,setCharacterPreview]=useState(null)
 const liveCharacterSettings=characterPreview||characterSettings
 const characterSettingsRef=useRef(characterSettings)
 const applyCharacterSettings=(incoming,{broadcast=false}={})=>{
  const next=normalizeExoCompanionCharacterPreferences20261102(incoming)
  if(JSON.stringify(characterSettingsRef.current)===JSON.stringify(next))return
  characterSettingsRef.current=next
  setCharacterSettings(next)
  if(broadcast&&typeof window!=='undefined'){
   saveExoCompanionCharacterPreferences20261102(next,window.localStorage)
   window.dispatchEvent(new CustomEvent('exo-companion-character-preferences-updated',{detail:next}))
  }
 }
 useEffect(()=>{
  const receive=event=>{
   const next=event.detail&&typeof event.detail==='object'
    ?event.detail
    :readExoCompanionCharacterPreferences20261102(window.localStorage)
   applyCharacterSettings(next)
  }
  window.addEventListener('exo-companion-character-preferences-updated',receive)
  const preview=event=>setCharacterPreview(event.detail&&typeof event.detail==='object'?normalizeExoCompanionCharacterPreferences20261102(event.detail):null)
  window.addEventListener('exo-companion-character-preferences-preview',preview)
  return()=>{window.removeEventListener('exo-companion-character-preferences-updated',receive);window.removeEventListener('exo-companion-character-preferences-preview',preview)}
 },[])
 const updateCharacter=(key,value)=>applyCharacterSettings({...characterSettingsRef.current,[key]:value},{broadcast:true})
 const updateAppearance=updateCharacter
 const [wanderPosition,setWanderPosition]=useState(null)
 const [orbScale,setOrbScale]=useState(1)
 const [gaze,setGaze]=useState({x:0,y:0})
 const [blink,setBlink]=useState(false)
 const [partyStep,setPartyStep]=useState(0)
 const [orbPosition,setOrbPosition]=useState(null)
 const [exploring,setExploring]=useState(false)
 const [listening,setListening]=useState(false)
 const [interim,setInterim]=useState('')
 const [speaking,setSpeaking]=useState(false)
 const [voiceOn,setVoiceOn]=useState(true)
 const [voices,setVoices]=useState([])
 const [voiceChoice,setVoiceChoice]=useState(()=>{try{return localStorage.getItem('exo-ai-voice')||'auto'}catch{return 'auto'}})
 useEffect(()=>{
  const receive=event=>{
   const {enabled}=event.detail||{}
   const choice=event.detail?.choice??event.detail?.voice
   if(typeof choice==='string'&&choice.length<160){voiceController.current?.cancelSpeech();setVoiceChoice(choice)}
   if(typeof enabled==='boolean'){setVoiceOn(enabled);if(!enabled)voiceController.current?.cancelSpeech()}
  }
  const storage=event=>{if(event.key==='exo-ai-voice'&&typeof event.newValue==='string')setVoiceChoice(event.newValue)}
  window.addEventListener('exo-companion-voice-updated',receive)
  window.addEventListener('storage',storage)
  return()=>{window.removeEventListener('exo-companion-voice-updated',receive);window.removeEventListener('storage',storage)}
 },[])
 const [azureAvailable,setAzureAvailable]=useState(false)
 const [macVoices,setMacVoices]=useState([])
 const [neuralVoices,setNeuralVoices]=useState([])
 const [notice,setNotice]=useState('')
 const [pending,setPending]=useState(false)
 const [aiProvider,setAiProvider]=useState('local')
 const [specialistId,setSpecialistId]=useState(()=>{
  try{
   const saved=window.localStorage.getItem('exo-ai-companion-specialist')
   return EXO_COMPANION_SPECIALISTS_20261102.some(specialist=>specialist.id===saved)?saved:'exo-instructor'
  }catch{return 'exo-instructor'}
 })
 useEffect(()=>{try{window.localStorage.setItem('exo-ai-companion-specialist',specialistId)}catch{}},[specialistId])
 const [providerAvailability,setProviderAvailability]=useState({openai:false,anthropic:false})
 useEffect(()=>{let mounted=true;fetch('/api/exo-assistant/provider/status').then(r=>r.ok?r.json():null).then(data=>{if(mounted&&data?.providers)setProviderAvailability(data.providers)}).catch(()=>{});return()=>{mounted=false}},[])
 const [placement,setPlacement]=useState(readPlacement)
 const [compactDock,setCompactDock]=useState(()=>typeof window!=='undefined'&&window.innerWidth<900)
 const [dockMenu,setDockMenu]=useState(false)
 const [dockPreview,setDockPreview]=useState(null)
 const [draggingDock,setDraggingDock]=useState(false)
 const [toolInfo,setToolInfo]=useState('')
 const [actionPulse,setActionPulse]=useState(0)
 const [patternVisual,setPatternVisual]=useState(false)
 const panelRef=useRef(null)
 const draggingRef=useRef(null)
 const hoveredToolRef=useRef(null)
 const visualTimerRef=useRef(null)
 const tourTimerRef=useRef(null)
 const tourRef=useRef(false)
 const tourGenerationRef=useRef(0)
 const celebrationTimerRef=useRef(null)
 const musicRef=useRef(null)
 const voiceController=useRef(null)
 if(!voiceController.current)voiceController.current=createCompanionVoice({
  environment:window,
  onState:({state})=>{setListening(state==='listening');setSpeaking(state==='speaking')},
  onError:message=>setNotice(message),
 })
 const pendingActionRef=useRef(null)
 const runRef=useRef(null)
 const conversationRef=useRef({pendingTemplateId:null})
 const workingRef=useRef(false)
 const workflowAbortRef=useRef(0)
 const themeOptions=STUDIO_THEME_PRESETS.filter(theme=>(themeExplorerCategory==='All'||theme.category===themeExplorerCategory)&&
  (themeExplorerMode==='All'||(themeExplorerMode==='Light'?theme.mode==='light':theme.mode!=='light'))&&
  (`${theme.name} ${theme.category} ${theme.id}`).toLowerCase().includes(themeExplorerQuery.toLowerCase()))
 const openThemeSettings=useCallback(async()=>{
  const result=await onCompanionAction?.({type:'navigate',target:'settings',tab:'theme'})
  if(result?.ok){setFocus('settings-window');setWorkspaceActive(false)}
  return result
 },[onCompanionAction])
 const applyTheme=useCallback(async id=>{
  if(!STUDIO_THEME_PRESETS.some(theme=>theme.id===id))return{ok:false,message:'That preset is not installed.'}
  const result=await onCompanionAction?.({type:'theme',value:id})||{ok:false,message:'Theme controls are not connected.'}
  if(result.ok){
   setThemeContext(previous=>({...previous,lastThemeId:id,selectedThemeId:id,themeContext:true}))
   setNotice(`Applied ${STUDIO_THEME_PRESETS.find(theme=>theme.id===id)?.name}. You can choose another theme or save a custom palette in Settings.`)
  }
  return result
 },[onCompanionAction])
 const lastObserved=useRef(commandResult)
 const lastHover=useRef('')
 const hoverTimer=useRef(null)
 const replyRef=useRef(null)
 const messagesEnd=useRef(null)
 const speechAvailable=typeof window!=='undefined'&&'speechSynthesis'in window
 const stopCelebration=useCallback(()=>{
  clearTimeout(celebrationTimerRef.current)
  musicRef.current?.stop()
  musicRef.current=null
  setCelebrating(false)
  setWanderPosition(null)
  setOrbScale(1)
 },[])
 const stopTour=useCallback(()=>{
  tourRef.current=false;tourGenerationRef.current++;clearTimeout(tourTimerRef.current)
  voiceController.current?.cancelSpeech()
  setTourIndex(-1)
  setTourPaused(false)
  setWorkspaceActive(false)
 },[])
 const workflowOptions=[...listExoCompanionWorkflows20261102(),...customWorkflows.map(item=>({id:item.id,title:item.title}))]
 const selectedWorkflow=resolveExoCompanionWorkflow20261102(workflowId,customWorkflows)
 const availableWorkflowSteps=[...new Map(listExoCompanionWorkflows20261102().flatMap(flow=>flow.steps).map(step=>[step.id,step.label])).entries()]
 const chooseWorkflow=id=>{setWorkflowId(id);setWorkflowIndex(0);setWorkflowConfirm(false);setTaskStatus('')}
 const saveCustomWorkflow=()=>{
  const title=customName.trim()
  if(!title){setNotice('Name your workflow before saving.');return}
  const slug=title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,44)||'my-workflow'
  const item={id:`custom-${slug}-${Date.now().toString(36)}`,title,steps:customSteps}
  const result=saveExoCompanionCustomWorkflows20261102(window.localStorage,[...customWorkflows,item])
  if(!result.ok){setNotice(result.error);return}
  setCustomWorkflows(result.workflows)
  chooseWorkflow(item.id)
  setCustomEditing(false);setCustomName('')
  setNotice(`Saved “${title}” locally. Its approved steps are ready to run one at a time.`)
 }
 const runWorkflowSteps=useCallback(async ({continueSafe=false}={})=>{
  const flow=resolveExoCompanionWorkflow20261102(workflowId,customWorkflows)
  if(!flow){setNotice('Choose a valid workflow first.');return}
  if(workflowBusy||pending||workingRef.current)return
  setWorkflowBusy(true);workingRef.current=true
  const ticket=++workflowAbortRef.current
  setNotice('')
  let index=workflowIndex
  try{
   while(index<flow.steps.length&&ticket===workflowAbortRef.current){
    const step=flow.steps[index]
    const approved=step.requiresConfirmation?workflowConfirm:false
    if(step.requiresConfirmation&&!approved){
     setNotice(`Confirm “${step.label}” before changing your existing garment.`)
     break
    }
    setTaskStatus(`Workflow ${index+1}/${flow.steps.length}: ${step.label}`)
    setWorkspaceActive(true)
    setWorkspaceTarget(['create','inspect','grading','autoGrade','nest'].includes(step.id)?'2d-canvas':'3d-canvas')
    setFocus(['create','inspect','grading','autoGrade','nest'].includes(step.id)?'2d-canvas':'workspace-modes')
    const result=await executeExoCompanionWorkflowStep20261102(step,{onCreateGarment,onCompanionAction,onNavigate},{templateId:workflowTemplateId,confirmed:approved})
    if(ticket!==workflowAbortRef.current)break
    const progress=advanceExoCompanionWorkflow20261102(flow,index,result,{confirmed:approved})
    if(!progress.ok){
     replyRef.current?.(`Workflow paused at step ${index+1}: ${progress.error||result?.message||'The editor could not confirm the operation.'}`)
     break
    }
    if(step.id==='create'||step.id==='autoGrade')flashPattern(['front','back'])
    setMessages(history=>[...history.slice(-23),{from:'assistant',text:`Completed: ${step.label}. ${result?.message||step.checkpoint||'The editor confirmed this step.'}`}])
    index=progress.index;setWorkflowIndex(index);setWorkflowConfirm(false)
    if(progress.completed){replyRef.current?.(`“${flow.title}” completed its supported actions. Review garment fit, graded sizes, and technical documentation before approving production.`);break}
    if(step.checkpoint||!continueSafe||flow.steps[index]?.requiresConfirmation)break
   }
  }catch(error){replyRef.current?.(`Workflow paused safely: ${error.message}`)}
  finally{workingRef.current=false;setWorkflowBusy(false);setTaskStatus('')}
 },[workflowId,customWorkflows,workflowIndex,workflowConfirm,workflowTemplateId,workflowBusy,pending,onCreateGarment,onCompanionAction,onNavigate])
 useEffect(()=>{
  document.body.classList.toggle('exo-ai-celebrating',celebrating)
  return()=>document.body.classList.remove('exo-ai-celebrating')
 },[celebrating])
 useEffect(()=>{
  const guidedTheme=tourMode==='theme'&&tourIndex>=0
  document.body.classList.toggle('exo-ai-guided-settings',guidedTheme||themeExplorerOpen)
  return()=>document.body.classList.remove('exo-ai-guided-settings')
 },[tourMode,tourIndex,themeExplorerOpen])
 // EXO's idle personality: glance around, blink and occasionally drift between
 // free areas of the screen. Party mode uses a more energetic, faster route.
 useEffect(()=>{
  if(typeof window==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return
  if(!liveCharacterSettings.enabled||['steady','pointer-follow'].includes(liveCharacterSettings.movement)&&!celebrating)return
  let cursor=0
  const positions=[[.07,.67],[.25,.28],[.7,.64],[.8,.22],[.48,.47],[.11,.21],[.74,.76],[.3,.78]]
  const roam=()=>{
   if(!celebrating&&(focus||tourIndex>=0||listening))return
   cursor=(cursor+1)%positions.length
   const mode=liveCharacterSettings.movement
   const [baseX,baseY]=positions[(cursor+(celebrating?partyStep%3:0))%positions.length]
   const x=mode==='gentle'?.69+.055*Math.sin(cursor*.9):baseX
   const y=mode==='gentle'?.66+.045*Math.cos(cursor*.9):baseY
   const width=Math.max(320,innerWidth),height=Math.max(280,innerHeight)
   const limitedX=open&&!celebrating?Math.min(x,.26):x
   setWanderPosition({left:clamp(Math.round(width*limitedX),10,Math.max(10,width-126)),top:clamp(Math.round(height*y),48,Math.max(48,height-133)),right:'auto',bottom:'auto'})
   setOrbScale(celebrating?[1.1,.8,1.5,.94,1.34][cursor%5]:mode==='gentle'?1:mode==='energetic'?[.86,1.2,1.04,1.16][cursor%4]:[.98,1.04,.9,1.13][cursor%4])
   setGaze({x:[-.8,.7,.2,-.6,0][cursor%5],y:[.2,-.4,.6,-.2][cursor%4]})
   if(celebrating)setPartyStep(step=>step+1)
  }
  const initial=setTimeout(roam,celebrating?100:liveCharacterSettings.movement==='energetic'?200:1800)
  const timer=setInterval(roam,celebrating?1000:liveCharacterSettings.movement==='gentle'?13000:liveCharacterSettings.movement==='energetic'?2800:9000)
  return()=>{clearTimeout(initial);clearInterval(timer)}
 },[celebrating,focus,tourIndex,listening,open,liveCharacterSettings.enabled,liveCharacterSettings.movement])
 useEffect(()=>{
  if(liveCharacterSettings.movement==='steady'&&!celebrating){setWanderPosition(null);setOrbScale(1)}
 },[liveCharacterSettings.movement,celebrating])
 useEffect(()=>{
  if(!liveCharacterSettings.enabled||liveCharacterSettings.movement!=='pointer-follow'||celebrating)return
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return
  let animationFrame=0
  const follow=event=>{
   if(focus||tourIndex>=0||listening||draggingRef.current)return
   cancelAnimationFrame(animationFrame)
   const x=event.clientX,y=event.clientY
   animationFrame=requestAnimationFrame(()=>{
    setWanderPosition({left:clamp(x+24,10,Math.max(10,innerWidth-126)),top:clamp(y+18,48,Math.max(48,innerHeight-133)),right:'auto',bottom:'auto'})
    setGaze({x:clamp((x-innerWidth/2)/innerWidth,-.8,.8),y:clamp((y-innerHeight/2)/innerHeight,-.7,.7)})
   })
  }
  window.addEventListener('pointermove',follow,{passive:true})
  return()=>{window.removeEventListener('pointermove',follow);cancelAnimationFrame(animationFrame);setWanderPosition(null)}
 },[liveCharacterSettings.enabled,liveCharacterSettings.movement,celebrating,focus,tourIndex,listening])
 useEffect(()=>{
  if(typeof window==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return
  let closeBlink
  const pulse=()=>{
   setBlink(true)
   closeBlink=setTimeout(()=>setBlink(false),155)
   if(!celebrating&&!focus)setGaze(p=>({x:-p.x+.15,y:p.y>.1?-.45:.35}))
  }
  const timer=setInterval(pulse,celebrating?1700:4700)
  return()=>{clearInterval(timer);clearTimeout(closeBlink)}
 },[celebrating,focus])
 useEffect(()=>()=>{clearTimeout(tourTimerRef.current);clearTimeout(celebrationTimerRef.current);musicRef.current?.stop()},[])
 const recognitionAvailable=typeof window!=='undefined'&&!!(window.SpeechRecognition||window.webkitSpeechRecognition)
 const embeddedDock=open&&placement.mode!=='floating'&&!compactDock
 useEffect(()=>{
  const update=()=>setCompactDock(window.innerWidth<900||window.innerHeight<500)
  update()
  window.addEventListener('resize',update)
  return()=>window.removeEventListener('resize',update)
 },[])
 useEffect(()=>{
  const shell=document.getElementById('exo-pattern-glass-shell')
  if(!shell||!embeddedDock)return
  const panel=panelRef.current
  if(!panel)return
  const size=()=>{
   const rect=panel.getBoundingClientRect()
   const value=Math.ceil((placement.mode==='left'||placement.mode==='right'?rect.width:rect.height)+8)
   shell.style.setProperty('--exo-companion-dock-size',`${value}px`)
  }
  shell.dataset.exoCompanionDock=placement.mode
  size()
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(size):null
  observer?.observe(panel)
  window.addEventListener('resize',size)
  return()=>{
   observer?.disconnect()
   window.removeEventListener('resize',size)
   delete shell.dataset.exoCompanionDock
   shell.style.removeProperty('--exo-companion-dock-size')
  }
 },[embeddedDock,placement.mode])

 const dock=useCallback(mode=>{
  const next={...placement,mode}
  setPlacement(next);setDockMenu(false);setDockPreview(null);setDraggingDock(false)
  try{localStorage.setItem('exo-ai-companion-placement',JSON.stringify(next))}catch{}
 },[placement])
 const startDrag=useCallback(event=>{
  if(event.button!==0||event.target.closest('button,select,input'))return
  const rect=panelRef.current?.getBoundingClientRect()
  if(!rect)return
  event.preventDefault()
  draggingRef.current={pointer:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top,startX:event.clientX,startY:event.clientY,wasEmbedded:embeddedDock,moved:false}
  setDraggingDock(true)
  setDockPreview(null)
  // Window listeners keep the drag alive while docking repositions the panel.
 },[embeddedDock])
 const moveDrag=useCallback(event=>{
  if(draggingRef.current?.pointer!==event.pointerId)return
  const drag=draggingRef.current
  const {dx,dy}=drag
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6&&!drag.moved)return
  drag.moved=true
  const rect=panelRef.current?.getBoundingClientRect(),width=rect?.width||410,height=rect?.height||480
  setPlacement({mode:'floating',x:clamp(event.clientX-dx,6,Math.max(6,innerWidth-width-6)),y:clamp(event.clientY-dy,6,Math.max(6,innerHeight-height-6))})
  const moved=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>28
  const candidate=moved&&!compactDock?preciseDockTarget(event.clientX,event.clientY):null
  if(candidate!==drag.candidate){
   clearTimeout(drag.hoverTimer)
   drag.candidate=candidate;drag.candidateSince=candidate?performance.now():0
   if(candidate)drag.hoverTimer=setTimeout(()=>{
    if(draggingRef.current!==drag||drag.candidate!==candidate)return
    drag.armed=candidate
    setDockPreview({target:candidate,preview:getDockDrop(drag.lastX,drag.lastY)?.preview})
   },DOCK_HOVER_MS)
  }
  drag.lastX=event.clientX;drag.lastY=event.clientY
  const armed=!!candidate&&performance.now()-drag.candidateSince>=DOCK_HOVER_MS
  drag.armed=armed?candidate:null
  setDockPreview(armed?getDockDrop(event.clientX,event.clientY):candidate?{target:candidate}:null)
 },[compactDock])
 const endDrag=useCallback(event=>{
  if(draggingRef.current?.pointer!==event.pointerId)return
  const drag=draggingRef.current
  const target=event.type==='pointercancel'||compactDock?null:preciseDockTarget(event.clientX,event.clientY)
  const nextMode=drag.moved&&target&&target===drag.candidate&&performance.now()-drag.candidateSince>=DOCK_HOVER_MS?target:null
  clearTimeout(drag.hoverTimer)
  draggingRef.current=null
  setDraggingDock(false);setDockPreview(null)
  setPlacement(value=>{const next=nextMode?{...value,mode:nextMode}:value;try{localStorage.setItem('exo-ai-companion-placement',JSON.stringify(next))}catch{};return next})
 },[compactDock])
 useEffect(()=>{
  if(!draggingDock)return
  const escape=event=>{if(event.key==='Escape'){event.preventDefault();clearTimeout(draggingRef.current?.hoverTimer);draggingRef.current=null;setDraggingDock(false);setDockPreview(null);setPlacement(value=>{try{localStorage.setItem('exo-ai-companion-placement',JSON.stringify(value))}catch{};return value})}}
  const release=()=>{if(!draggingRef.current)return;clearTimeout(draggingRef.current.hoverTimer);draggingRef.current=null;setDraggingDock(false);setDockPreview(null);setPlacement(value=>{try{localStorage.setItem('exo-ai-companion-placement',JSON.stringify(value))}catch{};return value})}
  window.addEventListener('keydown',escape,true)
  window.addEventListener('blur',release)
  window.addEventListener('pointermove',moveDrag,true)
  window.addEventListener('pointerup',endDrag,true)
  window.addEventListener('pointercancel',endDrag,true)
  return()=>{window.removeEventListener('keydown',escape,true);window.removeEventListener('blur',release);window.removeEventListener('pointermove',moveDrag,true);window.removeEventListener('pointerup',endDrag,true);window.removeEventListener('pointercancel',endDrag,true)}
 },[draggingDock,moveDrag,endDrag])
 useEffect(()=>{
  const clampPosition=()=>setPlacement(value=>{
   if(value.mode!=='floating'||value.x===null)return value
   const r=panelRef.current?.getBoundingClientRect()
   return {...value,x:clamp(value.x,6,Math.max(6,innerWidth-(r?.width||410)-6)),y:clamp(value.y??6,6,Math.max(6,innerHeight-(r?.height||450)-6))}
  })
  window.addEventListener('resize',clampPosition)
  return()=>window.removeEventListener('resize',clampPosition)
 },[])
 const flashPattern=useCallback((pieceIds=['front','back'])=>{
  setPatternVisual(true);setActionPulse(v=>v+1)
  clearTimeout(visualTimerRef.current)
  visualTimerRef.current=setTimeout(()=>setPatternVisual(false),4400)
  window.dispatchEvent(new CustomEvent('exo-companion-focus-pattern',{detail:{pieceIds}}))
 },[])
 useEffect(()=>()=>clearTimeout(visualTimerRef.current),[])
 useEffect(()=>{
  if(!patternVisual)return
  const roots=[...document.querySelectorAll('.cc-viewport-2d,.pattern-editor-shell,.workspaces')].filter(el=>el.getBoundingClientRect().width>180)
  const pieces=roots.flatMap(root=>[...root.querySelectorAll('.pattern-piece,[data-piece-id],.pattern-outline,.pattern-editor-piece')]).filter(el=>el.getBoundingClientRect().width>5)
  for(const piece of pieces)piece.classList.add('exo-ai-pattern-active')
  return()=>{for(const piece of pieces)piece.classList.remove('exo-ai-pattern-active')}
 },[patternVisual,actionPulse,workspaceLayout])

 const stopAudio=useCallback(()=>voiceController.current?.cancelSpeech(),[])
 const speak=useCallback(raw=>{
  if(!voiceOn)return
  void voiceController.current?.speak(raw,{choice:voiceChoice,azureAvailable,neuralAvailable:neuralVoices.length>0,localAvailable:macVoices.length>0})
 },[voiceOn,azureAvailable,voiceChoice,neuralVoices,macVoices])
 const reply=useCallback((message,{target=null,navigate=null}={})=>{
  const content=escapeSpoken(message)
  setMessages(history=>[...history.slice(-23),{from:'assistant',text:content}])
  if(target)setFocus(target)
  if(navigate)onNavigate?.(navigate)
  speak(content)
 },[onNavigate,speak])
 replyRef.current=reply
 const attachPatternSketch=async (file,mode='sketch')=>{
  if(!file)return
  setPhotoVision({state:'idle'})
  setPatternSketch({state:'loading',name:file.name,mode})
  try{
   const parsed=mode==='photo'?await interpretExoGarmentPhotoFile20261102(file):await interpretExoSketchFile20261102(file)
   if(!parsed.ok){
    setPatternSketch({state:mode==='photo'?'unresolved':'error',name:file.name,mode,error:parsed.reason,
     ...(mode==='photo'?{sourceFile:file,previewUrl:URL.createObjectURL(file)}:{})})
    reply(`I couldn't reliably trace that ${mode}: ${parsed.reason} ${mode==='photo'?'You can now ask my installed local vision model to suggest visible garment details, without treating them as measured pattern geometry.':'Use a high-contrast drawing with a single closed silhouette.'}`)
    return
   }
   setPatternSketch({state:'ready',name:file.name,mode,data:parsed,
    ...(mode==='photo'?{sourceFile:file}:{}),
    previewUrl:mode==='photo'?URL.createObjectURL(file):null})
   setMessages(history=>[...history.slice(-23),{from:'user',text:`Attached garment ${mode}: ${file.name}`}])
   const hint=patternConversationRef.current.design?`Say “use this ${mode}” to regenerate your current draft.`:`Describe the garment first, for example “make an oversized hoodie using this ${mode}”.`
   reply(`I found a single garment-shaped outline with ${parsed.normalizedContour.length} visual points in your ${mode}. ${mode==='photo'?'Photo appearance, folds and perspective cannot verify actual pattern panels or measurements.':'The sketch has no physical measurement scale.'} ${hint}`)
  }catch(error){setPatternSketch({state:'error',name:file.name,mode,error:error.message});reply(`${mode==='photo'?'Photo':'Sketch'} analysis failed: ${error.message}`)}
 }
 const analyzeAttachedPhotoWithVision=async()=>{
  const file=patternSketch.mode==='photo'?patternSketch.sourceFile:null
  if(!file)return
  setPhotoVision({state:'loading'})
  try{
   const result=await analyzeLocalGarmentPhotoWithVision20261102(file)
   if(!result.ok){setPhotoVision({state:'error',error:result.reason,code:result.code});reply(`The local photo vision model could not interpret this reference: ${result.reason}`);return}
   const plan=reviewLocalPhotoVision20261102(result,{userTemplateId:patternConversationRef.current.design?.templateId||null})
   if(plan.ok===false&&!plan.suggestedPrompt)reply('The local model could not identify a compatible garment construction. Describe the garment in words, or isolate it against a plain background.')
   else reply(`The local vision model suggested ${result.family} with a ${result.silhouette} silhouette and approximate ${result.approximateColor} color. These observations are uncalibrated and need your review. You can edit the suggested description before requesting any pattern.`)
   setPhotoVision({state:'ready',result,plan})
  }catch(error){setPhotoVision({state:'error',error:error.message})}
 }
 const startTour=useCallback((mode=tourMode,fromIndex=0)=>{
  voiceController.current?.activateSpeechGesture?.()
  stopTour()
  stopCelebration()
  tourRef.current=true
  const ticket=++tourGenerationRef.current
  setTourPaused(false)
  setExploring(false)
  const stops=EXO_COMPANION_TOUR_MODES[mode]||EXO_COMPANION_TOUR_MODES.full
  setTourMode(mode)
  const advance=async index=>{
   if(!tourRef.current||ticket!==tourGenerationRef.current)return
   const stop=stops[index]
   if(!stop){
    stopTour();setWorkspaceActive(false);setFocus(null)
    replyRef.current?.(`You completed the ${TUTORIAL_OPTIONS.find(item=>item[0]===mode)?.[1]||'EXO'} tour. Choose another tutorial, or tell me which tool you want to use.`)
    return
   }
   if(mode==='theme'){
    // Open the existing Theme Settings tab and bring the actual control into
    // view before the character highlights and narrates the next lesson.
    if(!document.querySelector('.studio-settings-dialog')){
     const opened=await onCompanionAction?.({type:'navigate',target:'settings',tab:'theme'})
     if(opened?.ok!==true){
      tourRef.current=false;setTourPaused(true)
      setNotice(opened?.message||'Theme Settings could not be opened.')
      return
     }
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
    }
    const element=getControl(stop.target)
    element?.scrollIntoView?.({block:'center',behavior:'instant'})
    await new Promise(resolve=>requestAnimationFrame(resolve))
   }else if(stop.navigate==='widgets')onOpenCustomWidgets?.()
   else if(stop.navigate)onNavigate?.(stop.navigate)
   if(ticket!==tourGenerationRef.current||!tourRef.current)return
   setTourIndex(index)
   setFocus(stop.target)
   const pane=['2d-canvas','3d-canvas','techpack-window'].includes(stop.target)
   setWorkspaceActive(pane)
   if(pane)setWorkspaceTarget(stop.target)
   setTaskStatus(stop.title)
   const narration=escapeSpoken(`${stop.title}. ${stop.explanation}`)
   setMessages(history=>[...history.slice(-23),{from:'assistant',text:narration}])
   if(voiceOn){
    const playback=await voiceController.current?.speakAndWait(narration,{choice:voiceChoice,azureAvailable,neuralAvailable:neuralVoices.length>0,localAvailable:macVoices.length>0,timeoutMs:120000})
    if(ticket!==tourGenerationRef.current||!tourRef.current)return
    if(!playback?.ok){
     tourRef.current=false;setTourPaused(true)
     setNotice('Tour narration was interrupted or could not finish. Press Resume to repeat this step, or mute voice to continue without narration.')
     return
    }
   }
   if(ticket!==tourGenerationRef.current||!tourRef.current)return
   tourTimerRef.current=setTimeout(()=>{void advance(index+1)},Math.max(900,Math.min(stop.dwellMs||1100,3000)))
  }
  void advance(fromIndex)
 },[stopTour,stopCelebration,onNavigate,onCompanionAction,onOpenCustomWidgets,voiceOn,voiceChoice,azureAvailable,neuralVoices,macVoices,tourMode])
 const pauseTour=useCallback(()=>{
  if(tourIndex<0)return
  clearTimeout(tourTimerRef.current)
  tourRef.current=false
  tourGenerationRef.current++
  setTourPaused(true)
  voiceController.current?.cancelSpeech()
 },[tourIndex])
 const celebrate=useCallback(()=>{
  stopTour();stopCelebration();stopAudio()
  setCelebrating(true);setTaskStatus('EXO CELEBRATION')
  const groove=createExoCompanionGroove({bars:32,volume:.16,tempo:138})
  musicRef.current=groove
  void groove.start().then(ok=>{if(!ok)setNotice('Music playback was blocked by the browser. Click Celebrate again to retry audio.')})
  celebrationTimerRef.current=setTimeout(()=>stopCelebration(),groove.durationMs+300)
  setMessages(history=>[...history.slice(-23),{from:'assistant',text:'Party mode is on! I’m dancing across the studio, and the tools will pulse with the original EXO beat. Stop Party whenever you want.'}])
 },[stopTour,stopCelebration,stopAudio])

 useEffect(()=>{if(!speechAvailable)return
  const refresh=()=>setVoices(voiceController.current?.listVoices()||[])
  refresh();window.speechSynthesis.addEventListener?.('voiceschanged',refresh)
  return()=>window.speechSynthesis.removeEventListener?.('voiceschanged',refresh)
 },[speechAvailable])
 useEffect(()=>{fetch('/api/exo-assistant/speech/status').then(r=>r.ok?r.json():null).then(data=>setAzureAvailable(data?.available===true)).catch(()=>{})},[])
 useEffect(()=>{fetch('/api/exo-assistant/speech-local/status').then(r=>r.ok?r.json():null).then(data=>setMacVoices(data?.available&&Array.isArray(data.voices)?data.voices:[])).catch(()=>{})},[])
 useEffect(()=>{fetch('/api/exo-assistant/speech-neural/status').then(r=>r.ok?r.json():null).then(data=>setNeuralVoices(data?.available&&Array.isArray(data.voices)?data.voices:[])).catch(()=>{})},[])
 useEffect(()=>{try{localStorage.setItem('exo-ai-voice',voiceChoice)}catch{}},[voiceChoice])
 useEffect(()=>()=>{voiceController.current?.cancel()},[])
 useEffect(()=>{messagesEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[messages,open])
 useEffect(()=>{
  if(!pendingActionRef.current||commandResult===lastObserved.current)return
  lastObserved.current=commandResult
  pendingActionRef.current=null
  if(commandResult)reply(commandResult)
 },[commandResult,reply])

 const measure=useCallback(()=>{
  const canvas=workspaceActive?getControl(workspaceTarget):null
  if(canvas){
   const bounds=canvas.getBoundingClientRect()
   setWorkspaceOutline({x:Math.max(3,bounds.left),y:Math.max(3,bounds.top),w:Math.min(innerWidth-6,bounds.width),h:Math.min(innerHeight-6,bounds.height)})
  }else setWorkspaceOutline(null)
  const element=focus==='hovered-tool'?hoveredToolRef.current:getControl(focus)
  if(!element){setSpotlight(null);setOrbPosition(null);return}
  const r=element.getBoundingClientRect(),pad=5
  setSpotlight({x:Math.max(3,r.left-pad),y:Math.max(3,r.top-pad),w:Math.min(innerWidth-6,r.width+pad*2),h:r.height+pad*2})
  // Stay near the selected control without hiding it. The orb flies to the closest free side.
  const diameter=72
  let x=r.right+15,y=r.top+r.height/2-diameter/2
  if(focus==='2d-canvas'){x=r.left+35;y=r.top+54}
  if(x+diameter>innerWidth-12)x=r.left-diameter-16
  if(x<12){x=r.left+r.width/2-diameter/2;y=r.bottom+14}
  setOrbPosition({left:clamp(x,12,Math.max(12,innerWidth-diameter-12)),top:clamp(y,14,Math.max(14,innerHeight-diameter-12)),right:'auto',bottom:'auto'})
 },[focus,workspaceActive,workspaceTarget])
 useEffect(()=>{
  let raf=0
  const update=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(measure)}
  update();const timer=setTimeout(update,320)
  window.addEventListener('scroll',update,true);window.addEventListener('resize',update)
  return()=>{clearTimeout(timer);cancelAnimationFrame(raf);window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update)}
 },[measure,activeSection,workspaceLayout,open,toolInfo])
 useEffect(()=>{
  if(!exploring||!open)return
  const inspect=event=>{
   if(event.target.closest?.('.exo-ai-panel,.exo-ai-character'))return
   const target=event.target.closest?.('button,[role="button"],[data-exo-guide-target]')
   if(!target||target.disabled||target.matches('[aria-hidden="true"]'))return
   const id=target.getAttribute('data-exo-guide-target')||'hovered-tool'
   const name=readableLabel(target)
   if(!name||target===hoveredToolRef.current)return
   hoveredToolRef.current=target
   // Move freely on hover/focus, explain after the visitor settles on a control.
   lastHover.current=id;setFocus('hovered-tool');setToolInfo(name)
   clearTimeout(hoverTimer.current)
   hoverTimer.current=setTimeout(()=>{
    if(hoveredToolRef.current===target)replyRef.current?.(explainTool(target,id))
   },1050)
  }
  const describe=event=>{
   if(event.target.closest?.('.exo-ai-panel,.exo-ai-character'))return
   const target=event.target.closest?.('button,[role="button"],[data-exo-guide-target]')
   if(!target||target.disabled)return
   const id=target.getAttribute('data-exo-guide-target')||'hovered-tool'
   hoveredToolRef.current=target;setFocus('hovered-tool');setToolInfo(readableLabel(target))
   clearTimeout(hoverTimer.current)
   replyRef.current?.(explainTool(target,id))
  }
  document.addEventListener('pointerover',inspect,true);document.addEventListener('focusin',inspect,true);document.addEventListener('click',describe,true)
  return()=>{clearTimeout(hoverTimer.current);lastHover.current='';hoveredToolRef.current=null;document.removeEventListener('pointerover',inspect,true);document.removeEventListener('focusin',inspect,true);document.removeEventListener('click',describe,true)}
 },[exploring,open])

 const handlePrompt=useCallback(async input=>{
  const raw=String(input||'').trim()
  if(!raw||pending||workingRef.current)return
  if(listening)voiceController.current?.stopRecognition()
  setText('');setInterim('');setNotice('')
  setMessages(history=>[...history.slice(-23),{from:'user',text:raw}])
  if(patternSketch.mode==='photo'&&patternSketch.state==='unresolved'&&
     /\b(?:use|follow|draft\s+from|make\s+(?:a\s+)?pattern\s+from)\b.{0,45}\b(?:photo|picture|image|reference)\b/i.test(raw)){
   reply('This photo has no trustworthy traced cutline. Choose “Analyze visible details with local AI vision”, review its suggested description, and confirm the garment style in your next message. I will not invent hidden sewing construction from the photograph.')
   return
  }
  // Real conversational pattern creation is first-class. A supported request
  // is resolved by local explicit garment construction and independent seam QA
  // before ordinary navigation, fashion commands, or optional model chat.
  // Inference never mutates the editor; approval is a separate UI action.
  const patternTurn=handleExoCompanionPatternTurn20261102(raw,patternConversationRef.current,{
   sketch:patternSketch.state==='ready'&&patternSketch.mode!=='photo'?patternSketch.data:null,
   photo:patternSketch.state==='ready'&&patternSketch.mode==='photo'?patternSketch.data:null,
   expectedRevision:patternConversationRef.current.revision,
   expectedProposalKey:patternConversationRef.current.proposalKey,
  })
  if(patternTurn.handled){
   if(patternTurn.ok){
    patternConversationRef.current=patternTurn.context
    setPatternConversation(patternTurn.context)
    if(patternTurn.kind==='cancelled'){
     setPatternPreviewVisible(false);setPatternPreviewSourceSignature('')
     setPatternSketch({state:'idle'})
     setPhotoVision({state:'idle'})
     reply('I cleared the pattern design conversation. Your actual editor garment was not changed.')
    }else{
     if(['draft','revise','undone'].includes(patternTurn.kind)&&patternTurn.proposal?.ok){
      setPatternPreviewSourceSignature(editorSignature)
      setPatternPreviewVisible(true)
      setFocus('2d-canvas');setWorkspaceTarget('2d-canvas');setWorkspaceActive(true)
      flashPattern(patternTurn.proposal.project.pieces.slice(0,4).map(piece=>piece.id))
     }
     if(['preview','ready_to_install'].includes(patternTurn.kind))setPatternPreviewVisible(true)
     if(patternTurn.kind==='ready_to_install')reply('The current pattern is ready for your separate review. Check the design below, acknowledge its production limitations, and explicitly confirm opening it. I have not replaced the garment.')
     else reply(`${patternTurn.message}${patternTurn.proposal?.report?` ${patternTurn.proposal.report.panels} editable pieces and ${patternTurn.proposal.report.seams} source-authored sewing connections. Base-size digital QA: ${patternTurn.proposal.qa.status}.`:''}`)
    }
   }else reply(`I couldn't update the pattern: ${patternTurn.message} Your previous draft is unchanged.`)
   return
  }
  const lower=raw.toLowerCase(),topicId=resolveExoGuide20261102(raw),topic=TOPICS[topicId]
  const uiIntent=classifyExoCompanionCommand(raw)
  const themeIntent=classifyExoThemeRequest20261102(raw,{
   ...themeContext,selectedThemeId:currentThemeId,limit:12,
   themeContext:themeExplorerOpen||tourMode==='theme'&&tourIndex>=0||themeContext?.themeContext===true,
  })
  if(themeIntent.type!=='unknown'){
   if(themeIntent.type==='tutorial'){
    setThemeExplorerOpen(true);setTutorialOpen(true);setWorkflowOpen(false)
    startTour('theme',themeIntent.topic==='icon'?4:themeIntent.topic==='panel'?1:0);return
   }
   if(themeIntent.type==='apply'){
    if(themeIntent.topic==='panelFinish'){
     const result=await onCompanionAction?.({type:'panelFinish',value:themeIntent.value})
     reply(result?.message||'Panel finish could not be updated.',{target:'settings-window'})
    }else{
     const result=await applyTheme(themeIntent.id)
     reply(result?.message||(result?.ok?'Theme changed.':'Theme could not be changed.'),{target:'settings-window'})
    }
    return
   }
   if(themeIntent.type==='list'){
    setThemeExplorerOpen(true);setTutorialOpen(false)
    setThemeContext({...themeIntent,themeContext:true})
    if(themeIntent.topic==='panelFinish'){
     reply(`Panel finishes available: ${(themeIntent.options||[]).map(item=>`${item.name}: ${item.description}`).join('; ')}. Tell me which finish to apply, or start the Theme tutorial.`)
     return
    }
    const listed=(themeIntent.options||[]).slice(0,8).map(theme=>theme.name)
    const total=themeIntent.total||0
    const color=themeIntent.filters?.color||themeIntent.filters?.category||themeIntent.filters?.mode
    if(color){
     const families={purple:'Purple',violet:'Purple',lavender:'Purple',blue:'Blue',navy:'Blue',green:'Nature',mint:'Nature',pink:'Pink',rose:'Pink',white:'White & Paper',cream:'Cream & Linen',brown:'Earth',earth:'Earth',orange:'Warm',gray:'Neutrals',grey:'Neutrals'}
     const category=themeIntent.filters?.category||families[themeIntent.filters?.color]||'All'
     setThemeExplorerCategory(STUDIO_THEME_PRESETS.some(theme=>theme.category===category)?category:'All')
     setThemeExplorerMode(themeIntent.filters?.mode==='light'?'Light':themeIntent.filters?.mode==='dark'?'Dark':'All')
     setThemeExplorerQuery('')
     setThemeExplorerLimit(12)
    }else{setThemeExplorerCategory('All');setThemeExplorerMode('All');setThemeExplorerQuery('')}
    const result=await openThemeSettings()
    reply(`I found ${total} installed ${color?color+' ':''}theme options. ${listed.join(', ')}${total>8?', and more':''}. Use the theme browser below for the full list, or select a palette in Settings. ${result?.ok?'I also opened your real Theme Settings.':''}`,{target:'settings-window'})
    return
   }
   if(themeIntent.type==='open'){
    const result=await openThemeSettings()
    setThemeExplorerOpen(true)
    setThemeContext({themeContext:true})
    reply(result?.message||'Theme Settings is not available.',{target:'settings-window'})
    return
   }
   if(themeIntent.type==='explain'){
    setThemeContext({...themeContext,themeContext:true})
    if(themeIntent.topic==='currentTheme'){
     const current=STUDIO_THEME_PRESETS.find(theme=>theme.id===currentThemeId)
     reply(`Your current EXO interface theme is ${current?.name||currentThemeId}. ${current?`Its accent is ${current.accent}, with a ${current.panelColor} panel.`:''} I can show you other palettes, apply one, or guide you through Theme Settings.`)
    }else if(themeIntent.topic==='icons'){
     const result=await openThemeSettings()
     setThemeExplorerOpen(true)
     reply(`Global icon colors are in Theme Settings → Icon colors. You can preview swatches and apply them across the 2D/3D toolbars. ${result?.ok?'I opened Theme Settings for you.':''} Say “walk me through icon colors” for the guided steps.`,{target:'theme-icons'})
    }else{
     const theme=themeIntent.theme
     reply(theme?`${theme.name} is an installed ${theme.category} theme with accent ${theme.accent} and panel ${theme.panelColor}. Say “apply ${theme.name} theme” to use it.`:'I can explain your theme, show all palettes, or guide you through changing the interface colors.')
    }
    return
   }
  }
  const appQuestion=interpretExoAppQuestion20261102(raw,{section:activeSection})
  if(appQuestion.kind==='tour'){
   setTutorialOpen(true);setWorkflowOpen(false)
   if(appQuestion.topic==='widget-studio'){
    onOpenCustomWidgets?.()
    reply('Opened Custom Widget Studio. You can create a custom panel, configure supported tools, preview it, and save it in the widget library.')
   }else startTour(appQuestion.tourMode)
   return
  }
  const requestedTutorial=/\b(?:show|teach|walk|guide|explain|demonstrate|tour|tutorial|workflow)\b/i.test(raw)&&/\b(?:workflow|tutorial|tour|how to|how do|show me|walk me through)\b/i.test(raw)
  if(requestedTutorial){
   const mode=/\b(?:tech\s*pack|techpack|spec(?:ification)?\s*sheet)\b/i.test(raw)?'techpack'
    :/\b(?:3\s*[- ]?d|simulation|simulator|cloth\s*sim|drap(?:e|ing)|fit)\b/i.test(raw)?'3d'
    :/\b(?:grad(?:e|ing)|siz(?:es|ing))\b/i.test(raw)?'grading'
    :/\b(?:fabric|material)\b/i.test(raw)?'fabric'
    :/\b(?:2\s*[- ]?d|pattern|draft(?:ing)?)\b/i.test(raw)?'pattern'
    :/\b(?:navigation|interface|settings|workspace)\b/i.test(raw)?'navigation'
    :null
   if(mode){setTutorialOpen(true);startTour(mode);return}
  }
  if(uiIntent.type==='stop'){
   workflowAbortRef.current++;stopTour();stopCelebration();stopAudio();setWorkspaceActive(false);setExploring(false);setFocus(null)
   reply('Stopped the tour, celebration, and ongoing voice. What would you like to work on next?')
   return
  }
  if(uiIntent.type==='tour'){startTour();return}
  if(uiIntent.type==='celebrate'){celebrate();return}
  if(/\b(?:references?|photos?|images?|mood\s*board|moodboard)\b/i.test(raw)&&/\b(?:local|library|saved|mood\s*board|moodboard)\b/i.test(raw)&&/\b(?:find|search|pull|grab|add|place|bring|show|put)\b/i.test(raw)){
   const add=/\b(?:add|place|put|bring|grab|pull)\b/i.test(raw)
   const query=raw.replace(/\b(?:can you|please|from|into|onto|our|my|the|local|saved|library|reference|references|photos|images|image|photo|moodboard|mood board|board|find|search|pull|grab|add|place|bring|put|of|for|some|all|a|an|to)\b/gi,' ').replace(/\s+/g,' ').trim()
   if(!query){reply('Tell me what kind of local reference you want, for example: “Find oversized jacket references in my library.”');return}
   setPending(true);setWorkspaceActive(true);setWorkspaceTarget(add?'techpack-window':'library-window');setFocus(add?'techpack-window':'library-window');setTaskStatus(add?'Adding real reference images to the board…':'Searching saved reference images…')
   try{const result=await onCompanionAction?.({type:add?'referenceAdd':'referenceSearch',query});reply(result?.message||'The local reference library is unavailable.',{target:result?.target})}
   catch(error){reply(`The reference workflow failed: ${error.message}`)}finally{setPending(false)}
   return
  }
  const fashionIntent=interpretExoFashionIntent(raw,{garment:activeTemplateId||'tee'})
  if(fashionIntent?.brandReference&&/\b(?:fit|silhouette|oversized|look|style|inspired|type|make|want|apply|create|design)\b/i.test(raw)){
   const apply=/\b(?:apply|make|change|adjust|edit|modify|give me)\b/i.test(raw)
   if(!onCompanionAction){reply('Fashion interpretation is unavailable in this workspace.');return}
   setPending(true);setWorkspaceActive(true);setWorkspaceTarget('2d-canvas');setFocus('2d-canvas');setTaskStatus(apply?'Applying supported fit geometry…':'Interpreting fashion silhouette…')
   try{const result=await onCompanionAction({type:'fashionInterpret',request:raw,apply});if(result?.ok&&apply)flashPattern(['front','back']);reply(result?.message||'This fashion interpretation could not be completed.',{target:result?.target})}
   catch(error){reply(`The fit interpretation failed: ${error.message}`)}finally{setPending(false)}
   return
  }
  if(/\b(?:custom|create|make|build|new|upload|import|my|saved)\b/i.test(raw)&&/\b(?:widget|plugin panel|plug-in panel|custom panel|side panel|panel builder)\b/i.test(raw)){
   onOpenCustomWidgets?.();reply('Opened Custom Widget Studio. Build a panel with EXO controls or import a saved widget definition, preview it, and save it in your local widget library.');return
  }
  if(/\b(?:simulate|simulation|drape|cloth\s*sim)\b/i.test(raw)&&/\b(?:run|start|begin|simulate|activate|turn on|make|do|please|can you)\b/i.test(raw)&&!/\b(?:how|show me|tutorial|workflow|teach|explain|where)\b/i.test(raw)){
   if(!onCompanionAction){reply('The simulation controls are unavailable in this workspace.');return}
   setPending(true);setWorkspaceActive(true);setWorkspaceTarget('3d-canvas');setFocus('3d-canvas');setTaskStatus('Starting cloth simulation…')
   try{const result=await onCompanionAction({type:'simulation',action:'start'});reply(result?.message||(result?.ok?'Cloth simulation started.':'The engine could not start simulation.'),{target:result?.target||'3d-canvas'})}
   catch(error){reply(`Simulation could not start: ${error.message}`)}
   finally{setPending(false);setTaskStatus('')}
   return
  }
  if(/\b(?:workflow mode|workflow builder|show (?:my )?workflows|automate (?:my|the) workflow|custom workflow|workflow automation)\b/i.test(raw)){
   setWorkflowOpen(true);reply('Workflow Studio is open. Choose a guided process or build your own from approved EXO actions. I can create a foundation pattern, apply size grading, and guide review steps.');return
  }
  if(/\b(?:auto[- ]?grade|automatically grade|grade (?:my|this|the|current) pattern)\b/i.test(raw)){
   if(!onCompanionAction){reply('Grading automation is not connected here.');return}
   setPending(true);setWorkspaceActive(true);setWorkspaceTarget('2d-canvas');setFocus('2d-canvas')
   try{
    const result=await onCompanionAction({type:'autoGrade',sizes:['XS','S','M','L','XL','XXL']})
    if(result?.ok)flashPattern()
    reply(result?.message||'Automatic grading was not confirmed.')
   }catch(error){reply(`Automatic grading could not be completed: ${error.message}`)}
   finally{setPending(false)}
   return
  }
  if(/\b(?:how (?:do|can|should) i|how to|where (?:can|do) i|teach me (?:to|about)|explain (?:how|the)|what does the|can you show me how)\b/i.test(raw)){
   const guide=answerExoToolQuestion20261102(raw)
   if(guide?.kind!=='clarify'){
    const target=guide.domain==='print'?'print-layout-window':guide.domain==='techpack'?'workspace-modes':guide.domain==='grading'?'grading-tool':guide.domain==='fabric'?'fabric-tool':guide.domain==='simulation'?'3d-canvas':guide.domain==='pattern'?'2d-canvas':'command-search'
    reply(guide.message,{target})
    return
   }
  }
  if(/\b(?:production readiness|factory ready|manufactur(?:ing|e) ready|pattern doctor|quality (?:check|control|review)|check (?:my|the|this) (?:garment|pattern|tech ?pack)|inspect (?:my|the|this) (?:garment|pattern)|fit report|garment audit|preflight (?:my|the|this) (?:garment|pattern))\b/i.test(raw)){
   const report=diagnoseExoGarment20261102(projectSnapshot)
   const highlighted=report.issues.slice(0,4).map(item=>item.message)
   reply(`I inspected the currently loaded garment: ${report.issues.length} documented checks require attention. ${highlighted.join(' ')} ${report.issues.length>highlighted.length?`${report.issues.length-highlighted.length} further findings remain. `:''}This review checks stored pattern and production metadata; it cannot certify physical fit, fabric performance, seam walking, or factory approval.`,{target:'2d-canvas'})
   return
  }
  if(/\b(?:plan (?:my|a|the)|make (?:a|me) (?:workflow|plan)|prepare (?:this|my|the) (?:hoodie|jacket|shirt|garment|collection)|launch (?:my|the) collection|project milestones|what (?:steps|should i do) next|workflow plan)\b/i.test(raw)){
   const plan=planExoAssistantRequest20261102(raw,{context:conversationRef.current,availableActions:[]})
   const steps=plan.steps.slice(0,7).map((step,index)=>`${index+1}. ${step.label}${step.status==='unsupported'?' (requires manual work or an integration)':''}`)
   reply(`Here is a workflow proposal for your request. ${steps.join('; ')}. I have not executed these steps. Ask me to create a supported foundation garment or navigate to its tools, and I can perform the verified operations with you.`)
   return
  }
  if(/\b(?:project summary|current garment status|what (?:am i|are we) working on|summari[sz]e (?:my|the|this) (?:garment|project))\b/i.test(raw)){
   const pieces=projectSnapshot?.pieces?.length||0,seams=projectSnapshot?.seams?.length||0
   reply(`Current project: ${projectSnapshot?.name||'Untitled'}. ${pieces} editable pattern pieces and ${seams} sewing relationships. Base size ${projectSnapshot?.grading?.baseSize||'unspecified'}, ${projectSnapshot?.grading?.sizes?.length||0} sizes defined. Undo ${projectUndoAvailable?'available':'unavailable'}; redo ${projectRedoAvailable?'available':'unavailable'}.`)
   return
  }
  if(/\b(?:my|saved|previous|past|all)\s+(?:fashion\s+)?(?:projects?|designs?|files?)\b|\b(?:project|design)\s+(?:library|memory)\b/i.test(raw)){
   const names=savedProjectContext.slice(0,8).map(item=>item.name).filter(Boolean)
   reply(names.length
    ?`I can see ${savedProjectContext.length} currently indexed saved designs, including ${names.join(', ')}. I can open File Library for more details. Ask “open my saved projects” when you want to browse.`
    :'I can see the active garment, but I have not indexed any saved projects in this browser yet. Ask me to open File Library to load your saved projects before we discuss them.')
   return
  }
  if(/\b(?:open|show|browse|go to)\b.*\b(?:saved projects?|file library|project library)\b/i.test(raw)){
   const result=await onCompanionAction?.({type:'navigate',target:'library'})
   reply(result?.message||'Saved project library is unavailable.',{target:result?.target||null})
   return
  }
  if(uiIntent.type==='gradingNest'||uiIntent.type==='workspace'||uiIntent.type==='navigate'||uiIntent.type==='theme'||uiIntent.type==='avatar'||uiIntent.type==='fabric'||uiIntent.type==='hardware'||uiIntent.type==='patternPrint'){
   if(!onCompanionAction){reply('This editor action is not connected yet.');return}
   setPending(true)
   const focusTarget=uiIntent.type==='patternPrint'?'print-layout-window':uiIntent.type==='gradingNest'?'2d-canvas':uiIntent.type==='theme'?'settings-window':null
   if(focusTarget){setWorkspaceTarget(focusTarget);setWorkspaceActive(true);setTaskStatus('Updating workspace…');setFocus(focusTarget)}
   try{
    const result=await onCompanionAction(uiIntent)
    if(result?.target){
     setFocus(result.target)
     setWorkspaceTarget(result.target)
     setWorkspaceActive(true)
     setTaskStatus(uiIntent.type==='patternPrint'?'Arranging real-size pattern tiles…':uiIntent.type==='theme'?'Theme settings':uiIntent.type==='gradingNest'?'Grading overlay':'EXO working here')
    }
    reply(result?.message||(result?.ok?'The editor updated.':'That action is unavailable in this workspace.'),{target:result?.target})
   }catch(error){reply(`The editor could not complete that action: ${error.message}`)}
   finally{setPending(false)}
   return
  }
  const fashionStyle=interpretExoFashionTeeCommand(raw)
  if(fashionStyle&&(/\b(?:make|crop|shorten|change|adjust|widen|modify|style|want|can you|please|more|slightly)\b/i.test(raw))){
   if((conversationRef.current.completedTemplateId||activeTemplateId)!=='tee'){
    reply('I understand: you want an oversized, boxier, or cropped silhouette. Load the Foundation Tee first and I can adjust the real front and back pattern outlines. Shall I make the T-shirt now?')
    conversationRef.current={...conversationRef.current,pendingTemplateId:'tee'}
    return
   }
   if(!onFashionEdit){reply('The fashion pattern editor is not connected here yet.');return}
   workingRef.current=true;setPending(true);setWorkspaceActive(true);setWorkspaceTarget('2d-canvas');setFocus('2d-canvas')
   setTaskStatus('Adjusting T-shirt silhouette…');flashPattern(['front','back'])
   setMessages(history=>[...history.slice(-23),{from:'assistant',text:'I’m updating the actual T-shirt pattern geometry to match your fit direction.'}])
   try{
    const result=await onFashionEdit(raw)
    if(!result?.ok)throw Error(result?.error||'No pattern change was confirmed')
    setTaskStatus('Pattern silhouette updated')
    flashPattern(['front','back'])
    const width=result.adjustmentsCm?.hemWidthPerPanel||0
    const length=Math.abs(result.adjustmentsCm?.bodyLength||0)
    reply(`I adjusted your editable T-shirt: ${width?width+' cm wider at each front and back hem. ':''}${length?length+' cm shorter in the body. ':''}The neckline, shoulders and sleeve attachment stay aligned. This gives a roomier, cropped foundation while keeping the existing sleeve geometry. Want a dropped shoulder next, or should we check the measurements? Fit and grading still need validation.`,{target:'2d-canvas'})
   }catch(error){setTaskStatus('');reply(`I couldn't apply that fit edit: ${error.message}`)}
   finally{workingRef.current=false;setPending(false)}
   return
  }
  const workflow=interpretExoCompanionWorkflow20261102(raw,conversationRef.current)
  if(workflow.kind==='cancel'){
   conversationRef.current={pendingTemplateId:null};setTaskStatus('');reply('No problem. Tell me what you want to work on instead.');return
  }
  if(workflow.kind==='measurements'){
   const garment=EXO_GARMENTS_20261102[workflow.templateId]
   reply(`We can use your own measurements for the ${garment.name}. To get an editable pattern on screen first, I can load our foundation pieces, then we can adjust the measurements. Say “load the template” when you want me to create it.`,{target:'pattern'})
   return
  }
  if(workflow.kind==='choose'){
   reply('What would you like to create: a T-shirt, hoodie, or pants? I can load real editable pattern pieces, ready for you to adjust.');return
  }
  if(workflow.kind==='offer'){
   conversationRef.current={pendingTemplateId:workflow.templateId}
   const garment=EXO_GARMENTS_20261102[workflow.templateId]
   reply(`I can make an editable ${garment.name} now. I’ll use the built-in foundation block to generate the actual front, back and other pattern pieces, then open them in the 2D editor. Should I go ahead?`,{target:'pattern'})
   return
  }
  if(workflow.kind==='create'){
   const garment=EXO_GARMENTS_20261102[workflow.templateId]
   conversationRef.current={pendingTemplateId:null}
   if(!onCreateGarment){reply('Garment creation is unavailable in this preview.');return}
   workingRef.current=true
   setPending(true);setWorkspaceActive(true);setWorkspaceTarget('2d-canvas');setTaskStatus(`Creating ${garment.name} pattern…`)
   flashPattern()
   setFocus('pattern')
   onNavigate?.('pattern')
   setMessages(history=>[...history.slice(-23),{from:'assistant',text:`I’m opening the 2D editor and creating your ${garment.name} pattern pieces now.`}])
   try{
    const result=await onCreateGarment(workflow.templateId)
    if(!result?.ok)throw Error(result?.error||'The editor did not confirm the new pattern')
    conversationRef.current={pendingTemplateId:null,completedTemplateId:workflow.templateId}
    setFocus('2d-canvas')
    setTaskStatus(`${result.pieceCount} actual pattern pieces loaded`)
    flashPattern(['front','back'])
    reply(`Your ${garment.name} is now loaded into the 2D workspace: ${result.pieceCount} editable pattern pieces and ${result.seamCount} sewing relationships. The outlines are real editable geometry, and you can undo this creation. Would you like to adjust the shape, check its measurements, or view the garment in 3D?`)
   }catch(error){
    setWorkspaceActive(false);setTaskStatus('');reply(`I couldn’t load the ${garment.name} pattern: ${error.message}. The editor did not confirm completion.`)
   }finally{workingRef.current=false;setPending(false)}
   return
  }
  if(conversationRef.current.completedTemplateId&&/\b(?:3d|three.dimensional|three d)\b/i.test(raw)&&/\b(?:show|open|view|go|switch|see|look|next|preview)\b/i.test(raw)){
   setWorkspaceActive(false)
   setTaskStatus('')
   setFocus('workspace')
   pendingActionRef.current=raw;lastObserved.current=commandResult
   onCommand?.('show 3d')
   return
  }
  if(conversationRef.current.completedTemplateId&&/\b(?:simulate|drape|run (?:the )?simulation)\b/i.test(raw)){
   setWorkspaceActive(false)
   pendingActionRef.current=raw;lastObserved.current=commandResult
   setFocus('workspace-modes')
   onCommand?.('simulate')
   return
  }
  if(/\b(stop|cancel|leave me alone|quiet)\b/.test(lower)&&/\b(speak|voice|talk|listen|tour|explor|guide|cancel)\b/.test(lower)){
   stopAudio();setExploring(false);setFocus(null);reply('Okay, I’ve stopped. I’ll be here when you need help.');return
  }
  if(/\b(explore|show me around|what (?:does|do) (?:each|these) button|explain (?:the|each) button)\b/.test(lower)){
   setExploring(true);reply('I can follow the interface with you now. Hover over or select a tool and I’ll fly over to it, highlight it, and explain what it does. Ask me any question along the way.',{target:'pattern'});return
  }
  if(/\b(this button|that button|this tool|highlighted|what is this|what does this)\b/.test(lower)){
   if(focus&&CONTROLS[focus]){reply(CONTROLS[focus],{target:focus});return}
   setExploring(true);reply('Point to a button and I’ll come over and explain it. You can also say, for example, “What does Pattern do?”',{target:'pattern'});return
  }
  if(/\b(first|start|create|make|build|design|help)\b/.test(lower)&&/\b(t.?shirt|hoodie|pants|trousers|jacket|sweatshirt|pattern)\b/.test(lower)){
   const garment=/hoodie|sweatshirt/.test(lower)?'hoodie':/pants|trousers/.test(lower)?'pants':/jacket/.test(lower)?'jacket':/t.?shirt/.test(lower)?'T-shirt':null
   reply(garment?`A ${garment} is a great place to start. I’ll show you Pattern, where we can draft your pieces. Do you already have measurements or a reference garment, or should we start with a basic template?`:'We can make a pattern together. What garment do you want to design first: a T-shirt, hoodie, pants, or something else?',{target:'pattern',navigate:garment?'pattern':null});return
  }
  if(topic&&/\b(open|take me|go to|switch to|navigate|show me (?:the|where))\b/.test(lower)){
   reply(`I’ll open ${topic.title.toLowerCase()} for you. ${topic.reply}`,{target:topic.target,navigate:topic.navigate});return
  }
  if(topic&&/\b(teach|how|what|why|explain|guide|tutorial|where|show|learn|help|use)\b/.test(lower)){
   reply(topic.reply,{target:topic.target});return
  }
  // Use the existing authenticated EXO local model for more open-ended dialogue.
  // Its suggestions are read-only until the visitor explicitly requests a verified tool operation.
  const command=/\b(save|undo|redo|import svg|simulate|drape|apply|reset|widen|crop|seam allowance|export|start simulation|stop simulation)\b/i.test(raw)
  if(command){
   pendingActionRef.current=raw;lastObserved.current=commandResult
   if(/save/i.test(raw))setFocus('save')
   else if(/import/i.test(raw))setFocus('command-search')
   else if(/simulate|drape|reset/i.test(raw))setFocus('workspace-modes')
   onCommand?.(raw);return
  }
  if(topic){reply(topic.reply,{target:topic.target});return}
  if(appQuestion.kind==='navigate'){
   if(appQuestion.topic==='widget-studio')onOpenCustomWidgets?.()
   else if(appQuestion.topic==='settings')await onCompanionAction?.({type:'navigate',target:'settings',tab:'workspace'})
   else if(appQuestion.topic==='techpack')await onCompanionAction?.({type:'navigate',target:'techpack'})
   else if(appQuestion.topic==='library')await onCompanionAction?.({type:'navigate',target:'library'})
   else if(appQuestion.topic==='print')onNavigate?.('print')
   else onNavigate?.(appQuestion.topic==='production'?'grading':appQuestion.topic)
   reply(appQuestion.message)
   return
  }
  setPending(true)
  try{
   if(aiProvider!=='local'){
    setWorkspaceActive(true);setTaskStatus(`${aiProvider==='anthropic'?'Claude':'ChatGPT'} is planning…`)
    const response=await fetch('/api/exo-assistant/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:aiProvider,specialistId,message:raw,section:activeSection,view:workspaceLayout,selectedPiece:selectedPieceName||'',history:messages.slice(-6).map(entry=>({role:entry.from==='user'?'user':'assistant',content:entry.text.slice(0,500)}))})})
    const result=await response.json()
    if(!result.ok){reply(result.reason||`${aiProvider} is not connected to the EXO server.`);return}
    if(result.proposedAction){
     const receipt=await executeExoCompanionProviderProposal20261102({...result,provider:aiProvider},{executeAction:async ({action,args})=>{
      const intent=action==='workspace.view'?{type:'workspace',value:args.layout}:action==='simulation.start'?{type:'simulation',action:'start'}:action==='library.open'?{type:'fabric',action:'open'}:null
      if(!intent||!onCompanionAction||action==='library.open')return {ok:false,message:'This action has no verified bridge in EXO yet.'}
      const animation=await executeExoCompanionAnimatedAction20261102(intent,onCompanionAction,{onState:state=>{setTaskStatus(state.label);if(state.target){setWorkspaceTarget(state.target);setFocus(state.target)}if(state.phase==='verified'&&state.pieceIds.length)flashPattern(state.pieceIds)}})
      return animation.result
     }})
     reply(`${result.reply} ${receipt.ok?`EXO confirmed: ${receipt.receipt.message||receipt.action}.`:`The suggested action was not performed: ${receipt.error||'No verified handler'}.`}`)
    }else reply(result.reply)
    return
   }
   let result=await onLocalAsk?.(raw)
   // In the standalone Vite browser, the native desktop bridge is absent.
   // The same read-only Ollama service can be reached through local middleware.
   if(!result?.ok){
    try{
     const response=await fetch('/api/exo-assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      message:raw,section:activeSection,view:workspaceLayout,selectedPiece:selectedPieceName||'',
      garmentContext,
      history:messages.slice(-8).map(entry=>({role:entry.from==='user'?'user':'assistant',content:entry.text.slice(0,500)})),
     })})
     if(response.ok)result=await response.json()
    }catch{}
   }
   if(result?.ok&&result.reply){
    const nav=result.suggestedNavigation&&result.suggestedNavigation!=='none'?result.suggestedNavigation:null
    const asksNavigation=/\b(?:open|take me to|go to|switch to|navigate|show me where|where is|where are)\b/i.test(raw)
    if(nav&&asksNavigation){
     if(nav==='settings')await onCompanionAction?.({type:'navigate',target:'settings',tab:'workspace'})
     else if(nav==='widgets')onOpenCustomWidgets?.()
     else if(nav==='library')await onCompanionAction?.({type:'navigate',target:'library'})
     else if(nav==='techpack')await onCompanionAction?.({type:'navigate',target:'techpack'})
     else onNavigate?.(nav)
    }
    reply(result.reply,{target:TARGETS[nav]||null});return
   }
   reply(appQuestion.kind==='answer'?appQuestion.message:'The local AI model is unavailable right now. I can still explain the verified EXO tools, guide you through tutorials, show theme options and carry out supported commands. Describe the workspace or tool you want to work with.')
  }catch{reply(appQuestion.kind==='answer'?appQuestion.message:'The local AI service could not be reached. I can still guide you through the real EXO tools and perform supported editor actions.')}
  finally{setPending(false);setTaskStatus('')}
 },[pending,listening,focus,commandResult,onCommand,onCreateGarment,onFashionEdit,onCompanionAction,onOpenCustomWidgets,savedProjectContext,activeTemplateId,garmentContext,projectSnapshot,projectUndoAvailable,onLocalAsk,onNavigate,reply,stopAudio,stopTour,stopCelebration,startTour,celebrate,activeSection,workspaceLayout,selectedPieceName,messages,flashPattern,themeContext,themeExplorerOpen,currentThemeId,tourMode,tourIndex,applyTheme,openThemeSettings,aiProvider,specialistId,editorSignature,patternSketch])
 runRef.current=handlePrompt

 const toggleMic=()=>{
  if(listening){voiceController.current?.stopRecognition();return}
  const result=voiceController.current?.startRecognition({
   onInterim:phrase=>{setInterim(phrase);setText(phrase)},
   onFinal:phrase=>{setInterim('');runRef.current?.(phrase)},
  })
  if(result?.ok)setNotice('Listening. Speak naturally, or type your reply instead.')
 }
 const toggleVoice=()=>{if(voiceOn){setVoiceOn(false);stopAudio()}else{voiceController.current?.activateSpeechGesture?.();setVoiceOn(true);setNotice('Voice replies enabled. Press the preview speaker or start a tutorial to hear EXO.')}}
 const emotion=blink?'blink':celebrating?'happy':listening?'surprised':speaking?'happy':focus?'curious':'idle'
 const bubble=celebrating?'PARTY TIME':focus&&CONTROLS[focus]?focus.replaceAll('-',' ').toUpperCase():speaking?'SPEAKING':listening?'LISTENING':open?'HERE TO HELP':'ASK EXO'
 const dockOrbStyle=!orbPosition&&placement.mode!=='floating'&&!compactDock?(
  placement.mode==='right'?{left:Math.max(8,innerWidth-Math.min(385,innerWidth-16)-96),top:Math.max(65,innerHeight-164),right:'auto',bottom:'auto'}
  :placement.mode==='left'?{left:Math.min(innerWidth-82,Math.min(385,innerWidth-16)+14),top:Math.max(65,innerHeight-164),right:'auto',bottom:'auto'}
  :placement.mode==='top'?{left:Math.min(innerWidth-86,30),top:Math.min(innerHeight-140,Math.round(innerHeight*.48)+42),right:'auto',bottom:'auto'}
  :{left:Math.min(innerWidth-86,30),top:Math.max(34,Math.round(innerHeight*.50)-90),right:'auto',bottom:'auto'}
 ):null
 return <>
  {celebrating&&<div className="exo-ai-party-overlay" aria-label="EXO celebration lights" role="status"><span>EXO STUDIO CELEBRATION</span><button type="button" onClick={stopCelebration}>Stop music and lights</button></div>}
  {focus&&spotlight&&<div className="exo-ai-guide-spotlight" aria-hidden="true" style={{left:spotlight.x,top:spotlight.y,width:spotlight.w,height:spotlight.h}}/>}
  {exploring&&focus==='hovered-tool'&&spotlight&&<div className="exo-ai-tool-tooltip" role="status" style={{left:clamp(spotlight.x,8,Math.max(8,innerWidth-215)),top:clamp(spotlight.y+spotlight.h+9,8,Math.max(8,innerHeight-46))}}>{toolInfo}</div>}
  {workspaceActive&&workspaceOutline&&<div className="exo-ai-workspace-outline" aria-label="EXO assistant active in 2D pattern workspace" style={{left:workspaceOutline.x,top:workspaceOutline.y,width:workspaceOutline.w,height:workspaceOutline.h}}><span>{taskStatus||'EXO WORKING IN 2D'}</span></div>}
  {patternVisual&&workspaceOutline&&<div key={actionPulse} className="exo-ai-pattern-craft" aria-hidden="true" style={{left:workspaceOutline.x+Math.min(85,workspaceOutline.w*.09),top:workspaceOutline.y+Math.min(78,workspaceOutline.h*.12)}}>
   <svg viewBox="0 0 150 150" focusable="false"><path d="M37 30 L55 21 Q75 44 95 21 L113 30 L142 58 L121 83 L106 69 L106 138 L44 138 L44 69 L29 83 L8 58 Z"/></svg>
   <span>{taskStatus||'Drafting pattern'}</span>
  </div>}
  {liveCharacterSettings.enabled&&<div className={`exo-ai-character ${focus?'touring':''} ${listening?'listening':''} ${speaking?'speaking':''} ${open?'is-open':''} ${celebrating?'party':''} ${blink?'blinking':''} ${liveCharacterSettings.movement==='steady'&&!celebrating?'exo-ai-character--steady':''}`} style={{...(celebrating?wanderPosition||orbPosition||dockOrbStyle:focus||tourIndex>=0||listening?orbPosition||dockOrbStyle||{}:wanderPosition||orbPosition||dockOrbStyle||{}),'--exo-character-scale':orbScale,transitionDuration:liveCharacterSettings.movement==='pointer-follow'?'0.16s':liveCharacterSettings.movement==='gentle'?'3.8s':liveCharacterSettings.movement==='energetic'?'0.48s':undefined}} data-exo-ai-character="true">
   {liveCharacterSettings.showTitle&&<span className="exo-ai-character-speech" role="status">{bubble}</span>}
   <button type="button" aria-label={open?'Close EXO assistant':'Talk to EXO assistant'} aria-expanded={open} onClick={()=>onOpenChange(!open)}>
    <span className="exo-ai-orb-shell"><span className="exo-ai-orb-inner"><CircleEyes settings={{...avatar,...toExoCompanionCircleEyesSettings20261102(liveCharacterSettings)}} emotion={emotion} look={gaze} compact motion={false}/></span></span>
    <span className="exo-ai-orb-halo" aria-hidden="true"/>
   </button>
  </div>}
  {draggingDock&&!compactDock&&<div className="exo-ai-dock-targets" aria-hidden="true">
   {dockPreview?.preview&&<div className={`exo-ai-dock-target-preview exo-ai-dock-target-preview--${dockPreview.target}`} style={{left:dockPreview.preview.left,top:dockPreview.preview.top,width:dockPreview.preview.width,height:dockPreview.preview.height}}><span>{DOCKS.find(item=>item.id===dockPreview.target)?.label||'Dock here'}</span></div>}
   {DOCKS.map(({id,label})=><div key={id} className={`exo-ai-dock-target exo-ai-dock-target--${id} ${dockPreview?.target===id?'is-targeted':''}`}><span>{label}</span></div>)}
  </div>}
  {open&&<section ref={panelRef} id="clo-arai-chat" className={`exo-ai-panel exo-ai-panel--${embeddedDock?placement.mode:'floating'} ${embeddedDock?'exo-ai-panel--embedded':''} ${draggingDock?'exo-ai-panel--dragging':''} ${patternConversation.proposal&&patternPreviewVisible?'exo-ai-panel--pattern-draft':''}`} data-orb-side={workspaceActive||orbPosition?.left>innerWidth/2?'right':'left'} style={(!embeddedDock&&placement.mode==='floating'&&placement.x!==null)?{left:placement.x,top:placement.y,right:'auto',bottom:'auto',maxHeight:Math.max(180,innerHeight-(placement.y||0)-8)}:undefined} role="dialog" aria-label="EXO conversational voice assistant" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();if(!draggingDock)onOpenChange(false)}}}>
   <header className="exo-ai-panel-header" onPointerDown={startDrag} title="Drag freely; hover over a highlighted docking label for a moment to dock">
    <span className="exo-ai-drag-grip" aria-hidden="true"><Grip size={17}/></span>
    <div className="exo-ai-panel-identity"><span className={`exo-ai-live-dot ${speaking?'speaking':''}`}/><div><strong>EXO COMPANION</strong><small>{listening?'LISTENING':speaking?'SPEAKING':pending?'THINKING':'TALK • POINT • CREATE'}</small></div></div>
    <div className="exo-ai-panel-actions">
     <button type="button" title="Move or dock companion" aria-label="Move or dock companion" aria-expanded={dockMenu} onClick={()=>setDockMenu(value=>!value)}><Move size={16}/></button>
     <button type="button" title={voiceOn?'Mute voice':'Enable voice'} aria-label={voiceOn?'Mute voice':'Enable voice'} onClick={toggleVoice}>{voiceOn?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>
     <button type="button" aria-label="Close assistant" onClick={()=>onOpenChange(false)}><X size={17}/></button>
    </div>
   </header>
   {dockMenu&&<div className="exo-ai-dock-menu" role="group" aria-label="EXO panel placement">
    <button type="button" onClick={()=>dock('floating')} aria-pressed={placement.mode==='floating'}><Move size={15}/> Float</button>
    {DOCKS.map(({id,label,Icon})=><button key={id} type="button" onClick={()=>dock(id)} aria-pressed={placement.mode===id}><Icon size={15}/>{label}</button>)}
   </div>}
   <div className="exo-ai-panel-body">
    <div className="exo-ai-context"><span>IN</span><strong>{activeSection}</strong><span>VIEW</span><strong>{workspaceLayout.toUpperCase()}</strong>{selectedPieceName&&<><span>SELECTED</span><strong>{selectedPieceName}</strong></>}</div>
    <div className="exo-ai-voice-settings"><label htmlFor="exo-ai-voice">VOICE</label><select id="exo-ai-voice" value={voiceChoice} onChange={event=>{stopAudio();setVoiceChoice(event.target.value)}} aria-label="Select assistant voice">
     <option value="auto">Best available {azureAvailable?'(Microsoft neural)':neuralVoices.length?'(local neural)':macVoices.length?'(macOS studio)':'(system)'}</option>
     {azureAvailable&&<option value="azure">Microsoft neural · Jenny</option>}
     {neuralVoices.map(name=><option key={name} value={`neural:${name}`}>Kokoro neural · {({af_heart:'Heart',af_bella:'Bella',am_michael:'Michael',am_adam:'Adam'})[name]||name}</option>)}
     {macVoices.map(name=><option key={name} value={`mac:${name}`}>macOS Studio · {name.replace(/ \(English \(US\)\)/,'')}</option>)}
     {voices.filter(v=>/^en[-_]/i.test(v.lang)&&!/Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Jester|Junior|Organ|Trinoids|Whisper|Wobble|Zarvox|Superstar|Good News/i.test(v.name)).map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name}{/Microsoft/i.test(v.name)?' · Microsoft':''}</option>)}
    </select><button type="button" onClick={()=>{voiceController.current?.activateSpeechGesture?.();if(!voiceOn){setVoiceOn(true);void voiceController.current?.speak('Hi, I’m EXO. Tell me what you want to create.',{choice:voiceChoice,azureAvailable,neuralAvailable:neuralVoices.length>0,localAvailable:macVoices.length>0})}else speak('Hi, I’m EXO. Tell me what you want to create.')}} aria-label="Test voice playback"><AudioLines size={15}/></button></div>
    <div className="exo-ai-dialogue" aria-label="Assistant conversation" aria-live="polite">
     {messages.map((entry,i)=><div key={`${entry.from}-${i}`} className={`exo-ai-chatline ${entry.from}`}><small>{entry.from==='user'?'YOU':'EXO'}</small><p>{entry.text}</p></div>)}
    {pending&&<div className="exo-ai-thinking">{taskStatus||'Considering your request…'}</div>}
     <div ref={messagesEnd}/>
    </div>
    {['ready','unresolved'].includes(patternSketch.state)&&<div className="exo-ai-pattern-attachment" role="status">
      {patternSketch.mode==='photo'&&patternSketch.previewUrl&&<img className="exo-ai-pattern-photo-thumbnail" src={patternSketch.previewUrl} alt="Locally attached photo reference; garment identity and scale unverified"/>}
      <span><ImagePlus size={13}/> {patternSketch.mode==='photo'?(patternSketch.state==='ready'?'Photo ready: ':'Photo needs review: '):'Sketch ready: '}{patternSketch.name}</span>
      <button type="button" onClick={()=>{setPatternSketch({state:'idle'});setPhotoVision({state:'idle'})}} aria-label="Remove attached garment reference">Remove</button>
    </div>}
    {patternSketch.state==='loading'&&<p className="exo-ai-pattern-attachment" role="status">Examining {patternSketch.mode==='photo'?'photo foreground':'sketch silhouette'} locally…</p>}
    {patternSketch.state==='error'&&<p className="exo-ai-pattern-attachment" role="alert">{patternSketch.mode==='photo'?'Photo':'Sketch'} reference rejected: {patternSketch.error}</p>}
    {patternSketch.mode==='photo'&&['ready','unresolved'].includes(patternSketch.state)&&<div className="exo-ai-photo-vision-review" aria-label="Local garment photo vision review">
      {patternSketch.state==='unresolved'&&<small>No reliable garment contour was found. A local vision description can still provide suggestions, but cannot produce cutlines from this photo.</small>}
      <button type="button" disabled={photoVision.state==='loading'} onClick={analyzeAttachedPhotoWithVision}>{photoVision.state==='loading'?'Analyzing locally…':'Analyze visible details with local AI vision'}</button>
      {photoVision.state==='error'&&<p role="alert">Local photo interpretation unavailable: {photoVision.error}</p>}
      {photoVision.state==='ready'&&<>
        <strong>Unverified photo interpretation</strong>
        <span>{photoVision.result.family} · {photoVision.result.silhouette} silhouette · {photoVision.result.approximateColor} color · visible closure: {photoVision.result.visibleClosure}</span>
        <small>Uncertainty: {photoVision.result.uncertainties.length?photoVision.result.uncertainties.join(', '):'Not reported'}. {photoVision.plan?.decisionBlockers?.join(' ')||''} No actual pattern measurements or hidden sewing geometry were derived.</small>
        {photoVision.plan?.suggestedPrompt&&<button type="button" onClick={()=>{
          setText(photoVision.plan.suggestedPrompt)
          reply('I placed the visual suggestion into your message field. Review or edit the garment type and silhouette, then press Send to request a separate editable pattern draft. No garment was replaced.')
        }}>Review suggested garment description</button>}
      </>}
    </div>}
    {patternConversation.proposal&&patternPreviewVisible&&<ExoCompanionPatternReview20261102
      key={patternConversation.proposalKey}
      proposal={patternConversation.proposal}
      proposalKey={patternConversation.proposalKey}
      sourceSignature={patternPreviewSourceSignature}
      currentSignature={editorSignature}
      nativeMode={nativePatternMode}
      onApply={onPatternDraft}
      onInstalled={result=>{if(result.ok){flashPattern(patternConversation.proposal.project.pieces.slice(0,6).map(piece=>piece.id));reply(result.message);setPatternPreviewSourceSignature('')}else reply('The pattern import was blocked. Your prior editor garment remains available.')}}
    />}
    <div className="exo-ai-guide-controls">
     <label style={{display:'inline-flex',gap:5,alignItems:'center',fontSize:11}}>AI <select aria-label="EXO Companion AI provider" value={aiProvider} onChange={event=>setAiProvider(event.target.value)}><option value="local">Local EXO</option><option value="openai" disabled={!providerAvailability.openai}>ChatGPT {providerAvailability.openai?'':'(not connected)'}</option><option value="anthropic" disabled={!providerAvailability.anthropic}>Claude {providerAvailability.anthropic?'':'(not connected)'}</option></select></label>
     <label style={{display:'inline-flex',gap:5,alignItems:'center',fontSize:11}}>SPECIALIST <select aria-label="EXO Companion specialist" value={specialistId} onChange={event=>setSpecialistId(event.target.value)}>{EXO_COMPANION_SPECIALISTS_20261102.map(specialist=><option key={specialist.id} value={specialist.id}>{specialist.name}</option>)}</select></label>
     <button type="button" className={exploring?'selected':''} onClick={()=>{stopTour();setExploring(v=>!v);if(!exploring)reply('Hover over a tool and I’ll fly to it. Select a button to hear what it does.',{target:'pattern'});else{setFocus(null);setNotice('Interface exploration paused.')}}}><Compass size={14}/>{exploring?'Explore · On':'Explore'}</button>
     <button type="button" className={tourIndex>=0?'selected':''} onClick={()=>tourIndex>=0?stopTour():startTour('full')}><Play size={13}/>{tourIndex>=0?'Stop tour':'Quick tour'}</button>
     <button type="button" className={celebrating?'selected':''} onClick={()=>celebrating?stopCelebration():celebrate()}><Music2 size={13}/>{celebrating?'Stop party':'Celebrate'}</button>
     <button type="button" className={tutorialOpen?'selected':''} onClick={()=>{setTutorialOpen(open=>!open);setWorkflowOpen(false)}} aria-expanded={tutorialOpen} aria-controls="exo-ai-tutorial-panel"><BookOpen size={13}/> Tutorials</button>
     <button type="button" className={themeExplorerOpen?'selected':''} onClick={()=>{setThemeExplorerOpen(open=>!open);setWorkflowOpen(false)}} aria-expanded={themeExplorerOpen} aria-controls="exo-ai-theme-explorer"><Settings2 size={13}/> Themes</button>
     <button type="button" className={workflowOpen?'selected':''} onClick={()=>{setWorkflowOpen(open=>!open);setTutorialOpen(false)}} aria-expanded={workflowOpen} aria-controls="exo-ai-workflow-panel"><Settings2 size={13}/> Workflows</button>
     <button type="button" onClick={()=>onOpenCustomWidgets?.()}><PanelsTopLeft size={13}/> My widgets</button>
     {focus&&<button type="button" onClick={()=>{stopTour();setWorkspaceActive(false);setFocus(null);setExploring(false)}}>Return orb</button>}
    </div>
    {tutorialOpen&&<div id="exo-ai-tutorial-panel" className="exo-ai-tutorial-panel">
     <label htmlFor="exo-ai-tour-choice">Learn an EXO workflow</label>
     <select id="exo-ai-tour-choice" value={tourMode} onChange={event=>{if(tourIndex>=0)stopTour();setTourMode(event.target.value)}}>{TUTORIAL_OPTIONS.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select>
     <div className="exo-ai-tutorial-actions">
      <button type="button" onClick={()=>startTour(tourMode,tourIndex>=0?tourIndex:0)}><Play size={13}/> {tourIndex>=0?'Restart step':'Start guided lesson'}</button>
      {tourIndex>=0&&!tourPaused&&<button type="button" onClick={pauseTour}><Pause size={13}/> Pause</button>}
      {tourPaused&&<button type="button" onClick={()=>startTour(tourMode,Math.max(0,tourIndex))}><Play size={13}/> Resume</button>}
      {(tourIndex>=0||tourPaused)&&<button type="button" onClick={()=>startTour(tourMode,Math.min((EXO_COMPANION_TOUR_MODES[tourMode]||[]).length-1,tourIndex+1))}>Next step <ArrowRight size={13}/></button>}
     </div>
     {tourIndex>=0&&<small role="status">Step {tourIndex+1} of {(EXO_COMPANION_TOUR_MODES[tourMode]||[]).length}: {(EXO_COMPANION_TOUR_MODES[tourMode]||[])[tourIndex]?.title}</small>}
    </div>}
    {themeExplorerOpen&&<div id="exo-ai-theme-explorer" className="exo-ai-theme-explorer">
     <strong>Theme Explorer</strong>
     <small>{STUDIO_THEME_PRESETS.length} installed interface palettes · active: {STUDIO_THEME_PRESETS.find(theme=>theme.id===currentThemeId)?.name||currentThemeId}</small>
     <label htmlFor="exo-ai-theme-search">Search theme options</label>
     <input id="exo-ai-theme-search" value={themeExplorerQuery} onChange={event=>{setThemeExplorerQuery(event.target.value);setThemeExplorerLimit(12)}} placeholder="Search blue, violet, light, cream…"/>
     <select aria-label="Filter theme categories" value={themeExplorerCategory} onChange={event=>{setThemeExplorerCategory(event.target.value);setThemeExplorerLimit(12)}}>
      {['All',...new Set(STUDIO_THEME_PRESETS.map(theme=>theme.category))].map(category=><option key={category} value={category}>{category}</option>)}
     </select>
     <select aria-label="Filter theme brightness" value={themeExplorerMode} onChange={event=>{setThemeExplorerMode(event.target.value);setThemeExplorerLimit(12)}}>
      <option value="All">All brightness</option><option value="Light">Light palettes</option><option value="Dark">Dark palettes</option>
     </select>
     <div className="exo-ai-theme-grid" role="group" aria-label="Installed EXO themes">
      {themeOptions.slice(0,themeExplorerLimit).map(theme=><button key={theme.id} type="button" aria-label={`Apply ${theme.name} theme`} aria-pressed={theme.id===currentThemeId} onClick={()=>{void applyTheme(theme.id).then(result=>replyRef.current?.(result?.message||'The theme could not be applied.',{target:'settings-window'}))}}>
       <span className="exo-ai-theme-colors" aria-hidden="true"><i style={{background:theme.sidebarColor}}/><i style={{background:theme.panelColor}}/><i style={{background:theme.accent}}/></span>
       <span>{theme.name}</span>
      </button>)}
     </div>
     <small>{themeOptions.length} matching palettes{themeOptions.length>themeExplorerLimit?` · showing first ${themeExplorerLimit}`:''}</small>
     <div className="exo-ai-theme-actions">
      {themeOptions.length>themeExplorerLimit&&<button type="button" onClick={()=>setThemeExplorerLimit(n=>n+12)}>Show more</button>}
      <button type="button" onClick={()=>{void openThemeSettings().then(result=>replyRef.current?.(result?.message||'Could not open Theme Settings.'))}}>Open all theme settings</button>
      <button type="button" onClick={()=>{setTutorialOpen(true);startTour('theme')}}>Guide me through themes</button>
     </div>
    </div>}
    {workflowOpen&&<div id="exo-ai-workflow-panel" className="exo-ai-workflow-panel" aria-label="EXO workflow studio">
     <label htmlFor="exo-ai-workflow-select">Workflow Studio · automated steps</label>
     <select id="exo-ai-workflow-select" value={workflowId} onChange={event=>chooseWorkflow(event.target.value)}>
      {workflowOptions.map(flow=><option key={flow.id} value={flow.id}>{flow.title}</option>)}
     </select>
     {selectedWorkflow&&<>
      {selectedWorkflow.steps.some(step=>step.id==='create')&&<div className="exo-ai-workflow-config"><label htmlFor="exo-ai-workflow-template">Foundation garment</label><select id="exo-ai-workflow-template" value={workflowTemplateId} onChange={event=>setWorkflowTemplateId(event.target.value)}><option value="tee">T-shirt</option><option value="hoodie">Hoodie</option><option value="pants">Pants</option></select></div>}
      <ol className="exo-ai-workflow-steps">
       {selectedWorkflow.steps.map((step,index)=><li key={`${step.id}-${index}`} className={index===workflowIndex?'current':index<workflowIndex?'finished':''}><span>{step.label}</span>{index<workflowIndex?<Check size={13}/>:index===workflowIndex?<span>Next</span>:null}</li>)}
      </ol>
      {workflowIndex<selectedWorkflow.steps.length?<>
       {selectedWorkflow.steps[workflowIndex]?.checkpoint&&<small>{selectedWorkflow.steps[workflowIndex].checkpoint}</small>}
       {selectedWorkflow.steps[workflowIndex]?.requiresConfirmation&&<label className="exo-ai-workflow-approval"><input type="checkbox" checked={workflowConfirm} onChange={event=>setWorkflowConfirm(event.target.checked)}/> I approve replacing the current pattern with a new {EXO_GARMENTS_20261102[workflowTemplateId]?.name} foundation.</label>}
       <div className="exo-ai-workflow-actions"><button type="button" disabled={workflowBusy||pending||(selectedWorkflow.steps[workflowIndex]?.requiresConfirmation&&!workflowConfirm)} onClick={()=>runWorkflowSteps()}><Play size={13}/> Run next step</button><button type="button" disabled={workflowBusy||pending||(selectedWorkflow.steps[workflowIndex]?.requiresConfirmation&&!workflowConfirm)} onClick={()=>runWorkflowSteps({continueSafe:true})}>Auto-run to review</button><button type="button" onClick={()=>{workflowAbortRef.current++;setWorkflowIndex(0);setWorkflowConfirm(false);setTaskStatus('')}}>Reset</button></div>
      </>:<p>All supported steps completed. Inspect the result and save your project.</p>}
     </>}
     <div className="exo-ai-workflow-custom-actions"><button type="button" onClick={()=>setCustomEditing(open=>!open)}>{customEditing?'Close custom builder':'Create custom workflow'}</button>{workflowId.startsWith('custom-')&&<button type="button" onClick={()=>{const next=customWorkflows.filter(flow=>flow.id!==workflowId);const saved=saveExoCompanionCustomWorkflows20261102(window.localStorage,next);if(saved.ok){setCustomWorkflows(next);chooseWorkflow('pattern-creation')}}}>Delete custom</button>}</div>
     {customEditing&&<div className="exo-ai-custom-builder">
      <label htmlFor="exo-ai-custom-name">Custom workflow name</label><input id="exo-ai-custom-name" value={customName} maxLength={100} onChange={event=>setCustomName(event.target.value)} placeholder="My garment production workflow"/>
      <div className="exo-ai-workflow-config"><select aria-label="Add workflow step" value={stepToAdd} onChange={event=>setStepToAdd(event.target.value)}>{availableWorkflowSteps.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button type="button" disabled={customSteps.length>=12} onClick={()=>setCustomSteps(current=>[...current,stepToAdd])}>Add step</button></div>
      <ol className="exo-ai-custom-steps">{customSteps.map((id,index)=><li key={`${id}-${index}`}><span>{availableWorkflowSteps.find(([key])=>key===id)?.[1]||id}</span><button type="button" disabled={index===0} aria-label="Move step up" onClick={()=>setCustomSteps(current=>{const copy=[...current];[copy[index-1],copy[index]]=[copy[index],copy[index-1]];return copy})}>↑</button><button type="button" disabled={customSteps.length<=1} aria-label="Remove step" onClick={()=>setCustomSteps(current=>current.filter((_,i)=>i!==index))}>×</button></li>)}</ol>
      <button type="button" onClick={saveCustomWorkflow} disabled={!customName.trim()||!customSteps.length}>Save custom workflow</button>
     </div>}
    </div>}
    {messages.length<4&&<div className="exo-ai-suggestions">{STARTERS.map(item=><button type="button" key={item} onClick={()=>handlePrompt(item)}>{item}<ArrowRight size={12}/></button>)}</div>}
    {notice&&<p className="exo-ai-notice" role="status">{notice}</p>}
   </div>
   <form className="exo-ai-composer" onSubmit={event=>{event.preventDefault();handlePrompt(text)}}>
    <button type="button" className={listening?'recording':''} aria-label={listening?'Stop listening':'Speak to EXO'} onClick={toggleMic}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button>
    <button type="button" aria-label="Attach garment sketch" title="Attach a closed sketch for conversational pattern drafting" onClick={()=>patternSketchInput.current?.click()}><ImagePlus size={16}/></button>
    <button type="button" aria-label="Attach garment photo reference" title="Analyze a single garment photo locally as an uncalibrated visual reference" onClick={()=>patternPhotoInput.current?.click()}><ImagePlus size={16}/><span className="exo-ai-attach-photo-label">PHOTO</span></button>
    <input ref={patternSketchInput} type="file" aria-label="Upload garment sketch to EXO" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{void attachPatternSketch(event.target.files?.[0],'sketch');event.target.value=''}}/>
    <input ref={patternPhotoInput} type="file" aria-label="Upload garment photo reference to EXO" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{void attachPatternSketch(event.target.files?.[0],'photo');event.target.value=''}}/>
    <input aria-label="Ask EXO about the application" value={interim||text} onChange={event=>{if(listening)voiceController.current?.stopRecognition();setInterim('');setText(event.target.value)}} maxLength={600} placeholder={listening?'Listening to you…':'Talk to EXO or ask about any tool…'}/>
    <button type="submit" aria-label="Send to EXO" disabled={!text.trim()||pending}><Send size={17}/></button>
   </form>
   <div className="exo-ai-panel-footer"><Check size={12}/><span>{neuralVoices.length?'Local neural voice ready · Mic needs browser permission · Text always works':'Mic needs browser permission · Local/system voice available · Microsoft voice optional'}</span></div>
  </section>}
 </>
}

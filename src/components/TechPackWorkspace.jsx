import React, {useEffect,useMemo,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {BookOpen,ChevronLeft,ChevronRight,Columns3,Download,FileImage,FilePlus2,FileSpreadsheet,FolderOpen,Highlighter,ImagePlus,LayoutTemplate,Maximize2,MousePointer2,MoveUpRight,PenTool,Pencil,Plus,Printer,RefreshCw,Rows3,Ruler,Settings2,Table2,Tag,Trash2,Upload,Scaling,ClipboardCheck,Square,Type,Shapes,Combine,Layers3,AlignHorizontalJustifyStart,AlignHorizontalJustifyCenter,AlignHorizontalJustifyEnd,AlignVerticalJustifyStart,AlignVerticalJustifyCenter,AlignVerticalJustifyEnd,ZoomIn,ZoomOut,ArrowUpToLine,ArrowDownToLine,CopyPlus,Save,Grid3X3,Grid2X2,RectangleHorizontal,RectangleVertical,Rows2,Columns2,PanelTop,Palette,Lock,LockOpen,Library,Hand,StickyNote,MessageSquare,Grid,LayoutGrid,Undo2,Redo2} from 'lucide-react'
import TechPackTechnicalBoard from './TechPackTechnicalBoard.jsx'
import TechPackPageMarkup from './TechPackPageMarkup.jsx'
import TechPackPageReview from './TechPackPageReview20261031.jsx'
import {createTechPackReviewNote,patchTechPackReviewNote} from '../core/techPackReviewNotes20261031.js'
import TechPackBoardObject from './TechPackBoardObject.jsx'
import {TechPackVectorLayer,TechPackVectorLayers,TechPackDocumentLayers,TechPackVectorInspector} from './TechPackVectorStudio.jsx'
import {createTechPackVector,alignTechPackVectors,buildTechPackRectShape} from '../core/techPackVectorStudio.js'
import {explodeTechPackSvgIntoPaths} from '../core/techPackSvgToNativePaths20261031.js'
import {normalizeTechPackEditedPathBounds,resizeTechPackEditablePath} from '../core/techPackVectorPathTools20261031.js'
import {toggleTechPackLayerSelection,patchTechPackVectorLayer,duplicateTechPackVectorLayer,
  reorderTechPackVectorLayers,deleteTechPackVectorLayers,setTechPackLayoutLayerVisibility}
  from '../core/techPackLayerOperations20261030.js'
import {resizeTechPackGroup} from './techPackGroupResize.js'
import {boardObjectTransform} from '../core/techPackBoardObjects.js'
import TechPackBoxContent from './TechPackBoxContent.jsx'
import TechPackSpreadsheetBlock from './techpack-spreadsheet/TechPackSpreadsheetBlock.jsx'
import TechPackTableTools20261030 from './techpack-spreadsheet/TechPackTableTools20261030.jsx'
import TechPackTableStudio20261030 from './techpack-spreadsheet/TechPackTableStudio20261030.jsx'
import TechPackProductionControl20261031 from './TechPackProductionControl20261031.jsx'
import TechPackMediaProperties20261031 from './TechPackMediaProperties20261031.jsx'
import {applyTechPackMediaAssetToBox,removeUnpositionedDuplicateMediaAsset} from '../core/techPackMediaObjectMigration20261031.js'
import {prepareTechnicalFlatTransparentAsset} from '../core/techPackTechnicalFlatCleanup20261031.js'
import {analyzeVectorArtwork} from '../core/techPackVectorArtwork20261031.js'
import {buildTechPackHandoff20261031} from '../core/techPackFactoryPackage20261031.js'
import TechPackBottomTablePicker from './TechPackBottomTablePicker20261031.jsx'
import {fitUntouchedFramedBottomTables} from '../core/techPackBottomTableFitting20261031.js'
import {createTechPackMiddleTemplate,TECHPACK_MIDDLE_TEMPLATES} from '../core/techPackMiddleTemplates20261031.js'
import TechPackCharacterProperties from './TechPackCharacterProperties20261031.jsx'
import TechPackVisualThemeLibrary from './TechPackVisualThemeLibrary20261031.jsx'
import {TECHPACK_FONT_CHOICES} from './TechPackCharacterProperties20261031.jsx'
import {FRAMED_HEADER_PRESETS,FRAMED_TABLE_GALLERY,applyFramedHeaderPreset,
  applyTechPackPaletteOverrides,resolveTechPackPalette,TECHPACK_COLOR_FIELDS} from '../core/techPackVisualThemes20261031.js'
import {createFramedBottomTableBox} from '../core/techPackBottomTableTemplates20261031.js'
import {buildProductionTechPack,insertProductionTechPackPage} from '../core/techPackProductionPackBuilder20261031.js'
import {createNikeTshirtExampleTechPack,NIKE_TEE_DEMO_SOURCE,NIKE_TEE_DEMO_RENDER,NIKE_TEE_DEMO_LOGO} from '../core/techPackNikeTshirtExample20261031.js'
import {gridcraftTableCommand} from '../core/techpack-spreadsheet/gridcraftTableCommands20261030.js'
import {createCustomTechPackTable,CUSTOM_TABLE_PRESETS} from '../core/techpack-spreadsheet/customTableDesign20261030.js'
import {createTechPackGalleryTable} from '../core/techpack-spreadsheet/techPackTableGallery20261030.js'
import {createBlankFramedTechPackPage,applyBlankFramedTechPackPage,startFreshFramedTechPack,synchronizeFramedHeaderTables,restorePreviousTechPackPages,shouldInitializeFreshTechPack,upgradeLegacyFramedHeaders} from '../core/techPackMinimalFrame20261031.js'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES,createComposedTechPackPage,restyleComposedTechPackPage} from '../core/techPackComposablePageTemplates20261031.js'
import {saveAuthoredTableTemplate,instantiateAuthoredTableTemplate} from '../core/techpack-spreadsheet/tableEmbeds20261030.js'
import {resolveTechPackTableSelection} from '../core/techpack-spreadsheet/techPackTableSelection20261030.mjs'
import {effectiveEmbeddedTableGeometry,boundedEmbeddedTableTransform,materializeEmbeddedTableGeometry} from '../core/techpack-spreadsheet/embeddedTableGeometry20261030.js'
import TechPackFactoryReviewPanel from './techpack-spreadsheet/TechPackFactoryReviewPanel.jsx'
import TechPackTemplateLibrary from './TechPackTemplateLibrary.jsx'
import TechPackInteractive3D from './TechPackInteractive3D.jsx'
import {applyTechPackTemplate,TECHPACK_THEMES,TECHPACK_TABLE_TEMPLATES,saveTechPackUserPreset} from '../core/techPackTemplatePresets.js'
import {TECHPACK_ASSET_FOLDERS,assetInFolder,assetFolderDefault} from '../core/techPackAssetFolders.js'
import {TECHPACK_MEDIA_TAG_SUGGESTIONS,getTechPackAssetTags,setTechPackAssetTags,
  normalizeTechPackAssetTags,
  inferTechPackAssetTags,removeTechPackAssetTags} from '../core/techPackAssetTags20261031.js'
import {reconcileSmartPhotoLayout,assignSmartMediaAssets} from '../core/techPackSmartMediaLayout20261031.js'
import {TECHPACK_MARKER_COLORS,TECHPACK_MARKER_WIDTHS,TECHPACK_PENCIL_COLORS,TECHPACK_PENCIL_WIDTHS} from '../core/techPackPageMarkup.js'
import {nativeTechPackDocument,editNativeTechPackDocument} from '../core/techPackWorkspaceDocument.js'
import {TECHPACK_PAGES,techPackPageTable,techPackSource,techPackCsv} from '../core/techPackWorkspaceModel.js'
import {resolveTechPackPages,insertCustomTechPackPage,shiftTechPackPage,reorderTechPackPage,removeCustomTechPackPage,captureTechPackPageLayout,applyTechPackCapturedLayout,restyleTechPackPage,rebindTechPackTemplateTable,reconcileTechPackTemplateAssets,captureTechPackDocumentTemplate,applyTechPackDocumentTemplate} from '../core/techPackPageComposer.js'
import {applyTechPackPageLayout,techPackPageLayout,TECHPACK_PAPER_SIZES} from '../core/techPackPageLayout.js'
import {reflowTechPackPageLayout,techPackArtboardSize} from '../core/techPackResponsivePage20261031.js'
import {insertTechPackObjectPreset,TECHPACK_OBJECT_TEMPLATES} from '../core/techPackObjectTemplateCatalog20261031.js'
import {createOriginalTshirtMockupAsset,createPrivateSeaggsMockupAsset,createPrivateSeaggsVectorAsset,addMockupAssets} from '../core/techPackPrivateMockupLibrary20261031.js'
import {pairSeaggsTshirtSvg,placeSeaggsPairInstance} from '../core/techPackSeaggsPair20261031.js'
import {nativePatternPanelToTechPackPath} from '../core/techPackPatternVectorBridge20261031.js'
import TechPackSelectedArtworkAppearance20261031 from './TechPackSelectedArtworkAppearance20261031.jsx'
import {recolorTechPackRasterDataUrl} from '../core/techPackRasterInkRecolor20261031.js'
import {patchTechPackMediaSlot} from '../core/techPackFabricMediaBridge20261031.js'
import {resolveTechPackArtworkSource20261031} from '../core/techPackArtworkPresentation20261031.js'
import {nextTechPackZoom,resolvedTechPackZoom,techPackZoomKey} from '../core/techPackCanvasZoom.js'
import {renderTechPackWorkspacePrintHTML} from '../core/techPackWorkspacePrint.js'
import {createBoundTechPackTable,createGarmentSpreadsheetTables,TECHPACK_BOUND_TABLE_PAGE_IDS} from '../core/techpack-spreadsheet/sourceBindings.js'
import {exportTechPackXlsx,importTechPackXlsx} from '../core/techpack-spreadsheet/exporterXlsx.js'
import {listSpreadsheetTablesFromWorkspace} from '../core/techpack-spreadsheet/printProjection.js'
import {importedSheetToWorkspaceTable} from '../core/techpack-spreadsheet/importIntoWorkspace.js'
import {spreadsheetFromTechPackPreset} from '../core/techpack-spreadsheet/templateBinding.js'
import {snapArtboardCoordinate,snapArtboardObject,alignArtboardBox,ARTBOARD_GRID_PX} from '../core/techPackArtboardGrid.js'
import {measurementReferenceRows,linkedMeasurementLabel} from '../core/techPackMeasurementDrawing.js'
import {getTechPackFabricSwatch,removeTechPackFabricSwatchAsset,setTechPackFabricSwatch} from '../core/techPackFabricSwatches.js'
import {editTechPackMaterialCell} from '../core/techPackMaterialEdits.js'
import {techPackAuthoringChecklist} from '../core/techPackAuthoringChecklist.js'
import {techPackFactoryReadiness} from '../core/techPackFactoryReadiness.js'
import {addTechPackColorway,updateTechPackColorway,removeTechPackColorway,normalizeTechPackColorways} from '../core/techPackColorways.js'
import {createTechPackCheckpoint,appendTechPackCheckpoint,compareTechPackCheckpoints} from '../core/techPackRevisionHistory.js'
import './TechPackWorkspace.css'

const HEADER_PRESETS=[['seville','Seville · Technical'],['technical','Technical'],['editorial','Editorial'],['minimal','Minimal'],['dark','Dark header']]
const EMPTY_3D_MARKERS=[]
const ORIENTATIONS=[['portrait','Portrait'],['landscape','Landscape']]
const CATEGORIES=['reference','fabric swatch','mockup','technical flat','fit','construction','logo','graphic','pattern','trim','inspiration','brand label','care label','size label','inside label','hangtag','packaging','packaging box','packaging bag']
const uid=()=>globalThis.crypto?.randomUUID?.()||`asset-${Date.now()}-${Math.random().toString(36).slice(2)}`
const safeAssetSrc=src=>typeof src==='string'&&(
  (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src)&&src.length<400000) ||
  (/^data:image\/svg\+xml(?:;charset=[\w-]+)?,%3Csvg/i.test(src)&&src.length<450000)
) ? src : ''
const techPackThemeText=hex=>{
  if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))return '#171717'
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  const luminance=channels.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4)
    .reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0)
  return luminance>.179?'#171717':'#ffffff'
}

// The user's original MIKRISTIAN specification sheets define the page
// architecture.  This is native, editable EXO data, not an image pasted from
// the reference PDF. The file's historical MK-HD002/HT001 values are never
// substituted into a different garment's tech pack.
function SevilleSheetHeader({source,draft,sheetDef,details,index,total,headerFields={},onHeaderField=()=>{},onPageField=()=>{}}){
  const brand=String(draft.brand||'').trim()||'—'
  const value=v=>v==null||String(v).trim()===''?'—':String(v)
  const category=String(draft.category||source.productionSpec?.category||'GARMENT')
  const size=String(source.grading?.baseSize||'NOT SET')
  const fabric=source.fabrics?.map(f=>f.name).filter(Boolean).slice(0,2).join(' / ')||'NOT ASSIGNED'
  const cell=(label,key,fallback,wide=false)=><div className={`tpws-seville-record ${wide?'tpws-seville-name':''}`}><b>{label}</b><input
    aria-label={`${label} header page ${index+1}`} title={`Edit ${label} on every Techpack page`}
    value={headerFields[key]??String(fallback??'')} onChange={event=>onHeaderField(key,event.target.value.slice(0,100))}/></div>
  return <header className="tpws-seville-titleblock" data-seville-title-block={sheetDef.id}>
    <div className="tpws-seville-record-grid">
      {cell('SEASON','season',draft.season)}
      {cell('STYLE NO.','sku',draft.sku)}
      {cell('CATEGORY','category',category)}
      {cell('FABRIC','fabric',fabric)}
      {cell('REV.','revision',source.revision)}
      {cell('BRAND','brand',brand)}
      {cell('NAME','name',draft.styleName||source.name,true)}
      {cell('SIZE','size',size)}
      {cell('MAT.','material',source.fabrics?.length?`${source.fabrics.length} MATERIALS`:'NOT SET')}
      {cell('ISSUE','issue','DRAFT')}
    </div>
    <div className="tpws-seville-section-title"><input aria-label={`Page ${index+1} section title`} value={details.title??sheetDef.name} onChange={e=>onPageField('title',e.target.value.slice(0,90))}/><input aria-label={`Page ${index+1} section subtitle`} value={details.subtitle??sheetDef.subtitle} onChange={e=>onPageField('subtitle',e.target.value.slice(0,130))}/></div>
  </header>
}

function download(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}))
  const a=document.createElement('a');a.href=url;a.download=name;a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

// Preview uploaded SVGs as inert <img> resources. Strip every element and
// attribute outside the small drawing vocabulary; no scripts, links or CSS.
function cleanSvg(source){
  const xml=new DOMParser().parseFromString(source,'image/svg+xml')
  if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg')throw Error('Invalid SVG drawing')
  const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop','text','tspan'])
  const attributes=new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','transform','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','opacity','fill-opacity','stroke-opacity','font-size','font-family','font-weight','text-anchor','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','id'])
  function visit(node){
    for(const child of [...node.children]){
      if(!tags.has(child.localName)){child.remove();continue}
      visit(child)
    }
    for(const attr of [...node.attributes]){
      if(!attributes.has(attr.name)||/url\s*\(|javascript:|data:|https?:|@import/i.test(attr.value))node.removeAttribute(attr.name)
    }
  }
  visit(xml.documentElement)
  xml.documentElement.setAttribute('xmlns','http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(xml.documentElement)
}

async function readReference(file){
  if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)){
    if(file.size>300000)throw Error('SVG must be under 300 KB')
    const verified=analyzeVectorArtwork(await file.text())
    if(!verified.pathCount)throw Error('SVG must contain actual editable drawing shapes.')
    return `data:image/svg+xml,${encodeURIComponent(verified.svg)}`
  }
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024)throw Error('Use SVG, JPEG, PNG or WebP under 3 MB')
  const bitmap=await createImageBitmap(file)
  try{
    const scale=Math.min(1,1300/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    const ctx=canvas.getContext('2d')
    // Preserve genuine PNG/WebP alpha. The old unconditional white paint
    // flattened all transparent technical flats into opaque JPEG rectangles.
    if(file.type==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)}
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
    if(file.type!=='image/jpeg'){
      for(const quality of [.9,.75,.6,.4]){
        const image=canvas.toDataURL('image/webp',quality)
        if(image.startsWith('data:image/webp;base64,')&&image.length<250000)return image
      }
      const png=canvas.toDataURL('image/png')
      if(png.length<250000)return png
      throw Error('Transparent image is too large; resize or simplify this PNG/WebP. EXO will not silently replace alpha with white.')
    }
    for(const quality of [.82,.66,.48,.32]){
      const image=canvas.toDataURL('image/jpeg',quality)
      if(image.length<250000)return image
    }
    throw Error('Image is too large for the project library')
  }finally{bitmap.close()}
}
async function techPackImageDimensions(dataUrl){
  return await new Promise(resolve=>{
    const image=new Image()
    image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight})
    image.onerror=()=>resolve(null)
    image.src=dataUrl
  })
}

export default function TechPackWorkspace({project,value,onChange,nativeMode=false,nativeSnapshot=null,nativeGraphics=[],storageError=''}){
  const [hosts,setHosts]=useState(null)
  useEffect(()=>{
    // EXO's surrounding native panels can mount after the Tech Pack canvas.
    // Resolve the hosts again when they arrive; a one-shot lookup can leave
    // the entire VectorCraft tool rail absent for the lifetime of the editor.
    const ids={library:'exo-techpack-library-host',objects:'exo-techpack-object-host',
      properties:'exo-techpack-properties-host',leftTools:'exo-techpack-left-tools-host',
      rightTools:'exo-techpack-right-tools-host'}
    const refresh=()=>setHosts(previous=>{
      const next=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,document.getElementById(id)]))
      return previous&&Object.keys(ids).every(key=>previous[key]===next[key])?previous:next
    })
    refresh()
    const observer=new MutationObserver(refresh)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])
  const [page,setPage]=useState('custom-clean-start')
  const [annotationTool,setAnnotationTool]=useState('select')
  const [vectorTool,setVectorTool]=useState('select')
  const [selectedVectorIds,setSelectedVectorIds]=useState([])
  const [highlightColor,setHighlightColor]=useState('#f4d03f')
  const [highlightWidth,setHighlightWidth]=useState(24)
  const [pencilColor,setPencilColor]=useState('#e53935')
  const [pencilWidth,setPencilWidth]=useState(4)
  const [selectedAnnotationId,setSelectedAnnotationId]=useState('')
  const [renderViews,setRenderViews]=useState({})
  const capturedRevision=useRef(null)
  useEffect(()=>{
    if(!nativeMode)return
    const captured=event=>{
      const results=event.detail?.views
      if(!results||!['front','back','side'].every(key=>/^data:image\/jpeg;base64,/.test(results[key]||'')))return
      setRenderViews(results)
    }
    window.addEventListener('exo-clothcraft-techpack-render-captured',captured)
    return()=>window.removeEventListener('exo-clothcraft-techpack-render-captured',captured)
  },[nativeMode])
  useEffect(()=>{
    if(!nativeMode||!nativeSnapshot||capturedRevision.current===nativeSnapshot.revision)return
    capturedRevision.current=nativeSnapshot.revision
    window.dispatchEvent(new Event('exo-clothcraft-techpack-render-capture-request'))
  },[nativeMode,nativeSnapshot])
  const [pageFlow,setPageFlow]=useState('vertical')
  const [documentZoom,setDocumentZoom]=useState('1')
  const [handTool,setHandTool]=useState(false)
  const canvasPan=useRef(null),spaceHeld=useRef(false)
  const [canvasWidth,setCanvasWidth]=useState(800)
  const scrollRef=useRef(null)
  useEffect(()=>{
    const down=event=>{
      if(event.code!=='Space'||event.metaKey||event.ctrlKey||event.altKey||event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]'))return
      spaceHeld.current=true
      if(pageFlow==='canvas')event.preventDefault()
    }
    const up=event=>{if(event.code==='Space')spaceHeld.current=false}
    const blur=()=>{spaceHeld.current=false;canvasPan.current=null}
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up,true);window.addEventListener('blur',blur)
    return()=>{window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur)}
  },[pageFlow])
  const panStart=event=>{
    if(event.button!==1&&!(pageFlow==='canvas'&&(handTool||spaceHeld.current)))return
    if(event.button!==1&&event.target?.closest?.('button,input,textarea,select,[contenteditable="true"]'))return
    const scroller=scrollRef.current
    if(!scroller)return
    event.preventDefault();event.stopPropagation()
    canvasPan.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop}
    scroller.setPointerCapture?.(event.pointerId)
  }
  const panMove=event=>{
    const pan=canvasPan.current,scroller=scrollRef.current
    if(!pan||pan.id!==event.pointerId||!scroller)return
    scroller.scrollLeft=pan.left+pan.x-event.clientX
    scroller.scrollTop=pan.top+pan.y-event.clientY
  }
  const panEnd=event=>{if(canvasPan.current?.id===event.pointerId)canvasPan.current=null}
  useEffect(()=>{
    const element=scrollRef.current
    if(!element)return
    const observer=new ResizeObserver(entries=>setCanvasWidth(entries[0].contentRect.width))
    observer.observe(element)
    return()=>observer.disconnect()
  },[])
  const selectedPageRef=useRef('custom-clean-start')
  const flowAnchorRef=useRef(null)
  useEffect(()=>{
    const scroller=scrollRef.current
    if(pageFlow!=='horizontal'||!scroller)return
    const wheel=event=>{
      // An ordinary mouse wheel advances the sideways document strip.
      // Native trackpad horizontal gestures keep working without interception.
      if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return
      if(event.target.closest('.tpws-table-scroll,.tpws-sheet-notes textarea'))return
      scroller.scrollLeft+=event.deltaY
      event.preventDefault()
    }
    scroller.addEventListener('wheel',wheel,{passive:false})
    return()=>scroller.removeEventListener('wheel',wheel)
  },[pageFlow])
  const [rightTab,setRightTab]=useState('properties')
  const [inspectorTab,setInspectorTab]=useState('properties')
  const [activeTableId,setActiveTableId]=useState('')
  const [selectedTableCell,setSelectedTableCell]=useState({r:0,c:0})
  const [textSelection,setTextSelection]=useState(null)
  const [tablePanelOpen,setTablePanelOpen]=useState(true)
  const [tableStudio,setTableStudio]=useState(null)
  const [tableStudioDraft,setTableStudioDraft]=useState(null)
  const [bottomTablePickerPage,setBottomTablePickerPage]=useState('')
  const [tablePlacement,setTablePlacement]=useState({x:25,y:90})
  const [tableDesignerOpen,setTableDesignerOpen]=useState(false)
  const [tableDesigner,setTableDesigner]=useState({preset:'blank',name:'Custom table',rows:12,columns:8,headings:'Column 1, Column 2, Column 3, Column 4, Column 5, Column 6, Column 7, Column 8',theme:'technical'})
  const [selectedAsset,setSelectedAsset]=useState('')
  const [assetCategory,setAssetCategory]=useState('reference')
  const [assetFilter,setAssetFilter]=useState('all')
  const [assetSearch,setAssetSearch]=useState('')
  const [assetTagFilter,setAssetTagFilter]=useState('')
  const [assetTagDraft,setAssetTagDraft]=useState('')
  const [galleryPhotoCount,setGalleryPhotoCount]=useState(4)
  const [galleryTargetTags,setGalleryTargetTags]=useState('reference, mockup, drawing')
  const [autoPlaceOnUpload,setAutoPlaceOnUpload]=useState(false)
  const [assetFolder,setAssetFolder]=useState('all')
  const [librarySection,setLibrarySection]=useState('templates')
  const [privateSeaggsReady,setPrivateSeaggsReady]=useState(false)
  const [privateSeaggsVectorReady,setPrivateSeaggsVectorReady]=useState({front:false,back:false})
  useEffect(()=>{
    if(librarySection!=='assets'||assetFolder!=='mockups')return
    const controller=new AbortController()
    fetch('/private-mockups/seaggs-tshirt-private-transparent.png',{method:'HEAD',signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setPrivateSeaggsReady(response.ok)})
      .catch(()=>{if(!controller.signal.aborted)setPrivateSeaggsReady(false)})
    for(const view of ['front','back']){
      fetch(`/private-mockups/seaggs-tshirt-${view}-vector.svg`,{method:'HEAD',signal:controller.signal})
        .then(response=>{if(!controller.signal.aborted)setPrivateSeaggsVectorReady(old=>({...old,[view]:response.ok}))})
        .catch(()=>{if(!controller.signal.aborted)setPrivateSeaggsVectorReady(old=>({...old,[view]:false}))})
    }
    return()=>controller.abort()
  },[librarySection,assetFolder])
  const [themeHover,setThemeHover]=useState('')
  const [selectedBoardObject,setSelectedBoardObject]=useState(null)
  const [selectedBoardObjects,setSelectedBoardObjects]=useState([])
  const [focused3DPanel,setFocused3DPanel]=useState('')
  const [revisionLabel,setRevisionLabel]=useState('')
  const [error,setError]=useState('')
  const uploadRef=useRef(null)
  const xlsxImportRef=useRef(null)
  const [spreadsheetKind,setSpreadsheetKind]=useState('measurement-table')
  const pendingFabricSwatchRef=useRef('')
  const source=useMemo(()=>techPackSource(project,nativeSnapshot,nativeMode),[project?.pieces,project?.fabrics,project?.seams,project?.grading,project?.customMeasurements,project?.name,project?.revision,nativeSnapshot,nativeMode])
  const state=useMemo(()=>nativeTechPackDocument(source,value),[value,source])
  const draft=state.draft||{}
  const workspace=draft.workspace||{}
  useEffect(()=>{
    const selected=workspace.pageMediaTags?.[page]
    setGalleryTargetTags(Array.isArray(selected)?selected.join(', '):'reference, mockup, drawing')
    setGalleryPhotoCount(Math.min(24,Math.max(1,Number(workspace.pages?.[page]?.smartPhotoCount)||4)))
  },[page,(workspace.pageMediaTags?.[page]||[]).join(','),workspace.pages?.[page]?.smartPhotoCount])
  const bootstrapped=useRef(false)
  useEffect(()=>{
    if(bootstrapped.current||!source.ready||!onChange)return
    let oneTimeReset=false
    try{oneTimeReset=!Boolean(window.localStorage.getItem('exo-techpack-clean-start-request-20261031'))}
    catch{oneTimeReset=true}
    if(shouldInitializeFreshTechPack(workspace,oneTimeReset)){
      bootstrapped.current=true
      const next=startFreshFramedTechPack(workspace,'custom-clean-start',{source,draft,headerFields:workspace.headerFields})
      onChange(editNativeTechPackDocument(state,{workspace:next}))
      try{window.localStorage.setItem('exo-techpack-clean-start-request-20261031','applied')}catch{}
      setPage('custom-clean-start');selectedPageRef.current='custom-clean-start'
      setLayoutNotice('Fresh Tech Pack started with one framed page and a real editable header table. Previous page layouts were archived in this document.')
      return
    }
    bootstrapped.current=true
    const initial=resolveTechPackPages(workspace,TECHPACK_PAGES)[0]
    if(initial){setPage(initial.id);selectedPageRef.current=initial.id}
  },[source.ready,workspace.cleanStartVersion,state,onChange])
  const isLayerLocked=(pageId,id)=>Boolean(id&&workspace.lockedObjects?.[pageId]?.includes(id))
  const toggleLayerLock=(pageId,id,locked=!isLayerLocked(pageId,id))=>{
    const before=workspace.lockedObjects?.[pageId]||[]
    update({...workspace,lockedObjects:{...workspace.lockedObjects,
      [pageId]:locked?[...new Set([...before,id])]:before.filter(item=>item!==id)}})
  }
  const tableLayerId=box=>box?.legacyTableId?'table-'+box.legacyTableId:box?'box-'+box.id:''
  const pageVectors=workspace.vectorObjects?.[page]||[]
  const tableContext=resolveTechPackTableSelection({
    page,pageBoxes:workspace.pageBoxes,legacyTables:workspace.tables,activeTableId,selectedBoardObject,selectedCell:selectedTableCell
  })
  const activeVectorIds=selectedVectorIds.filter(id=>pageVectors.some(item=>item.id===id))
  const {tableBoxes}=tableContext
  const activeTableBox=activeVectorIds.length?null:tableContext.activeTableBox
  const selectedTableRow=activeTableBox?.slot?.spreadsheetTable?.rows?.[selectedTableCell.r]
  const selectedTextStyle=selectedTableRow&&activeTableBox?.slot?.spreadsheetTable?.cellStyles?.[`${selectedTableRow.id}:${selectedTableCell.c}`]||{}
  // Keep the floating editor bound to the exact table where it opened, even
  // when the user selects other artwork while the nonmodal pop-up is visible.
  const studioTableBox=tableStudio?.mode==='placed'&&tableStudio.pageId===page?
    tableBoxes.find(box=>box.id===tableStudio.id)||null:null
  const setVectorObjects=(pageId,objects)=>update({...workspace,vectorObjects:{...workspace.vectorObjects,[pageId]:objects}})
  const patchVector=(id,patch,pageId=page)=>{
    const old=workspace.vectorObjects?.[pageId]||[]
    const edited=old.find(item=>item.id===id)
    const boxResize=edited?.kind==='path'&&!Array.isArray(patch?.anchors)&&
      (Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height'))
    if(edited?.kind==='path'&&Array.isArray(patch?.anchors))
      patch=normalizeTechPackEditedPathBounds(edited,patch)
    else if(boxResize)
      patch=resizeTechPackEditablePath(edited,patch)
    if(edited?.groupId&&vectorTool==='select'&&boxResize){
      const sx=Number(patch.width)/Math.max(.00001,Number(edited.width)||1)
      const sy=Number(patch.height)/Math.max(.00001,Number(edited.height)||1)
      const originX=Number(edited.x)||0,originY=Number(edited.y)||0
      const nextX=Number(patch.x??edited.x)||0,nextY=Number(patch.y??edited.y)||0
      setVectorObjects(pageId,old.map(item=>{
        if(item.id===id)return {...item,...patch}
        if(item.groupId!==edited.groupId||item.locked)return item
        const next={x:nextX+((Number(item.x)||0)-originX)*sx,
          y:nextY+((Number(item.y)||0)-originY)*sy,
          width:Math.max(.00001,(Number(item.width)||1)*sx),
          height:Math.max(.00001,(Number(item.height)||1)*sy)}
        const geometry=item.kind==='path'?resizeTechPackEditablePath(item,next):next
        return {...item,...geometry}
      }))
      return
    }
    // Illustrator-style parent group follows a moved member in Selection
    // mode. Direct Selection edits only the individual path.
    if(edited?.groupId&&vectorTool==='select'&&
        (Object.hasOwn(patch,'x')||Object.hasOwn(patch,'y'))){
      const dx=(Number(patch.x??edited.x)||0)-(Number(edited.x)||0)
      const dy=(Number(patch.y??edited.y)||0)-(Number(edited.y)||0)
      setVectorObjects(pageId,old.map(item=>item.groupId===edited.groupId&&item.id!==id&&
        !item.locked?{...item,x:(Number(item.x)||0)+dx,y:(Number(item.y)||0)+dy}:item.id===id?{...item,...patch}:item))
      return
    }
    setVectorObjects(pageId,patchTechPackVectorLayer(old,id,patch))
  }
  const patchSelectedVectors=(patch,{filledOnly=false}={})=>{
    const chosen=new Set(activeVectorIds)
    setVectorObjects(page,pageVectors.map(item=>chosen.has(item.id)&&!item.locked&&
      (!filledOnly||item.fill!=='none')?{...item,...patch}:item))
  }
  const selectVector=(pageId,id,add=false,{keepInspector=false}={})=>{
    if(pageId!==page)setPage(pageId)
    setSelectedBoardObject(null)
    // Illustrator-style: selecting geometry brings the fill and stroke
    // inspector to the front, even if Tables or Layers was open earlier.
    if(!keepInspector)setInspectorTab('properties')
    setActiveTableId('')
    const obj=(workspace.vectorObjects?.[pageId]||[]).find(item=>item.id===id)
    const members=vectorTool==='select'&&obj?.groupId?
      (workspace.vectorObjects?.[pageId]||[]).filter(item=>item.groupId===obj.groupId).map(item=>item.id):[id]
    setSelectedVectorIds(current=>add?
      (members.every(member=>current.includes(member))?current.filter(member=>!members.includes(member)):
        [...new Set([...current,...members])]):members)
    if(obj?.kind==='text'){if(!keepInspector)setInspectorTab('properties');setTextSelection({kind:'vector',pageId,id})}
    else setTextSelection(null)
  }
  const createVector=(pageId,kind,rect)=>{
    const objects=workspace.vectorObjects?.[pageId]||[]
    if(objects.length>=250){setError('Maximum 250 vector layers per page.');return}
    const id=uid()
    const obj=kind==='path'?{
      ...rect,id,kind:'path',closed:rect?.closed===true,
      name:rect?.name||'New vector path',groupId:null,
      fill:rect?.fill||'none',stroke:rect?.stroke||'#20242a',strokeWidth:rect?.strokeWidth??1.5,
      opacity:1,locked:false,hidden:false,
    }:createTechPackVector(kind,rect||{x:70+objects.length%9*16,y:85+objects.length%9*14},id)
    setVectorObjects(pageId,[...objects,obj])
    setSelectedVectorIds([obj.id])
    if(kind!=='path')setVectorTool('select')
    setAnnotationTool('select');setEditMode('layout');setInspectorTab('properties')
    return obj.id
  }
  const deleteVectors=()=>{
    if(!activeVectorIds.length)return
    const result=deleteTechPackVectorLayers(pageVectors,activeVectorIds)
    setVectorObjects(page,result.layers)
    setSelectedVectorIds(result.selectedIds)
  }
  const expandSvgAssetToPaths=(pageId=page,objectId=selectedBoardObject?.id)=>{
    try{
      if(!objectId?.startsWith('asset-'))throw Error('Select a placed SVG mockup first')
      const assetId=objectId.slice(6)
      const asset=assets.find(item=>item.id===assetId)
      const src=asset?.dataUrl||asset?._src||asset?.src||''
      const prefix=/^data:image\/svg\+xml(?:;charset=[\w-]+)?,/i.exec(src)?.[0]
      if(!prefix)throw Error('Only genuine SVG artwork can expand into editable paths. This reference is raster.')
      const svg=decodeURIComponent(src.slice(prefix.length))
      if(!svg.trimStart().startsWith('<svg'))throw Error('SVG document unavailable')
      const existing=workspace.vectorObjects?.[pageId]||[]
      const origin=(workspace.pageAssets?.[pageId]||[]).indexOf(assetId)
      const bounds=workspace.boardObjects?.[pageId]?.[objectId]||{}
      const vb=svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number)
      if(vb?.length!==4||!vb.every(Number.isFinite)||vb[2]<=0||vb[3]<=0)throw Error('SVG viewBox is invalid')
      const displayedWidth=Math.min(260,230*Math.abs(Number(bounds.scaleX)||1))
      const displayHeight=displayedWidth*vb[3]/vb[2]
      const col=Math.max(0,origin)%2,row=Math.floor(Math.max(0,origin)/2)
      const x=56+col*254+(Number(bounds.x)||0)
      const y=148+row*226+(Number(bounds.y)||0)
      const groupId='vector-group-'+uid()
      const vectors=explodeTechPackSvgIntoPaths(svg,{
        pageId,x,y,width:displayedWidth,height:displayHeight,
        idFactory:()=>uid(),sourceAssetId:asset.id,groupId})
      if(vectors.length+existing.length>250)throw Error('This page already has too many vector layers; remove unused paths and retry.')
      // Replace exactly the selected instance, never the master asset or
      // any separately placed copies. Native garment CAD is unaffected.
      update({...workspace,
        pageAssets:{...workspace.pageAssets,[pageId]:(workspace.pageAssets?.[pageId]||[]).filter(id=>id!==assetId)},
        vectorObjects:{...workspace.vectorObjects,[pageId]:[...existing,...vectors]}})
      setPage(pageId);selectedPageRef.current=pageId
      setSelectedBoardObject(null);setSelectedBoardObjects([])
      setSelectedVectorIds(vectors.map(item=>item.id))
      setInspectorTab('properties');setRightTab('properties')
      setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
      setLayoutNotice('Expanded '+vectors.length+' genuine SVG paths into an editable VectorCraft group. Choose Ungroup selected paths to edit individual contours, or Direct Selection to move anchors and handles.')
      setError('')
    }catch(error){setError('Could not expand SVG mockup: '+(error?.message||String(error)))}
  }
  const duplicateVector=id=>{
    const next=duplicateTechPackVectorLayer(pageVectors,id,uid())
    if(!next)return
    setVectorObjects(page,next.layers);setSelectedVectorIds(next.selectedIds)
  }
  const groupSelectedVectors=()=>{
    const ids=new Set(activeVectorIds)
    if(ids.size<2)return
    const groupId='vector-group-'+uid()
    setVectorObjects(page,pageVectors.map(item=>ids.has(item.id)&&!item.locked?{...item,groupId}:item))
    setVectorTool('select');setLayoutNotice('Grouped '+ids.size+' editable vector paths. Use Direct Selection to edit a single contour or Ungroup to separate them.')
  }
  const ungroupSelectedVectors=()=>{
    const groups=new Set(pageVectors.filter(item=>activeVectorIds.includes(item.id)&&item.groupId).map(item=>item.groupId))
    if(!groups.size)return
    setVectorObjects(page,pageVectors.map(item=>groups.has(item.groupId)?{...item,groupId:null}:item))
    setVectorTool('direct')
    const primary=pageVectors.find(item=>activeVectorIds.includes(item.id)&&groups.has(item.groupId))
    if(primary)setSelectedVectorIds([primary.id])
    setLayoutNotice('Ungrouped '+groups.size+' vector group(s). Each original contour is independently selectable; anchor coordinates and Bézier handles are preserved.')
  }
  const reorderVector=direction=>{
    setVectorObjects(page,reorderTechPackVectorLayers(pageVectors,activeVectorIds,direction))
  }
  const buildVectorShape=operation=>{
    try{
      const chosen=pageVectors.filter(item=>activeVectorIds.includes(item.id))
      const result=buildTechPackRectShape(chosen,operation,uid())
      const index=Math.max(...chosen.map(item=>pageVectors.indexOf(item)))
      const next=pageVectors.filter(item=>!activeVectorIds.includes(item.id))
      next.splice(Math.min(index-chosen.length+1,next.length),0,result)
      setVectorObjects(page,next);setSelectedVectorIds([result.id]);setVectorTool('select')
    }catch(error){setError(error.message)}
  }
  const alignVector=direction=>{
    const {orientation:alignOrientation}=techPackPageLayout(workspace,page)
    setVectorObjects(page,alignTechPackVectors(pageVectors,activeVectorIds,
      activeVectorIds.length>1?'selection':'page',direction,
      {width:alignOrientation==='landscape'?792:612,height:alignOrientation==='landscape'?612:792}))
  }
  useEffect(()=>{
    const shell=document.querySelector('.app-shell')
    if(!shell)return
    if(workspace.uiTheme==='illustrator')shell.setAttribute('data-techpack-ui-theme','illustrator')
    else shell.removeAttribute('data-techpack-ui-theme')
    return()=>shell.removeAttribute('data-techpack-ui-theme')
  },[workspace.uiTheme])
  const documentPages=useMemo(()=>resolveTechPackPages(workspace,TECHPACK_PAGES),[workspace.pageOrder,workspace.customPages,workspace.factoryPagesHidden])
  const documentLayerItems=useMemo(()=>{
    const names={header:'Page header',drawing:'Technical drawing',renders:'Garment views',
      'spec-table':'Specification table',notes:'Factory notes','footer-logo':'Footer logo'}
    const builtIn=page.startsWith('custom-')?[]:['header',...(page==='overview'||page==='interactive3d'?['renders']:[]),
      ...(['flats','patterns','artwork','callouts','measurements','construction'].includes(page)?['drawing']:[]),
      ...(!['flats','artwork','interactive3d'].includes(page)?['spec-table']:[]),'notes']
      .map(id=>({id,name:names[id],kind:id==='spec-table'?'table':'page'}))
    const tables=(workspace.tables?.[page]||[]).map(t=>({id:'table-'+t.id,name:t.title||'Specification table',kind:'table'}))
    const boxes=(workspace.pageBoxes?.[page]||[]).map(b=>({id:'box-'+b.id,
      name:b.title||'Artboard box',kind:b.slot?.category==='tables'?'table':'page'}))
    const photos=(workspace.pageAssets?.[page]||[]).map(id=>({id:'asset-'+id,
      name:(workspace.assets||[]).find(a=>a.id===id)?.name||'Image reference',kind:'image'}))
    return [...builtIn,...tables,...boxes,...photos]
  },[page,workspace.tables,workspace.pageBoxes,workspace.pageAssets,workspace.assets])
  const [editMode,setEditMode]=useState('content')
  const [boxPreview,setBoxPreview]=useState(null)
  const boxGesture=useRef(null)
  useEffect(()=>{
    const key=event=>{
      if(event.metaKey||event.ctrlKey||event.altKey||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return
      if(event.key==='v'||event.key==='V'){
        setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
      }else if(event.key==='b'||event.key==='B'){
        setEditMode('layout');setAnnotationTool('box');setVectorTool('select');setSelectedBoardObject(null)
      }else if(event.key==='m'||event.key==='M'){
        setEditMode('layout');setAnnotationTool('select');setVectorTool('rect');setSelectedBoardObject(null)
      }else if(event.key==='t'||event.key==='T'){
        setEditMode('layout');setAnnotationTool('select');setVectorTool('text');setSelectedBoardObject(null)
      }else if(event.key==='Escape'){
        boxGesture.current=null;setBoxPreview(null)
        if(annotationTool==='box')setAnnotationTool('select')
        setVectorTool('select')
      }
    }
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
  },[annotationTool])
  const [dragPage,setDragPage]=useState('')
  const [layoutNotice,setLayoutNotice]=useState('')
  const details=workspace.pages?.[page]||{}
  const activePage=documentPages.find(p=>p.id===page)||documentPages[0]
  const {orientation,paperSize}=techPackPageLayout(workspace,page)
  useEffect(()=>{
    const onZoomKey=event=>{
      const action=techPackZoomKey(event)
      if(!action)return
      event.preventDefault()
      event.stopPropagation()
      setDocumentZoom(current=>nextTechPackZoom(current,action,canvasWidth,orientation==='landscape'))
    }
    // Run before the app-level shortcuts and the browser's page-zoom handler.
    window.addEventListener('keydown',onZoomKey,true)
    return()=>window.removeEventListener('keydown',onZoomKey,true)
  },[canvasWidth,orientation])
  const preset=details.headerPreset||workspace.headerPreset||'seville'
  const table=useMemo(()=>techPackPageTable(page,source,{...draft,pom:source.kind==='project'?source.pom:(draft.pom&&Object.keys(draft.pom).length?draft.pom:source.pom),samples:state.samples}),[page,source,draft,state.samples])
  const override=workspace.cells?.[page]||{}
  const extraRows=workspace.extraRows?.[page]||[]
  const combinedRows=[...table.rows,...extraRows]
  const measurementSpec=techPackPageTable('measurements',source,{...draft,
    pom:source.kind==='project'?source.pom:(Object.keys(draft.pom||{}).length?draft.pom:source.pom),samples:state.samples})
  const measurementRefs=measurementReferenceRows(measurementSpec.rows)
  const factoryPOMTable=useMemo(()=>createBoundTechPackTable('measurement-table',source,draft),[source,draft])
  const refs=(draft.references||[]).map(ref=>({...ref,_source:'references',_src:ref.dataUrl||ref.src}))
  const uploads=(workspace.assets||[]).map(ref=>({...ref,_source:'assets',_src:ref.dataUrl}))
  const graphics=nativeMode?(nativeGraphics||[]).map(g=>({id:`native-${g.id}`,name:g.name||g.id,category:'graphic',_source:'native',_src:g.thumbnail||'',panel:g.panel})):[]
  const sourceFabricAssets=(source.fabrics||[]).map(f=>({id:`source-fabric-${f.id}`,name:f.name||f.id,caption:f.name||f.id,
    category:'fabric',_source:'native-fabric',_src:'',color:f.color||''}))
  const assets=[...refs,...uploads,...graphics,...sourceFabricAssets].filter(item=>item.id)
    .map(item=>({...item,category:workspace.assetFolderOverrides?.[item.id]||item.category||'reference',
      tags:getTechPackAssetTags(workspace,item.id)}))
  const authoring=techPackAuthoringChecklist(source,draft,workspace,assets)
  const factoryReview=techPackFactoryReadiness(source,draft,workspace,assets)
  const colorways=normalizeTechPackColorways(draft.colorways)
  const revisions=Array.isArray(workspace.revisions)?workspace.revisions:[]
  const revisionChanges=revisions.length>1?compareTechPackCheckpoints(revisions.at(-2),revisions.at(-1)):[]
  const chosen=assets.find(a=>a.id===selectedAsset)
  const chosenTagKey=(workspace.assetTags?.[selectedAsset]||[]).join(',')
  useEffect(()=>{setAssetTagDraft(chosenTagKey.split(',').filter(Boolean).join(', '))},[selectedAsset,chosenTagKey])
  const linked=new Set(workspace.pageAssets?.[page]||[])
  // Older Tech Packs sometimes reference the same photo both as a populated
  // template slot and as an unpositioned loose image. Render one visible
  // instance; retain any independently positioned user-authored duplicate.
  const showLooseMediaAsset=(pageId,id)=>removeUnpositionedDuplicateMediaAsset(workspace,pageId,id)===workspace
  const pageAssets=assets.filter(a=>(linked.has(a.id)||((page==='flats'||page==='artwork')&&(draft.technicalFlat?.referenceId===a.id)))&&showLooseMediaAsset(page,a.id))
  const position=documentPages.findIndex(p=>p.id===page)
  const selectedPageBox=selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('box-')
    ?(workspace.pageBoxes?.[page]||[]).find(item=>'box-'+item.id===selectedBoardObject.id):null
  const selectedLooseAssetId=selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('asset-')?
    selectedBoardObject.id.slice('asset-'.length):null
  const selectedLooseAsset=selectedLooseAssetId?assets.find(item=>item.id===selectedLooseAssetId):null
  const selectedLooseAppearance=selectedLooseAsset?
    workspace.boardObjects?.[page]?.['asset-'+selectedLooseAssetId]?.appearance||{}:{}
  const selectedBoxGeometry=selectedPageBox?
    effectiveEmbeddedTableGeometry(selectedPageBox,workspace.boardObjects?.[page]?.['box-'+selectedPageBox.id]||{}):null
  const selectedIds=selectedBoardObjects.filter(item=>item.pageId===page).map(item=>item.id)
  const existingGroupIds=pageId=>new Set([
    ...['header','drawing','renders','render-front','render-back','render-side','fabric-swatches','images','spec-table','notes','footer-logo'].filter(id=>!workspace.hiddenObjects?.[pageId]?.includes(id)),
    ...(workspace.pageBoxes?.[pageId]||[]).map(box=>'box-'+box.id),
    ...(workspace.pageAssets?.[pageId]||[]).filter(id=>showLooseMediaAsset(pageId,id)).map(id=>'asset-'+id),
  ])
  const liveGroups=pageId=>{
    const valid=existingGroupIds(pageId)
    return (workspace.objectGroups?.[pageId]||[]).map(group=>({
      ...group,ids:[...new Set(group.ids||[])].filter(id=>valid.has(id)),
    })).filter(group=>group.ids.length>=2)
  }
  const groupMembers=(pageId,id)=>liveGroups(pageId).find(group=>group.ids.includes(id))?.ids||[id]
  const boardSelectionNodes=(pageId,ids)=>{
    const nodes=[...(scrollRef.current?.querySelectorAll('[data-board-object]')||[])]
    return ids.map(id=>{
      const node=nodes.find(item=>item.dataset.boardPage===pageId&&item.dataset.boardObject===id)
      if(!node)return null
      const value=workspace.boardObjects?.[pageId]?.[id]||{}
      const transform=boardObjectTransform(value)
      return {id,value:{...value,...transform},x:node.offsetLeft+transform.x,y:node.offsetTop+transform.y,
        width:node.offsetWidth*transform.scaleX,height:node.offsetHeight*transform.scaleY,
        baseWidth:node.offsetWidth,baseHeight:node.offsetHeight}
    }).filter(Boolean)
  }
  const boardGestureStart=(pageId,id,handle)=>{
    if(isLayerLocked(pageId,id))return null
    const selected=selectedBoardObjects.filter(item=>item.pageId===pageId).map(item=>item.id)
    const ids=[...new Set([...groupMembers(pageId,id),...(selected.includes(id)?selected:[])])]
      .filter(item=>!isLayerLocked(pageId,item))
    return {pageId,id,handle,items:boardSelectionNodes(pageId,ids)}
  }
  const selectBoardObject=(object,additive=false)=>{
    setSelectedBoardObject(object)
    if(object)setSelectedVectorIds([])
    if(object){setInspectorTab('properties');setRightTab('properties')}
    if(object?.id?.startsWith('box-')){
      const box=(workspace.pageBoxes?.[object.pageId]||[]).find(item=>'box-'+item.id===object.id)
      if(box?.slot?.category==='tables'&&box.slot.spreadsheetTable){
        if(activeTableId!==box.id)setSelectedTableCell({r:0,c:0})
        setActiveTableId(box.id);setTablePanelOpen(true)
        setInspectorTab('tables')
      }else setActiveTableId('')
    }else if(object?.id?.startsWith('table-')&&(workspace.tables?.[object.pageId]||[]).some(t=>'table-'+t.id===object.id)){
      if(activeTableId!=='legacy-'+object.id.slice(6))setSelectedTableCell({r:0,c:0})
      setActiveTableId('legacy-'+object.id.slice(6));setTablePanelOpen(true);setInspectorTab('tables')
    }else if(object)setActiveTableId('')
    setSelectedBoardObjects(current=>{
      if(!object)return []
      const members=groupMembers(object.pageId,object.id).map(id=>({pageId:object.pageId,id}))
      if(!additive)return members
      const onPage=current.filter(item=>item.pageId===object.pageId)
      const already=onPage.some(item=>item.id===object.id)
      return already?onPage.filter(item=>!members.some(member=>member.id===item.id)):
        [...onPage,...members.filter(member=>!onPage.some(item=>item.id===member.id))]
    })
  }
  const groupSelection=()=>{
    const valid=existingGroupIds(page)
    const ids=[...new Set(selectedIds)].filter(id=>valid.has(id))
    if(ids.length<2)return
    const prior=liveGroups(page).filter(group=>!group.ids.some(id=>ids.includes(id)))
    // Members of an existing group cannot be split by selecting a subset.
    const expanded=[...new Set(ids.flatMap(id=>groupMembers(page,id)))].filter(id=>valid.has(id))
    const groups=prior.filter(group=>!group.ids.some(id=>expanded.includes(id)))
    groups.push({id:uid(),ids:expanded})
    update({...workspace,objectGroups:{...workspace.objectGroups,[page]:groups}})
    setSelectedBoardObjects(expanded.map(id=>({pageId:page,id})))
    setLayoutNotice(`${expanded.length} layers grouped. Selection and movement are linked after reload.`)
  }
  const ungroupSelection=()=>{
    const groups=liveGroups(page)
    const chosen=groups.filter(group=>group.ids.some(id=>selectedIds.includes(id)))
    if(!chosen.length)return
    update({...workspace,objectGroups:{...workspace.objectGroups,[page]:groups.filter(group=>!chosen.includes(group))}})
    setLayoutNotice(`${chosen.length} group${chosen.length===1?'':'s'} ungrouped. Layer positions preserved.`)
  }
  // Each page stays physically 8.5×11 or 11×8.5. Fit long editable content
  // *within* that artboard rather than stretching the paper to portrait-like
  // heights or adding an internal scrollbar.
  useEffect(()=>{
    const raf=requestAnimationFrame(()=>{
      const papers=scrollRef.current?.querySelectorAll('[data-techpack-sheet]')||[]
      const list=[]
      // Split writes from reads; interleaving each of the 14 full-page
      // measurements caused repeated synchronous relayout on orientation.
      for(const paper of papers){
        const viewport=paper.querySelector('.tpws-page-content-scroll')
        const inner=paper.querySelector('.tpws-seville-ruled-frame')
        if(!viewport||!inner)continue
        inner.style.transform='none';inner.style.width='100%'
        if(paper.dataset.techpackSheet==='interactive3d'){paper.dataset.contentFit='1.000';continue}
        list.push({paper,viewport,inner})
      }
      let measurements=list.map(({paper,viewport,inner})=>({paper,viewport,inner,
        scale:Math.max(.18,Math.min(1,(viewport.clientHeight-3)/Math.max(1,inner.scrollHeight)))}))
      // The old fitter widened the source by just 20%, leaving a tiny
      // centered print plate in landscape. Give the content the ENTIRE paper
      // width after fitting; never change the Letter paper dimensions.
      // Batch writes and reads, avoiding 16 synchronous relayouts per page.
      for(let pass=0;pass<3;pass++){
        for(const {inner,scale} of measurements){
          inner.style.width=`${100/scale}%`
          inner.style.transform=`scale(${scale})`
        }
        measurements=measurements.map(({paper,viewport,inner,scale})=>({paper,viewport,inner,
          scale:Math.max(.18,Math.min(1,(viewport.clientHeight-4)/Math.max(1,inner.scrollHeight)))}))
      }
      for(const {paper,viewport,inner,scale} of measurements){
        inner.style.width=`${100/scale}%`
        inner.style.transform=`scale(${scale})`
        paper.dataset.contentFit=scale.toFixed(3)
      }
    })
    return()=>cancelAnimationFrame(raf)
  // A scroll event changes the selected page. It must NOT refit every sheet:
  // doing so triggers expensive relayout while the user scrolls to Add Page.
  },[workspace,source,orientation,paperSize,canvasWidth,renderViews,pageFlow,documentZoom])

  const navigateToPage=target=>{
    selectedPageRef.current=target
    setPage(target)
    const container=scrollRef.current
    const node=[...(container?.querySelectorAll('[data-techpack-sheet]')||[])].find(el=>el.getAttribute('data-techpack-sheet')===target)
    if(container&&node){
      const x=node.getBoundingClientRect().left-container.getBoundingClientRect().left+container.scrollLeft
      const y=node.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop
      container.scrollTo({left:pageFlow==='vertical'?0:x,top:pageFlow==='horizontal'?0:y,behavior:'instant'})
    }
  }
  const syncPageOnScroll=()=>{
    if(flowAnchorRef.current)return
    const scroller=scrollRef.current
    if(!scroller)return
    const bounds=scroller.getBoundingClientRect()
    const start=pageFlow==='vertical'?bounds.top:bounds.left
    const finish=pageFlow==='vertical'?bounds.bottom:bounds.right
    let best=null,visible=-1
    for(const item of scroller.querySelectorAll('[data-techpack-sheet]')){
      const r=item.getBoundingClientRect()
      const pos=pageFlow==='vertical'?r.top:r.left
      const end=pageFlow==='vertical'?r.bottom:r.right
      const overlap=pageFlow==='canvas'?
        Math.max(0,Math.min(r.right,bounds.right)-Math.max(r.left,bounds.left))*
        Math.max(0,Math.min(r.bottom,bounds.bottom)-Math.max(r.top,bounds.top)):
        Math.max(0,Math.min(end,finish)-Math.max(pos,start))
      if(overlap>visible){visible=overlap;best=item.getAttribute('data-techpack-sheet')}
    }
    if(best&&best!==selectedPageRef.current){selectedPageRef.current=best;setPage(best)}
  }
  const changeFlow=next=>{
    if(next===pageFlow)return
    const anchor=selectedPageRef.current
    flowAnchorRef.current=anchor
    setPageFlow(next)
    // Reposition on the active sheet after the flex direction changes.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const container=scrollRef.current
      const node=[...(container?.querySelectorAll('[data-techpack-sheet]')||[])].find(el=>el.getAttribute('data-techpack-sheet')===anchor)
      if(container&&node){
        const rect=node.getBoundingClientRect(),frame=container.getBoundingClientRect()
        container.scrollTo({left:next==='vertical'?0:rect.left-frame.left+container.scrollLeft,
          top:next==='horizontal'?0:rect.top-frame.top+container.scrollTop})
      }
      selectedPageRef.current=anchor
      setPage(anchor)
      requestAnimationFrame(()=>{flowAnchorRef.current=null})
    }))
  }

  useEffect(()=>{
    const anchor=selectedPageRef.current
    flowAnchorRef.current=anchor
    const frame=requestAnimationFrame(()=>{
      const container=scrollRef.current
      const node=[...(container?.querySelectorAll('[data-techpack-sheet]')||[])].find(el=>el.getAttribute('data-techpack-sheet')===anchor)
      if(container&&node){
        const rect=node.getBoundingClientRect(),bounds=container.getBoundingClientRect()
        container.scrollTo({left:pageFlow==='vertical'?0:rect.left-bounds.left+container.scrollLeft,
          top:pageFlow==='horizontal'?0:Math.max(0,rect.top-bounds.top+container.scrollTop-48),behavior:'instant'})
      }
      flowAnchorRef.current=null
    })
    return()=>cancelAnimationFrame(frame)
  },[documentZoom,canvasWidth])

  const undoHistory=useRef([])
  const redoHistory=useRef([])
  const [historyVersion,setHistoryVersion]=useState(0)
  const currentDocument=useRef({workspace,state,onChange})
  currentDocument.current={workspace,state,onChange}
  const update=(next,otherDraft={})=>{
    if(!onChange||next===workspace)return
    undoHistory.current.push({workspace,draft:otherDraft})
    if(undoHistory.current.length>60)undoHistory.current.shift()
    redoHistory.current=[]
    setHistoryVersion(value=>value+1)
    onChange(editNativeTechPackDocument(state,{...otherDraft,workspace:next}))
  }
  const undoTechPack=()=>{
    const snapshot=undoHistory.current.pop()
    if(!snapshot)return
    const previous=currentDocument.current
    redoHistory.current.push({workspace:previous.workspace})
    setHistoryVersion(value=>value+1)
    previous.onChange?.(editNativeTechPackDocument(previous.state,{workspace:snapshot.workspace}))
  }
  const redoTechPack=()=>{
    const snapshot=redoHistory.current.pop()
    if(!snapshot)return
    const previous=currentDocument.current
    undoHistory.current.push({workspace:previous.workspace})
    setHistoryVersion(value=>value+1)
    previous.onChange?.(editNativeTechPackDocument(previous.state,{workspace:snapshot.workspace}))
  }
  const historyActions=useRef({undoTechPack,redoTechPack})
  historyActions.current={undoTechPack,redoTechPack}
  useEffect(()=>{
    const shortcut=event=>{
      if(!(event.metaKey||event.ctrlKey)||event.altKey||String(event.key).toLowerCase()!=='z')return
      if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return
      event.preventDefault();event.stopPropagation()
      if(event.shiftKey)historyActions.current.redoTechPack()
      else historyActions.current.undoTechPack()
    }
    window.addEventListener('keydown',shortcut,true)
    return()=>window.removeEventListener('keydown',shortcut,true)
  },[])
  useEffect(()=>{
    // Run once for each original 5-column framed header, and never replace
    // edits to a current 10-column table. The archived original is retained.
    // Bottom-grid fitting is also safe for framed sheets created before the
    // clean-start version flag existed, provided no user transform was saved.
    const upgraded=workspace.cleanStartVersion===1?upgradeLegacyFramedHeaders(workspace):workspace
    const revised=fitUntouchedFramedBottomTables(upgraded)
    if(revised!==workspace&&onChange)update(revised)
  },[workspace.cleanStartVersion,workspace.pageBoxes,workspace.pages,workspace.boardObjects,onChange])
  const addCustomPage=()=>{
    if(documentPages.length>=60){setError('Maximum of 60 Techpack pages reached.');return}
    const id='custom-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,65)
    const next=insertCustomTechPackPage(workspace,id,page,'Custom page',TECHPACK_PAGES)
    // Select the newly created page synchronously. Waiting for its artboard to
    // mount before setting page allowed quick Template Library actions to use
    // the previous page, then overwrite the selection during the next frame.
    selectedPageRef.current=id
    setPage(id)
    update(next);setEditMode('layout');setAnnotationTool('transform');setSelectedBoardObject(null)
    requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(id)))
    setLayoutNotice('New page created. Add a box, table or photo, then save its layout as a template.')
  }
  const moveDocumentPage=(id,direction)=>update(shiftTechPackPage(workspace,id,direction,TECHPACK_PAGES))
  const reorderDocumentPage=(from,to)=>{if(from!==to)update(reorderTechPackPage(workspace,from,to,TECHPACK_PAGES))}
  const deleteCustomPage=id=>{
    if(!workspace.customPages?.some(p=>p.id===id))return
    if(!window.confirm('Delete this custom page and its placed content? Garment source data is not changed.'))return
    update(removeCustomTechPackPage(workspace,id));setSelectedBoardObject(null);navigateToPage('overview')
  }
  const savePageAsTemplate=(includeContent=false)=>{
    const title=String(workspace.pages?.[page]?.title||activePage.name||'My page layout').slice(0,70)
    const name=window.prompt(includeContent?'Name the reusable design with your authored text, graphics and tables:':'Name the blank reusable page layout:',title)
    if(name===null)return
    if(!name.trim()){setError('Enter a name for the custom template.');return}
    try{
      saveTechPackUserPreset(captureTechPackPageLayout(workspace,page,name.trim(),{includeContent}))
      window.dispatchEvent(new Event('exo-techpack-user-templates-changed'))
      setLibrarySection('templates');setLayoutNotice(includeContent?'Designed page and manually authored content saved as a reusable template. Native source values will refresh on future garments.':'Blank reusable page layout saved; garment measurements and private notes excluded.')
    }catch(err){setError('Could not save template: '+(err?.message||'Storage not available'))}
  }
  const saveEntireTechpackTemplate=(includeContent=false)=>{
    const name=window.prompt('Name your complete reusable Techpack design system:','My custom Techpack')
    if(name===null)return
    if(!name.trim()){setError('Enter a template name.');return}
    // Authored notes, image references and template data should only be saved
    // on explicit opt-in; the default pack snapshot always uses blank values.
    try{
      saveTechPackUserPreset(captureTechPackDocumentTemplate(workspace,TECHPACK_PAGES,name.trim(),{includeContent,assets}))
      window.dispatchEvent(new Event('exo-techpack-user-templates-changed'))
      setLibrarySection('templates')
      setLayoutNotice(includeContent?'Saved the full Techpack with authored text and small uploaded photos. Native garment measurements and approvals are excluded.':'Saved all page layouts, header styles, boxes and Excel schemas without content or garment measurements.')
    }catch(err){setError('Could not save full Techpack template: '+(err?.message||String(err)))}
  }
  const setMode=mode=>{
    setEditMode(mode);setAnnotationTool('select');setVectorTool('select');setSelectedBoardObject(null)
    setLayoutNotice(mode==='layout'?'Layout mode: drag objects using blue bounding boxes; garment specifications are protected.':'Content mode: edit the garment and factory information.')
  }
  const focusSelectedContent=(pageId,id)=>{
    setEditMode('content');setAnnotationTool('select')
    setSelectedBoardObject({pageId,id})
    if(id.startsWith('box-')){
      const box=(workspace.pageBoxes?.[pageId]||[]).find(item=>'box-'+item.id===id)
      if(box?.slot?.category==='tables'&&box.slot.spreadsheetTable){
        setActiveTableId(box.id);setTablePanelOpen(true);setInspectorTab('tables')
      }
    }
    if(id.startsWith('asset-')||id.startsWith('render-')||id==='footer-logo'){
      setLibrarySection('assets');setRightTab('assets')
      setLayoutNotice('Choose the replacement image from Assets. The existing object position stays intact.')
      return
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const target=[...document.querySelectorAll('[data-board-object]')]
        .find(node=>node.dataset.boardPage===pageId&&node.dataset.boardObject===id)
      const input=id.startsWith('box-')&&target?.querySelector('.tps-scroll[role="grid"]')||
        target?.querySelector('.tpbc-title, .tpbc-note, .tps td[tabindex], textarea, input')
      input?.focus()
    }))
  }
  const deleteLayoutObject=(pageId,id)=>{
    if(isLayerLocked(pageId,id))return
    if(id.startsWith('render-')){
      // Native capture stays available; removing an authored override restores it.
      const objects={...workspace.boardObjects?.[pageId]}
      delete objects[id]
      update({...workspace,boardObjects:{...workspace.boardObjects,[pageId]:objects}})
      setSelectedBoardObject(null)
      return
    }
    if(id.startsWith('box-')){deleteTemplateBox(pageId,id.slice(4));return}
    if(id.startsWith('table-')){removeTable(pageId,id.slice(6));return}
    if(id.startsWith('asset-')){
      const assetId=id.slice(6)
      const prior=workspace.boardObjects?.[pageId]||{}
      const transforms={...prior};delete transforms[id]
      update({...workspace,pageAssets:{...workspace.pageAssets,[pageId]:(workspace.pageAssets?.[pageId]||[]).filter(v=>v!==assetId)},
        boardObjects:{...workspace.boardObjects,[pageId]:transforms}})
      return
    }
    update({...workspace,hiddenObjects:{...workspace.hiddenObjects,
      [pageId]:[...new Set([...(workspace.hiddenObjects?.[pageId]||[]),id])]}})
  }
  const layoutContext=(pageId,id,action)=>{
    if(isLayerLocked(pageId,id)){setLayoutNotice('Layer is locked. Unlock it in Layers before changing its position or content.');return}
    if(action==='reset'){
      update({...workspace,boardObjects:{...workspace.boardObjects,
        [pageId]:{...workspace.boardObjects?.[pageId],[id]:{x:0,y:0,scaleX:1,scaleY:1}}}})
    }else if(action==='delete')deleteLayoutObject(pageId,id)
    else if(action==='expand-vector'){expandSvgAssetToPaths(pageId,id);return}
    else if(action==='replace'){
      setSelectedBoardObject({pageId,id})
      if(id.startsWith('asset-')||id.startsWith('render-')||id.startsWith('box-')||id==='footer-logo'){
        setLibrarySection('assets');setRightTab('assets')
        setLayoutNotice('Select another image in Assets, then choose Replace selected object. Its artboard position and size will be preserved.')
      }else{
        setLibrarySection('templates')
        setLayoutNotice('Select a new template style. Layout appearance can be changed without replacing existing text or measurements.')
      }
      return
    }else if(action==='duplicate'){
      if(id.startsWith('box-')){
        const item=(workspace.pageBoxes?.[pageId]||[]).find(box=>'box-'+box.id===id)
        if(item&& (workspace.pageBoxes?.[pageId]||[]).length<24){
          const newId=uid()
          const duplicate=structuredClone(item)
          duplicate.id=newId
          duplicate.x=Math.max(0,(Number(item.x)||0)+18);duplicate.y=Math.max(0,(Number(item.y)||0)+18)
          if(duplicate.slot?.spreadsheetTable){
            duplicate.slot.spreadsheetTable={...duplicate.slot.spreadsheetTable,id:'table-'+uid(),boxId:newId,
              rows:(duplicate.slot.spreadsheetTable.rows||[]).map(row=>({...row,id:'row-'+uid()}))}
          }
          const current=workspace.boardObjects?.[pageId]?.[id]||{}
          update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...(workspace.pageBoxes?.[pageId]||[]),duplicate]},
            boardObjects:{...workspace.boardObjects,[pageId]:{...workspace.boardObjects?.[pageId],['box-'+newId]:{...current}}}})
          setSelectedBoardObject({pageId,id:'box-'+newId})
          return
        }
      }else if(id.startsWith('asset-')){
        const assetId=id.slice(6)
        const original=(workspace.assets||[]).find(item=>item.id===assetId)
        const pageItems=workspace.pageAssets?.[pageId]||[]
        if(original&&workspace.assets.length<60&&pageItems.length<24){
          const newId=uid(),current=workspace.boardObjects?.[pageId]?.[id]||{}
          const nextLayer='asset-'+newId
          update({...workspace,
            assets:[...workspace.assets,{...original,id:newId,
              sourceAssetId:original.sourceAssetId||original.id,placementOnly:true,
              name:(original.name||'Artwork')+' · copy',caption:''}],
            pageAssets:{...workspace.pageAssets,[pageId]:[...pageItems,newId]},
            boardObjects:{...workspace.boardObjects,[pageId]:{
              ...workspace.boardObjects?.[pageId],[nextLayer]:{
                ...current,x:(Number(current.x)||0)+22,y:(Number(current.y)||0)+18}}}})
          setSelectedBoardObject({pageId,id:nextLayer})
          setSelectedBoardObjects([{pageId,id:nextLayer}])
          setInspectorTab('properties');setRightTab('properties')
          setLayoutNotice('Duplicated the actual artwork as an independent media object; no image placeholder or white card added.')
          return
        }
      }
      setLayoutNotice('To duplicate this inherited factory element, create a new independent box and place its content inside.')
      return
    }else if(action==='front'||action==='back'){
      const current=workspace.boardObjects?.[pageId]?.[id]||{}
      update({...workspace,boardObjects:{...workspace.boardObjects,
        [pageId]:{...workspace.boardObjects?.[pageId],[id]:{...current,zIndex:action==='front'?50:0}}}})
      return
    }
    setSelectedBoardObject(null)
  }
  const applyDroppedPreset=(preset,pageId,boxId=null)=>{
    if(!preset||typeof preset!=='object')return
    if(boxId){
      const categories=new Set(['boxes','tables','pages','headers','packs','garments','themes','custom','interactive'])
      if(!categories.has(preset.category))return
      const existingBox=(workspace.pageBoxes?.[pageId]||[]).find(item=>String(item.id)===String(boxId))
      if(['pages','packs','garments','themes','custom','interactive'].includes(preset.category)){
        update(preset.kind==='page-layout'?restyleTechPackPage(workspace,pageId,preset):
          applyTechPackTemplate(workspace,preset,pageId))
        setLayoutNotice('Restyled this page without replacing any existing photos, tables, factory values or selected-box content.')
        return
      }
      if(preset.category==='boxes'&&existingBox){
        editTemplateBox(pageId,boxId,{
          border:preset.border==='dashed'?'dashed':'solid',
          lineColor:/^#[0-9a-f]{6}$/i.test(preset.lineColor||'')?preset.lineColor:existingBox.lineColor,
          width:Math.max(60,Math.min(580,Number(preset.width)||existingBox.width||240)),
          height:Math.max(55,Math.min(540,Number(preset.height)||existingBox.height||180))})
        setLayoutNotice('Box frame resized and restyled. Its photos, table cells, notes and links were preserved.')
        return
      }
      // Inserting a new visual table style into an existing Excel widget must
      // never discard the data or its source links. Structure replacement is
      // a separate, explicitly destructive operation in spreadsheet editing.
      if(preset.category==='tables'&&existingBox?.slot?.spreadsheetTable?.columns?.length){
        const current=existingBox.slot.spreadsheetTable
        editTemplateBox(pageId,boxId,{slot:{...existingBox.slot,
          tablePresetId:String(preset.id||'').slice(0,80),
          spreadsheetTable:{...current,styleId:current.styleId||'exo-seville-spec-v1',
            tableTheme:preset.tableTheme||current.tableTheme||'excel-light'}}})
        setEditMode('content');setAnnotationTool('select')
        setLayoutNotice('Table design applied without changing its columns, formulas, source links or data. Use the table toolbar to change the structure.')
        return
      }
      if(preset.category==='headers'&&existingBox?.slot?.category==='headers'){
        editTemplateBox(pageId,boxId,{slot:{...existingBox.slot,
          header:String(preset.id||preset.header||'technical').slice(0,32)}})
        setLayoutNotice('Header design changed. Existing heading text and page metadata preserved.')
        return
      }
      const headers=Array.isArray(preset.headers)?preset.headers.slice(0,12).map(v=>String(v).slice(0,65)):[]
      const rows=Array.isArray(preset.rows)?preset.rows.slice(0,30).map(row=>({id:uid(),cells:headers.map((_,index)=>String(row?.cells?.[index]||'').slice(0,500))})):
        Array.from({length:Math.min(12,Math.max(1,Number(preset.rows)||4))},()=>({id:uid(),cells:headers.map(()=>'')}))
      editTemplateBox(pageId,boxId,{...(preset.category==='tables'||preset.category==='headers'?{title:String(preset.name||'').slice(0,80)}:{}),
        slot:{id:String(preset.id||'').slice(0,80),name:String(preset.name||'Template').slice(0,100),category:preset.category,
        title:String(preset.title||preset.name||'').slice(0,100),headers,
        rows,header:String(preset.header||''),layout:String(preset.layout||''),
        ...(preset.category==='tables'?{spreadsheetTable:spreadsheetFromTechPackPreset(preset,{pageId,boxId})}:{})}})
      if(preset.category==='tables'){setEditMode('content');setAnnotationTool('select')}
      return
    }
    if(preset.category==='boxes'){insertTemplateBox(preset,pageId);return}
    if(preset.category==='tables'){addTable(pageId,preset);return}
    applyTemplatePreset(preset,pageId)
  }
  // Pointer coordinates are converted back to unzoomed artboard CSS px.
  // The same coordinates are stored by both the Box tool and the selector.
  const boxPoint=(event,paper)=>{
    const rect=paper.getBoundingClientRect()
    const ratioX=paper.clientWidth/Math.max(rect.width,1),ratioY=paper.clientHeight/Math.max(rect.height,1)
    return {x:Math.max(0,Math.min(paper.clientWidth,(event.clientX-rect.left)*ratioX)),
      y:Math.max(0,Math.min(paper.clientHeight,(event.clientY-rect.top)*ratioY))}
  }
  const boxGestureStart=(event,pageId)=>{
    if(editMode!=='layout'||annotationTool!=='box'||event.button!==0)return
    event.preventDefault();event.stopPropagation()
    const paper=event.currentTarget.closest('[data-techpack-sheet]')
    if(!paper)return
    const start=boxPoint(event,paper)
    boxGesture.current={pointerId:event.pointerId,pageId,start,paper}
    event.currentTarget.setPointerCapture(event.pointerId)
    setBoxPreview({...start,width:0,height:0,pageId})
  }
  const boxGestureMove=event=>{
    const gesture=boxGesture.current
    if(!gesture||gesture.pointerId!==event.pointerId)return
    const point=boxPoint(event,gesture.paper)
    setBoxPreview({pageId:gesture.pageId,x:Math.min(point.x,gesture.start.x),y:Math.min(point.y,gesture.start.y),
      width:Math.abs(point.x-gesture.start.x),height:Math.abs(point.y-gesture.start.y)})
  }
  const boxGestureEnd=event=>{
    const gesture=boxGesture.current
    if(!gesture||gesture.pointerId!==event.pointerId)return
    boxGesture.current=null
    setBoxPreview(null)
    const point=boxPoint(event,gesture.paper)
    const grid=workspace.artboardGuides?.[gesture.pageId]
    const x=snapArtboardCoordinate(Math.min(point.x,gesture.start.x),ARTBOARD_GRID_PX,Boolean(grid?.snap))
    const y=snapArtboardCoordinate(Math.min(point.y,gesture.start.y),ARTBOARD_GRID_PX,Boolean(grid?.snap))
    const width=Math.round(Math.abs(point.x-gesture.start.x)),height=Math.round(Math.abs(point.y-gesture.start.y))
    if(width<18||height<18)return
    const existing=workspace.pageBoxes?.[gesture.pageId]||[]
    if(existing.length>=24){setError('Maximum 24 boxes per page.');return}
    const id=uid()
    const box={id,x,y,width,height,title:'',note:'',border:'solid',lineColor:'#252c34',positionMode:'absolute'}
    update({...workspace,pageBoxes:{...workspace.pageBoxes,[gesture.pageId]:[...existing,box]}})
    setSelectedBoardObject({pageId:gesture.pageId,id:'box-'+id})
    setAnnotationTool('select')
  }
  const handlePageTemplateDrop=(event,pageId)=>{
    event.preventDefault()
    if(event.dataTransfer.types.includes('application/x-exo-techpack-seaggs-pair')){
      void placePrivateSeaggsPair(pageId)
      return
    }
    const raw=event.dataTransfer.getData('application/x-exo-techpack-template')||event.dataTransfer.getData('text/plain')
    if(!raw||raw.length>100000)return
    try{
      const object=event.target.closest?.('[data-board-object^="box-"]')
      const boxId=object?.dataset.boardObject?.slice(4)
      applyDroppedPreset(JSON.parse(raw),pageId,boxId)
    }catch{setError('Cannot read dropped template. Drag an EXO template from the Library.')}
  }
  const updateBoardObject=(pageId,id,next,gestureInfo)=>{
    if(isLayerLocked(pageId,id))return
    const previous=workspace.boardObjects?.[pageId]?.[id]||{}
    let snapped=snapArtboardObject(next,ARTBOARD_GRID_PX,Boolean(workspace.artboardGuides?.[pageId]?.snap))
    if(id.startsWith('box-')){
      const existing=(workspace.pageBoxes?.[pageId]||[]).find(b=>'box-'+b.id===id)
      if(existing?.slot?.category==='tables'){
        const layout=techPackPageLayout(workspace,pageId)
        const dimensions=layout.orientation==='landscape'?{width:792,height:612}:{width:612,height:792}
        snapped=boundedEmbeddedTableTransform(existing,snapped,dimensions)
      }
    }
    const selected=selectedBoardObjects.filter(item=>item.pageId===pageId).map(item=>item.id)
    const group=[...new Set([...groupMembers(pageId,id),...(selected.includes(id)?selected:[])])]
    const gesture=gestureInfo?.gesture
    if(gestureInfo?.handle!=='move'&&gesture?.pageId===pageId&&gesture.id===id&&gesture.items.length>1){
      const resized=resizeTechPackGroup(gesture.items,id,gestureInfo.initial,snapped,gestureInfo.handle)
      if(resized){
        update({...workspace,boardObjects:{...workspace.boardObjects,[pageId]:{...workspace.boardObjects?.[pageId],...resized}}})
        return
      }
    }
    const deltaX=(Number(snapped.x)||0)-(Number(previous.x)||0),deltaY=(Number(snapped.y)||0)-(Number(previous.y)||0)
    const revised={...workspace.boardObjects?.[pageId],[id]:{...previous,...snapped}}
    if(group.length>1&&group.includes(id)&&(deltaX||deltaY))for(const other of group){
      if(other===id)continue
      if(isLayerLocked(pageId,other))continue
      const prior=revised[other]||{}
      revised[other]={...prior,x:Math.max(-400,Math.min(400,(Number(prior.x)||0)+deltaX)),y:Math.max(-400,Math.min(400,(Number(prior.y)||0)+deltaY))}
    }
    update({...workspace,boardObjects:{...workspace.boardObjects,[pageId]:revised}})
  }
  const alignBoardSelection=direction=>{
    if(!selectedIds.length)return
    const nodes=[...(scrollRef.current?.querySelectorAll('[data-board-object]')||[])]
    const sizes=selectedIds.map(id=>{
      const node=nodes.find(item=>item.dataset.boardPage===page&&item.dataset.boardObject===id)
      if(!node)return null
      const saved=workspace.boardObjects?.[page]?.[id]||{}
      const originalX=Number(saved.x)||0,originalY=Number(saved.y)||0
      const scaleX=Number(saved.scaleX)||1,scaleY=Number(saved.scaleY)||1
      return {id,saved,x:node.offsetLeft+originalX,y:node.offsetTop+originalY,width:node.offsetWidth*scaleX,height:node.offsetHeight*scaleY}
    }).filter(Boolean)
    if(!sizes.length)return
    const edges={left:Math.min(...sizes.map(v=>v.x)),right:Math.max(...sizes.map(v=>v.x+v.width)),top:Math.min(...sizes.map(v=>v.y)),bottom:Math.max(...sizes.map(v=>v.y+v.height))}
    const {orientation:pageOrientation}=techPackPageLayout(workspace,page)
    const paperWidth=pageOrientation==='landscape'?792:612,paperHeight=pageOrientation==='landscape'?612:792
    const target=direction==='left'?sizes.length>1?edges.left:0:direction==='right'?sizes.length>1?edges.right:paperWidth:
      direction==='center'?sizes.length>1?(edges.left+edges.right)/2:paperWidth/2:
      direction==='top'?sizes.length>1?edges.top:0:direction==='bottom'?sizes.length>1?edges.bottom:paperHeight:
      sizes.length>1?(edges.top+edges.bottom)/2:paperHeight/2
    const revised={...workspace.boardObjects?.[page]}
    for(const item of sizes){
      const oldPosition=['left','right','center'].includes(direction)?direction==='left'?item.x:direction==='right'?item.x+item.width:item.x+item.width/2:
        direction==='top'?item.y:direction==='bottom'?item.y+item.height:item.y+item.height/2
      const key=['left','right','center'].includes(direction)?'x':'y'
      revised[item.id]={...item.saved,[key]:Math.max(-400,Math.min(400,(Number(item.saved[key])||0)+target-oldPosition))}
    }
    update({...workspace,boardObjects:{...workspace.boardObjects,[page]:revised}})
  }
  const scaleBoardSelection=factor=>{
    const items=boardSelectionNodes(page,selectedIds)
    if(!items.length)return
    const left=Math.min(...items.map(item=>item.x)),top=Math.min(...items.map(item=>item.y))
    const right=Math.max(...items.map(item=>item.x+item.width)),bottom=Math.max(...items.map(item=>item.y+item.height))
    const centerX=(left+right)/2,centerY=(top+bottom)/2
    const revised={...workspace.boardObjects?.[page]}
    for(const item of items){
      const scaleX=Math.max(.25,Math.min(3,item.value.scaleX*factor))
      const scaleY=Math.max(.25,Math.min(3,item.value.scaleY*factor))
      const actualX=scaleX/item.value.scaleX,actualY=scaleY/item.value.scaleY
      revised[item.id]={...item.value,scaleX,scaleY,
        x:Math.max(-400,Math.min(400,item.value.x+(item.x-centerX)*(actualX-1))),
        y:Math.max(-400,Math.min(400,item.value.y+(item.y-centerY)*(actualY-1)))}
    }
    update({...workspace,boardObjects:{...workspace.boardObjects,[page]:revised}})
  }
  const setArtboardGuide=(key,on,pageId=page)=>update({...workspace,artboardGuides:{...workspace.artboardGuides,
    [pageId]:{...workspace.artboardGuides?.[pageId],[key]:Boolean(on)}}})
  const alignSelectedBox=direction=>{
    if(!selectedPageBox)return
    const {orientation:pageOrientation}=techPackPageLayout(workspace,page)
    const width=pageOrientation==='landscape'?792:612,height=pageOrientation==='landscape'?612:792
    const updated=alignArtboardBox(selectedPageBox,direction,width,height)
    editTemplateBox(page,selectedPageBox.id,{x:updated.x,y:updated.y})
  }
  const addAnnotation=(pageId,item)=>{
    const prior=workspace.annotations?.[pageId]||[]
    const enriched=pageId==='callouts'&&item.type==='arrow'?{...item,label:`D${String(prior.filter(a=>a.type==='arrow').length+1).padStart(2,'0')}`,component:'',instruction:''}:item
    update({...workspace,annotations:{...workspace.annotations,[pageId]:[...prior,enriched]}})
    setSelectedAnnotationId(item.id)
  }
  const addReviewNote=(pageId,kind,point)=>{
    const previous=workspace.reviewNotes?.[pageId]||[]
    if(previous.length>=100){setError('Maximum 100 review notes on a page');return}
    const note=createTechPackReviewNote(kind,point.x,point.y,uid())
    update({...workspace,reviewNotes:{...workspace.reviewNotes,[pageId]:[...previous,note]}})
    setAnnotationTool('select')
  }
  const updateReviewNote=(pageId,id,patch)=>{
    const layout=techPackPageLayout(workspace,pageId)
    const dimensions=layout.orientation==='landscape'?{width:792,height:612}:{width:612,height:792}
    update({...workspace,reviewNotes:{...workspace.reviewNotes,[pageId]:
      patchTechPackReviewNote(workspace.reviewNotes?.[pageId],id,patch,dimensions)}})
  }
  const removeReviewNote=(pageId,id)=>update({...workspace,reviewNotes:{...workspace.reviewNotes,
    [pageId]:(workspace.reviewNotes?.[pageId]||[]).filter(note=>note.id!==id)}})
  const updateAnnotation=(pageId,id,patch)=>update({...workspace,annotations:{...workspace.annotations,
    [pageId]:(workspace.annotations?.[pageId]||[]).map(item=>item.id===id?{...item,...patch}:item)}})
  const deleteAnnotation=(pageId,id)=>{
    update({...workspace,annotations:{...workspace.annotations,[pageId]:(workspace.annotations?.[pageId]||[]).filter(item=>item.id!==id)}})
    setSelectedAnnotationId('')
  }
  // All new table actions now create the same native Excel-like widget.
  // Existing saved legacy tables remain readable/editable for compatibility.
  const addTable=(pageId=page,template=null)=>insertExcelWidget(template||TECHPACK_TABLE_TEMPLATES[0],pageId)
  const chooseTablePreset=preset=>{
    const recipe=CUSTOM_TABLE_PRESETS[preset]
    if(!recipe)return
    setTableDesigner({preset,name:recipe.name,rows:recipe.rows,columns:recipe.headings.length,
      headings:recipe.headings.join(', '),theme:tableDesigner.theme})
  }
  // A reusable table is authored in the large Table Studio first, then
  // instantiated as its own movable/artboard-locked box. Stored project tables
  // retain EXO identities and values; library copies never carry sourceRefs.
  const makeTableDraft=()=>createCustomTechPackTable({
    preset:tableDesigner.preset,name:tableDesigner.name.trim()||'Custom table',
    rows:Number(tableDesigner.rows),columns:Number(tableDesigner.columns),
    headings:tableDesigner.headings.split(',').map(v=>v.trim().slice(0,80)),theme:tableDesigner.theme,
  })
  const openNewTableStudio=()=>{
    try{setTableStudioDraft(makeTableDraft());setTableStudio({mode:'draft'});setInspectorTab('tables');setError('')}
    catch(cause){setError(cause.message||'Invalid custom table design')}
  }
  const saveTableToLibrary=table=>{
    if(!table)throw new Error('Choose a table to save')
    const items=Array.isArray(workspace.savedTableTemplates)?workspace.savedTableTemplates:[]
    if(items.length>=25)throw new Error('Maximum 25 saved table designs')
    const template=saveAuthoredTableTemplate(table,{id:uid(),name:table.title||table.name||'Custom table'})
    update({...workspace,savedTableTemplates:[...items,template]})
    setLayoutNotice(`Saved ${template.name} to the Table Library.`)
  }
  const embedAuthoredTable=(table,pageId=page)=>{
    const existing=workspace.pageBoxes?.[pageId]||[]
    if(existing.length>=24){setError('Maximum 24 artboard blocks on this page.');return false}
    try{
      const id=uid()
      const saved=saveAuthoredTableTemplate(table,{id:uid(),name:table.title||table.name||'Custom table'})
      const embedded=instantiateAuthoredTableTemplate(saved,{pageId,boxId:id})
      const landscape=techPackPageLayout(workspace,pageId).orientation==='landscape'
      const pageWidth=landscape?792:612,pageHeight=landscape?612:792
      // Tables are printable objects on the artboard, not full-size editors.
      // Editing and rich styling occur in the small anchored pop-up.
      const framed=Boolean(workspace.pages?.[pageId]?.minimalFramedTemplate&&!landscape)
      const width=framed?560:Math.min(pageWidth-44,landscape?510:465)
      const height=Math.min(pageHeight-70,Math.max(205,Math.min(285,embedded.rows.length*29+110)))
      const x=framed?26:Math.max(0,Math.min(pageWidth-width,Number(tablePlacement.x)||0))
      const y=framed?740-height:Math.max(0,Math.min(pageHeight-height,Number(tablePlacement.y)||0))
      const box={id,positionMode:'absolute',x:Math.round(x),y:Math.round(y),
        width,height,title:embedded.title,border:'none',lineColor:'#899cab',note:'',
        slot:{category:'tables',title:embedded.title,sourceLinked:false,
          ...(framed?{templateRole:'bottom-table'}:{}),
          headers:embedded.columns.map(column=>column.label),spreadsheetTable:embedded}}
      update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...existing,box]}})
      setActiveTableId(id);setSelectedTableCell({r:0,c:0})
      setSelectedBoardObject({pageId,id:'box-'+id})
      setTablePanelOpen(true);setInspectorTab('tables');setEditMode('layout')
      setAnnotationTool('select');setVectorTool('select')
      setTableDesignerOpen(false);setTableStudio(null)
      navigateToPage(pageId)
      setLayoutNotice(framed?'Table fitted to the framed artboard edges. Right-click for Table Studio; Layout moves or resizes it.':'Table placed on the page. Right-click for Table Studio, or use Layout to move and resize.')
      setError('')
      return true
    }catch(cause){setError(cause.message||'Unable to embed table');return false}
  }
  const createDesignedTable=(pageId=page)=>{
    try{embedAuthoredTable(makeTableDraft(),pageId)}
    catch(cause){setError(cause.message||'Unable to create custom table')}
  }
  const embedSavedTable=template=>{
    try{embedAuthoredTable(template,page)}catch(cause){setError(cause.message||'Unable to place saved table')}
  }
  // Notion-style Excel widget: one draggable visual block, independent of
  // garment-generated factory tables and available on EVERY artboard.
  const insertExcelWidget=(template=TECHPACK_TABLE_TEMPLATES[0],pageId=page)=>{
    if(selectedBoardObject?.pageId===pageId&&selectedBoardObject.id.startsWith('box-')){
      applyDroppedPreset(template,pageId,selectedBoardObject.id.slice(4))
      return
    }
    const existing=workspace.pageBoxes?.[pageId]||[]
    if(existing.length>=24){setError('Maximum 24 blocks on this page. Select an existing box to insert a table.');return}
    const id=uid()
    const table=spreadsheetFromTechPackPreset(template,{pageId,boxId:id})
    const horizontal=techPackPageLayout(workspace,pageId).orientation==='landscape'
    const width=Math.min(horizontal?515:470,Math.max(horizontal?450:415,table.columns.length*80))
    const box={id,positionMode:'absolute',
      x:Math.round(35+Math.min(existing.length,6)*17),
      y:Math.round(60+Math.min(existing.length,6)*20),
      width,height:Math.max(210,Math.min(horizontal?290:285,table.rows.length*29+115)),
      title:table.title||template.title||'Editable spreadsheet',
      border:'none',lineColor:'#8798a2',note:'',
      slot:{category:'tables',title:table.title||template.title,headers:table.columns.map(c=>c.label),
        sourceLinked:false,spreadsheetTable:table}}
    update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...existing,box]}})
    setActiveTableId(id);setTablePanelOpen(true);setInspectorTab('tables')
    setSelectedBoardObject({pageId,id:'box-'+id})
    setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
    navigateToPage(pageId)
    setLayoutNotice('Excel widget added. Edit its cells, headers and theme; choose Layout to drag or resize the block.')
  }
  const insertLinkedSpreadsheet=(pageId=page,kind=spreadsheetKind)=>{
    if(!source.ready){setError('Load a garment before inserting source-linked specifications.');return}
    const existing=workspace.pageBoxes?.[pageId]||[]
    const spreadsheetTable=createBoundTechPackTable(kind,source,draft)
    if(selectedBoardObject?.pageId===pageId&&selectedBoardObject.id.startsWith('box-')){
      const boxId=selectedBoardObject.id.slice(4)
      editTemplateBox(pageId,boxId,{title:spreadsheetTable.name,slot:{category:'tables',id:spreadsheetTable.id,
        title:spreadsheetTable.name,spreadsheetTable,sourceLinked:true}})
      setActiveTableId(boxId);setInspectorTab('tables')
      setEditMode('content');setAnnotationTool('select')
      setLayoutNotice('Linked specification table placed in the selected box. Native measurements remain protected.')
      return
    }
    if(existing.length>=24){setError('This page already contains 24 boxes. Select an existing box for the linked table.');return}
    const boxId=uid()
    const box={id:boxId,title:spreadsheetTable.name,positionMode:'absolute',x:45+Math.min(existing.length,5)*17,
      y:60+Math.min(existing.length,5)*20,width:Math.min(500,Math.max(340,Math.max(3,spreadsheetTable.columns.length)*62)),
      height:300,border:'solid',lineColor:'#333e47',note:'',
      slot:{id:spreadsheetTable.id,category:'tables',title:spreadsheetTable.name,sourceLinked:true,spreadsheetTable}}
    update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...existing,box]}})
    setActiveTableId(boxId);setTablePanelOpen(true);setInspectorTab('tables')
    navigateToPage(pageId);setEditMode('content');setAnnotationTool('select')
    setLayoutNotice('Source-linked Techpack spreadsheet inserted. Edit cells explicitly to create reviewed overrides.')
  }
  const exportSpreadsheetWorkbook=()=>{
    try{
      const nativeTables=source.ready?createGarmentSpreadsheetTables(source,draft):{}
      const linked=listSpreadsheetTablesFromWorkspace(workspace,nativeTables)
      const authored=Object.entries(workspace.tables||{}).flatMap(([pageId,tables])=>
        (Array.isArray(tables)?tables:[]).map(table=>({...table,name:table.title||pageId})))
      const all=[...linked,...authored]
      const bytes=exportTechPackXlsx(all)
      download(`${(source.name||'garment').replace(/[^\w-]+/g,'-')}-techpack-rev-${String(source.revision??'draft').replace(/[^\w-]+/g,'-')}.xlsx`,
        bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      setLayoutNotice(`Exported ${all.length} Techpack sheets as editable XLSX. Factory review remains required.`)
    }catch(err){setError('Excel export failed: '+(err?.message||String(err)))}
  }
  const exportProductionHandoff=({includeVerifiedPatterns=false}={})=>{
    try{
      const handoff=buildTechPackHandoff20261031({
        source,draft,workspace,assets,project,nativeSnapshot,nativeMode,
        includeVerifiedPatterns,
        release:false
      })
      download(handoff.filename,handoff.zip,'application/zip')
      setLayoutNotice('Downloaded '+handoff.filename+' with editable XLSX, printable Tech Pack, source revision and SHA-256 inventory. '+handoff.patternCount+' independently preflighted graded DXF files; factory approval and PDF proof remain separate.')
      setError('')
    }catch(error){setError('Guarded handoff blocked: '+(error?.message||String(error)))}
  }
  const importSpreadsheetWorkbook=async event=>{
    const file=event.currentTarget.files?.[0]
    event.currentTarget.value=''
    if(!file)return
    try{
      if(file.size>8_000_000)throw Error('Excel file exceeds 8 MB import cap')
      const imported=importTechPackXlsx(new Uint8Array(await file.arrayBuffer()))
      if(!imported.length)throw Error('Workbook contains no supported worksheets')
      let next=workspace,first=null
      const count=Math.min(imported.length,8,Math.max(0,60-documentPages.length))
      for(const sheet of imported.slice(0,count)){
        const pageId='custom-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,60)
        next=insertCustomTechPackPage(next,pageId,page,sheet.name||'Imported Excel sheet',TECHPACK_PAGES)
        if(!first)first=pageId
        const boxId=uid()
        const typed=importedSheetToWorkspaceTable(sheet,{id:'import-'+uid(),pageId,boxId})
        const box={id:boxId,title:sheet.name,x:25,y:35,width:565,height:360,positionMode:'absolute',
          border:'solid',lineColor:'#586572',note:'Imported spreadsheet; check formulas and measurements before factory use.',
          slot:{id:typed.id,category:'tables',spreadsheetTable:typed,sourceLinked:false}}
        next={...next,pageBoxes:{...next.pageBoxes,[pageId]:[...(next.pageBoxes?.[pageId]||[]),box]}}
      }
      if(!first)throw Error('No room for imported sheets: maximum 60 Techpack pages')
      update(next);setEditMode('content')
      requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(first)))
      setLayoutNotice(`Imported ${count} of ${imported.length} Excel sheets with widths and cell formatting. ${count<imported.length?'Additional sheets were skipped (8 per import and 60 page maximum). ':''}Verify all imported values and formulas before factory use.`)
    }catch(err){setError('Excel import failed: '+(err?.message||String(err)))}
  }
  const editTable=(pageId,id,edit)=>{
    if(isLayerLocked(pageId,'table-'+id))return
    const previous=workspace.tables?.[pageId]||[]
    update({...workspace,tables:{...workspace.tables,[pageId]:previous.map(t=>t.id===id?edit(t):t)}})
  }
  const removeTable=(pageId,id)=>{
    if(isLayerLocked(pageId,'table-'+id))return
    if(!window.confirm('Remove this custom table from the tech pack?'))return
    update({...workspace,tables:{...workspace.tables,[pageId]:(workspace.tables?.[pageId]||[]).filter(t=>t.id!==id)}})
  }
  const configure=(patch,pageId=page)=>update({...workspace,pages:{...workspace.pages,[pageId]:{...workspace.pages?.[pageId],...patch}}})
  const configureAllPages=patch=>{
    update(reflowTechPackPageLayout(workspace,patch))
    if(patch.orientation||patch.paperSize)setLayoutNotice('Tech Pack artboards and editable objects reflowed to the selected paper and orientation. Garment measurements and cutting dimensions are unchanged.')
  }
  const applyComposedPage=(templateId,newPage=false,brandPreset=null)=>{
    if(newPage&&documentPages.length>=60){setError('Maximum 60 Tech Pack pages reached');return}
    const target=newPage?'custom-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,56):page
    const template=TECHPACK_COMPOSABLE_PAGE_TEMPLATES.find(item=>item.id===templateId)
    if(!template){setError('Choose a valid page template');return}
    const base=newPage?insertCustomTechPackPage(workspace,target,page,template.name,TECHPACK_PAGES):workspace
    const existing=base.pageBoxes?.[target]||[]
    const composed=existing.length?
      restyleComposedTechPackPage({pageId:target,pageBoxes:existing},templateId):
      createComposedTechPackPage(templateId,{pageId:target})
    if(composed.pageBoxes.length>24){setError('This page contains too many objects to apply another layout safely. Save or remove unused boxes first.');return}
    const pageBoxes=composed.pageBoxes.map(box=>{
      if(box.slot?.category==='tables'&&!box.slot.spreadsheetTable){
        const tablePreset=templateId==='fit-measurements'?'measurement-matrix':
          templateId==='bill-of-materials'?'bom':
          templateId.includes('swatches')?'colorways':templateId==='construction'?'construction':
          templateId==='technical-callouts'?'stitch-seam':'blank'
        let table
        try{table=createTechPackGalleryTable(tablePreset)}catch{table=createTechPackGalleryTable('blank')}
        return {...box,slot:{...box.slot,spreadsheetTable:{...table,id:'table-'+box.id,
          pageId:target,boxId:box.id},title:table.title}}
      }
      if(box.slot?.contentType==='swatch'&&!box.slot.swatchLabel){
        const index=Number(box.roleIndex)||0
        const fabric=templateId==='fabric-swatches'?source.fabrics?.[index]:null
        const colorway=templateId==='color-swatches'?colorways?.[index]:null
        const linked=fabric?getTechPackFabricSwatch(base,fabric.id,assets):null
        return {...box,...(linked?.id?{assetId:linked.id}:{}),slot:{...box.slot,
          swatchLabel:String(fabric?.name||colorway?.name||'Assign color or fabric'),
          swatchHex:/^#[0-9a-f]{6}$/i.test(String(colorway?.hex||fabric?.color||''))?
            String(colorway?.hex||fabric?.color):'#e6e9ed',
          ...(fabric?.id?{linkedFabricId:fabric.id}:{}),
          ...(colorway?.id?{linkedColorwayId:colorway.id}:{})}}
      }
      if(box.slot?.contentType==='photo'&&!box.assetId){
        const role=box.semanticRole||'photo'
        const matches=assets.filter(item=>role==='logo'?
          ['logo','graphic'].includes(item.category):
          role==='front-view'||role==='back-view'?
          ['technical flat','mockup'].includes(item.category):
          ['reference','mockup','technical flat','inspiration'].includes(item.category))
        const match=matches[Number(box.roleIndex)||0]
        return match?{...box,assetId:match.id}:box
      }
      return box
    })
    selectedPageRef.current=target;setPage(target)
    update({...base,pageBoxes:{...base.pageBoxes,[target]:pageBoxes},
      pages:{...base.pages,[target]:{...base.pages?.[target],
        ...(newPage?{title:template.name}:{}),composedTemplateId:templateId,
        ...(brandPreset?{headerPreset:brandPreset.headerPreset,templateColors:brandPreset.templateColors}:{} )}},
      composedTemplateIds:{...base.composedTemplateIds,[target]:templateId}})
    setSelectedBoardObject(null);setSelectedVectorIds([]);setEditMode('layout');setVectorTool('select');setAnnotationTool('select')
    requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(target)))
    setLayoutNotice(newPage?'Created '+template.name+' page. Add references and edit its tables or notes.':
      'Switched to '+template.name+' layout. Existing authored content and source links were retained by semantic role.')
    setError('')
  }
  const saveBrandPagePreset=()=>{
    const templateId=workspace.composedTemplateIds?.[page]
    if(!templateId){setError('Apply a composable page template first');return}
    const before=workspace.brandComposedPresets||[]
    if(before.length>=20){setError('Maximum 20 brand styles');return}
    const name=window.prompt('Name your reusable brand page style:',draft.brand||'My brand Tech Pack')
    if(!name?.trim())return
    const preset={id:uid(),name:name.trim().slice(0,70),templateId,
      headerPreset:workspace.pages?.[page]?.headerPreset||workspace.headerPreset||'seville',
      templateColors:structuredClone(workspace.pages?.[page]?.templateColors||workspace.templateColors||{})}
    update({...workspace,brandComposedPresets:[...before,preset]})
    setLayoutNotice('Saved '+preset.name+'. Create another page using this brand style from Page Templates.')
  }
  const applyTemplatePreset=(template,targetPage=null)=>{
    if(template?.kind==='page-layout'){
      update(restyleTechPackPage(workspace,targetPage||page,template))
      setLayoutNotice('The new page appearance is applied. Existing photos, cell data, source links, and object positions were preserved.')
      return
    }
    if(editMode==='layout'&&selectedBoardObject?.pageId===(targetPage||page)&&selectedBoardObject?.id?.startsWith('box-')&&
      ['boxes','tables','headers'].includes(template?.category)){
      applyDroppedPreset(template,targetPage||page,selectedBoardObject.id.slice(4));return
    }
    update(applyTechPackTemplate(workspace,template,targetPage))
  }
  const createPageFromSavedTemplate=(template)=>{
    if(!template?.pageSnapshot){setError('Choose a saved page layout template.');return}
    if(documentPages.length>=60){setError('Maximum 60 Techpack pages reached.');return}
    const id='custom-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,60)
    const blank=insertCustomTechPackPage(workspace,id,page,template.name||'Custom page',TECHPACK_PAGES)
    const next=applyTechPackCapturedLayout(blank,id,template,uid)
    // Binding is opt-in via the original template sourceRef: use the CURRENT
    // garment only. Never duplicate measurements from another garment.
    const boxes=(next.pageBoxes?.[id]||[]).map(box=>{
      const slot=box.slot
      if(!(slot?.sourceLinked||slot?.spreadsheetTable?.sourceLinked||slot?.spreadsheetTable?.origin==='native')||!source.ready||!slot?.spreadsheetTable?.kind)return box
      try{
        const fresh=createBoundTechPackTable(slot.spreadsheetTable.kind,source,draft)
        return {...box,slot:{...slot,spreadsheetTable:{...rebindTechPackTemplateTable(slot.spreadsheetTable,fresh,{includeAuthored:template.contentMode==='authored'}),id:slot.spreadsheetTable.id,pageId:id,boxId:box.id}}}
      }catch{return box}
    })
    selectedPageRef.current=id;setPage(id)
    update(reconcileTechPackTemplateAssets({...next,pageBoxes:{...next.pageBoxes,[id]:boxes}},id,assets.map(asset=>asset.id)))
    setEditMode('layout');setAnnotationTool('select');setSelectedBoardObject(null)
    requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(id)))
    setLayoutNotice('New artboard created from your saved template. Manually authored content was retained only if selected when saving; garment-linked data uses this design.')
  }
  const createMinimalFramedArtboard=()=>{
    if(documentPages.length>=60){setError('Maximum of 60 Tech Pack pages reached.');return}
    const id='custom-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,60)
    const next=createBlankFramedTechPackPage(workspace,id,page,TECHPACK_PAGES,{source,draft,headerFields:workspace.headerFields})
    selectedPageRef.current=id;setPage(id)
    update(next);setLibrarySection('templates');setEditMode('content')
    setAnnotationTool('select');setVectorTool('select');setSelectedBoardObject(null)
    requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(id)))
    setLayoutNotice('Blank framed sheet created: shared factory header, one ruled frame, and open space. Add a drawing or place a table only when needed.')
    setError('')
  }
  const restyleMinimalFramedArtboard=()=>{
    if(!page.startsWith('custom-')){createMinimalFramedArtboard();return}
    try{
      update(applyBlankFramedTechPackPage(workspace,page))
      setLayoutNotice('Applied the Mikristian-inspired frame; all existing content, tables, and assets remain unchanged.')
      setError('')
    }catch(error){setError(error.message)}
  }
  const prepareMinimalReferenceBox=(pageId)=>{
    const prior=workspace.pageBoxes?.[pageId]||[]
    const existing=prior.find(box=>box.slot?.contentType==='photo'&&box.slot?.templateRole==='reference')
    if(existing){
      setSelectedBoardObject({pageId,id:'box-'+existing.id})
    }else{
      if(prior.length>=24){setError('Maximum of 24 artboard objects reached');return}
      const id=uid()
      const box={id,title:'Technical drawing / reference',positionMode:'absolute',
        x:40,y:150,width:528,height:405,border:'none',lineColor:'#ffffff',note:'',
        slot:{category:'custom',contentType:'photo',templateRole:'reference'}}
      update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...prior,box]}})
      setSelectedBoardObject({pageId,id:'box-'+id})
    }
    setPage(pageId);selectedPageRef.current=pageId
    setEditMode('content');setAnnotationTool('select');setVectorTool('select')
    setLibrarySection('assets');setRightTab('assets')
    setLayoutNotice('Choose a drawing, mockup, logo or hang tag from Project Assets and click “Replace selected object.” The image stays independently editable.')
  }
  const applyMiddlePageTemplate=(templateId,pageId=page)=>{
    if(!workspace.pages?.[pageId]?.minimalFramedTemplate){
      setError('Choose a framed Tech Pack artboard for a middle-page template.')
      return
    }
    if(!TECHPACK_MIDDLE_TEMPLATES.some(item=>item.id===templateId)){
      setError('Unknown middle-page template.')
      return
    }
    const previous=workspace.pageBoxes?.[pageId]||[]
    const preceding=previous.filter(box=>!box.slot?.middleTemplateId)
    const current=previous.filter(box=>box.slot?.middleTemplateId)
    const bottomTop=Math.min(591,...preceding.filter(box=>box.slot?.templateRole==='bottom-table').map(box=>Number(box.y)||591))
    const ownedAssets={}
    for(const box of current){
      if(box.assetId&&box.slot?.semanticRole!=null)ownedAssets[`${box.slot.semanticRole}:${box.slot.roleIndex||0}`]=box.assetId
    }
    // Existing manually assigned media survives template changes; brand-new
    // media is only added through explicit tag/category matching, not by
    // filling every slot with the first unrelated project image.
    try{
      const composed=createTechPackMiddleTemplate(templateId,{pageId,sourceAssets:ownedAssets,bottomTop,
        orientation:techPackPageLayout(workspace,pageId).orientation,
        paperSize:techPackPageLayout(workspace,pageId).paperSize})
      if(preceding.length+composed.pageBoxes.length>24)throw new RangeError('Maximum 24 boxes on this artboard')
      const priorAnnotations=workspace.annotations?.[pageId]||[]
      const existingMiddleArrows=priorAnnotations.filter(item=>String(item.id||'').startsWith(`middle-${pageId}-callout-`))
      const nextAnnotations=composed.annotations.map((annotation,i)=>{
        const previousArrow=existingMiddleArrows[i]
        return previousArrow?{...annotation,label:previousArrow.label||annotation.label,
          instruction:previousArrow.instruction||'',component:previousArrow.component||'',
          color:previousArrow.color||annotation.color}:annotation
      })
      const composedWorkspace={...workspace,
        pageBoxes:{...workspace.pageBoxes,[pageId]:[...preceding,...composed.pageBoxes]},
        annotations:{...workspace.annotations,[pageId]:[
          ...priorAnnotations.filter(item=>!String(item.id||'').startsWith(`middle-${pageId}-callout-`)),...nextAnnotations]}}
      const filled=autoPlaceTaggedMedia(assets,composedWorkspace,{targetPage:pageId})
      update(filled.workspace)
      setPage(pageId);selectedPageRef.current=pageId
      setSelectedBoardObject({pageId,id:'box-'+composed.pageBoxes[0].id})
      setAnnotationTool('select');setVectorTool('select');setEditMode('layout')
      setLayoutNotice('Placed middle layout'+(filled.assigned?' with '+filled.assigned+' matching tagged references':'')+'. Populated media is direct transformable artwork; placeholders remain for unfilled slots.')
      setError('')
    }catch(error){setError(error.message||'Could not insert middle layout')}
  }
  const fitPhotoReferences=(count=galleryPhotoCount,pageId=page)=>{
    if(!workspace.pages?.[pageId]?.minimalFramedTemplate){
      setError('Choose a framed Tech Pack sheet first, or add a blank framed page.');return
    }
    const previous=workspace.pageBoxes?.[pageId]||[]
    // Convert reference placeholders from an earlier fixed middle template
    // without losing the photo, note, asset ID or transform selected by hand.
    const oldPhotoBoxes=previous.filter(box=>box.slot?.contentType==='photo'&&
      (box.slot?.middleTemplateId||box.slot?.smartGallery))
    const existing=[...oldPhotoBoxes.map((box,i)=>{
      const authorTransform=workspace.boardObjects?.[pageId]?.['box-'+box.id]
      return {...box,
      referenceNumber:box.referenceNumber||box.slot?.referenceNumber||i+1,
      slot:{...box.slot,smartGallery:true,
        ...(authorTransform&&Object.keys(authorTransform).some(k=>['x','y','width','height','rotation','rotate','scaleX','scaleY'].includes(k))?
          {manualPlacement:true}:{}),
        referenceNumber:box.referenceNumber||box.slot?.referenceNumber||i+1}}
    }),
      ...(workspace.mediaOverflowByPage?.[pageId]||[])]
    const otherBoxes=previous.filter(box=>!oldPhotoBoxes.includes(box))
    if(otherBoxes.length+count>24){setError('Maximum 24 artboard objects. Remove unused objects or use fewer photos.');return}
    const layout=techPackPageLayout(workspace,pageId)
    const bottomTop=Math.min(591,...otherBoxes.filter(box=>box.slot?.templateRole==='bottom-table').map(box=>Number(box.y)||591))
    try{
      const placed=reconcileSmartPhotoLayout({pageId,count,existingBoxes:existing,otherBoxes,
        bottomTop,orientation:layout.orientation,paperSize:layout.paperSize,preserveManual:true})
      const keptIds=new Set(placed.pageBoxes.map(box=>box.id))
      const nextWorkspace={...workspace,
        pageBoxes:{...workspace.pageBoxes,[pageId]:[...otherBoxes,...placed.pageBoxes]},
        mediaOverflowByPage:{...workspace.mediaOverflowByPage,
          [pageId]:placed.displacedBoxes.filter(box=>!keptIds.has(box.id))},
        pages:{...workspace.pages,[pageId]:{...workspace.pages[pageId],smartPhotoCount:count}}}
      const autoFilled=autoPlaceTaggedMedia(assets,nextWorkspace,{targetPage:pageId})
      update(autoFilled.workspace)
      setGalleryPhotoCount(count)
      setSelectedBoardObject(null);setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
      setLayoutNotice('Fitted '+count+' independent photo objects'+(autoFilled.assigned?', automatically placed '+autoFilled.assigned+' tagged assets':'')+'. Existing photos, captions and manual transforms are preserved. Use Layout to drag/resize the photo itself.')
      setError('')
    }catch(error){setError('Cannot fit this gallery: '+(error?.message||String(error)))}
  }
  const setPhotoPageTags=(value,pageId=page)=>{
    update({...workspace,pageMediaTags:{...workspace.pageMediaTags,
      [pageId]:normalizeTechPackAssetTags(value)}})
  }
  const autoPlaceTaggedMedia=(newAssets=assets,currentWorkspace=workspace,{targetPage=null}={})=>{
    const pages=Object.entries(currentWorkspace.pageBoxes||{})
      .filter(([,boxes])=>Array.isArray(boxes)&&boxes.some(box=>['photo','swatch'].includes(box.slot?.contentType)))
      .map(([pageId,pageBoxes])=>({pageId,pageBoxes}))
    if(!pages.length)return {workspace:currentWorkspace,assigned:0}
    const rules=pages.filter(({pageId})=>!targetPage||pageId===targetPage).map(({pageId})=>{
      const defaultTags=/fabric|material/i.test(pageId)?['fabric','swatch']:
        /colorway|color/i.test(pageId)?['color','fabric']:
        /pattern|grading|cut/i.test(pageId)?['pattern','technical','drawing']:
        /artwork|graphic|logo/i.test(pageId)?['artwork','mockup','graphic']:
        /construct|sewing/i.test(pageId)?['sewing','detail','drawing']:
        /label|trim/i.test(pageId)?['label','trim']:
        /packag/i.test(pageId)?['packaging']:
        /fit|quality|inspection/i.test(pageId)?['fit','quality','detail']:
        ['reference','mockup','drawing','front','back','detail']
      const tags=page===pageId?normalizeTechPackAssetTags(galleryTargetTags):
        currentWorkspace.pageMediaTags?.[pageId]||defaultTags
      return {pageId,tagsAny:tags.length?tags:['reference','mockup','drawing']}
    })
    const input=newAssets.map(asset=>({...asset,
      tags:getTechPackAssetTags(currentWorkspace,asset.id).length?
        getTechPackAssetTags(currentWorkspace,asset.id):inferTechPackAssetTags(asset.name,asset.category),
      category:currentWorkspace.assetFolderOverrides?.[asset.id]||asset.category||'reference'}))
    const placed=assignSmartMediaAssets({pages,assets:input,rules,
      assetTags:currentWorkspace.assetTags||{}})
    const pageBoxes={...currentWorkspace.pageBoxes}
    for(const result of placed.pages)pageBoxes[result.pageId]=result.pageBoxes
    return {workspace:{...currentWorkspace,pageBoxes},assigned:placed.assignments.length}
  }
  const runAutoMediaPlacement=(pageOnly=false)=>{
    try{
      const result=autoPlaceTaggedMedia(assets,workspace,{targetPage:pageOnly?page:null})
      if(result.assigned)update(result.workspace)
      setLayoutNotice(result.assigned?
        'Auto-placed '+result.assigned+' tagged photos and drawings into empty reference slots; existing assigned images were not replaced.':
        'No compatible unassigned references matched the selected page tags. Add or edit tags in Assets, or create more gallery slots.')
      setError('')
    }catch(error){setError('Media assignment failed: '+(error?.message||String(error)))}
  }
  const addMinimalBottomTable=(pageId,presetId='blank')=>{
    const prior=workspace.pageBoxes?.[pageId]||[]
    if(prior.length>=24){setError('Maximum of 24 artboard objects reached');return}
    const id=uid()
    let box
    try{box=createFramedBottomTableBox(presetId,pageId,id,techPackPageLayout(workspace,pageId))}
    catch(error){setError(error?.message||'Unknown table preset');return}
    update({...workspace,pageBoxes:{...workspace.pageBoxes,[pageId]:[...prior,box]}})
    setBottomTablePickerPage('')
    setActiveTableId(id);setSelectedBoardObject({pageId,id:'box-'+id})
    setPage(pageId);selectedPageRef.current=pageId;setEditMode('content')
    setInspectorTab('tables');setLibrarySection('templates')
    setLayoutNotice(`${box.title} inserted edge-to-edge. Click to type, right-click for Table Studio, or select Layout to move or resize.`)
  }
  const applyFullTechpackTemplate=template=>{
    if(template?.kind!=='pack-layout'){setError('Choose a complete saved Techpack system.');return}
    if(!window.confirm('Use this saved Techpack system? Page layouts and inserted boxes will be replaced. Existing garment geometry, source measurements, and source revision will remain unchanged.'))return
    let next=applyTechPackDocumentTemplate(workspace,template,TECHPACK_PAGES,uid,assets.map(asset=>asset.id))
    for(const page of resolveTechPackPages(next,TECHPACK_PAGES)){
      const boxes=(next.pageBoxes?.[page.id]||[]).map(box=>{
        const slot=box.slot
        if(!(slot?.sourceLinked||slot?.spreadsheetTable?.sourceLinked||slot?.spreadsheetTable?.origin==='native')||!source.ready||!slot?.spreadsheetTable?.kind)return box
        try{
          const fresh=createBoundTechPackTable(slot.spreadsheetTable.kind,source,draft)
          return {...box,slot:{...slot,spreadsheetTable:{...rebindTechPackTemplateTable(slot.spreadsheetTable,fresh,{includeAuthored:template.contentMode==='authored'}),id:slot.spreadsheetTable.id,pageId:page.id,boxId:box.id}}}
        }catch{return box}
      })
      next={...next,pageBoxes:{...next.pageBoxes,[page.id]:boxes}}
    }
    update(next)
    setEditMode('layout');setAnnotationTool('select');setSelectedBoardObject(null)
    setLayoutNotice('Complete design system applied. Every linked spreadsheet is populated from the current garment only; authored specifications still require review.')
  }
  const applyProductionPack=pack=>{
    if(!pack||pack.kind!=='production-pack-recipe')return
    if(!window.confirm(`Create ${pack.pageRecipeIds.length} new production worksheets for ${pack.name}? This replaces the existing Tech Pack page layout, archives it for restoration, and leaves garment geometry untouched.`))return
    try{
      const {workspace:next,firstPage,pageCount}=buildProductionTechPack(workspace,pack.id,{
        source,draft,headerFields:workspace.headerFields})
      update(next);setPage(firstPage);selectedPageRef.current=firstPage
      setEditMode('content');setSelectedBoardObject(null);setSelectedVectorIds([]);setActiveTableId('')
      setLayoutNotice(`${pageCount} production worksheets created. Each page has independent editable photo, pattern or drawing slots and an appropriate specification table. Blank factory values need authoring and approval.`)
      setError('')
    }catch(error){setError(error.message||'Could not create production pack')}
  }
  const applyProductionPage=recipe=>{
    if(!recipe?.id)return
    if(documentPages.length>=60){setError('Maximum 60 Tech Pack pages reached.');return}
    try{
      const id='custom-production-'+uid().replace(/[^a-z0-9_-]/gi,'').slice(0,58)
      const next=insertProductionTechPackPage(workspace,recipe.id,{
        id,afterId:page,source,draft,headerFields:workspace.headerFields})
      update(next);setPage(id);selectedPageRef.current=id
      setEditMode('content');setSelectedBoardObject(null);setActiveTableId('')
      setLayoutNotice(`${recipe.name} added with editable content and specification slots; all unknown factory fields remain blank.`)
      setError('')
    }catch(error){setError(error.message||'Could not create production worksheet')}
  }
  const createNikeDemoPack=async()=>{
    // This dedicated, explicitly labeled Build action is the confirmation.
    // WKWebView may suppress window.confirm() without a native JS-dialog
    // delegate; never let the visible Build control silently do nothing.
    // Previous authored Tech Pack pages are archived by the builder, and the
    // saved 2D/3D garment state is not modified.
    try{
      setLayoutNotice('Reading the saved Nike T-shirt garment and assembling the editable 16-page example…')
      const [sourceResponse,renderResponse,artResponse]=await Promise.all([
        fetch(NIKE_TEE_DEMO_SOURCE),fetch(NIKE_TEE_DEMO_RENDER),fetch(NIKE_TEE_DEMO_LOGO)])
      if(!sourceResponse.ok||!renderResponse.ok||!artResponse.ok)throw Error('Saved T-shirt or reference asset missing from installed EXO. Update its web assets before creating this pack.')
      const savedSource=await sourceResponse.json()
      const renderBlob=await renderResponse.blob()
      if(renderBlob.size>120000)throw Error('T-shirt reference render exceeds embedded asset limit')
      const render=await new Promise((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result||''))
        reader.onerror=()=>reject(Error('Could not read saved T-shirt reference render'))
        reader.readAsDataURL(renderBlob)
      })
      const rawSvg=await artResponse.text()
      const svg=rawSvg.replace(/^\s*<\?xml[^>]*\?>\s*/i,'').trim()
      if(!svg.startsWith('<svg'))throw Error('Saved example graphic is not an SVG')
      const logo='data:image/svg+xml,'+encodeURIComponent(svg)
      const result=createNikeTshirtExampleTechPack(workspace,savedSource,{render,logo})
      const next=editNativeTechPackDocument(state,{...result.draftPatch,workspace:result.workspace})
      onChange?.(next)
      setPage(result.firstPage);selectedPageRef.current=result.firstPage
      setEditMode('content');setAnnotationTool('select');setVectorTool('select')
      setSelectedBoardObject(null);setSelectedVectorIds([]);setActiveTableId('')
      setLayoutNotice(`${result.pageCount} editable Nike T-shirt example pages created from the saved EXO garment source, including authentic cutline polygons, print dimensions, and example-only factory tables. No production approval or Nike licensing is implied.`)
      setError('')
      requestAnimationFrame(()=>requestAnimationFrame(()=>navigateToPage(result.firstPage)))
    }catch(error){
      const reason='Nike tee example could not be built: '+(error?.message||String(error))
      setError(reason);setLayoutNotice(reason)
    }
  }
  const insertTemplateBox=(template,pageId=page)=>{
    const presetId=template?.id
    if(!TECHPACK_OBJECT_TEMPLATES.some(item=>item.id===presetId)){
      setError('Old boxed-frame presets were retired. Use a current photo, swatch, note or editable shape in Objects & Frames.')
      return
    }
    try{
      const layout=techPackPageLayout(workspace,pageId)
      const size=techPackArtboardSize(layout)
      const sequence=(workspace.pageBoxes?.[pageId]?.length||0)+(workspace.vectorObjects?.[pageId]?.length||0)
      const id=uid()
      const next=insertTechPackObjectPreset(workspace,presetId,{
        id,pageId,orientation:layout.orientation,pageWidth:size.width,pageHeight:size.height,
        x:Math.min(70+sequence%8*18,size.width-170),y:Math.min(128+sequence%8*18,size.height-170)})
      const vector=TECHPACK_OBJECT_TEMPLATES.find(item=>item.id===presetId)?.kind
      update(next)
      setPage(pageId);selectedPageRef.current=pageId
      setSelectedBoardObject(vector==='vector'||vector==='text'?null:{pageId,id:'box-'+id})
      setSelectedVectorIds(vector==='vector'||vector==='text'?[id]:[])
      setAnnotationTool('select');setVectorTool('select');setEditMode('layout')
      setLayoutNotice((template.name||'Object')+' inserted as a direct editable object with no legacy frame or white card. Select and edit its appearance in Properties.')
      setError('')
    }catch(error){setError('Cannot insert new object: '+(error?.message||String(error)))}
  }
  const editTemplateBox=(pageId,id,patch)=>{
    if(isLayerLocked(pageId,'box-'+id))return
    const before=(workspace.pageBoxes?.[pageId]||[]).find(box=>box.id===id)
    const next={...workspace,pageBoxes:{...workspace.pageBoxes,
      [pageId]:(workspace.pageBoxes?.[pageId]||[]).map(b=>b.id===id?{...b,...patch}:b)}}
    update(before?.slot?.templateRole==='shared-header'&&patch.slot?.spreadsheetTable?
      synchronizeFramedHeaderTables(next,pageId,patch.slot.spreadsheetTable):next)
  }
  const makeTechnicalDrawingTransparent=async sourceAsset=>{
    if(!selectedPageBox||!sourceAsset?.id||!selectedPageBox.assetId){
      setError('Select a linked raster technical drawing first.');return
    }
    try{
      const sourceUrl=sourceAsset.dataUrl||sourceAsset._src||sourceAsset.src
      if(typeof sourceUrl!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,/i.test(sourceUrl))
        throw Error('Only local PNG, JPEG or WebP images can use raster paper removal.')
      const result=await prepareTechnicalFlatTransparentAsset(sourceUrl,{
        enabled:true,background:'corner',tolerance:18,trim:true,padding:8})
      if(!result?.removedPixels)throw Error('No uniform connected paper background was detected around the drawing.')
      const image=new Image()
      image.src=result.dataUrl
      await image.decode()
      const canvas=document.createElement('canvas')
      let encoded=''
      for(const scale of [1,.82,.65,.5]){
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale))
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
        canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height)
        for(const quality of [.92,.8,.66,.52]){
          const candidate=canvas.toDataURL('image/webp',quality)
          if(candidate.startsWith('data:image/webp;base64,')&&candidate.length<250000){encoded=candidate;break}
        }
        if(encoded)break
      }
      if(!encoded)throw Error('Transparent artwork exceeds the project image limit. Crop or resize it before importing.')
      const asset={id:uid(),name:(sourceAsset.name||'Technical flat').replace(/\.[a-z0-9]+$/i,'')+' · Transparent',
        category:sourceAsset.category||'technical flat',caption:(sourceAsset.caption||sourceAsset.name||'Technical flat')+' · alpha',
        dataUrl:encoded,width:canvas.width,height:canvas.height,
        sourceAssetId:sourceAsset.id,derived:'connected-solid-paper-removed',
        provenance:'Source preserved, uniform edge-connected raster background made transparent and trimmed; no vector conversion',
        createdAt:new Date().toISOString()}
      const changed=applyTechPackMediaAssetToBox(selectedPageBox,asset,{width:canvas.width,height:canvas.height})
      const next={...workspace,
        assets:[...(workspace.assets||[]),asset],
        assetTags:{...workspace.assetTags,[asset.id]:getTechPackAssetTags(workspace,sourceAsset.id)},
        pageBoxes:{...workspace.pageBoxes,[page]:(workspace.pageBoxes?.[page]||[]).map(box=>
          box.id===selectedPageBox.id?changed:box)}}
      update(next)
      setSelectedAsset(asset.id)
      setError('')
      setLayoutNotice('Made a separate transparent, artwork-trimmed reference and linked it to this drawing. The original raster is unchanged and the garment interior fills are preserved.')
    }catch(error){setError('Cannot remove paper from this technical flat: '+(error?.message||String(error)))}
  }
  const editSelectedArtworkAppearance=(changes,box=selectedPageBox)=>{
    if(!selectedBoardObject||isLayerLocked(page,selectedBoardObject.id))return
    if(box){
      editTemplateBox(page,box.id,{slot:patchTechPackMediaSlot(box.slot||{},changes)})
      return
    }
    if(!selectedLooseAsset)return
    const objectId='asset-'+selectedLooseAsset.id
    const before=workspace.boardObjects?.[page]?.[objectId]||{}
    update({...workspace,boardObjects:{...workspace.boardObjects,[page]:{
      ...workspace.boardObjects?.[page],[objectId]:{
        ...before,appearance:patchTechPackMediaSlot(before.appearance||{},changes)}}}})
  }
  const recolorSelectedRasterArtwork=async({lineInk,garmentFill})=>{
    const box=selectedPageBox?.slot?.contentType==='photo'?selectedPageBox:null
    const asset=box?assets.find(item=>item.id===box.assetId):selectedLooseAsset
    if(!asset||!selectedBoardObject){setError('Select a placed technical flat or image before recoloring.');return}
    const sourceUrl=asset.dataUrl||asset._src||asset.src
    try{
      const result=await recolorTechPackRasterDataUrl(sourceUrl,{
        inkColor:lineInk,fillColor:garmentFill,maxBytes:250000})
      if(!result?.dataUrl)throw Error('No image was generated')
      if(box){
        editTemplateBox(page,box.id,{slot:{...box.slot,rasterRecoloredDataUrl:result.dataUrl,
          rasterLineInk:lineInk,rasterGarmentFill:garmentFill}})
      }else{
        const objectId='asset-'+asset.id
        const prior=workspace.boardObjects?.[page]?.[objectId]||{}
        update({...workspace,boardObjects:{...workspace.boardObjects,[page]:{
          ...workspace.boardObjects?.[page],[objectId]:{
            ...prior,recoloredDataUrl:result.dataUrl,appearance:{
              ...prior.appearance,rasterLineInk:lineInk,rasterGarmentFill:garmentFill}}}}})
      }
      setError('')
      setLayoutNotice('Updated the line ink and garment fill of this placed raster reference. Original SEAGGS artwork remains unchanged. Raster pixel recoloring is not SVG path editing.')
    }catch(error){setError('Could not recolor this reference: '+(error?.message||String(error)))}
  }
  const editSelectedTable=next=>{
    if(!activeTableBox)return
    if(isLayerLocked(page,tableLayerId(activeTableBox)))return
    if(activeTableBox.legacyTableId)editTable(page,activeTableBox.legacyTableId,()=>next)
    else editTemplateBox(page,activeTableBox.id,{
      title:String(next.title||activeTableBox.title||'Table').slice(0,160),
      slot:{...activeTableBox.slot,title:String(next.title||activeTableBox.title||'Table').slice(0,160),spreadsheetTable:next}})
  }
  const patchCharacterStyle=style=>{
    if(textSelection?.kind==='vector'&&activeVectorIds.length===1){
      const vector=pageVectors.find(item=>item.id===activeVectorIds[0])
      if(vector?.kind==='text'){
        const patch={}
        if(style.fontFamily&&TECHPACK_FONT_CHOICES.includes(style.fontFamily))patch.fontFamily=style.fontFamily
        if(style.fontSize!=null)patch.fontSize=style.fontSize
        if(style.letterSpacing!=null)patch.letterSpacing=style.letterSpacing
        if(style.lineHeight!=null)patch.lineHeight=style.lineHeight
        if(style.color)patch.fill=style.color
        if(style.align)patch.textAlign=style.align
        if(style.bold!=null)patch.fontWeight=style.bold?700:400
        patchVector(vector.id,patch)
      }
      return
    }
    if(!activeTableBox||selectedTableCell.r<0||isLayerLocked(page,tableLayerId(activeTableBox)))return
    try{editSelectedTable(gridcraftTableCommand(activeTableBox.slot.spreadsheetTable,
      {type:'formatCell',row:selectedTableCell.r,column:selectedTableCell.c,style}))}
    catch(error){setError(error.message)}
  }
  const editStudioTable=next=>{
    if(!studioTableBox||isLayerLocked(page,tableLayerId(studioTableBox)))return
    if(studioTableBox.legacyTableId)editTable(page,studioTableBox.legacyTableId,()=>next)
    else editTemplateBox(page,studioTableBox.id,{
      title:String(next.title||studioTableBox.title||'Table').slice(0,160),
      slot:{...studioTableBox.slot,title:String(next.title||studioTableBox.title||'Table').slice(0,160),spreadsheetTable:next}})
  }
  const editSelectedBoxGeometry=(field,raw)=>{
    if(!selectedPageBox)return
    if(isLayerLocked(page,'box-'+selectedPageBox.id))return
    const next=Number(raw)
    if(!Number.isFinite(next))return
    const {orientation:boxOrientation}=techPackPageLayout(workspace,page)
    const pageWidth=boxOrientation==='landscape'?792:612
    const pageHeight=boxOrientation==='landscape'?612:792
    if(selectedPageBox.slot?.category==='tables'){
      const id='box-'+selectedPageBox.id
      const changed=materializeEmbeddedTableGeometry(selectedPageBox,
        workspace.boardObjects?.[page]?.[id]||{},field,next,{width:pageWidth,height:pageHeight})
      update({...workspace,pageBoxes:{...workspace.pageBoxes,
        [page]:(workspace.pageBoxes?.[page]||[]).map(box=>box.id===selectedPageBox.id?changed.box:box)},
        boardObjects:{...workspace.boardObjects,[page]:{
          ...workspace.boardObjects?.[page],[id]:changed.transform}}})
      return
    }
    const currentWidth=Math.min(pageWidth,Math.max(48,Number(selectedPageBox.width)||240))
    const currentHeight=Math.min(pageHeight,Math.max(34,Number(selectedPageBox.height)||180))
    const x=Math.max(0,Math.min(pageWidth-currentWidth,Number(selectedPageBox.x)||0))
    const y=Math.max(0,Math.min(pageHeight-currentHeight,Number(selectedPageBox.y)||0))
    const rounded=Math.round(next)
    const value=field==='x'?Math.max(0,Math.min(pageWidth-currentWidth,rounded)):
      field==='y'?Math.max(0,Math.min(pageHeight-currentHeight,rounded)):
      field==='width'?Math.max(48,Math.min(pageWidth-x,rounded)):
      Math.max(34,Math.min(pageHeight-y,rounded))
    editTemplateBox(page,selectedPageBox.id,{[field]:value})
  }
  const deleteTemplateBox=(pageId,id)=>{
    if(isLayerLocked(pageId,'box-'+id))return
    update({...workspace,pageBoxes:{...workspace.pageBoxes,
      [pageId]:(workspace.pageBoxes?.[pageId]||[]).filter(b=>b.id!==id)}})
  }
  const set3DMarkers=items=>update({...workspace,interactiveMarkers:items.slice(0,60)})
  const addColorway=()=>onChange?.(editNativeTechPackDocument(state,addTechPackColorway(draft,{name:`Colorway ${colorways.length+1}`})))
  const editColorway=(id,patch)=>onChange?.(editNativeTechPackDocument(state,updateTechPackColorway(draft,id,patch)))
  const deleteColorway=id=>onChange?.(editNativeTechPackDocument(state,removeTechPackColorway(draft,id)))
  const saveRevision=()=>{
    const title=revisionLabel.trim()||`Development revision ${revisions.length+1}`
    const checkpoint=createTechPackCheckpoint(source,draft,workspace,title)
    update({...workspace,revisions:appendTechPackCheckpoint(revisions,checkpoint)})
    setRevisionLabel('')
  }
  const editHeaderField=(key,val)=>update({...workspace,headerFields:{...workspace.headerFields,[key]:val}})
  const field=(key,val)=>onChange?.(editNativeTechPackDocument(state,{[key]:val}))
  const refreshSpecifications=()=>{
    if(!source.ready||!window.confirm('Refresh measurements, fabric specifications and material BOM from the current garment? This replaces manual values on those three sheets; custom tables, swatch photos and notes stay intact.'))return
    onChange?.({...state,draft:{...draft,
      pom:structuredClone(source.pom||{}),
      bom:source.fabrics.map(f=>({id:f.id,description:f.name,color:f.color,gsm:f.gsm,thickness:f.thickness,quantity:null,unit:'',supplier:f.supplier||'',cost:null})),
      workspace:{...workspace,cells:{...workspace.cells,measurements:{},fabrics:{},materials:{}}}}})
  }
  const setCell=(pageId,id,index,val)=>{
    const oldOverride=workspace.cells?.[pageId]||{}
    const cells={...workspace.cells,[pageId]:{...oldOverride,[id]:{...oldOverride[id],[index]:val}}}
    const changes={}
    // Keep edited measurement values in the shared Tech Pack draft so both
    // the page editor and existing traditional exports see the same POM table.
    const pageTable=techPackPageTable(pageId,source,{...draft,pom:source.kind==='project'?source.pom:(draft.pom&&Object.keys(draft.pom).length?draft.pom:source.pom),samples:state.samples})
    if(pageId==='measurements'&&index>0&&index<pageTable.headers.length-1){
      const sizes=Object.keys(Object.keys(draft.pom||{}).length?draft.pom:source.pom||{})
      if(index===1||sizes[index-2]){
        const number=Number(val)
        if(val.trim()!==''&&Number.isFinite(number)&&number>=0&&number<=10000){
          const run=Object.keys(draft.pom||{}).length?draft.pom:source.pom||{}
          changes.pom=Object.fromEntries(Object.entries(run).map(([size,rows])=>[size,rows.map(m=>m.id===id?
            {...m,...(index===1?{toleranceCm:number}:size===sizes[index-2]?{cm:number}:{})}:m)]))
        }
      }
    }
    const materialEdit=editTechPackMaterialCell(source,workspace,draft,pageId,id,index,val)
    if(materialEdit?.bom)changes.bom=materialEdit.bom
    update({...workspace,cells:materialEdit?.cells||cells},changes)
  }
  const changeRow=(pageId,id,index,val)=>{
    const rows=workspace.extraRows?.[pageId]||[]
    if(rows.some(r=>r.id===id))update({...workspace,extraRows:{...workspace.extraRows,[pageId]:rows.map(r=>r.id===id?{...r,cells:r.cells.map((c,i)=>i===index?val:c)}:r)}})
    else setCell(pageId,id,index,val)
  }
  const addRow=(pageId=page)=>{
    const rows=workspace.extraRows?.[pageId]||[]
    const headers=techPackPageTable(pageId,source,{...draft,samples:state.samples}).headers
    update({...workspace,extraRows:{...workspace.extraRows,[pageId]:[...rows,{id:uid(),cells:headers.map(()=>'')}]}})
  }
  const removeRow=(pageId,id)=>update({...workspace,extraRows:{...workspace.extraRows,[pageId]:(workspace.extraRows?.[pageId]||[]).filter(r=>r.id!==id)}})
  const attach=id=>{
    if(id==='seaggs-tshirt-private-pair-master'&&
       !(selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('box-'))){
      void placePrivateSeaggsPair(page)
      return
    }
    if(selectedBoardObject?.pageId===page&&/^render-(front|back|side)$/.test(selectedBoardObject.id)){
      const renderId=selectedBoardObject.id
      const original=workspace.boardObjects?.[page]?.[renderId]||{}
      update({...workspace,boardObjects:{...workspace.boardObjects,[page]:{
        ...workspace.boardObjects?.[page],[renderId]:{...original,assetId:id}}}})
      setLayoutNotice('Render image replaced independently. Its position, size and view label remain intact.')
      return
    }
    if(selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('box-')){
      const boxId=selectedBoardObject.id.slice(4)
      const current=(workspace.pageBoxes?.[page]||[]).find(box=>box.id===boxId)
      if(!current)return
      const asset=assets.find(item=>item.id===id)
      const updated=current.slot?.contentType==='photo'&&asset?
        applyTechPackMediaAssetToBox(current,asset,{width:asset.width,height:asset.height}):
        {...current,assetId:id}
      const next={...workspace,pageBoxes:{...workspace.pageBoxes,[page]:
        (workspace.pageBoxes?.[page]||[]).map(box=>box.id===boxId?updated:box)}}
      update(removeUnpositionedDuplicateMediaAsset(next,page,id))
      setLayoutNotice('Replaced selected media with '+(asset?.caption||asset?.name||'asset')+'. The visible artwork is selected directly; the original source remains reusable in Assets.')
      return
    }
    if(selectedBoardObject?.pageId===page&&selectedBoardObject.id==='footer-logo'){
      update({...workspace,pageFooterAssets:{...workspace.pageFooterAssets,[page]:id}})
      setLayoutNotice('Footer logo replaced without changing its artboard transform or factory information.')
      return
    }
    if(selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('asset-')){
      const oldId=selectedBoardObject.id.slice(6)
      const prior=workspace.pageAssets?.[page]||[]
      const updated=prior.map(key=>key===oldId?id:key)
      if(!updated.includes(id))updated.push(id)
      const before=workspace.boardObjects?.[page]||{}
      const revised={...before,['asset-'+id]:{...(before['asset-'+id]||{}),...(before['asset-'+oldId]||{})}}
      if(oldId!==id)delete revised['asset-'+oldId]
      update({...workspace,pageAssets:{...workspace.pageAssets,[page]:[...new Set(updated)]},
        boardObjects:{...workspace.boardObjects,[page]:revised}})
      setSelectedBoardObject({pageId:page,id:'asset-'+id})
      setLayoutNotice('Photo replaced. Existing position and bounding-box scale preserved.')
      return
    }
    const wasLinked=linked.has(id)
    update({...workspace,pageAssets:{...workspace.pageAssets,[page]:wasLinked?[...linked].filter(x=>x!==id):[...linked,id]}})
    if(!wasLinked){
      setSelectedBoardObject({pageId:page,id:'asset-'+id})
      setSelectedBoardObjects([{pageId:page,id:'asset-'+id}])
      setInspectorTab('properties');setRightTab('properties')
      setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
      setLayoutNotice('Artwork placed and selected. Edit its fill/stroke appearance from the Properties panel on the right.')
    }
  }
  const updateAssetCaption=(assetId,caption)=>{
    const safeCaption=String(caption).slice(0,160)
    if((workspace.assets||[]).some(asset=>asset.id===assetId)){
      update({...workspace,assets:workspace.assets.map(asset=>asset.id===assetId?{...asset,caption:safeCaption}:asset)})
    }else if((draft.references||[]).some(asset=>asset.id===assetId)){
      onChange?.(editNativeTechPackDocument(state,{references:draft.references.map(asset=>asset.id===assetId?{...asset,caption:safeCaption}:asset)}))
    }
  }
  const linkFabricSwatch=(fabricId,assetId)=>{
    const linkedWorkspace=setTechPackFabricSwatch(workspace,fabricId,assetId)
    update({...linkedWorkspace,pageAssets:assetId?{
      ...linkedWorkspace.pageAssets,fabrics:[...new Set([...(workspace.pageAssets?.fabrics||[]),assetId])]
    }:linkedWorkspace.pageAssets})
  }
  const uploadFabricSwatch=fabricId=>{
    pendingFabricSwatchRef.current=fabricId
    navigateToPage('fabrics')
    uploadRef.current?.click()
  }
  const uploadGeneralReference=()=>{
    pendingFabricSwatchRef.current=''
    uploadRef.current?.click()
  }
  const classifyAsset=(id,category)=>{
    if(!CATEGORIES.includes(category))return
    update({...workspace,assetFolderOverrides:{...workspace.assetFolderOverrides,[id]:category}})
  }
  const updateAssetTags=(assetId,input)=>update(setTechPackAssetTags(workspace,assetId,input))
  const addOriginalTshirtFlats=()=>{
    try{
      const has=new Set((workspace.assets||[]).map(item=>item.id))
      const originals=[createOriginalTshirtMockupAsset({id:'exo-original-tshirt-front',view:'front'}),
        createOriginalTshirtMockupAsset({id:'exo-original-tshirt-back',view:'back'})].filter(item=>!has.has(item.id))
      if(!originals.length){setLayoutNotice('Both original editable EXO T-shirt SVG reference flats are already in the library.');return}
      const next=addMockupAssets(workspace,originals)
      update({...next,assetTags:{...next.assetTags,...Object.fromEntries(originals.map(item=>[item.id,item.tags]))}})
      setSelectedAsset(originals[0].id);setAssetFolder('mockups');setAssetFilter('all')
      setLayoutNotice('Added '+originals.length+' original EXO front/back SVG T-shirt flats. Use an actual native pattern source to edit individual garment geometry anchors.')
      setError('')
    }catch(error){setError('Cannot add T-shirt mockups: '+(error?.message||String(error)))}
  }
  const importPrivateSeaggsTshirt=async()=>{
    try{
      // The licensed reference lives in this user's PRIVATE installed EXO
      // assets, never in tracked sources or a distributable application preset.
      const response=await fetch('/private-mockups/seaggs-tshirt-private-transparent.png',{cache:'no-store'})
      if(!response.ok)throw Error('Private reference not installed. Select your SEAGGS T-shirt PNG/WebP using Import photos instead.')
      const blob=await response.blob()
      if(!blob.type.startsWith('image/')||blob.size>240000)throw Error('Unexpected private image format or size')
      const dataUrl=await new Promise((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result||''))
        reader.onerror=()=>reject(Error('Private reference could not be read'))
        reader.readAsDataURL(blob)
      })
      const referenceId='seaggs-tshirt-private-transparent-reference'
      if((workspace.assets||[]).some(item=>item.id===referenceId)){
        setSelectedAsset(referenceId);setLayoutNotice('Private SEAGGS T-shirt reference is already in Mockups.');return
      }
      const asset=createPrivateSeaggsMockupAsset({id:referenceId,dataUrl})
      const next=addMockupAssets(workspace,[asset])
      update({...next,assetTags:{...next.assetTags,[asset.id]:asset.tags}})
      setSelectedAsset(asset.id);setAssetFolder('mockups');setAssetFilter('all')
      setLayoutNotice('Added private purchased SEAGGS front/back T-shirt transparent raster reference. This does not convert purchased preview pixels into vector paths.')
      setError('')
    }catch(error){setError(error?.message||String(error))}
  }
  const importPrivateSeaggsVector=async(view='front')=>{
    try{
      if(!['front','back'].includes(view))throw Error('Invalid SEAGGS vector view')
      const response=await fetch(`/private-mockups/seaggs-tshirt-${view}-vector.svg`,{cache:'no-store'})
      if(!response.ok)throw Error('Private SEAGGS source SVG is not installed.')
      const text=await response.text()
      if(text.length>285000||!text.trim().startsWith('<svg'))throw Error('Unsupported private source SVG')
      const validated=analyzeVectorArtwork(text)
      if(!validated.pathCount)throw Error('The source contains no editable vector paths')
      const referenceId=`seaggs-tshirt-private-${view}-vector-reference`
      if((workspace.assets||[]).some(item=>item.id===referenceId)){
        setSelectedAsset(referenceId);setLayoutNotice('True SEAGGS vector T-shirt is already in Mockups.');return
      }
      const dataUrl='data:image/svg+xml,'+encodeURIComponent(validated.svg)
      const asset=createPrivateSeaggsVectorAsset({id:referenceId,dataUrl,
        name:`SEAGGS T-shirt ${view.toUpperCase()} · editable SVG`})
      const next=addMockupAssets(workspace,[asset])
      update({...next,assetTags:{...next.assetTags,[asset.id]:asset.tags}})
      setSelectedAsset(asset.id);setAssetFolder('mockups');setAssetFilter('all')
      setLayoutNotice('Imported genuine source-derived SEAGGS T-shirt SVG paths. Attach it to a page, select it, then edit Fill and Stroke in Properties; the licensed source remains private.')
      setError('')
    }catch(error){setError('Cannot import SEAGGS source vector: '+(error?.message||String(error)))}
  }
  const placePrivateSeaggsPair=async(targetPage=page)=>{
    if(!privateSeaggsVectorReady.front||!privateSeaggsVectorReady.back){
      setError('Both private SEAGGS source vectors must be installed before placing the paired flat.')
      return
    }
    try{
      const masterId='seaggs-tshirt-private-pair-master'
      let master=(workspace.assets||[]).find(item=>item.id===masterId)
      if(!master){
        const responses=await Promise.all(['front','back'].map(view=>
          fetch(`/private-mockups/seaggs-tshirt-${view}-vector.svg`,{cache:'no-store'})))
        if(responses.some(response=>!response.ok))throw Error('A private T-shirt source SVG is missing')
        const originals=await Promise.all(responses.map(response=>response.text()))
        const vetted=originals.map(source=>{
          if(source.length>285000)throw Error('Private vector file exceeds limit')
          return analyzeVectorArtwork(source).svg
        })
        const paired=pairSeaggsTshirtSvg(...vetted)
        const verified=analyzeVectorArtwork(paired)
        if(verified.pathCount!==19)throw Error('Private source pair did not preserve all 19 paths')
        master=createPrivateSeaggsVectorAsset({id:masterId,
          dataUrl:'data:image/svg+xml,'+encodeURIComponent(verified.svg),
          name:'SEAGGS T-shirt FRONT + BACK · grouped SVG'})
      }
      const prior=(workspace.pageAssets?.[targetPage]||[]).length
      const base=(workspace.assets||[]).some(asset=>asset.id===masterId)?workspace:
        addMockupAssets(workspace,[master])
      if(base.assets.length>=60)throw Error('Mockup asset limit reached')
      const instanceId=uid()
      const next=placeSeaggsPairInstance(base,master,{pageId:targetPage,id:instanceId,
        x:0,y:0})
      update(next)
      setPage(targetPage);selectedPageRef.current=targetPage
      setSelectedAsset(masterId)
      setSelectedBoardObject({pageId:targetPage,id:'asset-'+instanceId})
      setSelectedBoardObjects([{pageId:targetPage,id:'asset-'+instanceId}])
      setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
      setInspectorTab('properties');setRightTab('properties')
      setLayoutNotice(`Placed paired SEAGGS FRONT + BACK SVG artwork, copy ${prior+1}. Both views move together, and additional copies can be placed on the same page. Choose Fill / Stroke in Properties.`)
      setError('')
    }catch(error){setError('Cannot place paired SEAGGS vectors: '+(error?.message||String(error)))}
  }
  const importEditablePatternOutlines=async(useSavedTshirt=false)=>{
    try{
      let panels=nativeSnapshot?.template?.panels||[]
      let reference='Current native garment'
      if(useSavedTshirt){
        const response=await fetch(NIKE_TEE_DEMO_SOURCE,{cache:'no-store'})
        if(!response.ok)throw Error('The preserved T-shirt production pattern file is unavailable')
        const saved=await response.json()
        panels=saved.template?.panels||[]
        reference='Saved EXO Nike T-shirt'
      }
      if(!Array.isArray(panels)||!panels.length)
        throw Error('No native pattern polygons. Choose a saved T-shirt example or open a garment with source pattern pieces.')
      const prior=workspace.vectorObjects?.[page]||[]
      if(prior.length+panels.length>250)throw Error('This page already has 250 vector layers')
      const target=panels.slice(0,16)
      const columns=target.length===1?1:2
      const width=columns===1?450:230
      const rows=Math.ceil(target.length/columns)
      const h=Math.min(350,Math.max(65,390/Math.max(1,rows)))
      const objects=target.map((panel,i)=>nativePatternPanelToTechPackPath(panel,{
        id:uid(),pageId:page,x:columns===1?76:54+(i%2)*276,y:144+Math.floor(i/columns)*h,
        maxWidth:width,maxHeight:h-18,stroke:'#171717',fill:'none',strokeWidth:1.5,
        sourceFile:useSavedTshirt?NIKE_TEE_DEMO_SOURCE:null}))
      // For legacy Nike pattern-demo pages, retire only the redundant filled
      // white-card SVG representations of exactly these source IDs. Never
      // remove other user photos, frame drawings or project assets.
      const removedAssetIds=new Set(useSavedTshirt?
        ['nike-tee-demo-front','nike-tee-demo-back']:[])
      const boxes=(workspace.pageBoxes?.[page]||[]).map(box=>{
        if(removedAssetIds.has(box.assetId)&&box.slot?.contentType==='photo')
          return {...box,assetId:undefined,slot:{...box.slot,placeholder:true}}
        return box
      })
      const next={...workspace,vectorObjects:{...workspace.vectorObjects,[page]:[...prior,...objects]},
        pageBoxes:{...workspace.pageBoxes,[page]:boxes}}
      // Select one source-linked outline rather than a front/back multi-selection:
      // the Vector Studio inspector then immediately exposes this path's fill
      // and stroke controls, as in Illustrator.
      update(next);setSelectedBoardObject(null);setSelectedVectorIds([objects[0].id])
      setEditMode('layout');setAnnotationTool('select');setVectorTool('select');setInspectorTab('properties')
      setLayoutNotice('Added '+objects.length+' real editable VectorCraft-style path copies from '+reference+'. Click blue anchor nodes or purple curve handles to reshape, and change stroke/fill in Vector Studio. Native garment geometry is preserved.')
      setError('')
    }catch(error){setError('Cannot convert garment patterns into editable outlines: '+(error?.message||String(error)))}
  }
  const deleteAsset=id=>{
    if(!window.confirm('Remove this uploaded asset from the tech pack?'))return
    const next=removeTechPackAssetTags(removeTechPackFabricSwatchAsset({...workspace,assets:(workspace.assets||[]).filter(a=>a.id!==id),pageAssets:Object.fromEntries(Object.entries(workspace.pageAssets||{}).map(([k,v])=>[k,v.filter(x=>x!==id)]))},id),id)
    const remaining=refs.filter(a=>a.id!==id).map(({_source,_src,...a})=>a)
    update(next,{references:remaining,technicalFlat:draft.technicalFlat?.referenceId===id?null:draft.technicalFlat})
    setSelectedAsset('')
  }
  const handleUpload=async event=>{
    const files=[...(event.target.files||[])].slice(0,20)
    const fabricId=pendingFabricSwatchRef.current
    pendingFabricSwatchRef.current=''
    event.target.value=''
    if(!files.length)return
    if(refs.length+uploads.length+files.length>60){setError('The local tech pack supports up to 60 uploaded reference assets. Import a smaller batch.');return}
    const imported=[]
    for(const file of files){
      try{
        const dataUrl=await readReference(file)
        const dimensions=await techPackImageDimensions(dataUrl)
        imported.push({id:uid(),name:file.name,caption:file.name.replace(/\.[^.]+$/,''),
          category:fabricId?'fabric swatch':assetCategory,dataUrl,...(dimensions||{}),createdAt:new Date().toISOString()})
      }
      catch(err){setError(`${file.name}: ${err.message}`)}
    }
    if(!imported.length)return
    const raster=imported.filter(i=>!i.dataUrl.startsWith('data:image/svg+xml'))
    const vector=imported.filter(i=>i.dataUrl.startsWith('data:image/svg+xml'))
    const selectedPhotoBox=!fabricId&&selectedBoardObject?.pageId===page&&selectedBoardObject?.id?.startsWith('box-')?
      (workspace.pageBoxes?.[page]||[]).find(box=>'box-'+box.id===selectedBoardObject.id&&box.slot?.contentType==='photo'):null
    const inferredTags=Object.fromEntries(imported.map(asset=>[asset.id,
      inferTechPackAssetTags(asset.name,asset.category)]))
    const destination=fabricId?'fabrics':page
    const updatedWorkspace={...workspace,assets:[...(workspace.assets||[]),...vector],
      assetTags:{...workspace.assetTags,...inferredTags},
      // A library import must not also scatter duplicates on the artboard.
      // Only explicit page attachment, tag auto-fill or fabric linking places it.
      pageAssets:{...workspace.pageAssets,
        [destination]:fabricId?[...new Set([...(workspace.pageAssets?.[destination]||[]),...imported.map(i=>i.id)])]:
          [...(workspace.pageAssets?.[destination]||[])]},
      ...(selectedPhotoBox?{pageBoxes:{...workspace.pageBoxes,[page]:(workspace.pageBoxes?.[page]||[]).map(box=>
        box.id===selectedPhotoBox.id?applyTechPackMediaAssetToBox(box,imported[0]):box)}}:{})}
    const base=fabricId?setTechPackFabricSwatch(updatedWorkspace,fabricId,imported[0].id):updatedWorkspace
    const placed=autoPlaceOnUpload?autoPlaceTaggedMedia([...assets,...imported],base):{workspace:base,assigned:0}
    update(placed.workspace,
      {references:[...draft.references||[],...raster]})
    setRightTab('assets');setSelectedAsset(imported[0].id)
    if(selectedPhotoBox||placed.assigned)setLayoutNotice(
      'Imported '+imported.length+' tagged assets'+(placed.assigned?', automatically assigned '+placed.assigned+' matching references':'')+'. Filled references now behave as artwork objects in Layout mode.')
  }
  const assetPreview=(a,pageId=null)=>{
    const board=pageId?workspace.boardObjects?.[pageId]?.['asset-'+a?.id]||{}:{}
    return safeAssetSrc(board.recoloredDataUrl||resolveTechPackArtworkSource20261031(a?._src,board.appearance||{},a))
  }
  const exportCsv=()=>download(`${(source.name||'garment').replace(/[^\w-]+/g,'-')}-${page}.csv`,techPackCsv({headers:table.headers,rows:combinedRows},override),'text/csv;charset=utf-8')
  const exportJson=()=>{
    // A native tech pack lives independently of the legacy project. Bundle its
    // current manufacturing snapshot into the downloaded editable document.
    const exported=nativeMode?{...state,source:{...state.source,
      project:{name:source.name,revision:source.revision},patternPieces:source.panels,
      construction:source.seams,materials:source.fabrics,sizeMeasurements:source.pom,
      grading:source.grading,productionSpec:source.productionSpec}}:state
    download(`${(source.name||'garment').replace(/[^\w-]+/g,'-')}-techpack-draft.json`,JSON.stringify(exported,null,2),'application/json')
  }
  const printFullPack=()=>{
    // Export the same source-derived SVG drawings and author annotations that
    // the engineer sees in the EXO native document editor.
    const artwork=Object.fromEntries(documentPages.map(p=>{
      const el=[...(scrollRef.current?.querySelectorAll('[data-techpack-sheet]')||[])].find(item=>item.getAttribute('data-techpack-sheet')===p.id)
      const drawing=el?.querySelector('[data-annotation-surface]')?.cloneNode(true)
      drawing?.querySelectorAll('[data-editor-only]').forEach(node=>node.remove())
      drawing?.querySelectorAll('[stroke="#2189b6"]').forEach(node=>node.setAttribute('stroke','#c63e3e'))
      return [p.id,drawing?.outerHTML||'']
    }))
    const html=renderTechPackWorkspacePrintHTML(source,draft,workspace,assets,artwork,renderViews)
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
    const preview=window.open(url,'_blank')
    if(!preview){
      URL.revokeObjectURL(url)
      download(`${(source.name||'garment').replace(/[^\w-]+/g,'-')}-all-techpack-pages.html`,html,'text/html;charset=utf-8')
      setError('The full pack was downloaded as printable HTML because the preview window was blocked.')
    }else window.setTimeout(()=>URL.revokeObjectURL(url),60000)
  }

  const renderSheet=sheetDef=>{
    const sheetId=sheetDef.id
    // Source specification edits keep their original stable storage IDs when
    // diagrams and dense factory tables are shown on separate Letter sheets.
    const specificationId=sheetId==='measurement-table'?'measurements':sheetId==='construction-operations'?'construction':sheetId
    const sheetDetails=workspace.pages?.[sheetId]||{}
    const {orientation:sheetOrientation,paperSize:sheetPaperSize}=techPackPageLayout(workspace,sheetId)
    const sheetPreset=sheetDetails.headerPreset||workspace.headerPreset||'seville'
    const sheetTable=techPackPageTable(sheetId,source,{...draft,
      pom:source.kind==='project'?source.pom:(draft.pom&&Object.keys(draft.pom).length?draft.pom:source.pom),samples:state.samples})
    const sheetOverrides=workspace.cells?.[specificationId]||{}
    const sheetExtraRows=workspace.extraRows?.[specificationId]||[]
    const sheetRows=[...sheetTable.rows,...sheetExtraRows]
    const sheetLinked=new Set(workspace.pageAssets?.[sheetId]||[])
    const sheetAssets=assets.filter(a=>sheetLinked.has(a.id)||((sheetId==='flats'||sheetId==='artwork')&&draft.technicalFlat?.referenceId===a.id))
    const authoredMiddleMedia=sheetAssets.length>0||
      (workspace.pageBoxes?.[sheetId]||[]).some(box=>Boolean(box.assetId)||
        (box.slot?.contentType==='swatch'&&Boolean(box.slot?.swatchHex||box.slot?.linkedFabricId)))||
      (workspace.vectorObjects?.[sheetId]||[]).some(item=>!item.hidden)
    const sheetAnnotations=workspace.annotations?.[sheetId]||[]
    const drawingPages=new Set(['flats','callouts','patterns','measurements','construction','artwork'])
    const showDrawing=drawingPages.has(sheetId)||sheetAnnotations.some(item=>item.scope!=='page')||
      (page===sheetId&&['pen','bezier','arrow','dimension','marker'].includes(annotationTool))
    const sheetLayout=sheetDetails.layoutPreset||workspace.layoutPreset||'balanced'
    const theme=(()=>{try{return resolveTechPackPalette(sheetDetails.templateTheme||workspace.templateTheme||'mono')}catch{return resolveTechPackPalette('mono')}})()
    const sheetColors={...theme,...workspace.templateColors,...sheetDetails.templateColors}
    const previewColors=(()=>{try{return themeHover?resolveTechPackPalette(themeHover):null}catch{return null}})()
    const pageThemeApplied=Boolean(sheetDetails.templateTheme||workspace.templateTheme||
      sheetDetails.templateColors?.background||workspace.templateColors?.background)
    const visibleColors=previewColors?{...previewColors,text:techPackThemeText(previewColors.background||previewColors.wash)}:
      {...sheetColors,background:pageThemeApplied?sheetColors.background||sheetColors.wash:'#ffffff',
        text:techPackThemeText(pageThemeApplied?sheetColors.background||sheetColors.wash:'#ffffff')}
    const measurementRefs=['measurements','measurement-table'].includes(sheetId)?measurementReferenceRows(sheetRows):[]
    const board=(id,content)=>workspace.hiddenObjects?.[sheetId]?.includes(id)?null:<TechPackBoardObject key={id} id={id} pageId={sheetId} enabled={editMode==='layout'&&!isLayerLocked(sheetId,id)} keyboardEnabled={selectedBoardObject?.id===id}
      selected={selectedBoardObjects.some(item=>item.pageId===sheetId&&item.id===id)}
      onSelect={selectBoardObject} onChange={updateBoardObject} onGestureStart={boardGestureStart} onContextAction={layoutContext} value={workspace.boardObjects?.[sheetId]?.[id]||{}}
      tightMedia={id.startsWith('asset-')}
      style={{zIndex:workspace.boardObjects?.[sheetId]?.[id]?.zIndex??(selectedIds.includes(id)?25:2),
        ...(id.startsWith('asset-')&&sheetId.startsWith('custom-')?(()=>{
          const index=Math.max(0,(workspace.pageAssets?.[sheetId]||[]).indexOf(id.slice(6)))
          return {position:'absolute',left:56+index%2*254,top:148+Math.floor(index/2)*226,
            width:230}
        })():{})}}
      onEnterContent={()=>focusSelectedContent(sheetId,id)}>{sheetId==='interactive3d'&&['spec-table','notes'].includes(id)?<details className="tpws-3d-supplement"><summary>{id==='notes'?'Page notes & manufacturing comments':'Additional specifications'}</summary>{content}</details>:content}</TechPackBoardObject>
    const renderCustomTable=custom=>board('table-'+custom.id,<section key={custom.id} className="tpws-table-section tpws-custom-table" aria-label="Custom specification table">
            <div className="tpws-custom-table-heading"><div><span>CUSTOM SPECIFICATION / {sheetDef.tag}</span><input aria-label="Custom table title" value={custom.title||''} onChange={event=>editTable(sheetId,custom.id,t=>({...t,title:event.target.value.slice(0,100)}))}/></div>
              <button type="button" title="Download this editable table as CSV" aria-label={`Export table ${custom.title} CSV`} onClick={()=>download(`${(source.name||'garment')}-${sheetId}-${custom.title||'table'}`.replace(/[^\w-]+/g,'-').slice(0,105)+'.csv',techPackCsv({headers:custom.headers,rows:custom.rows}),'text/csv;charset=utf-8')}><Download size={14}/></button>
              <button type="button" title="Delete custom table" aria-label={`Delete table ${custom.title}`} onClick={()=>removeTable(sheetId,custom.id)}><Trash2 size={14}/></button></div>
            <div className="tpws-custom-grid-mount">
              <TechPackSpreadsheetBlock table={custom} sourceLabel={custom.title||'Custom Techpack specification'}
                readOnly={editMode==='layout'||isLayerLocked(sheetId,'table-'+custom.id)} onChange={next=>editTable(sheetId,custom.id,()=>next)}
                externalTools onSelectionChange={position=>{
                  setSelectedBoardObject({pageId:sheetId,id:'table-'+custom.id})
                  setSelectedVectorIds([]);setActiveTableId('legacy-'+custom.id)
                  setSelectedTableCell(position);setInspectorTab('tables');setTablePanelOpen(true)
                }}
                onExit={()=>setSelectedBoardObject(null)}/>
            </div>
          </section>)
    const boxDrawingSurface=editMode==='layout'&&annotationTool==='box'?<div className="tpws-box-drawing-surface" aria-label={`Draw a rectangle on ${sheetDetails.title||sheetDef.name}`}
      onPointerDown={e=>boxGestureStart(e,sheetId)} onPointerMove={boxGestureMove} onPointerUp={boxGestureEnd} onPointerCancel={()=>{boxGesture.current=null;setBoxPreview(null)}}>
      {boxPreview?.pageId===sheetId&&<div className="tpws-box-drawing-preview" style={{left:boxPreview.x,top:boxPreview.y,width:boxPreview.width,height:boxPreview.height}}/>}
    </div>:null
    const vectorArtboard=<TechPackVectorLayer pageId={sheetId} items={workspace.vectorObjects?.[sheetId]||[]}
      selectedIds={sheetId===page?activeVectorIds:[]}
      tool={sheetId===page?vectorTool:'select'} enabled={editMode==='layout'}
      width={sheetOrientation==='landscape'?792:612} height={sheetOrientation==='landscape'?612:792}
      onCreate={createVector} onChange={(sheetId,id,patch)=>patchVector(id,patch,sheetId)} onSelect={selectVector}
      onToolComplete={()=>setVectorTool('direct')}/>
    const positionedBoxes=(workspace.pageBoxes?.[sheetId]||[]).filter(box=>sheetId.startsWith('custom-')||box.positionMode==='absolute').map(box=>
      <TechPackBoardObject key={box.id} id={`box-${box.id}`} pageId={sheetId} enabled={editMode==='layout'&&!isLayerLocked(sheetId,'box-'+box.id)} keyboardEnabled={selectedBoardObject?.id===`box-${box.id}`}
        tightMedia={['photo','swatch'].includes(box.slot?.contentType)&&(
          Boolean(box.assetId)||box.slot?.contentType==='swatch')}
        rightClickOpensEditor={box.slot?.category==='tables'}
        maxTranslation={box.slot?.category==='tables'?1200:400}
        selected={selectedBoardObjects.some(item=>item.pageId===sheetId&&item.id===`box-${box.id}`)}
        onSelect={selectBoardObject} onChange={updateBoardObject} onGestureStart={boardGestureStart} onContextAction={layoutContext}
        onEnterContent={(_page,_id,trigger)=>{
          if(box.slot?.category==='tables'){
            if(trigger==='contextmenu'){
              setActiveTableId(box.id);setSelectedBoardObject({pageId:sheetId,id:'box-'+box.id})
              setInspectorTab('tables');setTableStudio({mode:'placed',id:box.id,pageId:sheetId})
            }else{
              focusSelectedContent(sheetId,'box-'+box.id)
              setLayoutNotice('Table content active: click a cell to select, double-click to type or use the keyboard. Right-click to open Table Studio.')
            }
          }else focusSelectedContent(sheetId,'box-'+box.id)
        }}
        value={workspace.boardObjects?.[sheetId]?.[`box-${box.id}`]||{}}
        style={{position:'absolute',left:Number(box.x)||0,top:Number(box.y)||0,width:box.width,height:box.height,zIndex:workspace.boardObjects?.[sheetId]?.[`box-${box.id}`]?.zIndex??(selectedIds.includes(`box-${box.id}`)?25:2)}}>
        <div className={`tpws-freeform-box ${box.slot?.category==='tables'?'tpws-embedded-table-only':''} ${box.slot?.middleTemplateId?'tpws-middle-widget':''} ${box.slot?.templateRole==='bottom-table'?'tpws-bottom-table-fitted':''} ${box.slot?.templateRole==='reference'?'tpws-minimal-image-box':''} ${box.slot?.templateRole==='reference'&&box.assetId?'tpws-has-referenced-asset':''} ${box.slot?.templateRole==='shared-header'?'tpws-minimal-header-table':''}`}
          data-header-variant={box.slot?.templateRole==='shared-header'?box.slot?.spreadsheetTable?.framedHeaderPreset||'mikristian-reference':undefined}
          style={{width:'100%',height:'100%',border:box.slot?.category==='tables'?'0':`1.5px ${box.border==='dashed'?'dashed':'solid'} ${box.lineColor||'#252c34'}`}}
          onDoubleClick={()=>{if(box.slot?.category!=='tables'&&editMode==='layout'){setEditMode('content');setAnnotationTool('select')}}}>
          <TechPackBoxContent box={box} layoutMode={editMode==='layout'} readOnly={isLayerLocked(sheetId,'box-'+box.id)}
            assets={assets} sourceFabrics={source.fabrics||[]} colorways={colorways} onEdit={patch=>editTemplateBox(sheetId,box.id,patch)}
            externalTableTools
            onOpenTableStudio={()=>{
              setActiveTableId(box.id);setSelectedBoardObject({pageId:sheetId,id:'box-'+box.id})
              setSelectedTableCell({r:0,c:0});setInspectorTab('tables')
              setTableStudio({mode:'placed',id:box.id,pageId:sheetId})
            }}
            onDelete={()=>deleteTemplateBox(sheetId,box.id)} onApplyTemplate={preset=>applyDroppedPreset(preset,sheetId,box.id)}
            onTableSelection={position=>{
              setSelectedBoardObject({pageId:sheetId,id:'box-'+box.id})
              setActiveTableId(box.id);setSelectedTableCell(position);setInspectorTab('properties');setTablePanelOpen(true)
            }}
            onTextSelect={selection=>{
              setActiveTableId(box.id);setSelectedBoardObject({pageId:sheetId,id:'box-'+box.id})
              setSelectedTableCell({r:selection.row,c:selection.column})
              setTextSelection({...selection,kind:'table',textKind:selection.kind,pageId:sheetId,id:box.id})
              setInspectorTab('properties')
            }}
            onAssetPick={()=>{setLibrarySection('assets');setRightTab('assets');setLayoutNotice('Choose an image in the Assets library and attach it to your selected box.');setSelectedBoardObject({pageId:sheetId,id:'box-'+box.id})}}/>
        </div>
      </TechPackBoardObject>)
    // Unlike built-in manufacturing pages, a custom page is a genuinely empty
    // white sheet: no inherited factory header, frame, notes or footer. It
    // contains only the elements that the designer deliberately adds.
    if(sheetId.startsWith('custom-'))return <div key={sheetId} className={`tpws-sheet-frame tpws-sheet-frame-${sheetOrientation}`}
      data-paper-size={sheetPaperSize} style={{zoom:documentZoom==='fit'?Math.max(.1,Math.min(6,(canvasWidth-96)/techPackArtboardSize({orientation:sheetOrientation,paperSize:sheetPaperSize}).width)):Number(documentZoom)}}>
      <div className="tpws-sheet-frame-caption" data-artboard-caption={sheetId} draggable={annotationTool==='artboard'}
        onClick={()=>{if(annotationTool==='artboard')navigateToPage(sheetId)}}
        onDragStart={event=>{if(annotationTool!=='artboard')return;setDragPage(sheetId);event.dataTransfer.setData('application/x-exo-techpack-page',sheetId)}}
        onDragOver={event=>{if(annotationTool==='artboard')event.preventDefault()}}
        onDrop={event=>{const from=event.dataTransfer.getData('application/x-exo-techpack-page');if(from){event.preventDefault();reorderDocumentPage(from,sheetId);setDragPage('')}}}>
        <span>{documentPages.findIndex(item=>item.id===sheetId)+1} / {documentPages.length} · {sheetDetails.title||sheetDef.name}</span><span>{sheetOrientation.toUpperCase()} · {sheetPaperSize==='Letter'?'8.5 × 11 IN':'A4'}</span></div>
      <article className={`tpws-paper tpws-custom-empty-sheet tpws-${sheetOrientation} ${sheetDetails.minimalFramedTemplate?'tpws-minimal-framed':''} ${editMode==='layout'?'tpws-layout-editing':''}`}
        style={{'--tpws-template-accent':visibleColors.accent,'--tpws-template-rule':visibleColors.line,
          '--tpws-template-wash':visibleColors.wash,'--tpws-page-bg':visibleColors.background||visibleColors.wash||'#ffffff',
          '--tpws-page-ink':visibleColors.text||'#1d2630',
          '--tpws-header-bg':visibleColors.header||visibleColors.accent,
          '--tpws-table-bg':visibleColors.table||visibleColors.wash,
          '--tpws-panel-bg':visibleColors.body||visibleColors.wash}}
        data-artboard-grid={editMode==='layout'&&workspace.artboardGuides?.[sheetId]?.visible?'visible':'hidden'}
        data-testid={sheetId===page?'techpack-page':undefined} data-techpack-sheet={sheetId} data-custom-blank="true" data-paper-size={sheetPaperSize} data-orientation={sheetOrientation}
        onPointerDown={e=>{if(e.target===e.currentTarget&&editMode==='layout'&&annotationTool==='select')selectBoardObject(null)}}
        onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-exo-techpack-template')||
          e.dataTransfer.types.includes('application/x-exo-techpack-seaggs-pair'))e.preventDefault()}}
        onDrop={e=>handlePageTemplateDrop(e,sheetId)}>
        {sheetDetails.minimalFramedTemplate&&<>
          <span className="tpws-minimal-page-number" aria-label={'Page '+(documentPages.findIndex(item=>item.id===sheetId)+1)}>
            {documentPages.findIndex(item=>item.id===sheetId)+1}
          </span>
          <div className="tpws-seville-ruled-frame tpws-minimal-layout-frame" aria-label="Blank framed Tech Pack page">
            {!(workspace.pageBoxes?.[sheetId]||[]).some(box=>box.slot?.templateRole==='shared-header')&&<SevilleSheetHeader source={source} draft={draft} sheetDef={sheetDef} details={sheetDetails}
              index={documentPages.findIndex(item=>item.id===sheetId)} total={documentPages.length}
              headerFields={workspace.headerFields||{}} onHeaderField={editHeaderField}
              onPageField={(key,val)=>configure({[key]:val},sheetId)}/>}
            <div className="tpws-minimal-open-space">
              {!authoredMiddleMedia&&
                !(workspace.pageBoxes?.[sheetId]||[]).some(box=>box.slot?.templateRole==='reference')&&
                <button type="button" className="tpws-minimal-visual-placeholder"
                  title="Choose an uploaded drawing, garment photo, mockup or logo from Project Assets"
                  onClick={()=>prepareMinimalReferenceBox(sheetId)}>
                  <ImagePlus size={20}/><strong>Place technical drawing / image</strong>
                  <small>Use Project Assets · References · Logos · Hangtags</small>
                </button>}
              {!authoredMiddleMedia&&
                !(workspace.pageBoxes?.[sheetId]||[]).some(box=>box.slot?.category==='tables'&&box.slot?.templateRole!=='shared-header')&&<>
                <button type="button" className="tpws-minimal-bottom-table-add"
                  aria-expanded={bottomTablePickerPage===sheetId} aria-haspopup="dialog"
                  onClick={()=>setBottomTablePickerPage(current=>current===sheetId?'':sheetId)}>
                    <Table2 size={13}/> Choose bottom table template <ChevronRight size={12}/></button>
                {bottomTablePickerPage===sheetId&&<TechPackBottomTablePicker
                  onSelect={presetId=>addMinimalBottomTable(sheetId,presetId)}
                  onClose={()=>setBottomTablePickerPage('')}/>}
              </>}
            </div>
          </div>
          <div className="tpws-minimal-page-footer" aria-label="Framed page footer">
            {draft.brand?.trim()||'TECH PACK'}
          </div>
        </>}
        {positionedBoxes}
        {(workspace.tables?.[sheetId]||[]).map(renderCustomTable)}
        {(workspace.pageAssets?.[sheetId]||[]).filter(id=>showLooseMediaAsset(sheetId,id)).map(id=>assets.find(item=>item.id===id)).filter(Boolean).map(asset=>board('asset-'+asset.id,
          <figure className="tpws-custom-page-image tpws-standalone-artwork" aria-label={asset.name||'Technical drawing'}>
            {assetPreview(asset,sheetId)?<img src={assetPreview(asset,sheetId)} alt={asset.name||'Technical drawing'} draggable={false}/>:<FileImage size={28}/>}
          </figure>))}
        {boxDrawingSurface}
        {vectorArtboard}
        <TechPackPageMarkup pageId={sheetId} mode={annotationTool==='pencil'?'pencil':'highlighter'}
          active={annotationTool==='pencil'||annotationTool==='highlighter'}
          color={annotationTool==='pencil'?pencilColor:highlightColor}
          width={annotationTool==='pencil'?pencilWidth:highlightWidth}
          annotations={sheetAnnotations} onAdd={addAnnotation}/>
        <TechPackPageReview pageId={sheetId} tool={annotationTool} notes={workspace.reviewNotes?.[sheetId]||[]}
          width={sheetOrientation==='landscape'?792:612} height={sheetOrientation==='landscape'?612:792}
          onAdd={(kind,point)=>addReviewNote(sheetId,kind,point)}
          onUpdate={(id,patch)=>updateReviewNote(sheetId,id,patch)} onDelete={id=>removeReviewNote(sheetId,id)}/>
      </article>
    </div>
    return <div className={`tpws-sheet-frame tpws-sheet-frame-${sheetOrientation}`} data-paper-size={sheetPaperSize} key={sheetId} style={{zoom:documentZoom==='fit'
      ?Math.max(.1,Math.min(6,(canvasWidth-96)/techPackArtboardSize({orientation:sheetOrientation,paperSize:sheetPaperSize}).width))
      :Number(documentZoom)}}>
      <div className="tpws-sheet-frame-caption" data-artboard-caption={sheetId} draggable={annotationTool==='artboard'}
        onClick={()=>{if(annotationTool==='artboard')navigateToPage(sheetId)}}
        onDragStart={event=>{if(annotationTool!=='artboard')return;setDragPage(sheetId);event.dataTransfer.setData('application/x-exo-techpack-page',sheetId)}}
        onDragOver={event=>{if(annotationTool==='artboard')event.preventDefault()}}
        onDrop={event=>{const from=event.dataTransfer.getData('application/x-exo-techpack-page');if(from){event.preventDefault();reorderDocumentPage(from,sheetId);setDragPage('')}}}>
        <span>{documentPages.findIndex(item=>item.id===sheetId)+1} / {documentPages.length} · {sheetDetails.title||sheetDef.name}</span><span>{sheetOrientation.toUpperCase()} · {sheetPaperSize==='Letter'?'8.5 × 11 IN':'A4'}</span></div>
      <article className={`tpws-paper tpws-seville-paper tpws-${sheetOrientation} tpws-header-${sheetPreset} tpws-layout-${sheetLayout} ${editMode==='layout'?'tpws-layout-editing':''}`} style={{
        '--tpws-template-accent':visibleColors.accent,'--tpws-template-rule':visibleColors.line,
        '--tpws-template-wash':visibleColors.wash,'--tpws-page-bg':visibleColors.background||'#ffffff',
        '--tpws-page-ink':visibleColors.text||'#171717','--tpws-header-bg':visibleColors.header||visibleColors.accent,
        '--tpws-table-bg':visibleColors.table||visibleColors.wash,'--tpws-panel-bg':visibleColors.body||visibleColors.wash,
        backgroundColor:visibleColors.background||'#ffffff',color:visibleColors.text||'#171717'}}
        data-testid={sheetId===page?"techpack-page":undefined} data-techpack-sheet={sheetId} data-layout-style={sheetLayout} data-orientation={sheetOrientation} data-paper-size={sheetPaperSize}
        data-artboard-grid={editMode==='layout'&&workspace.artboardGuides?.[sheetId]?.visible?'visible':'hidden'}
        onBeforeInputCapture={event=>{if(editMode==='layout')event.preventDefault()}}
        onPasteCapture={event=>{if(editMode==='layout')event.preventDefault()}}
        onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-exo-techpack-template'))event.preventDefault()}}
        onDrop={event=>handlePageTemplateDrop(event,sheetId)}>
          <div className="tpws-seville-top-number" aria-label={`Page ${documentPages.findIndex(p=>p.id===sheetId)+1}`}>{documentPages.findIndex(p=>p.id===sheetId)+1}</div>
          <div className="tpws-page-content-scroll" tabIndex={0} role="region" aria-label={`${sheetDetails.title||sheetDef.name} page content`}>
          <div className="tpws-seville-ruled-frame" data-seville-page-frame={sheetId}>
          {board('header',<SevilleSheetHeader source={source} draft={draft} sheetDef={sheetDef} details={sheetDetails} index={documentPages.findIndex(p=>p.id===sheetId)} total={documentPages.length}
            headerFields={workspace.headerFields||{}} onHeaderField={editHeaderField} onPageField={(key,val)=>configure({[key]:val},sheetId)}/>) }
          {sheetId==='authoring-checklist'&&<section className="tpws-authoring-checklist" aria-label="Techpack pre-production authoring checklist">
            <div className="tpws-authoring-heading"><div><strong>PRE-PRODUCTION SPECIFICATION REVIEW</strong><span>Check whether essential factory handoff fields are recorded.</span></div><span>{authoring.recorded} / {authoring.total} RECORDED</span></div>
            <div className="tpws-authoring-grid">{authoring.items.map(item=><button type="button" key={item.id} className={item.done?'tpws-authoring-done':'tpws-authoring-missing'} onClick={()=>navigateToPage(item.pageId)} title={`${item.title}: ${item.detail}`}>
              <span aria-hidden="true">{item.done?'✓':'!'}</span><strong>{item.title}</strong><small>{item.done?'Recorded':'Needs input'}</small>
            </button>)}</div>
            <p>Document fields can be completed without approval. Physical fit, fabric testing and factory sign-off are separate requirements.</p>
          </section>}
          {sheetId==='factory-review'&&<section className="tpws-factory-review" aria-label="Factory handoff readiness review">
            <div className="tpws-factory-review-heading"><div><ClipboardCheck size={17}/><strong>FACTORY HANDOFF REVIEW</strong></div><span>{factoryReview.counts.missing} MISSING · {factoryReview.counts.review} TO VERIFY</span></div>
            <p>The following records require attention before factory handoff. Physical sample and factory approval must be recorded separately.</p>
            <div className="tpws-factory-review-items">{factoryReview.items.map(item=><button key={item.id} type="button" onClick={()=>navigateToPage(item.pageId)} title={item.description}>
              <span className={item.status==='missing'?'missing':'review'}>{item.status==='missing'?'MISSING':'VERIFY'}</span><strong>{item.label}</strong><small>{item.description}</small>
            </button>)}{factoryReview.items.length===0&&<p>All tracked records are complete. Confirm physical sample testing and factory sign-off before releasing production.</p>}</div>
          </section>}
          {sheetId==='factory-review'&&<TechPackFactoryReviewPanel
            sourceTable={factoryPOMTable}
            review={workspace.factorySampleReview}
            onChange={next=>update({...workspace,factorySampleReview:next})}/>}
          {sheetId==='overview'&&!workspace.hiddenObjects?.[sheetId]?.includes('renders')&&<section className="tpws-render-reference">
            <header><span>GARMENT APPEARANCE · EXO LIVE 3D</span><button type="button" onClick={()=>window.dispatchEvent(new Event('exo-clothcraft-techpack-render-capture-request'))} title="Refresh renders from the native EXO 3D viewer"><RefreshCw size={12}/> Capture views</button></header>
            <div className="tpws-render-triptych">{['front','back','side'].map(view=>{
              const objectId=`render-${view}`
              const override=assets.find(asset=>asset.id===workspace.boardObjects?.[sheetId]?.[objectId]?.assetId)
              const imageSrc=assetPreview(override)||renderViews[view]
              return <TechPackBoardObject key={view} id={objectId} pageId={sheetId} enabled={editMode==='layout'} keyboardEnabled={selectedBoardObject?.id===objectId}
                selected={selectedBoardObjects.some(item=>item.pageId===sheetId&&item.id===objectId)}
                onSelect={selectBoardObject} onChange={updateBoardObject} onGestureStart={boardGestureStart} onContextAction={layoutContext}
                onEnterContent={()=>focusSelectedContent(sheetId,objectId)}
                value={workspace.boardObjects?.[sheetId]?.[objectId]||{}}
                style={{minWidth:0,zIndex:workspace.boardObjects?.[sheetId]?.[objectId]?.zIndex??(selectedIds.includes(objectId)?25:2)}}>
                <figure>{imageSrc?<img src={imageSrc} alt={`${view} garment reference`}/>:<div className="tpws-render-pending"><FileImage size={18}/> No {view} view captured</div>}
                  <figcaption>{view.toUpperCase()} · {override?'REFERENCE IMAGE':'3D RENDER'}</figcaption></figure>
              </TechPackBoardObject>
            })}</div>
          </section>}
          {sheetId==='measurements'&&<section className="tpws-pom-guide"><strong>05 / MEASUREMENT ENGINEERING</strong><span>Draw dimension leaders over front/back views. Link each arrow to its point of measure; reference numbers match the table below. Screen distance is not a real measured dimension.</span><button type="button" onClick={()=>{setAnnotationTool('dimension');navigateToPage(sheetId)}}><Ruler size={15}/> Add dimension</button></section>}
          {sheetId==='grading'&&<section className="tpws-pom-guide"><strong>05 / PATTERN GRADING</strong><span>Base pattern cutlines come from the current garment. Size values and incremental grade rules below come from recorded POM or grading data; graded pattern outlines are not invented.</span><button type="button" onClick={()=>navigateToPage('measurements')}><FileSpreadsheet size={15}/> POM source</button></section>}
          {sheetId==='interactive3d'&&(page===sheetId?<TechPackInteractive3D snapshot={nativeSnapshot} markers={workspace.interactiveMarkers||EMPTY_3D_MARKERS} onChange={set3DMarkers} fallbackViews={renderViews} onOpenPattern={marker=>{
            const panelId=String(marker?.panelId||'')
            if(panelId&&source.panels.some(panel=>String(panel.id)===panelId)){
              setFocused3DPanel(panelId)
              navigateToPage('patterns')
            }else setError('This detail is not linked to a source pattern piece. Place a marker on garment geometry to link a real panel.')
          }}/>:<section className="tpws-3d-page-preview"><strong>INTERACTIVE 3D GARMENT / DETAIL MAP</strong>{renderViews.front?<img src={renderViews.front} alt="3D garment front preview"/>:<p>Open this sheet for the interactive 3D viewer.</p>}<span>{(workspace.interactiveMarkers||EMPTY_3D_MARKERS).length} EDITABLE DETAIL MARKERS</span><button type="button" onClick={()=>navigateToPage('interactive3d')}>Open 3D viewer</button></section>)}
          {sheetId!=='interactive3d'&&showDrawing&&board('drawing',<TechPackTechnicalBoard pageId={sheetId} source={source} nativeSnapshot={nativeSnapshot} project={project} nativeMode={nativeMode} focusPanelId={focused3DPanel}
            measurementTable={sheetTable} measurementOverrides={sheetOverrides}
            tool={annotationTool} annotations={sheetAnnotations} selectedId={selectedAnnotationId} highlighterColor={highlightColor} highlighterWidth={highlightWidth} onAdd={addAnnotation}
            onUpdate={updateAnnotation} onDelete={deleteAnnotation} onSelect={setSelectedAnnotationId} onPageSelect={setPage}/>) }
          {sheetId==='measurements'&&<section className="tpws-pom-register"><div className="tpws-section-title"><h2>MEASUREMENT LEADER / NOTE INDEX</h2><span>{sheetAnnotations.filter(a=>a.type==='dimension'||a.type==='arrow').length} CALLOUTS</span></div>
            {sheetAnnotations.filter(a=>a.type==='dimension'||a.type==='arrow').map((a,i)=>{
              const specification=a.type==='dimension'?linkedMeasurementLabel(a,sheetTable,sheetOverrides):null
              return <div className="tpws-pom-link-row" key={a.id}><button type="button" onClick={()=>{navigateToPage(sheetId);setSelectedAnnotationId(a.id);setAnnotationTool('select')}}>{a.type==='dimension'?<Ruler size={14}/>:<MoveUpRight size={14}/>}<strong>{specification?.reference||a.label||`N${i+1}`}</strong></button>
                <span>{specification?.detail||a.instruction||'Add a detail note in the Property Editor'}</span>
                <small>{a.type==='dimension'?(a.placementVerified?'Placement checked':'Placement to verify'):'Factory note'}</small></div>
            })}
            {!sheetAnnotations.some(a=>a.type==='dimension'||a.type==='arrow')&&<div className="tpws-pom-empty">No callouts placed. Use the <strong>Dimension</strong> tool to mark two endpoints on the drawing; connect that leader to a POM in the Property Editor. Use <strong>Arrow</strong> for construction notes.</div>}
          </section>}
          {sheetId==='callouts'&&<section className="tpws-callout-register"><div className="tpws-section-title"><h2>CONSTRUCTION DETAIL / LEADER REGISTER</h2><span>{sheetAnnotations.filter(a=>a.type==='arrow').length} ARROWS</span></div>
            <p>Use the Arrow tool on the drawing above to point to a seam, trim, pocket or label. Select an arrow to move it, then fill in its factory instruction below.</p>
            <div className="tpws-table-scroll"><table className="tpws-sheet-table"><thead><tr><th>REF</th><th>COMPONENT / LOCATION</th><th>FACTORY DETAIL / DIMENSION</th></tr></thead><tbody>
              {sheetAnnotations.filter(a=>a.type==='arrow').map((a,i)=><tr key={a.id}><td><input aria-label={`Callout ${i+1} reference`} value={a.label||''} onChange={e=>updateAnnotation(sheetId,a.id,{label:e.target.value.slice(0,35)})}/></td>
                <td><input aria-label={`Callout ${i+1} component`} placeholder="e.g. sleeve hem" value={a.component||''} onChange={e=>updateAnnotation(sheetId,a.id,{component:e.target.value.slice(0,100)})}/></td>
                <td><input aria-label={`Callout ${i+1} instruction`} placeholder="Stitch type, placement, tolerance" value={a.instruction||''} onChange={e=>updateAnnotation(sheetId,a.id,{instruction:e.target.value.slice(0,260)})}/></td></tr>)}
              {!sheetAnnotations.some(a=>a.type==='arrow')&&<tr><td colSpan={3} className="tpws-empty-cells">No arrow details yet. Draw a leader line on the garment to add one.</td></tr>}
            </tbody></table></div><button type="button" className="tpws-callout-activate" onClick={()=>setAnnotationTool('arrow')}><MoveUpRight size={15}/> Draw a callout arrow</button>
          </section>}
          {sheetId==='fabrics'&&board('fabric-swatches',<section className="tpws-fabric-section"><div className="tpws-section-title"><h2>FABRIC LIBRARY / MATERIAL SWATCHES</h2><span>{source.fabrics.length} FABRIC REFERENCES</span></div>
            <div className="tpws-fabric-grid">{source.fabrics.map((fabric,i)=>{
              const entries=workspace.cells?.fabrics?.[fabric.id]||{}
              const authored=(Array.isArray(draft.bom)?draft.bom:[]).find(item=>String(item.id)===String(fabric.id))||{}
              const color=entries[1]??authored.color??fabric.color??''
              const swatch=/^#[0-9a-f]{3,8}$/i.test(String(color))?color:'#dce2e5'
              const image=getTechPackFabricSwatch(workspace,fabric.id,assets)
              const imageSrc=assetPreview(image)
              return <article className="tpws-fabric-card" key={fabric.id}>
                <div className="tpws-fabric-swatch" style={{backgroundColor:swatch}} aria-label={`${authored.description||fabric.name} material swatch`}>
                  {imageSrc&&<img src={imageSrc} alt={`${authored.description||fabric.name} fabric reference · ${image.caption||image.name}`}/>}
                  <span>FAB {String(i+1).padStart(2,'0')}</span>
                </div>
                <div><strong>{authored.description||fabric.name}</strong><small>{fabric.id} · {color||'COLOR TBD'}</small>
                <dl><div><dt>COMPOSITION</dt><dd>{(entries[2]??authored.composition??fabric.composition)||'Specify fiber mix'}</dd></div><div><dt>WEIGHT</dt><dd>{(entries[3]??authored.gsm??fabric.gsm)||'—'} GSM</dd></div><div><dt>MILL</dt><dd>{(entries[7]??authored.supplier??fabric.supplier)||'Not assigned'}</dd></div></dl>
                <div className="tpws-fabric-link"><label>Fabric photo
                  <select aria-label={`Fabric swatch photo for ${fabric.name}`} value={imageSrc?image.id:''} onChange={e=>linkFabricSwatch(fabric.id,e.target.value)}>
                    <option value="">No linked photo</option>
                    {assets.filter(a=>assetPreview(a)).map(asset=><option value={asset.id} key={asset.id}>{asset.caption||asset.name}</option>)}
                  </select></label>
                  <button type="button" title={`Upload a swatch photograph for ${fabric.name}`} onClick={()=>uploadFabricSwatch(fabric.id)}><ImagePlus size={13}/> Upload</button>
                </div></div>
              </article>
            })}{!source.fabrics.length&&<p className="tpws-origin-note">No fabric is assigned in the garment source. Add fabrics in EXO or enter rows in the specification below.</p>}</div>
            <p className="tpws-fabric-hint">Assign a photographed swatch to each fabric. The selected image is saved with the document and printed beside that fabric. Verify mill approval and lab dips separately; linking a photograph is not factory approval. Record composition, usable width, stretch, shrinkage and finish below.</p>
          </section>)}
          {sheetId==='colorways'&&<section className="tpws-colorway-library" aria-label="Editable garment colorways">
            <div className="tpws-section-title"><h2>COLORWAY LIBRARY / FINISHES</h2><span>{colorways.length} VARIATIONS</span></div>
            <p>Record each version's actual fabric, color standard, wash, and factory instructions. These specifications are saved with the garment Techpack.</p>
            <div className="tpws-colorway-grid">{colorways.map(colorway=><article className="tpws-colorway-card" key={colorway.id}>
              <div className="tpws-colorway-swatch" style={{background:/^#[0-9a-f]{6}$/i.test(colorway.hex)?colorway.hex:'#e6eaed'}}><span>{colorway.name||'UNNAMED COLORWAY'}</span></div>
              <div className="tpws-colorway-fields">
                <label>Colorway name<input aria-label={`Colorway ${colorway.id} name`} maxLength={80} value={colorway.name} onChange={e=>editColorway(colorway.id,{name:e.target.value})}/></label>
                <label>Reference / code<input aria-label={`Colorway ${colorway.id} color code`} maxLength={65} value={colorway.code} placeholder="Pantone or mill reference" onChange={e=>editColorway(colorway.id,{code:e.target.value})}/></label>
                <label>Preview HEX<input aria-label={`Colorway ${colorway.id} hexadecimal color`} maxLength={7} value={colorway.hex} placeholder="#000000" onChange={e=>editColorway(colorway.id,{hex:e.target.value})}/></label>
                <label>Fabric<select aria-label={`Colorway ${colorway.id} fabric`} value={colorway.fabric} onChange={e=>editColorway(colorway.id,{fabric:e.target.value})}><option value="">Select documented fabric</option>{source.fabrics.map(f=><option key={f.id} value={f.id}>{f.name||f.id}</option>)}{colorway.fabric&&!source.fabrics.some(f=>f.id===colorway.fabric)&&<option value={colorway.fabric}>{colorway.fabric} (external reference)</option>}</select></label>
                <label>Finish / wash<input aria-label={`Colorway ${colorway.id} finish`} maxLength={120} value={colorway.finish} placeholder="Garment wash, dye, coating" onChange={e=>editColorway(colorway.id,{finish:e.target.value})}/></label>
                <label>Factory notes<textarea aria-label={`Colorway ${colorway.id} notes`} rows={2} maxLength={400} value={colorway.notes} onChange={e=>editColorway(colorway.id,{notes:e.target.value})}/></label>
                <button type="button" className="tpws-colorway-delete" aria-label={`Remove ${colorway.name||colorway.id} colorway`} onClick={()=>deleteColorway(colorway.id)}><Trash2 size={13}/> Remove colorway</button>
              </div>
            </article>)}{colorways.length===0&&<p className="tpws-colorway-empty">No colorways authored. Create a version for each planned fabric color and treatment.</p>}</div>
            <button type="button" className="tpws-colorway-add" onClick={addColorway}><Plus size={14}/> Add colorway</button>
          </section>}
          {sheetAssets.length>0&&(['flats','artwork','fabrics'].includes(sheetId))&&<section className="tpws-sheet-media"><h2>{sheetId==='flats'?'TECHNICAL FLATS / VISUAL CALLOUTS':sheetId==='fabrics'?'FABRIC SWATCH PHOTOGRAPHS / APPROVAL REFERENCES':'ARTWORK / LOGOS / PLACEMENTS'}</h2>
            <div className="tpws-sheet-gallery">{sheetAssets.map(a=>board('asset-'+a.id,<figure key={a.id}>{assetPreview(a,sheetId)?<img src={assetPreview(a,sheetId)} alt={a.caption||a.name}/>:<div className="tpws-empty-image"><FileImage size={32}/><span>{a.name}</span></div>}<figcaption><strong>{a.caption||a.name}</strong><span>{a.category||'Reference'}{a.panel?` · ${a.panel}`:''}</span></figcaption></figure>))}</div>
          </section>}
          {sheetTable.headers.length>0 && !['flats','patterns','colorways','measurements','construction'].includes(sheetId)&&(sheetId!=='artwork'||sheetRows.length>0)&&board('spec-table',<section className="tpws-table-section"><div className="tpws-section-title"><h2>{sheetId==='grading'?'PATTERN GRADING / SIZE RULES':sheetId==='artwork'?'GRAPHIC DIMENSIONS & PLACEMENTS':sheetId==='measurement-table'?'POINTS OF MEASURE · CM':sheetId==='construction-operations'?'SEWING OPERATION REGISTER':sheetId==='pattern-cutlist'?'PATTERN CUT LIST':sheetId==='materials'?'BILL OF MATERIALS':sheetId==='fabrics'?'FABRIC PERFORMANCE SPECIFICATIONS':sheetId==='packaging'?'PACKAGING & FOLDING INSTRUCTIONS':`${sheetDef.name.toUpperCase()} / SPECIFICATION`}</h2><span>{sheetRows.length} ROWS</span></div>
            <div className="tpws-table-scroll"><table className={`tpws-sheet-table ${sheetId==='measurement-table'?'tpws-measurement-grid':''}`}><thead><tr>{sheetId==='measurement-table'&&<th scope="col">REF</th>}{sheetTable.headers.map((col,i)=><th key={`${col}-${i}`} scope="col">{col}</th>)}{sheetExtraRows.length>0&&<th aria-label="Row actions"/>}</tr></thead><tbody>{sheetRows.map((r,ri)=><tr key={r.id}>
              {sheetId==='measurement-table'&&<td className="tpws-pom-ref">{measurementRefs[ri]?.reference||''}</td>}
              {r.cells.map((cell,ci)=><td key={`${r.id}-${ci}`}><input type="text" aria-label={`${sheetTable.headers[ci]} row ${ri+1}`} value={sheetExtraRows.some(x=>x.id===r.id)?cell:sheetOverrides[r.id]?.[ci]??cell} onChange={e=>changeRow(specificationId,r.id,ci,e.target.value)} title="Edit this specification cell"/></td>)}
              {sheetExtraRows.length>0&&<td className="tpws-row-action">{sheetExtraRows.some(x=>x.id===r.id)&&<button title="Remove custom row" aria-label={`Remove custom row ${ri+1}`} type="button" onClick={()=>removeRow(specificationId,r.id)}><Trash2 size={13}/></button>}</td>}
            </tr>)}{!sheetRows.length&&<tr><td colSpan={sheetTable.headers.length+(sheetId==='measurement-table'?2:1)} className="tpws-empty-cells">{source.ready?'No source entries yet. Add a custom specification row or update the garment design.':'Waiting for native garment data.'}</td></tr>}</tbody></table></div>
            <div className="tpws-table-actions"><button type="button" onClick={()=>addRow(specificationId)}><Plus size={14}/> Add specification row</button><span>Calculated values come from the garment. Cells can be edited for this tech pack.</span></div>
          </section>)}
          {(workspace.tables?.[sheetId]||[]).map(renderCustomTable)}
          {(workspace.pageBoxes?.[sheetId]||[]).filter(box=>box.positionMode!=='absolute'&&!workspace.hiddenObjects?.[sheetId]?.includes('box-'+box.id)).map(box=><TechPackBoardObject key={box.id} id={`box-${box.id}`} pageId={sheetId} enabled={editMode==='layout'} keyboardEnabled={selectedBoardObject?.id===`box-${box.id}`}
            selected={selectedBoardObjects.some(item=>item.pageId===sheetId&&item.id===`box-${box.id}`)} value={workspace.boardObjects?.[sheetId]?.[`box-${box.id}`]||{}}
            onSelect={selectBoardObject} onChange={updateBoardObject} onGestureStart={boardGestureStart} onContextAction={layoutContext}>
            <section className="tpws-inserted-box" aria-label={`Inserted ${box.title}`} style={{width:box.width,height:box.height,border:`2px ${box.border} ${box.lineColor}`}}>
              <header><input aria-label="Box title" value={box.title} maxLength={80} onChange={e=>editTemplateBox(sheetId,box.id,{title:e.target.value})}/>
                <button type="button" title="Remove box" aria-label={`Delete box ${box.title}`} onClick={()=>deleteTemplateBox(sheetId,box.id)}><Trash2 size={13}/></button></header>
              <textarea aria-label={`Notes for ${box.title}`} placeholder="Add an authored factory detail or reference…" value={box.note} maxLength={500} onChange={e=>editTemplateBox(sheetId,box.id,{note:e.target.value})}/>
            </section>
          </TechPackBoardObject>)}
          {sheetId==='measurements'&&source.kind==='native'&&Object.keys(source.pom||{}).length===0&&<p className="tpws-origin-note">The native garment has no currently calculated graded POM data. {source.pomStatus||'Add a native grading point of measure or enter manual values; verify against physical samples before production.'}</p>}
          {sheetId==='notes'&&<section className="tpws-revision-history" aria-label="Techpack revision checkpoint history">
            <div className="tpws-section-title"><h2>REVISION CHECKPOINTS / SPECIFICATION CHANGES</h2><span>{revisions.length} SAVED</span></div>
            <p>Save a named checkpoint before changing the garment, measurements, materials or 3D notes. Each checkpoint stores compact specification data and the garment revision, excluding images and meshes.</p>
            <div className="tpws-revision-controls"><input aria-label="New revision checkpoint name" value={revisionLabel} maxLength={100} placeholder={`Revision ${revisions.length+1} · e.g. sample 2 feedback`} onChange={e=>setRevisionLabel(e.target.value)}/><button type="button" onClick={saveRevision}><Plus size={13}/> Save checkpoint</button></div>
            <div className="tpws-revision-list">{[...revisions].reverse().map((revision,index)=><div className="tpws-revision-row" key={revision.id}><strong>{revision.title||'Revision'}</strong><span>{Number.isFinite(Date.parse(revision.createdAt))?new Date(revision.createdAt).toLocaleString():'Date unavailable'}</span><small>Garment revision: {String(revision.snapshot?.source?.revision??'not recorded')}</small>{index===0&&index<revisions.length-1&&<b>Latest checkpoint</b>}</div>)}{revisions.length===0&&<p>No checkpoints yet. Save the starting sample specifications to compare future changes.</p>}</div>
            {revisions.length>1&&<div className="tpws-revision-diff"><strong>LAST TWO CHECKPOINTS · {revisionChanges.length} CHANGES</strong><div>{revisionChanges.slice(0,40).map((change,i)=><p key={`${change.section}-${change.field}-${i}`}><b>{change.section}</b> {change.description}</p>)}{revisionChanges.length===0&&<p>No differences in the tracked specifications.</p>}{revisionChanges.length>40&&<p>{revisionChanges.length-40} more changes in these revisions.</p>}</div></div>}
          </section>}
          {sheetId!=='flats'&&sheetId!=='artwork'&&sheetAssets.length>0&&<div className="tpws-sheet-small-assets"><h2>ATTACHED REFERENCES</h2>{sheetAssets.map(a=>board('asset-'+a.id,<figure key={a.id}>{assetPreview(a,sheetId)?<img src={assetPreview(a,sheetId)} alt={a.name}/>:<FileImage size={28}/>}<figcaption>{a.caption||a.name}</figcaption></figure>))}</div>}
          {board('notes',<section className="tpws-sheet-notes"><h2>{sheetId==='construction'?'CONSTRUCTION INSTRUCTIONS':sheetId==='patterns'?'PATTERN / CUTTING NOTES':'PAGE NOTES & MANUFACTURING COMMENTS'}</h2><textarea aria-label="Page notes" placeholder="Add instructions, tolerances, annotations, placement notes or open questions for your factory…" value={sheetDetails.notes||''} onChange={e=>configure({notes:e.target.value},sheetId)}/></section>)}
          <TechPackPageMarkup pageId={sheetId} mode={annotationTool==='pencil'?'pencil':'highlighter'}
            active={annotationTool==='pencil'||annotationTool==='highlighter'}
            color={annotationTool==='pencil'?pencilColor:highlightColor}
            width={annotationTool==='pencil'?pencilWidth:highlightWidth}
            annotations={sheetAnnotations} onAdd={addAnnotation}/>
          </div>
          </div>
          <TechPackPageReview pageId={sheetId} tool={annotationTool} notes={workspace.reviewNotes?.[sheetId]||[]}
            width={sheetOrientation==='landscape'?792:612} height={sheetOrientation==='landscape'?612:792}
            onAdd={(kind,point)=>addReviewNote(sheetId,kind,point)}
            onUpdate={(id,patch)=>updateReviewNote(sheetId,id,patch)} onDelete={id=>removeReviewNote(sheetId,id)}/>
          {board('footer-logo',<footer className="tpws-sheet-footer tpws-seville-footer" aria-label="Techpack footer">
            {assets.find(item=>item.id===workspace.pageFooterAssets?.[sheetId])&&assetPreview(assets.find(item=>item.id===workspace.pageFooterAssets?.[sheetId]))?
              <img className="tpws-seville-footer-logo" src={assetPreview(assets.find(item=>item.id===workspace.pageFooterAssets?.[sheetId]))} alt="Custom selected footer artwork"/>:
              draft.brand?.trim()&&!/^mikristian$/i.test(draft.brand.trim())?<span className="tpws-seville-footer-brand">{draft.brand}</span>:null}
            <span className="tpws-seville-footer-caption">TECHNICAL SPECIFICATION · DEVELOPMENT COPY · NOT FACTORY APPROVED</span>
          </footer>)}
          {positionedBoxes}
          {boxDrawingSurface}
          {vectorArtboard}
        </article>
    </div>
  }
  
  return <div className="tpws-root tpws-native-editor" data-ui-theme={workspace.uiTheme||'studio'} data-theme-preview={themeHover||''}
    style={themeHover?(()=>{
      const theme=TECHPACK_THEMES.find(item=>item.id===themeHover)
      return theme?{'--tpws-live-accent':theme.accent,'--tpws-live-rule':theme.line,'--tpws-live-wash':theme.wash}:{}
    })():{}}
    role="region" aria-label="EXO Techpack document canvas" data-testid="techpack-workspace">
    {hosts?.library&&createPortal(<section className="tpws-native-library" aria-label="Techpack Library">
      <header className="tpws-native-panel-title"><FolderOpen size={15}/> LIBRARY <small>{librarySection==='templates'?'TEMPLATE SYSTEM':librarySection==='themes'?'COLOR & APPEARANCE':'PROJECT ASSETS'}</small></header>
      <div className="tpws-library-view-tabs" role="tablist" aria-label="Techpack Library views">
        <button type="button" role="tab" aria-selected={librarySection==='assets'} onClick={()=>setLibrarySection('assets')}><FolderOpen size={14}/> Assets</button>
        <button type="button" role="tab" aria-selected={librarySection==='templates'} onClick={()=>setLibrarySection('templates')}><LayoutTemplate size={14}/> Templates</button>
        <button type="button" role="tab" aria-selected={librarySection==='themes'} onClick={()=>setLibrarySection('themes')}><Palette size={14}/> Themes</button>
      </div>
      {librarySection==='themes'?<TechPackVisualThemeLibrary selected={workspace.pages?.[page]?.templateTheme||workspace.visualTheme?.id||'mono'}
        colors={{...workspace.templateColors,...workspace.pages?.[page]?.templateColors}}
        onHover={setThemeHover} onApply={(id,scope)=>{
          try{
            const palette=resolveTechPackPalette(id)
            const overrides=Object.fromEntries(TECHPACK_COLOR_FIELDS.map(field=>[field.key,palette[field.key]||palette.wash]))
            update(applyTechPackPaletteOverrides(workspace,overrides,{pageId:page,scope,paletteId:id}));setThemeHover('')
          }catch(error){setError(error.message)}
        }} onApplyColors={(colors,scope,paletteId)=>{
          try{update(applyTechPackPaletteOverrides(workspace,colors,{pageId:page,scope,paletteId}));setThemeHover('')}
          catch(error){setError(error.message)}
        }}/>:librarySection==='templates'?<TechPackTemplateLibrary workspace={workspace} page={page} onApply={applyTemplatePreset} onNavigate={navigateToPage}
        onCreatePage={createPageFromSavedTemplate} onCreatePack={applyFullTechpackTemplate}
        onCreateProductionPack={applyProductionPack} onCreateProductionPage={applyProductionPage}
        onCreateNikeDemo={createNikeDemoPack}
        onRestyle={template=>applyTemplatePreset(template,page)}
        onCreateMinimalFrame={createMinimalFramedArtboard} onRestyleMinimalFrame={restyleMinimalFramedArtboard}
        onRestoreOriginalPages={()=>{
          if(!window.confirm('Restore the previous Tech Pack page layout? The new clean-start artboard will be replaced. Your garment source remains unchanged.'))return
          const restored=restorePreviousTechPackPages(workspace)
          update(restored);const initial=resolveTechPackPages(restored,TECHPACK_PAGES)[0]?.id
          if(initial){selectedPageRef.current=initial;setPage(initial)}
          setLayoutNotice('Previous Tech Pack pages restored from the archived layout snapshot.')
        }}
        onInsertBox={template=>insertTemplateBox(template,page)} onInsertTable={template=>{
          if(template?.kind==='canonical-gallery-table'){
            try{embedAuthoredTable(createTechPackGalleryTable(template.id),page)}
            catch(error){setError(error.message)}
          }else insertExcelWidget(template,page)
        }}
        onApplyFramedHeader={id=>{
          try{update(applyFramedHeaderPreset(workspace,page,id))}
          catch(error){setError(error.message)}
        }}
        onApplyMiddleTemplate={id=>applyMiddlePageTemplate(id,page)}/>:<>
      <div className="tpws-native-library-controls">
        <input aria-label="Search techpack assets" placeholder="Search assets..." value={assetSearch} onChange={event=>setAssetSearch(event.target.value)}/>
        <input aria-label="Filter reference tags" placeholder="Filter tags · e.g. mockup, back" value={assetTagFilter} onChange={event=>setAssetTagFilter(event.target.value)}/>
        <select aria-label="Asset type for uploads" value={assetCategory} onChange={event=>setAssetCategory(event.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <button type="button" className="tpws-native-action" onClick={uploadGeneralReference}><Upload size={14}/> Import photos / mockups / drawings (up to 20 at once)</button>
        <label className="tpws-media-autofill-check"><input type="checkbox" checked={autoPlaceOnUpload} onChange={event=>setAutoPlaceOnUpload(event.target.checked)}/> Auto-place newly imported files by tags</label>
      </div>
      <nav className="tpws-asset-folders" aria-label="Techpack asset folders">
        <p><FolderOpen size={13}/> PROJECT ASSET FOLDERS</p>
        {TECHPACK_ASSET_FOLDERS.map(folder=><button type="button" key={folder.id} className={assetFolder===folder.id?'active':''}
          aria-current={assetFolder===folder.id?'page':undefined} aria-label={`Open ${folder.name} folder`}
          onClick={()=>{setAssetFolder(folder.id);setAssetCategory(assetFolderDefault(folder.id));setAssetFilter('all')}}>
          <FolderOpen size={14}/><span>{folder.name}</span><small>{assets.filter(a=>!a.placementOnly&&assetInFolder(a,folder.id)).length+
            (folder.id==='mockups'&&privateSeaggsReady&&!assets.some(a=>a.id==='seaggs-tshirt-private-transparent-reference')?1:0)+
            (folder.id==='mockups'?['front','back'].filter(view=>privateSeaggsVectorReady[view]&&!assets.some(a=>a.id===`seaggs-tshirt-private-${view}-vector-reference`)).length:0)}</small>
        </button>)}
      </nav>
      {error&&<p className="tpws-error" role="alert">{error}</p>}
      <div className="tpws-native-assets">
        {assetFolder==='mockups'&&privateSeaggsVectorReady.front&&privateSeaggsVectorReady.back&&
          <button type="button" className="tpws-private-mockup-preview" draggable
            aria-label="Place SEAGGS front and back together on page"
            title="Click or drag this paired vector T-shirt onto a Tech Pack page; repeat for additional copies"
            onClick={()=>void placePrivateSeaggsPair(page)}
            onDragStart={event=>{event.dataTransfer.setData('application/x-exo-techpack-seaggs-pair','1');event.dataTransfer.effectAllowed='copy'}}>
            <img src="/private-mockups/seaggs-tshirt-private-transparent.png" alt="SEAGGS front and back grouped mockup preview"/>
            <span><strong>SEAGGS FRONT + BACK · SVG</strong><small>Both views in one editable object · Drag or click to place more</small></span>
          </button>}
        {assetFolder==='mockups'&&['front','back'].filter(view=>privateSeaggsVectorReady[view]&&
          !assets.some(a=>a.id===`seaggs-tshirt-private-${view}-vector-reference`)).map(view=>
          <button key={'seaggs-vector-'+view} type="button" className="tpws-private-mockup-preview"
            aria-label={`Add genuine SEAGGS T-shirt ${view} SVG vector from local source`}
            onClick={()=>importPrivateSeaggsVector(view)} title="Import licensed local source vector drawing into this Tech Pack">
            <img src={`/private-mockups/seaggs-tshirt-${view}-vector.svg`} alt={`Private genuine SEAGGS T-shirt ${view} vector`}/>
            <span><strong>SEAGGS T-shirt {view.toUpperCase()} · SVG</strong><small>Genuine paths · Select Fill / Stroke</small></span>
          </button>)}
        {assetFolder==='mockups'&&privateSeaggsReady&&!assets.some(a=>a.id==='seaggs-tshirt-private-transparent-reference')&&
          <button type="button" className="tpws-private-mockup-preview" aria-label="Add SEAGGS T-shirt flat mockup from local library"
            onClick={importPrivateSeaggsTshirt} title="Import private transparent front/back T-shirt flat into this Tech Pack">
            <img src="/private-mockups/seaggs-tshirt-private-transparent.png" alt="Private SEAGGS T-shirt front and back technical flat reference"/>
            <span><strong>SEAGGS T-shirt · front/back</strong><small>Private transparent raster flat · Click to add</small></span>
          </button>}
        {assets.filter(a=>!a.placementOnly&&assetInFolder(a,assetFolder)&&(assetFilter==='all'||a.category===assetFilter)&&(!assetSearch||(''+(a.name||'')+' '+(a.caption||'')+' '+a.tags.join(' ')).toLowerCase().includes(assetSearch.toLowerCase()))&&(!assetTagFilter||normalizeTechPackAssetTags(assetTagFilter).every(tag=>a.tags.includes(tag)))).map(a=>
        <button key={a.id} type="button" className={selectedAsset===a.id?'active':''} draggable={Boolean(assetPreview(a))}
          onDragStart={event=>{event.dataTransfer.setData('application/x-exo-techpack-asset',String(a.id));event.dataTransfer.setData('text/plain',String(a.id));event.dataTransfer.effectAllowed='copy';setSelectedAsset(a.id)}}
          onDoubleClick={()=>{setSelectedAsset(a.id);if(selectedBoardObject?.pageId===page&&selectedBoardObject.id.startsWith('box-'))attach(a.id)}}
          title="Drag into an image placeholder or double-click to fill the selected reference"
          onClick={()=>setSelectedAsset(a.id)}>
          {assetPreview(a)?<img src={assetPreview(a)} alt=""/>:a._source==='native-fabric'?<span className="tpws-asset-fabric-chip" style={{background:/^#[0-9a-f]{3,8}$/i.test(a.color)?a.color:'#d6dedc'}}/>:<FileImage size={25}/>}
          <span><strong>{a.caption||a.name}</strong><small>{a.category||'reference'}{a._source==='native'?' · garment':''}</small><small className="tpws-media-tag-line">{a.tags.map(t=>'#'+t).join(' ')}</small></span>
        </button>)}
        {!assets.some(a=>assetInFolder(a,assetFolder))&&!(assetFolder==='mockups'&&(privateSeaggsReady||privateSeaggsVectorReady.front||privateSeaggsVectorReady.back))&&<p className="tpws-native-empty">This folder is empty. Import a graphic, photo, label, tag or packaging design using the controls above.</p>}
      </div>
      {chosen&&<div className="tpws-native-asset-detail"><strong>{chosen.name}</strong>
        <button type="button" onClick={()=>attach(chosen.id)}>{selectedBoardObject?.pageId===page&&(selectedBoardObject.id.startsWith('box-')||selectedBoardObject.id.startsWith('asset-')||selectedBoardObject.id.startsWith('render-')||selectedBoardObject.id==='footer-logo')?'Replace selected object':linked.has(chosen.id)?'Detach from page':'Attach to current page'}</button>
        {chosen.id==='seaggs-tshirt-private-pair-master'&&<button type="button" onClick={()=>void placePrivateSeaggsPair(page)}>Place another front/back pair</button>}
        <label>Reference tags · comma-separated<input aria-label="Reference image tags" value={assetTagDraft}
          placeholder="mockup, front, fabric" onChange={event=>setAssetTagDraft(event.target.value)}
          onBlur={()=>updateAssetTags(chosen.id,assetTagDraft)}
          onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();updateAssetTags(chosen.id,assetTagDraft);event.currentTarget.blur()}}}/></label>
        <div className="tpws-media-tag-suggestions" aria-label="Suggested reference tags">{TECHPACK_MEDIA_TAG_SUGGESTIONS.map(tag=>
          <button type="button" key={tag} aria-pressed={chosen.tags.includes(tag)} onClick={()=>
            updateAssetTags(chosen.id,chosen.tags.includes(tag)?chosen.tags.filter(v=>v!==tag):[...chosen.tags,tag])}>#{tag}</button>)}</div>
        {['assets','references'].includes(chosen._source)&&<label>Image caption<input aria-label="Selected image caption" maxLength={160} value={chosen.caption||''} onChange={e=>updateAssetCaption(chosen.id,e.target.value)} placeholder="Caption shown beneath this image"/></label>}
        {chosen._source!=='native'&&chosen._source!=='native-fabric'&&<label>Move to folder<select aria-label="Selected asset folder" value={chosen.category} onChange={e=>classifyAsset(chosen.id,e.target.value)}>{CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}</select></label>}
        {chosen._source!=='native'&&chosen._source!=='native-fabric'&&<button type="button" onClick={()=>deleteAsset(chosen.id)}><Trash2 size={13}/> Remove asset</button>}
      </div>}
      {(assetFolder==='mockups'||assetFolder==='patterns')&&<details className="tpws-media-automation-fold" aria-label="Mockup and vector pattern tools">
        <summary><Shapes size={14}/> Mockup &amp; VectorCraft tools <small>Editable shapes &amp; import</small></summary>
        {assetFolder==='mockups'&&<section className="tpws-mockup-starters" aria-label="T-shirt technical mockup starters">
          <strong>TECHNICAL MOCKUPS · T-SHIRT</strong>
          <p>Add original SVG front/back mockups or import the user-local purchased SEAGGS reference.</p>
          <button type="button" onClick={addOriginalTshirtFlats}><Shapes size={13}/> Add original SVG T-shirt front / back</button>
          <button type="button" onClick={importPrivateSeaggsTshirt}><ImagePlus size={13}/> Add private SEAGGS T-shirt mockup</button>
          {['front','back'].filter(view=>privateSeaggsVectorReady[view]).map(view=>
            <button key={view} type="button" onClick={()=>importPrivateSeaggsVector(view)}><Shapes size={13}/> Add SEAGGS {view.toUpperCase()} SVG vector</button>)}
          <small>The purchased SEAGGS reference remains private to this Mac and is not an editable vector file.</small>
        </section>}
        <section className="tpws-mockup-starters" aria-label="Source pattern vector conversion">
          <strong>VECTORCRAFT · SOURCE-LINKED OUTLINES</strong>
          <p>Copy native pattern polygons and Bézier controls to editable Tech Pack vector objects. Original production patterns stay unchanged.</p>
          <button type="button" onClick={()=>importEditablePatternOutlines(false)} disabled={!nativeSnapshot?.template?.panels?.length}><PenTool size={13}/> Insert current garment vectors</button>
          <button type="button" onClick={()=>importEditablePatternOutlines(true)}><PenTool size={13}/> Insert saved T-shirt vector outlines</button>
        </section>
      </details>}
      <details className="tpws-media-automation-fold" aria-label="Smart reference layout tools">
        <summary><LayoutGrid size={14}/> Smart Reference Layout <small>Auto-fit &amp; tagged placement</small></summary>
        <section className="tpws-media-automation" aria-label="Smart reference photo page layout">
          <p>Set the number of reference photos for this sheet. Populated objects have direct artwork bounds, without white placeholder cards.</p>
          <label>Photos on this sheet<input aria-label="Reference photo count" type="number" min="1" max="24" step="1" value={galleryPhotoCount}
            onChange={event=>setGalleryPhotoCount(Math.min(24,Math.max(1,Number(event.target.value)||1)))}/></label>
          <button type="button" onClick={()=>fitPhotoReferences()}>Fit {galleryPhotoCount} photos on this page</button>
          <label>Page matching tags<input aria-label="Current page matching tags" value={galleryTargetTags}
            placeholder="mockup, drawing, front, back" onChange={event=>setGalleryTargetTags(event.target.value)}
            onBlur={()=>setPhotoPageTags(galleryTargetTags)}/></label>
          <button type="button" onClick={()=>runAutoMediaPlacement(true)}>Place matching assets on this page</button>
          <button type="button" onClick={()=>runAutoMediaPlacement(false)}>Fill matching slots across Tech Pack</button>
        </section>
      </details>
      </>}
    </section>,hosts.library)}
    {hosts?.objects&&createPortal(<section className="tpws-native-objects" data-inspector-tab={inspectorTab} aria-label="Techpack inspector">
      <div className="tpws-inspector-tabs" role="tablist" aria-label="Techpack inspector tabs" onKeyDown={event=>{
        const keys=['ArrowLeft','ArrowRight','Home','End']
        if(!keys.includes(event.key))return
        event.preventDefault()
        const inspectorTabs=['properties','layers','tables']
        const index=inspectorTabs.indexOf(inspectorTab)
        const next=event.key==='Home'?'properties':event.key==='End'?'tables':
          inspectorTabs[(index+(event.key==='ArrowRight'?1:inspectorTabs.length-1))%inspectorTabs.length]
        setInspectorTab(next)
        event.currentTarget.querySelector(`#tpws-${next}-tab`)?.focus()
      }}>
        <button type="button" role="tab" id="tpws-properties-tab" aria-controls="tpws-properties-panel"
          aria-selected={inspectorTab==='properties'} tabIndex={inspectorTab==='properties'?0:-1}
          onClick={()=>setInspectorTab('properties')}><Settings2 size={14}/> Properties</button>
        <button type="button" role="tab" id="tpws-layers-tab" aria-controls="tpws-layers-panel"
          aria-selected={inspectorTab==='layers'} tabIndex={inspectorTab==='layers'?0:-1}
          onClick={()=>setInspectorTab('layers')}><Layers3 size={14}/> Layers</button>
        <button type="button" role="tab" id="tpws-tables-tab" aria-controls="tpws-tables-panel"
          aria-selected={inspectorTab==='tables'} tabIndex={inspectorTab==='tables'?0:-1}
          onClick={()=>setInspectorTab('tables')}><Table2 size={14}/> Tables</button>
      </div>
      {inspectorTab==='layers'&&<div id="tpws-layers-panel" role="tabpanel" aria-labelledby="tpws-layers-tab">
      <TechPackVectorLayers items={pageVectors} selectedIds={activeVectorIds} onSelect={(id,add)=>{setEditMode('layout');setVectorTool('select');selectVector(page,id,add,{keepInspector:true})}}
        onPatch={patchVector} onDuplicate={duplicateVector} onReorder={reorderVector} onDelete={deleteVectors}/>
      <TechPackDocumentLayers items={documentLayerItems} selectedIds={selectedIds}
        hiddenIds={workspace.hiddenObjects?.[page]||[]}
        lockedIds={workspace.lockedObjects?.[page]||[]}
        onSelect={(id,add)=>{
          setEditMode('layout');setAnnotationTool('select');setVectorTool('select')
          selectBoardObject({pageId:page,id},add)
          if(id.startsWith('box-')&&tableBoxes.some(box=>'box-'+box.id===id)){setActiveTableId(id.slice(4));setTablePanelOpen(true)}
        }}
        onVisibility={(id,visible)=>update(setTechPackLayoutLayerVisibility(workspace,page,id,visible))}
        onLock={(id,locked)=>toggleLayerLock(page,id,locked)}/>
      <details className="tpws-ai-legacy-tree"><summary>Artboards &amp; document layers</summary>
      <header className="tpws-native-panel-title"><BookOpen size={15}/> DOCUMENT <small>TECHPACK PAGES</small></header>
      <div className="tpws-native-tree-title">DOCUMENT <span>{documentPages.length} PAGES</span></div>
      {documentPages.map(p=><div key={p.id} className={`tpws-page-browser-entry ${dragPage===p.id?'is-dragging':''}`}
        draggable={editMode==='layout'} onDragStart={event=>{
          if(editMode!=='layout')return
          setDragPage(p.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-exo-techpack-page',p.id)
        }} onDragEnd={()=>setDragPage('')} onDragOver={event=>{
          if(editMode==='layout'&&event.dataTransfer.types.includes('application/x-exo-techpack-page'))event.preventDefault()
        }} onDrop={event=>{
          const id=event.dataTransfer.getData('application/x-exo-techpack-page')
          if(editMode==='layout'&&id){event.preventDefault();reorderDocumentPage(id,p.id)}setDragPage('')
        }}>
        <button type="button" aria-current={page===p.id?'page':undefined} className={page===p.id?'active':''} data-page={p.id} onClick={()=>navigateToPage(p.id)}>
          <FileSpreadsheet size={15}/><span><strong>{workspace.pages?.[p.id]?.title||p.name}</strong><small>{p.tag} · {p.subtitle}</small></span><ChevronRight size={13}/>
        </button>
        {editMode==='layout'&&<div className="tpws-page-order-controls">
          <button type="button" aria-label={`Move ${p.name} up`} title="Move page up" onClick={()=>moveDocumentPage(p.id,-1)}>↑</button>
          <button type="button" aria-label={`Move ${p.name} down`} title="Move page down" onClick={()=>moveDocumentPage(p.id,1)}>↓</button>
          {p.id.startsWith('custom-')&&<button type="button" aria-label={`Delete custom page ${p.name}`} title="Delete custom page" onClick={()=>deleteCustomPage(p.id)}><Trash2 size={12}/></button>}
        </div>}
      </div>)}
      <button type="button" className="tpws-add-page-browser" onClick={addCustomPage}><Plus size={15}/> Add custom page</button>
      <div className="tpws-native-tree-title">CUSTOM TABLES <span>{(workspace.tables?.[page]||[]).length} ON THIS PAGE</span></div>
      {(workspace.tables?.[page]||[]).map((t,i)=><button key={t.id} type="button" className="tpws-object-table" onClick={()=>{
        const el=[...(scrollRef.current?.querySelectorAll('[data-techpack-sheet]')||[])].find(node=>node.getAttribute('data-techpack-sheet')===page)
        el?.querySelectorAll('.tpws-custom-table')?.[i]?.scrollIntoView({behavior:'instant',block:'center'})
      }}><Table2 size={15}/><span><strong>{t.title||'Untitled table'}</strong><small>{t.rows.length} rows · {t.headers.length} columns</small></span><ChevronRight size={13}/></button>)}
      <button type="button" className="tpws-object-table tpws-insert-object" onClick={()=>addTable()}><Plus size={14}/> Insert table on page</button>
      <div className="tpws-native-tree-title">LINKED CONTENT</div>
      <p className="tpws-native-source">{source.panels.length} patterns · {source.seams.length} seams · {source.fabrics.length} materials</p>
      <div className="tpws-native-tree-title">PAGE LAYOUT OBJECTS <span>TRANSFORM</span></div>
      {editMode==='layout'&&<p className="tpws-native-source">Shift-click objects or layers to select several. Drag one selected object to move the selection.</p>}
      {['header','drawing','renders','render-front','render-back','render-side','fabric-swatches','images','spec-table','notes','footer-logo'].map(id=><button type="button" key={id} className={`tpws-object-table ${selectedIds.includes(id)?'tpws-layer-selected':''}`} aria-pressed={selectedIds.includes(id)}
        onClick={event=>{setEditMode('layout');setAnnotationTool('select');selectBoardObject({pageId:page,id},event.shiftKey||event.metaKey||event.ctrlKey)}}>
        <Scaling size={14}/><span><strong>{id.replaceAll('-',' ').toUpperCase()}</strong><small>{workspace.hiddenObjects?.[page]?.includes(id)?'Hidden · click Restore':workspace.boardObjects?.[page]?.[id]?'Adjusted placement':'Default placement'}</small></span>
      </button>)}
      {(workspace.pageBoxes?.[page]||[]).map(box=><button key={'layer-'+box.id} type="button" className={`tpws-object-table ${selectedIds.includes('box-'+box.id)?'tpws-layer-selected':''}`}
        aria-pressed={selectedIds.includes('box-'+box.id)} onClick={event=>{setEditMode('layout');setAnnotationTool('select');selectBoardObject({pageId:page,id:'box-'+box.id},event.shiftKey||event.metaKey||event.ctrlKey)}}>
        <Square size={14}/><span><strong>{box.title||'Artboard box'}</strong><small>{liveGroups(page).some(group=>group.ids.includes('box-'+box.id))?'Grouped layer':'Independent editable layer'}</small></span>
      </button>)}
      {(workspace.pageAssets?.[page]||[]).filter(id=>showLooseMediaAsset(page,id)).map(id=>assets.find(asset=>asset.id===id)).filter(Boolean).map(asset=><button key={'layer-asset-'+asset.id} type="button" className={`tpws-object-table ${selectedIds.includes('asset-'+asset.id)?'tpws-layer-selected':''}`}
        aria-pressed={selectedIds.includes('asset-'+asset.id)} onClick={event=>{setEditMode('layout');setAnnotationTool('select');selectBoardObject({pageId:page,id:'asset-'+asset.id},event.shiftKey||event.metaKey||event.ctrlKey)}}>
        <FileImage size={14}/><span><strong>{asset.name||'Image'}</strong><small>{liveGroups(page).some(group=>group.ids.includes('asset-'+asset.id))?'Grouped image layer':'Image layer'}</small></span>
      </button>)}
      {(workspace.hiddenObjects?.[page]||[]).length>0&&<div className="tpws-hidden-layout-objects"><strong>HIDDEN LAYOUT OBJECTS</strong>{workspace.hiddenObjects[page].map(id=><button key={id} type="button" onClick={()=>update({...workspace,hiddenObjects:{...workspace.hiddenObjects,[page]:workspace.hiddenObjects[page].filter(value=>value!==id)}})}>Restore {id.replaceAll('-',' ')}</button>)}</div>}
      </details>
      </div>}
    </section>,hosts.objects)}
    {hosts?.objects&&inspectorTab==='tables'&&createPortal(<section className="tpws-native-table-panel" id="tpws-tables-panel" role="tabpanel" aria-labelledby="tpws-tables-tab" aria-label="EXO Table Library and Design Studio">
      <div className="tpws-tables-intro"><Table2 size={18}/><div><strong>TABLE WORKSPACE</strong><small>Design · Embed · Style · Reuse</small></div></div>
      <button type="button" className="tpws-table-studio-launch" onClick={openNewTableStudio}><Table2 size={15}/> New table · open pop-up editor</button>
      <div className="tpws-table-placement">
        <strong>EMBED LOCATION · CURRENT ARTBOARD</strong>
        <div><label>X (px)<input type="number" min="0" max="792" aria-label="Table insertion X"
          value={tablePlacement.x} onChange={event=>setTablePlacement(old=>({...old,x:event.target.value}))}/></label>
          <label>Y (px)<input type="number" min="0" max="792" aria-label="Table insertion Y"
            value={tablePlacement.y} onChange={event=>setTablePlacement(old=>({...old,y:event.target.value}))}/></label></div>
        <small>Set where the table is embedded, then switch to Layout to drag or resize it.</small>
      </div>
      {activeTableBox&&<div className="tpws-table-selected-actions">
        <strong>{activeTableBox.slot?.title||activeTableBox.title||'Selected table'}</strong>
        <div className="tpws-table-action-buttons">
          <button type="button" onClick={()=>setTableStudio({mode:'placed',id:activeTableBox.id,pageId:page})}><Table2 size={14}/> {isLayerLocked(page,tableLayerId(activeTableBox))?'View pop-up':'Edit pop-up'}</button>
          <button type="button" aria-pressed={isLayerLocked(page,tableLayerId(activeTableBox))} onClick={()=>toggleLayerLock(page,tableLayerId(activeTableBox))}>
            {isLayerLocked(page,tableLayerId(activeTableBox))?<Lock size={14}/>:<LockOpen size={14}/>}
            {isLayerLocked(page,tableLayerId(activeTableBox))?'Unlock table':'Lock table'}
          </button>
        </div>
      </div>}
      <div className="tpws-table-library">
        <header><Library size={14}/> TABLE LIBRARY <span>{(workspace.savedTableTemplates||[]).length}</span></header>
        {(workspace.savedTableTemplates||[]).map(template=><div key={template.id} className="tpws-saved-table">
          <span><strong>{template.name}</strong><small>{template.columns?.length||0} cols · {template.rows?.length||0} rows</small></span>
          <button type="button" aria-label={`Embed ${template.name} on artboard`} onClick={()=>embedSavedTable(template)}><Plus size={13}/> Place</button>
          <button type="button" aria-label={`Remove ${template.name} from library`} title="Remove saved design" onClick={()=>update({...workspace,savedTableTemplates:(workspace.savedTableTemplates||[]).filter(item=>item.id!==template.id)})}><Trash2 size={13}/></button>
        </div>)}
        {!(workspace.savedTableTemplates||[]).length&&<p>Save a table design from the large editor to reuse it across your Tech Pack pages.</p>}
      </div>
      <details className="tpws-inspector-fold tpws-gridcraft-fold" open>
        <summary><Table2 size={14}/> TABLE · GRID EDITOR <ChevronRight size={13}/></summary>
        <div className="tpws-table-designer">
          <button type="button" className="tpws-table-designer-toggle" aria-expanded={tableDesignerOpen}
            onClick={()=>setTableDesignerOpen(value=>!value)}>
            <Plus size={15}/> Create custom table <ChevronRight size={14}/>
          </button>
          {tableDesignerOpen&&<div className="tpws-table-design-fields" aria-label="Custom table designer">
            <label>Start from
              <select aria-label="Custom table preset" value={tableDesigner.preset}
                onChange={event=>chooseTablePreset(event.target.value)}>
                <option value="blank">Blank custom table</option>
                <option value="measurement-spec">Measurement specifications</option>
                <option value="bom">Bill of materials</option>
                <option value="construction">Construction and stitching</option>
              </select>
            </label>
            <label>Table title<input aria-label="New table name" maxLength={80} value={tableDesigner.name}
              onChange={event=>setTableDesigner(old=>({...old,name:event.target.value}))}/></label>
            <div className="tpws-table-design-size">
              <label>Columns<input type="number" aria-label="New table columns" min="1" max="50"
                value={tableDesigner.columns} onChange={event=>setTableDesigner(old=>({...old,columns:event.target.value}))}/></label>
              <label>Rows<input type="number" aria-label="New table rows" min="1" max="100"
                value={tableDesigner.rows} onChange={event=>setTableDesigner(old=>({...old,rows:event.target.value}))}/></label>
            </div>
            <label>Column headings (comma-separated)<textarea aria-label="New table column headings" rows={3} maxLength={1500}
              value={tableDesigner.headings}
              onChange={event=>setTableDesigner(old=>({...old,headings:event.target.value}))}/></label>
            <label>Starting style<select aria-label="New table style" value={tableDesigner.theme}
              onChange={event=>setTableDesigner(old=>({...old,theme:event.target.value}))}>
              {['technical','blueprint','graphite','sage','amber','light','medium','dark'].map(theme=>
                <option key={theme} value={theme}>{theme[0].toUpperCase()+theme.slice(1)}</option>)}
            </select></label>
            <button type="button" className="tpws-table-create" onClick={openNewTableStudio}>
              <Table2 size={15}/> Design in table pop-up
            </button>
            <button type="button" className="tpws-table-create-secondary" onClick={()=>createDesignedTable(page)}>
              <Table2 size={15}/> Quick insert on artboard
            </button>
          </div>}
        </div>
        <div className="tpws-gridcraft-select">
          <label>Select editable table
            <select aria-label="Select Techpack table for tools" value={activeTableBox?.id||''}
              onChange={e=>{
                const id=e.target.value
                setActiveTableId(id);setSelectedTableCell({r:0,c:0});setTablePanelOpen(true)
                if(id)selectBoardObject({pageId:page,id:id.startsWith('legacy-')?'table-'+id.slice(7):'box-'+id})
              }}>
              {tableBoxes.length?tableBoxes.map(box=><option key={box.id} value={box.id}>{box.slot?.title||box.title||'Untitled table'}</option>):<option value="">No table on this page</option>}
            </select>
          </label>
          {activeTableBox&&<>
            <label>Table heading
              <input aria-label="Selected table heading" maxLength={90}
                value={activeTableBox.slot?.title||activeTableBox.title||''}
                onChange={e=>{
                  const title=e.target.value
                  if(activeTableBox.legacyTableId)editTable(page,activeTableBox.legacyTableId,t=>({...t,title}))
                  else editTemplateBox(page,activeTableBox.id,{title,slot:{...activeTableBox.slot,title}})
                }}/>
            </label>
            <div className="tpws-gridcraft-mode" role="group" aria-label="Selected table modes">
              <button type="button" aria-pressed={editMode==='layout'} onClick={()=>setEditMode('layout')}><Scaling size={14}/> Move / resize</button>
              <button type="button" aria-pressed={editMode==='content'} onClick={()=>{
                setEditMode('content')
                requestAnimationFrame(()=>{
                  const id=activeTableBox.legacyTableId?'table-'+activeTableBox.legacyTableId:'box-'+activeTableBox.id
                  const node=[...document.querySelectorAll('[data-board-object]')]
                    .find(item=>item.dataset.boardPage===page&&item.dataset.boardObject===id)
                  node?.querySelector('.tps-scroll')?.focus()
                })
              }}><Table2 size={14}/> Edit cells</button>
            </div>
          </>}
          <button type="button" title="Open the custom table designer" onClick={()=>setTableDesignerOpen(true)}><Table2 size={15}/> Design new table</button>
        </div>
        {activeTableBox&&tablePanelOpen&&<TechPackTableTools20261030
          key={activeTableBox.id} compact table={activeTableBox.slot.spreadsheetTable}
          selected={tableContext.selectedCell||{r:0,c:0}}
          readOnly={isLayerLocked(page,tableLayerId(activeTableBox))}
          onChange={editSelectedTable}
          savedThemes={Array.isArray(workspace.tableThemePresets)?workspace.tableThemePresets:[]}
          onSaveTheme={item=>{
            const existing=Array.isArray(workspace.tableThemePresets)?workspace.tableThemePresets:[]
            if(existing.length>=20)throw new Error('Maximum 20 saved table styles')
            update({...workspace,tableThemePresets:[...existing,{id:uid(),name:String(item.name).slice(0,40),style:item.style}]})
          }}
          onClose={()=>setTablePanelOpen(false)}/>}
        {activeTableBox&&!tablePanelOpen&&<button type="button" className="tpws-ai-table-open" onClick={()=>setTablePanelOpen(true)}>Open table formatting tools</button>}
        {!activeTableBox&&<p className="tpws-ai-help tpws-gridcraft-empty">Choose New table or select a table in Layers to format its rows, headings and cell styles.</p>}
      </details>
    </section>,hosts.objects)}
    {hosts?.objects&&inspectorTab==='properties'&&createPortal(<section className="tpws-native-properties" id="tpws-properties-panel" role="tabpanel" aria-labelledby="tpws-properties-tab" aria-label="Techpack Property Editor">
      {textSelection?.pageId===page&&((textSelection.kind==='table'&&activeTableBox?.id===textSelection.id&&selectedTableCell.r>=0)||
        (textSelection.kind==='vector'&&activeVectorIds.includes(textSelection.id)))&&
        <TechPackCharacterProperties
          selection={textSelection.kind==='vector'?'Selected vector text':`Cell R${selectedTableCell.r+1} · C${selectedTableCell.c+1}`}
          style={textSelection.kind==='vector'?(()=>{
            const v=pageVectors.find(item=>item.id===textSelection.id)||{}
            return {fontFamily:v.fontFamily,fontSize:v.fontSize,letterSpacing:v.letterSpacing,
              lineHeight:v.lineHeight,color:v.fill,bold:Number(v.fontWeight)>=700,align:v.textAlign}
          })():selectedTextStyle}
          disabled={textSelection.kind==='table'&&isLayerLocked(page,tableLayerId(activeTableBox))}
          onChange={patchCharacterStyle}/>}
      {(activeVectorIds.length>0||(!activeTableBox&&!selectedBoardObject))&&<TechPackVectorInspector items={pageVectors} selectedIds={activeVectorIds}
        uiTheme={workspace.uiTheme||'studio'} onTheme={theme=>update({...workspace,uiTheme:theme})}
        onPatch={patchVector} onPatchSelected={patchSelectedVectors} onAlign={alignVector} onBuild={buildVectorShape}
        onGroup={groupSelectedVectors} onUngroup={ungroupSelectedVectors}
        onDelete={deleteVectors} onCreate={kind=>createVector(page,kind)}/>}
      <details className="tpws-inspector-fold tpws-inspector-document" open>
        <summary><LayoutTemplate size={14}/> DOCUMENT &amp; ARTBOARDS <ChevronRight size={13}/></summary>
        <div className="tpws-inspector-fold-content">
          <p className="tpws-ai-mini-label">Orientation · all {documentPages.length} pages</p>
          <div className="tpws-ai-iconbar" role="group" aria-label="Page orientation">
            <button type="button" className={orientation==='portrait'?'active':''} aria-pressed={orientation==='portrait'} title="Portrait pages" aria-label="Portrait pages" onClick={()=>configureAllPages({orientation:'portrait'})}><RectangleVertical size={18}/><span>Portrait</span></button>
            <button type="button" className={orientation==='landscape'?'active':''} aria-pressed={orientation==='landscape'} title="Landscape pages" aria-label="Landscape pages" onClick={()=>configureAllPages({orientation:'landscape'})}><RectangleHorizontal size={18}/><span>Landscape</span></button>
          </div>
          <p className="tpws-ai-mini-label">Page flow</p>
          <div className="tpws-ai-iconbar" role="group" aria-label="Page flow">
            <button type="button" className={pageFlow==='vertical'?'active':''} aria-pressed={pageFlow==='vertical'} aria-label="Vertical page flow" onClick={()=>changeFlow('vertical')}><Rows3 size={18}/><span>Vertical</span></button>
            <button type="button" className={pageFlow==='horizontal'?'active':''} aria-pressed={pageFlow==='horizontal'} aria-label="Horizontal page flow" onClick={()=>changeFlow('horizontal')}><Columns3 size={18}/><span>Horizontal</span></button>
            <button type="button" className={pageFlow==='canvas'?'active':''} aria-pressed={pageFlow==='canvas'} aria-label="Illustrator canvas mode showing multiple artboards" onClick={()=>{changeFlow('canvas');setDocumentZoom('0.35')}}><LayoutGrid size={18}/><span>Canvas</span></button>
          </div>
          <div className="tpws-ai-iconbar" role="group" aria-label="Canvas hand pan">
            <button type="button" className={handTool?'active':''} aria-pressed={handTool} aria-label="Hand pan tool" title="Drag artboards in Canvas mode, or hold Space" onClick={()=>setHandTool(value=>!value)}><Hand size={16}/><span>Hand</span></button>
          </div>
          <p className="tpws-ai-mini-label">Zoom</p>
          <div className="tpws-ai-iconbar tpws-ai-iconbar-zoom" role="group" aria-label="Artboard zoom">
            <button type="button" aria-label="Zoom out Techpack" onClick={()=>setDocumentZoom(value=>nextTechPackZoom(value,'out',canvasWidth,orientation==='landscape'))}><ZoomOut size={16}/></button>
            <button type="button" aria-label="Reset zoom to 100%" onClick={()=>setDocumentZoom('1')}><span>{Math.round(resolvedTechPackZoom(documentZoom,canvasWidth,orientation==='landscape')*100)}%</span></button>
            <button type="button" aria-label="Zoom in Techpack" onClick={()=>setDocumentZoom(value=>nextTechPackZoom(value,'in',canvasWidth,orientation==='landscape'))}><ZoomIn size={16}/></button>
            <button type="button" aria-label="Fit page width" onClick={()=>setDocumentZoom('fit')}>Fit</button>
          </div>
          <label className="tpws-ai-inspector-label">Paper size<select aria-label="Paper size for all pages" value={paperSize} onChange={e=>configureAllPages({paperSize:e.target.value})}><option value="Letter">US Letter · 8.5 × 11 in</option><option value="A4">A4 · 210 × 297 mm</option></select></label>
          <div className="tpws-ai-iconbar" role="group" aria-label="Artboard guides">
            <button type="button" className={workspace.artboardGuides?.[page]?.visible?'active':''} aria-pressed={Boolean(workspace.artboardGuides?.[page]?.visible)} onClick={()=>setArtboardGuide('visible',!workspace.artboardGuides?.[page]?.visible)}><Grid3X3 size={15}/><span>Grid</span></button>
            <button type="button" className={workspace.artboardGuides?.[page]?.snap?'active':''} aria-pressed={Boolean(workspace.artboardGuides?.[page]?.snap)} onClick={()=>setArtboardGuide('snap',!workspace.artboardGuides?.[page]?.snap)}><Grid2X2 size={15}/><span>Snap 8</span></button>
          </div>
        </div>
      </details>
      <details className="tpws-inspector-fold tpws-inspector-template">
        <summary><Save size={14}/> TEMPLATE LIBRARY <ChevronRight size={13}/></summary>
        <div className="tpws-inspector-fold-content">
          <button type="button" className="tpws-ai-wide" onClick={()=>savePageAsTemplate(false)}><LayoutTemplate size={15}/> Save blank page layout</button>
          <button type="button" className="tpws-ai-wide" onClick={()=>savePageAsTemplate(true)}><CopyPlus size={15}/> Save page + content</button>
          <button type="button" className="tpws-ai-wide" onClick={()=>saveEntireTechpackTemplate(false)}><LayoutTemplate size={15}/> Save complete blank system</button>
          <button type="button" className="tpws-ai-wide" onClick={()=>saveEntireTechpackTemplate(true)}><Save size={15}/> Save full system + content</button>
          <p className="tpws-ai-help">Blank templates omit authored garment values. Content templates include only explicitly saved content.</p>
        </div>
      </details>
      {editMode==='layout'&&selectedIds.length>0&&<div className="tpws-side-section tpws-selection-toolbar" aria-label="Artboard selection controls">
        <strong>{selectedIds.length} selected {selectedIds.length===1?'layer':'layers'}</strong>
        <p className="tpws-selection-hint">Drag a selected object to move the selection. Resize any selected handle to scale the whole selection.</p>
        <div className="tpws-object-direct-actions" role="group" aria-label="Group selected layers">
          <button type="button" disabled={selectedIds.length<2} onClick={groupSelection}>Group layers</button>
          <button type="button" disabled={!liveGroups(page).some(group=>group.ids.some(id=>selectedIds.includes(id)))} onClick={ungroupSelection}>Ungroup layers</button>
        </div>
        <div className="tpws-ai-compact-tools" role="group" aria-label="Align selected layers">
          {[['left','Align left',AlignHorizontalJustifyStart],['center','Align horizontal center',AlignHorizontalJustifyCenter],['right','Align right',AlignHorizontalJustifyEnd],['top','Align top',AlignVerticalJustifyStart],['middle','Align vertical center',AlignVerticalJustifyCenter],['bottom','Align bottom',AlignVerticalJustifyEnd]].map(([direction,label,Icon])=><button key={direction} type="button" title={label} aria-label={label} onClick={()=>alignBoardSelection(direction)}><Icon size={16}/></button>)}
        </div>
        <div className="tpws-ai-compact-tools" role="group" aria-label="Scale selected layers">
          <button type="button" title="Scale selected objects to 90%" aria-label="Scale down 10%" onClick={()=>scaleBoardSelection(.9)}><ZoomOut size={16}/></button>
          <button type="button" title="Scale selected objects to 110%" aria-label="Scale up 10%" onClick={()=>scaleBoardSelection(1.1)}><ZoomIn size={16}/></button>
        </div>
        <div className="tpws-object-direct-actions">
          <button type="button" onClick={()=>{
            const revised={...workspace.boardObjects?.[page]}
            const upper=Math.max(2,...Object.values(revised).map(entry=>Number(entry?.zIndex)||0))
            selectedIds.forEach((id,index)=>{revised[id]={...revised[id],zIndex:upper+index+1}})
            update({...workspace,boardObjects:{...workspace.boardObjects,[page]:revised}})
          }} title="Bring selected layers forward" aria-label="Bring selected layers forward"><ArrowUpToLine size={16}/></button>
          <button type="button" onClick={()=>{
            const revised={...workspace.boardObjects?.[page]}
            selectedIds.forEach((id,index)=>{revised[id]={...revised[id],zIndex:-selectedIds.length+index}})
            update({...workspace,boardObjects:{...workspace.boardObjects,[page]:revised}})
          }} title="Send selected layers backward" aria-label="Send selected layers backward"><ArrowDownToLine size={16}/></button>
          <button type="button" onClick={()=>selectBoardObject(null)} aria-label="Clear selection" title="Clear selection"><MousePointer2 size={16}/></button>
        </div>
      </div>}
      {selectedBoardObject?.pageId===page&&<div className="tpws-side-section tpws-object-properties" aria-label="Selected page object properties">
        <p className="tpws-side-label"><Scaling size={14}/> SELECTED PAGE OBJECT</p>
        <strong>{selectedBoardObject.id.replaceAll('-',' ').toUpperCase()}</strong>
        {selectedLooseAsset&&<TechPackSelectedArtworkAppearance20261031
          selectedAsset={selectedLooseAsset} appearanceOverrides={selectedLooseAppearance}
          disabled={isLayerLocked(page,selectedBoardObject.id)}
          onChange={changes=>editSelectedArtworkAppearance(changes,null)}
          onRasterRecolor={recolorSelectedRasterArtwork}/>}
        {selectedLooseAsset&&/^data:image\/svg\+xml/i.test(String(selectedLooseAsset.dataUrl||selectedLooseAsset._src||''))&&
          <button type="button" className="tpws-ai-expand-svg" aria-label="Ungroup selected SVG into editable VectorCraft paths"
            disabled={isLayerLocked(page,selectedBoardObject.id)}
            onClick={()=>expandSvgAssetToPaths(page,selectedBoardObject.id)}>
            <Shapes size={14}/> Expand SVG · Edit individual paths and anchor points
          </button>}
        {selectedPageBox?.slot?.contentType==='photo'&&<TechPackSelectedArtworkAppearance20261031
          selectedAsset={assets.find(item=>item.id===selectedPageBox.assetId)}
          appearanceOverrides={selectedPageBox.slot}
          disabled={isLayerLocked(page,'box-'+selectedPageBox.id)}
          onChange={changes=>editSelectedArtworkAppearance(changes,selectedPageBox)}
          onRasterRecolor={recolorSelectedRasterArtwork}/>}
        <div className="tpws-object-direct-actions">
          <button type="button" aria-label="Edit selected object's content" onClick={()=>focusSelectedContent(page,selectedBoardObject.id)}>Edit content</button>
          <button type="button" aria-label="Replace selected object image or style" onClick={()=>layoutContext(page,selectedBoardObject.id,'replace')}>Replace visual</button>
          <button type="button" aria-label="Duplicate selected layout object" onClick={()=>layoutContext(page,selectedBoardObject.id,'duplicate')}>Duplicate</button>
          <button type="button" aria-label="Delete selected layout object" onClick={()=>layoutContext(page,selectedBoardObject.id,'delete')}>Delete</button>
        </div>
        {selectedPageBox&&<div className="tpws-selected-box-properties" aria-label="Selected artboard box settings">
          {['photo','swatch'].includes(selectedPageBox.slot?.contentType)?
            <TechPackMediaProperties20261031 box={selectedPageBox}
              assets={assets} fabrics={source.fabrics||[]} colorways={colorways} project={project}
              disabled={isLayerLocked(page,'box-'+selectedPageBox.id)}
              onChange={patch=>editTemplateBox(page,selectedPageBox.id,patch)}
              onAssetChange={assetId=>attach(assetId)}
              onRemoveWhiteBackground={makeTechnicalDrawingTransparent}
              onChooseAsset={assetId=>attach(assetId)}/>:
            <strong>ARTBOARD BOX</strong>}
          <div className="tpws-box-dimensions">{[['x','Left X'],['y','Top Y'],['width','Width'],['height','Height']].map(([key,label])=><label key={key}>{label}<input type="number" aria-label={`Selected box ${label}`} min={0} max={792} value={Math.round(selectedPageBox.slot?.category==='tables'?selectedBoxGeometry?.[key]??0:selectedPageBox[key]??0)} onChange={e=>editSelectedBoxGeometry(key,e.target.value)}/></label>)}</div>
          <div className="tpws-box-align" role="group" aria-label="Align selected box to artboard">
            {[['left','Left'],['center','Center X'],['right','Right'],['top','Top'],['middle','Center Y'],['bottom','Bottom']].map(([key,label])=><button key={key} type="button" onClick={()=>alignSelectedBox(key)} aria-label={`Align selected box ${label.toLowerCase()}`}>{label}</button>)}
          </div>
          {!['photo','swatch'].includes(selectedPageBox.slot?.contentType)&&<>
            <label>Border style<select value={selectedPageBox.border==='dashed'?'dashed':'solid'} onChange={e=>editTemplateBox(page,selectedPageBox.id,{border:e.target.value})}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
            <label>Border color<input type="color" aria-label="Selected box border color" value={/^#[0-9a-f]{6}$/i.test(selectedPageBox.lineColor||'')?selectedPageBox.lineColor:'#252c34'} onChange={e=>editTemplateBox(page,selectedPageBox.id,{lineColor:e.target.value})}/></label>
            <button type="button" onClick={()=>{setLibrarySection('assets');setRightTab('assets');setLayoutNotice('Choose an image to place or replace inside the selected box.')}}><ImagePlus size={13}/> Add or replace image</button>
            <button type="button" onClick={()=>insertExcelWidget(TECHPACK_TABLE_TEMPLATES[0],page)}><Table2 size={13}/> Insert Excel table in box</button>
          </>}
        </div>}
        {editMode==='layout'&&['x','y','scaleX','scaleY'].map(key=>{
          const saved=workspace.boardObjects?.[page]?.[selectedBoardObject.id]||{}
          return <label key={key}>{({x:'Position X / px',y:'Position Y / px',scaleX:'Horizontal scale',scaleY:'Vertical scale'})[key]}
            <input type="number" aria-label={`Object ${key}`} step={key.startsWith('scale')?.05:1} value={saved[key]??(key.startsWith('scale')?1:0)}
              onChange={e=>updateBoardObject(page,selectedBoardObject.id,{...saved,[key]:Number(e.target.value)})}/>
          </label>
        })}
        {editMode==='layout'&&<button type="button" onClick={()=>updateBoardObject(page,selectedBoardObject.id,{x:0,y:0,scaleX:1,scaleY:1})}>Reset object position and size</button>}
      </div>}
      <div className="tpws-annotation-properties"><p className="tpws-side-label">DRAWING ANNOTATIONS</p>
        <span>{annotationTool==='select'?'Click and drag an arrow, dimension, path or marker to reposition. Select a Bezier path to edit its anchors.':annotationTool==='bezier'?'Click points on a technical drawing; drag for curved handles. Double-click or press Enter to finish.':annotationTool==='dimension'?'Drag between the two measured locations, then select and link the annotation to a POM value.':'DRAW / '+annotationTool.toUpperCase()+' TOOL ACTIVE · DRAW ON PAGE'}</span>
        {(workspace.annotations?.[page]||[]).map((item,i)=><div key={item.id} className="tpws-annotation-property-row">
          <button type="button" className={selectedAnnotationId===item.id?'active':''} onClick={()=>{setSelectedAnnotationId(item.id);setAnnotationTool('select')}}>{i+1}. {item.type==='highlighter'?'Colored marker':item.type==='dimension'?'Measurement dimension':item.type==='arrow'?'Leader arrow':item.type==='pen'?'Pen stroke':item.type==='bezier'?'Bezier path':'Detail marker'}</button>
          {selectedAnnotationId===item.id&&<><label>Annotation label<input aria-label="Selected annotation label" value={item.label||''} onChange={e=>updateAnnotation(page,item.id,{label:e.target.value.slice(0,140)})}/></label>
            {item.type==='highlighter'&&<><label>Markup color<select aria-label="Selected markup color" value={item.color||'#f4d03f'} onChange={e=>updateAnnotation(page,item.id,{color:e.target.value})}>{TECHPACK_MARKER_COLORS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
              <label>Markup width<select aria-label="Selected markup width" value={item.width||24} onChange={e=>updateAnnotation(page,item.id,{width:Number(e.target.value)})}>{TECHPACK_MARKER_WIDTHS.map(w=><option key={w} value={w}>{w===12?'Fine':w===24?'Medium':'Wide'}</option>)}</select></label></>}
            {item.type==='dimension'&&<>
              <label>Linked point of measure<select aria-label="Linked point of measure" value={item.pomId||''} onChange={e=>updateAnnotation(page,item.id,{pomId:e.target.value,label:''})}><option value="">Unlinked · select POM</option>{measurementRefs.map((reference,i)=><option key={reference.id} value={reference.id}>{reference.reference} · {measurementSpec.rows[i].cells[0]}</option>)}</select></label>
              <label>Measurement size<select aria-label="Dimension measurement size" value={item.sizeIndex??2} onChange={e=>updateAnnotation(page,item.id,{sizeIndex:Number(e.target.value)})}>{measurementSpec.headers.slice(2,-1).map((name,i)=><option key={name} value={i+2}>{name}</option>)}</select></label>
              <label className="tpws-pom-check"><input type="checkbox" checked={Boolean(item.placementVerified)} onChange={e=>updateAnnotation(page,item.id,{placementVerified:e.target.checked})}/> Drawing endpoints manually checked</label>
              <small>{linkedMeasurementLabel(item,measurementSpec,workspace.cells?.measurements||{}).detail}. This references an authored/source POM, not a measurement computed from the drawn arrow length.</small>
            </>}
            {item.type==='arrow'&&<><label>Component / location<input aria-label="Arrow component" value={item.component||''} placeholder="e.g. collar rib join" onChange={e=>updateAnnotation(page,item.id,{component:e.target.value.slice(0,100)})}/></label>
              <label>Factory instruction<textarea aria-label="Arrow factory note" value={item.instruction||''} placeholder="Stitch type, finish, needle, seam allowance, tolerance..." onChange={e=>updateAnnotation(page,item.id,{instruction:e.target.value.slice(0,260)})}/></label>
              <label className="tpws-pom-check"><input type="checkbox" aria-label="Construction leader placement reviewed against sample" checked={item.verified===true} onChange={e=>updateAnnotation(page,item.id,{verified:e.target.checked})}/> Leader position and instruction checked against the actual sample</label></>}
            <button type="button" onClick={()=>deleteAnnotation(page,item.id)}><Trash2 size={12}/> Delete</button></>}
        </div>)}
      </div>
      <div className="tpws-properties">
          <TechPackProductionControl20261031
            source={source} nativeSnapshot={nativeSnapshot} project={project} nativeMode={nativeMode}
            draft={draft} workspace={workspace} readiness={factoryReview}
            onUpdate={update} onExport={exportProductionHandoff} onPrint={printFullPack}/>
          <details className="tpws-gallery-settings">
            <summary><ImagePlus size={14}/> SMART MIDDLE PHOTO LAYOUT</summary>
            <div>
              <label>Number of photo references<input type="number" min="1" max="24" value={galleryPhotoCount}
                onChange={event=>setGalleryPhotoCount(Math.min(24,Math.max(1,Number(event.target.value)||1)))}/></label>
              <button type="button" onClick={()=>fitPhotoReferences()}>Reflow page to {galleryPhotoCount} references</button>
              <label>Auto-placement tags<input value={galleryTargetTags} onChange={event=>setGalleryTargetTags(event.target.value)}
                onBlur={()=>setPhotoPageTags(galleryTargetTags)} placeholder="mockup, drawing, front, back"/></label>
              <button type="button" onClick={()=>runAutoMediaPlacement(true)}>Fill tagged media on current page</button>
              <button type="button" onClick={()=>runAutoMediaPlacement(false)}>Fill tagged media across pages</button>
            </div>
          </details>
          <div className="tpws-side-section"><p className="tpws-side-label"><LayoutTemplate size={14}/> PAGE SETTINGS</p>
          <label>Page title<input aria-label="Techpack page title" value={details.title??activePage.name} onChange={e=>configure({title:e.target.value})}/></label>
          <label>Subtitle<input aria-label="Techpack page subtitle" value={details.subtitle??activePage.subtitle} onChange={e=>configure({subtitle:e.target.value})}/></label>
          <label>Header preset<select aria-label="Header preset" value={preset} onChange={e=>configure({headerPreset:e.target.value})}>{HEADER_PRESETS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <p className="tpws-layout-help">Use Library → Templates → Page templates for current production-page compositions, or Objects &amp; frames for independent Illustrator-like artwork. The former fixed-frame page composition selector has been retired. Orientation, page flow and zoom are in Document &amp; Artboards above.</p></div>
          <div className="tpws-side-section"><p className="tpws-side-label"><FileSpreadsheet size={14}/> STYLE IDENTIFICATION</p>
            {[['styleName','Style'],['brand','Brand'],['sku','Style number'],['season','Season'],['factory','Factory']].map(([key,label])=><label key={key}>{label}<input value={draft[key]??(key==='styleName'?source.name:'')} placeholder="Enter value" onChange={e=>field(key,e.target.value)}/></label>)}
            <label>Draft stage<select value={draft.status||'draft'} onChange={e=>field('status',e.target.value)}><option value="draft">Draft</option><option value="in review">In review</option><option value="sampling">Sampling</option>{draft.status==='approved'&&<option value="approved">Legacy approved flag · unverified</option>}</select></label>
          </div>
          <div className="tpws-side-section"><p className="tpws-side-label"><Maximize2 size={14}/> DOCUMENT TOOLS</p><button className="tpws-wide" disabled={!source.ready} onClick={refreshSpecifications} title="Replace measurements and materials with the current design"><RefreshCw size={15}/> Refresh garment specifications</button><button className="tpws-wide" onClick={openNewTableStudio}><Table2 size={15}/> Open Table Studio</button><button className="tpws-wide" onClick={()=>addRow()}><FilePlus2 size={15}/> Insert specification row</button><button className="tpws-wide" onClick={()=>{setRightTab('assets');uploadGeneralReference()}}><ImagePlus size={15}/> Add a reference to page</button><button className="tpws-wide" onClick={exportCsv}><Download size={15}/> Export this page CSV</button>
            <div className="tpws-spreadsheet-actions" aria-label="Excel Techpack spreadsheet integration">
              <strong>EXCEL / SPREADSHEET TABLES</strong>
              <label>Garment table<select aria-label="Linked garment spreadsheet type" value={spreadsheetKind} onChange={e=>setSpreadsheetKind(e.target.value)}>
                {TECHPACK_BOUND_TABLE_PAGE_IDS.map(type=><option key={type} value={type}>{({"measurement-table":"POM measurements",grading:"Grading matrix",materials:"Materials & BOM",fabrics:"Fabric specification","construction-operations":"Sewing operations","pattern-cutlist":"Pattern cut list",labels:"Labels and tags",packaging:"Packaging",notes:"Fit / revisions"})[type]||type}</option>)}
              </select></label>
              <button className="tpws-wide" disabled={!source.ready} onClick={()=>insertLinkedSpreadsheet()}><Table2 size={15}/> Insert linked specification table</button>
              <button className="tpws-wide" onClick={exportSpreadsheetWorkbook}><Download size={15}/> Export editable Excel workbook</button>
              <input ref={xlsxImportRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importSpreadsheetWorkbook} style={{display:'none'}} aria-label="Choose Excel techpack to import"/>
              <button className="tpws-wide" onClick={()=>xlsxImportRef.current?.click()}><Upload size={15}/> Import Excel onto new pages</button>
              <small>Source values stay linked; imported and overridden values require factory review.</small>
            </div></div>
        </div>
    </section>,hosts.objects)}
    {hosts?.leftTools&&createPortal(<div className="tpws-native-rail" aria-label="Techpack left tools">
      <div className="tpws-rail-history" role="group" aria-label="Undo and redo document edits">
        <button type="button" aria-label="Undo Tech Pack edit (Command Z)" disabled={!undoHistory.current.length} onClick={undoTechPack}><Undo2 size={16}/></button>
        <button type="button" aria-label="Redo Tech Pack edit (Command Shift Z)" disabled={!redoHistory.current.length} onClick={redoTechPack}><Redo2 size={16}/></button>
      </div>
      <strong>VECTOR</strong>
      <button type="button" className={editMode==='layout'&&vectorTool==='direct'?'active':''}
        aria-label="VectorCraft direct selection tool" title="Direct Selection (A) · choose individual path contours and edit Bézier nodes"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('direct');setInspectorTab('properties')}}><MousePointer2 size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='anchor'?'active':''}
        aria-label="VectorCraft anchor point tool" title="Anchor Point · move vertices, drag purple handles"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('anchor')}}><PenTool size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='add-anchor'?'active':''}
        aria-label="VectorCraft add anchor point tool" title="Add Anchor Point (+) · click a line to subdivide its true geometry"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('add-anchor')}}><Plus size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='delete-anchor'?'active':''}
        aria-label="VectorCraft delete anchor point tool" title="Delete Anchor Point (-) · click a blue node to remove it"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('delete-anchor')}}><Trash2 size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='pen'?'active':''}
        aria-label="VectorCraft pen path tool" title="Pen (P) · click to add vertices, drag for curve handles, click first vertex to close, Enter to finish"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('pen');setSelectedBoardObject(null)}}><PenTool size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='pencil'?'active':''}
        aria-label="VectorCraft pencil path tool" title="Pencil (N) · draw new editable vector path from your freehand gesture"
        onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('pencil');setSelectedBoardObject(null)}}><Pencil size={19}/></button>
      <button type="button" disabled={activeVectorIds.length<2} aria-label="Group VectorCraft paths"
        title="Group selected path layers to move them together" onClick={groupSelectedVectors}><Combine size={19}/></button>
      <button type="button" disabled={!pageVectors.some(item=>activeVectorIds.includes(item.id)&&item.groupId)}
        aria-label="Ungroup VectorCraft paths" title="Ungroup selected source SVG paths, making each contour independent"
        onClick={ungroupSelectedVectors}><Layers3 size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='rect'?'active':''} title="Rectangle (M) · drag to draw editable vector shape" aria-label="Vector rectangle tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('rect')}}><Square size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='grid'?'active':''} title="Rectangular Grid · drag to draw an independent Illustrator-style vector grid" aria-label="Rectangular grid tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('grid')}}><Grid size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='ellipse'?'active':''} title="Ellipse · drag to draw editable vector shape" aria-label="Vector ellipse tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('ellipse')}}><Shapes size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='text'?'active':''} title="Type (T) · click to insert text frame" aria-label="Vector text tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('text')}}><Type size={19}/></button>
      <button type="button" className={editMode==='layout'&&vectorTool==='builder'?'active':''} title="Shape Builder · Shift-click two rectangles in Layers, then Unite / Minus Front in Properties" aria-label="Vector shape builder tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('builder')}}><Combine size={19}/></button>
      <div className="tpws-native-tools-separator"/>
      <strong>TABLES</strong>
      <button type="button" title="Design an editable table in the large Table Studio" aria-label="Insert Techpack table" onClick={openNewTableStudio}><Table2 size={19}/></button>
      <button type="button" title="Table structure: insert rows, columns and headings" aria-label="GridCraft table structure tools" onClick={()=>{
        if(!activeTableBox){openNewTableStudio();return}
        setInspectorTab('tables');setTablePanelOpen(true);setEditMode('content')
      }}><Grid3X3 size={19}/></button>
      <button type="button" title="Insert row below selected spreadsheet cell" aria-label="Insert table row" disabled={!activeTableBox||editMode==='layout'||isLayerLocked(page,tableLayerId(activeTableBox))} onClick={()=>{
        if(!activeTableBox)return
        try{
          const next=gridcraftTableCommand(activeTableBox.slot.spreadsheetTable,{type:'insertRow',at:selectedTableCell.r+1})
          editSelectedTable(next)
        }catch(error){setError(error.message)}
      }}><Rows2 size={19}/></button>
      <button type="button" title="Insert column to right of selected spreadsheet cell" aria-label="Insert table column" disabled={!activeTableBox||editMode==='layout'||isLayerLocked(page,tableLayerId(activeTableBox))} onClick={()=>{
        if(!activeTableBox)return
        try{
          const next=gridcraftTableCommand(activeTableBox.slot.spreadsheetTable,{type:'insertColumn',at:selectedTableCell.c+1})
          editSelectedTable(next)
        }catch(error){setError(error.message)}
      }}><Columns2 size={19}/></button>
      <button type="button" title="Table styles, custom headers and cell formatting" aria-label="GridCraft table styles" onClick={()=>{
        if(!activeTableBox){openNewTableStudio();return}
        setInspectorTab('tables');setTablePanelOpen(true);setEditMode('content')
      }}><Palette size={19}/></button>
      <div className="tpws-native-tools-separator"/>
      <strong>ANNOTATE</strong>
      <button type="button" className={editMode==='layout'&&annotationTool==='select'&&vectorTool==='select'?'active':''} aria-pressed={editMode==='layout'&&annotationTool==='select'&&vectorTool==='select'} title="Select tool (V) · click artwork and drag handles" aria-label="Select tool" onClick={()=>{setEditMode('layout');setAnnotationTool('select');setVectorTool('select')}}><MousePointer2 size={19}/></button>
      <button type="button" className={editMode==='layout'&&annotationTool==='transform'?'active':''} aria-pressed={editMode==='layout'&&annotationTool==='transform'} title="Transform tool · move and resize selected objects" aria-label="Transform bounding box tool" onClick={()=>{setEditMode('layout');setAnnotationTool('transform');setVectorTool('select')}}><Scaling size={19}/></button>
      <button type="button" className={editMode==='layout'&&annotationTool==='box'?'active':''} aria-pressed={editMode==='layout'&&annotationTool==='box'} title="Box tool (B) · drag on any artboard to draw a resizable layout box" aria-label="Box tool" onClick={()=>{setEditMode('layout');setAnnotationTool('box');setVectorTool('select');setSelectedBoardObject(null)}}><Square size={19}/></button>
      <button type="button" className={annotationTool==='artboard'?'active':''} aria-pressed={annotationTool==='artboard'} title="Artboard tool · select page labels and drag to rearrange pages" aria-label="Artboard tool" onClick={()=>{setEditMode('layout');setAnnotationTool('artboard');setVectorTool('select')}}><LayoutTemplate size={19}/></button>
      <button type="button" className={handTool?'active':''} aria-pressed={handTool} title="Hand tool · drag in Canvas mode, or hold Space" aria-label="Hand tool" onClick={()=>setHandTool(value=>!value)}><Hand size={19}/></button>
      <button type="button" className={annotationTool==='pen'?'active':''} aria-pressed={annotationTool==='pen'} title="Draw freehand seam and construction annotations" aria-label="Pen annotation tool" onClick={()=>{setAnnotationTool('pen');setVectorTool('select')}}><Pencil size={19}/></button>
      <button type="button" className={annotationTool==='bezier'?'active':''} aria-pressed={annotationTool==='bezier'} title="Bezier Pen · click anchors and drag handles, Enter to finish" aria-label="Bezier pen tool" onClick={()=>{setAnnotationTool('bezier');setVectorTool('select')}}><PenTool size={19}/></button>
      <button type="button" className={annotationTool==='arrow'?'active':''} aria-pressed={annotationTool==='arrow'} title="Click to place an arrow, or drag from the tail to the tip" aria-label="Arrow annotation tool" onClick={()=>{setAnnotationTool('arrow');setVectorTool('select')}}><MoveUpRight size={19}/></button>
      <button type="button" className={annotationTool==='dimension'?'active':''} aria-pressed={annotationTool==='dimension'} title="Double-headed dimension arrows · link to measurement specification" aria-label="Dimension measurement tool" onClick={()=>{setAnnotationTool('dimension');setVectorTool('select');navigateToPage('measurements')}}><Ruler size={19}/></button>
      <button type="button" className={annotationTool==='marker'?'active':''} aria-pressed={annotationTool==='marker'} title="Place a numbered-style detail marker" aria-label="Detail marker tool" onClick={()=>{setAnnotationTool('marker');setVectorTool('select')}}><Tag size={19}/></button>
      <button type="button" className={annotationTool==='highlighter'?'active':''} aria-pressed={annotationTool==='highlighter'} title="Colored page marker · highlight technical drawings, notes and tables" aria-label="Colored markup marker tool" onClick={()=>{setAnnotationTool('highlighter');setVectorTool('select')}}><Highlighter size={19}/></button>
      <button type="button" className={annotationTool==='pencil'?'active':''} aria-pressed={annotationTool==='pencil'} title="Review pencil · freehand red markup on any Tech Pack page" aria-label="Red pencil markup tool" onClick={()=>{setAnnotationTool('pencil');setVectorTool('select')}}><Pencil size={19}/></button>
      {annotationTool==='pencil'&&<div className="tpws-ink-rail-palette" role="group" aria-label="Pencil markup colors">{TECHPACK_PENCIL_COLORS.map(color=><button key={color.value} type="button" aria-label={color.label+' pencil'} aria-pressed={pencilColor===color.value} onClick={()=>setPencilColor(color.value)} style={{'--tpws-ink':color.value}}/>)}</div>}
      {annotationTool==='pencil'&&<div className="tpws-ink-width-controls" role="group" aria-label="Pencil stroke width">{TECHPACK_PENCIL_WIDTHS.map(w=><button key={w} type="button" aria-label={w+' pixel pencil stroke'} aria-pressed={pencilWidth===w} onClick={()=>setPencilWidth(w)}>{w}</button>)}</div>}
      <button type="button" className={annotationTool==='comment'?'active':''} aria-pressed={annotationTool==='comment'} title="Place an editable review comment on the page" aria-label="Review comment tool" onClick={()=>{setAnnotationTool('comment');setVectorTool('select')}}><MessageSquare size={19}/></button>
      <button type="button" className={annotationTool==='sticky'?'active':''} aria-pressed={annotationTool==='sticky'} title="Place a draggable sticky note on the artboard" aria-label="Sticky note tool" onClick={()=>{setAnnotationTool('sticky');setVectorTool('select')}}><StickyNote size={19}/></button>
      {annotationTool==='highlighter'&&<div className="tpws-ink-rail-palette" role="group" aria-label="Marker colors">{TECHPACK_MARKER_COLORS.map(color=><button key={color.value} type="button" aria-label={`${color.label} marker`} aria-pressed={highlightColor===color.value} onClick={()=>setHighlightColor(color.value)} title={color.label} style={{'--tpws-ink':color.value}}/>)}</div>}
      {annotationTool==='highlighter'&&<div className="tpws-ink-width-controls" role="group" aria-label="Marker stroke width">{TECHPACK_MARKER_WIDTHS.map(w=><button type="button" key={w} aria-label={`${w===12?'Fine':w===24?'Medium':'Wide'} marker width`} aria-pressed={highlightWidth===w} onClick={()=>setHighlightWidth(w)}>{w===12?'S':w===24?'M':'L'}</button>)}</div>}
      <div className="tpws-native-tools-separator"/>
      <strong>PAGES</strong>
      <button type="button" title="Page overview" onClick={()=>navigateToPage('overview')}><BookOpen size={18}/></button>
      <button type="button" title="Fabric specification page" onClick={()=>navigateToPage('fabrics')}><FileImage size={18}/></button>
      <button type="button" title="Callouts and arrows page" onClick={()=>{navigateToPage('callouts');setAnnotationTool('arrow')}}><MoveUpRight size={18}/></button>
      <button type="button" title="Measurement sheet" onClick={()=>navigateToPage('measurements')}><FileSpreadsheet size={18}/></button>
      <button type="button" title="Sewing sheet" onClick={()=>navigateToPage('construction')}><Settings2 size={18}/></button>
      <button type="button" title="Add reference" onClick={uploadGeneralReference}><ImagePlus size={18}/></button>
      <button type="button" title="Add specification row" onClick={()=>addRow()}><Plus size={18}/></button>
      <button type="button" title="Excel/Notion table widget · insert into selected box, or draw an independent widget on any artboard" aria-label="Insert Excel table widget" onClick={openNewTableStudio}><Table2 size={18}/></button>
    </div>,hosts.leftTools)}
    {hosts?.rightTools&&createPortal(<div className="tpws-native-rail" aria-label="Techpack right tools">
      <strong>EDIT</strong>
      <button type="button" title="Undo latest Tech Pack edit" disabled={!undoHistory.current.length} onClick={undoTechPack}><Undo2 size={17}/></button>
      <button type="button" title="Redo Tech Pack edit" disabled={!redoHistory.current.length} onClick={redoTechPack}><Redo2 size={17}/></button>
      <button type="button" title="Open Character properties for selected text" onClick={()=>setInspectorTab('properties')}><Type size={17}/></button>
      <button type="button" title="Open Themes gallery" onClick={()=>setLibrarySection('themes')}><Palette size={17}/></button>
      <button type="button" title="Open Tables workspace" onClick={()=>setInspectorTab('tables')}><Table2 size={17}/></button>
      <button type="button" title="Open Layers" onClick={()=>setInspectorTab('layers')}><Layers3 size={17}/></button>
      <div className="tpws-native-tools-separator"/>
      <strong>CONTENT</strong>
      <button type="button" title="Reference photo layouts" aria-label="Insert reference photo middle layout" onClick={()=>applyMiddlePageTemplate('middle-photos')}><ImagePlus size={17}/></button>
      <button type="button" title="Color swatch layout" aria-label="Insert color palette middle layout" onClick={()=>applyMiddlePageTemplate('middle-colors')}><Palette size={17}/></button>
      <button type="button" title="Fabric swatch layout" aria-label="Insert fabric swatch middle layout" onClick={()=>applyMiddlePageTemplate('middle-fabrics')}><Shapes size={17}/></button>
      <button type="button" title="Technical drawing with four arrow callouts" aria-label="Insert technical drawing callout middle layout" onClick={()=>applyMiddlePageTemplate('middle-callouts')}><MoveUpRight size={17}/></button>
      <button type="button" title="Place leader arrows" aria-label="Leader arrow tool" onClick={()=>{setAnnotationTool('arrow');setVectorTool('select')}}><PenTool size={17}/></button>
      <button type="button" title="Place a review comment" aria-label="Review comment tool" onClick={()=>{setAnnotationTool('comment');setVectorTool('select')}}><MessageSquare size={17}/></button>
      <button type="button" title="Zoom in on artboard" aria-label="Zoom in on Tech Pack" onClick={()=>setDocumentZoom(value=>nextTechPackZoom(value,'in',canvasWidth,orientation==='landscape'))}><ZoomIn size={17}/></button>
      <button type="button" title="Zoom out of artboard" aria-label="Zoom out of Tech Pack" onClick={()=>setDocumentZoom(value=>nextTechPackZoom(value,'out',canvasWidth,orientation==='landscape'))}><ZoomOut size={17}/></button>
      <div className="tpws-native-tools-separator"/>
      <strong>PAGES</strong>
      <button type="button" title="Previous page" disabled={position===0} onClick={()=>navigateToPage(documentPages[position-1].id)}><ChevronLeft size={18}/></button>
      <button type="button" title="Next page" disabled={position===documentPages.length-1} onClick={()=>navigateToPage(documentPages[position+1].id)}><ChevronRight size={18}/></button>
      <button type="button" title="Toggle portrait / landscape on all Techpack pages" aria-label="Toggle orientation for all pages" onClick={()=>configureAllPages({orientation:orientation==='portrait'?'landscape':'portrait'})}><Maximize2 size={18}/></button>
      <button type="button" title="Export complete Techpack" onClick={exportJson}><Download size={18}/></button>
      <button type="button" title="Export sheet CSV" onClick={exportCsv}><FileSpreadsheet size={18}/></button>
      <button type="button" title="Print all pages" onClick={printFullPack}><Printer size={18}/></button>
    </div>,hosts.rightTools)}
    {storageError&&<div className="tpws-save-alert" role="alert">{storageError}</div>}
    <div className="tpws-editor-body">
      <section className="tpws-center tpws-native-canvas" aria-label="Techpack document editor">
        <div className="tpws-glass-dock" aria-label="Techpack page orientation and navigation">
          <div className="tpws-glass-segment tpws-layout-switch" role="group" aria-label="Techpack editing mode">
            <span>EDIT</span><button type="button" aria-pressed={editMode==='content'} aria-label="Content edit mode" onClick={()=>setMode('content')}><Pencil size={14}/> Content</button>
            <button type="button" aria-pressed={editMode==='layout'} aria-label="Layout edit mode" onClick={()=>setMode('layout')}><Scaling size={14}/> Layout</button>
          </div>
          <span className="tpws-glass-count">{documentPages.length} PAGES · {paperSize.toUpperCase()}</span>
        </div>
        {layoutNotice&&<div className="tpws-layout-notice" role="status">{layoutNotice}<button type="button" onClick={()=>setLayoutNotice('')} aria-label="Dismiss layout notice">×</button></div>}
        <div className="tpws-paper-scroll" ref={scrollRef} data-page-flow={pageFlow} data-hand-tool={String(handTool)} onScroll={syncPageOnScroll}
          onPointerDownCapture={event=>{
            if(editMode!=='layout'||annotationTool!=='select'||vectorTool!=='select'||handTool)return
            const node=event.target
            if(!(node instanceof Element)||node.closest('[data-board-object],[data-techpack-vector],[data-vector-id],[data-vector-anchor],[data-vector-handle],[data-object-handle],input,textarea,select,button,[contenteditable="true"],[role="gridcell"],.tpws-annotation-marker'))return
            // The actual page margin, empty artboard and surrounding canvas
            // all act as click-away areas. No invisible overlay traps selection.
            selectBoardObject(null);setSelectedVectorIds([]);setTextSelection(null)
            setActiveTableId('');setSelectedTableCell({r:0,c:0})
          }}
          onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd}
          aria-label="Scrollable Techpack pages">
          <div className={`tpws-sheet-track tpws-sheet-track-${pageFlow}`}>
            {documentPages.map(sheetDef=>renderSheet(sheetDef))}
            <button type="button" className="tpws-add-page-artboard" aria-label="Add another Techpack page" onClick={addCustomPage}><Plus size={27}/><strong>ADD PAGE</strong><span>Blank artboard · edit and save your own layout</span></button>
          </div>
        </div>

      </section>
    </div>
    <TechPackTableStudio20261030
      open={Boolean(tableStudio&&(tableStudio.mode==='draft'||studioTableBox))}
      draftMode={tableStudio?.mode==='draft'}
      table={tableStudio?.mode==='draft'?tableStudioDraft:
        studioTableBox?.slot?.spreadsheetTable||null}
      onChange={next=>tableStudio?.mode==='draft'?setTableStudioDraft(next):editStudioTable(next)}
      sourceLabel={tableStudio?.mode==='draft'?'New table · not yet placed':studioTableBox?.title||'Embedded Tech Pack table'}
      readOnly={tableStudio?.mode==='placed'&&isLayerLocked(page,tableLayerId(studioTableBox))}
      anchorId={studioTableBox?.legacyTableId?'table-'+studioTableBox.legacyTableId:studioTableBox?'box-'+studioTableBox.id:''}
      anchorPageId={tableStudio?.pageId||page}
      savedThemes={workspace.tableThemePresets||[]}
      onSaveTheme={item=>{
        const current=workspace.tableThemePresets||[]
        if(current.length>=20)throw new Error('Maximum 20 saved table styles')
        update({...workspace,tableThemePresets:[...current,{id:uid(),name:String(item.name).slice(0,40),style:item.style}]})
      }}
      onSaveToLibrary={saveTableToLibrary}
      onEmbed={next=>embedAuthoredTable(next,page)}
      onRemove={()=>{
        if(!studioTableBox||isLayerLocked(page,tableLayerId(studioTableBox)))return
        if(studioTableBox.legacyTableId){
          if(!window.confirm('Remove this table from this Tech Pack page? Its cells will be removed.'))return
          const legacyId=studioTableBox.legacyTableId
          update({...workspace,tables:{...workspace.tables,[page]:(workspace.tables?.[page]||[]).filter(item=>item.id!==legacyId)}})
        }else{
          if(!window.confirm('Remove this table from this Tech Pack page? Its cells will be removed.'))return
          const boxId=studioTableBox.id
          update({...workspace,pageBoxes:{...workspace.pageBoxes,
            [page]:(workspace.pageBoxes?.[page]||[]).filter(box=>box.id!==boxId)}})
        }
        setTableStudio(null);setActiveTableId('');setSelectedTableCell({r:0,c:0})
        setSelectedBoardObject(null);setTextSelection(null);setTablePanelOpen(false)
        setLayoutNotice('Table removed. Insert a replacement from the table gallery whenever you need one.')
      }}
      onClose={()=>setTableStudio(null)}/>
    <input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" multiple onChange={handleUpload} aria-label="Upload techpack reference assets"/>
  </div>
}

import {garmentCodeToProject} from './garmentCode.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'

const finite = value => typeof value === 'number' && Number.isFinite(value)
const fail = reason => ({ok:false,reason})
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key)

/** Convert one verified, source-owned GarmentCode v2 document into a reviewable EXO project.
 * This function never changes the editor, the source response, or the base project.
 */
export function decodeVerifiedGarmentProject(payload, baseProject, {maxPanels=48,maxEdges=256}={}) {
  if (!payload || payload.ok !== true || payload.verified !== true) return fail('A verified archive source specification is required.')
  const sourceId=payload.sourceId
  const provenance=payload.source
  if (typeof sourceId!=='string'||!sourceId.trim()||sourceId.length>256||
      !provenance||provenance.sourceId!==sourceId||provenance.dataset!=='GarmentCodeData v2'||
      !/^[a-f0-9]{64}$/.test(provenance.sha256||'')||
      (payload.sourceSha256 && payload.sourceSha256!==provenance.sha256)) return fail('Verified source identity, hash or dataset provenance is missing.')
  const spec=payload.spec
  const panels=spec?.pattern?.panels
  const stitches=spec?.pattern?.stitches
  const properties=spec?.properties
  if (!panels||typeof panels!=='object'||Array.isArray(panels)||!Array.isArray(stitches)) return fail('Source is missing its panel geometry or seam graph.')
  const entries=Object.entries(panels)
  if (!entries.length||entries.length>maxPanels) return fail(`Source must contain 1–${maxPanels} pattern panels.`)
  if (properties?.units_in_meter!==100 || properties?.curvature_coords!=='relative' || properties?.normalized_edge_loops!==true) return fail('Source geometry must be verified in centimeters with relative curve coordinates and normalized loops.')
  if (spec.garment_studio) return fail('Archive source must use original GarmentCode geometry, without unverified editor extensions.')
  let vertexTotal=0
  for (const [name,panel] of entries) {
    const vertices=panel?.vertices,edges=panel?.edges
    if (!name.trim()||!Array.isArray(vertices)||!Array.isArray(edges)||vertices.length<3||vertices.length>maxEdges||edges.length!==vertices.length) return fail(`Panel ${name} has unsupported edge geometry.`)
    vertexTotal+=vertices.length
    if (vertices.some(point=>!Array.isArray(point)||point.length!==2||point.some(v=>!finite(v)||Math.abs(v)>100000))) return fail(`Panel ${name} contains invalid centimeter coordinates.`)
    const degree=new Array(vertices.length).fill(0)
    for (const edge of edges) {
      const ends=edge?.endpoints
      if (!Array.isArray(ends)||ends.length!==2||ends.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)||ends[0]===ends[1]) return fail(`Panel ${name} has an invalid edge endpoint.`)
      degree[ends[0]]++;degree[ends[1]]++
      if (edge.curvature!=null) {
        const curve=edge.curvature
        if (curve.type!=='quadratic'||!Array.isArray(curve.params)||curve.params.length!==1||!Array.isArray(curve.params[0])||curve.params[0].length!==2||curve.params[0].some(v=>!finite(v))) return fail(`Panel ${name} has an unsupported curve; only quadratic relative controls are editable.`)
      }
    }
    if (degree.some(d=>d!==2)) return fail(`Panel ${name} has a branching or disconnected boundary.`)
    let current=edges[0].endpoints[0],visited=new Set()
    for (let i=0;i<edges.length;i++) {
      const next=edges.findIndex((edge,index)=>!visited.has(index)&&edge.endpoints.includes(current))
      if(next<0) return fail(`Panel ${name} has an open boundary.`)
      visited.add(next)
      current=edges[next].endpoints.find(v=>v!==current)
      if(current===edges[0].endpoints[0]&&i!==edges.length-1)return fail(`Panel ${name} contains disconnected loops.`)
    }
    if(current!==edges[0].endpoints[0])return fail(`Panel ${name} has an open boundary.`)
  }
  if(vertexTotal>5000 || stitches.length>5000) return fail('Archive source exceeds the safe editing geometry budget.')
  for(const stitch of stitches) if(!Array.isArray(stitch)||stitch.length!==2||stitch.some(side=>!side||typeof side.panel!=='string'||!own(panels,side.panel)||!Number.isInteger(side.edge)||side.edge<0||side.edge>=panels[side.panel].edges.length)) return fail('Source contains an unresolved sewing edge.')
  if(!baseProject||baseProject.units!=='cm')return fail('An editable EXO base project with centimeter units is required.')
  // Only carry the physical preview environment. The archived garment starts
  // with its own construction graph, measurements, notions and annotations.
  const cleanBase={
    units:'cm',
    avatar:structuredClone(baseProject.avatar||{}),
    fabrics:{main:structuredClone(baseProject.fabrics?.main||{id:'main',name:'Main fabric'})},
    pieces:[],seams:[],fasteners:[],customMeasurements:[],trims:[],
    topstitches:[],graphics:[],bindings:[],interchange:{},
  }
  let project
  try {
    project=garmentCodeToProject(spec,cleanBase)
  } catch(error) {return fail(`Source geometry conversion failed: ${error.message}`)}
  if(project.pieces.length!==entries.length||project.seams.length!==stitches.length||project.pieces.some(piece=>!Array.isArray(piece.points)||piece.points.length!==panels[piece.name]?.edges.length)) return fail('Source panel edges or seams were lost during conversion.')
  // Grading is limited to the actual sourced base size. Other sizes need approved rules.
  const size=typeof payload.baseSize==='string'&&payload.baseSize.trim()?payload.baseSize.trim():'M'
  project.grading={baseSize:size,sizes:[size],widthPerSizeCm:0,lengthPerSizeCm:0}
  project.id=`archive-${cryptoSafeId(sourceId)}-${Date.now()}`
  project.name=`Archive draft · ${sourceId.slice(0,80)}`
  project.revision=(Number(baseProject.revision)||0)+1
  project.updatedAt=new Date().toISOString()
  project.pieces.forEach((piece,index)=>{
    const panel=panels[piece.name]
    const group=typeof panel.fabric_group==='string'&&panel.fabric_group.trim()?panel.fabric_group.trim():'main'
    piece.fabricId=own(project.fabrics||{},group)?group:'main'
    piece.sourceFabricGroup=group
    piece.cutQuantity=Number.isInteger(panel.cut_quantity)&&panel.cut_quantity>=1&&panel.cut_quantity<=100?panel.cut_quantity:1
    piece.sourcePanelName=entries[index][0]
  })
  project.patternGeneration={method:'verified_archive_garmentcode_decode_v1',sourceId,sourceDataset:provenance.dataset,sourceLicense:provenance.license||null,sourceSha256:provenance.sha256||null,sourceVerified:true,reviewRequired:true,trainedModelUsed:false,gradingSource:'base_size_only',fitVerified:false}
  let audit
  try {audit=inspectIndustrialPatterns(project,{sizes:[size]})} catch(error) {return fail(`Native geometry and seam audit failed: ${error.message}`)}
  if(audit.status!=='pass')return fail(`Native pattern QA blocked this source: ${audit.issues.slice(0,3).map(i=>`${i.code}: ${i.message}`).join('; ')}`)
  return {ok:true,project,report:{pieceCount:project.pieces.length,seamCount:project.seams.length,sourceId,verified:true,baseSize:size,gradeReady:false,fitReady:false,qa:audit.status,caveat:'Base-size stitchline geometry and seam lengths passed digital checks. Additional sizes, cloth behavior and physical fit remain unverified.'}}
}

function cryptoSafeId(value) {let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(36)}

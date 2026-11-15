// Transfer EXISTING source factory measurements to an EXO-owned Rust template.
// This is deliberately limited to EXO's Foundation Tee development block;
// C++ core / generic foreign pattern interchange is still not factory ready.
import {getEdgeSeamAllowance} from '../../src/core/project.js'

export function attachSourceTeeCutMetadata20261115(document,nativeTemplate){
 if(document?.productionSpec?.format!=='garment-studio.tee-production-development.v1')
  return {template:nativeTemplate,applied:false,limitations:[]}
 if(document.productionSpec?.approvalStatus!=='FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED')
  throw Error('Cannot transfer factory metadata from a source claiming unwarranted approval')
 if(document.pieces?.length!==4||document.seams?.length!==14||nativeTemplate?.panels?.length!==4||nativeTemplate?.seams?.length!==14)
  throw Error('Source tee cut metadata requires exactly four source panels and fourteen seams')
 const next=structuredClone(nativeTemplate)
 let allowances=0,notches=0,doubleCount=0
 for(const panel of next.panels){
  const source=document.pieces.find(p=>p.id===panel.id)
  const polygon=panel.polygon
  if(!source||!polygon||polygon.points.length!==source.points.length||
     polygon.edges.length!==source.points.length||new Set(polygon.edges).size!==polygon.edges.length)
   throw Error('Source-to-native cut metadata mismatch on '+panel.id)
  if(polygon.seam_allowances&&Object.keys(polygon.seam_allowances).length)
   throw Error('Refusing to overwrite previously authored native allowances')
  if(polygon.notches&&Object.keys(polygon.notches).length)
   throw Error('Refusing to overwrite previously authored native notches')
  const sa={};const marked={}
  for(let i=0;i<polygon.edges.length;i++){
   const cm=getEdgeSeamAllowance(source,i)
   if(!Number.isFinite(cm)||cm<0.3||cm>4)
    throw Error(`Invalid source allowance on ${panel.id}/${i}`)
   sa[polygon.edges[i]]=cm/100
   allowances++
  }
  for(const marker of source.notches||[]){
   const edgeIndex=marker.edgeIndex
   if(!Number.isInteger(edgeIndex)||edgeIndex<0||edgeIndex>=polygon.edges.length||
      !Number.isFinite(marker.t)||marker.t<=0||marker.t>=1||
      !Number.isFinite(marker.depthCm)||marker.depthCm<0.1||marker.depthCm>1||
      !['single','double'].includes(marker.type)||
      !document.seams.some(s=>s.id===marker.matchedSeamId)||!marker.matchGroupId)
    throw Error('Unqualified source notch cannot enter native CUT: '+panel.id)
   const edge=polygon.edges[edgeIndex]
   ;(marked[edge]??=[]).push({t:marker.t,depth_m:marker.depthCm/100})
   notches++
   if(marker.type==='double')doubleCount++
  }
  polygon.seam_allowances=sa
  polygon.notches=marked
 }
 // The Rust sewline-balance audit requires matched notch STATIONS on
 // the actual sewn seam, not merely separate per-panel marks. Transfer
 // authored correspondences without changing their orientation/reversal.
 let pairedStations=0
 for(const seam of next.seams){
  const sourceSeam=document.seams.find(s=>s.id===seam.id)
  if(!sourceSeam || seam.a.panel!==sourceSeam.a?.pieceId ||
     seam.b.panel!==sourceSeam.b?.pieceId ||
     seam.a.edge!==`edge_${sourceSeam.a.edgeIndex}` ||
     seam.b.edge!==`edge_${sourceSeam.b.edgeIndex}` ||
     seam.reverse_b!==Boolean(sourceSeam.reverseB))
   throw Error('Source sewing edge IDs or orientation mismatch: '+seam.id)
  if(seam.notches?.length)throw Error('Cannot overwrite pre-authored native seam notches')
  const get=(ref)=>document.pieces.find(p=>p.id===ref.pieceId)?.notches?.filter(
   n=>n.edgeIndex===ref.edgeIndex&&n.matchedSeamId===seam.id)||[]
  const a=get(sourceSeam.a),b=get(sourceSeam.b)
  if(a.length!==b.length)throw Error('Source seam notch lacks partner: '+seam.id)
  if(a.length){
   if(a.length!==1||a[0].matchGroupId!==b[0].matchGroupId)
    throw Error('Unqualified source seam notch grouping: '+seam.id)
   seam.notches=[[a[0].t,seam.reverse_b?1-b[0].t:b[0].t]]
   pairedStations++
  }
 }
 return {template:next,applied:true,allowanceEdges:allowances,notchStations:notches,
  pairedNotchSeams:pairedStations,doubleNotchStations:doubleCount,
  limitations:['Native EdgeNotch stores physical t/depth but not EXO double-notch type; source double-notch stations require separately approved paired cut marks',
   'EXO neckline rib lacks a physically approved separate cut pattern; no factory release']}
}

import {gradeProject,buildSizeRun} from './grading.js'
import {edgeLength} from './project.js'

/** Independent sewing-notch alignment checks; no automated fit approval. */
export function inspectGradedNotchPairs(project,{sizes=project?.grading?.sizes||[],toleranceCm=0.05}={}){
 const issues=[],checks=[]
 const add=(code,scope,message)=>issues.push({severity:'blocker',code,scope,message})
 if(!project||!Array.isArray(project.pieces)||!Array.isArray(project.seams)||!Array.isArray(sizes)||!sizes.length||new Set(sizes).size!==sizes.length||!Number.isFinite(toleranceCm)||toleranceCm<0){
  add('INVALID_NOTCH_QA','Project','A valid project, ordered sizes and nonnegative tolerance are required.')
  return result()
 }
 let linkedRun=null
 if(project.modarisSizeLinkedGrade!==undefined){
  try{linkedRun=buildSizeRun(project)}catch(error){add('NOTCH_GRADING_FAILED','Project',error.message);return result()}
 }
 const groupList=new Map()
 const pieceIds=project.pieces.map(piece=>piece?.id)
 if(pieceIds.some(id=>typeof id!=='string'||!id.trim())||new Set(pieceIds).size!==pieceIds.length){
  add('AMBIGUOUS_NOTCH_PIECE_ID','Pieces','Pattern piece IDs must be unique nonempty strings before sewing-notch inspection.')
  return result()
 }
 // A matched notch identifies its sewn relationship by seam ID. If that ID
 // is duplicated, Array.find would silently choose one of several contours.
 const seamIds=project.seams.map(seam=>seam?.id).filter(id=>typeof id==='string'&&id.length>0)
 if(new Set(seamIds).size!==seamIds.length){
  add('AMBIGUOUS_NOTCH_SEAM_ID','Seams','Duplicate seam IDs make paired-notch alignment ambiguous.')
  return result()
 }
 for(const piece of project.pieces){
  const notchIds=new Set()
  for(const notch of piece.notches||[]){
   if(typeof notch?.id==='string'&&notch.id){
    if(notchIds.has(notch.id))add('AMBIGUOUS_NOTCH_ID',piece.id,`Duplicate notch ID ${notch.id} prevents unambiguous factory handoff.`)
    notchIds.add(notch.id)
   }
  if(!notch?.matchGroupId&&!notch?.matchedSeamId)continue
  if(typeof notch.id!=='string'||!notch.id.trim()){
   add('INVALID_NOTCH_ID',piece.id,'Paired sewing notches require nonempty unique IDs.');continue
  }
  if(typeof notch.matchGroupId!=='string'||!notch.matchGroupId||typeof notch.matchedSeamId!=='string'||!notch.matchedSeamId){
   add('INCOMPLETE_NOTCH_PAIR',piece.id,'A grouped notch needs both matching group and seam IDs.');continue
  }
  const array=groupList.get(notch.matchGroupId)||[]
  array.push({pieceId:piece.id,edgeIndex:notch.edgeIndex,t:notch.t,seamId:notch.matchedSeamId,notchId:notch.id})
  groupList.set(notch.matchGroupId,array)
  }
 }
 for(const [group,notches] of groupList){
  if(notches.length!==2||notches[0].seamId!==notches[1].seamId){
    add('INVALID_NOTCH_GROUP',group,'Require exactly one matching notch at each end of the same sewing relationship.');continue
  }
  const seam=project.seams.find(row=>row.id===notches[0].seamId)
  if(!seam){add('INVALID_NOTCH_SEAM',group,'Matching sewing relationship is missing.');continue}
  const same=(n,side)=>n.pieceId===side?.pieceId&&n.edgeIndex===side?.edgeIndex
  if(!((same(notches[0],seam.a)&&same(notches[1],seam.b))||(same(notches[1],seam.a)&&same(notches[0],seam.b)))){
    add('NOTCH_SEAM_REFERENCE',group,'Notch pair does not reference the selected sewn edges.');continue
  }
  if(notches.some(n=>!Number.isFinite(n.t)||n.t<0||n.t>1)){
    add('INVALID_NOTCH_FRACTION',group,'Notch seam fractions must be finite and in [0,1].');continue
  }
  for(const size of sizes){
   let graded
   try{graded=linkedRun?linkedRun[size]:gradeProject(project,size);if(!graded)throw Error('Missing authoritative linked size')}
   catch(error){add('NOTCH_GRADING_FAILED',`${group} · ${size}`,error.message);continue}
   const lookup=new Map(graded.pieces.map(piece=>[piece.id,piece]))
   const a=notches.find(notch=>same(notch,seam.a)),b=notches.find(notch=>same(notch,seam.b))
   const pa=lookup.get(a.pieceId),pb=lookup.get(b.pieceId)
   if(!pa||!pb){add('NOTCH_PIECE_MISSING',`${group} · ${size}`,'The graded piece is absent.');continue}
   const actualA=pa.notches?.find(notch=>notch.id===a.notchId),actualB=pb.notches?.find(notch=>notch.id===b.notchId)
   if(!actualA||!actualB){add('NOTCH_LOST_ON_GRADE',`${group} · ${size}`,'At least one sewing notch was lost during grading.');continue}
   if(![a,b].every(n=>Number.isInteger(n.edgeIndex)&&n.edgeIndex>=0&&n.edgeIndex<lookup.get(n.pieceId)?.points?.length)||
      actualA.edgeIndex!==a.edgeIndex||actualB.edgeIndex!==b.edgeIndex){
    add('INVALID_NOTCH_EDGE',`${group} · ${size}`,'Paired sewing notches must retain valid graded edge identities.');continue
   }
   let lenA,lenB
   try{lenA=edgeLength(pa,a.edgeIndex);lenB=edgeLength(pb,b.edgeIndex)}
   catch(error){
    add('INVALID_NOTCH_EDGE_GEOMETRY',`${group} · ${size}`,`Cannot measure physical sewing-edge arclength: ${error.message}`);continue
   }
   if(!Number.isFinite(lenA)||!Number.isFinite(lenB)||lenA<=0||lenB<=0){
    add('INVALID_NOTCH_EDGE_GEOMETRY',`${group} · ${size}`,'Paired sewing edges must have positive finite physical arclength.');continue
   }
   if(![actualA.t,actualB.t].every(t=>Number.isFinite(t)&&t>=0&&t<=1)){
    add('INVALID_GRADED_NOTCH_FRACTION',`${group} · ${size}`,'Graded sewing-notch stations must be finite arclength fractions in [0,1].');continue
   }
   const fromStartA=actualA.t*lenA,fromStartB=(seam.reverseB?1-actualB.t:actualB.t)*lenB
   const offsetCm=Math.abs(fromStartA-fromStartB)
   const pass=Number.isFinite(offsetCm)&&offsetCm<=toleranceCm
   checks.push({group,seamId:seam.id,size,fromStartAcm:fromStartA,fromStartBcm:fromStartB,offsetCm,pass})
   if(!pass)add('NOTCH_SEAM_MISALIGNMENT',`${group} · ${size}`,`Paired sewing notch arclength difference ${offsetCm.toFixed(3)} cm exceeds ${toleranceCm.toFixed(3)} cm.`)
  }
 }
 return result()
 function result(){return {status:issues.length?'blocked':'pass',blockers:issues.length,issues,checks,pairedGroups:groupList.size,checkedSizes:[...sizes],toleranceCm,factoryCertified:false}}
}

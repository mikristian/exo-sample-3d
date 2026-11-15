// Canonical EXO 4-piece Foundation Tee -> one editable six-size Rust catalog.
// Geometry and sewing IDs originate in EXO. This does NOT transfer the factory
// notches, edge allowances, techpack, or physical fabric calibration; caller
// must retain those EXO source records and fail closed on production release.
import {isDeepStrictEqual} from 'node:util'
import {gradeProject} from '../../src/core/grading.js'

export const SIX_SIZES_TEE_20261115=Object.freeze(['XS','S','M','L','XL','XXL'])
const finite2=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)
const exactIds=(array,kind)=>{
 if (!Array.isArray(array)||new Set(array.map(x=>x.id)).size!==array.length||array.some(x=>typeof x.id!=='string'||!x.id))
  throw Error(`Invalid ${kind} identities`)
 return array.map(x=>x.id)
}

export function buildSixSizeTeeNativeCatalog20261115({project,baseTemplate,exportNative}={}){
 if (!project||!baseTemplate||typeof exportNative!=='function')throw Error('EXO source, Rust template and trusted native exporter required')
 if(project.productionSpec?.approvalStatus!=='FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED')
  throw Error('Production-development tee must remain explicitly unapproved')
 const sizes=project.grading?.sizes
 if(!isDeepStrictEqual(sizes,SIX_SIZES_TEE_20261115)||project.grading?.baseSize!=='M')
  throw Error('Expected six distinct graded sizes XS–XXL with M as source')
 if(project.pieces?.length!==4||project.seams?.length!==14||baseTemplate.panels?.length!==4||baseTemplate.seams?.length!==14)
  throw Error('Expected source and Rust to have 4 panels and 14 original seams')
 const baseIds=exactIds(baseTemplate.panels,'Rust panel')
 const seamIds=exactIds(baseTemplate.seams,'Rust seam')
 if(!isDeepStrictEqual(baseIds,exactIds(project.pieces,'EXO pattern'))||
    !isDeepStrictEqual(seamIds,exactIds(project.seams,'EXO seam')))
  throw Error('Rust interop lost or reordered original EXO panel/seam identity')
 const byId=(arr,id)=>arr.find(item=>item.id===id)
 const gradedTemplates=[]
 const sourceGrades=[]
 const warnings=new Set()
 for(const size of sizes){
  const exoGrade=gradeProject(project,size)
  const interchange=exportNative(exoGrade)
  const imported=interchange?.template
  if(!imported||!isDeepStrictEqual(exactIds(imported.panels,'imported panel'),baseIds)||
     !isDeepStrictEqual(exactIds(imported.seams,'imported seam'),seamIds))
   throw Error(`Native export lost panel/seam identity for ${size}`)
  for(const warning of interchange.warnings||[])warnings.add(warning)
  const next=structuredClone(baseTemplate)
  for(const panel of next.panels){
   const source=byId(baseTemplate.panels,panel.id),target=byId(imported.panels,panel.id)
   const old=source?.polygon,newPoly=target?.polygon,poly=panel?.polygon
   if(!old||!newPoly||!poly||old.points.length!==newPoly.points.length||
      !isDeepStrictEqual(old.edges,newPoly.edges)||
      !isDeepStrictEqual(old.vertex_ids,newPoly.vertex_ids)||
      new Set(old.edges).size!==old.edges.length)
    throw Error(`${size}/${panel.id}: native pattern geometry no longer has stable IDs`)
   if(Object.keys(old.free_curve_points||{}).some(edge=>(old.free_curve_points[edge]||[]).length))
    throw Error(`${size}/${panel.id}: qualified free-curve grade translation not implemented`)
   if(newPoly.points.some(p=>!finite2(p)||p.some(n=>n<0||n>10)))
    throw Error(`${size}/${panel.id}: nonfinite or unbounded grade coordinate`)
   poly.points=structuredClone(newPoly.points)
   poly.curves=Object.fromEntries(Object.entries(old.curves||{}).map(([edge,handles])=>{
    const a=old.edges.indexOf(edge),b=(a+1)%old.points.length
    if(a<0||!Array.isArray(handles)||handles.length!==2||handles.some(h=>!finite2(h)))
     throw Error(`${size}/${panel.id}/${edge}: invalid source cubic handles`)
    const start=[0,1].map(i=>poly.points[a][i]-old.points[a][i])
    const end=[0,1].map(i=>poly.points[b][i]-old.points[b][i])
    return [edge,handles.map((h,k)=>h.map((n,i)=>n+(k===0?(2*start[i]+end[i]):(start[i]+2*end[i]))/3))]
   }))
  }
  if(size==='M'&&!isDeepStrictEqual(next,baseTemplate))
   throw Error('Native base size M does not exactly reproduce the original tee source')
  gradedTemplates.push(next)
  sourceGrades.push({size,pieces:exoGrade.pieces.length,seams:exoGrade.seams.length})
 }
 if(gradedTemplates.length!==6)throw Error('Incomplete six-size Rust catalog')
 return {
  gradeRun:{schemaVersion:1,sizes:[...sizes],baseSize:'M',baseTemplate:structuredClone(baseTemplate),gradedTemplates,pomSpecs:[]},
  sourceGrades,warnings:[...warnings].sort(),
  productionRelease:{factoryApproved:false,cuttingAuthorized:false,fitAccepted:false,
   blockers:['Requires independently approved physical fit and wash/shrink test',
    'Neckband has no approved separate cut pattern',
    'Native interop does not retain original factory notches, seam allowances or graded manufacturing metadata',
    'No independent AAMA/ASTM receiving-CAD or cutter validation',
    'Physical solver contact, strain and stability require multiframe external acceptance']}
 }
}

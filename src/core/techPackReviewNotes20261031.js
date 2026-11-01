/** Review-only comments. These never alter the garment or manufacturing record. */
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min))
export function createTechPackReviewNote(kind,x,y,id){
  if(!['comment','sticky'].includes(kind)||typeof id!=='string'||!id||id.length>100)throw new TypeError('Invalid review note')
  return {id,kind,x:clamp(x,0,760),y:clamp(y,0,770),text:'',
    status:'open',color:kind==='sticky'?'#fff0a6':'#e5eef7'}
}
export function patchTechPackReviewNote(notes,id,patch={},dimensions={width:612,height:792}){
  const safe={...patch}
  if('text'in safe)safe.text=String(safe.text??'').slice(0,2000)
  if('x'in safe)safe.x=clamp(safe.x,0,Math.max(0,dimensions.width-35))
  if('y'in safe)safe.y=clamp(safe.y,0,Math.max(0,dimensions.height-30))
  if('status'in safe&&!['open','resolved'].includes(safe.status))delete safe.status
  if('kind'in safe)delete safe.kind
  if('id'in safe)delete safe.id
  return (Array.isArray(notes)?notes:[]).map(note=>note.id===id?{...note,...safe}:note)
}

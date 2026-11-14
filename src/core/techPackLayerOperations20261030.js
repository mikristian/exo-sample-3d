// Immutable operations shared by the Tech Pack inspector and its regression
// tests. The native garment source is never modified by layer actions.
const ids=selected=>new Set(Array.isArray(selected)?selected:[])

export function toggleTechPackLayerSelection(current,id,additive=false){
  if(!id)return [...(current||[])]
  const list=Array.isArray(current)?current:[]
  return additive?(list.includes(id)?list.filter(x=>x!==id):[...list,id]):[id]
}

export function patchTechPackVectorLayer(layers,id,patch){
  return (layers||[]).map(item=>item.id===id?{...item,...patch}:item)
}

export function duplicateTechPackVectorLayer(layers,id,newId){
  const originals=layers||[]
  const original=originals.find(layer=>layer.id===id)
  if(!original||!newId||originals.some(layer=>layer.id===newId)||originals.length>=250)return null
  const copy={...original,id:newId,name:`${original.name||'Artwork'} copy`,
    x:(Number(original.x)||0)+12,y:(Number(original.y)||0)+12,locked:false}
  const index=originals.indexOf(original)
  return {layers:[...originals.slice(0,index+1),copy,...originals.slice(index+1)],selectedIds:[newId]}
}

export function reorderTechPackVectorLayers(layers,selectedIds,direction){
  if(!['up','down'].includes(direction))return [...(layers||[])]
  const next=[...(layers||[])],selected=ids(selectedIds)
  const indexes=direction==='up'?[...next.keys()].reverse():[...next.keys()]
  for(const i of indexes){
    const n=i+(direction==='up'?1:-1)
    if(n>=0&&n<next.length&&selected.has(next[i].id)&&!selected.has(next[n].id)&&!next[i].locked&&!next[n].locked)
      [next[i],next[n]]=[next[n],next[i]]
  }
  return next
}

export function deleteTechPackVectorLayers(layers,selectedIds){
  const selected=ids(selectedIds)
  const next=(layers||[]).filter(layer=>!selected.has(layer.id)||layer.locked)
  return {layers:next,selectedIds:(layers||[]).filter(layer=>layer.locked&&selected.has(layer.id)).map(layer=>layer.id)}
}

export function setTechPackLayoutLayerVisibility(workspace,pageId,id,visible){
  const hidden=new Set(workspace?.hiddenObjects?.[pageId]||[])
  if(visible)hidden.delete(id)
  else hidden.add(id)
  return {...workspace,hiddenObjects:{...workspace?.hiddenObjects,[pageId]:[...hidden]}}
}

import {MINIMAL_FRAMED_TECHPACK} from './techPackMinimalFrame20261031.js'

// Earlier insertions had a 13px inset on each edge. Upgrade only untouched
// default placement; an artist's manual move/resize always takes precedence.
export function fitUntouchedFramedBottomTables(workspace={}){
 const frame=MINIMAL_FRAMED_TECHPACK.frame
 let mutated=false
 const pageBoxes={...workspace.pageBoxes}
 for(const [pageId,boxes] of Object.entries(workspace.pageBoxes||{})){
   if(!workspace.pages?.[pageId]?.minimalFramedTemplate||!Array.isArray(boxes))continue
   const board=workspace.boardObjects?.[pageId]||{}
   pageBoxes[pageId]=boxes.map(box=>{
     // Older authored bottom tables may predate the templateRole metadata,
     // but the exact original geometry remains an unambiguous fingerprint.
     if(box.slot?.category!=='tables'||box.slot?.templateRole==='shared-header')return box
     const width=Number(box.width),height=Number(box.height)
     if(!Number.isFinite(height)||height<=0)return box
     // Both the inset-bottom and flush-bottom variants shipped with the
     // same 13px horizontal inset. The latter appears in installed saves.
     const bottom=Number(box.y)+height
     const oldDefault=Number.isFinite(Number(box.x))&&Number.isFinite(width)&&Number.isFinite(bottom)&&
       Math.abs(Number(box.x)-(frame.x+13))<.1 &&
       Math.abs(width-(frame.width-26))<.1 &&
       [frame.y+frame.height-12,frame.y+frame.height].some(edge=>Math.abs(bottom-edge)<.1)
     if(!oldDefault)return box
     const transform=board['box-'+box.id]||{}
     // Board transforms are serialized in older saves as numeric strings.
     // Unknown or malformed transforms are never proof of an untouched table.
     const customTransform=['x','y','scaleX','scaleY'].some(key=>{
       if(transform[key]===undefined)return false
       if(transform[key]===null||transform[key]===''||!Number.isFinite(Number(transform[key])))return true
       return Math.abs(Number(transform[key])-(key.startsWith('scale')?1:0))>.01
     })
     if(customTransform)return box
     mutated=true
     return {...box,x:frame.x,width:frame.width,y:frame.y+frame.height-height,
       // Legacy saved tables lacked the styling role used by the editor to
       // suppress the wrapper inset, even after their outer box was widened.
       slot:box.slot?.templateRole==='bottom-table'?box.slot:
         {...box.slot,templateRole:'bottom-table'}}
   })
 }
 return mutated?{...workspace,pageBoxes}:workspace
}

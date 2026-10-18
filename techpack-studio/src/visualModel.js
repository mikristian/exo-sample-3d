import {uid,stamp} from './model.js'

export const VISUAL_TEMPLATES=[
 {id:'atelier',name:'Atelier',detail:'Quiet editorial, warm paper'},
 {id:'factory',name:'Factory grid',detail:'Structured technical reference'},
 {id:'contrast',name:'Contrast',detail:'Bold architectural typography'}
]
export const WIDGETS=[
 {type:'header',name:'Product header',detail:'Style, season, status'},
 {type:'hero',name:'Garment technical flat',detail:'Front, back, artwork and annotations'},
 {type:'callout',name:'Callout note',detail:'Construction instruction'},
 {type:'leader',name:'Arrow / leader line',detail:'Drag the two arrow endpoints'},
 {type:'photo',name:'Image / photo',detail:'Placed library asset'},
 {type:'pom',name:'Specification grid',detail:'Live spreadsheet from measurements'},
 {type:'bom',name:'Materials table',detail:'Live BOM and supplier data'},
 {type:'swatch',name:'Colorways',detail:'Linked to approved colors'},
 {type:'text',name:'Text / heading',detail:'Editable text note'},
 {type:'cost',name:'Cost summary',detail:'Live landed-cost numbers'},
 {type:'footer',name:'Footer / issue data',detail:'Revision and factory details'}
]
const baseSize={
 header:[90,18],hero:[66,59],callout:[28,15],leader:[27,18],photo:[37,37],pom:[90,64],bom:[90,64],
 swatch:[68,24],text:[50,16],cost:[65,39],footer:[90,7]
}
export function makeWidget(type,x=5,y=22,extras={}){
 const [w,h]=baseSize[type]||[35,20]
 return {id:uid(),type,x,y,w,h,content:type==='callout'?'ADD CONSTRUCTION NOTE':type==='text'?'DESIGN REFERENCE / ADD YOUR NOTES':'',...(type==='leader'?{startX:.08,startY:.18,endX:.86,endY:.8}:{}),...extras}
}
function board(kind,title,placements){
 return {id:uid(),kind,title,widgets:placements.map(([type,x,y,w,h,extras])=>makeWidget(type,x,y,{w,h,...(extras||{})}))}
}
export function makeBoard(kind='blank'){
 switch(kind){
  case 'cover':return board('cover','01 / Style identity',[
   ['header',5,6,90,17],['hero',13,27,74,58],['footer',5,91,90,6]
  ])
  case 'technical':return board('technical','02 / Technical flat',[
   ['header',5,6,90,15],['hero',24,24,53,58],
   ['callout',4,37,23,15,{content:'RIBBING / FINISHING\nConfirm stitch construction'}],
   ['callout',73,49,23,15,{content:'BODY PANELS\nVerify sewing allowance'}],
   ['leader',22,39,15,10,{startX:.12,startY:.14,endX:.95,endY:.8}],
   ['leader',64,53,20,10,{startX:.88,startY:.17,endX:.08,endY:.72}],
   ['footer',5,92,90,6]
  ])
  case 'spec':return board('spec','03 / Measurement spec',[
   ['header',5,6,90,16],['pom',5,24,90,63],['footer',5,92,90,6]
  ])
  case 'materials':return board('materials','04 / Materials & color',[
   ['header',5,6,90,15],['bom',5,23,90,48],['swatch',5,75,90,14],['footer',5,92,90,6]
  ])
  case 'references':return board('references','05 / Reference board',[
   ['header',5,6,90,15],['photo',6,24,40,54],['photo',53,24,40,54],
   ['text',6,80,88,9,{content:'Drop library assets here for wash, trims, print and silhouette reference'}],
   ['footer',5,92,90,6]
  ])
  case 'cost':return board('cost','06 / Cost & manufacturing',[
   ['header',5,6,90,15],['cost',5,25,90,40],['text',5,68,90,18,{content:'Cost values are planning estimates. Verify quotations and sample approvals before releasing to production.'}],['footer',5,92,90,6]
  ])
  default:return board('blank','New artboard',[
   ['header',5,6,90,16],['text',7,35,80,18,{content:'New section — select a widget or drop an asset here'}],['footer',5,92,90,6]
  ])
 }
}
export function makeVisualStudio(){
 return {schemaVersion:1,orientation:'landscape',flow:'horizontal',template:'atelier',
  boards:['cover','technical','spec','materials','references','cost'].map(makeBoard),
  assets:[],comments:[],createdAt:stamp()}
}
export const getVisualStudio=pack=>pack.visualStudio?.boards?.length?pack.visualStudio:makeVisualStudio()
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))
export function moveWidget(visual,boardId,widgetId,position){
 return {...visual,boards:visual.boards.map(board=>board.id===boardId?{...board,widgets:board.widgets.map(widget=>{
  if(widget.id!==widgetId)return widget
  return {...widget,x:clamp(position.x,0,100-widget.w),y:clamp(position.y,0,100-widget.h)}
 })}:board)}
}
export function placeAsset(visual,boardId,assetId,position){
 if(!visual.assets.some(a=>a.id===assetId))return visual
 return {...visual,boards:visual.boards.map(board=>board.id===boardId?{
  ...board,widgets:[...board.widgets,makeWidget('photo',clamp(position.x,0,63),clamp(position.y,0,63),{assetId})]
 }:board)}
}
export function updateVisualWidget(visual,boardId,widgetId,changes){
 return {...visual,boards:visual.boards.map(board=>board.id===boardId?{
  ...board,widgets:board.widgets.map(widget=>widget.id===widgetId?{...widget,...changes}:widget)
 }:board)}
}

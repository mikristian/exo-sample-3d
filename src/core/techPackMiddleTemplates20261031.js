/** Sparse, editable compositions for the center of a tech pack page. */
export const TECHPACK_MIDDLE_TEMPLATES=Object.freeze([
  {id:'middle-color-details',name:'Color details',description:'Two black swatches and a generous mockup/reference image',priority:1},
  {id:'middle-photos',name:'Reference photos · 3',description:'One hero reference and two supporting images',priority:2},
  ...[1,2,3,4,6].map(count=>({id:`middle-photos-${count}`,name:`Reference photos · ${count}`,description:`${count} numbered editable image placement${count===1?'':'s'}`,priority:2})),
  {id:'middle-fabrics',name:'Fabric details',description:'Two fabric swatches with a generous material reference image',priority:3},
  {id:'middle-colors',name:'Color palette',description:'Four editable swatches with breathing room',priority:3},
  {id:'middle-fabric-palette',name:'Fabric palette',description:'Three swatches and one reference photo',priority:3},
  {id:'middle-callouts',name:'Technical drawing callouts',description:'Central technical image with four numbered arrows',priority:4},
  {id:'middle-front-back',name:'Front and back flats',description:'Balanced two-view technical illustration layout'},
  {id:'middle-detail-strip',name:'Construction detail strip',description:'One main view plus three narrow detail close-ups'},
  {id:'middle-pattern-pieces',name:'Cutting pattern pieces',description:'Six distinct pattern piece placements for grain and cut annotations'},
  {id:'middle-grade-compare',name:'Grade nest comparison',description:'Two large comparison views and an enlarged grade detail'},
  {id:'middle-measure-points',name:'Points of measure diagrams',description:'Large garment illustration beside two detail diagrams'},
  {id:'middle-sewing-steps',name:'Sequential sewing operations',description:'Four numbered image panels arranged in operation order'},
  {id:'middle-label-placement',name:'Label placement views',description:'Hero back-neck reference and two close-ups'},
  {id:'middle-artwork-scale',name:'Artwork positioning',description:'Large placement mockup and two scaled detail references'},
  {id:'middle-qc-evidence',name:'Quality inspection photos',description:'Four separate defect and approval references'},
  {id:'middle-packing-steps',name:'Packing sequence',description:'Three wide horizontal folding and packing stages'},
  {id:'middle-trim-hardware',name:'Hardware and trims',description:'Four small trim references beside one large assembly view'},
  {id:'middle-two-colorways',name:'Colorway comparison',description:'Two wide product colorway images plus swatch chips'},
  {id:'middle-material-map',name:'Material zone map',description:'Large garment material-placement view with three fabric chips'},
  {id:'middle-fit-evidence',name:'Fit review',description:'One full-body fitting photo and two fit adjustment details'},
])
const rect=(role,x,y,width,height,extra={})=>({role,x,y,width,height,...extra})
const photo=(x,y,width,height,index)=>rect('reference-photo',x,y,width,height,{number:index})
const gallery=count=>{
  if(count===1)return [photo(84,145,444,401,1)]
  if(count===2)return [photo(61,158,239,374,1),photo(312,158,239,374,2)]
  if(count===3)return [photo(61,140,302,403,1),photo(376,140,175,195,2),photo(376,348,175,195,3)]
  if(count===4)return [photo(61,141,238,193,1),photo(312,141,239,193,2),photo(61,347,238,193,3),photo(312,347,239,193,4)]
  return Array.from({length:6},(_,i)=>photo(61+(i%3)*166,150+Math.floor(i/3)*199,154,182,i+1))
}
const layouts={
  'middle-color-details':[
    rect('color-swatch',63,177,108,108,{swatchHex:'#080808',swatchLabel:'BLACK 01'}),
    rect('color-swatch',188,177,108,108,{swatchHex:'#080808',swatchLabel:'BLACK 02'}),
    photo(323,138,231,403,1),
  ],
  'middle-photos':[photo(63,143,306,391,1),photo(385,143,164,178,2),photo(385,338,164,196,3)],
  'middle-fabrics':[
    rect('fabric-swatch',63,178,110,118,{swatchLabel:'FABRIC 01'}),
    rect('fabric-swatch',190,178,110,118,{swatchLabel:'FABRIC 02'}),
    photo(325,141,227,397,1),
  ],
  'middle-colors':[
    rect('color-swatch',81,166,188,140,{swatchHex:'#101010'}),
    rect('color-swatch',343,166,188,140,{swatchHex:'#d9d9d7'}),
    rect('color-swatch',81,347,188,140,{swatchHex:'#888783'}),
    rect('color-swatch',343,347,188,140,{swatchHex:'#f1efea'}),
  ],
  'middle-fabric-palette':[
    rect('fabric-swatch',62,162,130,114),
    rect('fabric-swatch',210,162,130,114),
    rect('fabric-swatch',62,309,130,114),
    photo(358,148,194,382,1),
  ],
  // Keep the original technical illustration and arrow geometry.
  'middle-callouts':[rect('technical-drawing',141,132,330,418)],
  'middle-front-back':[photo(62,142,234,401,1),photo(315,142,234,401,2)],
  'middle-detail-strip':[photo(62,143,300,397,1),photo(382,143,168,121,2),photo(382,280,168,121,3),photo(382,417,168,123,4)],
  'middle-pattern-pieces':[photo(61,145,235,116,1),photo(312,145,237,116,2),photo(61,279,151,126,3),photo(226,279,151,126,4),photo(391,279,158,126,5),photo(61,423,488,121,6)],
  'middle-grade-compare':[photo(62,146,235,278,1),photo(313,146,236,278,2),photo(173,438,265,106,3)],
  'middle-measure-points':[photo(62,142,285,401,1),photo(366,142,184,193,2),photo(366,349,184,194,3)],
  'middle-sewing-steps':[photo(62,142,232,190,1),photo(316,142,232,190,2),photo(62,349,232,190,3),photo(316,349,232,190,4)],
  'middle-label-placement':[photo(62,143,294,393,1),photo(374,143,175,180,2),photo(374,339,175,197,3)],
  'middle-artwork-scale':[photo(62,139,305,401,1),photo(383,158,166,171,2),photo(383,346,166,171,3)],
  'middle-qc-evidence':[photo(62,143,235,186,1),photo(314,143,235,186,2),photo(62,348,235,186,3),photo(314,348,235,186,4)],
  'middle-packing-steps':[photo(73,142,465,122,1),photo(73,279,465,122,2),photo(73,416,465,122,3)],
  'middle-trim-hardware':[photo(62,142,311,398,1),photo(388,142,161,90,2),photo(388,245,161,90,3),photo(388,348,161,90,4),photo(388,451,161,89,5)],
  'middle-two-colorways':[photo(63,142,234,325,1),photo(314,142,234,325,2),rect('color-swatch',91,483,176,60,{swatchHex:'#222222'}),rect('color-swatch',344,483,176,60,{swatchHex:'#dddddd'})],
  'middle-material-map':[photo(62,142,295,394,1),rect('fabric-swatch',379,152,169,115),rect('fabric-swatch',379,285,169,115),rect('fabric-swatch',379,418,169,115)],
  'middle-fit-evidence':[photo(62,143,305,396,1),photo(384,143,164,187,2),photo(384,347,164,192,3)],
}
for(const count of [1,2,3,4,6])layouts[`middle-photos-${count}`]=gallery(count)
const arrowSpecs=[
  [[70,198],[169,219]],[[544,198],[443,226]],
  [[70,459],[172,438]],[[544,459],[443,430]],
]
const safeId=value=>typeof value==='string'&&/^[a-z\d_-]{1,80}$/i.test(value)
/** sourceAssets: keyed by semanticRole:index (or semanticRole), optionally by number. */
export function createTechPackMiddleTemplate(templateId,{pageId='custom-middle',sourceAssets={},bottomTop=591,orientation='portrait',paperSize='Letter'}={}){
  if(!Object.hasOwn(layouts,templateId))throw new RangeError('Unknown middle-page template')
  if(!safeId(pageId))throw new TypeError('Invalid page ID')
  if(!['portrait','landscape'].includes(orientation))throw new RangeError('Invalid orientation')
  if(!['Letter','A4'].includes(paperSize))throw new RangeError('Invalid paper size')
  if(!Number.isFinite(bottomTop)||bottomTop<200)throw new RangeError('Invalid bottom table top')
  const landscape=orientation==='landscape'
  const pageSize=paperSize==='A4'?
    (landscape?{width:842,height:595}:{width:595,height:842}):
    (landscape?{width:792,height:612}:{width:612,height:792})
  const originY=110
  const maxBottom=Math.max(200,Math.min(bottomTop,pageSize.height-157))
  const scaleY=Math.min(1,(maxBottom-11-originY)/(561-originY))
  const scaleX=(pageSize.width-78)/534
  const transformX=x=>39+(x-39)*scaleX
  const transformY=y=>originY+(y-originY)*scaleY
  const assets=sourceAssets&&typeof sourceAssets==='object'&&!Array.isArray(sourceAssets)?sourceAssets:{}
  const pageBoxes=layouts[templateId].map((shape,i)=>{
    const {role,number,swatchHex,swatchLabel,...geometry}=shape
    const candidate=assets[`${role}:${i}`]??assets[`photo:${number}`]??assets[role]
    const assetId=safeId(candidate)?candidate:undefined
    const contentType=role.endsWith('swatch')?'swatch':'photo'
    return {id:`middle-${pageId}-${templateId}-${i}`,positionMode:'absolute',
      ...geometry,x:transformX(geometry.x),width:geometry.width*scaleX,
      y:transformY(geometry.y),height:geometry.height*scaleY,
      semanticRole:role,roleIndex:i,referenceNumber:number,title:'',note:'',border:'dashed',
      lineColor:'#c1c5c9',slot:{category:'boxes',middleTemplateId:templateId,contentType,
        semanticRole:role,roleIndex:i,referenceNumber:number,placeholder:true,sourceLinked:false,
        ...(swatchHex?{swatchHex,swatchOverride:true}:{}),...(swatchLabel?{swatchLabel}:{})},
      ...(assetId?{assetId}:{})}
  })
  const annotations=templateId==='middle-callouts'?arrowSpecs.map((points,i)=>({
    id:`middle-${pageId}-callout-${i+1}`,type:'arrow',scope:'page',
    points:points.map(([x,y])=>[transformX(x),transformY(y)]),
    label:String(i+1),component:'',instruction:'',color:'#111111',width:2,
  })):[]
  return {templateId,pageId,pageSize,orientation,pageBoxes,annotations}
}

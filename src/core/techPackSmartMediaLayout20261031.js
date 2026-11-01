/** Deterministic, non-destructive reference galleries for framed tech pack sheets. */
const sizes={Letter:{portrait:[612,792],landscape:[792,612]},A4:{portrait:[595,842],landscape:[842,595]}}
const validId=value=>typeof value==='string'&&/^[\w-]{1,100}$/.test(value)
const intersects=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height
const referenceNumber=box=>Number(box.referenceNumber??box.slot?.referenceNumber)
const isGalleryBox=box=>box?.slot?.smartGallery===true
const stableKey=(pageId,i)=>`middle-${pageId}-smart-photo-${i}`

/** Return page geometry, with a 39pt frame margin, 110pt header, and lower tables reserved. */
export function smartMediaBounds({paperSize='Letter',orientation='portrait',bottomTop=591}={}){
  const dimensions=sizes[paperSize]?.[orientation]
  if(!dimensions)throw new RangeError('Unsupported paper size or orientation')
  if(!Number.isFinite(bottomTop)||bottomTop<200)throw new RangeError('Invalid bottom table position')
  const [width,height]=dimensions
  const bottom=Math.min(bottomTop-11,height-168)
  if(bottom<=120)throw new RangeError('No room between header and lower tables')
  return {pageSize:{width,height},x:39,y:110,width:width-78,height:bottom-110,bottom}
}

/** Compute positions for exactly 1..24 references. Existing authored objects are obstacles. */
export function computeSmartPhotoPositions(count,{obstacles=[],gap=9,...layout}={}){
  if(!Number.isInteger(count)||count<1||count>24)throw new RangeError('Photo count must be between 1 and 24')
  if(!Number.isFinite(gap)||gap<0||gap>40)throw new RangeError('Invalid photo gap')
  const bounds=smartMediaBounds(layout)
  const occupied=obstacles.filter(o=>o&&[o.x,o.y,o.width,o.height].every(Number.isFinite)&&o.width>0&&o.height>0)
  let best=null
  // Search stable rectangular grids, preferring large legible images and a balanced aspect ratio.
  for(let columns=1;columns<=Math.min(24,count+4);columns++)for(let rows=1;rows<=Math.min(24,count+4);rows++){
    if(columns*rows<count)continue
    const w=(bounds.width-gap*(columns-1))/columns
    const h=(bounds.height-gap*(rows-1))/rows
    if(w<=4||h<=4)continue
    const cells=Array.from({length:columns*rows},(_,i)=>({
      x:bounds.x+(i%columns)*(w+gap),y:bounds.y+Math.floor(i/columns)*(h+gap),width:w,height:h,
    })).filter(cell=>!occupied.some(o=>intersects(cell,o)))
    if(cells.length<count)continue
    const score=Math.min(w/h,h/w)*Math.sqrt(w*h) - (columns*rows-count)*.01
    if(!best||score>best.score)best={score,cells:cells.slice(0,count)}
  }
  if(!best)throw new RangeError('Insufficient free space for requested photos')
  return best.cells
}

/**
 * Reconcile numbered photo slots. Retained slots keep content, captions, transform and IDs.
 * Reducing count returns overflow in displacedBoxes for explicit user handling.
 * Preserved manual geometry is not overwritten. Pass all other page objects as obstacles.
 */
export function reconcileSmartPhotoLayout({pageId,count,existingBoxes=[],otherBoxes=[],preserveManual=true,...layout}={}){
  if(!validId(pageId))throw new TypeError('Invalid page ID')
  if(!Array.isArray(existingBoxes)||!Array.isArray(otherBoxes))throw new TypeError('Invalid box collection')
  const ordered=[...existingBoxes].filter(isGalleryBox).sort((a,b)=>referenceNumber(a)-referenceNumber(b))
  const retained=ordered.filter(box=>Number.isInteger(referenceNumber(box))&&referenceNumber(box)>=1&&referenceNumber(box)<=count)
  const displacedBoxes=ordered.filter(box=>!retained.includes(box))
  const manual=retained.filter(b=>preserveManual&&(b.slot?.manualPlacement||b.transform||b.slot?.transform))
  const automatic=retained.filter(b=>!manual.includes(b))
  const needed=count-manual.length
  const fixed=[...otherBoxes,...existingBoxes.filter(box=>!isGalleryBox(box)),...manual]
  const positions=needed?computeSmartPhotoPositions(needed,{...layout,obstacles:fixed}):[]
  let positionIndex=0
  const result=[]
  for(let number=1;number<=count;number++){
    const before=retained.find(box=>referenceNumber(box)===number)
    if(before&&manual.includes(before)){result.push({...before});continue}
    const geometry=positions[positionIndex++]
    if(!geometry)throw new RangeError('Insufficient photo placements')
    const slot={...(before?.slot||{}),category:'boxes',middleTemplateId:'middle-photos-smart',contentType:'photo',
      semanticRole:'reference-photo',referenceNumber:number,smartGallery:true,placeholder:!before?.assetId}
    result.push({...before,id:before?.id||stableKey(pageId,number),positionMode:'absolute',
      title:before?.title||'',note:before?.note||'',border:before?.assetId?'none':'dashed',
      lineColor:before?.assetId?'transparent':'#c1c5c9',...geometry,
      semanticRole:'reference-photo',referenceNumber:number,roleIndex:number-1,slot})
  }
  return {pageId,layout:smartMediaBounds(layout),pageBoxes:result,displacedBoxes}
}

const normalize=value=>String(value??'').trim().toLowerCase()
const tagsOf=asset=>Array.isArray(asset.tags)?asset.tags.map(normalize):[]
/**
 * Assign project assets to photo and swatch slots based on explicit rules.
 * Existing asset bindings remain untouched; solid-color swatches retain swatchHex.
 * Manual placements are never moved. Assets are used at most once by default.
 */
export function assignSmartMediaAssets({pages=[],assets=[],assetTags={},rules=[],replaceAssigned=false,allowReuse=false}={}){
  if(!Array.isArray(pages)||!Array.isArray(assets)||!Array.isArray(rules))throw new TypeError('Invalid assignment inputs')
  const used=new Set(pages.flatMap(page=>(page.pageBoxes||[]).map(box=>box.assetId).filter(Boolean)))
  const assignments=[]
  const nextPages=pages.map(page=>{
    const pageRules=rules.filter(rule=>rule.pageId===page.pageId)
    const boxes=(page.pageBoxes||[]).map(box=>{
      if(!['photo','swatch'].includes(box?.slot?.contentType)||box.slot?.category==='tables')return {...box}
      if(box.assetId)return {...box}
      const candidates=assets.filter(asset=>validId(asset.id)&&(!used.has(asset.id)||allowReuse))
      const matchingRule=pageRules.find(rule=>candidates.some(asset=>matchesRule(asset,rule,box,assetTags)))
      const chosen=matchingRule&&candidates.find(asset=>matchesRule(asset,matchingRule,box,assetTags))
      if(!chosen)return {...box}
      used.add(chosen.id)
      assignments.push({pageId:page.pageId,boxId:box.id,assetId:chosen.id,ruleId:matchingRule.id??null})
      return {...box,assetId:chosen.id,slot:{...box.slot,placeholder:false,sourceLinked:true},
        ...(box.note?{}:{note:chosen.caption||''}),border:'none',lineColor:'transparent'}
    })
    return {...page,pageBoxes:boxes}
  })
  return {pages:nextPages,assignments,unassignedAssetIds:assets.filter(a=>validId(a.id)&&!used.has(a.id)).map(a=>a.id)}
}

function matchesRule(asset,rule,box,assetTags){
  if(!rule||typeof rule!=='object')return false
  if(rule.referenceNumber!=null&&rule.referenceNumber!==referenceNumber(box))return false
  if(rule.category!=null&&normalize(rule.category)!==normalize(asset.category))return false
  const tags=[...tagsOf(asset),...(Array.isArray(assetTags?.[asset.id])?assetTags[asset.id].map(normalize):[])]
  if(rule.tagsAll!=null&&(!Array.isArray(rule.tagsAll)||!rule.tagsAll.every(tag=>tags.includes(normalize(tag)))))return false
  if(rule.tagsAny!=null&&(!Array.isArray(rule.tagsAny)||!rule.tagsAny.some(tag=>tags.includes(normalize(tag)))))return false
  // Reject match-all rules; assignment always requires an explicit category or tag.
  return rule.category!=null||Array.isArray(rule.tagsAll)&&rule.tagsAll.length>0||Array.isArray(rule.tagsAny)&&rule.tagsAny.length>0
}

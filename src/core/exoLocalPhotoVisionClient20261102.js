import {nativeBridgeFetch,nativeBridgeOrigin} from './nativeWorkspaceTransport.js'
import {planExoVisionPhotoDraft20261102} from './exoVisionPhotoDesignReview20261102.js'

const FAIL=(code,reason)=>({ok:false,code,reason,manufacturingApproved:false,
  physicalFitVerified:false,measurementCalibrationVerified:false})

/** On-demand, locally encoded photo for the installed on-device vision model.
 * No external upload and no original image persisted in EXO's garment file.
 */
export async function analyzeLocalGarmentPhotoWithVision20261102(file,{
  fetchImpl=nativeBridgeFetch,origin=nativeBridgeOrigin(),maxDimension=768,
}={}){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||
     !Number.isFinite(file.size)||file.size<=0||file.size>8_000_000)
    return FAIL('INVALID_PHOTO','Select a PNG, JPEG or WebP garment reference up to 8 MB.')
  if(!origin||!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin))
    return FAIL('LOCAL_BRIDGE_UNAVAILABLE','Local EXO vision bridge is unavailable; the photo was not sent anywhere.')
  if(typeof createImageBitmap!=='function'||typeof document==='undefined'||typeof btoa!=='function')
    return FAIL('BROWSER_REQUIRED','Photo preparation requires the local browser image decoder.')
  let bitmap
  try{
    bitmap=await createImageBitmap(file)
    if(bitmap.width<32||bitmap.height<32)
      return FAIL('INVALID_DIMENSIONS','The photograph is too small for a visual reference.')
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height))
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale))
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const context=canvas.getContext('2d')
    if(!context)return FAIL('CANVAS_UNAVAILABLE','Cannot prepare the photo for the local vision model.')
    context.fillStyle='#fff';context.fillRect(0,0,width,height)
    context.drawImage(bitmap,0,0,width,height)
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.77))
    if(!blob||blob.size>2_000_000)return FAIL('PHOTO_COMPRESSION_FAILED','Photo exceeded the safe local vision image limit.')
    const buffer=new Uint8Array(await blob.arrayBuffer())
    let ascii=''
    for(let index=0;index<buffer.length;index+=8192)
      ascii+=String.fromCharCode(...buffer.subarray(index,index+8192))
    const imageBase64=btoa(ascii)
    const response=await fetchImpl(`${origin}/pattern-intelligence/v1/photo-vision`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageBase64,mimeType:'image/jpeg'}),cache:'no-store',
      signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(32_000):undefined,
    })
    const parsed=await response.json()
    return response.ok&&parsed?.ok===true?parsed:FAIL(parsed?.code||'PHOTO_VISION_UNAVAILABLE',
      parsed?.reason||'The optional local vision model could not analyze this photo.')
  }catch(error){return FAIL('PHOTO_VISION_ERROR',`Local photo interpretation could not finish: ${String(error?.message||'unknown error').slice(0,180)}`)}
  finally{bitmap?.close?.()}
}

/** Convert an uncalibrated, schema-validated image model observation into
 * reviewable text advice. User confirmation is still required before drafting.
 * Complex on-body photos deliberately DO NOT supply pattern contour geometry.
 */
export function reviewLocalPhotoVision20261102(result,{userDescription='',userTemplateId=null}={}){
  if(result?.ok!==true||result?.kind!=='photo-vision-semantic'||result?.provider!=='local-ollama'||
     result?.manufacturingApproved!==false||result?.measurementCalibrationVerified!==false||
     result?.semantic?.confidence!=='uncalibrated')
    return FAIL('INVALID_VISION_EVIDENCE','No authenticated, uncalibrated local vision evidence is available.')
  const s=result.semantic
  const family=['hoodie','zip-hoodie','t-shirt','skirt','pants','jeans'].includes(s.family)?s.family:'unknown'
  const fit=['oversized','relaxed','regular','slim','boxy','fitted'].includes(s.silhouette)?s.silhouette:null
  const color=['black','white','gray','brown','beige','cream','red','orange','yellow','green','blue','purple','pink'].includes(s.approximateColor)?s.approximateColor:null
  // Absence of a visible closure is not evidence of a pullover construction.
  const closure=['none-visible','unknown'].includes(s.visibleClosure)?null:s.visibleClosure
  const uncertainty=s.uncertainties||[]
  const semantic={family,...(fit?{fit}:{}),...(color?{color}:{}),closure,
    visibleTraits:s.silhouette==='cropped'?['cropped']:[],
    onBody:uncertainty.some(code=>['pose','occlusion','multiple-garments'].includes(code)),
    uncertainty:uncertainty.some(code=>['multiple-garments','low-resolution'].includes(code)),
    confidence:'uncalibrated',model:result.model}
  const plan=planExoVisionPhotoDraft20261102(semantic,{userDescription,userTemplateId})
  if(uncertainty.includes('multiple-garments')){
    plan.ok=false;plan.status='review_blocked';plan.readyToDraft=false
    plan.decisionBlockers=[...new Set([...plan.decisionBlockers,'Multiple garments may be present; identify one garment manually.'])]
  }
  return {...plan,kind:'review-only-local-photo-vision',model:result.model,
    modelUncalibrated:true,sourcePhotoGeometryVerified:false,
    photoVisibleTraits:semantic,uncertainties:uncertainty,
    requiresHumanConfirmation:true,readyToDraft:false,physicalFitVerified:false,manufacturingApproved:false}
}

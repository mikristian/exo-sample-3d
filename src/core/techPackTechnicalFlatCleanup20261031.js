// Opt-in, non-destructive cleanup of white paper behind raster technical flats.
// This operates on pixels; it does not convert a raster drawing into editable vector paths.
export function removeTechnicalFlatWhitePaper(image, options = {}) {
  const {width, height, data} = image || {}
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 ||
      width * height > 100_000_000 || !data || data.length !== width * height * 4) {
    throw new TypeError('Expected positive image dimensions and RGBA pixel data')
  }
  const output = new Uint8ClampedArray(data)
  if (options.enabled !== true) return {width, height, data: output, removedPixels: 0}

  // Keep the cutoff intentionally conservative: off-white stroke pixels and
  // anti-aliased contours are artwork until the author explicitly adjusts it.
  const threshold = options.threshold === undefined ? 248 : Number(options.threshold)
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
    throw new RangeError('threshold must be an integer between 0 and 255')
  }
  // Some purchased technical-flat raster previews are composited on gray
  // (or another uniform paper color). Explicit corner mode samples all four
  // corners and refuses ambiguous/mixed photo backgrounds.
  const cornerMode=options.background==='corner'
  const tolerance=options.tolerance===undefined?18:Number(options.tolerance)
  if(cornerMode&&(!Number.isInteger(tolerance)||tolerance<0||tolerance>50))
    throw new RangeError('Corner background tolerance must be 0–50')
  let cornerColor=null
  if(cornerMode){
    const corners=[0,width-1,(height-1)*width,width*height-1].map(i=>
      [output[i*4],output[i*4+1],output[i*4+2]])
    cornerColor=corners[0]
    if(corners.some(sample=>sample.some((n,k)=>Math.abs(n-cornerColor[k])>Math.min(12,tolerance))))
      throw Error('Corners are not a uniform paper color; use an image mask instead.')
  }
  const count = width * height
  const visited = new Uint8Array(count)
  const queue = new Uint32Array(count)
  let head = 0, tail = 0, removedPixels = 0
  const clearable = (i) => {
    const p = i * 4
    return output[p + 3] === 0 ||
      (output[p + 3] >= 1 && (cornerMode?
        [0,1,2].every(k=>Math.abs(output[p+k]-cornerColor[k])<=tolerance):
        output[p] >= threshold && output[p + 1] >= threshold && output[p + 2] >= threshold))
  }
  const enqueue = i => {
    if (!visited[i] && clearable(i)) { visited[i] = 1; queue[tail++] = i }
  }
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1) }
  while (head < tail) {
    const i = queue[head++]
    const p = i * 4
    if (output[p + 3] !== 0) { output[p + 3] = 0; removedPixels++ }
    const x = i % width
    if (x > 0) enqueue(i - 1)
    if (x + 1 < width) enqueue(i + 1)
    if (i >= width) enqueue(i - width)
    if (i < count - width) enqueue(i + width)
  }
  return {width, height, data: output, removedPixels}
}

// Browser adapter. Call only after explicit opt-in. Returns a separate canvas;
// neither the source image nor its original file is mutated.
export function technicalFlatTransparentCanvas(source, options = {}) {
  if (options.enabled !== true) return null
  const width = source?.naturalWidth || source?.videoWidth || source?.width
  const height = source?.naturalHeight || source?.videoHeight || source?.height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError('Source image has no valid dimensions')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', {willReadFrequently: true})
  if (!context) throw new Error('2D canvas unavailable')
  context.drawImage(source, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  const result = removeTechnicalFlatWhitePaper(pixels, options)
  pixels.data.set(result.data)
  context.putImageData(pixels, 0, 0)
  if(options.trim!==true)return {canvas,removedPixels:result.removedPixels}
  const rgba=result.data
  let minX=width,minY=height,maxX=-1,maxY=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(rgba[(y*width+x)*4+3]<=12)continue
    if(x<minX)minX=x;if(x>maxX)maxX=x
    if(y<minY)minY=y;if(y>maxY)maxY=y
  }
  if(maxX<0)throw Error('No artwork survived the background cleanup.')
  const pad=Number.isFinite(Number(options.padding))?Math.min(24,Math.max(0,Math.round(Number(options.padding)))):8
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad)
  maxX=Math.min(width-1,maxX+pad);maxY=Math.min(height-1,maxY+pad)
  if(minX===0&&minY===0&&maxX===width-1&&maxY===height-1)
    return {canvas,removedPixels:result.removedPixels}
  const cropped=document.createElement('canvas')
  cropped.width=maxX-minX+1;cropped.height=maxY-minY+1
  cropped.getContext('2d').drawImage(canvas,minX,minY,cropped.width,cropped.height,
    0,0,cropped.width,cropped.height)
  return {canvas:cropped,removedPixels:result.removedPixels}
}

// Canvas-in, new canvas-out convenience API for the Tech Pack editor.
export function removeWhiteBackdropFromCanvas(canvas, options = {}) {
  return technicalFlatTransparentCanvas(canvas, options)
}

// Data URLs are convenient for an independently stored derived PNG asset.
// Callers retain their original dataUrl separately; nothing is overwritten.
export async function prepareTechnicalFlatTransparentAsset(dataUrl, options = {}) {
  if (options.enabled !== true) return null
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) {
    throw new TypeError('Expected PNG, JPEG, or WebP image data URL')
  }
  const img = new Image()
  img.src = dataUrl
  if (typeof img.decode === 'function') await img.decode()
  else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })
  const output = technicalFlatTransparentCanvas(img, options)
  return {dataUrl: output.canvas.toDataURL('image/png'), removedPixels: output.removedPixels,
    width: output.canvas.width, height: output.canvas.height, mimeType: 'image/png'}
}

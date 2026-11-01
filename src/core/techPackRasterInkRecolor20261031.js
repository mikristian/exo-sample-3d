// Raster appearance editing for locally imported technical flats. No vector geometry is inferred.
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/]+={0,2}$/i
const clamp = value => Math.max(0, Math.min(1, value))
const smoothstep = value => { const x = clamp(value); return x*x*(3-2*x) }

function rgbColor(color, label) {
  if (color == null) return null
  if (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))
    throw new TypeError(`${label} must be a six-digit hex color`)
  return [1,3,5].map(i => parseInt(color.slice(i,i+2),16))
}

/** Pure RGBA recolor kernel. Null inkColor/fillColor preserves that region's original colors.
 * Original bytes and alpha are preserved. Pixels are classified by luminance, not SVG paths.
 * `split` is the gray midpoint and `feather` the half-width of the anti-alias transition.
 */
export function recolorTechPackRasterPixels(image, options = {}) {
  const {width,height,data} = image || {}
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width*height > 25_000_000 || !data || data.length !== width*height*4)
    throw new TypeError('Expected bounded RGBA image dimensions and pixels')
  const ink = rgbColor(options.inkColor, 'inkColor')
  const fill = rgbColor(options.fillColor, 'fillColor')
  const split = options.split === undefined ? 127.5 : Number(options.split)
  const feather = options.feather === undefined ? 127.5 : Number(options.feather)
  if (!Number.isFinite(split) || split < 0 || split > 255 || !Number.isFinite(feather) || feather < 0 || feather > 255)
    throw new RangeError('split and feather must be within 0–255')
  const result = new Uint8ClampedArray(data)
  if (!ink && !fill) return {width,height,data:result,changedPixels:0}
  let changedPixels = 0
  for (let p=0;p<result.length;p+=4) {
    if (data[p+3] === 0) continue
    const brightness = .2126*data[p] + .7152*data[p+1] + .0722*data[p+2]
    const fillWeight = feather === 0 ? (brightness >= split ? 1 : 0) :
      smoothstep((brightness-(split-feather))/(2*feather))
    const inkWeight = 1-fillWeight
    let changed = false
    for (let channel=0;channel<3;channel++) {
      const original = data[p+channel]
      const recolored = Math.round(original + (ink ? inkWeight*(ink[channel]-original) : 0) +
        (fill ? fillWeight*(fill[channel]-original) : 0))
      result[p+channel] = recolored
      if (recolored !== original) changed = true
    }
    if (changed) changedPixels++
  }
  return {width,height,data:result,changedPixels}
}

function localImageDataUrl(value) {
  if (typeof value !== 'string' || !DATA_IMAGE.test(value) || value.length > 18_000_000)
    throw new TypeError('Expected bounded local PNG, JPEG or WebP base64 data URL')
}

function loadedImage(dataUrl) {
  return new Promise((resolve,reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Cannot decode local raster image'))
    img.src = dataUrl
    if (typeof img.decode === 'function') img.decode().then(() => resolve(img), reject)
  })
}

/** Returns an independently encoded derived image and retains `originalDataUrl` for Undo/reset.
 * Compression/downsizing is only applied to the derived image when needed to fit maxBytes.
 */
export async function recolorTechPackRasterDataUrl(originalDataUrl, options = {}) {
  localImageDataUrl(originalDataUrl)
  if (options.inkColor == null && options.fillColor == null)
    return {dataUrl:originalDataUrl,originalDataUrl,changedPixels:0,unchanged:true}
  const maxBytes = options.maxBytes === undefined ? 250_000 : Number(options.maxBytes)
  if (!Number.isInteger(maxBytes) || maxBytes < 100 || maxBytes > 250_000)
    throw new RangeError('maxBytes must be between 100 and 250000')
  const image = await loadedImage(originalDataUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width*height > 25_000_000)
    throw new RangeError('Invalid or oversized local image dimensions')
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', {willReadFrequently:true})
  if (!context) throw new Error('Browser 2D canvas is unavailable')
  context.drawImage(image,0,0,width,height)
  let pixels
  try { pixels = context.getImageData(0,0,width,height) }
  catch { throw new Error('Cannot read raster source pixels') }
  const recolored = recolorTechPackRasterPixels(pixels,options)
  pixels.data.set(recolored.data)
  context.putImageData(pixels,0,0)
  let resultCanvas = canvas
  for (let attempt=0;attempt<14;attempt++) {
    for (const mimeType of ['image/png','image/webp']) {
      const dataUrl = resultCanvas.toDataURL(mimeType, .88)
      if (!dataUrl.startsWith(`data:${mimeType};`)) continue
      const byteLength = Math.ceil((dataUrl.length-dataUrl.indexOf(',')-1)*3/4)
      if (byteLength <= maxBytes)
        return {dataUrl,originalDataUrl,width:resultCanvas.width,height:resultCanvas.height,
          changedPixels:recolored.changedPixels,mimeType,unchanged:false,downsampled:resultCanvas!==canvas}
    }
    if (resultCanvas.width === 1 && resultCanvas.height === 1) break
    const smaller = document.createElement('canvas')
    smaller.width = Math.max(1,Math.floor(resultCanvas.width*.75))
    smaller.height = Math.max(1,Math.floor(resultCanvas.height*.75))
    const ctx = smaller.getContext('2d')
    if (!ctx) throw new Error('Browser 2D canvas is unavailable')
    ctx.drawImage(resultCanvas,0,0,smaller.width,smaller.height)
    resultCanvas = smaller
  }
  throw new RangeError('Recolored raster cannot fit within maxBytes')
}

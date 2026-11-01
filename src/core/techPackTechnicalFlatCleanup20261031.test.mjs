import test from 'node:test'
import assert from 'node:assert/strict'
import {removeTechnicalFlatWhitePaper, technicalFlatTransparentCanvas} from './techPackTechnicalFlatCleanup20261031.js'

const pixels = (rows) => {
  const palette = {W:[255,255,255,255],K:[0,0,0,255],R:[240,45,45,255],I:[255,255,255,255],T:[255,255,255,0],G:[240,240,240,255]}
  return {width:rows[0].length,height:rows.length,data:new Uint8ClampedArray(rows.flatMap(row => [...row].flatMap(c => palette[c])))}
}
const alphaAt = (image, x, y) => image.data[(y * image.width + x) * 4 + 3]

test('connected paper is removed; enclosed interior white and colored seams survive', () => {
  const original = pixels(['WWWWWWW','WKKKKKW','WKIIIKW','WKIRIKW','WKIIIKW','WKKKKKW','WWWWWWW'])
  const snapshot = original.data.slice()
  const result = removeTechnicalFlatWhitePaper(original, {enabled:true})
  assert.equal(alphaAt(result,0,0),0)
  assert.equal(alphaAt(result,3,2),255)
  assert.equal(alphaAt(result,3,3),255)
  assert.equal(alphaAt(result,1,2),255)
  assert.deepEqual(original.data,snapshot)
  assert.equal(result.removedPixels,24)
})

test('four-neighbor connectivity prevents diagonal bleed through corners', () => {
  const result = removeTechnicalFlatWhitePaper(pixels(['WKK','KWK','KKK']),{enabled:true})
  assert.equal(alphaAt(result,0,0),0)
  assert.equal(alphaAt(result,1,1),255)
})

test('near-white antialiased gray strokes remain and existing alpha is retained', () => {
  const src = pixels(['WWWWW','WGKTW','WWWWW'])
  const result = removeTechnicalFlatWhitePaper(src,{enabled:true})
  assert.equal(alphaAt(result,1,1),255)
  assert.equal(alphaAt(result,2,1),255)
  assert.equal(alphaAt(result,3,1),0)
})

test('opt-in is required and invalid image/threshold values are rejected', () => {
  const src = pixels(['WW','WK'])
  assert.equal(removeTechnicalFlatWhitePaper(src).removedPixels,0)
  assert.equal(alphaAt(removeTechnicalFlatWhitePaper(src),0,0),255)
  assert.equal(technicalFlatTransparentCanvas(src),null)
  assert.throws(() => removeTechnicalFlatWhitePaper(src,{enabled:true,threshold:300}),RangeError)
  assert.throws(() => removeTechnicalFlatWhitePaper({width:2,height:2,data:[1]}),TypeError)
})
test('uniform gray preview backdrop can be removed without deleting garment white fill',()=>{
  const w=6,h=5,data=new Uint8ClampedArray(w*h*4)
  for(let i=0;i<w*h;i++)data.set([96,96,96,255],i*4)
  for(let y=1;y<4;y++)for(let x=1;x<5;x++)data.set([240,240,240,255],(y*w+x)*4)
  for(let x=1;x<5;x++){data.set([12,12,12,255],(1*w+x)*4);data.set([12,12,12,255],(3*w+x)*4)}
  for(let y=1;y<4;y++){data.set([12,12,12,255],(y*w+1)*4);data.set([12,12,12,255],(y*w+4)*4)}
  const r=removeTechnicalFlatWhitePaper({width:w,height:h,data},{enabled:true,background:'corner'})
  assert.equal(r.data[3],0)
  assert.equal(r.data[(2*w+2)*4+3],255)
  assert.ok(r.removedPixels>0)
  const mismatched=new Uint8ClampedArray(data);mismatched.set([12,220,90,255],0)
  assert.throws(()=>removeTechnicalFlatWhitePaper({width:w,height:h,data:mismatched},{enabled:true,background:'corner'}),/Corners/)
})

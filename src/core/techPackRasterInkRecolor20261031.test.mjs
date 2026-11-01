import test from 'node:test'
import assert from 'node:assert/strict'
import {recolorTechPackRasterPixels,recolorTechPackRasterDataUrl} from './techPackRasterInkRecolor20261031.js'

const pixel = (...rgba) => ({width:1,height:1,data:new Uint8ClampedArray(rgba)})

test('dark stroke recolors while light fill remains original; source and alpha preserved', () => {
  const source = {width:2,height:1,data:new Uint8ClampedArray([0,0,0,98,255,255,255,224])}
  const result = recolorTechPackRasterPixels(source,{inkColor:'#ff0000'})
  assert.deepEqual([...result.data],[255,0,0,98,255,255,255,224])
  assert.deepEqual([...source.data],[0,0,0,98,255,255,255,224])
})

test('white garment recolors independently while solid line remains black', () => {
  assert.deepEqual([...recolorTechPackRasterPixels({width:2,height:1,
    data:new Uint8Array([0,0,0,255,255,255,255,255])},{fillColor:'#12aabb'}).data],
    [0,0,0,255,18,170,187,255])
})

test('gray antialias pixels blend smoothly, retain alpha and transparent pixels untouched', () => {
  const source={width:3,height:1,data:new Uint8Array([128,128,128,80,64,64,64,200,3,4,5,0])}
  const result=recolorTechPackRasterPixels(source,{inkColor:'#0000ff',fillColor:'#ff0000'})
  assert.deepEqual([...result.data.slice(0,4)],[128,0,127,80])
  assert.equal(result.data[4]>0,true)
  assert.equal(result.data[6]>result.data[4],true)
  assert.deepEqual([...result.data.slice(8,12)],[3,4,5,0])
})

test('no-edit returns copied pixels; validation rejects malformed dimensions, colors and thresholds', () => {
  const source=pixel(42,55,89,111)
  const result=recolorTechPackRasterPixels(source)
  assert.deepEqual([...result.data],[42,55,89,111])
  assert.notStrictEqual(result.data,source.data)
  assert.throws(()=>recolorTechPackRasterPixels({width:2,height:1,data:new Uint8Array(4)}),/RGBA/)
  assert.throws(()=>recolorTechPackRasterPixels(source,{inkColor:'red'}),/hex/)
  assert.throws(()=>recolorTechPackRasterPixels(source,{feather:-1}),/split and feather/)
  assert.deepEqual([...recolorTechPackRasterPixels(pixel(127,127,127,255),
    {inkColor:'#000000',fillColor:'#ffffff',split:127,feather:0}).data],[255,255,255,255])
})

test('local data URL unchanged route requires no DOM and preserves original', async () => {
  const source='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  const result=await recolorTechPackRasterDataUrl(source)
  assert.equal(result.dataUrl,source)
  assert.equal(result.unchanged,true)
  await assert.rejects(()=>recolorTechPackRasterDataUrl('https://remote.test/image.png'),/local/)
  await assert.rejects(()=>recolorTechPackRasterDataUrl('data:image/svg+xml;base64,PHN2Zz4='),/local/)
})

test('browser canvas adapter: local pixels encode derived PNG without modifying source', async (t) => {
  const oldDocument=globalThis.document, oldImage=globalThis.Image
  class MockCanvas {
    width=0; height=0; data=null
    getContext(){return {
      drawImage:()=>{this.data=new Uint8ClampedArray([0,0,0,125,255,255,255,255])},
      getImageData:()=>({width:this.width,height:this.height,data:new Uint8ClampedArray(this.data)}),
      putImageData:frame=>{this.data=new Uint8ClampedArray(frame.data)}
    }}
    toDataURL(mime){return `data:${mime};base64,${Buffer.from(this.data).toString('base64')}`}
  }
  globalThis.document={createElement:()=>new MockCanvas()}
  globalThis.Image=class {naturalWidth=2;naturalHeight=1;decode(){return Promise.resolve()}set src(value){this.source=value}}
  t.after(()=>{globalThis.document=oldDocument;globalThis.Image=oldImage})
  const original='data:image/png;base64,YWJj'
  const result=await recolorTechPackRasterDataUrl(original,{inkColor:'#ff0000',fillColor:'#00ff00'})
  assert.equal(result.originalDataUrl,original)
  assert.equal(result.dataUrl.startsWith('data:image/png;base64,'),true)
  assert.deepEqual([...Buffer.from(result.dataUrl.split(',')[1],'base64')],[255,0,0,125,0,255,0,255])
  assert.equal(result.changedPixels,2)
  await assert.rejects(()=>recolorTechPackRasterDataUrl(original,{inkColor:'#123456',maxBytes:99}),/maxBytes/)
})

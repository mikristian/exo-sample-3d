import test from 'node:test'
import assert from 'node:assert/strict'
import {createPrintPdf20261025,planPrintPages20261025,printPieces20261025} from './printLayout20261025.js'

const garment={pieces:[{id:'front',name:'Front',fabricId:'cotton',points:[{x:0,y:0},{x:18,y:0},{x:18,y:30},{x:0,y:30}]}]}
const pieces=printPieces20261025(garment)
const placements={front:{x:1,y:2}}
const decode=bytes=>new TextDecoder().decode(bytes)

test('Print Layout PDF starts with a physical 100 by 100 mm calibration sheet when requested',()=>{
  for(const paper of ['A4','Letter'])for(const scale of [50,100,150]){
    const plan=planPrintPages20261025({widthCm:30,heightCm:50,paper,scale})
    const pdf=decode(createPrintPdf20261025({pieces,placements,plan,includeCalibrationPage:true}))
    assert.equal((pdf.match(/\/Type \/Page \/Parent/g)||[]).length,plan.pages.length+1)
    assert.match(pdf,/\(100 x 100 mm actual-size calibration - measure X and Y\)/)
    assert.match(pdf,/\b10 10 re S\b/)
    assert.match(pdf,/\b1\.2 12\.1 m 11\.2 12\.1 l S\b/)
    assert.match(pdf,/\b12 1\.8 m 12 11\.8 l S\b/)
    assert.equal((pdf.match(/h S/g)||[]).length,plan.pages.length)
    const firstCalibration=pdf.indexOf('100 x 100 mm actual-size calibration')
    const firstPattern=pdf.indexOf('0.035 w')>=0?pdf.indexOf('0.035 w'):pdf.indexOf('.035 w',firstCalibration+40)
    assert(firstCalibration>=0&&firstPattern>firstCalibration,'calibration sheet should precede pattern content')
    const startxref=Number(pdf.match(/startxref\n(\d+)\n%%EOF/)[1])
    assert.equal(pdf.slice(startxref,startxref+5),'xref\n')
    const offsets=[...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map(match=>Number(match[1]))
    for(let i=0;i<offsets.length;i++)assert(pdf.slice(offsets[i]).startsWith(`${i+1} 0 obj\n`))
    assert.deepEqual(createPrintPdf20261025({pieces,placements,plan,includeCalibrationPage:true}),new TextEncoder().encode(pdf))
  }
})

test('calibration sheet fails clearly when custom paper cannot fit an actual 100 mm square',()=>{
  const plan=planPrintPages20261025({widthCm:5,heightCm:5,paper:'Custom',customWidthCm:8,customHeightCm:12})
  assert.throws(()=>createPrintPdf20261025({pieces,placements,plan,includeCalibrationPage:true}),/100 mm calibration.*paper/i)
  assert.equal((decode(createPrintPdf20261025({pieces,placements,plan})).match(/\/Type \/Page \/Parent/g)||[]).length,plan.pages.length)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {createModarisSizeLinkedGrade} from './modarisSizeLinkedGrade20261027.js'
import {buildModarisConnectedDevelopmentZip20261101} from './modarisConnectedDevelopmentPackage20261101.js'
import {sha256Bytes} from './sha256Bytes.js'
import {inspectConnectedDevelopmentZip20261101 as inspect} from './modarisConnectedDevelopmentReceiver20261101.js'

const sizes=['S','M','L']
function linked(gradeSizes=sizes,customize=()=>{}){
  const rule={mode:'small-large-incremental',sizes:gradeSizes,baseSize:'M',
    steps:gradeSizes.slice(1).map(()=>({dx:.1,dy:0}))}
  const project=createTeeTemplate()
  const piece=id=>({...structuredClone(project.pieces[0]),id,name:id,
    points:[[0,0],[20,0],[20,16],[0,16]].map(([x,y],i)=>({id:`p${i}`,x,y,industrialGradeRule:structuredClone(rule)})),
    curves:{0:{cx:10,cy:-4}},edgeNames:['neck','side','hem','fold'],notches:[],internalLines:[],
    edgeSeamAllowances:{},seamAllowance:1,cutQuantity:1})
  project.pieces=[piece('front'),piece('back')]
  project.seams=[];project.customMeasurements=[];project.grading={sizes:gradeSizes,baseSize:'M'}
  customize(project)
  return createModarisSizeLinkedGrade(project,[{source:{pieceId:'front',pointIndex:0},
    target:{pieceId:'back',pointIndex:0},axis:'both',curves:true}]).project
}

const source=linked()
const actualZip=buildModarisConnectedDevelopmentZip20261101(source)
const actualFiles=unzipSync(actualZip)
const cloneFiles=()=>Object.fromEntries(Object.entries(actualFiles).map(([name,bytes])=>[name,bytes.slice()]))
const decode=bytes=>JSON.parse(strFromU8(bytes))
const encode=value=>strToU8(JSON.stringify(value,null,2))
function mutate(path,change,{rehash=false,from=actualZip}={}){
  const files=from===actualZip?cloneFiles():Object.fromEntries(
    Object.entries(unzipSync(from)).map(([name,bytes])=>[name,bytes.slice()]))
  files[path]=change(files[path])
  if(rehash){
    const manifest=decode(files['manifest.json'])
    manifest.sha256[path]=sha256Bytes(files[path])
    files['manifest.json']=encode(manifest)
  }
  return zipSync(files)
}
const mutateJSON=(path,edit,options)=>mutate(path,bytes=>{
  const value=decode(bytes)
  edit(value)
  return encode(value)
},options)
const rejected=(bytes,reason)=>assert.throws(()=>inspect(bytes),reason)

test('standalone receiver reads an actual ZIP on disk in a different Node process, then fails on tampering',()=>{
  const directory=mkdtempSync(join(tmpdir(),'exo-connected-receiver-'))
  try{
    const filename=join(directory,'source-linked-review.zip')
    const script=fileURLToPath(new URL('../../scripts/qa-modaris-connected-development-receiver-20261101.mjs',import.meta.url))
    writeFileSync(filename,actualZip)
    const result=spawnSync(process.execPath,[script,filename],{encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    assert.deepEqual(JSON.parse(result.stdout).sizes,sizes)
    assert.equal(JSON.parse(result.stdout).factoryApproved,false)
    writeFileSync(filename,mutate('patterns/M.dxf',bytes=>strToU8(strFromU8(bytes).replace('CUT_FRONT_M','CUT_FAKE_M'))))
    const refused=spawnSync(process.execPath,[script,filename],{encoding:'utf8'})
    assert.equal(refused.status,1)
    assert.match(refused.stderr,/REFUSED.*digest mismatch/)
  }finally{
    rmSync(directory,{recursive:true,force:true})
  }
})

test('real generated ZIP receives with expected file, size and physical CUT inventory, without mutation',()=>{
  const before=actualZip.slice()
  const received=inspect(actualZip)
  assert.equal(received.ok,true)
  assert.equal(received.factoryCertified,false)
  assert.equal(received.filesVerified,Object.keys(actualFiles).length)
  assert.deepEqual(received.sizes,sizes)
  assert.deepEqual(received.checks,sizes.map(size=>({size,cutCount:source.pieces.length})))
  assert.deepEqual(actualZip,before)
  assert.match(received.note,/no licensed CAD or physical verification/i)
})

test('six linked production sizes receive all physical CUT contours and all marker artifacts',()=>{
  const six=['XS','S','M','L','XL','XXL']
  const zip=buildModarisConnectedDevelopmentZip20261101(linked(six))
  const receipt=inspect(zip)
  assert.equal(receipt.ok,true)
  assert.equal(receipt.factoryCertified,false)
  assert.deepEqual(receipt.sizes,six)
  assert.deepEqual(receipt.checks,six.map(size=>({size,cutCount:2})))
  assert.equal(receipt.filesVerified,40)
})

test('full four-piece Foundation Tee receives six sizes with authored notches, curves and seams',()=>{
  const template=createTeeTemplate()
  const gradeSizes=template.grading.sizes
  const rule={mode:'small-large-incremental',sizes:gradeSizes,
    baseSize:template.grading.baseSize,
    steps:gradeSizes.slice(1).map(()=>({dx:.03,dy:.02}))}
  for(const piece of template.pieces)for(const point of piece.points)
    point.industrialGradeRule=structuredClone(rule)
  const linkedSource=createModarisSizeLinkedGrade(template,[{
    source:{pieceId:'front',pointIndex:0},
    target:{pieceId:'back',pointIndex:0},axis:'both',curves:true,
  }]).project
  const bytes=buildModarisConnectedDevelopmentZip20261101(linkedSource)
  const receipt=inspect(bytes)
  assert.equal(receipt.ok,true)
  assert.equal(receipt.factoryCertified,false)
  assert.equal(receipt.filesVerified,40)
  assert.deepEqual(receipt.sizes,gradeSizes)
  assert.ok(receipt.checks.every(row=>row.cutCount===4))
  const files=unzipSync(bytes)
  for(const size of gradeSizes){
    const dxf=strFromU8(files[`patterns/${size}.dxf`])
    assert.match(dxf,/NOTCH_FRONT/)
    assert.match(dxf,/STITCH_FRONT/)
    assert.match(dxf,/CUT_LEFT_SLEEVE/)
  }
  rejected(mutate('patterns/M.dxf',blob=>{
    const original=strFromU8(blob)
    assert.match(original,/NOTCH_FRONT/)
    return strToU8(original.replace('NOTCH_FRONT','NOTCH_FRAUD'))
  },{rehash:true,from:bytes}),/DXF authored NOTCH inventory mismatch|unsafe DXF/)
  const shiftedNotch=mutate('patterns/M.dxf',blob=>{
    const original=strFromU8(blob)
    const match=/(\n0\nLINE\n8\nNOTCH_FRONT\n10\n)([-+\d.eE]+)/
    assert.match(original,match)
    return strToU8(original.replace(match,(_,before,x)=>before+(Number(x)+125)))
  },{rehash:true,from:bytes})
  rejected(shiftedNotch,/NOTCH.*geometry|NOTCH.*mismatch/i)
})

test('independent receiver supports multiple marker fabrics and cut quantities',()=>{
  const project=linked(sizes,p=>{
    p.pieces[0].cutQuantity=2
    p.pieces[1].fabricId='lining'
  })
  const zipped=buildModarisConnectedDevelopmentZip20261101(project)
  const receipt=inspect(zipped)
  assert.equal(receipt.ok,true)
  assert.deepEqual(receipt.sizes,sizes)
  const files=unzipSync(zipped)
  for(const size of sizes){
    assert.ok(files[`markers/${size}/main.svg`])
    assert.ok(files[`markers/${size}/lining.svg`])
    assert.ok(files[`markers/${size}/main.pdf`])
    assert.ok(files[`markers/${size}/lining.pdf`])
  }
})

test('multi-page print receiver verifies physical page stations and PDF cut paths',()=>{
  const project=linked(sizes,p=>{
    p.markerSettings={fabricWidthCm:26,gapCm:1.5}
    p.pieces[0].cutQuantity=25
  })
  const zip=buildModarisConnectedDevelopmentZip20261101(project)
  const files=unzipSync(zip)
  const pdf=strFromU8(files['markers/M/main.pdf'])
  assert.equal((pdf.match(/\/Type \/Page\b/g)||[]).length,2)
  assert.equal(inspect(zip).ok,true)
  rejected(mutate('markers/M/main.pdf',bytes=>{
    const text=strFromU8(bytes)
    const match=/\n(\d+) ([\d.]+) m\n/.exec(text)
    assert.ok(match)
    const modifiedX=match[1].replace(/\d/,d=>d==='9'?'8':'9')
    const changed=text.replace(match[0],`\n${modifiedX} ${match[2]} m\n`)
    assert.equal(changed.length,text.length)
    return strToU8(changed)
  },{rehash:true,from:zip}),/PDF.*(cutting path|digital plot mismatch)/i)
})

test('mutated DXF bytes cannot pass unchanged SHA-256 manifest',()=>{
  rejected(mutate('patterns/M.dxf',bytes=>strToU8(strFromU8(bytes).replace('CUT_FRONT_M','CUT_FAKE_M'))),
    /byte digest mismatch: patterns\/M\.dxf/)
})

test('modified manifest digest cannot authorize original bytes',()=>{
  const files=cloneFiles(),manifest=decode(files['manifest.json'])
  manifest.sha256['patterns/M.dxf']='0'.repeat(64)
  files['manifest.json']=encode(manifest)
  rejected(zipSync(files),/byte digest mismatch/)
})

test('deleted manifest/graded file and regenerated incomplete manifest are refused',()=>{
  for(const path of ['manifest.json','source/linked-size-run.json','patterns/L.dxf','qa/geometry.json']){
    const files=cloneFiles();delete files[path]
    rejected(zipSync(files),/missing|inventory mismatch/)
  }
  const files=cloneFiles()
  delete files['patterns/S.dxf']
  const manifest=decode(files['manifest.json'])
  delete manifest.sha256['patterns/S.dxf']
  manifest.files=Object.keys(files).sort()
  files['manifest.json']=encode(manifest)
  rejected(zipSync(files),/missing patterns\/S\.dxf/)
})

test('invalid manifest JSON, duplicated manifest listing and wrong hash names refuse',()=>{
  rejected(mutate('manifest.json',()=>strToU8('{invalid')),/invalid JSON: manifest/)
  rejected(mutateJSON('manifest.json',m=>m.files.push('patterns/M.dxf')),/manifest inventory mismatch/)
  rejected(mutateJSON('manifest.json',m=>{delete m.sha256['patterns/M.dxf']}),/hash inventory mismatch/)
  rejected(mutateJSON('manifest.json',m=>{m.sha256['patterns/M.dxf']='NOT_SHA256'}),/byte digest mismatch/)
})

test('duplicate-key JSON manifests, status and source documents fail canonical receipt',()=>{
  rejected(mutate('manifest.json',bytes=>strToU8(strFromU8(bytes).replace(
    '"factoryCertified": false,','"factoryCertified": true,\n  "factoryCertified": false,'))),
    /noncanonical JSON/)
  rejected(mutate('review-status.json',bytes=>strToU8(strFromU8(bytes).replace(
    '"factoryCertified": false,','"factoryCertified": true,\n  "factoryCertified": false,'))),
    /noncanonical JSON/)
  rejected(mutateJSON('source/garment-source.json',p=>{
    Object.defineProperty(p,'__proto__',{value:{polluted:true},enumerable:true,configurable:true})
  },{rehash:true}),/invalid JSON/)
})

test('development-only release cannot be elevated even after replacing status hash',()=>{
  for(const edit of [
    v=>v.factoryCertified=true,
    v=>v.releaseStatus='APPROVED_FOR_FACTORY',
    v=>v.format='different',
    v=>v.requiredExternalChecks=[],
    v=>v.checks[0].factoryCertified=true,
    v=>v.checks[0].internalGeometryCheck='untested',
    v=>v.checks[0].cutContourCount=0,
    v=>v.checks.reverse(),
  ]){
    rejected(mutateJSON('review-status.json',edit,{rehash:true}),/release status|review|restrictions/)
  }
  rejected(mutateJSON('manifest.json',v=>{v.factoryCertified=true}),/release status/)
})

test('embedded QA cannot claim factory approval even with consistent hash',()=>{
  for(const path of ['qa/industrial.json','qa/cutlines.json','qa/notches.json','qa/geometry.json',
    'qa/marker-dxf-parity.json','qa/marker-plot-parity.json']){
    rejected(mutateJSON(path,v=>{v.factoryCertified=true},{rehash:true}),/unsafe QA release flag/)
  }
})

test('stale source, disconnected run, missing grades and invalid size names fail even with freshly computed hashes',()=>{
  rejected(mutateJSON('source/garment-source.json',p=>{
    p.modarisSizeLinkedGrade.links[0].sourceBase.x+=2
  },{rehash:true}),/stale or invalid linked source/)
  rejected(mutateJSON('source/linked-size-run.json',r=>{r.M.pieces[0].points[0].x+=3},{rehash:true}),
    /linked size run does not agree/)
  rejected(mutateJSON('source/linked-size-run.json',r=>{delete r.S},{rehash:true}),
    /incomplete connected source or run/)
  rejected(mutateJSON('source/garment-source.json',p=>{p.grading.sizes[0]='../bad'},{rehash:true}),
    /invalid source size names/)
  rejected(mutateJSON('source/garment-source.json',p=>{p.pieces[1].id=p.pieces[0].id},{rehash:true}),
    /invalid source piece identities|stale or invalid/)
})

test('untrusted linked cut quantities are bounded before allocating marker demand arrays',()=>{
  for(const demand of [0,-1,1.2,100,1_000_000_000]){
    rejected(mutateJSON('source/linked-size-run.json',run=>{
      run.M.pieces[0].cutQuantity=demand
    },{rehash:true}),/invalid linked run cut quantity/)
  }
})

test('DXF geometry remains checked after attacker recomputes archive SHA-256',()=>{
  const changed=mutate('patterns/M.dxf',bytes=>{
    const original=strFromU8(bytes)
    const match=/(\n0\nVERTEX\n8\nCUT_FRONT_M\n10\n)([-+\d.eE]+)/
    assert.match(original,match)
    return strToU8(original.replace(match,(_,head,n)=>head+(Number(n)+5)))
  },{rehash:true})
  rejected(changed,/DXF CUT geometry differs from graded source|unsafe DXF/)
})

test('DXF must retain millimetre units and unique matching project/size metadata',()=>{
  for(const edit of [
    d=>d.replace('$INSUNITS\n70\n4','$INSUNITS\n70\n1'),
    d=>d.replace('GARMENT_STUDIO_SIZE M','GARMENT_STUDIO_SIZE L'),
    d=>d.replace('GARMENT_STUDIO_PROJECT '+source.id,'GARMENT_STUDIO_PROJECT invalid-project'),
    d=>d.replace('GARMENT_STUDIO_SIZE M','GARMENT_STUDIO_SIZE M\n999\nGARMENT_STUDIO_SIZE M'),
    d=>d.replace(/\n0\nEOF\s*$/,''),
  ]){
    rejected(mutate('patterns/M.dxf',bytes=>strToU8(edit(strFromU8(bytes))),{rehash:true}),
      /DXF|CUT/)
  }
})

test('DXF complexity is refused before quadratic CUT polygon validation',()=>{
  const manyVertices='0\nVERTEX\n8\nCUT_FRONT_M\n10\n1\n20\n2\n30\n0\n'.repeat(2100)
  const changed=mutate('patterns/M.dxf',bytes=>{
    const original=strFromU8(bytes)
    return strToU8(original.replace(
      '0\nPOLYLINE\n8\nCUT_FRONT_M\n66\n1\n70\n1\n',
      '0\nPOLYLINE\n8\nCUT_FRONT_M\n66\n1\n70\n1\n'+manyVertices))
  },{rehash:true})
  rejected(changed,/DXF physical CUT exceeds bounded vertex budget/)
})

test('rehashed STITCH geometry, entity semantics and layer substitutions fail independently of CUT inventory',()=>{
  const changed=edit=>mutate('patterns/M.dxf',bytes=>strToU8(edit(strFromU8(bytes))),{rehash:true})
  rejected(changed(dxf=>dxf.replace('STITCH_FRONT','STITCH_FRAUD')),
    /DXF STITCH inventory mismatch|missing DXF STITCH|unsupported DXF STITCH vertex geometry/)
  rejected(changed(dxf=>{
    const match=/(\n0\nVERTEX\n8\nSTITCH_FRONT\n10\n)([-+\d.eE]+)/
    assert.match(dxf,match)
    return dxf.replace(match,(_,head,n)=>head+(Number(n)+10))
  }),/DXF STITCH geometry differs from graded source/)
  rejected(changed(dxf=>dxf.replace(
    '0\nPOLYLINE\n8\nSTITCH_FRONT\n66\n1\n70\n1\n',
    '0\nPOLYLINE\n8\nSTITCH_FRONT\n66\n1\n70\n5\n')),
    /invalid duplicate\/open DXF STITCH/)
  rejected(changed(dxf=>dxf.replace(
    '0\nVERTEX\n8\nSTITCH_FRONT\n',
    '0\nVERTEX\n8\nSTITCH_FRONT\n42\n0.25\n')),
    /unsupported DXF STITCH vertex geometry|Unsupported DXF bulge/)
})

test('rehashed but malformed marker SVG/PDF and active SVG content fail receipt',()=>{
  rejected(mutate('markers/M/main.svg',()=>strToU8('<svg/>'),{rehash:true}),
    /unsafe or malformed marker SVG/)
  rejected(mutate('markers/M/main.svg',bytes=>strToU8(strFromU8(bytes).replace('</svg>',
    '<script>alert(1)</script></svg>')),{rehash:true}),/unsafe or malformed marker SVG/)
  rejected(mutate('markers/M/main.svg',bytes=>strToU8(strFromU8(bytes).replace('<svg ',
    '<svg onmouseover="alert(1)" ')),{rehash:true}),/unsafe or malformed marker SVG/)
  rejected(mutate('markers/M/main.svg',bytes=>strToU8(strFromU8(bytes).replace(
    /<polygon\b[^>]*\/>/,'<circle cx="1" cy="2" r="3"/>')),{rehash:true}),
    /unsupported marker SVG element|polygon inventory mismatch/)
  rejected(mutate('markers/M/main.pdf',()=>strToU8('not a pdf'),{rehash:true}),
    /invalid marker PDF envelope/)
  rejected(mutate('markers/M/main.svg',bytes=>{
    const svg=strFromU8(bytes)
    const changed=svg.replace(/(<polygon\b[^>]*\bpoints=")(-?[\d.]+),(-?[\d.]+)/,
      (_,prefix,x,y)=>prefix+(Number(x)+1.25)+','+y)
    assert.notEqual(changed,svg)
    return strToU8(changed)
  },{rehash:true}),/marker SVG.*(geometry|contour).*mismatch/)
})

test('marker SVG rejects rehashed physical placement overlaps and falsified fabric widths',()=>{
  rejected(mutate('markers/M/main.svg',bytes=>{
    const svg=strFromU8(bytes)
    const polygons=[...svg.matchAll(/(<polygon\b[^>]*points=")([^"]+)(")/g)]
    assert.ok(polygons.length>=2)
    const point=value=>value.split(',').map(Number)
    const [ax,ay]=point(polygons[0][2].trim().split(/\s+/)[0])
    const [bx,by]=point(polygons[1][2].trim().split(/\s+/)[0])
    const changed=polygons[0][2].trim().split(/\s+/).map(value=>{
      const [x,y]=point(value)
      return `${Number((x+bx-ax).toFixed(4))},${Number((y+by-ay).toFixed(4))}`
    }).join(' ')
    return strToU8(svg.replace(polygons[0][0],polygons[0][1]+changed+polygons[0][3]))
  },{rehash:true}),/marker SVG placement overlap or spacing mismatch/)
  rejected(mutate('markers/M/main.svg',bytes=>{
    const svg=strFromU8(bytes)
    assert.match(svg,/width="150cm"/)
    return strToU8(svg.replace('width="150cm"','width="140cm"'))
  },{rehash:true}),/marker SVG dimensional envelope mismatch/)
  rejected(mutate('markers/M/main.svg',bytes=>{
    const svg=strFromU8(bytes)
    assert.match(svg,/<polygon fill="none" stroke="#111"/)
    return strToU8(svg.replace('<polygon fill="none" stroke="#111"',
      '<polygon transform="translate(30)" fill="none" stroke="#111"'))
  },{rehash:true}),/marker SVG.*(attribute|transform|envelope).*mismatch|unsafe or malformed marker SVG/)
  rejected(mutate('markers/M/main.svg',bytes=>{
    const svg=strFromU8(bytes)
    assert.match(svg,/viewBox="0 0 150 [\d.]+">/)
    return strToU8(svg.replace(/(viewBox="0 0 150 [\d.]+")>/,'$1 transform="scale(0.5)">'))
  },{rehash:true}),/marker SVG.*(attribute|transform|envelope).*mismatch|unsafe or malformed marker SVG/)
})

test('PDF page geometry must match the physical marker even after rehashing',()=>{
  rejected(mutate('markers/M/main.pdf',bytes=>{
    const pdf=strFromU8(bytes)
    assert.match(pdf,/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/)
    return strToU8(pdf.replace(/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/,
      '/MediaBox [0 0 200 200]'))
  },{rehash:true}),/PDF.*(page|MediaBox|geometry|xref|offset).*mismatch|PDF.*invalid/i)
})

test('reference-only source and falsified marker QA coverage are rejected',()=>{
  rejected(mutateJSON('source/garment-source.json',p=>{
    p.patternSource={referenceOnly:true}
  },{rehash:true}),/reference-only source/)
  rejected(mutateJSON('qa/marker-dxf-parity.json',r=>{
    r.sizes.pop()
  },{rehash:true}),/marker\/DXF QA size coverage mismatch/)
  rejected(mutateJSON('qa/marker-plot-parity.json',r=>{
    r.rows.pop()
  },{rehash:true}),/marker plot QA coverage mismatch/)
  rejected(mutateJSON('qa/marker-plot-parity.json',r=>{
    r.ok=false
  },{rehash:true}),/unsafe QA release flag/)
  rejected(mutateJSON('qa/marker-dxf-parity.json',r=>{
    r.measurements=[];r.checkedPlacements=0
  },{rehash:true}),/marker\/DXF QA placement evidence mismatch/)
  rejected(mutateJSON('qa/marker-dxf-parity.json',r=>{
    r.measurements[0].pieceId='not-in-source'
  },{rehash:true}),/marker\/DXF QA placement evidence mismatch/)
  rejected(mutateJSON('qa/industrial.json',r=>{
    r.sizes=['M']
  },{rehash:true}),/incomplete QA size coverage/)
})

test('unrecognized factory-release claims are refused in source, manifest, status and QA metadata',()=>{
  rejected(mutateJSON('manifest.json',m=>{m.factoryApproved=true}),
    /unsafe or unrecognized release status/)
  rejected(mutateJSON('review-status.json',r=>{r.factoryApproved=true},{rehash:true}),
    /unsafe or unrecognized release status/)
  rejected(mutateJSON('review-status.json',r=>{r.checks[0].factoryApproved=true},{rehash:true}),
    /invalid review row/)
  rejected(mutateJSON('source/garment-source.json',p=>{p.factoryCertified='approved'},{rehash:true}),
    /incomplete connected source or run/)
  rejected(mutateJSON('qa/industrial.json',qa=>{qa.factoryCertified='approved'},{rehash:true}),
    /unsafe QA release flag/)
})

test('missing marker plots and mismatching CUT layer identity cannot pass with rehashed inventory',()=>{
  const files=cloneFiles(),manifest=decode(files['manifest.json'])
  delete files['markers/S/main.svg']
  delete manifest.sha256['markers/S/main.svg']
  manifest.files=Object.keys(files).sort()
  files['manifest.json']=encode(manifest)
  rejected(zipSync(files),/missing marker plot/)
  rejected(mutate('patterns/S.dxf',bytes=>
    strToU8(strFromU8(bytes).replaceAll('CUT_FRONT_S','CUT_UNKNOWN_S')),{rehash:true}),
    /missing DXF CUT layer/)
})

test('truncated, random, overlong, and malformed ZIP bytes refuse before decompressing',()=>{
  for(const bytes of [
    new Uint8Array(),strToU8('not a zip'),actualZip.slice(0,-8),
    Uint8Array.from([...actualZip,...strToU8('trailing payload')]),
  ])rejected(bytes,/ZIP/)
  rejected('not bytes',/invalid or oversized ZIP/)
})

test('archive entry path traversal, duplicate names and excessive entry counts are refused',()=>{
  rejected(zipSync({...cloneFiles(),'../outside.txt':strToU8('x')}),/unsafe or duplicate ZIP entry name/)
  const dup=actualZip.slice(),from=strToU8('patterns/M.dxf'),to=strToU8('patterns/S.dxf')
  assert.equal(from.length,to.length)
  let altered=0
  for(let i=0;i<=dup.length-from.length;i++){
    if(from.every((n,j)=>dup[i+j]===n)){
      dup.set(to,i);altered++;i+=from.length-1
    }
  }
  assert.equal(altered,2,'must change both local and central filenames')
  rejected(dup,/duplicate ZIP entry name/)
  const many={}
  for(let i=0;i<501;i++)many[`extra/${i}.txt`]=strToU8('a')
  rejected(zipSync(many),/entry count/)
})

test('self-consistent manifest cannot smuggle unexpected files or orphan print-calibration artifacts',()=>{
  for(const file of ['extra/instruction.js','qa/injected-pass.json','patterns/UNLISTED.dxf']){
    const files=cloneFiles()
    files[file]=strToU8('ignored or dangerous payload')
    const manifest=decode(files['manifest.json'])
    manifest.sha256[file]=sha256Bytes(files[file])
    manifest.files=Object.keys(files).sort()
    files['manifest.json']=encode(manifest)
    rejected(zipSync(files),/unexpected development archive file|invalid ZIP/)
  }
  const files=cloneFiles(),name='print-calibration/S/main.pdf'
  assert.ok(files[name],'the fixture carries a real standalone calibration plot pair')
  delete files[name]
  const manifest=decode(files['manifest.json'])
  delete manifest.sha256[name]
  manifest.files=Object.keys(files).sort()
  files['manifest.json']=encode(manifest)
  rejected(zipSync(files),/incomplete print-calibration pair|unexpected development archive|invalid print-calibration plot/)
})

test('oversized declared uncompressed entry and inconsistent local/central metadata are refused pre-inflation',()=>{
  const altered=actualZip.slice()
  const signature=[0x50,0x4b,0x01,0x02],at=altered.findIndex((_,i)=>signature.every((b,j)=>altered[i+j]===b))
  assert.ok(at>0)
  const view=new DataView(altered.buffer)
  view.setUint32(at+24,30_000_001,true)
  rejected(altered,/size budget exceeded/)
  const local=actualZip.slice()
  new DataView(local.buffer).setUint16(8,99,true)
  rejected(local,/inconsistent ZIP local and central records/)
  const unexpectedExtra=actualZip.slice()
  new DataView(unexpectedExtra.buffer).setUint16(at+30,1,true)
  rejected(unexpectedExtra,/unsupported ZIP entry metadata/)
})

test('ZIP CRC mismatches refuse even when the inflated content and manifest hash are unchanged',()=>{
  const signature=[0x50,0x4b,0x01,0x02]
  const at=actualZip.findIndex((_,i)=>signature.every((b,j)=>actualZip[i+j]===b))
  assert.ok(at>0)
  const central=actualZip.slice()
  const view=new DataView(central.buffer)
  view.setUint32(at+16,view.getUint32(at+16,true)^1,true)
  rejected(central,/inconsistent ZIP local and central records/)
  const consistentButFalseCrc=actualZip.slice()
  const both=new DataView(consistentButFalseCrc.buffer)
  const originalCrc=both.getUint32(at+16,true)
  const localOffset=both.getUint32(at+42,true)
  both.setUint32(at+16,originalCrc^1,true)
  both.setUint32(localOffset+14,originalCrc^1,true)
  rejected(consistentButFalseCrc,/ZIP CRC mismatch/)
})

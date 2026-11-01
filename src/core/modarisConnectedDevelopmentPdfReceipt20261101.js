/**
 * Source-independent, read-only inspection of the ASCII PDF emitted by EXO's
 * connected marker plot. This is not a general PDF interpreter and does not
 * prove a physical plotter's scale, print settings or page registration.
 */
const POINTS_PER_CM=72/2.54
const fail=message=>{throw Error(`PDF digital plot mismatch: ${message}`)}
const close=(a,b,tolerance=0.00025)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance

export function inspectConnectedDevelopmentPdf20261101(pdf,{size,fabricId,widthCm,heightCm,polygons}){
  if(typeof pdf!=='string'||!pdf.startsWith('%PDF-1.4\n%Garment Studio marker plot\n')||
    !pdf.endsWith('%%EOF\n')||/[^\x00-\x7f]/.test(pdf)||!Array.isArray(polygons)||
    !polygons.length||!Number.isFinite(widthCm)||!Number.isFinite(heightCm))
    fail('invalid PDF envelope or expected geometry')
  const xref=/\nxref\n0 (\d+)\n([0-9 fn\n]+)trailer\n<< \/Size (\d+) \/Root 1 0 R >>\nstartxref\n(\d+)\n%%EOF\n$/.exec(pdf)
  if(!xref)fail('invalid xref/trailer structure')
  const xrefPosition=pdf.indexOf('\nxref\n')+1
  if(xrefPosition!==Number(xref[4])||xrefPosition!==xref.index+1)
    fail('xref offset mismatch')
  const objects=[...pdf.matchAll(/^(\d+) 0 obj\n/gm)]
  const objectCount=Number(xref[1])-1
  if(objectCount<5||objectCount!==objects.length||objectCount+1!==Number(xref[3]))
    fail('object inventory mismatch')
  const objectOffsets=new Map()
  for(const match of objects){
    const number=Number(match[1])
    if(!Number.isSafeInteger(number)||number<1||number>objectCount||objectOffsets.has(number))
      fail('duplicate or invalid PDF object identifier')
    objectOffsets.set(number,match.index)
  }
  const rows=xref[2].split('\n').filter(Boolean)
  if(rows.length!==objectCount+1||!/^0000000000 65535 f ?$/.test(rows[0]))
    fail('xref row inventory mismatch')
  for(let id=1;id<=objectCount;id++){
    const row=/^(\d{10}) 00000 n ?$/.exec(rows[id])
    if(!row||Number(row[1])!==objectOffsets.get(id))
      fail(`xref object ${id} offset mismatch`)
  }
  const pages=[...pdf.matchAll(/(\d+) 0 obj\n<< \/Type \/Page \/Parent 2 0 R \/MediaBox \[0 0 ([\d.]+) ([\d.]+)\] ([^\n]+) \/Resources << \/Font << \/F1 3 0 R >> >> \/Contents (\d+) 0 R >>\nendobj/g)]
  if(!pages.length||pages.length*2+3!==objectCount||
    (pdf.match(/\/Type \/Page\b/g)||[]).length!==pages.length||
    !pdf.includes(`/Type /Pages /Kids [${pages.map(page=>page[1]+' 0 R').join(' ')}] /Count ${pages.length} >>`))
    fail('PDF page tree/count mismatch')
  const seen=new Set()
  let previousEnd=0
  for(const [index,page] of pages.entries()){
    const pageObject=Number(page[1]),contentObject=Number(page[5])
    if(pageObject!==4+index*2||contentObject!==5+index*2)
      fail('PDF page/content object order mismatch')
    const meta=/^\/EXOPageIndex (\d+) \/EXOPageCount (\d+) \/EXOStartCm ([\d.]+) \/EXOEndCm ([\d.]+) \/EXOSize \(([^)]*)\) \/EXOFabric \(([^)]*)\) \/EXOProvenanceHex <([0-9a-f]+)>$/.exec(page[4])
    if(!meta||Number(meta[1])!==index+1||Number(meta[2])!==pages.length||
      meta[5]!==size||meta[6]!==fabricId||meta[7].length>4096)
      fail('PDF page source identity mismatch')
    let provenance
    try{
      const bytes=Uint8Array.from(meta[7].match(/../g)||[],hex=>parseInt(hex,16))
      provenance=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
    }catch{fail('invalid PDF provenance')}
    if(JSON.stringify(provenance)!==JSON.stringify([size,fabricId]))
      fail('PDF provenance does not match source')
    const start=Number(meta[3]),end=Number(meta[4])
    const widthPt=Number(page[2]),heightPt=Number(page[3])
    if(!close(start,previousEnd,0.0002)||!(end>start)||
      !close(widthPt,widthCm*POINTS_PER_CM)||
      !close(heightPt,(end-start)*POINTS_PER_CM,0.0005))
      fail(`PDF page ${index+1} MediaBox/station geometry mismatch`)
    previousEnd=end
    const streamRx=new RegExp(`\\n${contentObject} 0 obj\\n<< \\/Length (\\d+) >>\\nstream\\n([\\s\\S]*?)endstream\\nendobj`)
    const stream=streamRx.exec(pdf)
    if(!stream||Number(stream[1])!==stream[2].length)
      fail('PDF graphics stream length mismatch')
    const lines=stream[2].trimEnd().split('\n')
    if(lines[0]!=='q'||lines.at(-1)!=='Q'||
      lines[1]!==`0 0 ${widthPt} ${heightPt} re W n`||
      lines[4]!==`0 0 ${widthPt} ${heightPt} re S`)
      fail('PDF printable region/graphics state mismatch')
    let paths=0
    for(let j=0;j<lines.length;j++){
      if(lines[j]!=='h S')continue
      let first=j-1
      while(first>=0&&/^-?[\d.]+ -?[\d.]+ [ml]$/.test(lines[first]))first--
      const encoded=lines.slice(first+1,j)
      if(encoded.length<3||!encoded[0].endsWith(' m')||
        encoded.slice(1).some(line=>!line.endsWith(' l')))
        fail('invalid PDF cutting path instructions')
      const poly=encoded.map(row=>{
        const [x,y]=row.split(' ').map(Number)
        return {x:x/POINTS_PER_CM,y:(heightPt-y)/POINTS_PER_CM+start}
      })
      const matchIndex=polygons.findIndex(outline=>
        outline.length===poly.length&&outline.every((p,k)=>
          close(p.x,poly[k].x,0.0003)&&close(p.y,poly[k].y,0.0003)))
      if(matchIndex<0)fail('PDF cutting path differs from SVG marker geometry')
      const matched=polygons[matchIndex]
      const low=Math.min(...matched.map(p=>p.y)),high=Math.max(...matched.map(p=>p.y))
      if(high<start-0.0003||low>end+0.0003)
        fail('PDF cutting path is outside its declared print page')
      seen.add(matchIndex)
      paths++
    }
    if(!paths)fail('PDF page lacks physical CUT plot paths')
    const expectedOnPage=polygons.filter(outline=>{
      const low=Math.min(...outline.map(p=>p.y)),high=Math.max(...outline.map(p=>p.y))
      return high>=start-0.0001&&low<=end+0.0001
    }).length
    if(paths!==expectedOnPage)
      fail('PDF page has missing or repeated cutting paths')
  }
  if(!close(previousEnd,heightCm,0.00025)||seen.size!==polygons.length)
    fail('PDF page coverage or cutting path inventory mismatch')
  return {ok:true,pageCount:pages.length,polygonsVerified:seen.size}
}

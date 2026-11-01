// Bounded CPU-only serialization probe. Never opens a bridge or garment file.
import {performance} from 'node:perf_hooks'
import {fileURLToPath} from 'node:url'

export function makeSnapshot({pieces=6,verticesPerPiece=600}={}) {
  if (!Number.isInteger(pieces)||pieces<1||pieces>24||!Number.isInteger(verticesPerPiece)||verticesPerPiece<3||verticesPerPiece>3000)
    throw Error('Fixture exceeds bounded limits')
  const positions=[],uv=[],triangles=[],panels=[],templatePanels=[]
  for(let p=0;p<pieces;p++){
    const start=positions.length
    for(let i=0;i<verticesPerPiece;i++){
      const x=i%30,y=Math.floor(i/30)
      positions.push([p*.15+x*.006,y*.006,Math.sin(i*.14+p)*.003])
      uv.push([x*.006,y*.006])
      if(i>=31&&i%30!==0)triangles.push([start+i-31,start+i-30,start+i])
    }
    const id='piece-'+p
    panels.push({id,vertices:Array.from({length:verticesPerPiece},(_,i)=>start+i),boundaries:{top:Array.from({length:30},(_,i)=>start+i)}})
    templatePanels.push({id,name:id,fabric:'cotton',polygon:{points:[[0,0],[.18,0],[.18,.18],[0,.18]],edges:['top','right','bottom','left'],target_lengths:{top:.18}}})
  }
  return {ok:true,data:{revision:23,template:{name:'Multi-piece serialization fixture',panels:templatePanels,fabrics:[{id:'cotton'}],seams:[]},positions,uv,triangles,panels,avatar:null,time:1.25,running:false,busy:false,metrics:{},canUndo:true,canRedo:false}}
}

export function profileSnapshot(snapshot,{iterations=12}={}){
  if(!Number.isInteger(iterations)||iterations<1||iterations>100)throw Error('Invalid iteration bound')
  const durations={stringify:[],parse:[],roundtrip:[]}
  let bytes=0
  let decoded
  const before=process.memoryUsage().heapUsed
  for(let i=0;i<iterations;i++){
    let start=performance.now()
    const wire=JSON.stringify(snapshot)
    const mid=performance.now()
    decoded=JSON.parse(wire)
    const end=performance.now()
    bytes=Buffer.byteLength(wire)
    durations.stringify.push(mid-start)
    durations.parse.push(end-mid)
    durations.roundtrip.push(end-start)
  }
  const after=process.memoryUsage().heapUsed
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2}
  return {vertices:snapshot.data.positions.length,triangles:snapshot.data.triangles.length,pieces:snapshot.data.panels.length,bytes,iterations,
    medianMs:Object.fromEntries(Object.entries(durations).map(([key,values])=>[key,Number(median(values).toFixed(3))])),
    maxRoundtripMs:Number(Math.max(...durations.roundtrip).toFixed(3)),
    heapBeforeBytes:before,heapAfterBytes:after,heapDeltaBytes:after-before,
    validRoundtrip:decoded.data.positions.length===snapshot.data.positions.length}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const sizes=[[3,300],[6,600],[12,1200]]
  for(const [pieces,verticesPerPiece] of sizes)console.log(JSON.stringify(profileSnapshot(makeSnapshot({pieces,verticesPerPiece}))))
}

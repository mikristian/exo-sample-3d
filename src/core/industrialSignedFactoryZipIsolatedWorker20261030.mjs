import {inspectSignedFactoryZipHandoff20261030} from './industrialSignedFactoryZipReceiving20261030.mjs'
import {auditFactoryZipResourceThenCrc20261024_0600} from './factoryZipResourceBudget20261024_0600.mjs'

const MAX_INPUT=52_000_000
const blocked=code=>({
  schema:'exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1',
  status:'BLOCKED',issues:[{code,scope:'guarded-zip'}],blockers:1,rows:[],
  independentlyReceived:false,licensedReceiverCadAccepted:false,
  physicalNotchStationsCertified:false,physicalCuttingAuthorized:false,
  factoryCertified:false,bulkProductionAuthorized:false,
  limitation:'Guarded ZIP inspection is not licensed receiving CAD or cutting authorization.',
})
try{
  let size=0
  const chunks=[]
  for await(const chunk of process.stdin){
    size+=chunk.length
    if(size>MAX_INPUT)throw Error('input budget')
    chunks.push(chunk)
  }
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true})
    .decode(Buffer.concat(chunks,size)))
  if(typeof body.archiveBase64!=='string'||body.archiveBase64.length>43_000_000||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(body.archiveBase64))
    throw Error('archive encoding')
  const archive=Buffer.from(body.archiveBase64,'base64')
  if(archive.toString('base64')!==body.archiveBase64||archive.length>32_000_000)
    throw Error('archive encoding')
  // The guarded exporter permits only 16 MiB archive/aggregate, 4 MiB per
  // member and 100x expansion. Enforce those stricter policies in this child
  // before the otherwise more permissive signed raw-ZIP receiver inflates.
  // This also preserves the guarded CRC and DEFLATE framing checks.
  const guard=auditFactoryZipResourceThenCrc20261024_0600(archive)
  const result=guard.ok
    ?inspectSignedFactoryZipHandoff20261030(body.project,archive,body.options)
    :blocked('ZIP_GUARDED_'+(guard.diagnostics?.[0]?.code||'INVALID'))
  process.stdout.write(JSON.stringify(result))
}catch{
  process.exitCode=1 // Parent reports a fail-closed child failure, not approval.
}

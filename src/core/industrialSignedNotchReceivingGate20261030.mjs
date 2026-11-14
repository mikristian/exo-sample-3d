/** Offline, Node-only receiving preflight. A locally verified signature and DXF
 * parity are NOT a licensed receiver's acceptance or cutting authorization.
 * The trusted Ed25519 key/pin and source revision must be supplied separately
 * from the editable project and the package being inspected.
 */
import {createHash} from 'node:crypto'
import {gradeProject,buildSizeRun} from './grading.js'
import {projectToDxf} from './dxf.js'
import {inspectManufacturingReleaseReadiness} from './manufacturingReleaseReadiness.js'
import {createFactorySampleWorksheet,inspectFactorySampleEvidence} from './factorySampleApproval.js'
import {inspectGradedNotchPairs} from './industrialNotchQA.js'
import {inspectGradedNotchSeamIntervals} from './gradedNotchIntervalAudit.js'
import {inspectGradedCutlines} from './industrialCutlineQA.js'
import {verifyApprovedGradedNotchGeometry20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {createRecipientCadExchangeProtocol} from './recipientCadExchangeProtocol.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const token = name => String(name).replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase()
const slug = value => String(value || 'garment').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'garment'
const own = (x,k) => Object.prototype.hasOwnProperty.call(x,k)
const exactKeys = (x,keys) => x && typeof x === 'object' && !Array.isArray(x) &&
  Object.keys(x).length === keys.length && keys.every(k=>own(x,k))
const decode = bytes => new TextDecoder('utf-8',{fatal:true}).decode(bytes)
const safePath = path => typeof path==='string'&&path.length<=240&&
  /^[\x21-\x7e]+$/.test(path)&&!path.includes('\\')&&!path.startsWith('/')&&
  !/^[a-z]:/i.test(path)&&path.split('/').every(part=>part.length<=120&&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part)&&!part.includes('..'))
// This is a closed v2 factory-export inventory, not a general-purpose ZIP
// trust service. In particular, self-hashed receiver approvals added by an
// untrusted sender must never appear beside a green signed-source preflight.
const standardFiles=new Set(`README.txt marker-dxf-geometry-qa.json tech-pack.json
factory-spec.html pom-spec.csv materials-bom.csv fabric-costing.csv bom.xml
production-preflight.json industrial-pattern-qa.json industrial-pattern-issues.csv
industrial-pattern-seam-walk.csv industrial-notch-qa.json industrial-notch-walk.csv
graded-sewn-interval-notch-qa.json graded-sewn-interval-notch-walk.csv
graded-sewn-interval-notch-issues.csv graded-sewn-interval-notch-coverage.csv
industrial-cutline-qa.json industrial-cutline-areas.csv graded-geometry-qa.json
graded-geometry-issues.csv graded-seam-junction-qa.json factory-sample-worksheet.json
factory-sample-approval-gate.json recipient-cad-acceptance-plan.json
manufacturing-release-readiness.json graded-partial-seam-notch-reconciliation.json
pattern-pieces.csv construction-seams.csv marker-summary.csv trims-hardware.json
size-run.json garment-source.json marker-plot-geometry-qa.json manifest.json`.split(/\s+/))
const standardPath=path=>standardFiles.has(path)||
  /^grading-rules\/\d{3,}-[a-z0-9-]+\.csv$/.test(path)||
  /^industrial-grading\/\d{3,}-[a-z0-9-]+\.json$/.test(path)||
  /^patterns\/[a-z0-9][a-z0-9._-]*\.dxf$/.test(path)||
  /^(?:markers|print-calibration)\/[a-z0-9-]+\.(?:svg|pdf)$/.test(path)||
  /^tee-development\/neckband-proposal(?:-[a-z0-9-]+\.dxf|\.(?:json|csv))$/.test(path)
// The exporter can emit four plot/calibration files per fabric and size,
// plus one graded DXF per size and one grading artifact per authored piece.
// A fixed 500-entry limit rejects otherwise valid signed multi-fabric runs.
// Bound the untrusted inventory by the authenticated source instead; the
// final regenerated-file comparison still requires an EXACT inventory match.
export function sourceInventoryBudget(project){
  const sizes=project.grading?.sizes||[project.grading?.baseSize||'M']
  const pieces=project.pieces||[]
  const fabricIds=new Set(pieces.map(piece=>piece.fabricId||'main'))
  const teeDevelopment=project.productionSpec?.format==='garment-studio.tee-production-development.v1'&&
    project.productionSpec.neckband?.requiresSeparateNeckbandCutPattern===true
  // One diagnostic slot lets a single forged but otherwise safe extra file
  // reach the more specific regenerated-inventory mismatch check.
  return standardFiles.size+pieces.length+sizes.length*(1+4*fabricIds.size)+
    (teeDevelopment?sizes.length+2:0)+1
}
const result = (issues, rows=[]) => ({
  schema:'exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1',
  status:issues.length?'BLOCKED':'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',
  issues,blockers:issues.length,rows,
  independentlyReceived:false,licensedReceiverCadAccepted:false,
  physicalNotchStationsCertified:false,physicalCuttingAuthorized:false,
  factoryCertified:false,bulkProductionAuthorized:false,
  limitation:'Offline local Ed25519 identity and emitted DXF mark parity only. Independently pin the authorized public key and attest the source revision outside the editable project/package. Deterministic exporter parity is not independent CAD import, printed scale, cutter qualification, or sewn-sample approval.',
})

function notchEntities(wire){
  const lines=wire.split(/\r?\n/)
  if(lines.at(-1)==='')lines.pop()
  if(lines.length%2!==0)throw Error('INCOMPLETE_DXF_GROUP_PAIRS')
  const pairs=[]
  for(let i=0;i<lines.length;i+=2){
    if(!/^\s*\d+\s*$/.test(lines[i]))throw Error('INVALID_DXF_GROUP_CODE')
    pairs.push([Number(lines[i]),lines[i+1]])
  }
  let section='',seenEntities=false
  const entities=[]
  for(let i=0;i<pairs.length;){
    if(pairs[i][0]!==0){i++;continue}
    const type=pairs[i][1].trim().toUpperCase()
    const fields=[]
    i++
    while(i<pairs.length&&pairs[i][0]!==0)fields.push(pairs[i++])
    if(type==='SECTION'){
      if(section)throw Error('NESTED_DXF_SECTION')
      section=fields.find(([c])=>c===2)?.[1]?.trim().toUpperCase()||''
      if(section==='ENTITIES'){
        if(seenEntities)throw Error('DUPLICATE_ENTITIES_SECTION')
        seenEntities=true
      }
      continue
    }
    if(type==='ENDSEC'){section='';continue}
    if(section!=='ENTITIES')continue
    const layers=fields.filter(([c])=>c===8)
    if(layers.length!==1){
      if(layers.some(([,v])=>/^NOTCH_/i.test(v)))throw Error('AMBIGUOUS_NOTCH_LAYER')
      continue
    }
    const layer=layers[0][1]
    if(!/^NOTCH_/i.test(layer))continue
    if(type!=='LINE')throw Error('UNSUPPORTED_NOTCH_ENTITY_'+type)
    const point={}
    for(const code of [10,20,11,21]){
      const values=fields.filter(([c])=>c===code)
      if(values.length!==1||!values[0][1].trim()||!Number.isFinite(Number(values[0][1])))
        throw Error('MALFORMED_NOTCH_LINE')
      point[code]=Number(values[0][1])
    }
    if(fields.some(([c,v])=>[30,31].includes(c)&&Number(v)!==0 ||
      c===67&&Number(v)!==0))throw Error('NONPLANAR_NOTCH_LINE')
    const depth=Math.hypot(point[11]-point[10],point[21]-point[20])
    if(!(depth>0))throw Error('ZERO_LENGTH_NOTCH_LINE')
    entities.push({layer,depth})
  }
  if(!seenEntities||section)throw Error('INCOMPLETE_DXF_ENTITIES')
  return entities
}

/** packageFiles is the actual unpacked factory ZIP file map, not a caller's
 * claimed QA summary. No approval is accepted from the ZIP itself.
 */
export function inspectSignedFactoryNotchHandoff20261030(project,packageFiles,{
  approval=null,trustedKeyConfig=null,sourceRevision=null,
}={}){
  const issues=[],rows=[]
  const fail=(code,scope='package')=>issues.push({code,scope})
  try{
    const signed=verifyApprovedGradedNotchGeometry20261023(project,sourceRevision,approval,trustedKeyConfig)
    if(signed.status!=='authenticated_graded_identity_only'){
      for(const code of signed.issues)fail('SIGNED_BASELINE_'+code,'approval')
      if(!signed.issues.length)fail('SIGNED_BASELINE_UNVERIFIED','approval')
      return result(issues)
    }
    const files=packageFiles
    if(!files||typeof files!=='object'||Array.isArray(files)){
      fail('INVALID_PACKAGE_FILE_MAP');return result(issues)
    }
    const names=Object.keys(files)
    if(names.length<4||
      names.some(name=>!safePath(name))||
      new Set(names.map(name=>name.toLowerCase())).size!==names.length){
      fail('UNSAFE_OR_DUPLICATE_PACKAGE_PATH');return result(issues)
    }
    if(names.some(name=>!standardPath(name))){
      for(const name of names.filter(name=>!standardPath(name)))fail('UNSUPPORTED_PACKAGE_FILE',name)
      return result(issues)
    }
    if(names.length>sourceInventoryBudget(project)){
      fail('PACKAGE_FILE_COUNT_EXCEEDS_AUTHENTICATED_SOURCE_BUDGET');return result(issues)
    }
    let totalBytes=0
    for(const name of names){
      const data=files[name]
      if(!(data instanceof Uint8Array)||data.byteLength>32_000_000){
        fail('INVALID_OR_OVERSIZED_PACKAGE_FILE',name);return result(issues)
      }
      totalBytes+=data.byteLength
      if(totalBytes>100_000_000){fail('PACKAGE_TOTAL_SIZE_LIMIT');return result(issues)}
    }
    if(!own(files,'manifest.json')){fail('MISSING_PACKAGE_MANIFEST');return result(issues)}
    if(files['manifest.json'].byteLength>2_000_000){fail('OVERSIZED_PACKAGE_MANIFEST');return result(issues)}
    let manifest
    try{manifest=JSON.parse(decode(files['manifest.json']))}
    catch{fail('INVALID_PACKAGE_MANIFEST');return result(issues)}
    if(!exactKeys(manifest,['format','version','project','grading','marker','files','sha256'])){
      fail('UNSUPPORTED_PACKAGE_MANIFEST_SCHEMA');return result(issues)
    }
    const expectedMarker={
      fabricWidthCm:project.markerSettings?.fabricWidthCm??150,
      gapCm:project.markerSettings?.gapCm??1.5,
      fabricWidthsCm:project.markerSettings?.fabricWidthsCm||{},
    }
    const actualMarker=manifest.marker
    if(!exactKeys(actualMarker,['fabricWidthCm','gapCm','fabricWidthsCm'])||
      actualMarker.fabricWidthCm!==expectedMarker.fabricWidthCm||
      actualMarker.gapCm!==expectedMarker.gapCm||
      !exactKeys(actualMarker.fabricWidthsCm,Object.keys(expectedMarker.fabricWidthsCm))||
      Object.keys(expectedMarker.fabricWidthsCm).some(key=>
        actualMarker.fabricWidthsCm[key]!==expectedMarker.fabricWidthsCm[key])){
      fail('PACKAGE_MARKER_SETTINGS_MISMATCH');return result(issues)
    }
    const hashes=manifest?.sha256
    const entries=names.filter(n=>n!=='manifest.json').sort()
    if(manifest?.format!=='garment-studio-factory-package'||manifest.version!==2||
      !exactKeys(hashes,entries)||!Array.isArray(manifest.files)||
      JSON.stringify(manifest.files)!==JSON.stringify([...names].sort())||
      manifest.project?.id!==project.id||manifest.project?.revision!==project.revision||
      manifest.project?.name!==project.name||
      manifest.grading?.baseSize!==project.grading?.baseSize||
      JSON.stringify(manifest.grading?.sizes)!==JSON.stringify(project.grading?.sizes)){
      fail('PACKAGE_MANIFEST_INVENTORY_OR_IDENTITY_MISMATCH');return result(issues)
    }
    for(const name of entries){
      if(files[name].byteLength>32_000_000||!(/^[a-f0-9]{64}$/.test(hashes[name]))||
        sha(files[name])!==hashes[name]){
        fail('PACKAGE_FILE_HASH_OR_SIZE_MISMATCH',name)
      }
    }
    if(issues.length)return result(issues)
    // The receiving operator must not see an authenticated DXF report beside
    // rehashed, contradictory source, graded size-run or readiness JSON.
    const worksheet=createFactorySampleWorksheet(project)
    for(const [path,expected] of [
      ['garment-source.json',JSON.stringify(project,null,2)],
      ['size-run.json',JSON.stringify(buildSizeRun(project),null,2)],
      ['manufacturing-release-readiness.json',JSON.stringify(inspectManufacturingReleaseReadiness(project),null,2)],
      ['factory-sample-worksheet.json',JSON.stringify(worksheet,null,2)],
      ['factory-sample-approval-gate.json',JSON.stringify(inspectFactorySampleEvidence(project,worksheet),null,2)],
      ['industrial-notch-qa.json',JSON.stringify(inspectGradedNotchPairs(project),null,2)],
      ['graded-sewn-interval-notch-qa.json',JSON.stringify(inspectGradedNotchSeamIntervals(project),null,2)],
      ['industrial-cutline-qa.json',JSON.stringify(inspectGradedCutlines(project),null,2)],
      ['recipient-cad-acceptance-plan.json',JSON.stringify(createRecipientCadExchangeProtocol(project),null,2)],
    ]){
      if(!own(files,path)||decode(files[path])!==expected){
        fail('FACTORY_HANDOFF_SOURCE_OR_QA_CONTRADICTION',path)
      }
    }
    if(issues.length)return result(issues)
    const sizes=approval.manifest.sizes
    const expectedPaths=sizes.map(size=>`patterns/${slug(project.name)}-${size.toLowerCase()}.dxf`)
    const actualPaths=names.filter(name=>name.startsWith('patterns/')&&name.toLowerCase().endsWith('.dxf')).sort()
    if(new Set(expectedPaths.map(x=>x.toLowerCase())).size!==sizes.length||
      JSON.stringify(actualPaths)!==JSON.stringify([...expectedPaths].sort())){
      fail('GRADED_DXF_SIZE_INVENTORY_MISMATCH');return result(issues)
    }
    const pieces=project.pieces
    const layers=pieces.map(p=>`NOTCH_${token(p.name)}`)
    if(new Set(layers).size!==layers.length){fail('COLLIDING_NOTCH_LAYER_NAMES');return result(issues)}
    for(let index=0;index<sizes.length;index++){
      const size=sizes[index],path=expectedPaths[index]
      const wire=decode(files[path])
      const expectedWire=projectToDxf(gradeProject(project,size),size,
        {cutlineMode:'manufacturing',requireGradedGeometry:true})
      if(wire!==expectedWire)fail('DXF_DIFFERS_FROM_SIGNED_SOURCE_REGENERATION',size)
      let observed
      try{observed=notchEntities(wire)}
      catch(error){fail(String(error.message||error),size);continue}
      const signedRun=approval.manifest.sizeRuns[index]
      if(signedRun?.size!==size||signedRun.pieces.length!==pieces.length){
        fail('SIGNED_GRADED_PIECE_COVERAGE_MISMATCH',size);continue
      }
      for(let p=0;p<pieces.length;p++){
        const signedPiece=signedRun.pieces[p],piece=pieces[p],layer=layers[p]
        if(signedPiece.id!==piece.id){fail('SIGNED_PIECE_IDENTITY_MISMATCH',`${size}/${piece.id}`);continue}
        const expected=signedPiece.notches.flatMap(n=>Array(n.attrs.type==='double'?2:1).fill(n.attrs.depthCm*10)).sort((a,b)=>a-b)
        const found=observed.filter(e=>e.layer===layer).map(e=>e.depth).sort((a,b)=>a-b)
        const pass=found.length===expected.length&&found.every((v,j)=>Math.abs(v-expected[j])<=.015)
        rows.push({size,pieceId:piece.id,notchLayer:layer,expectedMarks:expected.length,observedMarks:found.length,status:pass?'PASS':'BLOCKED'})
        if(!pass)fail('SIGNED_NOTCH_MARK_COUNT_OR_DEPTH_MISMATCH',`${size}/${piece.id}`)
      }
      for(const mark of observed)if(!layers.includes(mark.layer))fail('UNEXPECTED_NOTCH_LAYER',`${size}/${mark.layer}`)
    }
    // A sender can rehash an arbitrary marker, grade rule or calibration sheet
    // without changing the signed garment or its DXF. Before reporting a local
    // match, require the ENTIRE v2 handoff to be reproducible from that source.
    // This is still EXO-exporter parity, not independent plotter/vendor CAD QA.
    if(!issues.length){
      const regenerated=buildFactoryPackageFiles(project)
      const expectedNames=Object.keys(regenerated).sort()
      if(JSON.stringify(expectedNames)!==JSON.stringify([...names].sort())){
        fail('FACTORY_ARTIFACT_INVENTORY_DIFFERS_FROM_SIGNED_SOURCE')
      }else for(const name of expectedNames){
        if(sha(files[name])!==sha(regenerated[name]))
          fail('FACTORY_ARTIFACT_DIFFERS_FROM_SIGNED_SOURCE',name)
      }
    }
  }catch(error){fail('SIGNED_RECEIVING_PREFLIGHT_EXCEPTION',String(error.message||error))}
  return result(issues,rows)
}

// Independent upstream source qualification. No geometry is approximated or dropped.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {convertValentinaSourceToSeamly20261031} from './valentinaUniversalSeamlyBridge20261031.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const ORIGINAL_WOMENS_BLOCK = path.join(root,'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/Basic_block_women-2016.val')
export const THIRD_PATTERN_CANDIDATES = Object.freeze([
  ['Steampunk_trousers.val','Steampunk_trousers.vit'],
  ['bra.val','bra.vit'],
  ['bugs/Issue_#493.val','bugs/Issue_#493.vit'],
])
const prefix='valentina-develop/src/app/share/collection/'
const sha256 = data => createHash('sha256').update(data).digest('hex')

export function inspectWomensInternalPaths20261031(source = fs.readFileSync(ORIGINAL_WOMENS_BLOCK,'utf8')) {
  const result=convertValentinaSourceToSeamly20261031(source)
  const blockers=(result.diagnostics||[]).filter(d=>d.code==='UNSUPPORTED_INTERNAL_PATH')
  return {sourceSha256:sha256(source),ok:result.ok,code:result.code,
    blockers,allDiagnostics:result.diagnostics||[],
    safeForNativeEvaluation:result.ok && blockers.length===0}
}

function archiveMember(zip, member) {
  if (!fs.existsSync(zip)) return {ok:false,reason:'ARCHIVE_MISSING'}
  const result=spawnSync('unzip',['-p',zip,prefix+member],{encoding:'utf8',maxBuffer:12*1024*1024,timeout:20000})
  if (result.error || result.status!==0 || !result.stdout) return {ok:false,reason:result.error?.message||'MEMBER_UNAVAILABLE'}
  return {ok:true,text:result.stdout}
}

/** Qualify archive originals; only successful exact-source conversions are eligible for native proof. */
export function qualifyThirdUpstreamPatterns20261031(zip, candidates=THIRD_PATTERN_CANDIDATES) {
  return candidates.map(([pattern,measurements])=>{
    const source=archiveMember(zip,pattern)
    const vit=archiveMember(zip,measurements)
    if (!source.ok || !vit.ok) return {pattern,measurements,ok:false,code:source.ok?vit.reason:source.reason}
    const converted=convertValentinaSourceToSeamly20261031(source.text)
    return {pattern,measurements,ok:converted.ok,code:converted.ok?'CONVERSION_SUPPORTED':converted.code,
      sourceSha256:sha256(source.text),measurementsSha256:sha256(vit.text),
      constructionTools:converted.constructionTools??null,pieces:converted.pieces??null,
      diagnostics:converted.diagnostics||[],
      nativeProof:'NOT_RUN',manufacturingApproved:false}
  })
}

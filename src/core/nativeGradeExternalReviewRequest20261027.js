import {inspectNativeGradingPOM20261025} from './nativeGradingPOM20261025.js'
import {sha256Bytes} from './sha256Bytes.js'

const SIZES=['XS','S','M','L','XL','XXL']
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const stringify=value=>JSON.stringify(canonical(value))
const hash=value=>sha256Bytes(new TextEncoder().encode(stringify(value)))
const same=(a,b)=>stringify(a)===stringify(b)
const fail=reason=>({ok:false,reason,externalApprovalVerified:false,
  manufacturerReady:false,manufacturingApproved:false,cuttingAuthorized:false})
const actualCutArea=points=>{
  let twiceArea=0
  for(let index=0;index<points.length;index++){
    const a=points[index],b=points[(index+1)%points.length]
    twiceArea+=a.x*b.y-b.x*a.y
  }
  return Math.abs(twiceArea)/2
}
const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
const onSegment=(a,b,p)=>p.x>=Math.min(a.x,b.x)-1e-12&&p.x<=Math.max(a.x,b.x)+1e-12&&
  p.y>=Math.min(a.y,b.y)-1e-12&&p.y<=Math.max(a.y,b.y)+1e-12
const intersects=(a,b,c,d)=>{
  const abC=orient(a,b,c),abD=orient(a,b,d),cdA=orient(c,d,a),cdB=orient(c,d,b)
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&
     ((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true
  return (Math.abs(abC)<=1e-12&&onSegment(a,b,c))||
    (Math.abs(abD)<=1e-12&&onSegment(a,b,d))||
    (Math.abs(cdA)<=1e-12&&onSegment(c,d,a))||
    (Math.abs(cdB)<=1e-12&&onSegment(c,d,b))
}
const simpleCutPolygon=points=>{
  const n=points.length
  // Keep an engineering review request bounded even when the supplied CUT
  // object is not an authentic native export. Intersection checks are O(n²).
  if(n>4096)return false
  // Geometric checks must reject an explicitly repeated closing vertex;
  // the traversal closes the last edge itself, so a repeated vertex creates
  // a zero-length extra segment. This also prevents double-counted edges.
  if(Math.hypot(points[0].x-points[n-1].x,points[0].y-points[n-1].y)<=1e-12)return false
  for(let i=0;i<n;i++){
    const a=points[i],b=points[(i+1)%n]
    if(Math.hypot(a.x-b.x,a.y-b.y)<=1e-12)return false
    for(let j=i+1;j<n;j++){
      if(j===i+1||(i===0&&j===n-1))continue
      if(intersects(a,b,points[j],points[(j+1)%n]))return false
    }
  }
  return true
}

/**
 * Creates a read-only, reproducible evidence REQUEST for an independent
 * physical cutter witness, receiving-CAD reviewer and sample measurement lab.
 * It is not a factory cutting export or independently signed approval.
 * No synthetic observations or reviewer credentials are generated.
 */
export function buildNativeGradeExternalReviewRequest20261027(snapshot,ruleSet,pomDefinitions=[],cutResponse,cutAudit){
  try{
    if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0||
      !Array.isArray(snapshot?.template?.panels)||!snapshot.template.panels.length||
      !same(ruleSet?.sizes,SIZES)||!ruleSet?.templateFingerprint)
      return fail('Current six-size native source and exact editable grading rules required')
    if(!cutAudit?.ok||cutAudit?.sourceRevision!==snapshot.revision||
      !same(cutAudit.sourceTemplate,snapshot.template)||!same(cutAudit.sourceRuleSet,ruleSet)||
      !same(cutAudit.verifiedSizes,SIZES)||cutAudit.authoritativeRust!==false||
      cutAudit.independentlyVerified!==false||cutAudit.cuttingAuthorized!==false)
      return fail('Current full-rule-pinned native engineering CUT inspection required')
    if(cutResponse?.format!=='exo-native-graded-cutlines.v1'||
      cutResponse.sourceRevision!==snapshot.revision||
      cutResponse.revision!==snapshot.revision||
      cutResponse.manufacturerReady!==false||cutResponse.cuttingAuthorized!==false||
      !Array.isArray(cutResponse.sizes)||cutResponse.sizes.length!==6||
      !SIZES.every((size,index)=>cutResponse.sizes[index]?.size===size))
      return fail('Rust returned stale, incomplete or unapproved-source-ambiguous CUT data')
    const measurements=inspectNativeGradingPOM20261025(snapshot,ruleSet,pomDefinitions)
    if(!pomDefinitions.length||!measurements.verified||measurements.rows.length!==6*pomDefinitions.length)
      return fail('Verified physical POM targets for every size required before requesting sample measurements')
    const identities=new Set(snapshot.template.panels.map(panel=>panel.id))
    if(identities.size!==snapshot.template.panels.length||!Array.from(identities).every(Boolean)||
      cutResponse.sizes.some(size=>!Array.isArray(size.panels)||size.panels.length!==identities.size||
        new Set(size.panels.map(panel=>panel?.panel_id)).size!==identities.size||
        size.panels.some(panel=>!identities.has(panel?.panel_id)||
          !Array.isArray(panel?.cut?.points)||panel.cut.points.length<3||
          panel.cut.points.length>4096||
          panel.cut.points.some(point=>!Number.isFinite(point?.x)||!Number.isFinite(point?.y))||
          !Number.isFinite(panel.cut.area_m2)||panel.cut.area_m2<=0||
          !Number.isFinite(actualCutArea(panel.cut.points))||
          !simpleCutPolygon(panel.cut.points)||
          Math.abs(actualCutArea(panel.cut.points)-panel.cut.area_m2)>
            Math.max(1e-8,panel.cut.area_m2*1e-4))))
      return fail('Physical CUT panel identities incomplete or inconsistent with source')
    // Bound the factory handoff size to avoid sending large, potentially
    // forged binary/base64 or a full simulation snapshot as a grading proof.
    const cutBytes=new TextEncoder().encode(stringify(cutResponse))
    if(cutBytes.length>8_000_000)return fail('Native CUT review JSON exceeds 8 MB limit')
    const manifest={schema:'exo.native-grade-external-review-request.v1',
      sourceRevision:snapshot.revision,templateFingerprint:ruleSet.templateFingerprint,
      sizes:[...SIZES],panelIds:[...identities],pomCount:pomDefinitions.length,
      sourceTemplateSha256:hash(snapshot.template),
      sourceRuleSetSha256:hash(ruleSet),
      fullRuleSetSha256:hash(ruleSet),
      pomDefinitionsSha256:hash(pomDefinitions),
      pomSha256:hash(pomDefinitions),
      nativeCutSha256:sha256Bytes(cutBytes),
      requiredIndependentEvidence:[
        'Actual full-scale CUT/STITCH outlines, allowances and physical notch stations for each size',
        'Returned licensed receiving-CAD artifacts and independently measured scale calibration',
        'Separate real sewn specimen per size, calibrated POM measurements and signed physical report',
        'Independent reviewer identities and verifiable signatures for source-pinned returned evidence',
      ],
      independentReviewCompleted:false,physicalCutApproved:false,
      receivingCadApproved:false,physicalSampleApproved:false,
      manufacturerReady:false,manufacturingApproved:false,cuttingAuthorized:false}
    const packet={manifest,sourceTemplate:canonical(snapshot.template),
      sourceRuleSet:canonical(ruleSet),pomDefinitions:canonical(pomDefinitions),
      nativeCutStudy:canonical(cutResponse)}
    const json=JSON.stringify(packet,null,2)+'\n'
    if(new TextEncoder().encode(json).length>10_000_000)return fail('Factory evidence request exceeds safe size limit')
    return {ok:true,manifest,packet,json,
      filename:`exo-native-grade-independent-review-r${snapshot.revision}-NOT-APPROVED.json`,
      externalApprovalVerified:false,manufacturerReady:false,
      manufacturingApproved:false,cuttingAuthorized:false,
      note:'This bundle requests independently returned, measured and signed artifacts; its hashes only detect drift and cannot prove physical factory work.'}
  }catch(error){return fail(`Unable to prepare independent grade review request: ${String(error?.message||error)}`)}
}

import React,{useMemo,useState} from 'react'
import {Factory,RefreshCw,ShieldCheck,Package,ClipboardCheck,Download} from 'lucide-react'
import {deriveTechPackLiveEngineering20261031,reconcileTechPackLiveEngineering20261031} from '../core/techPackLiveEngineering20261031.js'
import {deriveTechPackFactoryMaterials20261031,reconcileTechPackFactoryMaterials20261031} from '../core/techPackFactoryMaterials20261031.js'
import {evaluateTechPackProductionGovernance,appendTechPackGovernanceRecord,TECH_PACK_PHYSICAL_CHECKS} from '../core/techPackProductionGovernance20261031.js'
import './TechPackProductionControl20261031.css'

const id=()=> 'tp-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)
const trim=value=>String(value||'').trim()
const currentDate=()=>new Date().toISOString()
const defaultForm={actor:'',role:'',evidenceId:'',evidenceDescription:'',sampleId:'',factoryId:'',recipient:'',comment:'',jurisdiction:'',requirement:''}
export default function TechPackProductionControl20261031({source={},nativeSnapshot=null,project=null,nativeMode=false,
  draft={},workspace={},readiness={},onUpdate=()=>{},onExport=()=>{},onPrint=()=>{}}){
  const [form,setForm]=useState(defaultForm)
  const [check,setCheck]=useState('fit')
  const [scope,setScope]=useState('design')
  const [includeDxf,setIncludeDxf]=useState(false)
  const [releaseText,setReleaseText]=useState('')
  const [feedback,setFeedback]=useState('')
  const governance=workspace.productionGovernance||{}
  const engineering=useMemo(()=>deriveTechPackLiveEngineering20261031({
    snapshot:nativeSnapshot,project,source,nativeMode}),[nativeSnapshot,project,source,nativeMode])
  // A source-content fingerprint identifies the exact garment version when
  // the native API has no authored revision number. It is not factory signoff.
  const revision=source.revision??engineering.sourceRevision??null
  const materials=useMemo(()=>deriveTechPackFactoryMaterials20261031({
    snapshot:nativeSnapshot,source,engineering,draft,
    markerEvidence:workspace.factoryMarkerEvidence}),[nativeSnapshot,source,engineering,draft,workspace.factoryMarkerEvidence])
  const gate=evaluateTechPackProductionGovernance({...source,revision},governance)
  const evidenceComplete=revision!==null&&['actor','role','evidenceId','evidenceDescription'].every(k=>trim(form[k]))
  const evidence=()=>({id:id(),at:currentDate(),sourceRevision:revision,actor:trim(form.actor),
    role:trim(form.role),evidenceId:trim(form.evidenceId),evidenceDescription:trim(form.evidenceDescription)})
  const save=g=>{onUpdate({...workspace,productionGovernance:g});setFeedback('Saved revision-linked record. It remains subject to independent verification.')}
  const add=(collection,record)=>save(appendTechPackGovernanceRecord(governance,collection,record))
  const fail=msg=>setFeedback(msg)
  const edit=(key,value)=>setForm(old=>({...old,[key]:value}))
  const latestSample=(governance.samples||[]).filter(x=>String(x.sourceRevision)===String(revision)).at(-1)
  const saveLive=()=>{
    onUpdate({...workspace,
      liveEngineering:reconcileTechPackLiveEngineering20261031(workspace.liveEngineering||{},engineering),
      factoryMaterials:reconcileTechPackFactoryMaterials20261031(workspace.factoryMaterials||{},materials),
      productionSourceRevision:revision})
    setFeedback('Source-linked patterns, POM, seams, fabrics and editable overrides reconciled; all changed values require review.')
  }
  const sample=()=>{
    if(!evidenceComplete||!trim(form.sampleId))return fail('Provide actual physical sample ID, reviewer and evidence.')
    add('samples',{...evidence(),sampleId:trim(form.sampleId),checks:[],stage:'fit-and-preproduction'})
  }
  const passedCheck=()=>{
    if(!evidenceComplete||!latestSample)return fail('A real sample and evidence are required.')
    save({...governance,samples:(governance.samples||[]).map(s=>s.id!==latestSample.id?s:
      {...s,checks:[...(s.checks||[]),{...evidence(),kind:check,result:'pass'}]})})
  }
  const comment=()=>{
    if(!trim(form.actor)||!trim(form.comment)||revision===null)return fail('Name the reviewer and enter a comment.')
    add('comments',{id:id(),at:currentDate(),actor:trim(form.actor),role:trim(form.role)||'reviewer',
      sourceRevision:revision,status:'open',message:trim(form.comment).slice(0,1200)})
  }
  const resolve=commentId=>{
    if(!evidenceComplete)return fail('Resolving a comment requires named evidence.')
    save({...governance,comments:(governance.comments||[]).map(c=>c.id!==commentId?c:
      {...c,status:'resolved',resolvedBy:evidence()})})
  }
  const requirement=()=>{
    if(!trim(form.requirement)||!trim(form.jurisdiction))return fail('Specify requirement and market jurisdiction.')
    save({...governance,requirements:[...(governance.requirements||[]),{id:id(),
      description:trim(form.requirement),jurisdiction:trim(form.jurisdiction)}]})
  }
  const compliance=()=>{
    const req=(governance.requirements||[]).at(-1)
    if(!evidenceComplete||!req)return fail('Add a requirement and real evidence.')
    add('compliance',{...evidence(),requirementId:req.id,result:'pass'})
  }
  const approval=()=>{
    if(!evidenceComplete)return fail('Named evidence and reviewer are mandatory.')
    if(scope==='factory'&&(!trim(form.factoryId)||!latestSample))return fail('Factory approval must refer to a physical sample and factory.')
    add('approvals',{...evidence(),scope,decision:'approved',
      factoryId:trim(form.factoryId),sampleId:latestSample?.sampleId??null})
  }
  const handoff=()=>{
    if(!evidenceComplete||!trim(form.factoryId)||!trim(form.recipient))return fail('Provide receiving factory, recipient and acceptance evidence.')
    add('handoffs',{...evidence(),factoryId:trim(form.factoryId),recipient:trim(form.recipient),status:'accepted'})
  }
  const readyToRelease=!workspace.demoTechPack&&source.revision!=null&&
    workspace.productionAuthorization?.trustedHostVerification===true&&
    gate.issues.every(x=>x.id==='release')&&
    readiness.ready===true&&evidenceComplete&&trim(form.factoryId)&&
    releaseText==='RELEASE '+trim(draft.sku)
  const release=()=>{
    if(!readyToRelease)return fail('Release blocked by missing physical verification and specification evidence.')
    save({...governance,release:{...evidence(),scope:'production',decision:'approved',
      factoryId:trim(form.factoryId),sampleId:gate.latestSampleId,
      releaseId:id(),verified:true}})
    setReleaseText('')
  }
  const field=(label,key,placeholder='')=><label key={key}>{label}<input value={form[key]} placeholder={placeholder} onChange={e=>edit(key,e.target.value)}/></label>
  return <details className="tpws-production-hub">
    <summary><Factory size={14}/> PRODUCTION ENGINEERING <small>{workspace.demoTechPack?'DEMO · RELEASE BLOCKED':'SOURCE-LINKED'}</small></summary>
    <div className="tpws-production-hub-body">
      <div className="tpws-production-hub-stats">
        <span><b>{engineering.patterns.length}</b>patterns</span>
        <span><b>{engineering.seams.length}</b>seams</span>
        <span><b>{(readiness.counts?.missing||0)+(readiness.counts?.review||0)}</b>checks</span>
      </div>
      <p>All pattern and POM values are source observations until physically verified; unavailable factory data stays blank.</p>
      <button type="button" onClick={saveLive}><RefreshCw size={13}/> Sync live patterns, grade/POM, seams and BOM</button>
      <small>{engineering.grading.coverage==='source'?'Source grading contours available':'Complete graded manufacturing contours unavailable'} · {materials.marker.status==='source-verified'?'Marker evidence linked':'Marker consumption unverified'}</small>
      <section><strong>Production readiness · {readiness.ready?'No open checks':'Review required'}</strong>
        {[...(readiness.missing||[]),...(readiness.review||[])].slice(0,8).map(item=>
          <div key={item.id} className="tpws-production-issue"><b>{item.title}</b><small>{item.reason}</small></div>)}
      </section>
      <section><strong>Reviewer and physical evidence</strong>
        {field('Responsible reviewer','actor','Name, not an automated agent')}
        {field('Role','role','Pattern engineer / factory QA')}
        {field('Evidence ID','evidenceId','Lab test, fit report, signed record')}
        <label>Evidence description<textarea rows={2} value={form.evidenceDescription} onChange={e=>edit('evidenceDescription',e.target.value)} placeholder="Real physical observation and source reference"/></label>
      </section>
      <section><strong>Fit samples and inspections</strong>
        {field('Actual physical sample ID','sampleId','PROTO-01')}
        <button disabled={!evidenceComplete||!trim(form.sampleId)} onClick={sample}>Create evidence-linked sample cycle</button>
        <small>{latestSample?'Sample '+latestSample.sampleId+' · '+(latestSample.checks||[]).length+' checks saved':'No current-revision physical sample'}</small>
        <label>Physical check<select value={check} onChange={e=>setCheck(e.target.value)}>{TECH_PACK_PHYSICAL_CHECKS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        <button disabled={!evidenceComplete||!latestSample} onClick={passedCheck}><ClipboardCheck size={13}/> Record independently observed pass</button>
      </section>
      <section><strong>Revisions and factory comments</strong>
        <label>New factory comment<textarea rows={2} value={form.comment} onChange={e=>edit('comment',e.target.value)}/></label>
        <button disabled={!trim(form.actor)||!trim(form.comment)} onClick={comment}>Add revision-linked comment</button>
        {(governance.comments||[]).slice(-4).map(c=><div key={c.id} className="tpws-production-issue">
          <b>{c.actor}: {c.message}</b><small>{c.status} · revision {c.sourceRevision}</small>
          {c.status!=='resolved'&&<button disabled={!evidenceComplete} onClick={()=>resolve(c.id)}>Resolve with evidence</button>}
        </div>)}
      </section>
      <section><strong>Factory and compliance</strong>
        {field('Factory ID','factoryId','Real manufacturer')}
        {field('Target jurisdiction','jurisdiction','Applicable market')}
        {field('Applicable legal/testing requirement','requirement','Identify the exact requirement')}
        <button disabled={!trim(form.requirement)||!trim(form.jurisdiction)} onClick={requirement}>Add jurisdictional requirement</button>
        <button disabled={!evidenceComplete||!(governance.requirements||[]).length} onClick={compliance}>Record requirement testing evidence</button>
        <label>Approval type<select value={scope} onChange={e=>setScope(e.target.value)}>
          <option value="design">Design review</option><option value="factory">Physical factory sample</option></select></label>
        <button disabled={!evidenceComplete} onClick={approval}>Record explicit evidence-linked approval</button>
        {field('Receiving factory contact','recipient','Named recipient')}
        <button disabled={!evidenceComplete||!trim(form.factoryId)||!trim(form.recipient)} onClick={handoff}>Record factory acceptance with evidence</button>
      </section>
      <section><strong>Manufacturing release gate</strong>
        <small>{gate.issues.length} governance checks · {(readiness.counts?.missing||0)} missing specs · {(readiness.counts?.review||0)} pending reviews. Physical sample evidence, an actual garment revision and authenticated factory authorization are required. Locally typed roles are not verified identities.</small>
        <div className="tpws-production-issues">{gate.issues.slice(0,6).map(item=>
          <div key={item.id} className="tpws-production-issue"><b>{item.title}</b><small>{item.reason}</small></div>)}</div>
        <label>Typed authorization<input value={releaseText} placeholder={'RELEASE '+trim(draft.sku||'STYLE-ID')} onChange={e=>setReleaseText(e.target.value)}/></label>
        <button disabled={!readyToRelease} onClick={release}><ShieldCheck size={13}/> Authorize source-matched production release</button>
        {workspace.demoTechPack&&<small>EXO Nike T-shirt example: no commercial Nike trademark rights or factory approval; release disabled.</small>}
      </section>
      <section><strong>Editable handoff and print</strong>
        <label className="tpws-production-check"><input type="checkbox" checked={includeDxf} onChange={e=>setIncludeDxf(e.target.checked)}/> Guarded DXF only when verified</label>
        <button type="button" onClick={()=>onExport({includeVerifiedPatterns:includeDxf})}><Package size={13}/> Download draft factory ZIP</button>
        <button type="button" onClick={onPrint}><Download size={13}/> Print Tech Pack / Save as PDF</button>
        <small>Package includes XLSX, editable document, printable HTML, reference images, integrity hashes and release limitations.</small>
      </section>
      {feedback&&<p role="status" className="tpws-production-feedback">{feedback}</p>}
    </div>
  </details>
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {fileURLToPath} from 'node:url'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// These are disposable, self-signed fixtures, not factory or third-party CAD approvals.
const project=createTeeTemplate()
const files=buildFactoryPackageFiles(project)
const archive=zipSync(files,{level:6})
const revision='disposable-machine-admission-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,revision)
assert.equal(draft.status,'draft_for_external_review')
const options={sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}}
const noAuthorization=result=>{
  for(const key of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized','factoryCertified',
    'bulkProductionAuthorized'])assert.equal(result[key],false,key)
}

async function holdIndependentMachineSlot(index){
  const lock=`/private/tmp/exo-clothcraft-v2-signed-receiver-${process.getuid()}/slot-${index}.lock`
  const child=spawn('/usr/bin/lockf',['-k','-t','0',lock,'/bin/sh','-c',
    'printf READY; exec /bin/sleep 30'],{detached:true,stdio:['ignore','pipe','pipe']})
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('lock holder startup timed out')),3000)
    child.once('error',error=>{clearTimeout(timeout);reject(error)})
    child.once('exit',code=>{clearTimeout(timeout);reject(Error(`holder exited ${code}`))})
    child.stdout.once('data',chunk=>{
      clearTimeout(timeout)
      if(chunk.toString()!=='READY')reject(Error('holder not ready'))
      else resolve()
    })
  })
  return child
}
function stopHolder(child){
  if(!child)return
  try{process.kill(-child.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const slotPath=index=>`/private/tmp/exo-clothcraft-v2-signed-receiver-${process.getuid()}/slot-${index}.lock`

test('independent OS lock holders enforce two machine-wide receiver slots and recover',
  {skip:process.platform!=='darwin',timeout:90000},async()=>{
    // Initialize the private lock directory using the real receiver. This
    // deliberately malformed ZIP is rejected by the child without approval.
    const initial=await inspect(project,new Uint8Array(22),options)
    assert.equal(initial.status,'BLOCKED')
    let first,second
    try{
      first=await holdIndependentMachineSlot(0)
      second=await holdIndependentMachineSlot(1)
      const saturated=await inspect(project,archive,options)
      assert.equal(saturated.status,'BLOCKED')
      assert.equal(saturated.issues[0]?.code,'ZIP_ISOLATED_CAPACITY')
      noAuthorization(saturated)

      stopHolder(second)
      // Wait for the OS to release the lock rather than assuming SIGKILL
      // synchronously frees the worker's advisory lock.
      let recovered
      for(let attempt=0;attempt<30;attempt++){
        recovered=await inspect(project,archive,options)
        if(recovered.issues?.[0]?.code!=='ZIP_ISOLATED_CAPACITY')break
        await pause(100)
      }
      assert.equal(recovered.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',
        JSON.stringify(recovered.issues))
      noAuthorization(recovered)
      second=null
    }finally{
      stopHolder(first)
      stopHolder(second)
    }

    const forged=zipSync({...files,
      'receiver-cad-acceptance.json':strToU8('{"licensedReceiverCadAccepted":true,"physicalCuttingAuthorized":true}')},
      {level:6})
    const rejected=await inspect(project,forged,options)
    assert.equal(rejected.status,'BLOCKED')
    noAuthorization(rejected)
  })

test('a separate real Node receiving parent consumes the second machine slot',
  {skip:process.platform!=='darwin',timeout:90000},async()=>{
    let holder,external
    try{
      holder=await holdIndependentMachineSlot(0)
      const runner=fileURLToPath(new URL('./industrialSignedFactoryZipCrossProcessChild20261031.mjs',import.meta.url))
      external=spawn(process.execPath,[runner],{stdio:['ignore','pipe','pipe']})
      let output='',errors=''
      external.stdout.on('data',data=>{output+=data.toString()})
      external.stderr.on('data',data=>{errors+=data.toString()})
      const finished=new Promise((resolve,reject)=>{
        external.once('error',reject)
        external.once('close',code=>{
          if(code!==0)return reject(Error(`independent parent exit ${code}: ${errors}`))
          try{resolve(JSON.parse(output))}catch(error){reject(error)}
        })
      })
      let occupied=false
      for(let attempt=0;attempt<120;attempt++){
        if(external.exitCode!==null)break
        const probe=spawnSync('/usr/bin/lockf',['-k','-t','0',slotPath(1),'/usr/bin/true'],
          {stdio:'ignore',timeout:1000})
        if(probe.status===75){occupied=true;break}
        await pause(100)
      }
      assert.equal(occupied,true,`independent parent did not occupy slot: ${errors} ${output}`)
      const refused=await inspect(project,archive,options)
      assert.equal(refused.issues?.[0]?.code,'ZIP_ISOLATED_CAPACITY')
      noAuthorization(refused)
      const childResult=await finished
      assert.equal(childResult.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',
        JSON.stringify(childResult.issues))
      assert.equal(childResult.physicalCuttingAuthorized,false)
      assert.equal(childResult.licensedReceiverCadAccepted,false)
    }finally{
      stopHolder(holder)
      if(external?.exitCode===null){try{external.kill('SIGKILL')}catch{}}
    }
  })

// Safe and read-only. Before using CLO's GUI export, confirm its documented
// minimum free disk space, commercial use license and derivative distribution.
// Never automatically drives, bypasses, or modifies the CLO application.
import fs from 'node:fs'
import os from 'node:os'

const gb=1024**3
const minimumFree=10*gb
const {bsize,bavail}=fs.statfsSync(os.homedir(),{bigint:false})
const free=bsize*bavail
const licenseClass=process.env.EXO_CLO_LICENSE_CLASS||'academic'
const rights=process.env.EXO_CLO_RAW_GLB_RIGHTS==='express-permission'
const blockers=[]
if(free<minimumFree)blockers.push('CLO warned that less than 10 GiB free space may damage an FBX export')
if(!['individual-commercial','business-commercial'].includes(licenseClass))
  blockers.push('Current confirmed license is Academic; commercial use not authorized by this session')
if(!rights)blockers.push('Public website distribution rights for raw CLO avatar derivatives have not been confirmed')
const report={schema:'exo.clo.export.preflight.v1',checkedHome:os.homedir(),
  freeSpaceGiB:Number((free/gb).toFixed(2)),minimumRecommendedGiB:10,
  diskSpaceSafe:free>=minimumFree,licenseClass,rawDerivativePermissionVerified:rights,
  commercialWebsiteEligible:blockers.length===0,blockers,
  note:'Only a diagnostic. No avatar exported, files deleted or subscription changed.'}
console.log('EXO_CLO_AVATAR_EXPORT_PREFLIGHT',JSON.stringify(report,null,2))
if(blockers.length)process.exitCode=1

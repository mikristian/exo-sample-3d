// Disposable test-only independent Node parent, not a production endpoint.
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

const project=createTeeTemplate()
const archive=zipSync(buildFactoryPackageFiles(project),{level:6})
const revision='disposable-independent-node-parent-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,revision)
const result=await inspect(project,archive,{
  sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')},
})
process.stdout.write(JSON.stringify({status:result.status,issues:result.issues,
  physicalCuttingAuthorized:result.physicalCuttingAuthorized,
  licensedReceiverCadAccepted:result.licensedReceiverCadAccepted}))

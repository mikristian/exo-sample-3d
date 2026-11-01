// Explicit factory governance records are claims with named evidence; this module
// validates their completeness and revision scope, not the physical truth of a test.
const entries = value => Array.isArray(value) ? value : []
const present = value => typeof value === 'string' && value.trim().length > 0
const validTime = value => present(value) && Number.isFinite(Date.parse(value))
const revisionKey = value => (typeof value === 'string' && value.trim()) || (Number.isSafeInteger(value) && String(value)) || null
const issue = (id, title, reason) => ({id, title, reason})
const evidenced = record => record && present(record.actor) && present(record.role) && validTime(record.at) &&
  present(record.evidenceId) && present(record.evidenceDescription)
const forRevision = (record, current) => !!current && revisionKey(record?.sourceRevision) === current
const approved = (record, current) => record?.decision === 'approved' && evidenced(record) && forRevision(record, current)

export const TECH_PACK_PHYSICAL_CHECKS = Object.freeze(['fit', 'measurements', 'materials', 'labels', 'construction'])
export const TECH_PACK_GOVERNANCE_PERMISSIONS = Object.freeze({
  designer: Object.freeze(['comment', 'sample-review']),
  'design-lead': Object.freeze(['comment', 'sample-review', 'design-approve']),
  'factory-qa': Object.freeze(['comment', 'sample-review', 'factory-approve', 'compliance-verify', 'handoff-accept']),
  'production-manager': Object.freeze(['comment', 'sample-review', 'design-approve', 'factory-approve', 'compliance-verify', 'handoff-accept', 'release'])
})

/** Advisory UI permission based on the authenticated role supplied by the host.
 * Host must independently authorize and audit writes; a client role is not identity proof. */
export function canPerformTechPackGovernanceAction(role, action) {
  return Object.hasOwn(TECH_PACK_GOVERNANCE_PERMISSIONS, role) && TECH_PACK_GOVERNANCE_PERMISSIONS[role].includes(action)
}

/** Append-only authoring helper. Callers persist the returned record explicitly. */
export function appendTechPackGovernanceRecord(governance = {}, collection, record) {
  if (!['samples', 'approvals', 'comments', 'handoffs', 'compliance'].includes(collection)) throw new TypeError('Unknown governance collection')
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('A governance record is required')
  return {...governance, [collection]: [...entries(governance?.[collection]), {...record}]}
}

/** No default compliance claims: the factory specifies applicable requirements. */
export function evaluateTechPackProductionGovernance(source = {}, governance = {}) {
  const current = revisionKey(source?.revision)
  const issues = []
  const add = (condition, id, title, reason) => { if (!condition) issues.push(issue(id, title, reason)) }
  add(!!current, 'revision', 'Production source revision', 'Save an identifiable source revision before physical review')

  const cycles = entries(governance?.samples).filter(sample => forRevision(sample, current) && present(sample.id) && validTime(sample.at) && present(sample.sampleId))
  const latestCycle = cycles.at(-1)
  add(!!latestCycle, 'sample-cycle', 'Physical sample cycle', 'Identify a dated physical sample and its source revision')
  const physicalChecks = entries(latestCycle?.checks)
  const missingChecks = TECH_PACK_PHYSICAL_CHECKS.filter(kind => !physicalChecks.some(check =>
    check?.kind === kind && check?.result === 'pass' && evidenced(check)))
  add(!!latestCycle && missingChecks.length === 0, 'physical-tests', 'Sample verification evidence',
    `Record observed evidence for physical checks: ${missingChecks.join(', ') || 'all required checks'}`)
  const physicalApproved = !!latestCycle && missingChecks.length === 0

  const requirements = entries(governance?.requirements)
  add(requirements.length > 0 && requirements.every(requirement => present(requirement?.id) &&
    present(requirement?.description) && present(requirement?.jurisdiction)),
  'compliance-scope', 'Applicable compliance requirements', 'Document each applicable requirement and jurisdiction')
  const compliance = entries(governance?.compliance)
  const outstandingCompliance = requirements.filter(requirement => !compliance.some(record =>
    record?.requirementId === requirement.id && record?.result === 'pass' && evidenced(record) && forRevision(record, current)))
  add(requirements.length > 0 && outstandingCompliance.length === 0, 'compliance-evidence',
    'Compliance verification', 'Attach revision-linked test or documentation evidence for each applicable requirement')

  const comments = entries(governance?.comments)
  const unresolved = comments.filter(comment => forRevision(comment, current) && comment?.status !== 'resolved')
  add(unresolved.length === 0, 'comments', 'Open review comments', 'Resolve all current-revision factory review comments')
  const approvals = entries(governance?.approvals)
  const designApproval = approvals.some(record => record?.scope === 'design' && approved(record, current))
  const factoryApproval = approvals.some(record => record?.scope === 'factory' && approved(record, current) &&
    present(record.factoryId) && !!latestCycle && record.sampleId === latestCycle.sampleId)
  add(designApproval, 'design-approval', 'Design approval', 'Record an explicit design approval with actor, role and evidence')
  add(factoryApproval && physicalApproved, 'sample-review', 'Factory physical approval',
    'Record explicit factory approval and completed physical tests for this revision')

  const handoff = entries(governance?.handoffs).some(record => record?.status === 'accepted' &&
    evidenced(record) && forRevision(record, current) && present(record.factoryId) && present(record.recipient))
  add(handoff, 'factory-handoff', 'Factory handoff acceptance', 'Record receiving factory, recipient and evidence of acceptance')
  const release = governance?.release
  const releaseRecorded = approved(release, current) && release?.scope === 'production' &&
    present(release?.factoryId) && release.sampleId === latestCycle?.sampleId
  add(releaseRecorded, 'release', 'Production release authorization', 'Record explicit approved production release for the source revision')
  return {sourceRevision: current, physicalApproved, designApproval, factoryApproval, handoff,
    releaseReady: issues.length === 0, issues, counts: {review: issues.length},
    latestSampleId: latestCycle?.sampleId ?? null}
}

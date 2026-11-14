import {buildExoFashionProductDevelopment20261102} from './exoFashionProductDevelopment20261102.js'

export const EXO_DEVELOPMENT_NODES = Object.freeze([
  {id:'brief',title:'Brief',dependsOn:[],studioStep:0},
  {id:'pattern',title:'Pattern',dependsOn:['brief'],studioStep:1},
  {id:'bom',title:'BOM',dependsOn:['pattern'],studioStep:2},
  {id:'cost',title:'Cost',dependsOn:['bom'],studioStep:3},
  {id:'techpack',title:'Tech Pack',dependsOn:['pattern','bom'],studioStep:4},
  {id:'qa',title:'QA / Handoff',dependsOn:['cost','techpack'],studioStep:4},
])

/** Derive evidence and review statuses exclusively from the open project and native engine. */
export function buildExoDevelopmentWorkflowGraph20261102(project, options = {}) {
  const report = options.report || buildExoFashionProductDevelopment20261102({project, ...options})
  const pieces = Array.isArray(project?.pieces) ? project.pieces : []
  const hasPattern = pieces.length > 0
  const hasBrief = Boolean(options.brief?.name?.trim() || project?.name?.trim() || hasPattern)
  const hasBom = report.bom.length > 0
  const hasPricedBom = hasBom && report.bom.every(row => row.costPerUnit !== null)
  const techPack = project?.techPackStudio
  const hasTechPack = Boolean(techPack?.draft || techPack?.pages?.length || techPack?.specifications?.length)
  const getIssues = scopes => report.blockers.filter(item => scopes.some(scope => item.scope === scope || item.scope?.startsWith(scope + '.')))
  const details = {
    brief:{status:hasBrief?'review_required':'missing',evidence:[hasBrief ? 'Project brief or pattern context exists.' : 'Enter a garment brief in Fashion Development Studio.'],issues:[],action:'Open design brief'},
    pattern:{status:!hasPattern?'missing':report.geometry.QA?.status==='pass'?'review_required':'blocked',evidence:[`${pieces.length} native pattern piece(s)`,`Native geometry QA: ${report.geometry.QA?.status || 'not available'}`],issues:getIssues(['geometry']),action:'Inspect native patterns'},
    bom:{status:!hasBom?'missing':hasPricedBom?'review_required':'incomplete',evidence:[`${report.bom.length} material row(s)`,hasPricedBom?'All listed material costs present.':'Supplier prices and material consumption require review.'],issues:getIssues(['bom']),action:'Edit bill of materials'},
    cost:{status:report.costing.totalCostPerUnit !== null?'review_required':'incomplete',evidence:[report.costing.totalCostPerUnit === null?'Unit cost cannot yet be completed.':`Estimated unit cost: ${report.costing.currency} ${report.costing.totalCostPerUnit.toFixed(2)}`,`Missing inputs: ${report.costing.missingCosts.join(', ') || 'none'}`],issues:getIssues(['cost','marker']),action:'Review cost and marker'},
    techpack:{status:hasTechPack?'review_required':'missing',evidence:[hasTechPack?'Tech pack workspace content exists.':'No saved tech pack draft detected.', 'Technical specifications and physical samples require human approval.'],issues:[],action:'Open tech pack workspace'},
    qa:{status:report.blockers.length?'blocked':'review_required',evidence:[`${report.blockers.length} native blocker(s), ${report.warnings.length} warning(s)`,`Production approvals open: ${report.handoff.checklist.filter(item=>!item.complete).length}`],issues:report.blockers,action:'Review QA and handoff'},
  }
  return {
    schema:'exo.development-workflow.v1',
    generatedAt:options.generatedAt || new Date().toISOString(),
    nodes:EXO_DEVELOPMENT_NODES.map(node=>({...node,...details[node.id]})),
    report,
    productionApproved:false,
  }
}

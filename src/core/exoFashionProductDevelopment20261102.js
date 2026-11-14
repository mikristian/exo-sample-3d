import { buildMarker } from './marker.js'
import { inspectIndustrialPatterns } from './industrialPatternQA.js'

// All pattern coordinates supplied to the native marker and QA are centimeters.
// This module produces estimates and review tasks; it never authorizes production.
const finite = (n) => typeof n === 'number' && Number.isFinite(n)
const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const validMoney = (n) => finite(n) && n >= 0 && n <= 1e9
const issue = (code, message, scope = 'product') => ({code, message, scope})
const boundedText = (value, fallback = '') => typeof value === 'string' ? value.trim().slice(0, 160) : fallback

/**
 * Read-only planning from native EXO centimeter-based project geometry.
 * Material rows: {id,name,category,quantityPerUnit,unit,costPerUnit,fabricId?}.
 * Fabric costs are prices per linear meter; yield is a single-layer marker
 * preview and requires physical sampling, shrinkage and cutting confirmation.
 */
export function buildExoFashionProductDevelopment20261102({
  project, retailPrice = null, orderQuantity = 1, materials = [],
  laborCostPerUnit = null, otherCostPerUnit = null, currency = 'USD',
  fabricWidthsCm = {}, fabricCostPerMeter = {}, markerGapCm = 1.5,
} = {}) {
  const blockers = [], warnings = [], assumptions = []
  if (!project || !Array.isArray(project.pieces) || project.pieces.length === 0 || project.pieces.length > 200)
    blockers.push(issue('INVALID_PATTERN', 'Supply a garment with 1–200 native pattern pieces.', 'geometry'))
  if (!Number.isSafeInteger(orderQuantity) || orderQuantity < 1 || orderQuantity > 1000000)
    blockers.push(issue('INVALID_ORDER_QUANTITY', 'Order quantity must be an integer between 1 and 1,000,000.', 'cost'))
  if (retailPrice !== null && !validMoney(retailPrice))
    blockers.push(issue('INVALID_RETAIL_PRICE', 'Retail price must be a nonnegative finite amount.', 'cost'))
  if (laborCostPerUnit !== null && !validMoney(laborCostPerUnit))
    blockers.push(issue('INVALID_LABOR_COST', 'Labor cost must be a nonnegative finite amount.', 'cost'))
  if (otherCostPerUnit !== null && !validMoney(otherCostPerUnit))
    blockers.push(issue('INVALID_OTHER_COST', 'Other cost must be a nonnegative finite amount.', 'cost'))
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))
    blockers.push(issue('INVALID_CURRENCY', 'Currency must be an ISO-style uppercase three-letter code.', 'cost'))
  if (!finite(markerGapCm) || markerGapCm < 0 || markerGapCm > 50)
    blockers.push(issue('INVALID_MARKER_GAP', 'Marker spacing must be between 0 and 50 centimeters.', 'marker'))
  if (!Array.isArray(materials) || materials.length > 200)
    blockers.push(issue('INVALID_MATERIALS', 'Materials must be an array with at most 200 rows.', 'bom'))
  const rows = [], seen = new Set()
  for (const [index, raw] of (Array.isArray(materials) ? materials.slice(0, 200) : []).entries()) {
    const id = boundedText(raw?.id)
    const name = boundedText(raw?.name)
    const unit = boundedText(raw?.unit)
    const quantity = raw?.quantityPerUnit
    const price = raw?.costPerUnit
    if (!id || seen.has(id) || !name || !unit || !finite(quantity) || quantity <= 0 || quantity > 1e7 ||
      (price !== null && price !== undefined && !validMoney(price))) {
      blockers.push(issue('INVALID_BOM_ROW', 'Material row must have unique ID, name, unit, positive quantity and valid optional price.', `bom.${index}`))
      continue
    }
    seen.add(id)
    rows.push({id, name, category:boundedText(raw.category,'component'), quantityPerUnit:quantity,
      unit, costPerUnit:price ?? null, totalCostPerGarment:price == null ? null : money(price * quantity),
      fabricId:boundedText(raw.fabricId) || null, source:'user_provided', verified:false})
  }
  let qa = null
  const markers = []
  if (!blockers.some(b => b.scope === 'geometry') && project.pieces.length <= 200 &&
      project.pieces.every(p => Array.isArray(p?.points) && p.points.length >= 3 && p.points.length <= 5000)) {
    try {
      qa = inspectIndustrialPatterns(project)
      for (const problem of qa.issues.slice(0, 100)) blockers.push(issue(problem.code, problem.message, problem.scope))
      if (qa.issues.length > 100) warnings.push(issue('QA_ISSUES_TRUNCATED', 'Further QA issues omitted.', 'geometry'))
    } catch (error) {
      blockers.push(issue('GEOMETRY_QA_FAILED', boundedText(error?.message, 'Pattern QA failed.'), 'geometry'))
    }
  } else if (!blockers.some(b => b.scope === 'geometry')) {
    blockers.push(issue('PATTERN_COMPLEXITY_LIMIT', 'Each pattern piece must have 3–5000 vertices.', 'geometry'))
  }
  const fabricIds = [...new Set((project?.pieces || []).slice(0, 200).map(p => p?.fabricId || 'main'))]
  const totalCutDemand = (project?.pieces || []).reduce((sum,p) => sum + (Number.isSafeInteger(p?.cutQuantity) ? p.cutQuantity : 0),0)
  if (totalCutDemand > 500) blockers.push(issue('MARKER_DEMAND_LIMIT', 'Marker preview is limited to 500 cut-piece instances.', 'marker'))
  for (const fabricId of fabricIds) {
    const widthCm = fabricWidthsCm?.[fabricId] ?? project?.markerSettings?.fabricWidthsCm?.[fabricId] ?? null
    const price = fabricCostPerMeter?.[fabricId] ?? null
    if (!finite(widthCm) || widthCm <= 0 || widthCm > 1000) {
      warnings.push(issue('FABRIC_WIDTH_REQUIRED', `Provide a valid fabric width for ${fabricId} before estimating yield.`, fabricId))
      continue
    }
    if (price !== null && !validMoney(price)) {
      blockers.push(issue('INVALID_FABRIC_PRICE', `Invalid price per linear meter for ${fabricId}.`, fabricId))
      continue
    }
    if (totalCutDemand > 500) continue
    try {
      const preview = buildMarker(project, widthCm, markerGapCm, {fabricId, strictProductionDemand:true})
      const lengthMeters = preview.length / 100
      const complete = preview.requestedPieces > 0 && preview.unusedPieces === 0
      markers.push({fabricId, widthCm, lengthCm:preview.length, lengthMeters, gapCm:markerGapCm,
        efficiency:preview.efficiency, requestedPieces:preview.requestedPieces,
        unplaced:preview.unplaced, placedPieces:preview.placements.length,
        estimatedFabricCostPerGarment:price === null || !complete ? null : money(price * lengthMeters),
        complete, method:'native_single_layer_marker_preview', certified:false})
      if (!complete) blockers.push(issue('INCOMPLETE_MARKER', `Pattern pieces for ${fabricId} could not all be placed.`, fabricId))
    } catch (error) {
      blockers.push(issue('MARKER_REFUSED', boundedText(error?.message,'Native marker refused input.'), fabricId))
    }
  }
  const includedFabricIds = new Set(rows.map(row => row.fabricId).filter(Boolean))
  let fabricCost = 0
  let missingCosts = rows.filter(row => row.totalCostPerGarment === null).map(row => row.id)
  for (const marker of markers) {
    if (includedFabricIds.has(marker.fabricId)) {
      warnings.push(issue('FABRIC_COST_POSSIBLE_DUPLICATION', `Fabric ${marker.fabricId} is also in the BOM; use one costing route.`, marker.fabricId))
      continue
    }
    if (marker.estimatedFabricCostPerGarment === null) missingCosts.push(`fabric:${marker.fabricId}`)
    else fabricCost += marker.estimatedFabricCostPerGarment
  }
  for (const id of fabricIds) if (!markers.some(marker => marker.fabricId === id) && !includedFabricIds.has(id))
    missingCosts.push(`fabric:${id}`)
  if (laborCostPerUnit === null) missingCosts.push('labor')
  if (otherCostPerUnit === null) missingCosts.push('other')
  missingCosts = [...new Set(missingCosts)]
  const materialCost = rows.reduce((sum,row) => sum + (row.totalCostPerGarment || 0),0)
  const subtotal = money(materialCost + fabricCost + (laborCostPerUnit || 0) + (otherCostPerUnit || 0))
  const completeCost = missingCosts.length === 0
  const totalCostPerUnit = completeCost ? subtotal : null
  const grossMarginPerUnit = completeCost && retailPrice !== null ? money(retailPrice - subtotal) : null
  const grossMarginPercent = grossMarginPerUnit !== null && retailPrice > 0 ? money(grossMarginPerUnit / retailPrice * 100) : null
  if (missingCosts.length) warnings.push(issue('INCOMPLETE_COST_INPUTS', `Missing costing inputs: ${missingCosts.join(', ').slice(0, 350)}.`, 'cost'))
  if (retailPrice === null) warnings.push(issue('RETAIL_PRICE_REQUIRED', 'Provide a retail price to estimate gross margin.', 'cost'))
  assumptions.push('Marker length estimates one cutting layer with native pattern cut quantities, width and spacing.')
  assumptions.push('No shrinkage, defects, lay planning, nap/print repeats, taxes, duties, freight, overhead or supplier quotations are inferred.')
  assumptions.push('Gross margin is price less listed per-unit costs; it is not net profit or a factory quote.')
  const checklist = [
    {id:'geometry', label:'Native graded geometry and seam QA pass', complete:qa?.status === 'pass'},
    {id:'cutting', label:'All fabric markers fully placed and manufacturer checked', complete:false},
    {id:'bom', label:'BOM items specified and priced', complete:rows.length > 0 && rows.every(r => r.costPerUnit !== null)},
    {id:'cost', label:'All cost inputs supplied', complete:completeCost && retailPrice !== null},
    {id:'fit', label:'Physical fit sample approved', complete:false},
    {id:'factory', label:'Factory confirms materials, grading, tolerances, machinery and quality plan', complete:false},
    {id:'techpack', label:'Production tech pack and signed size specs reviewed', complete:false},
  ]
  const score = Math.max(0, 100 - blockers.length * 20 - warnings.length * 5 - checklist.filter(item => !item.complete).length * 5)
  return {
    ok:blockers.length === 0, status:blockers.length ? 'blocked':'review_required',
    blockers, warnings, assumptions,
    geometry:{pieceCount:project?.pieces?.length ?? 0, QA:qa, seamReports:qa?.seamReports || []},
    markers, bom:rows,
    costing:{currency, retailPrice, orderQuantity, materialCost:money(materialCost), estimatedFabricCost:money(fabricCost),
      laborCostPerUnit, otherCostPerUnit, partialCostPerUnit:subtotal,
      totalCostPerUnit, grossMarginPerUnit, grossMarginPercent,
      orderCost:completeCost ? money(subtotal * orderQuantity) : null, missingCosts},
    feasibility:{score, grade:blockers.length ? 'blocked' : score >= 75 ? 'promising' : 'needs_review',
      reviewRequired:true, factoryCertified:false},
    handoff:{checklist, factoryCertified:false, approvedForCutting:false},
    method:'geometry_grounded_rule_based_v1', trainedModelUsed:false,
  }
}

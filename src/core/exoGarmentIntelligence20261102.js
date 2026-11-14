// Evidence-based, read-only garment development checks. These checks are not
// geometric seam walking, cloth simulation, fit testing, or factory approval.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const list = value => Array.isArray(value) ? value : []
const filled = value => typeof value === 'string' && value.trim().length > 0
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const priority = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const hasPom = pom => Array.isArray(pom) ? pom.some(item => object(item) && (filled(item.name) || filled(item.label))) : object(pom) && Object.values(pom).some(value => value !== null && value !== '' && (typeof value !== 'object' || Object.keys(value).length > 0))

/**
 * Evaluate a native EXO project and optional nativeTechPackDocument.
 * Input objects are never mutated; missing data is reported as unverified.
 * issue IDs are stable and may be used to navigate the checklist in a future UI.
 */
export function diagnoseExoGarment20261102(project, techPackDocument = null) {
  const issues = []
  const add = (code, severity, area, message, action, evidence = {}) => issues.push({
    id: `${area}:${code}${evidence.pieceId ? `:${evidence.pieceId}` : ''}${evidence.seamId ? `:${evidence.seamId}` : ''}`,
    code, severity, area, message, action, evidence,
  })
  if (!object(project)) {
    add('project_missing', 'critical', 'pattern', 'No garment project supplied.', 'Open or create a pattern project.')
    return finish(issues, { pieceCount: 0, seamCount: 0, sizeCount: 0, techPackPresent: false })
  }

  const pieces = list(project.pieces)
  const seams = list(project.seams)
  const byId = new Map()
  if (!pieces.length) add('pieces_missing', 'critical', 'pattern', 'There are no pattern pieces.', 'Create pattern pieces before evaluating construction.')
  for (const [index, piece] of pieces.entries()) {
    const pieceId = filled(piece?.id) ? piece.id : `index-${index}`
    const at = { pieceId }
    if (byId.has(pieceId)) add('duplicate_piece_id', 'critical', 'pattern', `Duplicate piece ID ${pieceId}.`, 'Give each pattern piece a unique ID.', at)
    else byId.set(pieceId, piece)
    const points = list(piece?.points)
    if (points.length < 3 || points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y)))
      add('invalid_outline', 'critical', 'pattern', `${pieceId} lacks a usable point outline.`, 'Provide at least three finite 2D points.', at)
    if (!filled(piece?.name)) add('piece_name_missing', 'medium', 'pattern', `${pieceId} has no piece name.`, 'Name the piece for cutting documentation.', at)
    if (!positive(piece?.seamAllowance)) add('seam_allowance_missing', 'high', 'construction', `${pieceId} has no positive default seam allowance.`, 'Specify a positive seam allowance in project units.', at)
    if (!Number.isFinite(piece?.grainAngleDeg)) add('grain_direction_missing', 'medium', 'construction', `${pieceId} has no defined grain angle.`, 'Specify a grain direction before cutting.', at)
    if (!filled(piece?.fabricId) || !object(project.fabrics?.[piece.fabricId]))
      add('fabric_assignment_missing', 'high', 'materials', `${pieceId} references no defined fabric.`, 'Assign a fabric from the project fabric catalog.', at)
    for (const [edge, width] of Object.entries(object(piece?.edgeSeamAllowances) ? piece.edgeSeamAllowances : {})) {
      if (!Number.isInteger(Number(edge)) || Number(edge) < 0 || Number(edge) >= points.length || !positive(width))
        add('invalid_edge_allowance', 'high', 'construction', `${pieceId} has an invalid per-edge seam allowance on edge ${edge}.`, 'Use a valid edge index and positive allowance.', { ...at, edgeIndex: edge })
    }
    const notchIds = new Set()
    for (const [notchIndex, notch] of list(piece?.notches).entries()) {
      if (!Number.isInteger(notch?.edgeIndex) || notch.edgeIndex < 0 || notch.edgeIndex >= points.length ||
        !Number.isFinite(notch?.t) || notch.t < 0 || notch.t > 1) {
        add('invalid_notch', 'high', 'construction', `${pieceId} has an invalid notch at position ${notchIndex}.`, 'Locate the notch on an existing edge with a normalized position between 0 and 1.', { ...at, notchIndex })
      }
      if (filled(notch?.id)) {
        if (notchIds.has(notch.id)) add('duplicate_notch_id', 'medium', 'construction', `${pieceId} repeats notch ID ${notch.id}.`, 'Use distinct notch IDs per pattern piece.', { ...at, notchIndex })
        notchIds.add(notch.id)
      }
    }
  }

  if (!seams.length && pieces.length > 0) add('seams_missing', 'high', 'construction', 'No sewing pairs are documented.', 'Connect the intended stitch edges as sewing pairs.')
  const seenSeams = new Set()
  for (const [index, seam] of seams.entries()) {
    const seamId = filled(seam?.id) ? seam.id : `index-${index}`
    if (seenSeams.has(seamId)) add('duplicate_seam_id', 'high', 'construction', `Duplicate seam ID ${seamId}.`, 'Give each sewing pair a unique ID.', { seamId })
    seenSeams.add(seamId)
    for (const side of ['a', 'b']) {
      const endpoint = seam?.[side]
      const target = byId.get(endpoint?.pieceId)
      if (!target || !Number.isInteger(endpoint?.edgeIndex) || endpoint.edgeIndex < 0 || endpoint.edgeIndex >= list(target.points).length)
        add('invalid_seam_endpoint', 'critical', 'construction', `${seamId} references an unknown piece or edge on side ${side}.`, 'Connect the seam to an existing piece and edge.', { seamId, side })
    }
  }
  if (seams.length) {
    const linked = new Set(seams.flatMap(s => [s?.a?.pieceId, s?.b?.pieceId]))
    for (const piece of pieces) if (filled(piece?.id) && !linked.has(piece.id))
      add('unlinked_piece', 'medium', 'construction', `${piece.id} is not referenced by a sewing pair.`, 'Check whether the piece needs sewing instructions or is intentionally separate.', { pieceId: piece.id })
  }
  const notches = pieces.flatMap(piece => list(piece?.notches))
  if (seams.length && notches.length === 0) add('notches_missing', 'medium', 'construction', 'No alignment notches were supplied.', 'Add relevant matched notches for sewing and assembly.')
  if (notches.length && !notches.some(notch => filled(notch?.matchGroupId) || filled(notch?.matchedSeamId)))
    add('notch_matching_unverified', 'low', 'construction', 'Notches are present but no explicit seam or match-group links were found.', 'Associate construction notches with their matching seam when applicable.')

  const grading = project.grading
  const sizes = list(grading?.sizes)
  if (!sizes.length) add('grading_missing', 'high', 'grading', 'No graded size run was supplied.', 'Define the intended sizes and a base size.')
  else {
    if (sizes.some(size => !filled(size)) || new Set(sizes).size !== sizes.length)
      add('grading_sizes_invalid', 'high', 'grading', 'Size names are missing or duplicated.', 'Use a unique, nonempty name for each size.')
    if (!sizes.includes(grading?.baseSize)) add('grading_base_missing', 'high', 'grading', 'Base size is absent from the size run.', 'Choose a base size included in the size run.')
    if (sizes.length < 2) add('single_size_only', 'medium', 'grading', 'Only one size is defined.', 'Add graded sizes if a size run is intended.')
    else if (!positive(grading?.widthPerSizeCm) && !positive(grading?.lengthPerSizeCm) && !object(grading?.rules) && !Array.isArray(grading?.rules))
      add('grading_rules_unverified', 'medium', 'grading', 'No explicit grade increments or rules were found.', 'Provide grading rules and verify each graded size.')
  }

  const draft = object(techPackDocument?.draft) ? techPackDocument.draft : object(techPackDocument) ? techPackDocument : null
  if (!draft) add('techpack_missing', 'high', 'techpack', 'No tech-pack draft was supplied.', 'Create a technical package with specifications and factory instructions.')
  else {
    for (const field of ['styleName', 'sku']) if (!filled(draft[field]))
      add(`techpack_${field}_missing`, 'medium', 'techpack', `Tech-pack ${field} is missing.`, `Enter the ${field} in the tech pack.`)
    if (!hasPom(draft.pom)) add('pom_missing', 'high', 'techpack', 'No points-of-measure specification was supplied.', 'Add finished garment measurements with size references and tolerances.')
    if (!list(draft.bom).length) add('bom_missing', 'high', 'materials', 'The bill of materials is empty.', 'Document main fabric, trims, components, units and quantities.')
    else for (const [index, line] of draft.bom.entries()) {
      if (!object(line) || !(filled(line.name) || filled(line.description) || filled(line.material)))
        add('bom_item_incomplete', 'medium', 'materials', `BOM row ${index + 1} is missing a component description.`, 'Give each BOM component a material or description.', { row: index })
    }
    if (!list(draft.references).length) add('references_missing', 'low', 'techpack', 'No construction reference images or documents are listed.', 'Attach relevant design and construction references.')
  }

  if (!pieces.some(piece => positive(piece?.seamAllowance))) {
    add('cutting_readiness_unverified', 'high', 'production', 'No pattern piece establishes a usable seam allowance.', 'Prepare and review cutting outlines before sample production.')
  }
  add('fit_unverified', 'info', 'fit', 'Fit and mobility cannot be confirmed from pattern metadata alone.', 'Fit the sample on the intended size or body and document the evaluation.')
  add('fabric_testing_unverified', 'info', 'materials', 'Drape, stretch, shrinkage, wash durability and material behavior have not been measured by this diagnostic.', 'Use physical fabric tests and calibrated simulation results where available.')
  add('factory_release_unverified', 'info', 'production', 'This metadata inspection does not verify seam matching, graded geometry, safe manufacturing or factory release.', 'Perform geometric checks, sample approval, marker validation and factory production review.')
  return finish(issues, { pieceCount: pieces.length, seamCount: seams.length, sizeCount: sizes.length, techPackPresent: Boolean(draft) })
}

function finish(issues, evidence) {
  const ordered = issues.sort((a, b) => priority[a.severity] - priority[b.severity] || a.id.localeCompare(b.id))
  const blockers = ordered.filter(issue => priority[issue.severity] <= priority.high)
  return {
    status: blockers.length ? 'needs_attention' : 'review_required',
    productionReady: false,
    summary: { issueCount: ordered.length, blockingIssueCount: blockers.length, ...evidence },
    issues: ordered,
    byArea: Object.fromEntries(['pattern', 'construction', 'grading', 'materials', 'techpack', 'fit', 'production']
      .map(area => [area, ordered.filter(issue => issue.area === area)])),
    caveat: 'Advisory metadata analysis only. No simulation, geometric seam verification, physical fit test or manufacturing certification performed.',
  }
}

export const assessExoProductionReadiness20261102 = diagnoseExoGarment20261102

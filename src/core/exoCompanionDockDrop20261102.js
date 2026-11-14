/** Pure viewport-coordinate companion drop targeting; no DOM or React dependency. */
export const EXO_COMPANION_DOCK_TARGETS_20261102 = Object.freeze(['left', 'right', 'top', 'bottom', 'center-wide', 'floating'])

const finite = n => typeof n === 'number' && Number.isFinite(n)
const clamp = (n, low, high) => Math.min(high, Math.max(low, n))

export function normalizeExoCompanionDockRect20261102(rect) {
 if (!rect || !finite(rect.left) || !finite(rect.top)) return null
 const width = finite(rect.width) ? rect.width : rect.right - rect.left
 const height = finite(rect.height) ? rect.height : rect.bottom - rect.top
 if (!finite(width) || !finite(height) || width <= 0 || height <= 0) return null
 return { left: rect.left, top: rect.top, right: rect.left + width, bottom: rect.top + height, width, height }
}

const inside = (p, r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
const intersect = (a, b) => normalizeExoCompanionDockRect20261102({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) })
const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height })

/**
 * @param {object} input
 * @param {{x:number,y:number}} input.pointer clientX/clientY in CSS pixels
 * @param {object} input.viewport DOMRect for the visible workspace/viewer area
 * @param {object} input.shell DOMRect for the enclosing application shell
 * @param {object} [input.bounds] visible browser/window bounds (defaults to shell)
 * @param {boolean} [input.cancelled] pointercancel, Escape, or aborted drag
 * @returns {{target:string, preview:object|null, hotZone:object|null, candidates:Array}|null}
 * Null means no valid drop; floating means a completed drop outside shell.
 */
export function getExoCompanionDockDrop20261102({ pointer, viewport, shell, bounds, cancelled = false } = {}) {
 if (cancelled || !pointer || !finite(pointer.x) || !finite(pointer.y)) return null
 const outer = normalizeExoCompanionDockRect20261102(shell)
 const viewer = normalizeExoCompanionDockRect20261102(viewport)
 const windowBounds = normalizeExoCompanionDockRect20261102(bounds) || outer
 if (!outer || !viewer || !windowBounds) return null
 const area = intersect(outer, windowBounds)
 if (!area || area.width < 80 || area.height < 80) return null
 if (bounds && !inside(pointer, windowBounds)) return null
 if (!inside(pointer, area)) return { target: 'floating', preview: null, hotZone: null, candidates: [] }

 const content = intersect(viewer, area) || area
 const small = area.width < 480 || area.height < 360
 const bandX = clamp(area.width * (small ? .22 : .13), 32, small ? 86 : 112)
 const bandY = clamp(area.height * (small ? .22 : .13), 28, small ? 72 : 96)
 const centerInsetX = clamp(content.width * .13, 12, 60)
 const centerInsetY = clamp(content.height * .13, 12, 60)
 const zones = [
  { target: 'left', rect: box(area.left, area.top, bandX, area.height), score: (pointer.x - area.left) / bandX },
  { target: 'right', rect: box(area.right - bandX, area.top, bandX, area.height), score: (area.right - pointer.x) / bandX },
  { target: 'top', rect: box(area.left, area.top, area.width, bandY), score: (pointer.y - area.top) / bandY },
  { target: 'bottom', rect: box(area.left, area.bottom - bandY, area.width, bandY), score: (area.bottom - pointer.y) / bandY },
  { target: 'center-wide', rect: box(content.left + centerInsetX, content.top + centerInsetY, Math.max(0, content.width - centerInsetX * 2), Math.max(0, content.height - centerInsetY * 2)), score: 1 },
 ]
 // At intersecting corner bands prefer the nearest normalized edge. Ties
 // use the stable array order left, right, top, bottom, center-wide.
 const candidates = zones.filter(zone => zone.rect.width > 0 && zone.rect.height > 0 && inside(pointer, zone.rect))
  .sort((a, b) => a.score - b.score || zones.indexOf(a) - zones.indexOf(b))
 const selected = candidates[0]
 if (!selected) return { target: 'floating', preview: null, hotZone: null, candidates: [] }

 const sideWidth = clamp(area.width * .26, 96, Math.max(96, area.width * .42))
 const rowHeight = clamp(area.height * .27, 68, Math.max(68, area.height * .42))
 const previews = {
  left: box(area.left, area.top, Math.min(sideWidth, area.width), area.height),
  right: box(area.right - Math.min(sideWidth, area.width), area.top, Math.min(sideWidth, area.width), area.height),
  top: box(area.left, area.top, area.width, Math.min(rowHeight, area.height)),
  bottom: box(area.left, area.bottom - Math.min(rowHeight, area.height), area.width, Math.min(rowHeight, area.height)),
  'center-wide': box(content.left, content.top, content.width, content.height),
 }
 return { target: selected.target, preview: intersect(previews[selected.target], area), hotZone: selected.rect, candidates: candidates.map(({ target }) => target) }
}

export default getExoCompanionDockDrop20261102

/** Handle endpoints are p +/- 0.18 * derivative in material coordinates.
 * Invert that presentation transform so a drag follows the pointer in metres.
 * The caller handles board rotation before this conversion. */
export function freeTangentDragDelta(delta, side) {
  if (!Array.isArray(delta) || delta.length !== 2 || !delta.every(Number.isFinite) || !['in','out'].includes(side)) return null
  return delta.map(value => value / (side === 'in' ? -.18 : .18))
}

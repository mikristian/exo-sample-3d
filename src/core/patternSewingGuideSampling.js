/**
 * Select representative indices for the 2D sewing correspondence overlay.
 *
 * The guides already describe pairs of actual seam coordinates. Sampling only
 * affects how many are painted; the native sewing links are never modified.
 * Always retain both real endpoints so short/uneven seams do not seem to stop
 * before their last correspondence.
 */
export function samplePatternSewingGuideIndices(count,{emphasized=false}={}) {
  if (!Number.isSafeInteger(count) || count<=0) return []
  const maxVisible=emphasized?48:12
  const size=Math.min(count,maxVisible)
  if(size===1)return [0]
  // Every step is at least one index because size <= count. Endpoints stay
  // pinned, and the remaining guides are distributed over the entire range.
  return Array.from({length:size},(_,i)=>Math.round(i*(count-1)/(size-1)))
}

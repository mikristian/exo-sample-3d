/** Pure local reference matching and tech-pack board import preparation.
 * Callers must convert IndexedDB attachment Blobs to small image data URLs before passing them here.
 */
export const EXO_REFERENCE_BOARD_LIMIT = 35;
export const EXO_REFERENCE_IMAGE_LIMIT = 350000;
export const EXO_REFERENCE_CATEGORIES = Object.freeze(['moodboard', 'mockup', 'fit', 'construction', 'trim', 'graphic', 'pattern']);

const IMAGE_RE = /^data:image\/(?:png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const WORDS = /[\p{L}\p{N}]+/gu;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const value = x => typeof x === 'string' ? x : '';
const tokens = x => (value(x).toLowerCase().match(WORDS) || []).filter(t => t.length > 1);
const normal = x => tokens(x).join(' ');

export function isSafeReferenceImageDataUrl(src) {
  return typeof src === 'string' && src.length <= EXO_REFERENCE_IMAGE_LIMIT && IMAGE_RE.test(src);
}

function candidateFields(item) {
  if (!item || typeof item !== 'object') return null;
  const id = value(item.id || item.key || item.attachmentId).trim();
  const name = value(item.name || item.filename || item.title).trim();
  const tags = Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string').slice(0, 40) : [];
  const metadataTags = Array.isArray(item.metadata?.tags) ? item.metadata.tags.filter(tag => typeof tag === 'string').slice(0, 40) : [];
  const category = value(item.category || item.kind || item.type);
  const description = value(item.description || item.notes || item.caption);
  const src = [item.dataUrl, item.imageDataUrl, item.metadata?.dataUrl].find(isSafeReferenceImageDataUrl) || null;
  const declaredMime = value(item.mimeType || item.mime || item.blob?.type);
  const inferredType = /\.(png|jpe?g|webp)$/i.test(name) ? 'image/' + (/\.jpe?g$/i.test(name) ? 'jpeg' : name.split('.').pop().toLowerCase()) : '';
  const image = !!src || imageTypes.has(declaredMime) || imageTypes.has(inferredType);
  return { id, name, tags: [...tags, ...metadataTags], category, description, src, image, declaredMime };
}

/** Return stable, ranked, image-only local candidates. Source URLs are never fetched or trusted. */
export function findExoReferenceCandidates({ assets = [], query = '', category = '', limit = 20 } = {}) {
  if (!Array.isArray(assets)) return [];
  const terms = [...new Set(tokens(query))];
  const categoryText = normal(category);
  const cap = Number.isSafeInteger(limit) ? Math.max(0, Math.min(100, limit)) : 20;
  const seen = new Set();
  const matches = [];
  for (let index = 0; index < Math.min(assets.length, 10000); index++) {
    const original = assets[index];
    const item = candidateFields(original);
    if (!item?.image) continue;
    const identity = item.id ? `id:${item.id}` : item.src ? `src:${item.src}` : `name:${normal(item.name)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const name = normal(item.name);
    const tags = normal(item.tags.join(' '));
    const description = normal(item.description);
    const kind = normal(item.category);
    let score = 0;
    if (categoryText && kind === categoryText) score += 4;
    for (const term of terms) {
      if (name.split(' ').includes(term)) score += 8;
      else if (name.includes(term)) score += 4;
      if (tags.split(' ').includes(term)) score += 7;
      else if (tags.includes(term)) score += 3;
      if (description.split(' ').includes(term)) score += 2;
      if (kind.split(' ').includes(term)) score += 2;
    }
    if (terms.length && !score) continue;
    matches.push({ id: item.id, name: item.name, tags: item.tags, category: item.category, description: item.description, dataUrl: item.src, requiresDataUrl: !item.src, score, sourceIndex: index });
  }
  return matches.sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex).slice(0, cap);
}

/** Stage ready board records without mutating the tech pack. Selection is explicit, or highest-ranked when auto=true. */
export function prepareExoMoodboardImport({ candidates = [], existingReferences = [], selectedIds = [], auto = false, maxItems = EXO_REFERENCE_BOARD_LIMIT, category = 'moodboard', createdAt = '1970-01-01T00:00:00.000Z' } = {}) {
  const existing = Array.isArray(existingReferences) ? existingReferences : [];
  const selection = new Set(Array.isArray(selectedIds) ? selectedIds.map(String) : []);
  const cap = Number.isSafeInteger(maxItems) ? Math.max(0, Math.min(EXO_REFERENCE_BOARD_LIMIT, maxItems)) : EXO_REFERENCE_BOARD_LIMIT;
  const slots = Math.max(0, cap - existing.length);
  const validCategory = EXO_REFERENCE_CATEGORIES.includes(category) ? category : 'moodboard';
  const priorIds = new Set(existing.map(r => value(r?.sourceAssetId || r?.id)).filter(Boolean));
  const priorSources = new Set(existing.map(r => r?.dataUrl).filter(isSafeReferenceImageDataUrl));
  const priorNames = new Set(existing.map(r => normal(r?.name)).filter(Boolean));
  const prepared = [];
  const skipped = [];
  const ordered = Array.isArray(candidates) ? (auto ? [...candidates].sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0) || (Number(a?.sourceIndex) || 0) - (Number(b?.sourceIndex) || 0)) : candidates) : [];
  for (const c of ordered) {
    if (!c || (!auto && !selection.has(String(c.id)))) continue;
    const id = value(c.id);
    const name = value(c.name).trim();
    const src = c.dataUrl;
    if (!isSafeReferenceImageDataUrl(src)) { skipped.push({ id, reason: 'needs-safe-data-url' }); continue; }
    if ((id && priorIds.has(id)) || priorSources.has(src) || (name && priorNames.has(normal(name)))) { skipped.push({ id, reason: 'duplicate' }); continue; }
    if (prepared.length >= slots) { skipped.push({ id, reason: 'board-full' }); continue; }
    const uniqueKey = id || `source-${c.sourceIndex ?? prepared.length}`;
    prepared.push({ id: `exo-reference-${uniqueKey}`, sourceAssetId: id || null, name: name || 'Reference image', caption: value(c.caption), category: validCategory, dataUrl: src, annotations: [], comments: [], createdAt });
    if (id) priorIds.add(id);
    priorSources.add(src);
    if (name) priorNames.add(normal(name));
  }
  return { references: prepared, skipped, remainingSlots: Math.max(0, slots - prepared.length), selectedMode: auto ? 'auto' : 'user' };
}

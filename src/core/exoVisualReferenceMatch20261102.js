/** Bounded, deterministic matching of EXO library attachment metadata.
 * Visual descriptors must be precomputed by a separate, trusted image analysis step.
 * This module does not load blobs, decode pixels, fetch URLs, or infer image semantics.
 */
export const EXO_VISUAL_MATCH_MAX_ASSETS = 10000;
const MAX_VECTOR = 256;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const words = input => typeof input === 'string'
  ? (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).slice(0, 64)
  : [];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const boundedVector = value => Array.isArray(value) && value.length > 0 && value.length <= MAX_VECTOR
  && value.every(v => finite(v) && Math.abs(v) <= 1e6) ? value : null;
const normalized = value => words(value).join(' ');

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa > 0 && bb > 0 ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : null;
}

function palette(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const result = value.map(color => {
    if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))
      return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    return Array.isArray(color) && color.length === 3 && color.every(v => Number.isInteger(v) && v >= 0 && v <= 255) ? color : null;
  });
  return result.every(Boolean) ? result : null;
}

function colorSimilarity(a, b) {
  if (!a || !b) return null;
  const closest = color => Math.min(...b.map(other => Math.hypot(...color.map((v, i) => v - other[i])) / Math.sqrt(3 * 255 ** 2)));
  const reverse = color => Math.min(...a.map(other => Math.hypot(...color.map((v, i) => v - other[i])) / Math.sqrt(3 * 255 ** 2)));
  return Math.max(0, 1 - (a.reduce((sum, color) => sum + closest(color), 0) / a.length
    + b.reduce((sum, color) => sum + reverse(color), 0) / b.length) / 2);
}

function perceptualHash(value) {
  return typeof value === 'string' && /^[\da-f]{16}$/i.test(value) ? value.toLowerCase() : null;
}
function hashSimilarity(a, b) {
  if (!a || !b) return null;
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    let bits = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (bits) { bits &= bits - 1; distance++; }
  }
  return 1 - distance / 64;
}
function aspect(feature) {
  const ratio = feature?.aspectRatio;
  if (finite(ratio) && ratio > 0 && ratio <= 100) return ratio;
  const { width, height } = feature || {};
  return finite(width) && finite(height) && width > 0 && height > 0
    && width <= 100000 && height <= 100000 ? width / height : null;
}
function imageAsset(item) {
  const mime = item?.mimeType || item?.mime || item?.blob?.type;
  const name = item?.name || item?.filename || '';
  return IMAGE_MIMES.has(mime) || (typeof name === 'string' && /\.(png|jpe?g|webp)$/i.test(name));
}

/**
 * @param {object} options
 * @param {object[]} options.assets - listAttachments-style metadata (without blobs is fine)
 * @param {object} [options.metadataIndex] - optional ID-keyed descriptors, e.g. {id: {embedding, palette, pHash, width, height}}
 * @param {object} [options.referenceFeatures] - descriptors of an already analyzed reference image
 * @param {string} [options.query] - optional written search
 * @param {string} [options.category] - optional preferred category
 * @returns {object[]} scored image metadata; visualEvidence specifies which genuine descriptors matched
 */
export function rankExoVisualReferences({ assets = [], metadataIndex = {}, referenceFeatures = {}, query = '', category = '', limit = 20 } = {}) {
  if (!Array.isArray(assets)) return [];
  const cap = Number.isSafeInteger(limit) ? Math.max(0, Math.min(100, limit)) : 20;
  if (!cap) return [];
  const textTerms = [...new Set(words(query))];
  const categoryName = normalized(category);
  const targetVector = boundedVector(referenceFeatures?.embedding || referenceFeatures?.vector);
  const targetPalette = palette(referenceFeatures?.palette);
  const targetHash = perceptualHash(referenceFeatures?.pHash);
  const targetAspect = aspect(referenceFeatures);
  const hasTarget = !!(targetVector || targetPalette || targetHash || targetAspect);
  const results = [];
  const seen = new Set();
  for (let i = 0; i < Math.min(assets.length, EXO_VISUAL_MATCH_MAX_ASSETS); i++) {
    const item = assets[i];
    if (!item || typeof item !== 'object' || !imageAsset(item)) continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name : (typeof item.filename === 'string' ? item.filename : '');
    const identity = id || `name:${name.toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const tags = [...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.metadata?.tags) ? item.metadata.tags : [])]
      .filter(t => typeof t === 'string').slice(0, 40);
    const indexed = id && metadataIndex && typeof metadataIndex === 'object'
      && Object.prototype.hasOwnProperty.call(metadataIndex, id) ? metadataIndex[id] : null;
    const descriptor = indexed && typeof indexed === 'object' ? indexed : item.metadata?.visual || {};
    const fields = [name, tags.join(' '), item.description || item.metadata?.description || '', item.category || '']
      .map(normalized);
    let textScore = 0;
    for (const term of textTerms) {
      if (fields[0].split(' ').includes(term)) textScore += 8;
      if (fields[1].split(' ').includes(term)) textScore += 7;
      if (fields[2].split(' ').includes(term)) textScore += 2;
      if (fields[3].split(' ').includes(term)) textScore += 2;
    }
    const categoryScore = categoryName && normalized(item.category) === categoryName ? 4 : 0;
    const similarities = {
      embedding: cosine(targetVector, boundedVector(descriptor?.embedding || descriptor?.vector)),
      perceptualHash: hashSimilarity(targetHash, perceptualHash(descriptor?.pHash)),
      palette: colorSimilarity(targetPalette, palette(descriptor?.palette)),
      aspectRatio: targetAspect && aspect(descriptor) ? Math.exp(-Math.abs(Math.log(targetAspect / aspect(descriptor)))) : null,
    };
    const weights = { embedding: 55, perceptualHash: 30, palette: 15, aspectRatio: 6 };
    const visualEvidence = Object.keys(weights).filter(key => similarities[key] !== null);
    if (hasTarget && !visualEvidence.length && !textScore && !categoryScore) continue;
    if (!hasTarget && textTerms.length && !textScore && !categoryScore) continue;
    const visualScore = visualEvidence.reduce((sum, key) => sum + weights[key] * Math.max(0, similarities[key]), 0);
    const score = Math.round((visualScore + textScore + categoryScore) * 1000) / 1000;
    results.push({ id, name, category: item.category || '', mimeType: item.mimeType || item.mime || '',
      score, textScore, visualScore: Math.round(visualScore * 1000) / 1000, visualEvidence,
      similarities, sourceIndex: i, requiresDataUrl: true });
  }
  return results.sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex).slice(0, cap);
}

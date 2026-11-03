import test from 'node:test';
import assert from 'node:assert/strict';
import { findExoReferenceCandidates, isSafeReferenceImageDataUrl, prepareExoMoodboardImport } from './exoReferenceLibrary20261102.js';

const imageA = 'data:image/png;base64,AAAA';
const imageB = 'data:image/webp;base64,AAAA';
const assets = [
  { id: 'a', name: 'Balenciaga oversized jacket.webp', tags: ['oversized', 'silhouette'], dataUrl: imageA },
  { id: 'b', name: 'Regular cut photo.png', tags: ['coat'], metadata: { dataUrl: imageB } },
  { id: 'c', name: 'Oversized coat.jpg', mimeType: 'image/jpeg', tags: ['oversized'] },
  { id: 'd', name: 'oversized notes.txt', tags: ['oversized'], dataUrl: 'https://evil.invalid/asset.png' },
];

test('finds matching images by filename/tags and leaves attachment blobs staged for conversion', () => {
  const hits = findExoReferenceCandidates({ assets, query: 'oversized' });
  assert.deepEqual(hits.map(h => h.id), ['a', 'c']);
  assert.equal(hits[1].requiresDataUrl, true);
  assert.equal(hits[0].requiresDataUrl, false);
  assert.deepEqual(findExoReferenceCandidates({ assets, query: 'nonexistent' }), []);
});

test('rejects unsafe and oversized image sources', () => {
  assert.equal(isSafeReferenceImageDataUrl(imageA), true);
  for (const src of ['javascript:alert(1)', 'https://trusted.invalid/photo.png', 'blob:abcdef', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AAA-', `data:image/png;base64,${'A'.repeat(350001)}`]) assert.equal(isSafeReferenceImageDataUrl(src), false);
});

test('selected import only selects requested images; auto selects highest ranked', () => {
  const candidates = findExoReferenceCandidates({ assets, query: 'oversized' });
  const picked = prepareExoMoodboardImport({ candidates, selectedIds: ['a'] });
  assert.deepEqual(picked.references.map(r => r.sourceAssetId), ['a']);
  assert.equal(picked.selectedMode, 'user');
  const auto = prepareExoMoodboardImport({ candidates: [candidates[1], candidates[0]], auto: true });
  assert.deepEqual(auto.references.map(r => r.sourceAssetId), ['a']);
  assert.equal(auto.skipped[0].reason, 'needs-safe-data-url');
});

test('existing and intra-batch duplicates plus board limits are respected', () => {
  const candidates = [{ id: 'a', name: 'look.webp', dataUrl: imageA }, { id: 'b', name: 'look.webp', dataUrl: imageB }, { id: 'c', name: 'new.webp', dataUrl: imageB }];
  const duplicate = prepareExoMoodboardImport({ candidates, auto: true });
  assert.equal(duplicate.references.length, 2);
  assert.equal(duplicate.skipped[0].reason, 'duplicate');
  const full = prepareExoMoodboardImport({ candidates, auto: true, existingReferences: Array.from({ length: 34 }, (_, i) => ({ id: String(i) })) });
  assert.equal(full.references.length, 1);
  assert.equal(full.skipped.some(s => s.reason === 'board-full'), true);
  assert.equal(prepareExoMoodboardImport({ candidates, auto: true, existingReferences: Array.from({ length: 35 }, (_, i) => ({ id: String(i) })) }).references.length, 0);
  assert.equal(prepareExoMoodboardImport({ candidates, auto: true, existingReferences: [{ sourceAssetId: 'a', dataUrl: imageA }] }).skipped[0].reason, 'duplicate');
});

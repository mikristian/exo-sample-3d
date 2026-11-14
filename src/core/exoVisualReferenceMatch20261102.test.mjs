import test from 'node:test';
import assert from 'node:assert/strict';
import { rankExoVisualReferences, EXO_VISUAL_MATCH_MAX_ASSETS } from './exoVisualReferenceMatch20261102.js';

const asset = (id, extra = {}) => ({ id, name: `${id}.png`, mimeType: 'image/png', category: 'image', ...extra });

test('visual embedding ranks a relevant local image above the filename match', () => {
  const results = rankExoVisualReferences({
    assets: [asset('oversized-hoodie', { tags: ['oversized'] }), asset('ref-b')],
    query: 'oversized', referenceFeatures: { embedding: [1, 0, 0] },
    metadataIndex: { 'oversized-hoodie': { embedding: [0, 1, 0] }, 'ref-b': { embedding: [0.99, 0.01, 0] } },
  });
  assert.equal(results[0].id, 'ref-b');
  assert.deepEqual(results[0].visualEvidence, ['embedding']);
  assert.equal(results[0].requiresDataUrl, true);
});

test('perceptual hash, palette and dimensions rank matches without embeddings', () => {
  const results = rankExoVisualReferences({
    assets: [asset('different'), asset('same')],
    referenceFeatures: { pHash: 'ffffffffffffffff', palette: ['#112233'], width: 400, height: 200 },
    metadataIndex: {
      different: { pHash: '0000000000000000', palette: ['#ffffff'], width: 100, height: 500 },
      same: { pHash: 'ffffffffffffffff', palette: [[17, 34, 51]], aspectRatio: 2 },
    },
  });
  assert.equal(results[0].id, 'same');
  assert.deepEqual(results[0].visualEvidence, ['perceptualHash', 'palette', 'aspectRatio']);
});

test('legacy tags, category, and stable tie ordering remain useful without descriptors', () => {
  const results = rankExoVisualReferences({ assets: [asset('a'), asset('b', { tags: ['gothic'] }), asset('c', { category: 'trim' })], query: 'gothic' });
  assert.equal(results[0].id, 'b');
  assert.equal(results.length, 1);
  assert.deepEqual(rankExoVisualReferences({ assets: [asset('a'), asset('b')], limit: 2 }).map(r => r.id), ['a', 'b']);
});

test('rejects malformed descriptors and nonimages, deduplicates, caps input and output', () => {
  const results = rankExoVisualReferences({
    assets: [asset('a'), asset('a'), { id: 'script', name: 'script.js', mimeType: 'application/javascript' }, asset('b')],
    referenceFeatures: { embedding: [1, 0], pHash: 'bad', palette: ['javascript:bad'] },
    metadataIndex: { a: { embedding: [Infinity, 1] }, b: { embedding: [1, 0] } }, limit: 1,
  });
  assert.deepEqual(results.map(r => r.id), ['b']);
  assert.equal(rankExoVisualReferences({ assets: Array.from({ length: EXO_VISUAL_MATCH_MAX_ASSETS + 20 }, (_, i) => asset(`a-${i}`)), limit: 200 }).length, 100);
  assert.deepEqual(rankExoVisualReferences({ assets: [], limit: -1 }), []);
});

test('does not treat arbitrary image URLs or feature vector dimension mismatches as evidence', () => {
  const results = rankExoVisualReferences({
    assets: [asset('a', { metadata: { visual: { embedding: [1, 0, 0] } }, url: 'https://example.org/image.png' })],
    referenceFeatures: { embedding: [1, 0] }, query: 'a',
  });
  assert.deepEqual(results[0].visualEvidence, []);
  assert.equal('url' in results[0], false);
});

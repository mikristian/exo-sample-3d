import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchExoArchivePatterns } from './exoArchivePatternRetrieval20261102.js';

test('archive lookup returns original identifier, license and actual local file status', async () => {
  const result = await searchExoArchivePatterns({ sourceId: 'default/00/rand_00YONAPXZE' });
  assert.equal(result.ok, true);
  assert.equal(result.matched, 1);
  assert.equal(result.results[0].sourceId, 'default/00/rand_00YONAPXZE');
  assert.equal(result.results[0].license, 'CC BY 4.0');
  assert.equal(result.results[0].dxfLocallyAvailable, true);
  assert.equal(result.results[0].factoryApproved, false);
});

test('unknown archive source and nonsensical query never generate invented matches', async () => {
  const [unknown, query] = await Promise.all([
    searchExoArchivePatterns({ sourceId: 'default/00/does-not-exist' }),
    searchExoArchivePatterns({ query: 'not-a-real-pattern-348482' }),
  ]);
  for (const result of [unknown, query]) {
    assert.equal(result.ok, true);
    assert.equal(result.matched, 0);
    assert.deepEqual(result.results, []);
  }
});

test('archive results enforce bounded page size and geometry coverage disclosure', async () => {
  const result = await searchExoArchivePatterns({ limit: 1000, minPanels: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.limit, 50);
  assert.ok(result.results.length <= 50);
  assert.ok(result.coverage.indexed >= result.results.length);
  assert.ok(result.coverage.geometryEmbeddings < result.coverage.indexed);
});

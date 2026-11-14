import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readGarmentCodeDataV2Catalog } from './garmentcodedata-v2-catalog.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-garmentcode-v2-'))
try {
  assert.equal(readGarmentCodeDataV2Catalog(root).ok, false)
  const directory = path.join(root, 'download', 'garment-dxf-library-20261023', 'garmentcodedata-v2')
  fs.mkdirSync(directory, {recursive: true})
  const db = new DatabaseSync(path.join(directory, 'pattern-index.sqlite3'))
  db.exec(`CREATE TABLE patterns (body TEXT,batch INTEGER,element TEXT,sha256 TEXT,bytes INTEGER,
    panel_count INTEGER,source_path TEXT,dxf_path TEXT,source TEXT,license TEXT,attribution TEXT)`)
  db.exec(`CREATE TABLE archived_batches (body TEXT,batch INTEGER,cloud_path TEXT,
    archive_sha256 TEXT,archive_bytes INTEGER,specification_count INTEGER)`)
  db.exec(`CREATE TABLE processed_batches (body TEXT, batch INTEGER, source_sha256 TEXT,
    parquet_bytes INTEGER, rows_seen INTEGER, specifications INTEGER)`)
  db.prepare('INSERT INTO patterns VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    'default', 0, 'shirt_alpha', 'a'.repeat(64), 1234, 8, 'specifications/default/a.json', null,
    'mirror', 'CC BY 4.0', 'Original ETH authors')
  db.prepare('INSERT INTO patterns VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    'random', 1, 'trousers_beta', 'b'.repeat(64), 4567, 12, 'specifications/random/b.json',
    'dxf/random/b.dxf', 'mirror', 'CC BY 4.0', 'Original ETH authors')
  db.prepare('INSERT INTO archived_batches VALUES (?,?,?,?,?,?)').run(
    'default',0,'/expansion/archive-default.tar.gz','a'.repeat(64),500,1)
  db.prepare('INSERT INTO processed_batches VALUES (?,?,?,?,?,?)').run('default',0,'a'.repeat(64),5000,8,1)
  db.close()
  const all = readGarmentCodeDataV2Catalog(root)
  assert.equal(all.total, 2)
  assert.equal(all.ingestion.completedBatches, 1)
  assert.equal(all.ingestion.cloudArchivedSpecifications, 1)
  assert.equal(all.files[0].factoryApproved, false)
  assert.equal(all.files[0].converted, false)
  assert.equal(all.files[0].cloudArchived, true)
  assert.equal(all.files[1].cloudArchived, false)
  assert.equal(all.files[1].converted, true)
  assert.equal(all.files[1].dxfPath, 'dxf/random/b.dxf')
  assert.equal(readGarmentCodeDataV2Catalog(root, {body:'default'}).total, 1)
  assert.equal(readGarmentCodeDataV2Catalog(root, {search:'shirt'}).total, 1)
  assert.equal(readGarmentCodeDataV2Catalog(root, {search:'%'}).total, 0)
  assert.equal(readGarmentCodeDataV2Catalog(root, {page:2, limit:1}).files[0].name, 'trousers beta')
  console.log('PASS: GarmentCodeData v2 paginated read-only catalog, search, flags, missing dataset')
} finally { fs.rmSync(root, {recursive:true, force:true}) }

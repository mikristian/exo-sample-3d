import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Read-only, paginated public-dataset metadata. Never returns source file bytes. */
export function readGarmentCodeDataV2Catalog(projectRoot, options = {}) {
  const folder = path.join(projectRoot, 'download', 'garment-dxf-library-20261023', 'garmentcodedata-v2')
  const dbPath = path.join(folder, 'pattern-index.sqlite3')
  if (!fs.existsSync(dbPath)) return {
    ok: false, code: 'GARMENTCODE_V2_NOT_INGESTED', available: 0, files: [],
    error: 'No verified GarmentCodeData v2 patterns have been ingested.'
  }
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 40))
  const page = Math.min(100000, Math.max(1, Number.parseInt(options.page, 10) || 1))
  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : ''
  const body = ['default', 'random'].includes(options.body) ? options.body : null
  let db
  try {
    db = new DatabaseSync(dbPath, {readOnly: true})
    const where = ['1=1']
    const params = {}
    if (body) { where.push('patterns.body = :body'); params.body = body }
    if (search) {
      // LIKE wildcards from user input are treated literally, not as full-table globs.
      where.push("element LIKE :search ESCAPE '\\'")
      params.search = `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
    }
    const filter = where.join(' AND ')
    const available = Number(db.prepare(`SELECT count(*) AS n FROM patterns WHERE ${filter}`).get(params).n)
    const completedBatches = Number(db.prepare('SELECT count(*) AS n FROM processed_batches').get().n)
    const cloudArchived = db.prepare('SELECT count(*) AS batches, COALESCE(sum(specification_count), 0) AS patterns FROM archived_batches').get()
    const rows = db.prepare(`SELECT patterns.body,patterns.batch,element,sha256,bytes,panel_count,source_path,
      dxf_path,source,license,attribution,archive.cloud_path AS cloud_path
      FROM patterns LEFT JOIN archived_batches archive
      ON patterns.body = archive.body AND patterns.batch = archive.batch
      WHERE ${filter} ORDER BY patterns.body,patterns.batch,element
      LIMIT :limit OFFSET :offset`).all({...params, limit, offset: (page - 1) * limit})
    return {
      ok: true, schema: 'exo.garmentcodedata-v2.catalog.v1', total: available, page, limit,
      ingestion: {completedBatches, availableBatches: 40,
        cloudArchivedBatches: Number(cloudArchived.batches),
        cloudArchivedSpecifications: Number(cloudArchived.patterns)},
      sourceDataset: 'https://doi.org/10.3929/ethz-b-000690432',
      license: 'CC BY 4.0', factoryApproved: false,
      files: rows.map(row => ({
        id: `garmentcode-v2:${row.body}:${row.batch}:${row.element}`,
        name: row.element.replaceAll('_', ' '), sourceSha256: row.sha256,
        body: row.body, batch: row.batch, panelCount: row.panel_count,
        sourcePath: row.source_path, dxfPath: row.dxf_path,
        cloudArchivePath: row.cloud_path || null, cloudArchived: Boolean(row.cloud_path),
        converted: Boolean(row.dxf_path), source: row.source,
        license: row.license, attribution: row.attribution,
        factoryApproved: false,
      }))
    }
  } finally { db?.close() }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {bindPropertyMetadata,legacyPropertyMetadataFingerprint} from './propertyMetadataIdentity20261030.mjs'

const garment=(name='Original')=>({format:'clothcraft',name,
 panels:[{id:'front',name:'Front',fabric:'shell'}],fabrics:[{id:'shell',name:'Shell'}]})

test('matching legacy v1 reopen preserves properties and mints a metadata project UUID',()=>{
 const source=garment()
 const old={version:1,identity:legacyPropertyMetadataFingerprint(source),
  panels:{front:{itemNo:'ARTICLE-17'}},fabrics:{shell:{supplier:'Original mill'}}}
 const migrated=bindPropertyMetadata(old,source,{reopen:true})
 assert.equal(migrated.version,2)
 assert.equal(migrated.panels.front.itemNo,'ARTICLE-17')
 assert.equal(migrated.fabrics.shell.supplier,'Original mill')
 assert.match(migrated.metadataProjectId,/^[a-f0-9-]{36}$/)
 assert.equal(migrated.identity!==old.identity,true)
})

test('explicit import does not adopt an existing legacy sidecar',()=>{
 const source=garment()
 const old={version:1,identity:legacyPropertyMetadataFingerprint(source),
  panels:{front:{itemNo:'LEGACY-KEEP'}},fabrics:{}}
 const rebound=bindPropertyMetadata(old,source,{reopen:false})
 assert.deepEqual(rebound.panels,{})
 assert.notEqual(rebound.metadataProjectId,undefined)
 assert.equal(rebound.version,2)
})

test('same-source v2 reopen retains metadata and namespace',()=>{
 const older=bindPropertyMetadata(null,garment('First'))
 older.panels.front={itemNo:'FIRST-ONLY'}
 const matching=bindPropertyMetadata(older,garment('First'),{reopen:true})
 assert.strictEqual(matching,older)
 assert.equal(matching.metadataProjectId,older.metadataProjectId)
})

test('different-source v2 reopen rejects old metadata and mints independent namespace',()=>{
 const older=bindPropertyMetadata(null,garment('First'))
 older.panels.front={itemNo:'FIRST-ONLY'}
 const unrelated=bindPropertyMetadata(older,garment('Unrelated'),{reopen:true})
 assert.notStrictEqual(unrelated,older)
 assert.notEqual(unrelated.identity,older.identity)
 assert.notEqual(unrelated.metadataProjectId,older.metadataProjectId)
 assert.deepEqual(unrelated.panels,{})
 assert.deepEqual(unrelated.fabrics,{})
})

test('mismatching legacy v1 source cannot migrate on reopen',()=>{
 const source=garment('Original')
 const old={version:1,identity:legacyPropertyMetadataFingerprint(source),
  panels:{front:{itemNo:'ORIGINAL-ONLY'}},fabrics:{}}
 const rebound=bindPropertyMetadata(old,garment('Other'),{reopen:true})
 assert.deepEqual(rebound.panels,{})
 assert.notEqual(rebound.identity,old.identity)
 assert.match(rebound.metadataProjectId,/^[a-f0-9-]{36}$/)
})

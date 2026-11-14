import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {bindPropertyMetadata,legacyPropertyMetadataFingerprint,propertyMetadataFingerprint} from './propertyMetadataIdentity20261030.mjs'

const template=(panelName='Front',fabricName='Cotton')=>({format:'clothcraft',name:'Sample',
 panels:[{id:'front',name:panelName,fabric:'shell',polygon:{points:[[0,0],[1,0],[1,1]]}}],
 fabrics:[{id:'shell',name:fabricName,properties:{density:200}}]})

test('same garment name and panel/fabric IDs do not share metadata across distinct imports',()=>{
 const a=template(),b=template('Sleeve','Silk')
 assert.equal(legacyPropertyMetadataFingerprint(a),legacyPropertyMetadataFingerprint(b))
 const first=bindPropertyMetadata(null,a)
 first.panels.front={itemNo:'A-001'}
 first.fabrics.shell={supplier:'A supplier'}
 const second=bindPropertyMetadata(first,b)
 assert.notEqual(first.identity,second.identity)
 assert.deepEqual(second.panels,{})
 assert.deepEqual(second.fabrics,{})
 assert.deepEqual(first.panels.front,{itemNo:'A-001'})
})

test('geometry, material parameters, layout and ordinary source edits retain existing metadata',()=>{
 const a=template(),saved=bindPropertyMetadata(null,a)
 saved.panels.front={itemNo:'P-99'}
 const edited=structuredClone(a)
 edited.panels[0].polygon.points[1]=[8,0]
 edited.panels[0].layout_2d=[3,4]
 edited.fabrics[0].properties.density=250
 assert.equal(propertyMetadataFingerprint(a),propertyMetadataFingerprint(edited))
 assert.strictEqual(bindPropertyMetadata(saved,edited),saved)
})

test('native migration only accepts exact v2 fingerprint and legacy v1 mints UUID',()=>{
 const a=template(),saved=bindPropertyMetadata(null,a)
 saved.fabrics.shell={pantoneCode:'19-4052 TCX'}
 const other=bindPropertyMetadata(saved,template('Renamed front','Renamed cotton'),{reopen:true})
 assert.notStrictEqual(other,saved,'name-only reuse cannot authorize a different native source')
 assert.deepEqual(other.fabrics,{})
 assert.strictEqual(bindPropertyMetadata(saved,a,{reopen:true}),saved)
 const legacy={version:1,identity:legacyPropertyMetadataFingerprint(a),panels:{front:{itemNo:'legacy'}},fabrics:{}}
 const migrated=bindPropertyMetadata(legacy,a,{reopen:true})
 assert.equal(migrated.version,2)
 assert.equal(migrated.identity,propertyMetadataFingerprint(a))
 assert.equal(migrated.panels.front.itemNo,'legacy')
 assert.match(migrated.metadataProjectId,/^[0-9a-f-]{36}$/)
 assert.deepEqual(bindPropertyMetadata(legacy,template('Other panel'),{reopen:false}).panels,{})
})

test('explicit import persists replaced sidecar before save and cold reopen retains new identity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-property-identity-'))
 const sidecar=path.join(dir,'fitting-project.json.properties.json')
 try{
  const first=bindPropertyMetadata(null,template())
  first.panels.front={itemNo:'old-project-only'}
  fs.writeFileSync(sidecar,JSON.stringify(first))
  // Explicit open: the existing saved mirror cannot authorize a reopen.
  const previous=JSON.parse(fs.readFileSync(sidecar,'utf8'))
  const imported=bindPropertyMetadata(previous,template('New imported panel','New imported fabric'),{reopen:false})
  assert.notStrictEqual(imported,previous)
  assert.notEqual(imported.identity,previous.identity)
  if(imported!==previous)fs.writeFileSync(sidecar,JSON.stringify(imported))
  // The native save is independent; reopen reads the durable sidecar.
  const persisted=JSON.parse(fs.readFileSync(sidecar,'utf8'))
  const reopened=bindPropertyMetadata(persisted,template('New imported panel','New imported fabric'),{reopen:true})
  assert.deepEqual(reopened.panels,{})
  assert.deepEqual(reopened.fabrics,{})
  assert.equal(reopened.identity,imported.identity)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('identical fresh garment import creates a distinct metadata UUID and drops prior properties',()=>{
 const a=template()
 const first=bindPropertyMetadata(null,a,{fresh:true})
 first.panels.front={itemNo:'OLD-CLOTHING-ARTICLE'}
 const imported=bindPropertyMetadata(first,structuredClone(a),{fresh:true})
 assert.equal(first.identity,imported.identity,'template descriptor can legitimately be identical')
 assert.notEqual(first.metadataProjectId,imported.metadataProjectId)
 assert.match(first.metadataProjectId,/^[a-f0-9-]{36}$/)
 assert.deepEqual(imported.panels,{})
 assert.deepEqual(imported.fabrics,{})
 assert.strictEqual(bindPropertyMetadata(imported,a,{reopen:true}),imported)
})

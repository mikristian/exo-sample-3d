import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {techPackSourceIdentity20261031} from './techPackSourceIdentity20261031.js'
const t=JSON.parse(fs.readFileSync(new URL('../../public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json',import.meta.url)))
test('source content identity survives stable snapshots and invalidates after actual garment edit',()=>{
 const get=snapshot=>techPackSourceIdentity20261031({snapshot,source:{},nativeMode:true})
 const a=get(t),b=get(structuredClone(t))
 assert.match(a.key,/^content:[0-9a-f]{32}$/)
 assert.equal(a.key,b.key)
 const changed=structuredClone(t)
 changed.template.panels[0].polygon.points[0][0]+=.0005
 assert.notEqual(get(changed).key,a.key)
 assert.equal(a.manufacturingApproved,false)
})
test('never invent source identity without contours',()=>{
 assert.equal(techPackSourceIdentity20261031({snapshot:{}}).key,null)
})

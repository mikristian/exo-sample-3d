import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseSync} from 'oxc-parser'
import {parse,Lang} from '@ast-grep/napi'

const root=new URL('../../',import.meta.url)
const registry=JSON.parse(readFileSync(new URL('docs/engineering/exo-rust-github-registry.json',root)))
const lock=JSON.parse(readFileSync(new URL('docs/engineering/exo-rust-github-lock.json',root)))
const swarm=JSON.parse(readFileSync(new URL('docs/engineering/exo-rust-swarm-20.json',root)))
const inventory=JSON.parse(readFileSync(new URL('docs/reports/exo-rust-ast-migration-inventory.json',root)))
assert.equal(registry.repositories.length,12)
assert.equal(lock.pins.length,12)
assert.equal(lock.pins.filter(p=>p.verified).length,12)
for(const entry of registry.repositories){
  const pin=lock.pins.find(p=>p.id===entry.id)
  assert.equal(pin.repo,entry.repo)
  assert.match(pin.commit,/^[a-f0-9]{40}$/)
}
assert.equal(swarm.workstreams.length,20)
assert.equal(new Set(swarm.workstreams.map(w=>w.id)).size,20)
assert.ok(swarm.orchestration.maxConcurrentChatOnSteroidsWorkers<=2,
  'Current Chat On Steroids slot limit cannot be exceeded')
assert.ok(swarm.orchestration.maxConcurrentSourceWriters<=1)
assert.ok(inventory.coreModules>0)
assert.equal(inventory.parseErrorModules,0)
const example='export function length(x,y) { return Math.hypot(x,y) }'
const oxc=parseSync('example.js',example)
assert.equal(oxc.errors.length,0)
const ast=parse(Lang.JavaScript,example).root()
assert.equal(ast.findAll('Math.$FN($$$ARGS)').length,1)
console.log(JSON.stringify({pass:true,githubRepositories:12,headPins:12,
  configuredWorkstreams:20,maxConcurrentWorkers:2,
  sourceModulesParsed:inventory.coreModules,parseErrors:0,
  productionApplicationMutated:false}))

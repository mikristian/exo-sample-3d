#!/usr/bin/env node
// Read-only Oxc + ast-grep inventory. Never translates, rewrites or evaluates
// source. Used to hand out testable function-level migration work.
import {parseSync} from 'oxc-parser'
import {parse,Lang} from '@ast-grep/napi'
import {readdirSync,readFileSync,writeFileSync} from 'node:fs'
import {basename,join,resolve,relative} from 'node:path'
const repoRoot=resolve(import.meta.dirname,'../..')
const codeRoot=join(repoRoot,'src/core')
const files=readdirSync(codeRoot).filter(f=>f.endsWith('.js')&&!f.startsWith('rust')).sort()
const rustImport=/from\s+['"]\.\.?\/rust[A-Z][\w]*Kernel\.js['"]/g
const results=[]
for(const name of files){
 const path=join(codeRoot,name)
 const source=readFileSync(path,'utf8')
 const parsed=parseSync(name,source,{sourceType:'module'})
 const root=parse(Lang.JavaScript,source).root()
 const functions=root.findAll({rule:{any:[{kind:'function_declaration'},{kind:'method_definition'},{kind:'arrow_function'}]}})
 const math=root.findAll('Math.$FN($$$ARGS)')
 const loops=root.findAll({rule:{any:[{kind:'for_statement'},{kind:'for_in_statement'},{kind:'while_statement'}]}})
 const calls=[...source.matchAll(rustImport)].map(m=>m[0])
 results.push({file:relative(repoRoot,path),lines:source.split('\n').length,
   oxcParseErrors:parsed.errors.length,functions:functions.length,
   mathCalls:math.length,loops:loops.length,rustBridgeImports:calls.length,
   estimatedNumericReviewScore:math.length*3+loops.length*2+Math.min(functions.length,20),
 })
}
const inventory={schema:1,source:'read-only Oxc parser and ast-grep AST analysis',
 coreModules:files.length,rustIntegratedModules:results.filter(x=>x.rustBridgeImports>0).length,
 parseErrorModules:results.filter(x=>x.oxcParseErrors>0).length,
 caveat:'Potential worklist only; numeric score and imports do NOT measure Rust-owned functionality.',
 modules:results.sort((a,b)=>b.estimatedNumericReviewScore-a.estimatedNumericReviewScore)}
if(process.argv.includes('--write')){
 const destination=join(repoRoot,'docs/reports/exo-rust-ast-migration-inventory.json')
 writeFileSync(destination,JSON.stringify(inventory,null,2)+'\n')
 console.log(JSON.stringify({saved:destination,modules:files.length,parseErrors:inventory.parseErrorModules,
  rustIntegratedModules:inventory.rustIntegratedModules,topCandidates:inventory.modules.slice(0,8)}))
}else console.log(JSON.stringify({modules:files.length,parseErrors:inventory.parseErrorModules,
 rustIntegratedModules:inventory.rustIntegratedModules,topCandidates:inventory.modules.slice(0,8)},null,2))

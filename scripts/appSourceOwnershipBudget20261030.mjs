import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')

// These caps leave a small margin for concurrently owned changes. Any larger
// addition belongs in a separately owned module with an explicit import.
export const SOURCE_OWNERSHIP_BUDGETS=Object.freeze([
  Object.freeze({path:'src/App.jsx',maxLines:9400}),
  Object.freeze({path:'src/components/ClothCraftWorkspace.jsx',maxLines:4300}),
])

export function countSourceLines(source){
  if(typeof source!=='string')throw new TypeError('source must be a string')
  if(source.length===0)return 0
  return source.split('\n').length-(source.endsWith('\n')?1:0)
}

export function auditSourceOwnershipBudget(readSource,budgets=SOURCE_OWNERSHIP_BUDGETS){
  if(typeof readSource!=='function')throw new TypeError('readSource must be a function')
  const rows=budgets.map(({path:sourcePath,maxLines})=>{
    if(!Number.isSafeInteger(maxLines)||maxLines<1)throw new TypeError('invalid line budget')
    const lines=countSourceLines(readSource(sourcePath))
    return {path:sourcePath,lines,maxLines,overage:Math.max(0,lines-maxLines),ok:lines<=maxLines}
  })
  return {ok:rows.every(row=>row.ok),rows}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=auditSourceOwnershipBudget(sourcePath=>readFileSync(path.join(root,sourcePath),'utf8'))
  console.log(JSON.stringify({schema:'exo.app.source-ownership-budget.v1',...result},null,2))
  if(!result.ok)process.exitCode=1
}

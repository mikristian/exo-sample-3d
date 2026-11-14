import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import parser from '@babel/parser'

test('Table Studio keeps every hook unconditional when transitioning from closed to right-click open',()=>{
  const source=readFileSync(new URL('./TechPackTableStudio20261030.jsx',import.meta.url),'utf8')
  const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']})
  const component=ast.program.body.find(node=>node.type==='ExportDefaultDeclaration')?.declaration
  assert.equal(component?.type,'FunctionDeclaration')
  const statements=component.body.body
  const earlyReturn=statements.findIndex(node=>node.type==='IfStatement'&&
    node.test.type==='LogicalExpression'&&node.test.operator==='||'&&
    node.consequent.type==='ReturnStatement'&&node.consequent.argument?.type==='NullLiteral')
  assert.ok(earlyReturn>=0,'expected closed-state null return')
  const hookCalls=statements.flatMap((statement,index)=>{
    if(statement.type==='ExpressionStatement'&&statement.expression.type==='CallExpression'&&
       /^use(?:Effect|Memo|Ref|State|LayoutEffect|Callback)$/.test(statement.expression.callee.name||''))return [{index,line:statement.loc.start.line}]
    if(statement.type==='VariableDeclaration')return statement.declarations.flatMap(declaration=>
      declaration.init?.type==='CallExpression'&&/^use(?:Effect|Memo|Ref|State|LayoutEffect|Callback)$/.test(declaration.init.callee.name||'')
        ?[{index,line:declaration.loc.start.line}]:[])
    return []
  })
  assert.ok(hookCalls.length>=10,'expected to cover the actual hook-bearing component')
  assert.deepEqual(hookCalls.filter(hook=>hook.index>earlyReturn),[],
    'closing Table Studio must not skip hooks later executed by right-click opening it')
})

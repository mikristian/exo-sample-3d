import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.dirname(fileURLToPath(import.meta.url))
const swift=fs.readFileSync(path.join(root,'EXOClothCraftWorkspaceV2.swift'),'utf8')
const workspace=fs.readFileSync(path.join(root,'../workspace.mjs'),'utf8')
const server=fs.readFileSync(path.join(root,'../server.mjs'),'utf8')

test('signed AppKit cold boot authenticates and starts Rust before first WKWebView load',()=>{
  assert.match(swift,/let trustedBridge = /)
  assert.match(swift,/workspaceBridgeProtocol.*exo\.workspace\.bridge\.v2/)
  assert.match(swift,/guard let expectedBundledIdentity = self\.bundledRuntimeIdentity else \{/)
  assert.match(swift,/signedResources\?\["identity"\].*expectedBundledIdentity/)
  assert.match(swift,/guard trustedBridge, \(payload\?\["nativeReady"\].*true/)
  assert.match(swift,/if \(nativeSession\?\["loaded"\].*true/)
  assert.match(swift,/self\.bootstrapNativeWorkspace\(\)/)
  assert.match(swift,/private func bootstrapNativeWorkspace\(\)/)
  assert.match(swift,/request\.httpMethod = "POST"/)
  assert.ok(swift.includes('request.setValue("Bearer \\(workspaceToken)", forHTTPHeaderField: "Authorization")'))
  assert.match(swift,/request\.httpBody = Data\(/)
  assert.ok(swift.includes('op\\":\\"snapshot'))
  assert.match(swift,/snapshot\?\["template"\] != nil/)
  assert.match(swift,/snapshot\?\["revision"\] != nil/)
  assert.match(swift,/self\.finishStartupProbe\(authorizedNative\)/)
})

test('server and Rust workspace allow the initial authenticated snapshot from unloaded state',()=>{
  assert.match(server,/workspaceAuth\.authorize\(/)
  assert.match(server,/workspace\.request\(packet\)/)
  assert.match(workspace,/let child=null,pending=null,busy=false,loaded=false/)
  assert.match(workspace,/if\(!loaded&&!\['open','snapshot'\]\.includes\(data\.op\)\)/)
  assert.match(workspace,/if\(!loaded\|\|data\.op==='open'\)\{/)
  assert.match(workspace,/if\(result\.ok\)\{loaded=true;await save\(\)\}/)
})

test('cached Node runtime is pinned by bundled SHA rather than spoofable size or timestamps',()=>{
  assert.match(swift,/sourceType\.isRegularFile == true && sourceType\.isSymbolicLink != true/)
  assert.match(swift,/private func executableSHA256\(_ url: URL\) throws -> String/)
  assert.match(swift,/SHA256\(\)/)
  assert.match(swift,/let bundledIdentity = try executableSHA256\(bundledNode\)/)
  assert.match(swift,/\(try\? executableSHA256\(node\)\) == bundledIdentity/)
  assert.match(swift,/try FileManager\.default\.copyItem\(at: bundledNode, to: stagedNode\)/)
  assert.match(swift,/guard try executableSHA256\(stagedNode\) == bundledIdentity/)
  assert.match(swift,/rename\(stagedNode\.path, node\.path\) == 0/)
  assert.doesNotMatch(swift,/let sizeMatches = |let timeMatches = /)
})

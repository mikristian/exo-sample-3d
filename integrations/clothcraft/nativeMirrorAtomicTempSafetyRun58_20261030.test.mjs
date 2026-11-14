import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {beginNativeMirrorSave20261030, commitNativeMirrorSave20261030} from './nativeMirrorTransaction20261030.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-mirror-temp-run58-'))
  t.after(() => fs.rmSync(root, {recursive:true, force:true}))
  const mirror = path.join(root, 'fitting-project.json')
  const project = {template:{format:'exo-garment',version:1,name:'TEMP SAFETY',fabrics:[],panels:[],seams:[]},avatar_path:'',mesh_signature:null}
  fs.writeFileSync(mirror, JSON.stringify(project))
  fs.writeFileSync(`${mirror}.native`, JSON.stringify(project))
  return {root, mirror, project, temporary:`${mirror}.native-mirror-intent-v1.json.tmp`}
}

test('native mirror intent must not follow a preexisting temporary symlink into another file', t => {
  const {root, mirror, temporary} = fixture(t)
  const unrelated = path.join(root, 'unrelated-user-file.txt')
  fs.writeFileSync(unrelated, 'PRESERVE UNRELATED CONTENT')
  fs.symlinkSync(unrelated, temporary)
  beginNativeMirrorSave20261030(mirror)
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'PRESERVE UNRELATED CONTENT')
  assert.equal(fs.lstatSync(temporary).isSymbolicLink(), true)
  assert.ok(fs.existsSync(`${mirror}.native-mirror-intent-v1.json`))
})

test('native mirror intent must not truncate another writer’s existing temporary file', t => {
  const {mirror, temporary, project} = fixture(t)
  fs.writeFileSync(temporary, 'OTHER WRITER STAGING DATA')
  beginNativeMirrorSave20261030(mirror)
  assert.equal(fs.readFileSync(temporary, 'utf8'), 'OTHER WRITER STAGING DATA')
  commitNativeMirrorSave20261030(mirror, project)
  assert.equal(fs.existsSync(`${mirror}.native-mirror-intent-v1.json`), false)
})

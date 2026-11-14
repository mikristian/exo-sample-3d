import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,statSync,renameSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

// Disposable admission fixtures only. No factory records or global receiver
// slots are modified; this is not a CUT or licensed-CAD authorization test.
const launcher=fileURLToPath(new URL('./industrialSignedFactoryZipLockf20261031.sh',import.meta.url))
const identity=path=>{
  const stat=statSync(path,{bigint:true})
  return `${stat.dev}:${stat.ino}`
}
const execute=(a,b,idA,idB)=>spawnSync('/bin/sh',[
  launcher,a,b,idA,idB,process.execPath,'-e',
  'process.stdout.write("RECEIVER_CHILD_STARTED")',
],{encoding:'utf8',timeout:5000})

test('macOS lockf launcher admits only a slot matching the parent-checked inode',
  {skip:process.platform!=='darwin'},()=>{
    const directory=mkdtempSync(join(tmpdir(),'exo-receiver-identity-'))
    try{
      const a=join(directory,'slot-0.lock'),b=join(directory,'slot-1.lock')
      writeFileSync(a,'',{mode:0o600})
      writeFileSync(b,'',{mode:0o600})
      const result=execute(a,b,identity(a),identity(b))
      assert.equal(result.status,0,result.stderr)
      assert.equal(result.stdout,'RECEIVER_CHILD_STARTED')
    }finally{rmSync(directory,{recursive:true,force:true})}
  })

test('macOS lockf launcher fails closed on stale or forged slot inode identity',
  {skip:process.platform!=='darwin'},()=>{
    const directory=mkdtempSync(join(tmpdir(),'exo-receiver-identity-'))
    try{
      const a=join(directory,'slot-0.lock'),b=join(directory,'slot-1.lock')
      writeFileSync(a,'',{mode:0o600})
      writeFileSync(b,'',{mode:0o600})
      const result=execute(a,b,'0:0',identity(b))
      assert.equal(result.status,74,result.stderr)
      assert.equal(result.stdout,'','worker must not run on mismatched inode')
    }finally{rmSync(directory,{recursive:true,force:true})}
  })

test('macOS slot pathname replacement after identity capture blocks execution',
  {skip:process.platform!=='darwin'},()=>{
    const directory=mkdtempSync(join(tmpdir(),'exo-receiver-identity-'))
    try{
      const a=join(directory,'slot-0.lock'),b=join(directory,'slot-1.lock')
      writeFileSync(a,'',{mode:0o600})
      writeFileSync(b,'',{mode:0o600})
      const expected=identity(a)
      renameSync(a,join(directory,'original-slot.lock'))
      writeFileSync(a,'',{mode:0o600})
      assert.notEqual(identity(a),expected)
      const result=execute(a,b,expected,identity(b))
      assert.equal(result.status,74,result.stderr)
      assert.equal(result.stdout,'','replaced slot cannot admit receiver')
    }finally{rmSync(directory,{recursive:true,force:true})}
  })

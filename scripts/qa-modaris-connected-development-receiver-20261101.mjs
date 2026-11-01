#!/usr/bin/env node
// A separate-process digital ZIP receipt, intentionally not factory approval.
import {readFileSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import {inspectConnectedDevelopmentZip20261101} from '../src/core/modarisConnectedDevelopmentReceiver20261101.js'

const [file,...extra]=process.argv.slice(2)
if(!file||extra.length){
  console.error('Usage: node scripts/qa-modaris-connected-development-receiver-20261101.mjs <development-review.zip>')
  process.exitCode=2
}else{
  try{
    const path=resolve(file)
    if(statSync(path).size>100_000_000)throw Error('Archive exceeds receiver limit')
    const result=inspectConnectedDevelopmentZip20261101(readFileSync(path))
    console.log(JSON.stringify({...result,receiptType:'INTERNAL_DIGITAL_ONLY',factoryApproved:false},null,2))
  }catch(error){
    console.error(`Connected development receiving REFUSED: ${error.message}`)
    process.exitCode=1
  }
}

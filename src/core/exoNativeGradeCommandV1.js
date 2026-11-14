/**
 * Browser-facing request constructor for EXO's native Rust grading command
 * contract. The TypeScript shape comes from the isolated checked Rust schema:
 * rust/exo_command_contract/src/lib.rs (generated bindings via ts-rs).
 *
 * The active native session remains the authoritative JSON handler until it
 * imports this shared schema. This module does NOT calculate grade geometry.
 * No app UI or fallback path is changed by the validation itself.
 *
 * @typedef {import('../../rust/exo_command_contract/bindings/ExoGradeCommandV1').ExoGradeCommandV1} ExoGradeCommandV1
 */

const validRevision=revision=>Number.isSafeInteger(revision)&&revision>=0
const validSize=size=>typeof size==='string'&&size.length>0&&size.length<=64&&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(size)

/** @returns {ExoGradeCommandV1} */
export function nativeGradeStatusCommandV1(revision){
  if(!validRevision(revision))throw Error('Native grade status requires a safe, nonnegative revision')
  return Object.freeze({op:'grade-run-status',revision})
}

/** @returns {ExoGradeCommandV1} */
export function nativeGradeCutlinesCommandV1(revision){
  if(!validRevision(revision))throw Error('Native grade cutlines require a safe, nonnegative revision')
  return Object.freeze({op:'grade-run-cutlines',revision})
}

/** @returns {ExoGradeCommandV1} */
export function nativeGradeActivateCommandV1(revision,size){
  if(!validRevision(revision))throw Error('Native size activation requires a safe, nonnegative revision')
  if(!validSize(size))throw Error('Native size activation requires a short printable size label')
  return Object.freeze({op:'grade-run-activate',revision,size})
}

/** @returns {ExoGradeCommandV1} */
export function nativeGradeRestoreCommandV1(revision){
  if(!validRevision(revision))throw Error('Native size restoration requires a safe, nonnegative revision')
  return Object.freeze({op:'grade-run-restore',revision})
}

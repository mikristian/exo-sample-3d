import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {inspectExoMotionRig20261102,exoMotionClip20261102} from './exoAvatarMotionRig20261102.js'

const rig=names=>{
 const group=new THREE.Group()
 for(const name of names){const bone=new THREE.Bone();bone.name=name;group.add(bone)}
 return group
}
const clip=names=>new THREE.AnimationClip('Walk',1,names.map(n=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,[0,1],[0,0,0,1,0,0,0,1])))
test('only matched MakeHuman 163 bone family may use curated rig clip without retarget',()=>{
 const required=['root','footL','footR','upperleg01L','upperleg01R','lowerleg01L','lowerleg01R','head']
 const names=[...required,...Array.from({length:155},(_,i)=>`bone${i}`)]
 const compatible=inspectExoMotionRig20261102(rig(names),clip(names))
 assert.equal(compatible.compatible,true)
 assert.equal(compatible.bones,163)
 assert.equal(compatible.matched,163)
 const notMixamo=inspectExoMotionRig20261102(rig(['mixamorigHips','mixamorigLeftFoot',...Array.from({length:50},(_,i)=>`m${i}`)]),clip(names))
 assert.equal(notMixamo.compatible,false)
 assert.equal(notMixamo.rigFamily,'unmapped')
})
test('malformed or missing gait tracks must not animate as if rigged',()=>{
 const r=rig(['root','footL','footR'])
 assert.equal(inspectExoMotionRig20261102(r,null).compatible,false)
 assert.equal(inspectExoMotionRig20261102(r,clip(['root'])).compatible,false)
 assert.equal(exoMotionClip20261102('unknown').id,'none')
})

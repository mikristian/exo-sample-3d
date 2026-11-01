import test from 'node:test'
import assert from 'node:assert/strict'
import {createTechPackReviewNote,patchTechPackReviewNote} from './techPackReviewNotes20261031.js'
test('authored sticky/comment notes remain project-level and use bounded artboard locations',()=>{
 const comment=createTechPackReviewNote('comment',9999,-50,'note-a')
 assert.equal(comment.x,760);assert.equal(comment.y,0)
 const modified=patchTechPackReviewNote([comment],'note-a',{x:900,y:1000,text:'x'.repeat(2500),status:'bad',id:'replaced',kind:'bad'})
 assert.equal(modified[0].id,'note-a');assert.equal(modified[0].kind,'comment')
 assert.equal(modified[0].x,577);assert.equal(modified[0].y,762)
 assert.equal(modified[0].text.length,2000)
 assert.equal(modified[0].status,'open')
 assert.equal(comment.text,'')
})

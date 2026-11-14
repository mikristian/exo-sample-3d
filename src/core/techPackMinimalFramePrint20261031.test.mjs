import test from 'node:test'
import assert from 'node:assert/strict'
import {createDefaultProject} from '../data/defaultProject.js'
import {techPackSource} from './techPackWorkspaceModel.js'
import {createBlankFramedTechPackPage} from './techPackMinimalFrame20261031.js'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'
import {createTechPackGalleryTable} from './techpack-spreadsheet/techPackTableGallery20261030.js'

const source=techPackSource(createDefaultProject(),null,false)
const pageId='custom-seville-one'
const base=()=>createBlankFramedTechPackPage({customPages:[],pageBoxes:{},pages:{},annotations:{}},pageId,'',[],{
  source,draft:{brand:'MIKRISTIAN',sku:'MK-HD002'}})
const sheet=html=>{
  const marker='<section class="sheet seville custom-artboard exo-minimal-framed-print"'
  const start=html.indexOf(marker)
  assert.ok(start>0,'print contains framed template')
  return html.slice(start,html.indexOf('</main>',start)+7)
}
test('Mikristian-inspired sheet prints a true outer frame, common source header and open center',()=>{
  const html=renderTechPackWorkspacePrintHTML(source,{brand:'MIKRISTIAN',sku:'MK-HD002'},base())
  const printed=sheet(html)
  assert.match(printed,/exo-minimal-export-frame/)
  assert.match(printed,/STYLE NO\./)
  assert.match(printed,/MK-HD002/)
  assert.match(printed,/BRAND/)
  assert.doesNotMatch(printed,/Technical drawing \/ reference|Reference pending/)
  assert.match(printed,/data-techpack-header="true"/)
  assert.match(html,/@page MinimalFrameLetter\{size:Letter portrait;margin:0\}/)
})
test('unfilled drawing placeholder remains blank in print',()=>{
  const workspace=base()
  workspace.pageBoxes[pageId]=[{id:'drawing-zone',positionMode:'absolute',x:40,y:150,width:528,height:405,
    title:'Technical drawing / reference',slot:{category:'custom',contentType:'photo',templateRole:'reference'}}]
  const printed=sheet(renderTechPackWorkspacePrintHTML(source,{},workspace))
  assert.doesNotMatch(printed,/Technical drawing \/ reference|Reference pending|drawing-zone/)
})
test('optional bottom table prints only its grid, without outer box title/editor chrome',()=>{
  const workspace=base(),table=createTechPackGalleryTable('blank')
  workspace.pageBoxes[pageId]=[{id:'bottom-table',positionMode:'absolute',x:39,y:591,width:534,height:139,
    title:'SECRET OUTER TITLE',slot:{category:'tables',templateRole:'bottom-table',spreadsheetTable:table}}]
  const printed=sheet(renderTechPackWorkspacePrintHTML(source,{},workspace))
  assert.match(printed,/data-embedded-table-only="true"/)
  assert.match(printed,/left:39px;top:591px/)
  assert.doesNotMatch(printed,/SECRET OUTER TITLE|Add optional bottom specification table/)
})

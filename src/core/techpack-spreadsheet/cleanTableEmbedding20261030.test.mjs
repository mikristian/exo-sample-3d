import test from 'node:test'
import assert from 'node:assert/strict'
import {renderTechPackWorkspacePrintHTML} from '../techPackWorkspacePrint.js'
import {techPackSource} from '../techPackWorkspaceModel.js'
import {createDefaultProject} from '../../data/defaultProject.js'
import {createTechPackGalleryTable,applyTechPackHeaderPreset} from './techPackTableGallery20261030.js'

const source=techPackSource(createDefaultProject(),null,false)
const table=applyTechPackHeaderPreset(createTechPackGalleryTable('size-chart',{title:'Size specification'}),'title-band')
const box={id:'clean-1',positionMode:'absolute',x:58,y:70,width:410,height:340,
  title:'EXTRA BOX HEADER SHOULD NOT RENDER',border:'solid',note:'EXTRA BOX NOTE SHOULD NOT RENDER',
  slot:{category:'tables',title:'Size specification',spreadsheetTable:table}}

test('custom techpack artboard embeds only styled merged table, no box heading, note or border',()=>{
  const workspace={customPages:[{id:'custom-clean',name:'Specifications'}],
    pageBoxes:{'custom-clean':[box]}}
  const html=renderTechPackWorkspacePrintHTML(source,{},workspace)
  const marker=html.indexOf('data-embedded-table-only="true"')
  assert.ok(marker>0,'table-only artboard marker')
  const region=html.slice(marker,marker+3800)
  assert.match(region,/border:0;padding:0/)
  assert.match(region,/colspan="6"/)
  assert.match(region,/Size specification/)
  assert.doesNotMatch(region,/EXTRA BOX HEADER SHOULD NOT RENDER|EXTRA BOX NOTE SHOULD NOT RENDER/)
  assert.doesNotMatch(region,/<button|<textarea|Formula bar/)
})

test('standard page print also uses table-only artwork, independent of editor widget chrome',()=>{
  const workspace={pageBoxes:{overview:[box]}}
  const html=renderTechPackWorkspacePrintHTML(source,{},workspace)
  const marker=html.indexOf('data-embedded-table-only="true"')
  assert.ok(marker>0)
  const region=html.slice(marker,marker+3800)
  assert.match(region,/position:absolute;left:58px;top:70px/)
  assert.match(region,/colspan="6"/)
  assert.doesNotMatch(region,/EXTRA BOX HEADER SHOULD NOT RENDER|EXTRA BOX NOTE SHOULD NOT RENDER/)
})

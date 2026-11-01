import test from 'node:test'
import assert from 'node:assert/strict'
import {createDefaultProject} from '../data/defaultProject.js'
import {techPackSource,TECHPACK_PAGES} from './techPackWorkspaceModel.js'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'
import {pageMarkerSvgMarkup,normalizedPageMarkers,safeMarkerColor,safeMarkerWidth,safePencilColor,safePencilWidth,safePageMarkupMode,pageMarkupOpacity} from './techPackPageMarkup.js'

const valid={id:'highlight-1',type:'highlighter',scope:'page',color:'#fa8ca5',width:40,points:[[120,240],[160,245],[210,275]],label:'important'}

test('colored page marks retain selected color, width and page coordinates',()=>{
  const marks=normalizedPageMarkers([valid,{type:'highlighter',scope:'drawing',points:valid.points}])
  assert.equal(marks.length,1)
  assert.equal(marks[0].color,'#fa8ca5')
  assert.equal(marks[0].width,40)
  assert.deepEqual(marks[0].points,valid.points)
  assert.match(pageMarkerSvgMarkup([valid]),/data-page-highlighter-print="true"/)
  assert.match(pageMarkerSvgMarkup([valid]),/stroke-opacity="0\.38"/)
})

test('inert markup serialization fails closed against injected styles and invalid coordinates',()=>{
  const bad={...valid,color:'red" onload="alert(1)',width:1e9,points:[[Infinity,0],[-50,5000],[300,400]]}
  const rendered=pageMarkerSvgMarkup([bad])
  assert.equal(safeMarkerColor(bad.color),'#f4d03f')
  assert.equal(safeMarkerWidth(bad.width),24)
  assert.doesNotMatch(rendered,/onload=|alert\(/)
  assert.match(rendered,/points="0,1000 300,400"/)
  assert.equal(pageMarkerSvgMarkup([{type:'highlighter',scope:'page',points:[[NaN,2],[4,5]]}]),'')
})

test('pencil review uses opaque ink and distinct approved colors and widths',()=>{
  const pencil={id:'pencil-1',type:'pencil',scope:'page',color:'#2563eb',width:8,points:[[10,20],[50,60]]}
  const marks=normalizedPageMarkers([pencil,valid,{...pencil,scope:'drawing'}])
  assert.equal(marks.length,2)
  assert.equal(marks[0].color,'#2563eb')
  assert.equal(marks[0].width,8)
  const svg=pageMarkerSvgMarkup([pencil,valid])
  assert.match(svg,/stroke="#2563eb" stroke-width="8" stroke-opacity="1"/)
  assert.match(svg,/stroke="#fa8ca5" stroke-width="40" stroke-opacity="0\.38"/)
  assert.equal(safePencilColor('red" onload="evil'),'#e53935')
  assert.equal(safePencilWidth(999),4)
  assert.equal(safePageMarkupMode('other'),'highlighter')
  assert.equal(pageMarkupOpacity('pencil'),1)
  assert.equal(pageMarkupOpacity('highlighter'),0.38)
  assert.doesNotMatch(pageMarkerSvgMarkup([{...pencil,color:'blue" onload="bad',width:'100" foo="bar'}]),/onload|foo=|bad/)
})

test('print projects page pencil annotation on custom artboard without polluting manufacturing data',()=>{
  const pencil={id:'review-pencil',type:'pencil',scope:'page',color:'#e53935',width:2,points:[[4,8],[20,24]]}
  assert.match(pageMarkerSvgMarkup([pencil]),/stroke-opacity="1"/)
  assert.deepEqual(normalizedPageMarkers([pencil])[0].points,pencil.points)
})

test('print retains the single boxed Seville sheet, no default maker logos, folio and page-wide marker on correct page',()=>{
  const source=techPackSource(createDefaultProject(),null,false)
  const html=renderTechPackWorkspacePrintHTML(source,{brand:'MIKRISTIAN',styleName:'EXO T-Shirt'},
    {annotations:{measurements:[valid]}})
  assert.equal((html.match(/class="sheet seville /g)||[]).length,TECHPACK_PAGES.length)
  assert.equal((html.match(/class="seville-page-number"/g)||[]).length,TECHPACK_PAGES.length)
  assert.equal((html.match(/class="seville-ruled-frame"/g)||[]).length,TECHPACK_PAGES.length)
  assert.equal((html.match(/<img class="seville-footer-logo"/g)||[]).length,0)
  assert.doesNotMatch(html,/Original MIKRISTIAN Seville footer logo/)
  assert.equal((html.match(/data-page-highlighter-print="true"/g)||[]).length,1)
  assert.doesNotMatch(html,/<img class="seville-footer-logo"/)
  assert.match(html,/\.sheet\.seville \.seville-ruled-frame\{display:flex/)
  assert.match(html,/\.sheet\.seville \.seville-footer-logo\{/)
})

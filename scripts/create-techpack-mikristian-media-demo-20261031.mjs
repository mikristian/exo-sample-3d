#!/usr/bin/env node
/** LOCAL ONLY: proof of SEAGGS raster artwork + native MIKRISTIAN media pages.
 * The purchased SEAGGS master is not bundled with public EXO assets. This
 * derives a private sample in the user's already-authorized Mac workspace.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {techPackSource} from '../src/core/techPackWorkspaceModel.js'
import {createNikeTshirtExampleTechPack} from '../src/core/techPackNikeTshirtExample20261031.js'
import {createBlankFramedTechPackPage} from '../src/core/techPackMinimalFrame20261031.js'
import {createTechPackMiddleTemplate} from '../src/core/techPackMiddleTemplates20261031.js'
import {reconcileSmartPhotoLayout} from '../src/core/techPackSmartMediaLayout20261031.js'
import {applyTechPackMediaAssetToBox} from '../src/core/techPackMediaObjectMigration20261031.js'
import {renderTechPackWorkspacePrintHTML} from '../src/core/techPackWorkspacePrint.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const input=path.join(repo,'research/techpack-library/seaggs-v2-private/seaggs-tshirt-front-back-raster-private.png')
const saved=JSON.parse(fs.readFileSync(path.join(repo,'public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json')))
const image=fs.readFileSync(input)
const source=techPackSource(null,saved,true)
const authored=createNikeTshirtExampleTechPack({orientation:'portrait',paperSize:'Letter'},saved)
const page='custom-mikristian-seaggs-reference'
const gallery='custom-mikristian-photo-gallery'
const asset={id:'seaggs-private-tshirt-flat-20261031',name:'SEAGGS T-shirt front + back flat (raster preview)',
  caption:'Licensed source — private reference only',category:'technical flat',
  sourceType:'raster',vectorStatus:'raster-only',license:'private purchased reference',
  provenance:'Purchased SEAGGS V2 AI master; verified crop is NOT editable paths',
  width:1118,height:563,
  dataUrl:'data:image/png;base64,'+image.toString('base64')}
let workspace=createBlankFramedTechPackPage(authored.workspace,page,authored.workspace.pageOrder?.at(-1),
  [],{source,draft:authored.draftPatch,title:'COLOR, FABRIC & TECHNICAL FLATS'})
workspace=createBlankFramedTechPackPage(workspace,gallery,page,[],{source,draft:authored.draftPatch,title:'TEN REFERENCE MOCKUPS'})
const mid=createTechPackMiddleTemplate('middle-color-details',{pageId:page})
const colorBoxes=mid.pageBoxes.map(box=>box.slot.contentType==='photo'?
  applyTechPackMediaAssetToBox(box,asset,{width:asset.width,height:asset.height}):box)
const fabric={id:'demo-exo-fabric-chip',positionMode:'absolute',x:76,y:336,width:115,height:110,
  title:'EXO linked material',note:'',border:'none',lineColor:'transparent',
  slot:{category:'boxes',middleTemplateId:'middle-fabrics',contentType:'swatch',
    semanticRole:'fabric-swatch',swatchMode:'fabric',linkedFabricId:source.fabrics?.[0]?.id??'',
    swatchHex:source.fabrics?.[0]?.color??'#101010',swatchOverride:false}}
const pageBoxes={...workspace.pageBoxes,[page]:[...(workspace.pageBoxes[page]||[]),...colorBoxes,fabric]}
const photoLayout=reconcileSmartPhotoLayout({pageId:gallery,count:10,
  existingBoxes:[],otherBoxes:workspace.pageBoxes[gallery]||[],orientation:'portrait',paperSize:'Letter'})
pageBoxes[gallery]=[...(workspace.pageBoxes[gallery]||[]),...photoLayout.pageBoxes]
workspace={...workspace,pageBoxes,assets:[...(workspace.assets||[]),asset],
  assetTags:{...workspace.assetTags,[asset.id]:['tshirt','front','back','technical','drawing','seaggs']},
  pageMediaTags:{...workspace.pageMediaTags,[page]:['technical','drawing'],[gallery]:['mockup','drawing']}}
const draft={...authored.draftPatch,workspace}
const outDir=path.join(repo,'integrations/clothcraft/output/techpacks')
fs.mkdirSync(outDir,{recursive:true})
const stem=path.join(outDir,'MIKRISTIAN_SEAGGS_TSHIRT_MEDIA_OBJECTS_PRIVATE_20261031')
fs.writeFileSync(stem+'.json',JSON.stringify({kind:'exo-native-techpack-v2',
  version:2,draft,metadata:{privateQA:true,notFactoryApproved:true,representation:'SEAGGS raster-only',rights:'private purchased reference'}},null,2))
fs.writeFileSync(stem+'.html',renderTechPackWorkspacePrintHTML(source,draft,workspace,[asset]))
console.log(JSON.stringify({pages:workspace.pageOrder?.length,mediaExamplePage:page,galleryPage:gallery,
  seaggsAssetBytes:image.length,filledMainPhoto:colorBoxes.some(b=>b.assetId===asset.id),
  photoCount:photoLayout.pageBoxes.length,
  outputJson:stem+'.json',outputHtml:stem+'.html'},null,2))

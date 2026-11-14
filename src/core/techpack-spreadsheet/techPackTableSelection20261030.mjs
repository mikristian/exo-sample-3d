// Resolve the editable artboard table without modifying source-linked content.
// Board IDs are `box-${box.id}` while activeTableId stores `box.id`.
const validId = value => typeof value === 'string' || typeof value === 'number' ? String(value) : ''

function tableDimensions(table) {
  const columns = Array.isArray(table.columns) ? table.columns.length : Array.isArray(table.headers) ? table.headers.length : 0
  const rows = Array.isArray(table.rows) ? table.rows.length : 0
  return {rows,columns}
}

export function validateTechPackSelectedCell(table,selectedCell) {
  const {rows,columns}=tableDimensions(table||{})
  if (!rows || !columns) return null
  const r=selectedCell?.r, c=selectedCell?.c
  const result={r:Number.isInteger(r)&&r>=0&&r<rows?r:0,c:Number.isInteger(c)&&c>=0&&c<columns?c:0}
  if(Number.isInteger(selectedCell?.r2))result.r2=Math.max(0,Math.min(rows-1,selectedCell.r2))
  if(Number.isInteger(selectedCell?.c2))result.c2=Math.max(0,Math.min(columns-1,selectedCell.c2))
  return result
}

/**
 * Returns {activeTableBox,activeTable,boxId,tableId,selectedCell,reason,tableBoxes}.
 * `activeTableId` is the explicit table choice (box ID in current workspace).
 * A selected non-table board object blocks the passive first-table fallback.
 * Invalid explicit IDs also block fallback, avoiding writes to a wrong table.
 */
export function resolveTechPackTableSelection({page,pageBoxes,legacyTables,activeTableId='',selectedBoardObject=null,selectedCell=null}={}) {
  const originalBoxes=Array.isArray(pageBoxes)?pageBoxes:Array.isArray(pageBoxes?.[page])?pageBoxes[page]:[]
  // Old user-authored custom tables are represented as virtual artboard
  // objects, not migrated or duplicated in persistent storage.
  const existing=Array.isArray(legacyTables)?legacyTables:Array.isArray(legacyTables?.[page])?legacyTables[page]:[]
  const boxes=[...originalBoxes,...existing.filter(table=>table?.id!=null).map(table=>({
    id:`legacy-${table.id}`,legacyTableId:String(table.id),title:table.title||'Custom table',
    slot:{category:'tables',title:table.title||'Custom table',spreadsheetTable:table}
  }))]
  const tableBoxes=boxes.filter(box=>box&&box.slot?.category==='tables'&&box.slot?.spreadsheetTable&&typeof box.slot.spreadsheetTable==='object')
  const requested=validId(activeTableId)
  const selectedOnPage=selectedBoardObject&&selectedBoardObject.pageId===page&&typeof selectedBoardObject.id==='string'
  const boardId=selectedOnPage?selectedBoardObject.id:''
  const selectedBox=boardId.startsWith('box-')?boxes.find(box=>!box.legacyTableId&&`box-${box.id}`===boardId):
    boardId.startsWith('table-')?boxes.find(box=>box.legacyTableId&&`table-${box.legacyTableId}`===boardId):null
  const selectedTableBox=selectedBox&&tableBoxes.includes(selectedBox)?selectedBox:null
  const explicit=tableBoxes.find(box=>validId(box.id)===requested||validId(box.slot.spreadsheetTable.id)===requested)
  let activeTableBox=null, reason='none'
  if(selectedTableBox){activeTableBox=selectedTableBox;reason='selected-table'}
  else if(boardId){reason='non-table-selection'}
  else if(requested){activeTableBox=explicit||null;reason=explicit?'explicit-table':'invalid-table-id'}
  else if(tableBoxes.length){activeTableBox=tableBoxes[0];reason='first-table'}
  const activeTable=activeTableBox?.slot.spreadsheetTable||null
  return {activeTableBox,activeTable,boxId:activeTableBox?.id??null,tableId:activeTable?.id??null,
    selectedCell:activeTable?validateTechPackSelectedCell(activeTable,selectedCell):null,reason,tableBoxes}
}

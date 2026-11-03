// EXO full-app guide contract. These are verified UI journeys, not a claim
// that the agent can already author arbitrary grading/tech packs autonomously.
export const EXO_GUIDES_20261102=Object.freeze({
  pattern:{
    title:'Pattern drafting',intro:'I can guide you through the 2D drafting workspace.',
    steps:[
      {target:'pattern',title:'Open Pattern',detail:'The Pattern button opens the garment drafting controls. You can also switch to the full 2D layout.',navigate:'pattern'},
      {target:'command-search',title:'Find a drafting tool',detail:'Search contains working commands. Try a point, split, curve, measure, or notch tool.',navigate:'search'},
      {target:'workspace',title:'Choose your view',detail:'The workspace selector switches between the supported workspaces. You can return to Pattern at any time.',navigate:'pattern'},
    ]
  },
  material:{
    title:'Material editing',intro:'I can point out material properties and the fabric library.',
    steps:[
      {target:'fabric-tool',title:'Fabric properties',detail:'Select a pattern piece, then open Fabric properties to inspect and change its assigned material.',navigate:'fabric'},
      {target:'command-search',title:'Browse materials',detail:'Search for fabric commands or ask the assistant to open the Fabric library.',navigate:'fabric-library'},
      {target:'save',title:'Save changes',detail:'Save the project after checking your material properties and visible fabric assignment.',navigate:'save'},
    ]
  },
  grading:{
    title:'Pattern grading',intro:'Grading is a production-sensitive workflow. I can navigate to tools and explain checks, not certify factory-ready grades.',
    steps:[
      {target:'grading-tool',title:'Open Grading',detail:'Open the Production and grading controls. Select the correct pattern and base size before editing.',navigate:'grading'},
      {target:'command-search',title:'Find size rules',detail:'Search for grading and rule controls; review size-specific deltas and graded nests before export.',navigate:'search'},
      {target:'save',title:'Check and save',detail:'Verify geometry, notches, POM and seam continuity for each size. Save only after reviewing the changes.',navigate:'save'},
    ]
  },
  techpack:{
    title:'Tech pack workflow',intro:'I can guide you to the dedicated Techpack workspace and help you understand specification sections.',
    steps:[
      {target:'workspace-modes',title:'Switch workspaces',detail:'Use the simulation/workspace dropdown to open the Techpack Workspace.',navigate:'techpack'},
      {target:'save',title:'Review project source',detail:'Keep the garment and measurements saved. A tech pack should reflect the actual project rather than invented measurements.',navigate:'save'},
      {target:'assistant-launch',title:'Ask about fields',detail:'Ask me what a POM, BOM, material, construction or grading field means. I can explain a field before you fill it.',navigate:'assistant'},
    ]
  },
  basics:{
    title:'EXO essentials',intro:'Here are the main places to start in ClothCraft.',
    steps:[
      {target:'pattern',title:'Drafting',detail:'Start in Pattern to build, edit and measure 2D shapes.',navigate:'pattern'},
      {target:'fabric-tool',title:'Materials',detail:'Fabric controls describe the physical and visual material used by the garment.',navigate:'fabric'},
      {target:'workspace-modes',title:'Specialized workspaces',detail:'Simulation, animation, print layout and tech packs are accessible from the workspace-mode menu.',navigate:'techpack'},
      {target:'save',title:'Save your work',detail:'Use Save to persist the current garment project.',navigate:'save'},
    ]
  }
})

const pattern=/\b(pattern|drafting|2d|draw|pen tool|points?|curve|notch|seam allowance)\b/i
const material=/\b(fabric|material|textile|denim|cotton|gsm|texture|color|swatch)\b/i
const grading=/\b(grad(?:e|ing)|size run|size rules?|nest|size break|size chart|pom)\b/i
const techpack=/\b(tech\s?-?\s?pack|techpack|specifications?|bom|bill of materials|construction sheet)\b/i
export function resolveExoGuide20261102(text){
  const value=String(text||'').slice(0,400).trim()
  if(!value)return null
  if(techpack.test(value))return 'techpack'
  if(grading.test(value))return 'grading'
  if(material.test(value))return 'material'
  if(pattern.test(value))return 'pattern'
  if(/\b(tutorial|teach|walkthrough|show me around|how (?:do|to|can i) use|getting started|beginner|help me learn)\b/i.test(value))return 'basics'
  return null
}

export function classifyExoAssistantRequest20261102(text){
  const raw=String(text||'').slice(0,400).trim()
  if(!raw)return {kind:'empty'}
  const guide=resolveExoGuide20261102(raw)
  if(guide&&/\b(tutorial|teach|explain|walk(?: me)? through|guide|how (?:do|to|can)|where|stuck|help|show me|learn|train)\b/i.test(raw))return {kind:'guide',guide}
  if(guide&&/\b(go to|open|take me|navigate|switch to)\b/i.test(raw)&&!/\b(apply|edit|change|set|grade|make)\b/i.test(raw))return {kind:'navigate',guide}
  if(guide==='basics')return {kind:'guide',guide}
  return {kind:'command',text:raw}
}

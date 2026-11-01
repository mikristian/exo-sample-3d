/** Production page recipes. IDs describe required deliverables, never sample garment data. */
const page=(id,name,compositionId,description)=>Object.freeze({id,name,compositionId,description})
export const TECHPACK_PRODUCTION_PAGES=Object.freeze([
  page('cover','Style cover','brand-cover','Style identity, season, factory and hero views'),
  page('technical-flats','Front/back technical flats','front-back','Front and rear vector drawings, style identifiers'),
  page('construction','Construction overview','construction','Assembly methods, stitches, seam types and SPI'),
  page('sewing-operations','Sewing operation breakdown','technical-callouts','Numbered operation order, machines and finishing'),
  page('detail-callouts','Construction detail callouts','technical-callouts','Enlarged pockets, closures, reinforcements and annotations'),
  page('pattern-inventory','Pattern piece inventory','spec-sheet','Cut piece names, quantities, symmetry, fabric and lining'),
  page('pattern-cut-plan','Pattern cutting instructions','technical-callouts','Grainline, fold, ply, nap direction and cut order'),
  page('pattern-notches','Notches and drill marks','technical-callouts','Matching points, balance marks, holes and construction registration'),
  page('pattern-seam-allowance','Seam and hem allowances','technical-callouts','Piece-by-piece allowance widths and seam treatment'),
  page('pattern-grading','Pattern grade rules','fit-measurements','Base size, grade increments, nest comparison and tolerance'),
  page('measurements','Points of measure','fit-measurements','POM diagrams, base measurements, tolerances and method'),
  page('size-spec','Graded size specifications','spec-sheet','Size run and measurement increments'),
  page('fit-comments','Fit approval record','references','Fit images, corrections, sample rounds and signoff'),
  page('fabric','Fabric specification','fabric-swatches','Composition, weight, width, finish, shrinkage and supplier'),
  page('colors','Colorway specification','color-swatches','Pantone or lab dips, color codes and approved combinations'),
  page('bom','Bill of materials','bill-of-materials','Material, trim, consumption, sourcing and approved substitutes'),
  page('trim','Trim and hardware','fabric-swatches','Zippers, snaps, labels, cords and placement'),
  page('artwork','Artwork specification','logo-placement','Art scale, placement, process, separations and file revision'),
  page('print-embroidery','Print and embroidery','technical-callouts','Stitch density, ink systems, placement and color approvals'),
  page('labels','Labels and care instructions','logo-placement','Main, size, care, country-of-origin and legal copy'),
  page('qc','Quality control checklist','spec-sheet','Inspection points, defect classification, sampling and disposition'),
  page('testing','Material and garment testing','spec-sheet','Colorfastness, wash, dimensional stability and performance tests'),
  page('packing','Folding and packing','construction','Folding sequence, polybag, carton and barcode requirements'),
  page('shipping-cartons','Carton and shipment specification','spec-sheet','Assortment, carton marks, net/gross weight and dimensions'),
  page('costing','Costing worksheet','spec-sheet','Material, labor, overhead, freight, wastage and landed cost'),
  page('revision-history','Revisions and approvals','spec-sheet','Issue date, changes, sample round and approval owner'),
  page('reference-board','Reference and development images','references','Design intent and development references'),
])
const recipes=[
  ['factory-complete','Factory production master','All specifications from initial sampling to bulk shipment',['cover','technical-flats','construction','sewing-operations','detail-callouts','pattern-inventory','pattern-cut-plan','pattern-notches','pattern-seam-allowance','pattern-grading','measurements','size-spec','fit-comments','fabric','colors','bom','trim','artwork','print-embroidery','labels','qc','testing','packing','shipping-cartons','costing','revision-history']],
  ['cut-and-sew','Cut and sew apparel','Factory-ready sewn garment specifications',['cover','technical-flats','construction','sewing-operations','detail-callouts','pattern-inventory','pattern-cut-plan','pattern-seam-allowance','measurements','size-spec','fabric','bom','trim','labels','qc','packing','revision-history']],
  ['knitwear','Fully fashioned knitwear','Knit structures, panels, gauges, linking and finishing',['cover','technical-flats','construction','detail-callouts','pattern-inventory','measurements','size-spec','fabric','colors','bom','trim','labels','qc','testing','packing','revision-history']],
  ['outerwear','Technical outerwear','Multi-layer, insulation and weather-protection product specification',['cover','technical-flats','construction','sewing-operations','detail-callouts','pattern-inventory','pattern-notches','pattern-seam-allowance','measurements','size-spec','fabric','bom','trim','testing','qc','packing','revision-history']],
  ['denim','Denim and washed bottoms','Denim construction, laundry, wash and shade approvals',['cover','technical-flats','construction','sewing-operations','pattern-inventory','pattern-cut-plan','measurements','size-spec','fabric','colors','bom','trim','testing','qc','packing','revision-history']],
  ['jersey-tee','Jersey tee and fleece','T-shirt, hoodie, sweats and similar knit cut-and-sew styles',['cover','technical-flats','construction','detail-callouts','pattern-inventory','pattern-seam-allowance','measurements','size-spec','fabric','colors','bom','artwork','labels','qc','packing','revision-history']],
  ['activewear','Performance activewear','Stretch performance, seam stretch, recovery and laboratory testing',['cover','technical-flats','construction','sewing-operations','pattern-inventory','pattern-grading','measurements','size-spec','fabric','bom','print-embroidery','testing','qc','packing','revision-history']],
  ['structured-tailoring','Structured and tailored garments','Jackets, trousers, lining, interlining and structured details',['cover','technical-flats','construction','sewing-operations','detail-callouts','pattern-inventory','pattern-cut-plan','pattern-notches','pattern-seam-allowance','pattern-grading','measurements','size-spec','fit-comments','fabric','bom','trim','qc','revision-history']],
  ['artwork-placement','Graphic artwork development','Graphic placement, separations and print production',['cover','technical-flats','colors','artwork','print-embroidery','labels','testing','qc','revision-history']],
  ['sample-review','Sample development and fit','Round-by-round fitting and corrections',['cover','technical-flats','measurements','size-spec','fit-comments','detail-callouts','revision-history']],
  ['pattern-room','Pattern room and cutting','Drafting, notches, grain, grading and cutting directions',['cover','technical-flats','pattern-inventory','pattern-cut-plan','pattern-notches','pattern-seam-allowance','pattern-grading','measurements','size-spec','fabric','revision-history']],
  ['factory-qc','Factory quality and shipment','Inspection, compliance, packaging and delivery',['cover','technical-flats','bom','qc','testing','packing','shipping-cartons','revision-history']],
  ['accessories-softgoods','Bags and soft accessories','Panels, hardware, reinforcement and assembly',['cover','technical-flats','construction','sewing-operations','detail-callouts','pattern-inventory','pattern-cut-plan','fabric','colors','bom','trim','artwork','qc','packing','costing','revision-history']],
]
const pagesById=new Map(TECHPACK_PRODUCTION_PAGES.map(p=>[p.id,p]))
export const TECHPACK_PRODUCTION_PACKS=Object.freeze(recipes.map(([id,name,description,ids])=>Object.freeze({id:`production-${id}`,kind:'production-pack-recipe',category:'packs',name,description,pageRecipeIds:Object.freeze(ids),pages:Object.freeze(ids.map(pageId=>pagesById.get(pageId)))})))
export function getTechPackProductionPage(id){const found=pagesById.get(id);if(!found)throw new RangeError(`Unknown production page: ${String(id)}`);return found}
export function createTechPackProductionPackRecipe(packId){const pack=TECHPACK_PRODUCTION_PACKS.find(item=>item.id===packId);if(!pack)throw new RangeError(`Unknown production pack: ${String(packId)}`);return {id:pack.id,name:pack.name,kind:pack.kind,pageRecipeIds:[...pack.pageRecipeIds],pages:pack.pages.map(({id,name,compositionId,description})=>({id,name,compositionId,description}))}}

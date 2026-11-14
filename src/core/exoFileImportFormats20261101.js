/** The file picker must not imply that an Illustrator document, PDF or 3D
 *  avatar will become a native garment pattern without an actual converter. */
export const EXO_IMPORT_FORMATS_20261101=Object.freeze({
  'svg':Object.freeze({kind:'pattern',editable:true,description:'Illustrator SVG closed contours → editable 2D pattern pieces'}),
  'dxf':Object.freeze({kind:'pattern',editable:true,description:'DXF closed outlines → editable 2D pattern pieces; manufacturing references stay locked'}),
  'obj':Object.freeze({kind:'mesh-reference',editable:false,description:'OBJ → visual 3D avatar reference, not a Rust fitting collision body'}),
  'glb':Object.freeze({kind:'mesh-reference',editable:false,description:'GLB → visual 3D avatar reference, not a Rust fitting collision body'}),
  'pdf':Object.freeze({kind:'document-reference',editable:false,description:'PDF → validated source document reference; does not create editable pattern geometry'}),
  'ai':Object.freeze({kind:'needs-conversion',editable:false,description:'Illustrator .ai → export SVG with outlined closed paths for editable 2D patterns, or PDF for reference'}),
})
export function classifyExoImportFile20261101(name){
  const match=typeof name==='string'&&name.match(/\.([a-z0-9]+)$/i)
  return match?EXO_IMPORT_FORMATS_20261101[match[1].toLowerCase()]||null:null
}
/** Strict, bounded PDF source validation; does not parse pages or claim rasterization. */
export function verifyExoPdfReference20261101(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<20||bytes.byteLength>12*1024*1024)
    throw Error('PDF reference must be between 20 bytes and 12 MB')
  const header=new TextDecoder('ascii').decode(bytes.subarray(0,8))
  if(!/^%PDF-1\.[0-7]/.test(header)&&!/^%PDF-2\.0/.test(header))
    throw Error('Invalid PDF header')
  const footer=new TextDecoder('ascii').decode(bytes.subarray(Math.max(0,bytes.length-4096)))
  if(!/%%EOF\s*$/.test(footer))throw Error('PDF is incomplete or has unsupported trailing bytes')
  return Object.freeze({ok:true,bytes:bytes.byteLength,referenceOnly:true,editable:false,
    manufacturingApproved:false})
}

/** Conservative description-to-pattern intent parser. Produces retrieval hints only.
 * Archive IDs are opaque; none of these terms establishes source compatibility.
 */
const FAMILY = [
  ['hoodie', /\b(?:hoodie|hooded\s+(?:sweatshirt|pullover|jacket))s?\b/i],
  ['shirt', /\b(?:t[ -]?shirts?|tees?|shirts?|blouses?|polo\s+shirts?)\b/i],
  ['pants', /\b(?:pants|trousers|jeans|joggers|leggings|shorts)\b/i],
  ['dress', /\b(?:dresses|dress|gowns?)\b/i],
  ['jacket', /\b(?:jackets?|coats?|blazers?|bombers?|parkas?)\b/i],
  ['skirt', /\b(?:skirts?)\b/i],
  ['jumpsuit', /\b(?:jumpsuits?|rompers?|overalls?)\b/i],
];
const TERMS = {
  silhouette: [['cropped',/\b(?:cropped|crop\s+top|crop\s+length)\b/i],['oversized',/\b(?:oversized|boxy)\b/i],['tapered',/\b(?:tapered|taper)\b/i],['straight',/\bstraight[ -]?(?:leg|cut|fit)\b/i],['flared',/\b(?:flared|flare|bell[ -]bottom)\b/i],['a_line',/\ba[ -]line\b/i],['fitted',/\b(?:bodycon|fitted|tailored|slim[ -]cut)\b/i]],
  fit: [['relaxed',/\b(?:relaxed|loose|roomy|baggy)\b/i],['slim',/\b(?:slim[ -]?fit|skinny|close[ -]fitting)\b/i],['regular',/\b(?:regular[ -]?fit|standard[ -]?fit)\b/i],['oversized',/\boversized\b/i]],
  sleeves: [['sleeveless',/\b(?:sleeveless|no\s+sleeves?|tank\s+top)\b/i],['short',/\b(?:short[ -]?sleeves?|short[ -]?sleeved|cap\s+sleeves?)\b/i],['long',/\b(?:long[ -]?sleeves?|long[ -]?sleeved|full[ -]length\s+sleeves?)\b/i],['raglan',/\braglan\b/i],['drop_shoulder',/\bdrop[ -]shoulder\b/i]],
  neckline: [['crew',/\b(?:crew[ -]?neck|round[ -]?neck)\b/i],['v_neck',/\bv[ -]?neck\b/i],['high_neck',/\b(?:turtleneck|mock[ -]?neck|high[ -]?neck)\b/i],['boat',/\bboat[ -]?neck\b/i],['collared',/\b(?:collared|lapel|shirt\s+collar)\b/i],['hood',/\b(?:hoodie|hooded|drawstring\s+hood)\b/i]],
};
const FEATURE = [['kangaroo_pocket',/\bkangaroo\s+pocket\b/i],['pockets',/\bpockets?\b/i],['zipper',/\b(?:zippers?|zipped|zip[ -]?up|zip[ -]?front)\b/i],['buttons',/\bbuttons?\b/i],['drawstring',/\bdrawstrings?\b/i],['ribbed_cuffs',/\bribb?ed\s+cuffs?\b/i],['ribbed_hem',/\bribb?ed\s+(?:waistband|hem)\b/i],['darts',/\bdarts?\b/i],['pleats',/\bpleats?\b/i],['lining',/\b(?:lined|lining)\b/i],['padding',/\b(?:padded|padding|trapunto|quilted)\b/i],['princess_seams',/\bprincess\s+seams?\b/i],['set_in_sleeves',/\bset[ -]?in\s+sleeves?\b/i],['side_seams',/\bside\s+seams?\b/i],['flat_felled_seams',/\bflat[ -]?felled\s+seams?\b/i],['seam_allowance',/\bseam\s+allowance\b/i]];
const MEASURE = [
  ['chest',/\b(?:chest|bust)\s*(?:circumference|measurement|width|around)?\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['waist',/\bwaist\s*(?:circumference|measurement|width|around)?\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['hip',/\bhips?\s*(?:circumference|measurement|width|around)?\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['garmentLength',/\b(?:body|garment|shirt|hoodie|jacket|dress|total)\s+length\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['sleeveLength',/\bsleeve\s+length\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['inseam',/\binseam\s*(?:length)?\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['shoulderWidth',/\bshoulder\s+width\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
  ['seamAllowance',/\bseam\s+allowance\s*(?:is|of|:|=|measures?)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(cm|centimeters?|mm|millimeters?|inches?|inch|in\b|\")/gi],
];
const cm=(number,unit)=>Math.round(number*(unit.startsWith('mm')?0.1:/^(?:in|inch|\")/.test(unit)?2.54:1)*100)/100;
const sortedMatches=(input,entries)=>entries.filter(([,pattern])=>pattern.test(input)).map(([name])=>name);
const unique=values=>[...new Set(values)];

/** Returns a bounded JSON intent; never creates geometry, promises fit, or mutates a project. */
export function planExoTextPattern20261102(prompt) {
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||/[\u0000-\u001f]/.test(prompt.replace(/\n/g,' ')))
    return {ok:false,status:'invalid_input',reason:'Enter a garment description of 1–4000 printable characters.'};
  const input=prompt.trim();
  const families=sortedMatches(input,FAMILY);
  const warnings=[];
  const unsupported=[];
  if(!families.length)unsupported.push('No recognized garment family; specify hoodie, shirt, pants, dress, jacket, skirt or jumpsuit.');
  if(families.length>1)unsupported.push(`Multiple garment families mentioned (${families.join(', ')}); describe one garment at a time.`);
  const categories={};
  for(const [key,entries] of Object.entries(TERMS)){
    const matches=sortedMatches(input,entries);
    categories[key]=matches.length===1?matches[0]:null;
    if(matches.length>1){categories[key]=null;warnings.push(`Conflicting or compound ${key} terms: ${matches.join(', ')}. Manual interpretation required.`)}
  }
  if(families[0]==='hoodie' && categories.neckline===null && !warnings.some(s=>s.includes('neckline'))) categories.neckline='hood';
  const measurementsCm={};
  for(const [label,regex] of MEASURE){
    regex.lastIndex=0;const amounts=[];let match;
    while((match=regex.exec(input))!==null && amounts.length<10){const amount=cm(Number(match[1]),match[2].toLowerCase());amounts.push(amount)}
    if(amounts.length){
      if(amounts.some(x=>!Number.isFinite(x)||x<=0||x>350)){unsupported.push(`Out-of-range ${label} measurement.`);continue}
      if(unique(amounts).length>1){unsupported.push(`Conflicting ${label} measurements.`);continue}
      measurementsCm[label]=amounts[0];
    }
  }
  const features=sortedMatches(input,FEATURE);
  const seamConstraints={seamAllowanceCm:measurementsCm.seamAllowance??null,requestedSeamTypes:features.filter(f=>f.endsWith('_seams')||f==='princess_seams'||f==='set_in_sleeves'),requiresSeamVerification:true};
  const unsupportedConstruction=features.filter(f=>['padding','lining','princess_seams','flat_felled_seams'].includes(f));
  if(unsupportedConstruction.length)warnings.push(`Special construction needs a compatible authored topology: ${unsupportedConstruction.join(', ')}.`);
  if(/\b(?:generate|make|design|draft|pattern|sew|create|cut|build|tailor)\b/i.test(input)===false && families.length===0)unsupported.push('Description does not identify a garment drafting request.');
  const family=families.length===1?families[0]:null;
  const ok=Boolean(family)&&unsupported.length===0;
  if(ok)warnings.push('No body measurements, ease, seam graph or source compatibility is inferred from style words alone.');
  return {
    ok,status:ok?'intent_parsed_review_required':'unsupported_or_ambiguous',
    intent:{family,archiveFamilyHint:family,silhouette:categories.silhouette,fit:categories.fit,sleeves:categories.sleeves,neckline:categories.neckline,measurementsCm,features,seamConstraints},
    archiveSearch:{query:'',limit:12,requiresSemanticFamilyVerification:true,description:'Archive query indexes opaque body and element identifiers, not garment names; inspect candidates before selection.'},
    uncertainties:unique(warnings),unsupported:unique(unsupported),
    generation:{ready:false,requiresVerifiedSource:true,requiresCompatibleSeamTopology:true,requiresDigitalSeamQa:true,requiresHumanReview:true,physicalFitVerified:false,factoryApproved:false},
  };
}

export default planExoTextPattern20261102;

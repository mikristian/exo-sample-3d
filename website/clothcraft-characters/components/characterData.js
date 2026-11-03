// Shared, serializable data for the independent matte-alien character playground.
export const CLOTHCRAFT_CHARACTERS=[
  {id:'stitch',name:'Stitch',role:'The sewing specialist',description:'The original alien, with a perfectly balanced silhouette.',specialty:'Seams & construction'},
  {id:'patch',name:'Patch',role:'The material explorer',description:'A wider cranium and beautifully sculpted cheeks.',specialty:'Fabrics & textures'},
  {id:'bobbin',name:'Bobbin',role:'The precision maker',description:'A confident, broad-headed alien.',specialty:'Patterns & measurements'},
  {id:'forma',name:'Forma',role:'The fit companion',description:'A tall, elegant alien with a narrow chin.',specialty:'Fit & silhouettes'},
]

export const CLOTHCRAFT_CHARACTER_COLORS=[
  {id:'blue',label:'Lunar silver',base:'#cbd8d5',shadow:'#8da6a2',light:'#ecf5f2',glow:'rgba(203,216,213,.08)'},
  {id:'lilac',label:'Astral lilac',base:'#c6bfda',shadow:'#79718d',light:'#efebf8',glow:'rgba(198,191,218,.08)'},
  {id:'coral',label:'Dust coral',base:'#e2bdb8',shadow:'#a9837d',light:'#fff1ef',glow:'rgba(226,189,184,.08)'},
  {id:'mint',label:'Celestial sage',base:'#acd0bf',shadow:'#668e7a',light:'#eef8f1',glow:'rgba(172,208,191,.08)'},
  {id:'gold',label:'Orbit sand',base:'#dfcda9',shadow:'#988263',light:'#f8efdd',glow:'rgba(223,205,169,.08)'},
  {id:'graphite',label:'Moonstone',base:'#95a3b2',shadow:'#536274',light:'#e7ecf2',glow:'rgba(149,163,178,.08)'},
]

export const DEFAULT_CLOTHCRAFT_CHARACTER=Object.freeze({
  character:'stitch',color:'blue',eyes:'bright',eyeSize:'expressive',
  eyeColor:'lime',nickname:'',motion:true,
})

export function normalizeClothCraftCharacter(value){
  const candidate=value&&typeof value==='object'?value:{}
  const pick=(key,values,fallback)=>values.includes(candidate[key])?candidate[key]:fallback
  return {
    character:pick('character',CLOTHCRAFT_CHARACTERS.map(item=>item.id),DEFAULT_CLOTHCRAFT_CHARACTER.character),
    color:pick('color',CLOTHCRAFT_CHARACTER_COLORS.map(item=>item.id),DEFAULT_CLOTHCRAFT_CHARACTER.color),
    eyes:pick('eyes',['bright','sleepy','focused'],DEFAULT_CLOTHCRAFT_CHARACTER.eyes),
    eyeSize:pick('eyeSize',['expressive','balanced','minimal'],DEFAULT_CLOTHCRAFT_CHARACTER.eyeSize),
    eyeColor:pick('eyeColor',['lime','ice','orchid','amber'],DEFAULT_CLOTHCRAFT_CHARACTER.eyeColor),
    nickname:typeof candidate.nickname==='string'?candidate.nickname.slice(0,18).replace(/[<>]/g,''):'',
    motion:candidate.motion!==false,
  }
}

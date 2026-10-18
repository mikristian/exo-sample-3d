// A deliberate, opt-in sewing balance preset for the EXO tee fixture.
// CLO has separate physical notch objects and directional sewing arrows.
// Only front/back armholes receive pattern-cut alignment notches here.
export function teeBalanceNotchCommands(template) {
  if(!Array.isArray(template?.panels))return []
  const commands=[]
  for(const panel of template.panels){
    const name=String(panel.id).toLowerCase()
    if(name!=='front'&&name!=='back')continue
    const polygon=panel.polygon
    if(!Array.isArray(polygon?.edges))continue
    for(const edge of polygon.edges){
      // The integrated-sleeve tee fixture calls these sleeve-under edges,
      // while separate-sleeve bodices use armhole. Restrict this preset to
      // exactly these attachment curves on explicitly named front/back.
      if(!/^(?:armhole[-_]|sleeve-under[-_]|underarm[-_])/i.test(edge)||polygon.notches?.[edge]?.length)continue
      const fractions=name==='back'?[.5125,.5475]:[.53]
      for(const t of fractions){
        commands.push({kind:'Notch',panel:panel.id,edge,t,depth_m:.006})
      }
    }
  }
  return commands
}

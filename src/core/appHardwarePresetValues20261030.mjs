// Pure conversion from hardware catalog presets to editable project values.
export const buttonValuesFromPreset = (preset,style=null) => ({
  name:preset?.name||'Custom Button',hardwarePresetId:preset?.id||'four-hole-shirt-button',
  diameterCm:(style?.widthMm??preset?.dimensionsMm.diameter??preset?.dimensionsMm.capDiameter??18)/10,
  widthMm:style?.widthMm??preset?.dimensionsMm.width??preset?.dimensionsMm.diameter??preset?.dimensionsMm.capDiameter??18,
  heightMm:style?.heightMm??preset?.dimensionsMm.height??preset?.dimensionsMm.diameter??preset?.dimensionsMm.capDiameter??18,
  thicknessMm:style?.thicknessMm??preset?.dimensionsMm.thickness??preset?.dimensionsMm.frontThickness??preset?.dimensionsMm.capHeight??2,
  weightGrams:preset?.dimensionsMm.weightGrams??1,
  holes:preset?.holes??0,holeDiameterMm:preset?.dimensionsMm.holeDiameter??1.4,
  holeSpacingMm:preset?.dimensionsMm.holeSpacing??4,
  color:style?.color??preset?.pbr.baseColor??'#222222',roughness:style?.roughness??preset?.pbr.roughness??.5,
  metalness:style?.metalness??preset?.pbr.metalness??0,reflectionIntensity:style?.reflectionIntensity??1,clearcoat:style?.clearcoat??.12,
  materialType:style?.materialType??preset?.material??'Custom',
  angleDeg:0,threadLengthMm:2,threadType:'Cross',threadColor:'#e5e5e5',
})
export const zipperValuesFromPreset = preset => {
  const d=preset?.dimensionsMm||{}
  const isInvisible=preset?.zipperType==='invisible-coil'
  const isMetal=preset?.zipperType==='metal'
  return {
    name:preset?.name||'Zipper',hardwarePresetId:preset?.id||'coil-zipper-5',
    widthCm:(d.tapeWidthEachSide??14)/10,tapeWidthMm:d.tapeWidthEachSide??14,
    chainWidthMm:d.nominalChainWidth??5,tapeThicknessMm:0.55,
    toothPitchMm:isMetal?2.8:2.2,
    toothThicknessMm:isMetal?1.5:0.8,
    sliderWidthMm:d.sliderWidth??Math.max(5,(d.nominalChainWidth??5)*1.38),
    sliderLengthMm:d.sliderLength??Math.max(6,(d.nominalChainWidth??5)*1.85),
    sliderThicknessMm:1.8,
    pullerWidthMm:d.pullWidth??Math.max(4,(d.nominalChainWidth??5)*.84),
    pullerLengthMm:d.pullLength??Math.max(6,(d.nominalChainWidth??5)*2.7),
    pullerThicknessMm:0.8,stopperThicknessMm:1.65,
    weightGrams:d.weightGrams??undefined,
    type:preset?.zipperType||'coil',separating:Boolean(preset?.separating),
    offsetCm:0,startExtensionMm:0,endExtensionMm:0,
    twoWay:Boolean(preset?.twoWay),sliderFraction:1,bottomSliderFraction:0,fastened:true,openFrom:'end',
    tapeColor:isInvisible?'#d8d1c6':'#282c32',
    teethColor:isInvisible?'#d4cec5':isMetal?'#c29a58':(preset?.pbr.baseColor||'#899096'),
    sliderColor:isMetal?'#b99351':'#a4a9ae',pullerColor:isMetal?'#c4a164':'#b8bdc2',
    stopperColor:isMetal?'#b08b4c':'#7a8188',
    tapeMaterialType:'polyester',
    teethMaterialType:isMetal?'metal':'nylon',sliderMaterialType:'metal',
    metalness:preset?.pbr.metalness??0.65,roughness:preset?.pbr.roughness??0.38,
    tapeRoughness:.89,teethRoughness:isMetal?.28:.56,
    sliderRoughness:.27,pullerRoughness:.3,stopperRoughness:.33,
    reflectionIntensity:1,clearcoat:.12,tapeSheen:.55,
    color:preset?.pbr.baseColor||'#777777',
  }
}

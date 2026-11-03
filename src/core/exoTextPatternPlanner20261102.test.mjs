import test from 'node:test';
import assert from 'node:assert/strict';
import {planExoTextPattern20261102 as plan} from './exoTextPatternPlanner20261102.js';

test('parses an explicit padded hoodie with dimensions, seam constraints and conservative generation gate',()=>{
  const p=plan('Create an oversized cropped hoodie with long sleeves, kangaroo pocket, trapunto padding, chest 112 cm, body length 58 cm and seam allowance 10 mm');
  assert.equal(p.ok,true);
  assert.equal(p.intent.family,'hoodie');
  assert.equal(p.intent.silhouette,null); // cropped + oversized are two distinct silhouette instructions
  assert.equal(p.intent.fit,'oversized');
  assert.equal(p.intent.neckline,'hood');
  assert.equal(p.intent.sleeves,'long');
  assert.deepEqual(p.intent.measurementsCm,{chest:112,garmentLength:58,seamAllowance:1});
  assert.ok(p.intent.features.includes('padding'));
  assert.equal(p.intent.seamConstraints.seamAllowanceCm,1);
  assert.equal(p.generation.ready,false);
  assert.equal(p.generation.physicalFitVerified,false);
});

test('shirt, pants, dress, jacket, skirt and jumpsuit families are differentiated',()=>{
  const cases=[
    ['Slim fit v-neck T-shirt with short sleeves','shirt','slim','v_neck'],
    ['Draft relaxed straight leg trousers with waist 32 inches and inseam 78 cm','pants','relaxed',null],
    ['Make an a-line sleeveless midi dress with princess seams','dress',null,null],
    ['Design a tailored collared jacket with zipper','jacket',null,'collared'],
    ['Draft a pleated skirt','skirt',null,null],
    ['Create a loose sleeveless jumpsuit','jumpsuit','relaxed',null],
  ];
  for(const [input,family,fit,neckline] of cases){const p=plan(input);assert.equal(p.ok,true,input);assert.equal(p.intent.family,family,input);assert.equal(p.intent.fit,fit,input);assert.equal(p.intent.neckline,neckline,input)}
  assert.equal(plan(cases[1][0]).intent.measurementsCm.waist,81.28);
  assert.equal(plan(cases[1][0]).intent.measurementsCm.inseam,78);
});

test('contradictory families and measurements are refused rather than guessed',()=>{
  const p=plan('Make a dress and pants with waist 70 cm and waist 85 cm');
  assert.equal(p.ok,false);
  assert.equal(p.intent.family,null);
  assert.equal(p.intent.measurementsCm.waist,undefined);
  assert.ok(p.unsupported.some(s=>s.includes('Multiple garment')));
  assert.ok(p.unsupported.some(s=>s.includes('Conflicting waist')));
});

test('irrelevant and invalid inputs do not create an actionable drafting intent',()=>{
  for(const input of ['Book me a flight to Rome','write a python sorting algorithm','', 'x'.repeat(4001),'\0hoodie']){
    const result=plan(input);assert.equal(result.ok,false,input.slice(0,20));
    if(result.generation)assert.equal(result.generation.ready,false);
  }
});

test('a vague garment has explicit unresolved shape and no fabricated archive family filter',()=>{
  const result=plan('A black jacket for winter');
  assert.equal(result.ok,true);
  assert.equal(result.intent.fit,null);
  assert.deepEqual(result.intent.measurementsCm,{});
  assert.equal(result.archiveSearch.query,'');
  assert.equal(result.archiveSearch.requiresSemanticFamilyVerification,true);
  assert.equal(result.generation.requiresVerifiedSource,true);
});

test('does not accept impossible dimensions or claim requested topology is supported',()=>{
  const p=plan('Create a jacket with chest 999 cm and flat felled seams');
  assert.equal(p.ok,false);
  assert.equal(p.intent.measurementsCm.chest,undefined);
  assert.ok(p.unsupported.some(s=>s.includes('Out-of-range chest')));
  assert.equal(p.generation.ready,false);
  const s=plan('Draft a dress with princess seams');
  assert.equal(s.ok,true);
  assert.ok(s.uncertainties.some(x=>x.includes('compatible authored topology')));
  assert.ok(s.intent.seamConstraints.requestedSeamTypes.includes('princess_seams'));
});

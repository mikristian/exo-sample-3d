import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveClothCraftWebsite} from './clothcraftCommunityUrl.js';
import {normalizeCloSettings} from './cloSettingsDefaults.js';

test('Closet website links are constructed from a single trusted user-selected origin',()=>{
  assert.deepEqual(resolveClothCraftWebsite('https://example.org/random?x=1'),{
    root:'https://example.org/',
    marketplace:'https://example.org/marketplace/',
    community:'https://example.org/marketplace/#explore',
    download:'https://example.org/download/',
  });
  assert.equal(resolveClothCraftWebsite('http://127.0.0.1:8100/')?.marketplace,'http://127.0.0.1:8100/marketplace/');
  assert.equal(resolveClothCraftWebsite('http://localhost:8100/')?.root,'http://localhost:8100/');
});

test('Closet website links reject unsafe URL schemes and embedded credentials',()=>{
  for(const input of ['', 'javascript:alert(1)','file:///tmp/file','http://example.org/','https://admin:pass@example.org','not-a-url', 'https://']){
    assert.equal(resolveClothCraftWebsite(input),null,input);
  }
});

test('Closet website address persists only through normalized Settings',()=>{
  const settings=normalizeCloSettings({communityWebsiteUrl:'https://example.org/',antiAliasing:'x8'});
  assert.equal(settings.communityWebsiteUrl,'https://example.org/');
  assert.equal(settings.antiAliasing,'x8');
  assert.equal(normalizeCloSettings({}).communityWebsiteUrl,'');
});

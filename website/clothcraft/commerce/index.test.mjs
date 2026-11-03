import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCommerce,loadCommerceConfig,verifyStripeSignature} from './index.mjs';

const config = loadCommerceConfig({STRIPE_SECRET_KEY:'sk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_test',CLOTHCRAFT_PUBLIC_ORIGIN:'https://clothcraft.example',CLOTHCRAFT_PACK_500_PRICE_ID:'price_pack1',CLOTHCRAFT_PACK_500_CREDITS:'500',CLOTHCRAFT_CREATOR_PRICE_ID:'price_creator1',CLOTHCRAFT_CREATOR_CREDITS:'800'});
const req = (body, method='POST', headers={}) => Object.assign(Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]),{method,headers});
const res = () => ({writeHead(code){this.code=code},end(body){this.body=JSON.parse(body)}});
const signature = (payload,stamp=Math.floor(Date.now()/1000)) => `t=${stamp},v1=${crypto.createHmac('sha256','whsec_test').update(`${stamp}.${payload}`).digest('hex')}`;

test('rejects tampered and stale signatures',()=>{
  const payload=Buffer.from('{"id":"evt_one"}');
  assert.equal(verifyStripeSignature(payload,signature(payload.toString()),'whsec_test'),true);
  assert.equal(verifyStripeSignature(Buffer.from('{}'),signature(payload.toString()),'whsec_test'),false);
  assert.equal(verifyStripeSignature(payload,signature(payload.toString(),Math.floor(Date.now()/1000)-600),'whsec_test'),false);
});

test('rejects untrusted identity, arbitrary price and arbitrary credit amounts',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,params:new URLSearchParams(init.body)});return {ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/test'})}};
  const noAuth=createCommerce({config:{...config,ledgerPath:'/tmp/unused'},resolveIdentity:async()=>null,ledger:{},fetchImpl});
  let response=res(); await noAuth.checkout(req({sku:'pack_500',account:'victim'}),response); assert.equal(response.code,503);
  const app=createCommerce({config,resolveIdentity:async()=> 'user_1',ledger:{},fetchImpl});
  response=res();await app.checkout(req({sku:'pack_500',credits:100000}),response);assert.equal(response.code,400);
  response=res();await app.checkout(req({sku:'price_pack1'}),response);assert.equal(response.code,400);
  response=res();await app.checkout(req({sku:'pack_500'}),response);assert.equal(response.code,200);
  assert.equal(calls.length,1);
  assert.equal(calls[0].params.get('client_reference_id'),'user_1');
  assert.equal(calls[0].params.get('line_items[0][price]'),'price_pack1');
});

test('webhook grants paid packs once, invoices once, ignores unpaid and unauthenticated events',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'clothcraft-commerce-'));
  try {
    const app=createCommerce({config:{...config,ledgerPath:path.join(dir,'ledger.jsonl')},resolveIdentity:async()=> 'user_1'});
    const deliver=async(event,bad=false)=>{const payload=JSON.stringify(event);const response=res();await app.webhook(req(payload,'POST',{'stripe-signature':bad?'t=1,v1='+('0'.repeat(64)):signature(payload)}),response);return response.code};
    const pack={id:'evt_pack',type:'checkout.session.completed',data:{object:{mode:'payment',payment_status:'paid',metadata:{account:'user_1',sku:'pack_500',price:'price_pack1'},client_reference_id:'user_1',payment_intent:'pi_one',amount_total:100}}};
    assert.equal(await deliver(pack,true),400);
    assert.equal(await deliver(pack),200);
    assert.equal(await deliver({...pack,id:'evt_retry'}),200);
    let response=res();await app.balance(req('', 'GET'),response);assert.equal(response.body.credits,500);
    const link={id:'evt_link',type:'checkout.session.completed',data:{object:{mode:'subscription',payment_status:'paid',subscription:'sub_one',metadata:{account:'user_1',sku:'creator',price:'price_creator1'},client_reference_id:'user_1'}}};
    const invoice={id:'evt_invoice',type:'invoice.paid',data:{object:{id:'in_001',subscription:'sub_one',status:'paid',amount_paid:1200,lines:{data:[{price:{id:'price_creator1'},subscription:'sub_one'}]}}}};
    assert.equal(await deliver(invoice),503);
    assert.equal(await deliver(link),200);
    assert.equal(await deliver(invoice),200);
    assert.equal(await deliver({...invoice,id:'evt_invoice_retry'}),200);
    const modernInvoice={id:'evt_modern_invoice',type:'invoice.paid',data:{object:{id:'in_002',parent:{subscription_details:{subscription:'sub_one'}},status:'paid',amount_paid:1200,lines:{data:[{pricing:{price_details:{price:'price_creator1'}}}]}}}};
    assert.equal(await deliver(modernInvoice),200);
    response=res();await app.balance(req('', 'GET'),response);assert.equal(response.body.credits,2100);
    assert.equal(await deliver({...pack,id:'evt_unpaid',data:{object:{...pack.data.object,payment_status:'unpaid',payment_intent:'pi_two'}}}),200);
    response=res();await app.balance(req('', 'GET'),response);assert.equal(response.body.credits,2100);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});

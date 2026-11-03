import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const json = (res, code, body) => { res.writeHead(code, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}); res.end(JSON.stringify(body)); };
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

export function loadCommerceConfig(env = process.env) {
  const products = {};
  // Fixed server-owned grants; environment only sets Stripe Price IDs and credit quantities.
  for (const [key, prefix, kind] of [['creator','CREATOR','subscription'],['studio','STUDIO','subscription'],['pack_500','PACK_500','pack'],['pack_2000','PACK_2000','pack'],['pack_5000','PACK_5000','pack']]) {
    const price = env[`CLOTHCRAFT_${prefix}_PRICE_ID`];
    const credits = Number(env[`CLOTHCRAFT_${prefix}_CREDITS`]);
    if (price && /^price_[a-zA-Z0-9]+$/.test(price) && Number.isSafeInteger(credits) && credits > 0 && credits <= 1000000) products[key] = {price,credits,kind};
  }
  if (new Set(Object.values(products).map(p=>p.price)).size !== Object.keys(products).length) throw new Error('Duplicate configured Stripe prices');
  const origin = env.CLOTHCRAFT_PUBLIC_ORIGIN;
  if (origin && (!/^https:\/\//.test(origin) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin))) throw new Error('CLOTHCRAFT_PUBLIC_ORIGIN must be HTTPS or loopback');
  return {products,origin,secret:env.STRIPE_SECRET_KEY, webhookSecret:env.STRIPE_WEBHOOK_SECRET, ledgerPath:env.CLOTHCRAFT_LEDGER_PATH};
}

export function verifyStripeSignature(raw, signatureHeader, secret, now = Date.now()) {
  if (!Buffer.isBuffer(raw) || typeof signatureHeader !== 'string' || !secret) return false;
  const timestamp = /(?:^|,)\s*t=(\d+)(?:,|$)/.exec(signatureHeader)?.[1];
  const signatures = [...signatureHeader.matchAll(/(?:^|,)\s*v1=([0-9a-f]{64})(?=,|$)/g)].map(m=>m[1]);
  if (!timestamp || signatures.length === 0 || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  return signatures.some(sig => crypto.timingSafeEqual(mac, Buffer.from(sig,'hex')));
}

export async function readRawBody(req, limit = 1024 * 1024) {
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > limit) { const err = new Error('Request too large'); err.status = 413; throw err; } chunks.push(chunk); }
  return Buffer.concat(chunks);
}

// Append-only JSONL ledger. A webhook id and grant share one durable entry.
// One Node process owns the ledger; multi-instance production requires a transactional database.
export function createLedger(file) {
  if (!file || !path.isAbsolute(file)) throw new Error('Absolute CLOTHCRAFT_LEDGER_PATH required');
  let chain = Promise.resolve();
  const locked = fn => { const next = chain.then(fn); chain = next.catch(()=>{}); return next; };
  const read = async () => {
    let data; try { data = await fs.readFile(file,'utf8'); } catch(e) { if (e.code==='ENOENT') return []; throw e; }
    return data.split('\n').filter(Boolean).map(line=>JSON.parse(line));
  };
  return {
    balance: account => locked(async () => (await read()).filter(entry=>entry.account===account).reduce((sum,entry)=>sum+entry.credits,0)),
    subscription: id => locked(async () => (await read()).find(entry=>entry.subscription===id && entry.type==='subscription_link')),
    grant: entry => locked(async () => {
      const records = await read();
      if (records.some(record=>record.key===entry.key)) return false;
      await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
      const handle=await fs.open(file,'a',0o600);
      try { await handle.writeFile(JSON.stringify(entry)+'\n'); await handle.sync(); } finally { await handle.close(); }
      return true;
    })
  };
}

export function createCommerce({config = loadCommerceConfig(), resolveIdentity, ledger = config.ledgerPath ? createLedger(config.ledgerPath) : null, fetchImpl = fetch} = {}) {
  const auth = async req => { const id = await resolveIdentity?.(req); return validId(id) ? id : null; };
  const stripe = async (endpoint, params) => {
    const response = await fetchImpl(`https://api.stripe.com/v1/${endpoint}`,{method:'POST',headers:{authorization:`Bearer ${config.secret}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
    const result = await response.json();
    if (!response.ok) throw new Error(`Stripe API rejected request (${response.status}): ${result.error?.type || 'unknown'}`);
    return result;
  };
  const ready = () => !!(config.secret && config.webhookSecret && config.origin && ledger);
  const checkout = async (req,res) => {
    if (req.method!=='POST') return json(res,405,{error:'Method not allowed'});
    if (!ready()) return json(res,503,{error:'Commerce unavailable: configure server secrets, origin and ledger'});
    const account = await auth(req);
    if (!account) return json(res,503,{error:'Trusted login identity is not configured'});
    try {
      const body = JSON.parse((await readRawBody(req,16384)).toString('utf8'));
      if (!body || Object.keys(body).some(key=>key!=='sku') || typeof body.sku!=='string') return json(res,400,{error:'Only configured SKU is accepted'});
      const item = config.products[body.sku];
      if (!item) return json(res,400,{error:'Unknown or unavailable SKU'});
      const base = {mode:item.kind==='pack'?'payment':'subscription','line_items[0][price]':item.price,'line_items[0][quantity]':'1',success_url:`${config.origin}/?checkout=success`,cancel_url:`${config.origin}/?checkout=cancel`,client_reference_id:account,'metadata[account]':account,'metadata[sku]':body.sku,'metadata[price]':item.price};
      if (item.kind==='subscription') { base['subscription_data[metadata][account]']=account; base['subscription_data[metadata][sku]']=body.sku; }
      const session=await stripe('checkout/sessions',base);
      if (typeof session.url!=='string' || !session.url.startsWith('https://checkout.stripe.com/')) throw new Error('Unexpected Stripe checkout URL');
      return json(res,200,{url:session.url});
    } catch(error) { return json(res,error.status|| (error instanceof SyntaxError?400:502),{error:error.status?'Request too large':error instanceof SyntaxError?'Invalid JSON':'Checkout unavailable'}); }
  };
  const webhook = async (req,res) => {
    if (req.method!=='POST') return json(res,405,{error:'Method not allowed'});
    if (!ready()) return json(res,503,{error:'Commerce unavailable'});
    let raw; try { raw=await readRawBody(req); } catch(error) { return json(res,error.status||400,{error:'Invalid request'}); }
    if (!verifyStripeSignature(raw,req.headers['stripe-signature'],config.webhookSecret)) return json(res,400,{error:'Invalid signature'});
    let event; try { event=JSON.parse(raw.toString('utf8')); } catch { return json(res,400,{error:'Invalid event'}); }
    if (!validId(event.id) || !event.data?.object) return json(res,400,{error:'Invalid event'});
    const object=event.data.object;
    try {
      if (event.type==='checkout.session.completed' && object.mode==='payment' && object.payment_status==='paid') {
        const account=object.metadata?.account; const sku=object.metadata?.sku; const item=config.products[sku];
        if (validId(account) && item?.kind==='pack' && object.metadata?.price===item.price && object.client_reference_id===account && object.amount_total>0 && object.payment_intent) {
          await ledger.grant({type:'pack',key:`payment:${object.payment_intent}`,account,credits:item.credits,event:event.id,created:Date.now()});
        }
      } else if (event.type==='checkout.session.completed' && object.mode==='subscription' && object.subscription && object.payment_status==='paid') {
        const account=object.metadata?.account; const sku=object.metadata?.sku; const item=config.products[sku];
        if (validId(account) && item?.kind==='subscription' && object.metadata?.price===item.price && object.client_reference_id===account) {
          await ledger.grant({type:'subscription_link',key:`subscription:${object.subscription}`,subscription:object.subscription,sku,account,credits:0,event:event.id,created:Date.now()});
        }
      } else if (event.type==='invoice.paid' && object.status==='paid' && object.amount_paid>0) {
        const subscription=object.subscription || object.parent?.subscription_details?.subscription;
        if (!subscription) return json(res,200,{received:true});
        const link=await ledger.subscription(subscription);
        if (!link) return json(res,503,{error:'Subscription checkout confirmation pending; retry webhook'});
        const item=config.products[link.sku];
        const lines=object.lines?.data || [];
        if (item?.kind==='subscription' && lines.some(line=>(line.price?.id || line.pricing?.price_details?.price)===item.price && (!line.subscription || line.subscription===subscription))) {
          await ledger.grant({type:'monthly',key:`invoice:${object.id}`,account:link.account,credits:item.credits,event:event.id,created:Date.now()});
        }
      }
      return json(res,200,{received:true});
    } catch { return json(res,503,{error:'Ledger processing failed; retry webhook'}); }
  };
  const balance = async (req,res) => {
    if (req.method!=='GET') return json(res,405,{error:'Method not allowed'});
    if (!ledger) return json(res,503,{error:'Ledger not configured'});
    const account=await auth(req);
    if (!account) return json(res,503,{error:'Trusted login identity is not configured'});
    try { return json(res,200,{credits:await ledger.balance(account)}); } catch { return json(res,503,{error:'Ledger unavailable'}); }
  };
  return {checkout,webhook,balance};
}

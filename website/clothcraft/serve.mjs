/** Range-enabled local preview. This is not a production web server. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCommerce,loadCommerceConfig} from './commerce/index.mjs';
import {privateCloEarthPreviewConfig} from '../../integrations/clothcraft/serve-private-clo-earth-research-20261102.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8100);
// Explicit private research session on the Mac only. Unlike the ordinary
// website, this MAY serve an Academic CLO derivative from outside the web
// root, solely for localhost inspection. It is NEVER enabled by default.
const privateCloPreviewEnabled=process.env.EXO_CLO_PRIVATE_LOCAL_PREVIEW==='yes'&&port===8100;
const privateCloGLB=path.resolve(root,'../../../exo-avatar-research-20261102/clo_private_outfitted_20261102/CLO_Thomas_CC0_jeans_tee_walk_private.glb');
if(privateCloPreviewEnabled)privateCloEarthPreviewConfig();
// This is a local-only development server, not a production HTTP deployment.
// A deployment owner must explicitly supply a trusted server-side session resolver.
let trustedIdentity=null;
if(process.env.CLOTHCRAFT_AUTH_MODULE){
  if(!path.isAbsolute(process.env.CLOTHCRAFT_AUTH_MODULE))throw new Error('Auth module path must be absolute');
  const mod=await import(pathToFileURL(process.env.CLOTHCRAFT_AUTH_MODULE).href);
  if(typeof mod.resolveIdentity!=='function')throw new Error('Auth module must export resolveIdentity(request)');
  trustedIdentity=mod.resolveIdentity;
}
const commerceConfig=loadCommerceConfig();
const commerce=createCommerce({config:commerceConfig,resolveIdentity:trustedIdentity});
const checkoutReady=Boolean(commerceConfig.secret&&commerceConfig.webhookSecret&&commerceConfig.origin&&commerceConfig.ledgerPath&&trustedIdentity&&Object.keys(commerceConfig.products).length>0&&process.env.CLOTHCRAFT_COMMERCE_LIVE_ENABLED==='yes');
function sendJSON(res,code,body){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))}
const mimes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webm':'video/webm','.mp4':'video/mp4','.mjs':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.dmg':'application/x-apple-diskimage','.zip':'application/zip','.avif':'image/avif'};
const server=http.createServer((request,response)=>{
  let apiPath;
  try{apiPath=new URL(request.url,'http://localhost').pathname}catch{return sendJSON(response,400,{error:'Invalid URL'})}
  // The normally used http://127.0.0.1:8100/ now opens the private Thomas
  // walk when this server was explicitly started in private inspection mode.
  // This branch is inactive on a normal/public web server or unflagged run.
  if(privateCloPreviewEnabled&&(apiPath==='/'||apiPath==='/index.html')&&
    request.headers.host==='127.0.0.1:8100'&&
    !new URL(request.url,'http://localhost').searchParams.has('avatarSource')&&
    ['GET','HEAD'].includes(request.method)){
    response.writeHead(302,{'Location':'/?avatarSource=clo-private','Cache-Control':'no-store',
      'X-Robots-Tag':'noindex, nofollow, noarchive'});
    return response.end();
  }
  if(apiPath.startsWith('/__exo_local_clo_research__/')){
    const allowed=privateCloPreviewEnabled&&request.headers.host==='127.0.0.1:8100'&&
      (!request.headers.origin||request.headers.origin==='http://127.0.0.1:8100')&&
      (!request.headers['sec-fetch-site']||['same-origin','none'].includes(request.headers['sec-fetch-site']))&&
      ['GET','HEAD'].includes(request.method);
    if(!allowed){response.writeHead(403,{'Cache-Control':'no-store'});return response.end()}
    const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
    if(apiPath==='/__exo_local_clo_research__/manifest.json'){
      const body=JSON.stringify(privateCloEarthPreviewConfig());
      response.writeHead(200,{...headers,'Content-Type':'application/json; charset=utf-8',
        'Content-Length':Buffer.byteLength(body)});
      return response.end(request.method==='HEAD'?undefined:body);
    }
    if(apiPath!=='/__exo_local_clo_research__/thomas-walk.glb'){
      response.writeHead(404);return response.end()
    }
    return fs.stat(privateCloGLB,(err,stat)=>{
      if(err||!stat.isFile()||stat.size>30*1024*1024){response.writeHead(404);return response.end()}
      response.writeHead(200,{...headers,'Content-Type':'model/gltf-binary','Content-Length':stat.size});
      if(request.method==='HEAD')return response.end();
      fs.createReadStream(privateCloGLB).on('error',()=>response.destroy()).pipe(response);
    });
  }
  if(apiPath.startsWith('/api/commerce/')){
    if(apiPath==='/api/commerce/status')return request.method==='GET'?sendJSON(response,200,{enabled:checkoutReady&&Object.keys(commerceConfig.products).length>0,offers:Object.keys(commerceConfig.products),authenticationEnabled:Boolean(trustedIdentity),info:'Credits require verified user accounts and Stripe webhook fulfillment.'}):sendJSON(response,405,{error:'Method not allowed'});
    if(apiPath==='/api/commerce/config')return request.method==='GET'?sendJSON(response,200,{checkoutEnabled:checkoutReady&&Object.keys(commerceConfig.products).length>0,authenticationEnabled:Boolean(trustedIdentity),availableSkus:Object.keys(commerceConfig.products),info:'Payments require trusted login identity, configured Stripe prices, a signed webhook, and a private ledger.'}):sendJSON(response,405,{error:'Method not allowed'});
    if(apiPath==='/api/commerce/checkout')return checkoutReady?void commerce.checkout(request,response):sendJSON(response,503,{error:'Paid checkout not enabled: verified account, billing and credit consumption service required'});
    if(apiPath==='/api/commerce/webhook')return void commerce.webhook(request,response);
    if(apiPath==='/api/commerce/balance')return void commerce.balance(request,response);
    return sendJSON(response,404,{error:'Unknown API endpoint'});
  }
  // Archived preview-only routes are intentionally unavailable from normal navigation.
  // Original HTML/JS lives under .archives and is not served publicly.
  if(apiPath==='/ai/'||apiPath==='/pricing/'||apiPath==='/ai'||apiPath==='/pricing') {
    response.writeHead(302,{'Location':'/','Cache-Control':'no-store'});
    return response.end();
  }
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end()}
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname)}catch{response.writeHead(400);return response.end()}
  // Never publish server logic, tests, preview snapshots or local credential files.
  if(/(^|\/)(\.|commerce|qa|tools)(\/|$)/i.test(pathname) || /\.(?:env|pem|key)$/i.test(pathname)) {response.writeHead(404);return response.end('Not found')}
  // Keep server-side code, archives, QA outputs and hidden files private.
  const segments=pathname.split('/').filter(Boolean);
  if(['commerce','tools','qa','.snapshots'].includes(segments[0])||segments.some(segment=>segment.startsWith('.'))||segments.includes('serve.mjs')){response.writeHead(404);return response.end('Not found')}
  const name=pathname.endsWith('/')?pathname+'index.html':pathname;
  const pathnameFull=path.resolve(root,'.'+name);
  if(!pathnameFull.startsWith(root+path.sep)){response.writeHead(403);return response.end('Forbidden')}
  fs.stat(pathnameFull,(err,stats)=>{
    if(err||!stats.isFile()){response.writeHead(404);return response.end('Not found')}
    const headers={'Content-Type':mimes[path.extname(pathnameFull)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
    if(pathname.startsWith('/downloads/') && /\.(dmg|zip)$/i.test(pathname)){
      // Proper attachment behavior on Safari/Chrome; filename sanitized to basename.
      const filename=path.basename(pathnameFull);
      if(!/^[a-zA-Z0-9._-]+$/.test(filename)){response.writeHead(400);return response.end('Invalid filename')}
      headers['Content-Disposition']=`attachment; filename=\"${filename}\"`;
    }

    let start=0,end=stats.size-1,status=200;
    const range=request.headers.range;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2])){response.writeHead(416,{'Content-Range':`bytes */${stats.size}`});return response.end()}
      if(match[1]){start=Number(match[1]);end=match[2]?Number(match[2]):end}else{start=Math.max(0,stats.size-Number(match[2]))}
      if(start>=stats.size||start>end){response.writeHead(416,{'Content-Range':`bytes */${stats.size}`});return response.end()}
      end=Math.min(end,stats.size-1);status=206;headers['Content-Range']=`bytes ${start}-${end}/${stats.size}`;
    }
    headers['Content-Length']=end-start+1;response.writeHead(status,headers);
    if(request.method==='HEAD')return response.end();
    fs.createReadStream(pathnameFull,{start,end}).on('error',()=>response.destroy()).pipe(response);
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`ClothCraft preview http://127.0.0.1:${port}/`));

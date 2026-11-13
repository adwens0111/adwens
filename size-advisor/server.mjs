import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {reviewProduct,normalizeProfile} from './core.mjs';
import {consult} from './ai.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export function createAdvisorServer({catalog,apiKey='',model='',origin='',preview=false,advisor=consult,dailyLimit=0}) {
  let day='',calls=0,inflight=0;
  const buckets=new Map();
  return http.createServer(async(req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    const url=new URL(req.url,'http://localhost');
    if(preview && req.method==='GET' && ['/','/preview.html','/client.js','/style.css'].includes(url.pathname)){
      const name=url.pathname==='/'?'preview.html':url.pathname.slice(1);
      const body=await readFile(resolve(root,name));res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(body);return;
    }
    if(req.method!=='POST'||url.pathname!=='/api/size-advice')return reply(404,{error:'not_found'});
    // Production must sit behind same-origin HTTPS reverse proxy. No wildcard CORS.
    if(!origin||req.headers.origin!==origin)return reply(403,{error:'origin'});
    if(!String(req.headers['content-type']).startsWith('application/json'))return reply(415,{error:'content_type'});
    try{
      let body='',bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){reply(413,{error:'too_large'});req.resume();return;}body+=chunk;}
      const input=JSON.parse(body);
      if(input.consent!==true)return reply(400,{error:'consent'});
      const p=catalog.items?.[String(input.productId)];
      if(!p||reviewProduct(p).length)return reply(422,{error:'product_data_pending',message:'この商品の実寸データを確認中です。サイズ表またはLINEでご確認ください。'});
      const profile=normalizeProfile(input.profile,p.category);
      if(!apiKey||!model||!Number.isInteger(dailyLimit)||dailyLimit<1)return reply(503,{error:'ai_not_configured'});
      const now=Date.now(),today=new Date().toISOString().slice(0,10);
      if(day!==today){day=today;calls=0;buckets.clear();}
      // Single-process deployment only. Do not trust spoofable X-Forwarded-For.
      const key=req.socket.remoteAddress;
      const bucket=buckets.get(key)||{start:now,count:0};
      if(now-bucket.start>60000){bucket.start=now;bucket.count=0;}
      if(bucket.count>=10||calls>=dailyLimit||inflight>=4)return reply(429,{error:'busy'});
      bucket.count++;buckets.set(key,bucket);calls++;inflight++;
      try { return reply(200,await advisor(p,profile,{apiKey,model})); }
      finally { inflight--; }
    }catch(e){return reply(400,{error:'unable_to_diagnose',message:'診断を完了できませんでした。サイズ表をご確認ください。'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const catalog=JSON.parse(await readFile(process.env.ADW_FIT_CATALOG||resolve(root,'catalog.pending.json'),'utf8'));
  const port=Number(process.env.PORT||8787);
  createAdvisorServer({catalog,apiKey:process.env.OPENAI_API_KEY,model:process.env.ADW_AI_MODEL,origin:process.env.ADW_ALLOWED_ORIGIN||`http://127.0.0.1:${port}`,preview:process.env.ADW_PREVIEW==='1',dailyLimit:Number(process.env.ADW_DAILY_LIMIT||0)}).listen(port,'127.0.0.1',()=>console.log(`Size advisor listening on loopback:${port}`));
}

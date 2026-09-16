import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 10000);
const GAS_URL = String(process.env.GAS_URL || '').trim();
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '').trim();
const GAS_ADMIN_TOKEN = String(process.env.GAS_ADMIN_TOKEN || '').trim();

app.use(express.json({ limit:'256kb' }));
app.use(express.static(path.join(__dirname,'public')));

const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
const cleanTags=v=>Array.isArray(v)?[...new Set(v.map(x=>clean(x,40)).filter(Boolean))].slice(0,20):[];
const clampInt=(v,min,max,d=min)=>{const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:d};
function requireGas(){if(!GAS_URL)throw new Error('GAS_URLがRenderに設定されていません')}
async function gasGet(action){
 requireGas(); const u=new URL(GAS_URL); u.searchParams.set('action',action);
 const r=await fetch(u); const text=await r.text(); if(!r.ok)throw new Error(`GAS ${r.status}: ${text}`);
 const data=JSON.parse(text); if(data.ok===false)throw new Error(data.error||'GAS error'); return data;
}
async function gasPost(body){
 requireGas(); const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const text=await r.text(); if(!r.ok)throw new Error(`GAS ${r.status}: ${text}`);
 const data=JSON.parse(text); if(data.ok===false)throw new Error(data.error||'GAS error'); return data;
}
function auth(req){return !!ADMIN_TOKEN&&req.get('x-admin-token')===ADMIN_TOKEN}

app.get('/api/health',async(req,res)=>{try{const data=await gasGet('health');res.json({ok:true,gas:true,database:false,ai:false,upstream:data})}catch(e){res.status(503).json({ok:false,gas:false,database:false,ai:false,error:e.message})}});
app.get('/api/problems',async(req,res)=>{try{const data=await gasGet('questions');res.json(Array.isArray(data.questions)?data.questions:[])}catch(e){res.status(503).json({error:e.message})}});
app.get('/api/categories',async(req,res)=>{try{const data=await gasGet('categories');res.json(data.categories&&typeof data.categories==='object'?data.categories:{})}catch(e){res.status(503).json({error:e.message})}});
app.get('/api/leaderboard',async(req,res)=>{try{const data=await gasGet('leaderboard');const rows=Array.isArray(data.leaderboard)?data.leaderboard:[];res.json(rows.map(x=>({name:x.name||'匿名',answered:Number(x.total??x.answered??0),correct:Number(x.correct??0),score:Number(x.score??0),updatedAt:x.date||x.updatedAt||null})))}catch(e){res.status(503).json({error:e.message})}});

app.post('/api/scores',async(req,res)=>{
 const name=clean(req.body.name,24).replace(/[<>]/g,'')||'匿名';
 const answered=clampInt(req.body.answered,0,100000,0); const correct=clampInt(req.body.correct,0,answered,0); const score=clampInt(req.body.score,0,100000000,correct*100);
 try{await gasPost({action:'submitScore',name,correct,total:answered,score});res.json({ok:true})}catch(e){res.status(503).json({error:e.message})}
});

app.post('/api/problems',async(req,res)=>{
 const problem={subject:clean(req.body.subject,40),unit:clean(req.body.unit,80),question:clean(req.body.question,1000),answer:clean(req.body.answer,500),inputType:req.body.inputType==='choice'?'choice':'input',difficulty:clampInt(req.body.difficulty,1,3,1),tags:cleanTags(req.body.tags)};
 if(!problem.subject||!problem.unit||!problem.question||!problem.answer)return res.status(400).json({error:'必須項目が不足しています'});
 try{const data=await gasPost({action:'submitProblem',...problem});res.json({ok:true,id:data.question?.id,status:'approved',categoryAdded:!!data.categoryAdded,message:'即採用'})}catch(e){res.status(503).json({error:e.message})}
});

app.post('/api/admin/categories',async(req,res)=>{if(!auth(req))return res.status(401).json({error:'unauthorized'});try{res.json(await gasPost({action:'addCategory',subject:clean(req.body.subject,40),unit:clean(req.body.unit,80),adminToken:GAS_ADMIN_TOKEN}))}catch(e){res.status(503).json({error:e.message})}});
app.post('/api/admin/categories/rename',async(req,res)=>{if(!auth(req))return res.status(401).json({error:'unauthorized'});try{res.json(await gasPost({action:'renameCategory',subject:clean(req.body.subject,40),oldUnit:clean(req.body.oldUnit,80),newUnit:clean(req.body.newUnit,80),adminToken:GAS_ADMIN_TOKEN}))}catch(e){res.status(503).json({error:e.message})}});
app.post('/api/admin/categories/delete',async(req,res)=>{if(!auth(req))return res.status(401).json({error:'unauthorized'});try{res.json(await gasPost({action:'deleteCategory',subject:clean(req.body.subject,40),unit:clean(req.body.unit,80),adminToken:GAS_ADMIN_TOKEN}))}catch(e){res.status(503).json({error:e.message})}});
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`中1 1問1答 online listening on ${PORT}`));

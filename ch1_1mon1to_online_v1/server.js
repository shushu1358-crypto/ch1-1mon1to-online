import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 10000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } }) : null;

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seed = { problems: [], scores: [] };
let mem = structuredClone(seed);

async function fileLoad(){
  try { mem = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch { await fs.mkdir(path.dirname(DATA_FILE), {recursive:true}); await fs.writeFile(DATA_FILE, JSON.stringify(mem,null,2)); }
}
async function fileSave(){ await fs.writeFile(DATA_FILE, JSON.stringify(mem,null,2)); }

async function dbInit(){
  if(!pool){ await fileLoad(); return; }
  await pool.query(`CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY, subject TEXT NOT NULL, unit TEXT NOT NULL, question TEXT NOT NULL,
    answer TEXT NOT NULL, input_type TEXT NOT NULL DEFAULT 'input', difficulty INT NOT NULL DEFAULT 1,
    author TEXT NOT NULL DEFAULT '匿名', status TEXT NOT NULL DEFAULT 'pending', review JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, answered INT NOT NULL, correct INT NOT NULL,
    score INT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

const clean = (v, max=2000) => String(v ?? '').trim().slice(0,max);
const clampInt = (v,min,max,d=min) => { const n=Number(v); return Number.isInteger(n)&&n>=min&&n<=max?n:d; };

async function listProblems(){
  if(!pool) return mem.problems.filter(x=>x.status==='approved').slice(-500);
  const r=await pool.query(`SELECT id,subject,unit,question,answer,input_type AS "inputType",difficulty,author,created_at AS "createdAt" FROM problems WHERE status='approved' ORDER BY id DESC LIMIT 500`);
  return r.rows;
}
async function listLeaderboard(){
  if(!pool) return [...mem.scores].sort((a,b)=>b.score-a.score || b.correct-a.correct).slice(0,50);
  const r=await pool.query(`SELECT name,answered,correct,score,updated_at AS "updatedAt" FROM scores ORDER BY score DESC, correct DESC, updated_at ASC LIMIT 50`);
  return r.rows;
}

async function saveScore(x){
  if(!pool){
    const i=mem.scores.findIndex(s=>s.name===x.name);
    if(i>=0) mem.scores[i]={...mem.scores[i],...x,updatedAt:new Date().toISOString()}; else mem.scores.push({...x,updatedAt:new Date().toISOString()});
    await fileSave(); return;
  }
  await pool.query(`INSERT INTO scores(name,answered,correct,score) VALUES($1,$2,$3,$4)
    ON CONFLICT DO NOTHING`,[x.name,x.answered,x.correct,x.score]);
  const r=await pool.query(`SELECT id FROM scores WHERE name=$1 ORDER BY id LIMIT 1`,[x.name]);
  if(r.rows[0]) await pool.query(`UPDATE scores SET answered=$1,correct=$2,score=$3,updated_at=now() WHERE id=$4`,[x.answered,x.correct,x.score,r.rows[0].id]);
}

function auth(req){ return req.get('x-admin-token') === ADMIN_TOKEN; }

async function aiReview(problem){
  if(!process.env.OPENAI_API_KEY){
    return { verdict:'pending', confidence:0, issues:['AIレビュー未設定'], suggestion:'管理者レビュー待ち', revisedQuestion:problem.question, revisedAnswer:problem.answer };
  }
  const prompt = `あなたは中学1年生の定期テスト対策問題の校正担当です。次の1問を厳しく審査してください。\n\n教科: ${problem.subject}\n単元: ${problem.unit}\n問題: ${problem.question}\n想定正解: ${problem.answer}\n難易度: ${problem.difficulty}\n\n確認項目:\n1. 中1の学習範囲として自然か\n2. 問題文だけで答えが一意に定まるか。『一つ答えよ』なのに複数の正解がある場合は問題文を具体化する\n3. 正解が正しいか\n4. 誤字脱字・表記ゆれ\n5. 既知の紛らわしい用語を避けているか\n6. 定期テスト対策として適切か\n\nJSONだけを返してください。形式:\n{"verdict":"approve|revise|reject","confidence":0,"issues":["..."],"revisedQuestion":"...","revisedAnswer":"...","reason":"..."}\nconfidenceは0から1。重大な曖昧さ・誤りがあればrejectまたはrevise。`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input:prompt})});
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const data=await r.json();
  const text=(data.output||[]).flatMap(o=>o.content||[]).map(c=>c.text||'').join('');
  const m=text.match(/\{[\s\S]*\}/);
  if(!m) throw new Error('AI JSON parse failed');
  return JSON.parse(m[0]);
}

app.get('/api/health',(req,res)=>res.json({ok:true,ai:!!process.env.OPENAI_API_KEY,database:!!pool}));
app.get('/api/problems',async(req,res)=>{try{res.json(await listProblems())}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/leaderboard',async(req,res)=>{try{res.json(await listLeaderboard())}catch(e){res.status(500).json({error:e.message})}});

app.post('/api/scores',async(req,res)=>{
  const name=clean(req.body.name,24).replace(/[<>]/g,'') || '匿名';
  const answered=clampInt(req.body.answered,0,100000,0), correct=clampInt(req.body.correct,0,answered,0);
  const score=clampInt(req.body.score,0,100000000,correct*100);
  try{await saveScore({name,answered,correct,score});res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/problems',async(req,res)=>{
  const problem={subject:clean(req.body.subject,40),unit:clean(req.body.unit,80),question:clean(req.body.question,1000),answer:clean(req.body.answer,500),inputType:req.body.inputType==='choice'?'choice':'input',difficulty:clampInt(req.body.difficulty,1,3,1),author:clean(req.body.author,24).replace(/[<>]/g,'')||'匿名'};
  if(!problem.subject||!problem.unit||!problem.question||!problem.answer) return res.status(400).json({error:'必須項目が不足しています'});
  let review;
  try{ review=await aiReview(problem); }catch(e){ review={verdict:'pending',confidence:0,issues:['AIレビューに失敗しました'],suggestion:e.message,revisedQuestion:problem.question,revisedAnswer:problem.answer}; }
  const autoApproved=review.verdict==='approve' && Number(review.confidence||0)>=0.9;
  const status=autoApproved?'approved':'pending';
  try{
    if(!pool){const row={id:Date.now(),...problem,status,review,createdAt:new Date().toISOString()};mem.problems.push(row);await fileSave();return res.json({ok:true,id:row.id,status,review})}
    const r=await pool.query(`INSERT INTO problems(subject,unit,question,answer,input_type,difficulty,author,status,review) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[problem.subject,problem.unit,problem.question,problem.answer,problem.inputType,problem.difficulty,problem.author,status,review]);
    res.json({ok:true,id:r.rows[0].id,status,review});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/admin/problems',async(req,res)=>{
  if(!auth(req)) return res.status(401).json({error:'unauthorized'});
  try{
    if(!pool) return res.json(mem.problems.slice().sort((a,b)=>b.id-a.id));
    const r=await pool.query(`SELECT * FROM problems ORDER BY id DESC LIMIT 1000`);res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message})}
});
app.post('/api/admin/problems/:id/status',async(req,res)=>{
  if(!auth(req)) return res.status(401).json({error:'unauthorized'});
  const status=['approved','rejected','pending'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:'bad status'});
  try{
    if(!pool){const x=mem.problems.find(p=>String(p.id)===String(req.params.id));if(!x)return res.status(404).json({error:'not found'});x.status=status;await fileSave();return res.json({ok:true})}
    await pool.query(`UPDATE problems SET status=$1 WHERE id=$2`,[status,req.params.id]);res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

await dbInit();
app.listen(PORT,()=>console.log(`中1 1問1答 online listening on ${PORT}`));

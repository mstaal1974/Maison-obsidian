import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Transpile actual server modules in an isolated temporary directory; no network,
// credentials, live payments or database mutations are used by these regressions.
const temp = await fs.mkdtemp(path.resolve('node_modules/.checkout-security-'));
async function compile(dir) {
  for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) { await compile(source); continue; }
    if (!source.endsWith('.ts')) continue;
    const target = path.join(temp, source.replace(/\.ts$/, '.js'));
    await fs.mkdir(path.dirname(target), {recursive:true});
    await fs.writeFile(target, ts.transpileModule(await fs.readFile(source,'utf8'), {
      compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022}
    }).outputText);
  }
}
try {
  await fs.writeFile(path.join(temp,'package.json'), '{"type":"module"}');
  await compile('api');
  const {priceLines} = await import(pathToFileURL(path.join(temp,'api/_lib/stripe.js')));
  const {bagLines, chunkBag, recordOrder} = await import(pathToFileURL(path.join(temp,'api/_lib/record.js')));
  const fragrance = {id:'test', name:'Test fragrance', price:4700, price10:2100, price30:3400, stock10:20, stock30:20, stock50:20};
  const catalogue = new Map([['test', fragrance]]);
  const line = (format, qty=1, label) => ({fragranceId:'test',format,qty,label,engraving:null});
  assert.equal(priceLines([line('perf50')],catalogue)[0].unitCents,4700);
  assert.equal(priceLines([line('perf10',5,'Discovery Box')],catalogue)[0].unitCents,1000);
  for(const format of ['perf30','perf50','car','wash','moist','ritual']) {
    assert.throws(()=>priceLines([line('perf10',5,'Discovery Box'),line(format,1,'Discovery Box')],catalogue), /only 10 ml/);
  }
  assert.throws(()=>priceLines([line('perf10',4,'Discovery Box')],catalogue),/sets of five/);
  for(const qty of [0,-1,1.5,21,NaN,Infinity,'5']) assert.throws(()=>priceLines([line('perf10',qty)],catalogue),/Quantity/);
  assert.throws(()=>priceLines([line('perf50',1,'untrusted discount')],catalogue),/Invalid bundle/);
  const mixed = priceLines([line('perf10',5,'Discovery Box'),line('perf50')],catalogue);
  assert.deepEqual(mixed.map(x=>x.unitCents),[1000,4700]);

  const rows=Array.from({length:20},(_,i)=>({f:'test',k:'perf50',q:1,e:`Engraving ${i}`,s:50,u:4700}));
  const metadata=chunkBag(rows);
  assert.ok(metadata.lines2);
  assert.deepEqual(await bagLines({}, {metadata}),rows);
  const session={id:'cs_test',payment_status:'paid',metadata,payment_intent:'pi_test'};
  let calls=0;
  const db={rpc:async(name,args)=>{calls++;assert.equal(name,'record_paid_order'); assert.equal(args.p_session_id,'cs_test'); assert.equal(args.p_rows.length,20); return {data:20,error:null};}};
  assert.deepEqual(await recordOrder({},db,session),{recorded:20});
  await assert.rejects(recordOrder({},db,{...session,payment_status:'unpaid'}),/not paid/);
  assert.equal(calls,1);
  await assert.rejects(recordOrder({}, {rpc:async()=>({error:{message:'database unavailable'}})}, session),/database unavailable/);
  console.log('PASS: bundle isolation, quantities, regular prices, multi-chunk baskets, paid-only recording and RPC failures.');
} finally { await fs.rm(temp,{recursive:true,force:true}); }

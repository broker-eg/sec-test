#!/usr/bin/env node
// Explicit staging smoke checks only. No deploy, Git, database or attack actions.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
async function main() {
  const args = process.argv.slice(2);
  const input = args.shift();
  const options = { requests: 12, concurrency: 3, node: null, strictDiagnostics: false };
  for (const arg of args) {
    if (arg === '--strict-diagnostics') { options.strictDiagnostics = true; continue; }
    const match = /^--(requests|concurrency|node)=(\d+)$/.exec(arg);
    if (!match) throw new Error('Unknown option: ' + arg);
    options[match[1]] = Number(match[2]);
  }
  if (!input) throw new Error('Usage: node scripts/check-availability.cjs <exact-functions-base-url> [--node=24] [--requests=12] [--concurrency=3] [--strict-diagnostics]');
  assert.ok(options.requests >= 1 && options.requests <= 24, 'requests must be 1..24');
  assert.ok(options.concurrency >= 1 && options.concurrency <= 4, 'concurrency must be 1..4');
  assert.ok(options.node === null || options.node >= 20 && options.node <= 30, 'Invalid Node major');
  const base = new URL(input);
  assert.equal(base.protocol, 'https:', 'Use the staging HTTPS Functions URL');
  assert.equal(base.username + base.password + base.search + base.hash, '', 'URL must have no credentials, query or fragment');
  const scenario = JSON.parse(fs.readFileSync(path.join(root, 'functions/_scenario.json'), 'utf8'));
  const records = [];
  const startedAt = new Date().toISOString();
  async function run(name, work, category = 'functional') {
    const started = performance.now();
    try {
      await work();
      records.push({ name, category, pass: true, milliseconds: Math.round(performance.now() - started) });
      console.log((category === 'diagnostic' ? 'DIAGNOSTIC PASS ' : 'PASS ') + name);
    } catch (error) {
      records.push({ name, category, pass: false, milliseconds: Math.round(performance.now() - started), error: error.message });
      console.error((category === 'diagnostic' ? 'DIAGNOSTIC ' : 'FAIL ') + name + ': ' + error.message);
    }
  }
  async function request(route, { query = {}, method = 'GET', headers = {}, body, status = 200, marker = true } = {}) {
    const url = new URL(base);
    url.pathname = base.pathname.replace(/\/$/, '') + (route.startsWith('/') ? route : '/' + route);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    // Consume every response so failures do not leave connections hanging.
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, status, `${method} ${route}: HTTP ${response.status}; ${bytes.toString('utf8').slice(0,160)}`);
    if (marker) {
      assert.equal(response.headers.get('x-sec-test-run-id'), scenario.runId, 'Stale or wrong deployment: response run ID');
      assert.equal(response.headers.get('x-sec-test-manager'), scenario.name, 'Wrong package-manager scenario');
    }
    return { response, bytes };
  }
  async function json(route, options = {}) {
    const result = await request(route, options);
    let value;
    try { value = JSON.parse(result.bytes.toString('utf8')); }
    catch { throw new Error(route + ': expected JSON response'); }
    assert.equal(value.ok, true, route + ': ok');
    assert.equal(value.app, 'compatibility', route + ': wrong app');
    assert.equal(value.name, scenario.name, route + ': wrong manager');
    assert.equal(value.runId, scenario.runId, route + ': stale or wrong deployment');
    return { ...result, value };
  }
  const kinds = {
    '/': 'root-index', '/formats/js-default': 'js-default', '/formats/js-esm': 'js-esm',
    '/formats/ts-commonjs': 'ts-commonjs', '/formats/ts-features': 'ts-features',
    '/api/v1': 'nested-index', '/api/v1/item': 'nested-item',
    '/express-app': 'express-app', '/express-router': 'express-router', '/ping': 'ping',
  };
  for (const [route, kind] of Object.entries(kinds)) {
    await run('format/route ' + route, async () => {
      const { value } = await json(route);
      assert.equal(value.kind, kind);
      if (kind === 'express-app') assert.equal(value.middlewareRan, true);
      if (kind === 'ts-features') {
        assert.equal(value.state, 'ready'); assert.equal(value.generic, 7); assert.equal(value.total, 10);
        assert.equal(value.message, 'bundled-json'); assert.equal(value.helper, 'bundled-cjs-helper');
      }
    });
  }
  await run('existing JS status function', async () => { await json('/installer-status', { marker:false }); });
  await run('registry dependency and crypto import', async () => {
    const { value } = await json('/dependency-check', { marker:false });
    for (const key of ['oddNumber','evenNumber','nodeBuiltin']) assert.equal(value.checks[key],true,key);
  });
  await run('existing whoami function', async () => {
    const { bytes } = await request('/whoami', { marker:false });
    assert.deepEqual(JSON.parse(bytes.toString()), {ok:true,app:'compatibility'});
  });
  await run('existing async HTTP function', async () => {
    const body = JSON.stringify({message:'availability',count:3});
    const {value,response} = await json('/http-check',{marker:false,method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.equal(value.rawBody,body);assert.deepEqual(value.body,JSON.parse(body));
    assert.equal(response.headers.get('x-sec-test'),'compatibility');
  });
  await run('nested index with trailing slash', async () => {
    const {value}=await json('/api/v1/');assert.equal(value.kind,'nested-index');
  });
  await run('runtime /tmp, compression, Unicode, Lambda context', async () => {
    const {value}=await json('/runtime-check',{query:{token:crypto.randomUUID()}});
    for (const key of ['fileRoundTrip','compressionRoundTrip','unicodeRoundTrip','invocationIdPresent']) assert.equal(value[key],true,key);
    assert.equal(value.functionPath,'/runtime-check');
    assert.ok(['arm64','x64'].includes(value.arch),'Unexpected runtime architecture: '+value.arch);
    if (options.node !== null) assert.ok(value.node.startsWith('v'+options.node+'.'),'Wrong Node version: '+value.node);
    console.log('  runtime '+value.node+' '+value.arch);
  });
  await run('GET query decoding and request headers', async () => {
    const {value}=await json('/request-check',{query:{message:'أهلاً 🌍 + &',number:'7'},headers:{'X-Sec-Test-Input':'availability-header'}});
    assert.equal(value.method,'GET');assert.equal(value.query.message,'أهلاً 🌍 + &');assert.equal(value.query.number,'7');
    assert.equal(value.requestHeader,'availability-header');
  });
  for (const method of ['POST','PUT','PATCH']) {
    await run(method+' JSON body/rawBody', async () => {
      const payload={message:'أهلاً 🌍',nested:{yes:true},list:[1,2,3],nothing:null};
      const body=JSON.stringify(payload);
      const {value}=await json('/request-check',{method,headers:{'Content-Type':'application/json'},body});
      assert.equal(value.method,method);assert.deepEqual(value.body,payload);assert.equal(value.rawBody,body);
    });
  }
  await run('POST 64 KiB JSON body', async () => {
    const payload={text:'x'.repeat(64*1024)};const body=JSON.stringify(payload);
    const {value}=await json('/request-check',{method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.deepEqual(value.body,payload);assert.equal(value.rawBody,body);
  });
  await run('POST URL-encoded form body', async () => {
    const body='message=hello+world&count=3';
    const {value}=await json('/request-check',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    assert.deepEqual(value.body,{message:'hello world',count:'3'});assert.equal(value.rawBody,body);
  });
  await run('DELETE method', async () => {const {value}=await json('/request-check',{method:'DELETE'});assert.equal(value.method,'DELETE');});
  await run('HEAD no response body', async () => {const {bytes}=await request('/request-check',{method:'HEAD'});assert.equal(bytes.length,0);});
  await run('OPTIONS and default CORS', async () => {
    const {response,bytes}=await request('/request-check',{method:'OPTIONS',status:204,headers:{Origin:'https://sec-test.example','Access-Control-Request-Method':'POST'}});
    assert.equal(bytes.length,0);assert.equal(response.headers.get('access-control-allow-origin'),'*');
    assert.ok(response.headers.get('access-control-allow-methods').includes('POST'));
    assert.ok(response.headers.get('access-control-allow-headers').toLowerCase().includes('content-type'));
  });
  for (const [kind,expected,type] of [['text','availability-text','text/plain'],['html','<p>availability-html</p>','text/html'],['chunks','chunk-a|chunk-b','text/plain']]) {
    await run('response '+kind, async () => {
      const {bytes,response}=await request('/response-check',{query:{kind}});
      assert.equal(bytes.toString(),expected);assert.ok(response.headers.get('content-type').startsWith(type));
    });
  }
  await run('raw binary bytes (requires BINARY_CONTENT_TYPES)', async () => {const {bytes}=await request('/response-check',{query:{kind:'binary'}});assert.deepEqual([...bytes],[0,1,2,127,128,254,255]);},'diagnostic');
  await run('gzip response transport', async () => {const {bytes}=await request('/response-check',{query:{kind:'gzip'}});assert.equal(bytes.toString(),'availability-compressed');});
  await run('multiple Set-Cookie headers (gateway diagnostic)', async () => {
    const {response}=await json('/response-check',{query:{kind:'cookies'}});
    const cookies=response.headers.getSetCookie();
    assert.ok(cookies.some(v=>v.startsWith('sec_test_a=one')) && cookies.some(v=>v.startsWith('sec_test_b=two')),'Gateway did not forward both Set-Cookie headers');
  },'diagnostic');
  await run('204 empty response', async () => {const {bytes}=await request('/response-check',{query:{kind:'empty'},status:204});assert.equal(bytes.length,0);});
  await run('201 JSON response', async () => {const {value}=await json('/response-check',{query:{kind:'created'},status:201});assert.equal(value.kind,'created');});
  await run('302 redirect header without following', async () => {const {response}=await request('/response-check',{query:{kind:'redirect'},status:302});assert.equal(response.headers.get('location'),'?kind=text');});
  await run('custom CORS response header', async () => {const {response}=await json('/response-check',{query:{kind:'cors'}});assert.equal(response.headers.get('access-control-allow-origin'),'https://sec-test.example');});
  await run('handled validation response 422', async () => {const {value}=await json('/error-check',{query:{mode:'handled'},status:422});assert.equal(value.error,'expected-validation-error');},'expected-error');
  for (const mode of ['throw','reject']) {
    await run('expected '+mode+' returns 500', async () => {
      const {bytes}=await request('/error-check',{query:{mode},status:500});assert.equal(bytes.toString(),'Internal Server Error');
    },'expected-error');
    await run('recovery after '+mode, async () => {const {value}=await json('/error-check');assert.equal(value.kind,'error-recovery');});
  }
  const sampleRoutes=['/ping','/formats/ts-features','/api/v1','/express-app'];
  let next=0;
  const workers=Array.from({length:Math.min(options.concurrency,options.requests)},async()=>{
    while(next<options.requests){
      const i=next++;const route=sampleRoutes[i%sampleRoutes.length];const token=crypto.randomUUID();
      await run(`availability ${i+1}/${options.requests} ${route}`,async()=>{
        const {value}=await json(route,{query:{token}});
        if(route==='/ping')assert.equal(value.token,token,'Request isolation');
      },'availability');
    }
  });
  await Promise.all(workers);
  const samples=records.filter(r=>r.category==='availability');
  const times=samples.map(r=>r.milliseconds).sort((a,b)=>a-b);
  const percentile=p=>times[Math.max(0,Math.ceil(times.length*p)-1)]??null;
  const diagnosticRecords=records.filter(r=>r.category==='diagnostic');
  const coreRecords=records.filter(r=>r.category!=='diagnostic');
  const failed=coreRecords.filter(r=>!r.pass);
  const report={startedAt,finishedAt:new Date().toISOString(),baseUrl:base.toString(),scenario,options,
    checks:coreRecords.length,passed:coreRecords.length-failed.length,failed:failed.length,
    diagnostics:diagnosticRecords,
    availability:{requests:samples.length,passed:samples.filter(r=>r.pass).length,
      successPercent:100*samples.filter(r=>r.pass).length/samples.length,p50Milliseconds:percentile(.5),p95Milliseconds:percentile(.95),
      note:'Short sample of complete request durations; this is not an uptime or load-test guarantee.'},records};
  const reportDir=path.join(root,'reports');fs.mkdirSync(reportDir,{recursive:true});
  const reportPath=path.join(reportDir,'availability-'+startedAt.replace(/[:.]/g,'-')+'.json');
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(`\n${report.passed}/${report.checks} checks passed; ${report.failed} failed.`);
  console.log(`Availability sample: ${report.availability.successPercent.toFixed(1)}%; p50 ${percentile(.5)}ms; p95 ${percentile(.95)}ms.`);
  console.log(`Diagnostics: ${diagnosticRecords.filter(r=>!r.pass).length}/${diagnosticRecords.length} reported limitations (do not affect core exit status).`);
  console.log('Report: '+reportPath);
  if(failed.length || options.strictDiagnostics && diagnosticRecords.some(r=>!r.pass))process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

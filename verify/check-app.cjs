#!/usr/bin/env node
// Verifies a deployed compatibility app. Makes HTTP requests only when run.
// Usage: node verify/check-app.cjs <exact-functions-base-url>
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'functions/_app.json'), 'utf8'));
const routes = JSON.parse(fs.readFileSync(path.join(root, 'functions/_routes.json'), 'utf8'));

const input = process.argv[2];
if (!input) { console.error('Usage: node verify/check-app.cjs <functions-base-url>'); process.exit(2); }
const base = new URL(input);

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

async function main() {
  console.log(`app=${meta.app} manager=${meta.manager} runId=${meta.runId}\nbase=${base}\n`);
  for (const route of routes) {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + route.path;
    const init = { method: route.method ?? 'GET', signal: AbortSignal.timeout(20000) };
    if (route.body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(route.body);
    }
    let response, text;
    try {
      response = await fetch(url, init);
      text = await response.text();
    } catch (error) {
      record(route.path, false, `request failed: ${error.message}`);
      continue;
    }
    const expectStatus = route.status ?? 200;
    if (response.status !== expectStatus) {
      record(route.path, false, `HTTP ${response.status} (want ${expectStatus}) ${text.slice(0, 200)}`);
      continue;
    }
    let payload;
    try { payload = JSON.parse(text); } catch { record(route.path, false, `non-JSON: ${text.slice(0, 120)}`); continue; }
    const problems = [];
    if (route.legacy !== true) {
      if (payload.runId !== meta.runId) problems.push(`stale deployment (runId ${payload.runId})`);
      if (payload.app !== meta.app) problems.push(`wrong app ${payload.app}`);
    }
    if (payload.ok !== true) problems.push('ok=false');
    if (payload.checks) {
      for (const [key, value] of Object.entries(payload.checks)) if (value !== true) problems.push(`check ${key}=${value}`);
    }
    for (const [key, want] of Object.entries(route.expect ?? {})) {
      const got = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), payload);
      if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${key}=${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
    record(route.path, problems.length === 0,
      problems.length ? problems.join('; ') : (payload.installed ? JSON.stringify(payload.installed) : ''));
  }
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, `reports/${meta.app}-${stamp}.json`),
    JSON.stringify({ meta, base: base.toString(), results }, null, 2) + '\n');
  process.exit(failed.length ? 1 : 0);
}
main().catch(error => { console.error(error); process.exit(1); });

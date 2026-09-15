#!/usr/bin/env node
// Network requests happen only when you explicitly run this checker.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
async function main() {
  const [mode, input] = process.argv.slice(2);
  if (process.argv.length !== 4 || !['compatibility','attack-main','attack-hardened'].includes(mode)) {
    throw new Error('Usage: node scripts/check-staging.cjs compatibility|attack-main|attack-hardened <exact-functions-base-url>');
  }
  const base = new URL(input);
  assert.equal(base.protocol, 'https:', 'Use the staging HTTPS Functions URL');
  assert.equal(base.username + base.password + base.search + base.hash, '', 'No credentials, query or fragment in URL');
  const expected = JSON.parse(fs.readFileSync(path.join(root, mode === 'compatibility' ?
    'functions/_scenario.json' : 'apps/attack/functions/_attack-evidence.json'), 'utf8'));
  async function get(route, init = {}) {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + route;
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), redirect: 'error' });
    assert.equal(response.status, 200, route + ': HTTP status');
    const result = await response.json();
    assert.equal(result.ok, true, route + ': ok');
    assert.equal(result.app, mode === 'compatibility' ? 'compatibility' : 'attack', route + ': wrong app');
    assert.equal(result.runId, expected.runId, route + ': stale or wrong deployment');
    if (mode === 'compatibility') assert.equal(result.name, expected.name, route + ': wrong manager');
    console.log(route + ': ' + JSON.stringify(result));
    return { result, response };
  }
  if (mode === 'compatibility') {
    await get('installer-status');
    const { result } = await get('dependency-check');
    for (const key of ['oddNumber','evenNumber','nodeBuiltin']) assert.equal(result.checks[key], true, key);
    const payload = { message: 'sec-test', count: 3 };
    const echoed = await get('http-check', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    assert.equal(echoed.result.method,'POST');
    assert.deepEqual(echoed.result.body,payload);
    assert.equal(echoed.result.rawBody,JSON.stringify(payload));
    assert.equal(echoed.response.headers.get('x-sec-test'),'compatibility');
  } else {
    const { result } = await get('attack-status');
    assert.equal(result.dependency,'dependency-loaded');
    assert.ok(Array.isArray(result.events));
    if (mode === 'attack-main') {
      assert.equal(result.installTimeCodeExecuted,true,'Main did not exercise the attack path; do not claim closure from this baseline');
      for (const scope of ['root','dependency']) {
        for (const hook of ['preinstall','install','postinstall']) {
          assert.ok(result.events.some(e => e.scope === scope && e.hook === hook), 'Missing main positive control: '+scope+' '+hook);
        }
      }
      assert.ok(result.events.some(e => e.scope === 'root' && e.hook === 'prepare'),'Missing root prepare positive control');
    } else {
      assert.equal(result.installTimeCodeExecuted,false,'Install-time code executed with hardened CD');
      assert.deepEqual(result.events,[],'Install hooks must leave no evidence');
    }
  }
  console.log('PASS: '+mode+'; deployment logs and CD version still need checking.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

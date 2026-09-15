#!/usr/bin/env node
// Read-only staging requests; run explicitly after your deployment.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const scenario = JSON.parse(fs.readFileSync(path.join(__dirname, '../functions/_scenario.json'), 'utf8'));
async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/check-staging.cjs <exact-functions-base-url>');
  if (scenario.expected !== 'success') throw new Error('Negative case: inspect failed deployment logs instead of an older HTTP function.');
  const base = new URL(process.argv[2]);
  assert.equal(base.protocol, 'https:', 'Use the staging HTTPS Functions URL.');
  assert.equal(base.username + base.password + base.search + base.hash, '', 'URL must have no credentials, query or fragment.');
  for (const route of ['installer-status', 'dependency-check']) {
    const url = new URL(base.toString());
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + route;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    assert.equal(response.status, 200, route + ': HTTP status');
    const result = await response.json();
    assert.equal(result.ok, true, route + ': ok');
    assert.equal(result.name, scenario.name, route + ': scenario');
    assert.equal(result.runId, scenario.runId, route + ': stale or wrong deployment');
    assert.equal(result.expected, scenario.expected, route + ': expectation');
    if (route === 'dependency-check') {
      for (const key of ['oddNumber', 'evenNumber', 'dependencyHookProbe']) assert.equal(result.checks[key], true, key);
    }
    console.log(route + ': PASS ' + JSON.stringify(result));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

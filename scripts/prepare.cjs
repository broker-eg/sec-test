#!/usr/bin/env node
// Writes fixture files only; no package installation, Git or deployment actions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = process.argv[2];
const manager = process.argv[3] ?? 'npm';
if (!['compatibility', 'attack'].includes(target) ||
    (target === 'compatibility' && !['npm', 'pnpm', 'yarn-classic'].includes(manager)) ||
    (target === 'attack' && process.argv.length !== 3) || process.argv.length > 4) {
  console.error('Usage: node scripts/prepare.cjs compatibility [npm|pnpm|yarn-classic] OR node scripts/prepare.cjs attack');
  process.exit(1);
}
const runId = crypto.randomUUID();
if (target === 'compatibility') {
  const dest = path.join(root, 'functions');
  for (const file of ['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock']) fs.rmSync(path.join(dest,file), {force:true});
  const fixture = path.join(root,'fixtures','compatibility',manager);
  for (const file of fs.readdirSync(fixture)) fs.copyFileSync(path.join(fixture,file),path.join(dest,file));
  fs.writeFileSync(path.join(dest,'_scenario.json'),JSON.stringify({app:target,name:manager,runId},null,2)+'\n');
} else {
  fs.writeFileSync(path.join(root,'apps/attack/functions/_attack-evidence.json'),JSON.stringify({runId,events:[]},null,2)+'\n');
}
console.log(JSON.stringify({app:target,name:target === 'attack' ? 'npm-hooks' : manager,runId},null,2));
console.log('Prepared local files only. Commit, push and deploy yourself.');

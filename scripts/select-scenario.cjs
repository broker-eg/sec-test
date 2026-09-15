#!/usr/bin/env node
// Writes fixture files only. Never installs, commits, pushes, or deploys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const scenarios = {
  npm: ['npm', 'success'],
  'npm-dependency-hook': ['npm-dependency-hook', 'success'],
  pnpm: ['pnpm', 'success'],
  'yarn-classic': ['yarn-classic', 'success'],
  'yarn-parent-berry': ['yarn-classic', 'success'],
  'berry-manifest': ['yarn-classic', 'Yarn Berry is not supported'],
  'berry-devengines': ['yarn-classic', 'Yarn Berry is not supported'],
  'berry-lock': ['yarn-classic', 'Yarn Berry is not supported'],
  'pnpm-checksum': ['pnpm', 'pnpm hook files (.pnpmfile.cjs) are not supported'],
  'no-lockfile': ['npm', 'no lockfile in'],
};
const name = process.argv[2];
if (!scenarios[name] || process.argv.length !== 3) {
  console.error('Usage: node scripts/select-scenario.cjs <' + Object.keys(scenarios).join('|') + '>');
  process.exit(1);
}
const parent = path.join(root, 'package.json');
if (fs.existsSync(parent) && JSON.parse(fs.readFileSync(parent, 'utf8')).name !== 'sec-test-parent-berry') {
  throw new Error('Refusing to overwrite an unrelated root package.json');
}
const [fixture, expected] = scenarios[name];
const target = path.join(root, 'functions');
for (const file of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '_hook-probe.tgz', '_dependency-check.cjs', '_scenario.json']) {
  fs.rmSync(path.join(target, file), { force: true });
}
fs.rmSync(parent, { force: true });
for (const file of fs.readdirSync(path.join(root, 'fixtures', fixture))) {
  fs.copyFileSync(path.join(root, 'fixtures', fixture, file), path.join(target, file));
}
function write(file, value) {
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}
if (!fs.existsSync(path.join(target, '_dependency-check.cjs'))) {
  write(path.join(target, '_dependency-check.cjs'), "module.exports = 'not-selected';\n");
}
const manifestPath = path.join(target, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (name === 'berry-manifest') manifest.packageManager = 'yarn@4.9.1';
if (name === 'berry-devengines') {
  delete manifest.packageManager;
  manifest.devEngines = { packageManager: { name: 'yarn', version: '4.9.1' } };
}
write(manifestPath, manifest);
if (name === 'yarn-parent-berry') {
  delete manifest.packageManager;
  write(manifestPath, manifest);
  write(parent, { name: 'sec-test-parent-berry', private: true, packageManager: 'yarn@4.9.1' });
}
if (name === 'berry-lock') write(path.join(target, 'yarn.lock'), '__metadata:\n  version: 8\n');
if (name === 'pnpm-checksum') {
  const lock = path.join(target, 'pnpm-lock.yaml');
  write(lock, fs.readFileSync(lock, 'utf8') + '\npnpmfileChecksum: sec-test-intentional-rejection\n');
}
if (name === 'no-lockfile') fs.rmSync(path.join(target, 'package-lock.json'));
const scenario = { name, runId: crypto.randomUUID(), expected };
write(path.join(target, '_scenario.json'), scenario);
console.log(JSON.stringify(scenario, null, 2));
console.log('Files prepared. No install, commit, push, or deployment was performed.');

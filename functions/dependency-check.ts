import isOdd from 'is-odd';
import scenario from './_scenario.json';
import { createHash } from 'node:crypto';
export default async function (_req: unknown, res: any) {
  await Promise.resolve();
  const checks = { oddNumber: isOdd(3) === true, evenNumber: isOdd(4) === false,
    nodeBuiltin: createHash('sha256').update('abc').digest('hex') ===
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
  res.setHeader('Cache-Control', 'no-store');
  res.status(Object.values(checks).every(Boolean) ? 200 : 500).json({
    ok: Object.values(checks).every(Boolean), ...scenario, checks });
}

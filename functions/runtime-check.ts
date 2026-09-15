import { reply } from './_availability.cjs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { writeFile, readFile, unlink } from 'node:fs/promises';
export default async function (req: any, res: any) {
  const file = join('/tmp', `sec-test-${createHash('sha256').update(String(req.query.token ?? 'default')).digest('hex')}.txt`);
  let fileRoundTrip = false;
  try {
    await writeFile(file, 'availability-fs');
    fileRoundTrip = (await readFile(file, 'utf8')) === 'availability-fs';
  } finally { await unlink(file).catch(() => {}); }
  reply(res, 'runtime-check', { node: process.version, arch: process.arch,
    functionPath: process.env.NHOST_FUNCTION_PATH ?? null,
    invocationIdPresent: typeof req.invocationId === 'string' && req.invocationId.length > 0,
    fileRoundTrip, compressionRoundTrip: gunzipSync(gzipSync('availability-zlib')).toString() === 'availability-zlib',
    unicodeRoundTrip: Buffer.from('أهلاً 🌍').toString('utf8') === 'أهلاً 🌍' });
}

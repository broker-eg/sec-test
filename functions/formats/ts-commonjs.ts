import { reply } from '../_availability.cjs';
function handler(_req: unknown, res: any): void { reply(res, 'ts-commonjs'); }
export = handler;

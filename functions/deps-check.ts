import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { chunk, groupBy } from 'lodash';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { z } from 'zod';
import { reply } from './_app.cjs';

dayjs.extend(utc);

const Schema = z.object({ id: z.string().uuid(), count: z.number().int().positive() });

export default async function (_req: unknown, res: any) {
  const id = uuidv4();
  const parsed = Schema.safeParse({ id, count: 3 });
  const rejected = Schema.safeParse({ id: 'nope', count: -1 });
  const checks = {
    uuidGenerated: uuidValidate(id),
    zodAccepts: parsed.success === true,
    zodRejects: rejected.success === false,
    dayjsUtc: dayjs.utc('2026-01-02T03:04:05Z').format('YYYY-MM-DD HH:mm') === '2026-01-02 03:04',
    lodashChunk: JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === '[[1,2],[3,4],[5]]',
    lodashGroupBy: Object.keys(groupBy([1.2, 1.8, 2.1], Math.floor)).join() === '1,2',
    axiosLoaded: typeof axios.create === 'function' && typeof axios.get === 'function',
    axiosInstance: typeof axios.create({ baseURL: 'https://example.invalid' }).request === 'function',
  };
  const ok = Object.values(checks).every(Boolean);
  reply(res, 'deps-check', { checks }, ok ? 200 : 500);
}

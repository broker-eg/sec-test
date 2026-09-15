import { reply } from '../_availability.cjs';
import data from '../_helpers/data.json';
import common from '../_helpers/common.cjs';
interface Item<T> { value: T }
enum State { Ready = 'ready' }
const identity = <T>(value: T): Item<T> => ({ value });
export default async function (_req: unknown, res: any): Promise<void> {
  const { sum } = await import('../_helpers/math.mjs');
  reply(res, 'ts-features', { state: State.Ready, generic: identity(7).value,
    total: sum(data.numbers), message: data.message, helper: common.label });
}

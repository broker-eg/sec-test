import { reply } from '../../_app.cjs';
export default function (req: any, res: any): void {
  reply(res, 'nested-route', { path: req.path ?? null, depth: 3 });
}

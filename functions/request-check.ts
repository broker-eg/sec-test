import { reply, headers } from './_availability.cjs';
export default (req: any, res: any) => {
  if (req.method === 'OPTIONS') {
    headers(res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
    return res.status(204).end();
  }
  reply(res, 'request-check', { method: req.method, query: req.query,
    body: req.body ?? null, rawBody: req.rawBody ?? null,
    requestHeader: req.get('X-Sec-Test-Input') ?? null });
};

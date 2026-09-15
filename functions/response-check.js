const { headers, reply } = require('./_availability.cjs');
module.exports = async (req, res) => {
  headers(res);
  switch (req.query.kind) {
    case 'text': return res.status(200).type('text/plain').send('availability-text');
    case 'html': return res.status(200).type('text/html').send('<p>availability-html</p>');
    case 'binary': return res.status(200).type('application/octet-stream').send(Buffer.from([0,1,2,127,128,254,255]));
    case 'gzip':
      res.setHeader('Content-Encoding', 'gzip');
      return res.status(200).type('text/plain').send(require('node:zlib').gzipSync('availability-compressed'));
    case 'cookies':
      res.cookie('sec_test_a', 'one', { sameSite: 'lax', path: '/' });
      res.cookie('sec_test_b', 'two', { sameSite: 'lax', path: '/' });
      return reply(res, 'cookies');
    case 'empty': return res.status(204).end();
    case 'created': return reply(res, 'created', { value: 'created' }, 201);
    case 'redirect': return res.redirect(302, '?kind=text');
    case 'cors': res.setHeader('Access-Control-Allow-Origin', 'https://sec-test.example'); return reply(res, 'custom-cors');
    case 'chunks':
      res.type('text/plain'); res.write('chunk-a|');
      await Promise.resolve(); return res.end('chunk-b');
    default: return reply(res, 'response-check');
  }
};

const { reply } = require('./_app.cjs');
module.exports = (req, res) => reply(res, 'echo-json', {
  method: req.method,
  query: req.query,
  body: req.body ?? null,
  contentType: req.headers['content-type'] ?? null,
});

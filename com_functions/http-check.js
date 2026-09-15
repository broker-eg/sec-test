const scenario = require('./_scenario.json');
module.exports = async (req, res) => {
  await Promise.resolve();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Sec-Test', 'compatibility');
  res.status(200).json({ ok: true, ...scenario, method: req.method,
    body: req.body ?? null, rawBody: req.rawBody ?? null });
};

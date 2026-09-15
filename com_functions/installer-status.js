const scenario = require('./_scenario.json');
module.exports = (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, ...scenario, node: process.version });
};

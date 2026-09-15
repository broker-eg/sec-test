const { reply } = require('./_availability.cjs');
module.exports = (req, res) => reply(res, 'ping', { token: req.query.token ?? null });

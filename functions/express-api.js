const express = require('express');
const { reply, app: meta } = require('./_app.cjs');
const api = express();
const router = express.Router();
router.get('/users/:id', (req, res) => reply(res, 'express-router', { userId: req.params.id }));
router.post('/validate', (req, res) => reply(res, 'express-validate', { received: req.body ?? null }));
api.use((req, _res, next) => { req.tagged = true; next(); });
api.use('/v1', router);
api.all('/{*path}', (req, res) => reply(res, 'express-fallback', {
  middlewareRan: req.tagged === true, path: req.path, method: req.method, version: meta.runId.slice(0, 8),
}));
module.exports = api;

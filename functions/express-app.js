const express = require('express');
const { reply } = require('./_availability.cjs');
const app = express();
app.use((req, _res, next) => { req.secTestMiddleware = true; next(); });
app.all('/{*path}', (req, res) => reply(res, 'express-app', {
  middlewareRan: req.secTestMiddleware, method: req.method }));
module.exports = app;

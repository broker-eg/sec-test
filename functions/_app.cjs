// Shared reply helper for the PR-1216 compatibility apps.
const app = require('./_app.json');
exports.reply = (res, kind, extra = {}, status = 200) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-App-Run-Id', app.runId);
  res.status(status).json({ ok: status < 400, ...app, kind, ...extra });
};
exports.app = app;

const scenario = require('./_scenario.json');
exports.reply = (res, kind, extra = {}, status = 200) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Sec-Test-Run-Id', scenario.runId);
  res.setHeader('X-Sec-Test-Manager', scenario.name);
  res.status(status).json({ ok: true, ...scenario, kind, ...extra });
};
exports.headers = res => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Sec-Test-Run-Id', scenario.runId);
  res.setHeader('X-Sec-Test-Manager', scenario.name);
};

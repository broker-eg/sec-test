const { headers, reply } = require('./_availability.cjs');
module.exports = (req, res) => {
  headers(res);
  if (req.query.mode === 'throw') throw new Error('SEC_TEST_EXPECTED_SYNC_ERROR');
  if (req.query.mode === 'reject') return Promise.reject(new Error('SEC_TEST_EXPECTED_ASYNC_ERROR'));
  if (req.query.mode === 'handled') return reply(res, 'handled-error', { error: 'expected-validation-error' }, 422);
  return reply(res, 'error-recovery');
};

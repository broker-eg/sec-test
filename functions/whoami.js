module.exports = (_req, res) => {
  const hasAdminSecret =
    typeof process.env.NHOST_ADMIN_SECRET === 'string' &&
    process.env.NHOST_ADMIN_SECRET.length > 0;

  console.log(
    'Lambda runtime: NHOST_ADMIN_SECRET present =',
    hasAdminSecret,
  );

  res.status(200).json({ hasAdminSecret });
};

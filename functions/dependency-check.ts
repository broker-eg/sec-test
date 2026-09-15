import isOdd from 'is-odd';
import scenario from './_scenario.json';
import dependencyProbe from './_dependency-check.cjs';
export default function (_req: unknown, res: any) {
  const checks = { oddNumber: isOdd(3) === true, evenNumber: isOdd(4) === false,
    dependencyHookProbe: scenario.name !== 'npm-dependency-hook' ||
      dependencyProbe === 'dependency-installed-without-hooks' };
  const ok = Object.values(checks).every(Boolean);
  res.setHeader('Cache-Control', 'no-store');
  res.status(ok ? 200 : 500).json({ ok, ...scenario, checks, dependencyProbe,
    message: 'TypeScript and imported dependencies were bundled and run successfully.' });
}

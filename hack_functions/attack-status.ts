import evidence from './_attack-evidence.json';
import dependency from 'sec-test-hook-probe';
export default function (_req: unknown, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: dependency === 'dependency-loaded',
    app: 'attack', name: 'npm-hooks', runId: evidence.runId,
    installTimeCodeExecuted: evidence.events.length > 0, events: evidence.events,
    dependency, node: process.version });
}

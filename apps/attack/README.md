# Attack-evidence app

Deploy this directory as the GitHub base directory in a separate staging project,
with Functions directory `functions`. See the repository root README for the full
main-versus-hardened procedure.

The default npm hooks append only harmless `{scope, hook}` events to
`functions/_attack-evidence.json` and print a marker. They do not throw or collect
secrets. Main should deploy with events; hardened CD should deploy without events.
The `/attack-status` TypeScript function bundles the evidence and checks the safe
runtime dependency export. It does not execute the hooks at request time.

From the repository root, reset evidence/generate a fresh run ID with:

```sh
node scripts/prepare.cjs attack
```

Commit only initial evidence with `events: []`. Commit the local `_hook-probe.tgz`
and npm lockfile. The tarball's hooks are deliberately executable on main; do not
install packages locally in this checkout before committing.

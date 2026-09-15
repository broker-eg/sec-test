# Compare main and hardened CD with two staging apps

This repository contains two independent Functions apps. Nothing here deploys,
pushes, collects secrets, reads environment variables, or makes an attack callback.
The original failing tripwire fixture has been replaced with a clean compatibility
app and a separate harmless attack-evidence app.

## Create/configure two staging projects yourself

Connect both projects to this GitHub repository and the same branch:

| Staging project | GitHub base directory | Functions directory | Purpose |
| --- | --- | --- | --- |
| Compatibility | `.` (repository root) | `functions` | Should work with main and hardened CD |
| Attack | `apps/attack` | `functions` | Shows whether install-time hooks execute |

Keep each project's existing staging service configuration and Node version. Your
first deployment used Node **24**; start with that same version on both CD builds.
No `nhost.toml` is included, so pushing this repo does not change service settings.
Both manifests live immediately beside their app's functions. There is no root
package manifest or poisoned `.tools` directory to interfere with compatibility.

`TEST_SOURCE.json` records the local backend refs/source used to design these
fixtures. It does not identify the CD image currently running in staging.

## Test sequence

### 1. With staging CD built from main

The default compatibility case is npm and the default attack case is npm hooks.
Review and commit the repository yourself, including hidden files, lockfiles,
`_hook-probe.tgz`, and both apps' JSON run identifiers. Push and deploy both projects.

Both apps are expected to finish deployment successfully. Check the deploy-functions
install and build logs and the customer commit on each deployment.

Run these checks yourself using each project's **exact staging Functions base URL**:

```sh
node scripts/check-staging.cjs compatibility 'https://COMPATIBILITY-FUNCTIONS-BASE-URL'
node scripts/check-staging.cjs attack-main 'https://ATTACK-FUNCTIONS-BASE-URL'
```

Compatibility checks require working JavaScript and TypeScript handlers, bundled
registry dependencies, Node's crypto builtin, async handlers, and JSON POST/body/raw
body/custom-header behavior. The POST endpoint only echoes the fixed test payload;
it changes no server state.

For the attack project, main should log `SEC_TEST_INSTALL_CODE_EXECUTED` and its
`/attack-status` endpoint should return `installTimeCodeExecuted: true` with root
and dependency hook events. These probes **do not throw**: they only print a marker
and append `{scope, hook}` to this app's local build-evidence JSON. That evidence is
imported and bundled into the HTTP function after the installation finishes.

A successful attack-app deployment on main demonstrates that the harmless probes
still let the app build. It does not mean the install-time attack path is closed.
If main returns no events, the positive control was not exercised; investigate
before drawing a conclusion from the hardened result.

### 2. Switch staging to CD built from the hardened branch

Update both the backend CD image and the deploy-functions Tekton Task yourself.
Pushing this customer app does not update either of them.

Prepare fresh run identifiers and reset attack evidence before a new customer
commit, then push and deploy both projects yourself:

```sh
node scripts/prepare.cjs compatibility npm
node scripts/prepare.cjs attack
```

The preparation script only writes local files. It never installs, commits, pushes,
or deploys. Regenerating the IDs changes function inputs and gives the checker a way
to reject old deployments. Only commit attack evidence with `events: []`.

Both deployments should finish successfully again. Run:

```sh
node scripts/check-staging.cjs compatibility 'https://COMPATIBILITY-FUNCTIONS-BASE-URL'
node scripts/check-staging.cjs attack-hardened 'https://ATTACK-FUNCTIONS-BASE-URL'
```

Compatibility should still pass. Attack status must report
`installTimeCodeExecuted: false`, `events: []`, and the safe dependency export
`dependency-loaded`. No `SEC_TEST_INSTALL_CODE_EXECUTED` line should appear in
install-deps logs. Check both the app install and the subsequent serverless runtime
install; the root hooks would run during either unprotected npm command.

## Also compare pnpm and Yarn Classic compatibility

Run each case once on main, then repeat it on the hardened CD build. Each selection
replaces only the compatibility app's manifest/lockfiles and generates a new run ID:

```sh
node scripts/prepare.cjs compatibility pnpm
# Review, commit, push, deploy compatibility project yourself, then run its checker.

node scripts/prepare.cjs compatibility yarn-classic
# Review, commit, push, deploy compatibility project yourself, then run its checker.

node scripts/prepare.cjs compatibility npm
```

Use the same `compatibility` checker for all three. The manifests have **no lifecycle
hooks**, no custom Yarn binary, no pnpm hook file, and no poisoned Corepack settings.
The attack app alone sets `ignore-scripts=false` in its `.npmrc` to check that
the hardened installer overrides project configuration. The compatibility app
has no such config.

The pnpm case pins 11.0.6 and Yarn Classic pins 1.22.22; registry dependencies and
lock integrity values come from this branch's existing integration fixtures.

## What this comparison proves and does not prove

| Check | Main expectation | Hardened expectation |
| --- | --- | --- |
| Compatibility: npm / pnpm / Yarn Classic | Deploy and endpoint checks pass | Same |
| Attack app deployment and safe dependency import | Pass | Pass |
| Root preinstall/install/postinstall/prepare execute | Events present | No events |
| Dependency preinstall/install/postinstall execute | Events present | No events |

This directly tests the npm lifecycle path caught in your first deployment and
representative function/runtime compatibility. It cannot prove that every customer
app works or that every attack path is closed. Packages that require install-time
code to generate runtime artifacts are intentionally affected by this change.
Yarn Berry rejection, pnpm hook/plugin isolation, Corepack env-file isolation and
malicious esbuild input resolution need separate focused cases; these two apps do
not claim coverage of those security boundaries.

The old `whoami.js` contained only a console log and had no HTTP handler. It now
returns a harmless JSON response so every discovered compatibility function has
an actual handler. The unrelated `dawd` file is preserved.

For each run save: CD image/version and Task revision, customer commit, project,
manager, run ID, deployment ID, full installer/build logs, and checker output.
A registry/proxy/lockfile failure is a failed compatibility test to investigate;
it is not evidence that a lifecycle attack was blocked.

Local file, marker and handler checks are separate from actual staging deployments.
No staging deployment or request was performed while preparing these apps.

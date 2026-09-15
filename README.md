# Staging test for the hardened Functions dependency installer

Default scenario: **npm-dependency-hook**. This repository is a Functions test app;
there is no frontend, database migration, credential collection, or external callback.
The existing `functions/whoami.js` and `dawd` files are preserved.

## What must be running in staging

The **backend CD service and its deploy-functions Tekton Task** must contain this
branch's changes. Deploying this customer repository alone does not update the
installer. `TEST_SOURCE.json` records the backend commit and source checksums used
to prepare these tests; it does not prove which bytes staging runs.

Use a dedicated staging project. Set its GitHub base directory to the repository
root and Functions directory to `functions`. Keep the staging project's existing
service configuration; this repository deliberately contains no `nhost.toml` to
overwrite it. The baseline targets the Node 22 path used by this branch.

## First deployment: npm hooks and build tools

1. Review `functions/_scenario.json`. It records the active case and unique `runId`.
2. Commit and push this repository yourself, then deploy it to your staging project.
   Include `fixtures/`, hidden config files, `.tools/`, and `_hook-probe.tgz`.
3. Confirm the deployment for that Git commit finishes successfully. Inspect the
   **deploy-functions / install-deps** logs, including the app install, serverless
   runtime install, build tools install, and the following build step.
4. There must be no `SEC_TEST_INSTALL_CODE_EXECUTED` error. Any such error is a
   failed protection. Keep the full failure and step name if one appears.
5. Copy the project's exact Functions base URL from staging. Do not construct a
   production URL by guessing its hostname. Verify the two endpoints:

   ```sh
   node scripts/check-staging.cjs 'https://YOUR-STAGING-FUNCTIONS-BASE-URL'
   ```

   The checker performs GET requests only when **you** run it. Both endpoints
   must return 200, `ok: true`, and the local `name` and `runId`.
   `/dependency-check` must report all three checks as true, including the
   dependency tarball's harmless runtime export.

Success means the tripwires were skipped on that deployment path and the functions
still built and ran. HTTP results alone do not prove the installer was deployed;
match the deployment commit, logs, and scenario ID too.

## Additional scenarios

Prepare one case at a time:

```sh
node scripts/select-scenario.cjs pnpm
```

This changes local fixture files only. It prints the new `runId`. Review the diff,
then commit, push, and deploy yourself. Each selection changes a function's imported
JSON so a successful build has a new identifier. Do not run npm/pnpm/yarn install
in this checkout to regenerate these test lockfiles.

| Case | Expected deployment result | What it exercises |
| --- | --- | --- |
| `npm-dependency-hook` | Success | Root and tarball dependency preinstall/install/postinstall; root prepare; both npm installs; TS build |
| `npm` | Success | Root hooks despite `.npmrc` setting `ignore-scripts=false` |
| `pnpm` | Success | Frozen pnpm install with `.pnpmfile.cjs` present but disabled; second pnpm add; Corepack env-file isolation |
| `yarn-classic` | Success | Classic install and add; project `yarn-path` must never run; Corepack env-file isolation |
| `yarn-parent-berry` | Success | Nested manifest has no manager; root declares Berry; both Yarn commands must still use pinned Classic |
| `berry-manifest` | Failure containing `Yarn Berry is not supported` | Direct `packageManager` declaration |
| `berry-devengines` | Failure containing `Yarn Berry is not supported` | Exact Berry version in `devEngines.packageManager` |
| `berry-lock` | Failure containing `Yarn Berry is not supported` | Berry `__metadata:` lockfile detection |
| `pnpm-checksum` | Failure containing `pnpm hook files (.pnpmfile.cjs) are not supported` | Early rejection of lockfiles with `pnpmfileChecksum:` |
| `no-lockfile` | Failure containing `no lockfile in` and the commit-lockfile guidance | Manifest without a supported committed lockfile |

For negative cases, verify the **new deployment fails with that exact installer
message**. An older successful Lambda may still answer HTTP requests; its response
is not evidence that the rejected deployment succeeded. The staging checker refuses
to treat negative cases as runtime tests.

Return to the default with:

```sh
node scripts/select-scenario.cjs npm-dependency-hook
```

The selector replaces only its active manifests, lockfiles, dependency helper,
tarball and scenario JSON. It also adds/removes its root Berry manifest. It refuses
to overwrite an unrelated root `package.json`. It does not clean node_modules;
use a fresh deployment checkout and do not install locally in this repo.

## How the probes work

- `_install-tripwire.cjs` throws `SEC_TEST_INSTALL_CODE_EXECUTED root <hook>`.
  The manifest attaches it to preinstall, install, postinstall and prepare.
- The committed `_hook-probe.tgz` contains dependency hooks that throw the same
  prefix, plus a safe CommonJS export imported by `/dependency-check`.
- `.pnpmfile.cjs` and `_yarn-path-tripwire.cjs` throw if loaded. These files have
  no network calls and read no environment variables or credentials.
- `.corepack.env` names the unreachable loopback registry `127.0.0.1:9`. The
  installer must ignore this project file. A successful pnpm or Yarn deployment
  exercises this boundary; npm alone does not require a manager download.
- `.tools/.npmrc`, `package-lock.json` and `npm-shrinkwrap.json` are intentionally
  unusable customer inputs. The production step must remove that directory before
  installing esbuild. The planted `esbuild` exits with a tripwire message if used.
  This catches surviving config/lockfiles or direct reuse of the planted binary;
  it is not a full malicious native-package resolution exploit test.
- `/installer-status` returns only the case, run ID, expectation and Node version.
  `/dependency-check` is TypeScript and imports a registry dependency (`is-odd`)
  plus the safe probe export. Helpers begin with `_` or use `.cjs` so this branch's
  function discovery does not treat them as HTTP functions.

To see a tripwire's failure message locally without installing anything:

```sh
node functions/_install-tripwire.cjs preinstall
```

It intentionally exits nonzero. Do not enable lifecycle scripts to test a deployment.

## Record results

For each case record: case name, run ID, customer Git commit, staging CD version,
deployment ID, installer/build result, exact rejection or tripwire text, and (for
success cases) both endpoint responses. Registry, proxy or lockfile errors without
the expected rejection are inconclusive until resolved.

No push, deployment, package installation, or staging request was performed while
preparing this app. File/scenario checks are separate from real staging evidence.

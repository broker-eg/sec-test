# Final staging availability check

This expands only the normal compatibility app at repository root. Keep the
staging project's GitHub base directory `.` and Functions directory `functions`.
The attack app is unchanged and is not invoked by this checker.

## Run it

1. Review the app diff and fresh run ID in `functions/_scenario.json`, then commit
   and push yourself. Deploy the normal project with your hardened CD build.
2. In deployment logs, expect **18 functions discovered and 18 built**, a successful
   app-dependencies install, serverless-runtime install, esbuild install, and deploy.
   No active entry is Go and all local helpers begin with `_` or use `.cjs`/`.mjs`.
3. From this repository, run using the exact staging Functions URL:

   ```sh
   node scripts/check-availability.cjs 'https://YOUR-STAGING-FUNCTIONS-BASE-URL' --node=24
   ```

   Use your configured Node major if it differs from 24. The checker makes requests
   only when you run it. It does not deploy or invoke the attack app.
4. Expected result: **50/50 core checks passed** and a twelve-request availability
   sample with no failures. Every new route must return the local run ID and manager;
   a stale or wrong deployment fails. Inspect diagnostics separately below.
5. The checker saves every result, error and request duration under `reports/` as
   timestamped JSON and exits nonzero on a core failure. Reports are Git-ignored.

The default run makes 52 HTTP requests in total, including two diagnostics. The
final sample sends twelve requests with at most three concurrent requests. It has
no retries that could hide errors. This is a short availability sample, not a load
or uptime guarantee. If the project's rate limit is lower than this request count,
account for that when interpreting 429s; no settings are changed by the app.

## Coverage

| Area | Test |
| --- | --- |
| JavaScript exports | CommonJS `module.exports`, `exports.default`, ESM `export default` |
| TypeScript exports | ESM default and TypeScript `export =` |
| TypeScript compilation | Interfaces, generics, enum, async function |
| Imports | Registry `is-odd`, local CommonJS `.cjs`, ESM `.mjs` dynamic import, bundled JSON |
| Framework functions | Exported Express app and Express Router mounted in an app |
| Routes | Root `index.js`, nested `api/v1/index.ts`, nested named file, trailing slash |
| Methods | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| Request data | Unicode/query decoding, custom header, nested JSON, exact raw body, URL-encoded forms, 64 KiB JSON |
| Responses | JSON, text, HTML, gzip transport, buffered write/end chunks, custom header, CORS defaults and overrides |
| Status codes | 200, 201, 204, 302, expected 422 and 500 |
| Error behavior | Sync throw, rejected promise, handled validation, successful requests after errors |
| Runtime | Node version, architecture report, non-secret function-path env, Lambda invocation ID, writable `/tmp` with cleanup, zlib, Unicode Buffer round-trip |
| Availability | Bounded concurrent requests across four routes, response validation, request-token isolation, p50/p95 durations |
| Discovery exclusions | `_helpers`, `.cjs`, `.mjs` and JSON are imported helpers, not extra endpoints |

`error-check` intentionally logs `SEC_TEST_EXPECTED_SYNC_ERROR` and
`SEC_TEST_EXPECTED_ASYNC_ERROR` and returns 500 for those requests. The checker
expects those responses and verifies subsequent recovery. These two expected
application errors do not mean the deployment or availability test failed.

The root `index` is a real route, not a wildcard. These tests do not assume a
Next.js-style dynamic route or fallback handler.

## Existing behavior reported as diagnostics

Both diagnostics run on every check and are saved even when all core checks pass:

- **Raw binary response:** without `BINARY_CONTENT_TYPES=application/octet-stream`
  configured in the project, this wrapper's default `serverless-http` behavior
  converts non-text bytes through UTF-8 and loses bytes. Gzip transport is separately
  tested as a core check because the library automatically handles binary encoding
  for compressed content. The app does not set or change project environment values.
- **Multiple response cookies:** the library returns v2 cookies separately; the
  inspected functions-handler gateway copies `headers` but does not forward the
  separate cookies. The local invocation/translation test therefore receives none.
  The staging diagnostic records what its actual gateway forwards.

The wrapper is byte-identical between the inspected local `origin/main` and this
branch. These limitations are separate from the dependency-installer change.
They are not silently counted as successful checks: the report keeps their results
in `diagnostics` and the console prints them explicitly. If your application needs
both capabilities and you want either diagnostic to fail the overall command:

```sh
node scripts/check-availability.cjs 'https://YOUR-STAGING-FUNCTIONS-BASE-URL' --node=24 --strict-diagnostics
```

No backend code was changed as part of preparing these test functions.

## Repeat with all supported package-manager cases

For each case, prepare files, review, commit, push and deploy yourself, then run the
same availability checker against that new deployment:

```sh
node scripts/prepare.cjs compatibility npm
node scripts/prepare.cjs compatibility pnpm
node scripts/prepare.cjs compatibility yarn-classic
```

Run those selections **one at a time**, deploying/checking between them. Each makes
only local fixture changes and a fresh run ID. All three use the same 18 functions
and the same core expectations. The active default is npm. Do not run package
installation locally in the repository to regenerate these frozen lockfiles.

For runtime-version coverage, repeat using the Node versions supported and
configured in your staging project. The source routes Node functions through the
same JavaScript bundle path; local wrapper checks ran on Node 22 and Node 24.
Only a real staging deployment validates that project's AWS runtime and platform.

## Explicit boundaries

This suite covers normal JS/TS function deployment and request availability. Go
entries are discovered but intentionally skipped by this branch's builder and
deployer; `.mjs` and `.cjs` are helpers, not discovered entry formats. Native `.node`
addons, arbitrary filesystem assets not imported into the bundle, true response
streaming, a project with no manifest, monorepo/workspace layouts, external network
access, and database/Auth/Storage workflows are not validated by these routes.
Packages that require install hooks to generate runtime artifacts need a separate
compatibility decision. A green result does not establish that every customer app
or every configuration is unaffected.

`docs/local-availability-results.json` records the local preparation checks. They
used real esbuild bundles and the branch's actual Express/serverless-http wrapper,
invoked with Lambda v2 events. HTTP fetch/gateway translation was simulated in
process; this was not EKS, AWS Lambda, ARM64, or a staging HTTP test.

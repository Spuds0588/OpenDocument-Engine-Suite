# AGENTS.md

Guidance for anyone (human or agent) changing this repository.

## What this is

Three browser-native npm packages that parse OpenDocument files with no runtime
dependencies:

| Package | File type | Source |
| --- | --- | --- |
| `odt-engine` | `.odt` text | `packages/odt-engine` |
| `ods-engine` | `.ods` spreadsheet | `packages/ods-engine` |
| `odp-engine` | `.odp` presentation | `packages/odp-engine` |

`packages/core` is an internal package. Its source is statically bundled into
each engine by esbuild; it is never published on its own. The PRD in
`PRD-OpenDocument Engine Suite.md` is the product contract. `todo.md` is the
current work queue. `history.md` records what is already done.

## Working principles

- **YAGNI.** Build only what the PRD or the current task requires. No
  speculative abstraction, configuration, dependency, option or file. If a
  feature is not asked for, do not add it.
- **Prefer the smallest change.** Prefer a one-line fix when one line fully
  solves the problem. Do not introduce helpers, wrappers or layers for a single
  call site. A new file needs a concrete reason.
- **Keep the public site honest.** `index.html` is served by GitHub Pages from
  the repository root. When sizes, benchmarks or limitations change, update the
  page along with `README.md` and `history.md`; do not let marketing claims
  drift from measurements.
- **Clean up after every task.** This environment has limited memory and
  shared resources. Before finishing:
  - stop any server, watcher or background process you started;
  - remove scratch scripts, temporary fixtures, generated screenshots, logs and
    coverage output;
  - remove dependencies installed only for a throwaway experiment;
  - check `git status` so only intentional files remain.
  Do not leave cleanup for a later task.

## Commands

```bash
npm install           # once per checkout
npm test              # node:test, all packages (113 cases)
npm run test:browser  # build + browser conformance checks in headless Chrome
npm run build         # minified standalone ESM bundles + declarations into tracked dist
npm run smoke         # parse fixtures through the built dist bundles
npm run bench         # 5 MB parse-time benchmark (Node + jsdom)
npm run bench:browser # 5 MB parse-time benchmark in headless Chrome (7 runs)
npm run check         # test + build + smoke + browser suite; run before done
```

Node 18+ is supported. `DecompressionStream` is native; the Node tests supply
`DOMParser` through jsdom (`test/helpers/env.js`). The browser suite needs an
installed Chrome (or `CHROME_PATH`). jsdom, esbuild and playwright-core are dev
dependencies only.

## Architecture rules

- **Zero runtime dependencies.** Every published package keeps
  `"dependencies": {}`. Use platform APIs: `DecompressionStream('deflate-raw')`,
  `DataView`, `DOMParser`, Blob URLs, CSS Paged Media.
- **Namespace-agnostic XML.** Match on `localName`, never on a fixed prefix.
  Use the helpers in `packages/core/src/xml.js` instead of hand-rolled DOM
  traversal.
- **Style cascade stays centralized.** Named, default, automatic, parent and
  master styles are resolved by `StyleResolver` in
  `packages/core/src/styles.js`. Do not resolve styles inside a parser.
- **Media lifecycle.** Pictures become Blob URLs through `MediaResolver`.
  Every document exposes `destroy()`, which must revoke all of them and be
  safe to call twice.
- **Tagged diagnostics.** Use `createLogger('Zip' | 'Styles' | 'Parse' | 'Media'
  | 'Export')`. Logs are silent below warnings unless `setLogLevel('debug')` is
  called. Never leave `console.log` in library code.
- **AST first.** Parsers return plain JSON. Renderers read the AST only; they
  must not re-parse XML. The exact shapes are in
  `packages/core/src/types.d.ts`.
- **Committed dist is public.** `packages/*/dist` is tracked because GitHub
  Pages and jsDelivr serve those bundles directly. Run `npm run build` before
  committing a source change and include the refreshed `dist`; the URLs on the
  landing page and in the READMEs must keep resolving. `@main` URLs follow the
  latest build, so publish a tag or commit SHA when a frozen copy is needed.
- **ESM only.** `"type": "module"`, no CommonJS build, no transpiler in the
  source path.

## Tests and fixtures

- Tests use `node:test` and `node:assert/strict`, colocated under
  `packages/*/test`.
- The browser suite (`test/browser/suite.js`, driver `scripts/browser.mjs`) runs
  the built `dist` bundles in headless Chrome. It is the authoritative check for
  real `DOMParser` behavior, Blob URL lifecycle and rendered DOM structure; add
  a check there when behavior can differ between jsdom and a browser.
- Fixtures are real ZIP containers built in memory by
  `test/helpers/odf.js` and `test/helpers/zip.js`. Add fixture support there
  rather than checking binary files into the repository.
- Test behavior through the public API where possible. Reach into a parser only
  when the public API cannot expose the behavior.
- Cover the empty case, the malformed case and the wrong-format case, not just
  the happy path.
- Focused tests belong with the package they exercise. Cross-format checks live
  in `test/integration.test.js`.
- Do not reintroduce `getElementsByTagName('*')` or other live HTMLCollection
  scans over a whole document. jsdom makes them superlinear and they caused a
  measured slowdown; use `getElementsByTag`, `getFirstElementByTag` or
  `walkElements`.
- Do not iterate `childNodes` or `attributes` in whole-document loops. jsdom
  proxies both collections and every indexed access is expensive; the helpers
  in `packages/core/src/xml.js` walk `firstChild`/`nextSibling` and index each
  element's attributes once into a cache, which measured 6-8x faster than the
  proxied collections. Attribute lookups are per element, never per repeat
  counter iteration.
- Style indexing walks only `office:styles`, `office:automatic-styles` and
  `office:master-styles`. Do not scan the document body to find styles; that
  was the largest browser hot spot after XML parsing.
- Build changes are checked with `npm run build` and `npm run smoke`; a bundle
  past the 24 KB / 10 KB regression cap fails the build.

## Formatting and errors

- Errors thrown by library code are `OdfError` with a stable `code`
  (`NOT_A_ZIP`, `MISSING_ENTRY`, `NOT_ODF`, `UNKNOWN_SHEET`, ...). Preserve codes
  in new failure paths.
- Escape every value written into HTML (use `escapeHtml` / `escapeAttribute`).
  Escape Markdown metacharacters in generated Markdown.
- Keep public API additions out of `.d.ts` unless the implementation exists and
  is tested.
- Clip untrusted repeat counters before allocating (`LIMITS` in
  `ods-engine`). Large documents must degrade predictably, not exhaust memory.

## Size policy

The PRD target is 15 KB minified / 5 KB gzipped per engine. It is not met yet
(see `README.md`). The build reports the gap and enforces a regression cap, so
do not hide growth. When reducing size, remove work rather than minifier tricks,
and keep the behavior covered by tests.

## Definition of done

1. The requested behavior is implemented, with no extra features.
2. `npm test` passes; new behavior has a focused test.
3. `npm run check` passes if source or build inputs changed.
4. `README.md` / `history.md` / `todo.md` are updated when the state changes.
5. `git status` shows only intentional changes, and no process or scratch file
   from the task is left running.

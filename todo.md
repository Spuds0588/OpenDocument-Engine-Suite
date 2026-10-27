# TODO

Work queue for the OpenDocument Engine Suite. Keep this file current: move
finished items to the Done section and add the next concrete task rather than a
wish list. `history.md` records outcomes.

Status: `[ ]` open, `[x]` done.

## Blocked: PRD size target

- [ ] Meet the 15 KB minified / 5 KB gzipped per-engine target.
      Current: ODT 23.35 / 8.97 KB, ODS 17.17 / 7.05 KB, ODP 18.78 / 7.69 KB.
      The browser-fix and attribute-cache work added code, but compacting
      diagnostics, redundant CSS and the ZIP entry record still left every
      bundle slightly below its previous size. Reaching 15 KB requires a
      product decision to drop parser or renderer features, not another
      minifier pass. The build enforces the 24 KB / 10 KB regression cap.

## Next

- [ ] Publish `odt-engine`, `ods-engine` and `odp-engine` to npm. The landing
      page and README currently document a source build because the package
      names do not resolve on the registry yet; switch the install section to
      `npm install` once publication is authorized.
- [ ] Close the remaining ODS/ODP browser gap: 194–195 ms and 196–201 ms for
      5 MB of XML in Chrome 155 against the 150 ms target. ODT meets it at
      122–128 ms. Chrome's own XML parsing is 35–47% of ODS/ODP samples, so the
      next step is a streaming/non-DOM parser design, not another traversal
      tweak; agree the scope before starting.
- [ ] Add a memory measurement for repeated parses and `destroy()` cycles.
- [ ] Validate against files produced by LibreOffice, not only synthetic
      fixtures. Add a small, license-clean fixture set when one is available.

## Later / explicitly out of scope

- [ ] Footnotes and comments in the ODT AST (currently skipped).
- [ ] ODT text boxes (not part of the v1 AST).
- [ ] Formula evaluation (formulas are preserved verbatim).
- [ ] Slide media, animation and transitions.
- [ ] Editing, cursor handling and spell check (non-goal).

## Done

- [x] Committed the built ESM bundles and documented direct loading from
      GitHub Pages and jsDelivr, including a dynamic-import fallback. The page,
      READMEs and `llms.txt` list both URLs per engine.
- [x] Built the GitHub Pages landing page at the repository root: static HTML
      and CSS, source-build instructions, API, comparison, measured numbers,
      FAQ, JSON-LD, Open Graph/Twitter cards, sitemap, robots and `llms.txt`.
      Verified at mobile and desktop widths in light and dark schemes.
- [x] Added a real-browser suite and benchmark (`test/browser/`, playwright-core)
      and wired the suite into `npm run check`. 13 checks pass against the built
      dist bundles in headless Chrome 155.
- [x] Fixed malformed XML being accepted in Chrome: the parser now detects
      Chrome's root-level child `<parsererror>` as well as the Firefox/Safari
      and jsdom document-element form. jsdom had hidden the difference.
- [x] Browser speed pass: style-container-only indexing, per-element attribute
      cache, pointer-based hot loops, `textContent` fast path for plain text and
      targeted ODP/ODS reductions. Browser medians: ODT 151 → 122–128 ms,
      ODS 304 → 194–195 ms, ODP 329 → 196–201 ms (harness gained warm-up and
      GC control during the work, so the deltas are directional).
- [x] Accuracy: traverse `table:table-header-columns` so column widths and
      styles from LibreOffice header groups are kept.
- [x] Size pass after the browser work: 23.35 / 8.97 KB (ODT), 17.17 / 7.05
      (ODS), 18.78 / 7.69 (ODP), each slightly below the previous build.
- [x] Refined parsing speed: pointer-based XML traversal and
      `getAttributeNames()` reads instead of proxied collection access, plus
      per-element (not per-repeat) spreadsheet cell typing. Median 5 MB parse:
      ODT 1592 -> 959 ms, ODS 4345 -> 1628 ms, ODP 4028 -> 1507 ms.
- [x] Accuracy: pass a literal `fo:text-decoration` through, and keep row-span
      columns occupied through the whole span in Markdown/plain-text tables.
- [x] Expanded the suite from 34 to 113 tests: core ZIP/XML/units/styles/media/
      logging/HTML/print coverage, ODT/ODS/ODP edge cases, and cross-package
      integration tests.
- [x] Fixed the bugs the expanded suite exposed (details in `history.md`).
- [x] `npm run check` passes: 113 tests, build, dist smoke test and browser suite.
- [x] Added `scripts/bench.mjs` and `npm run bench`; measured 5 MB XML across
      all three engines.
- [x] Removed the superlinear whole-document XML lookup; 1 MB ODT indexing went
      from 2.17 s to 0.40 s.
- [x] Size pass: split layout/list indexing so ODS drops it, collapsed the
      media map to one store, and simplified table parsing. ODS 18.92 → 17.21 KB.
- [x] Monorepo with npm workspaces and a matching `pnpm-workspace.yaml`
      (TASK-CORE-101).
- [x] Zero-dependency ZIP reader with Central Directory parsing and
      `DecompressionStream` (TASK-CORE-102).
- [x] Namespace-agnostic XML helpers (TASK-CORE-103).
- [x] `StyleResolver` inheritance cascade, CSS mapping and page layouts
      (TASK-CORE-104).
- [x] `MediaResolver` with Blob URL tracking and teardown (TASK-CORE-105).
- [x] Tagged diagnostic logging (TASK-CORE-106).
- [x] ODT parser: headings, paragraphs, spans, links, nested lists, tables and
      images (TASK-ODT-201/202/203).
- [x] ODT HTML, Markdown and plain-text renderers.
- [x] ODS parser: typed cells, formulas, repeats, spans, column widths.
- [x] ODS matrix, CSV, JSON and HTML renderers.
- [x] ODP parser: ordered slides, frame geometry, text, images, shapes.
- [x] ODP deck HTML and Markdown transcript.
- [x] In-memory ZIP and ODF fixture builders; initial suites, later expanded to
      113 tests.
- [x] Standalone bundle build, declaration typecheck and dist smoke test.
- [x] READMEs for the suite and each package.

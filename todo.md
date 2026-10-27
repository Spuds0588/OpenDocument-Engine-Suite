# TODO

Work queue for the OpenDocument Engine Suite. Keep this file current: move
finished items to the Done section and add the next concrete task rather than a
wish list. `history.md` records outcomes.

Status: `[ ]` open, `[x]` done.

## Decisions

- **Distribution.** Not published to npm, and not planned for v1. Consumers load
  an engine from jsDelivr or GitHub Pages, or unpack one engine folder with a
  single `curl | tar` command. The committed `dist/` bundle is the tested
  artifact, so neither path needs a build. Revisit npm only if a registry
  release is requested.
- **Bundle size (15 KB minified / 5 KB gzipped).** Not met: 23.35 / 8.97 KB
  (ODT), 17.17 / 7.05 KB (ODS), 18.78 / 7.69 KB (ODP). Every feature in the PRD
  is implemented and the last three passes were net reductions, so closing the
  gap means dropping parser or renderer features (Markdown, plain text, page
  layouts, cell spans). That is a product decision, not a minifier pass. The
  build reports the gap and enforces the 24 KB / 10 KB regression cap meanwhile.
- **Browser parse time (150 ms for ~5 MB).** Met by ODT (122–128 ms in Chrome
  155), not by ODS (194–195 ms) or ODP (196–201 ms). A CPU profile of the 5 MB
  benchmark puts Chrome's own XML parsing at 112 ms of a ~205 ms ODS run and
  121 ms of a ~235 ms ODP run, plus 13–15 ms of decompression: native parsing
  and inflation alone are 125 ms (ODS) and 134 ms (ODP) of the 150 ms budget.
  Closing the gap needs a streaming, non-DOM parser for all three formats,
  which is a rewrite rather than a tuning pass, so it is out of scope for v1.

## Next

No open work. v0.1 is feature-complete against the PRD except the two targets
recorded above; add the next concrete task here when one exists.

## Later / explicitly out of scope

- [ ] Footnotes and comments in the ODT AST (currently skipped).
- [ ] ODT text boxes (not part of the v1 AST).
- [ ] Formula evaluation (formulas are preserved verbatim).
- [ ] Slide media, animation and transitions.
- [ ] Editing, cursor handling and spell check (non-goal).

## Done

- [x] Documented the consumption model: load an engine from jsDelivr or GitHub
      Pages, or copy one engine into a project with a single `curl | tar`
      command. Clone, build and `npm install <path>` instructions are gone from
      `README.md`, the package READMEs, the landing page and `llms.txt`; the
      command was verified end to end against the pushed commit.
- [x] Measured memory across repeated cycles in Chrome: +376 KB retained after
      40 parse + `toHTML` + `destroy` cycles on an 18 KB document with 120
      images, with the last cycle's Blob URLs still revoked. The browser suite
      asserts a bound and reports the number.
- [x] Validated against real producer output: five Apache-2.0 documents from the
      ODF Toolkit (LibreOffice 6.1, StarOffice 8, OpenOffice.org 3.0 and 3.2, and
      a third-party ODS producer) are committed in `test/fixtures/real` with
      provenance and SHA-256, covered by three Node tests and one browser check.
      No parser defects surfaced; the embedded-object deck confirmed the
      intended degradation for empty text boxes and missing image targets.
- [x] Profiled the browser benchmark per phase (decompression, native XML parse,
      engine code, GC) to attribute the remaining ODS/ODP time; results are in
      the Decisions section and `history.md`.
- [x] Suite is now 116 Node tests and 15 browser checks.
- [x] Committed the built ESM bundles and documented direct loading from
      GitHub Pages and jsDelivr, including a dynamic-import fallback. The page,
      READMEs and `llms.txt` list both URLs per engine.
- [x] Built the GitHub Pages landing page at the repository root: static HTML
      and CSS, install-free usage, API, comparison, measured numbers, FAQ,
      JSON-LD, Open Graph/Twitter cards, sitemap, robots and `llms.txt`.
      Verified at mobile and desktop widths in light and dark schemes.
- [x] Added a real-browser suite and benchmark (`test/browser/`, playwright-core)
      and wired the suite into `npm run check`. 13 checks passed against the
      built dist bundles in headless Chrome 155 at the time; 15 now.
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
- [x] `npm run check` passes: tests, build, dist smoke test and browser suite.
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
      113 tests plus the real-file set.
- [x] Standalone bundle build, declaration typecheck and dist smoke test.
- [x] READMEs for the suite and each package.

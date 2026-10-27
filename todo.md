# TODO

Work queue for the OpenDocument Engine Suite. Keep this file current: move
finished items to the Done section and add the next concrete task rather than a
wish list. `history.md` records outcomes.

Status: `[ ]` open, `[x]` done.

## Blocked: PRD size target

- [ ] Meet the 15 KB minified / 5 KB gzipped per-engine target.
      Current: ODT 23.55 / 9.02 KB, ODS 17.19 / 7.01 KB, ODP 18.82 / 7.73 KB.
      The layout/list split cut ODS by about 9%, and the speed work left the
      bundles slightly smaller than before it. Reaching 15 KB requires a
      product decision to drop parser or renderer features, not another
      minifier pass. The build still enforces the 24 KB / 10 KB regression cap.

## Next

- [ ] Measure the same 5 MB benchmark in a real browser. The current numbers
      (ODT 0.96 s, ODS 1.63 s, ODP 1.51 s on Node + jsdom) are a conservative
      lower bound, not the browser result. `npm run bench` fails the 150 ms
      target; do not report it as met.
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

- [x] Refined parsing speed: pointer-based XML traversal and
      `getAttributeNames()` reads instead of proxied collection access, plus
      per-element (not per-repeat) spreadsheet cell typing. Median 5 MB parse:
      ODT 1592 -> 959 ms, ODS 4345 -> 1628 ms, ODP 4028 -> 1507 ms.
- [x] Accuracy: pass a literal `fo:text-decoration` through, and keep row-span
      columns occupied through the whole span in Markdown/plain-text tables.
- [x] Expanded the suite from 34 to 112 tests: core ZIP/XML/units/styles/media/
      logging/HTML/print coverage, ODT/ODS/ODP edge cases, and cross-package
      integration tests.
- [x] Fixed the bugs the expanded suite exposed (details in `history.md`).
- [x] `npm run check` passes: 110 tests, build and dist smoke test.
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
      110 tests.
- [x] Standalone bundle build, declaration typecheck and dist smoke test.
- [x] READMEs for the suite and each package.

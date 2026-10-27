# History

Chronological record of what changed and why. Newest work goes at the top of
its date. `AGENTS.md` holds the working rules and `README.md` describes the
shipped libraries.

## 2026-10-27

### Script-tag build for plain <script src>

- The bundles are ES modules, so `<script src="...index.js">` failed with a
  syntax error on `export`; only `type="module"` plus an import worked. Each
  engine now also builds `dist/global.js`, an IIFE from the same entry point
  that defines `window.ODT`, `window.ODS` or `window.ODP`, so one plain script
  tag is enough. Cost: 0.4–0.5 KB per engine (23.82 / 17.64 / 19.25 KB minified
  against 23.35 / 17.17 / 18.78 KB for the module build). Nothing is duplicated
  in source; `scripts/build.mjs` runs esbuild twice.
- README, the package READMEs, the landing page and `llms.txt` lead with the
  script-tag path and keep the module import and single-file copy alongside it,
  since one library now answers both `<script src>` and `import` users. The
  landing page example no longer needs the `type="module"` caveat to be useful.
- The browser suite gained a check that loads all three global builds with
  script tags, asserts the three namespaces coexist, and parses each fixture
  through them: 16 browser checks now.
- AGENTS.md records that every engine ships both files and that each release tag
  must contain both.

### v1.0 releases and single-file distribution

- The three libraries are released as **1.0.0**: tags `odt-engine-v1.0.0`,
  `ods-engine-v1.0.0` and `odp-engine-v1.0.0`, each with a GitHub Release. The
  version field moved from 0.1.0 to 1.0.0 in the root and package manifests and
  in the landing page's structured data.
- Consumer docs were rewritten around the two things the audience actually
  does: load one bundle from a URL, or copy that single file into a project.
  `README.md`, the three package READMEs, `index.html` and `llms.txt` now show
  the URL import, a `<script type="module">` example for the page head, and a
  one-command `curl -sLo odt-engine.js <tag URL>` download of the complete
  library. Unpacking a whole engine folder was dropped: the tests and build
  inputs are not part of using the library. README URLs are pinned to the
  release tags, with `@main` documented as the follow-the-latest option.
- Internal-plan wording is gone from consumer surfaces. The "PRD target / not
  met / needs a product decision / regression cap" notes were replaced by the
  measured size and parse tables, the landing page no longer has a target
  column, and the development section is down to the build and test commands.
- `todo.md` was removed. Its queue was empty and the two open targets are
  decisions, recorded here:
  - **Distribution** is a URL import or a single-file download, not npm.
    Revisit only if a registry release is requested.
  - **Bundle size** stays at 23.35 / 17.17 / 18.78 KB (8.97 / 7.05 / 7.69 KB
    gzipped) by choice: reaching 15 KB means dropping parser or renderer
    features. The build still enforces the 24 KB / 10 KB regression cap.
  - **Browser parse time** for ~5 MB is 122-128 ms (ODT) and 194-201 ms
    (ODS/ODP) in Chrome 155. Native parsing plus decompression alone is 125 ms
    (ODS) and 134 ms (ODP) of any 150 ms budget, so closing the gap needs a
    streaming parser rather than tuning. Out of scope for v1.
- `AGENTS.md` gained the release tagging rule (`<engine>-v<version>` on the
  commit that carries the built bundle) and the rule that consumer docs stay
  free of install, build and internal-plan wording.

### Distribution docs, memory baseline and real-world fixtures

- The documented consumption model is now two paths: import the committed
  bundle from a URL (jsDelivr, mirrored by GitHub Pages), or copy one engine
  into a project with a single command:
  `curl -sL https://github.com/Spuds0588/OpenDocument-Engine-Suite/archive/refs/heads/main.tar.gz | tar -xz --strip-components=2 OpenDocument-Engine-Suite-main/packages/odt-engine`.
  `git clone`, `npm run build` and `npm install <path>` instructions are gone
  from `README.md`, the three package READMEs, the landing page and `llms.txt`.
  The command was run against the pushed commit: it extracts `odt-engine/` with
  `dist/`, `src/`, tests and the manifest, and that extracted `dist/index.js`
  parses an `.odt` fixture in Node.
- Memory: the browser suite now runs 40 parse + `toHTML` + `destroy` cycles over
  an 18 KB document with 120 distinct images, forces collection and asserts the
  retained heap stays under 8 MB. Measured retained heap: **+376 KB** on the
  first run, +382 KB and -633 KB on later runs, which is flat within collection
  noise; the last cycle's Blob URLs are always revoked. The driver prints the
  number, so a regression shows up as a larger figure instead of a sudden
  failure, and the docs quote the flat result rather than one sample.
- Real producer output: five Apache-2.0 documents from the ODF Toolkit
  (`odfdom/src/test/resources/test-input/`) are committed under
  `test/fixtures/real` with source, license and SHA-256 recorded in that
  directory's README. They are LibreOffice 6.1 `character-styles.odt`, StarOffice
  8 `compdocfileformat.odt` (21 tables, 29 lists, spans, an embedded image),
  a third-party `default_namespace.ods` (19 sheets, default XML namespace,
  float, boolean and date cells), OpenOffice.org 3.2
  `XPathTest-foreignPrefix.odp` (non-standard `daisy`, `prefixOne` and
  `prefixTwo` prefixes) and OpenOffice.org 3.0 `presentationWithEmbedDoc.odp`
  (embedded chart objects). Three Node tests and one browser check cover them
  and no parser defects surfaced. The embedded-object deck confirmed the
  intended degradation: its frames hold `<draw:text-box/>` and image targets
  that are absent from the archive, so those slides render empty instead of
  throwing.
- `AGENTS.md` now allows those provenance-tracked files as the one exception to
  the in-memory fixture rule.
- CPU profile of the 5 MB browser benchmark (CDP sampling at 100 µs, three runs
  per engine), with the phase split measured separately. ODT (0.09 MB
  container / 5.00 MB XML): 15 ms decompression, 62 ms native XML parse,
  135–151 ms per run. ODS (0.07 / 4.00 MB): 13 ms, 112 ms, 200–211 ms. ODP
  (0.07 / 4.00 MB): 13 ms, 121 ms, 232–259 ms. Native `parseFromString` is
  33–43% of samples and garbage collection 13–20%; the largest single function
  of ours is about 12%, and the rest is split across many small frames. For ODS
  and ODP, native parsing plus decompression alone (125 ms and 134 ms) is most
  of the 150 ms budget, so the target is unreachable without leaving the DOM
  parser behind. That position, and the unchanged 15 KB size gap, are now
  recorded as decisions in this history rather than open work.
- Suite size after this pass: 116 Node tests and 15 browser checks.

### Direct-load bundles and mirrors

- Tracked `packages/*/dist` and removed `dist/` from `.gitignore`. The built
  bundles are now part of the repository, which lets GitHub Pages serve them
  from `main` and lets jsDelivr mirror the same files without an npm release.
- Documented both URLs per engine on the landing page, in `README.md`, in each
  package README and in `llms.txt`, plus a dynamic-import fallback that tries
  jsDelivr before GitHub Pages. The page FAQ and `downloadUrl` structured data
  cover the no-build path.
- `@main` is the documented default; a commit SHA or tag gives a frozen copy.
  The build and smoke scripts still run against `dist`, so the committed files
  stay the tested artifacts.
- Verified after publication: all six bundle URLs return 200 with
  `application/javascript` and `access-control-allow-origin: *`, and the served
  bytes match the committed files byte for byte. A cross-origin dynamic import
  from `example.com` in Chrome loaded all three engines from both hosts and
  parsed a real `.odt` fixture through the jsDelivr bundle.

### GitHub Pages landing page

- Added a standalone landing page at the repository root (`index.html`,
  `assets/site.css`, `assets/favicon.svg`, `assets/og.png`). GitHub Pages is
  configured to serve `main` `/`, so a root page is the correct location.
- Added `.nojekyll` so Pages serves the hand-written page directly instead of
  rendering `README.md` through Jekyll. `robots.txt`, `sitemap.xml` and
  `llms.txt` cover crawlers and answer engines.
- SEO/AEO: canonical URL, Open Graph and Twitter metadata, one H1, descriptive
  headings, a visible FAQ whose questions match the `FAQPage` JSON-LD, and
  `WebSite` plus `ItemList`/`SoftwareApplication` structured data. The 1200×630
  social card is generated from the same type and palette as the page.
- The page explains the three engines, API, source-build install (the packages
  are not on npm yet), the native-API approach, a cautious comparison with
  all-in-one office toolkits, measured Chrome and bundle numbers, and the known
  limitations. Claims match `README.md` and `history.md`.
- Verified in Chrome at 1440px and 390px, light and dark schemes: no horizontal
  overflow, no console errors, local assets load. JSON-LD parses and its FAQ
  matches the eight visible questions.

### Real-browser validation and refinement

- Added `test/browser/` and `scripts/browser.mjs`: a 13-check conformance suite
  and a 5 MB parse benchmark that load the built `dist` bundles in headless
  Chrome through playwright-core (a dev dependency). `npm run test:browser` and
  `npm run bench:browser` are standalone entry points, and `npm run check` now
  runs the suite. It covers Uint8Array/Blob/File input, rendered DOM structure,
  image Blob URL fetching and revocation, typed cells, slide geometry, hidden
  notes, escaped Markdown and tagged error codes against the real browser APIs.
- Browser testing exposed a real parser bug: Chrome keeps the partially parsed
  document and inserts `<parsererror>` as the root's first child, so `parseXML`
  accepted malformed `content.xml` silently. jsdom had masked it by replacing
  the document element with the parsererror. `parseXML` now detects both shapes
  plus Chrome's XHTML error page.
- Browser speed work: style indexing walks only `office:styles`,
  `office:automatic-styles` and `office:master-styles` instead of every body
  element; each element's attributes are indexed once and cached in a WeakMap;
  the ODT/ODS/ODP hot loops follow child pointers instead of allocating arrays;
  text-only runs use `textContent`; ODP stops deep-searching text frames for
  images; repeated cells/rows are copied only when the counter actually repeats.
- Browser medians on headless Chrome 155 (5 MB XML, one warm-up plus seven runs
  with a forced collection between): ODT 122–128 ms, ODS 194–195 ms, ODP
  196–201 ms. ODT meets the PRD's 150 ms target; ODS and ODP do not, and native
  XML parsing is now 35–47% of their samples. Node + jsdom is 949 / 1435 /
  1461 ms for the same fixtures.
- Accuracy: `table:table-header-columns` is now traversed, so column widths
  and styles are read from LibreOffice's header-column groups.
- Size: 23.35 / 8.97 KB (ODT), 17.17 / 7.05 KB (ODS) and 18.78 / 7.69 KB (ODP),
  slightly below the previous 23.55 / 17.19 / 18.82 KB despite the new parser
  and cache code. The space came from shorter diagnostics, redundant CSS rules
  and a smaller ZIP entry record.
- Verification: 113 Node tests and 13 browser checks pass; `npm run check` is
  green.

### Size, speed and accuracy refinement

- Traversal is now child-pointer based. A CPU profile of the 5 MB benchmark
  showed `getChildElements` and `getAttribute` dominating our own frames because
  jsdom proxies `NodeList` and `NamedNodeMap`; a microbenchmark measured
  `firstChild`/`nextSibling` walks about 8x faster than
  `Array.from(childNodes).filter(...)` and `getAttributeNames()` about 6x faster
  than an `attributes.item(i)` loop. `packages/core/src/xml.js` and
  `packages/core/src/styles.js` now use both, and the ODT inline parser follows
  child pointers directly.
- ODS cell parsing reads the typed value, spans and style once per element
  instead of once per `number-columns-repeated` iteration, and rows/cells are
  only deep-copied when a repeat counter actually repeats them.
- Median benchmark (5 MB XML, 3 runs, Node 20 + jsdom): ODT 1592 -> 959 ms,
  ODS 4345 -> 1628 ms, ODP 4028 -> 1507 ms (40% / 63% / 63% faster). The
  remaining time is jsdom's own XML parser and tree construction; the largest
  remaining function of ours is about 3% of samples. The 150 ms target is still
  not met and browser timing is still unmeasured.
- Bundles shrank slightly despite the extra speed work: 23.67 -> 23.55 KB
  (ODT), 17.21 -> 17.19 KB (ODS), 18.86 -> 18.82 KB (ODP). ODT regained
  roughly 0.45 KB of headroom under the 24 KB regression cap.
- Accuracy: a literal `fo:text-decoration` attribute is now passed through
  (the PRD lists it; only the underline/strike attributes were read before),
  and the ODT Markdown/plain-text table flattener keeps row-span columns
  occupied through the full span instead of releasing them one row early, so
  spanned rows no longer shift a column left.
- Verification: 112 tests pass, `npm run check` is green, and the dist smoke
  test still parses all three formats.

### Test-suite hardening and bug fixes

Expanded the suite from 34 to 110 tests. New coverage lives in
`packages/core/test/{xml,units,media,log,html,print}.test.js`, the engine
`*-edge.test.js` files and `test/integration.test.js`.

Real defects found and fixed:

- The ZIP reader could accept an EOCD signature inside the archive comment and
  then crash. Candidates are now validated against the declared comment
  length.
- A corrupt Central Directory header could throw a raw `RangeError`; it now
  returns `TRUNCATED_ZIP`.
- Corrupt deflate data leaked a `TypeError`; it now returns `CORRUPT_DEFLATE`
  with the entry name.
- `textOf` ignored `<text:s>`, `<text:tab>` and `<text:line-break>`, so ODS cell
  text and ODP slide text lost spacing. It now expands them.
- Pretty-printed `content.xml` leaked indentation spaces into ODT headings and
  paragraphs. Inline runs are trimmed at block edges.
- A heading that relied on its style name (`Heading_20_1`, ODF's encoding of
  "Heading 1") was read as level 2. Style names are decoded before matching.
- Missing `office:value` on a float or currency cell became `0` because
  `Number(null)` is zero. It is now `null`.
- A trailing typed cell with text but no numeric value was trimmed as empty.
  `isEmptyCell` now checks the cell type instead of the value alone.
- An ODS sheet named `__proto__` disappeared because sheets used `{}`.
  Sheets now use a null-prototype map.
- A blank spreadsheet row inside a row span emitted a full-width cell and
  shifted the grid. It now skips occupied columns.
- ODP text boxes dropped `<text:h>` headings. They are parsed as paragraphs.
- ODP Markdown did not escape metacharacters. It now escapes like ODT.
- Re-adding the same picture path leaked a second Blob URL. Media additions are
  deduplicated.
- ODT plain text rendered ordered lists with bullet markers. It now numbers
  them.
- Spreadsheet boolean cells accept `1` as true, matching XML boolean values.

Verification: 110 tests pass, `npm run check` is green, and the dist smoke test
parses all three formats. Bundle sizes after the fixes are 23.59 / 8.98 KB
(ODT), 18.92 / 7.66 KB (ODS) and 18.79 / 7.70 KB (ODP), so the ODT bundle now
has only 0.4 KB of headroom under the regression cap.

### Size and performance pass

- Split page/master/list indexing (`addLayoutStyles`) out of the base style
  cascade, so the spreadsheet engine tree-shakes page geometry and unit
  conversion. ODS dropped from 18.92 KB to 17.21 KB.
- Collapsed the media resolver from three parallel stores to one map.
- Removed the superlinear whole-document `getElementsByTagName('*')` scans.
  jsdom returns a live HTMLCollection whose proxy access made style indexing
  quadratic: 1 MB of ODT XML took 2.17 s before and 0.40 s after. The XML
  helpers now traverse child nodes recursively and short-circuit on the first
  match. This was the blocker that made the benchmark time out.
- Added `scripts/bench.mjs` and `npm run bench`: five megabytes of XML per
  engine, three runs, median reported. Results on Node 20 + jsdom are ODT
  1.59 s, ODS 4.35 s and ODP 4.03 s. The 150 ms PRD target is **not met**; these
  are conservative Node numbers, and browser timing is still unmeasured.

Final sizes: 23.67 / 9.03 KB (ODT), 17.21 / 7.04 KB (ODS) and 18.86 / 7.76 KB
(ODP). The 15 KB / 5 KB target remains unmet; with every specified feature in
place it is not reachable by minification alone.

### Initial implementation

Built the suite from the PRD in `PRD-OpenDocument Engine Suite.md`. The PRD's
work breakdown stops mid-Phase 2, so the full feature specs in Sections 1 and 2
were treated as the contract and the package layout mirrors the PRD.

- **Workspace.** npm workspaces with a `pnpm-workspace.yaml` for pnpm users.
  pnpm was not installed in the environment, so npm is the verified path.
  `packages/core` is internal and bundled into each engine by esbuild.
- **Core.** Central-directory ZIP reader over `DecompressionStream`; XML
  traversal by `localName`; style/default/parent/automatic/master cascade;
  page-layout extraction; Blob media with teardown; tagged loggers; HTML shell
  and iframe print bridge.
- **odt-engine.** `office:text` into headings, paragraphs, styled runs, links,
  tabs/spaces/line breaks, nested ordered/bulleted lists, tables with row and
  column spans, and images. HTML uses physical `@page` dimensions; Markdown and
  plain text are derived from the same AST.
- **ods-engine.** Typed cells, formulas, repeat caps (10,000 rows, 1,024
  columns), covered-cell placeholders, column widths, and trimming of trailing
  blank rows and cells. Exports are matrix, RFC 4180 CSV, header-keyed JSON and
  landscape HTML.
- **odp-engine.** Ordered `draw:page` slides, frame geometry from SVG
  attributes or graphic styles, text boxes with bullet paragraphs, images,
  shapes, master-page backgrounds and a 4:3 fallback. HTML positions frames as
  slide-relative percentages and prints one slide per page; Markdown produces a
  slide transcript.
- **Fixtures.** A CRC-correct ZIP writer that emits stored and deflated entries,
  plus builders for content/styles/meta/manifest and `Pictures/`. Tests parse
  real containers; nothing is mocked at the ZIP or XML layer.
- **Build.** Minified ESM bundles plus declarations, a `dist` smoke test, and a
  TypeScript check of the declarations. `dist/` is ignored by git.

Initial verification: 34 tests passing, `npm run check` green, declarations
clean under `tsc --noEmit`.

### Decisions and fixes

- Row spans were releasing occupied columns one row early in both table
  renderers. Fixed by tracking the occupied grid through the full row lifetime.
- The PRD size target (15 KB / 5 KB) is **not met**: 22.6 / 8.7 KB (ODT),
  18.4 / 7.4 KB (ODS), 18.1 / 7.5 KB (ODP). The build reports the gap and
  enforces a 24 KB / 10 KB regression cap instead of failing every release.
- CSS whitespace in assertions was normalized rather than changing renderer
  output.

### Known limitations at the end of this entry

No editing. ODF only. ZIP64 rejected. Footnotes/comments skipped in ODT.
Formulas preserved but not evaluated. Slide media/animation not rendered.
No real LibreOffice fixture or parse benchmark yet.

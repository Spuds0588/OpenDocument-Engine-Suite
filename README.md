# OpenDocument Engine Suite

Live page and documentation: **[spuds0588.github.io/OpenDocument-Engine-Suite](https://spuds0588.github.io/OpenDocument-Engine-Suite/)**

Three zero-dependency JavaScript engines for reading OpenDocument files in the browser and turning them into HTML, print-ready PDF output, Markdown, CSV or JSON.

| Package | Handles | Main exports |
| --- | --- | --- |
| [`odt-engine`](packages/odt-engine) | OpenDocument Text (`.odt`) | `parseODT`, `toAST`, `toHTML`, `toMarkdown`, `toPlainText` |
| [`ods-engine`](packages/ods-engine) | OpenDocument Spreadsheet (`.ods`) | `parseODS`, `toAST`, `toMatrix`, `toCSV`, `toJSON`, `toHTML` |
| [`odp-engine`](packages/odp-engine) | OpenDocument Presentation (`.odp`) | `parseODP`, `toAST`, `toHTML`, `toMarkdown` |

Take only the format you need. Every engine is self-contained, tree-shakeable and has an empty `dependencies` map. There is no install step and no build step: the tested ESM bundle is committed in each package's `dist/`.

**Load it from a URL.** jsDelivr mirrors the repository; GitHub Pages serves the same bytes:

| Package | jsDelivr | GitHub Pages |
| --- | --- | --- |
| `odt-engine` | [dist/index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@main/packages/odt-engine/dist/index.js) | [mirror](https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/odt-engine/dist/index.js) |
| `ods-engine` | [dist/index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@main/packages/ods-engine/dist/index.js) | [mirror](https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/ods-engine/dist/index.js) |
| `odp-engine` | [dist/index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@main/packages/odp-engine/dist/index.js) | [mirror](https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/odp-engine/dist/index.js) |

```js
import { parseODT } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@main/packages/odt-engine/dist/index.js';
```

**Or copy one engine into your project** with a single command. This unpacks `odt-engine/` (bundle, source, tests, package manifest) into the current directory, with no clone and no build:

```bash
curl -sL https://github.com/Spuds0588/OpenDocument-Engine-Suite/archive/refs/heads/main.tar.gz | tar -xz --strip-components=2 OpenDocument-Engine-Suite-main/packages/odt-engine
```

```js
import { parseODT } from './odt-engine/dist/index.js';
```

Swap `odt-engine` for `ods-engine` or `odp-engine` in either path. `@main` tracks the latest build; a commit SHA or tag freezes a copy.

## Quick start

```js
import { parseODT } from './odt-engine/dist/index.js';

const file = document.querySelector('input[type=file]').files[0];
const doc = await parseODT(file);

document.body.innerHTML = doc.toHTML(); // styled, print-ready markup
console.log(doc.toMarkdown());
doc.destroy(); // revoke Blob URLs for embedded images
```

Spreadsheets and presentations follow the same shape:

```js
import { parseODS } from './ods-engine/dist/index.js';
const workbook = await parseODS(file);
workbook.toJSON('Sales');   // records keyed by the header row
workbook.toCSV('Sales');    // RFC 4180, CRLF records
workbook.toHTML();          // landscape, one section per sheet
```

```js
import { parseODP } from './odp-engine/dist/index.js';
const deck = await parseODP(file);
deck.toHTML();              // absolutely positioned slides, one per printed page
deck.toMarkdown();          // slide transcript
```

## Print to PDF

Each `toHTML()` returns a complete HTML document with CSS Paged Media rules (`@page`, page breaks, physical page dimensions). Render it in an isolated iframe and let the browser's print dialog create the PDF:

```js
import { parseODT, triggerPrintToPDF } from './odt-engine/dist/index.js';

const doc = await parseODT(file);
triggerPrintToPDF(doc.toHTML());
```

No PDF library, canvas layout engine or server is involved.

## How it works

- **ZIP**: the Central Directory is read with `DataView`; entries are inflated through `DecompressionStream('deflate-raw')`. No zip dependency.
- **XML**: every lookup matches on `localName`, so differing namespace prefixes in LibreOffice and third-party exporters do not break parsing.
- **Styles**: default, named, automatic and parent styles are resolved into plain CSS declarations. Page layouts feed `@page`.
- **Media**: pictures become Blob URLs, tracked so `destroy()` can revoke them.
- **Diagnostics**: tagged logs (`[ODF:Zip]`, `[ODF:Styles]`, `[ODF:Parse]`, ...) are silent by default; call `setLogLevel('debug')` to trace a parse.

## AST first

`toAST()` returns plain JSON for every format: headings, styled runs, nested lists, tables with spans, typed cells and formulas, or positioned slide frames. See each package README for the exact shape.

## Repository layout

```
index.html         GitHub Pages landing page
assets/            site stylesheet, favicon and social card
packages/
  core/            internal shared runtime, statically bundled into each engine
  odt-engine/      text parser + HTML/Markdown/plain-text renderers
  ods-engine/      spreadsheet parser + matrix/CSV/JSON/HTML renderers
  odp-engine/      presentation parser + deck HTML/Markdown renderers
  */dist/          committed ESM bundles served by GitHub Pages and jsDelivr
scripts/build.mjs  standalone minified bundles + declaration files
scripts/browser.mjs real-Chrome suite driver and benchmark
test/browser/      browser conformance suite and report page
test/helpers/      ZIP writer, ODF fixture and shared benchmark builders
```

## Development

```bash
npm install
npm test              # 116 node:test cases for core and all three engines
npm run test:browser  # build, then 15 checks in headless Chrome
npm run build         # minified standalone ESM bundles in packages/*/dist
npm run bench         # 5 MB parse benchmark (Node + jsdom)
npm run bench:browser # 5 MB parse benchmark in headless Chrome
npm run check         # tests, build, dist smoke test and browser suite
```

Tests build real `.odt`, `.ods` and `.odp` containers in memory (including deflated entries and repeat counters) and run the parsers against them, plus a handful of producer-written documents in `test/fixtures/real/` (see its README for provenance and checksums). The Node suite uses jsdom for `DOMParser`; the browser suite loads the built bundles in Chrome and checks the real DOM, Blob URL lifecycle and parse speed. `npm run check` therefore needs Chrome installed (or `CHROME_PATH` set); `playwright-core` drives it and is a dev dependency only. See [AGENTS.md](AGENTS.md) for conventions, [todo.md](todo.md) for open work and [history.md](history.md) for what changed.

## Browser support

Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+ and any runtime with `DecompressionStream('deflate-raw')`, `DOMParser` and Blob URLs. Node.js 18+ works when `DOMParser` is polyfilled (the test suite uses jsdom).

## Bundle size

The product requirements set a target of 15 KB minified / 5 KB gzipped per engine. Current builds are **23.35 KB / 8.97 KB** (ODT), **17.17 KB / 7.05 KB** (ODS) and **18.78 KB / 7.69 KB** (ODP), so the target is **not yet met**. `npm run build` reports the gap for every engine and enforces a 24 KB / 10 KB regression cap; ODT has about 0.65 KB of headroom. The attribute cache and Chrome malformed-XML handling added code, but compacting diagnostics and redundant CSS still left every minified bundle slightly below its previous size (23.55 / 17.19 / 18.82 KB). Reaching 15 KB with the current feature set would require dropping parser or renderer features, which needs a product decision.

## Performance

`npm run bench:browser` runs the real-browser benchmark: roughly 5 MB of XML per engine, one warm-up parse, then seven timed parses with a forced collection between runs; the median is reported. On headless Chrome 155 the current numbers are **122–128 ms for ODT, 194–195 ms for ODS and 196–201 ms for ODP** against the PRD's 150 ms target. ODT meets the target; ODS and ODP do not, and a CPU profile shows why: with the container already in memory, decompression takes 13–15 ms and Chrome's own `DOMParser` takes 62 ms (ODT), 112 ms (ODS) and 121 ms (ODP), which is 33–43% of each run. Native parsing and decompression alone are 125 ms (ODS) and 134 ms (ODP) of the 150 ms budget, so the remaining gap needs a streaming, non-DOM parser rather than another traversal tweak. `todo.md` records the decision.

`npm run test:browser` also measures memory: 40 parse + `toHTML` + `destroy` cycles over an 18 KB document with 120 images retain **about 380 KB** of heap, and the last cycle's image Blob URLs are revoked, so repeated parsing and teardown return to a flat baseline.

`npm run bench` keeps the conservative Node 20 + jsdom measurement for comparison: about **949 ms (ODT), 1435 ms (ODS) and 1461 ms (ODP)** for three runs. jsdom is roughly 7x slower than Chrome on these fixtures, so browser numbers are the ones that matter for frontend use.

The browser numbers come from indexing styles only in their ODF containers instead of scanning the whole body, caching each element's attributes once per parse, following child pointers in the ODT/ODS/ODP hot loops, using `textContent` for text-only runs, skipping deep image searches for text frames, and copying repeated cells only when a repeat counter actually repeats. The first browser measurement was about 151 / 304 / 329 ms (three runs, no warm-up); the harness has since gained warm-up and GC control, so treat the delta as directional rather than a controlled A/B.

## Known limitations

- Parsers only: no editing, cursor handling or spell check.
- ODF XML only; legacy binary `.doc`, `.xls`, `.ppt` are out of scope.
- ZIP64 archives (over 4 GB or 65,535 entries) are rejected with a tagged error.
- Footnotes and comments are not yet part of the ODT AST.
- Spreadsheet formulas are preserved as written, not evaluated.
- Slide animation, media and transitions are not rendered.
- The 5 MB / 150 ms parse target is met by ODT in Chrome (~125 ms) but not by ODS (~195 ms) or ODP (~200 ms); under Node + jsdom all three miss it.
- The 15 KB / 5 KB bundle target is not met while keeping every specified feature.

## License

MIT

# OpenDocument Engine Suite

Three zero-dependency JavaScript engines for reading OpenDocument files in the browser and turning them into HTML, print-ready PDF output, Markdown, CSV or JSON.

| Package | Handles | Main exports |
| --- | --- | --- |
| [`odt-engine`](packages/odt-engine) | OpenDocument Text (`.odt`) | `parseODT`, `toAST`, `toHTML`, `toMarkdown`, `toPlainText` |
| [`ods-engine`](packages/ods-engine) | OpenDocument Spreadsheet (`.ods`) | `parseODS`, `toAST`, `toMatrix`, `toCSV`, `toJSON`, `toHTML` |
| [`odp-engine`](packages/odp-engine) | OpenDocument Presentation (`.odp`) | `parseODP`, `toAST`, `toHTML`, `toMarkdown` |

Install only the format you need. Every package is self-contained, tree-shakeable and has an empty `dependencies` map.

```bash
npm install odt-engine
# or
npm install ods-engine
npm install odp-engine
```

## Quick start

```js
import { parseODT } from 'odt-engine';

const file = document.querySelector('input[type=file]').files[0];
const doc = await parseODT(file);

document.body.innerHTML = doc.toHTML(); // styled, print-ready markup
console.log(doc.toMarkdown());
doc.destroy(); // revoke Blob URLs for embedded images
```

Spreadsheets and presentations follow the same shape:

```js
import { parseODS } from 'ods-engine';
const workbook = await parseODS(file);
workbook.toJSON('Sales');   // records keyed by the header row
workbook.toCSV('Sales');    // RFC 4180, CRLF records
workbook.toHTML();          // landscape, one section per sheet
```

```js
import { parseODP } from 'odp-engine';
const deck = await parseODP(file);
deck.toHTML();              // absolutely positioned slides, one per printed page
deck.toMarkdown();          // slide transcript
```

## Print to PDF

Each `toHTML()` returns a complete HTML document with CSS Paged Media rules (`@page`, page breaks, physical page dimensions). Render it in an isolated iframe and let the browser's print dialog create the PDF:

```js
import { parseODT, triggerPrintToPDF } from 'odt-engine';

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
packages/
  core/            internal shared runtime, statically bundled into each engine
  odt-engine/      text parser + HTML/Markdown/plain-text renderers
  ods-engine/      spreadsheet parser + matrix/CSV/JSON/HTML renderers
  odp-engine/      presentation parser + deck HTML/Markdown renderers
scripts/build.mjs  standalone minified bundles + declaration files
test/helpers/      ZIP writer and ODF fixture builders used by the suites
```

## Development

```bash
npm install
npm test          # 110 node:test cases for core and all three engines
npm run build     # minified standalone ESM bundles in packages/*/dist
npm run bench     # 5 MB parse benchmark for all three engines
npm run check     # tests, build and dist smoke test
```

Tests build real `.odt`, `.ods` and `.odp` containers in memory (including deflated entries and repeat counters) and run the parsers against them. jsdom provides `DOMParser` outside the browser; it is a dev dependency only. See [AGENTS.md](AGENTS.md) for conventions, [todo.md](todo.md) for open work and [history.md](history.md) for what changed.

## Browser support

Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+ and any runtime with `DecompressionStream('deflate-raw')`, `DOMParser` and Blob URLs. Node.js 18+ works when `DOMParser` is polyfilled (the test suite uses jsdom).

## Bundle size

The product requirements set a target of 15 KB minified / 5 KB gzipped per engine. Current minified builds are 23.67 KB (ODT), 17.21 KB (ODS) and 18.86 KB (ODP), or 9.03 KB / 7.04 KB / 7.76 KB gzipped, so the target is **not yet met**. `npm run build` reports the gap for every engine and enforces a 24 KB / 10 KB regression cap. Splitting page/list styling out of the spreadsheet bundle cut ODS by about 9%; reaching 15 KB with the current feature set would require dropping parser or renderer features, which needs a product decision.

## Performance

`npm run bench` parses roughly 5 MB of document XML in each engine and reports the median of three runs. On Node 20 with jsdom (a conservative environment, not a browser) the current numbers are about 1.6 s for ODT, 4.3 s for ODS and 4.0 s for ODP, against the PRD's 150 ms target. The original superlinear lookup was removed: indexing a 1 MB ODT content tree dropped from 2.17 s to 0.40 s. Browser timing has not been measured yet.

## Known limitations

- Parsers only: no editing, cursor handling or spell check.
- ODF XML only; legacy binary `.doc`, `.xls`, `.ppt` are out of scope.
- ZIP64 archives (over 4 GB or 65,535 entries) are rejected with a tagged error.
- Footnotes and comments are not yet part of the ODT AST.
- Spreadsheet formulas are preserved as written, not evaluated.
- Slide animation, media and transitions are not rendered.
- The 5 MB / 150 ms parse target is not met under Node with jsdom; browser timing is unmeasured.
- The 15 KB / 5 KB bundle target is not met while keeping every specified feature.

## License

MIT

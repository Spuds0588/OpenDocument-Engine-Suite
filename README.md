# OpenDocument Engine Suite

Live documentation and API reference: **[spuds0588.github.io/OpenDocument-Engine-Suite](https://spuds0588.github.io/OpenDocument-Engine-Suite/)**

Three libraries that read OpenDocument files directly in the browser and hand back HTML, print-ready PDF output, Markdown, CSV or JSON. No server, no LibreOffice, no dependencies.

| Library | Reads | Main exports |
| --- | --- | --- |
| `odt-engine` | OpenDocument Text (`.odt`) | `parseODT`, `toAST`, `toHTML`, `toMarkdown`, `toPlainText` |
| `ods-engine` | OpenDocument Spreadsheet (`.ods`) | `parseODS`, `toAST`, `toMatrix`, `toCSV`, `toJSON`, `toHTML` |
| `odp-engine` | OpenDocument Presentation (`.odp`) | `parseODP`, `toAST`, `toHTML`, `toMarkdown` |

Each library is one self-contained ES module of 17–23 KB with an empty dependency map. Nothing to install, nothing to compile, nothing to configure.

## Use it

One file per library, no install and no build. Two builds ship for each: `dist/global.js` for a plain `<script src>` tag (it defines `window.ODT`, `window.ODS` or `window.ODP`), and `dist/index.js` for `import`.

| Library | `<script src>` build | Module build |
| --- | --- | --- |
| `odt-engine` | [global.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/global.js) → `ODT` | [index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/index.js) |
| `ods-engine` | [global.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@ods-engine-v1.0.0/packages/ods-engine/dist/global.js) → `ODS` | [index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@ods-engine-v1.0.0/packages/ods-engine/dist/index.js) |
| `odp-engine` | [global.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odp-engine-v1.0.0/packages/odp-engine/dist/global.js) → `ODP` | [index.js](https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odp-engine-v1.0.0/packages/odp-engine/dist/index.js) |

The jsDelivr URLs are frozen at the v1.0.0 release; GitHub Pages serves the same files from the current `main` build (`https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/odt-engine/dist/global.js`). Swap the release tag for `@main` on jsDelivr to follow the newest build.

### Script tag

Nothing else needed: one `<script src>` and the global is there.

```html
<script src="https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/global.js"></script>
<script>
  ODT.parseODT(file).then((doc) => {
    document.querySelector('#preview').innerHTML = doc.toHTML();
  });
</script>
```

### ES module

```js
import { parseODT } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/index.js';
```

That file also works with `import()`, Vite, webpack or any other ESM-aware bundler. In an HTML page, a module script needs `type="module"` (and is deferred, so the DOM is ready):

```html
<script type="module">
  import { parseODT } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/index.js';

  const doc = await parseODT(file);
</script>
```

### Copy the file into your project

One command downloads the whole library — pick the build that matches how you load it:

```bash
curl -sLo odt-engine.js https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/global.js
```

```html
<script src="./odt-engine.js"></script>
```

```bash
curl -sLo odt-engine.js https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/index.js
```

```js
import { parseODT } from './odt-engine.js';
```

That is the complete integration: no package manager, no build step, no files to keep in sync. TypeScript declarations live next to the module build (`dist/index.d.ts`).

## Quick start

```js
import { parseODT } from './odt-engine.js';

const file = document.querySelector('input[type=file]').files[0];
const doc = await parseODT(file);

document.body.innerHTML = doc.toHTML(); // styled, print-ready markup
console.log(doc.toMarkdown());
doc.destroy(); // revoke Blob URLs for embedded images
```

Spreadsheets and presentations follow the same shape:

```js
import { parseODS } from './ods-engine.js';
const workbook = await parseODS(file);
workbook.toJSON('Sales');   // records keyed by the header row
workbook.toCSV('Sales');    // RFC 4180, CRLF records
workbook.toHTML();          // landscape, one section per sheet
```

```js
import { parseODP } from './odp-engine.js';
const deck = await parseODP(file);
deck.toHTML();              // absolutely positioned slides, one per printed page
deck.toMarkdown();          // slide transcript
```

## Print to PDF

Each `toHTML()` returns a complete HTML document with CSS Paged Media rules (`@page`, page breaks, physical page dimensions). Render it in an isolated iframe and let the browser's print dialog create the PDF:

```js
import { parseODT, triggerPrintToPDF } from './odt-engine.js';

const doc = await parseODT(file);
triggerPrintToPDF(doc.toHTML());
```

No PDF library, canvas layout engine or server is involved.

## What the parsers keep

`toAST()` returns plain JSON for every format: heading levels, styled runs, nested lists, tables with row and column spans, typed cells with formulas, or slide frames with geometry. The renderers read that AST and never re-parse the XML.

- **ZIP**: the Central Directory is read with `DataView`; entries are inflated through `DecompressionStream('deflate-raw')`.
- **XML**: every lookup matches on `localName`, so differing namespace prefixes between producers do not break parsing.
- **Styles**: default, named, automatic and parent styles are resolved into flat CSS declarations; page layouts feed `@page`.
- **Media**: pictures become Blob URLs, tracked so `destroy()` can revoke them.
- **Diagnostics**: tagged logs (`[ODF:Zip]`, `[ODF:Styles]`, `[ODF:Parse]`, ...) stay silent until you call `setLogLevel('debug')`.

## Browser support

Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+ and any runtime with `DecompressionStream('deflate-raw')`, `DOMParser` and Blob URLs. Node.js 18+ works when `DOMParser` is provided (the test suite uses jsdom).

## Size and speed

| Library | Minified | Gzipped | 5 MB parse, Chrome 155 |
| --- | --- | --- | --- |
| `odt-engine` | 23.35 KB | 8.97 KB | 122–128 ms |
| `ods-engine` | 17.17 KB | 7.05 KB | 194–195 ms |
| `odp-engine` | 18.78 KB | 7.69 KB | 196–201 ms |

Those are the module builds; the script-tag builds are 0.4–0.5 KB larger (23.82 / 17.64 / 19.25 KB).

Measured on roughly 5 MB of document XML per library: one warm-up parse, then seven timed parses in headless Chrome with a forced collection between runs; the median is shown. Most of the remaining time is the browser's own XML parser (112–121 ms of an ODS or ODP run, 62 ms of an ODT run); decompression is 13–15 ms. Under Node 20 with jsdom the same fixtures take 0.95 / 1.44 / 1.46 s, so the browser numbers are the ones that matter for a frontend.

Repeated use stays flat: after 40 parse, render and `destroy()` cycles over an 18 KB document with 120 images, retained heap moves by less than 1 MB (usually a few hundred kilobytes, sometimes below the starting point) and the image Blob URLs are revoked every cycle.

## Known limitations

- Reading only: no editing, cursor handling or spell check.
- OpenDocument only, as written by LibreOffice, Apache OpenOffice, StarOffice and third-party producers. No DOCX, XLSX, PPTX or legacy binary formats.
- ZIP64 archives (over 4 GB or 65,535 entries) are rejected with a tagged error.
- Footnotes and comments are not part of the ODT AST.
- Spreadsheet formulas are preserved as written, not evaluated.
- Slide animation, media and transitions are not rendered.

## Working on the source

The released artifacts are the committed `dist/` bundles; `packages/*/src` holds the readable source, and the internal `packages/core` runtime is inlined into every bundle at build time.

```bash
npm install
npm run check         # 116 tests, build, dist smoke test and 16 browser checks in Chrome
npm run bench         # 5 MB parse benchmark (Node + jsdom)
npm run bench:browser # 5 MB parse benchmark in headless Chrome
```

[history.md](history.md) records what changed, [AGENTS.md](AGENTS.md) holds repo conventions, and [index.html](index.html) is the landing page served by GitHub Pages.

## License

MIT

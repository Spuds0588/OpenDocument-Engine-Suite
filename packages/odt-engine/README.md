# odt-engine

Parse an `.odt` file entirely in the browser. Zero dependencies, no server upload, no LibreOffice binary. Turn OpenDocument Text into a JSON AST, styled HTML, a print-ready PDF via `window.print()`, Markdown or plain text.

Keywords: javascript parse odt, browser odt to pdf, convert odt to html in the browser, pure js libreoffice writer parser, odt to markdown.

## Use it

One file, no install. Two builds ship: `global.js` for a plain script tag (it defines `window.ODT`) and `index.js` for `import`.

**Script tag** — nothing else needed:

```html
<script src="https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/global.js"></script>
<script>
  const input = document.querySelector('input[type=file]');
  input.addEventListener('change', () => {
    ODT.parseODT(input.files[0]).then((doc) => {
      document.querySelector('#preview').innerHTML = doc.toHTML();
    });
  });
</script>
```

**ES module**:

```js
import { parseODT } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/index.js';
```

**Or copy the file into your project**:

```bash
curl -sLo odt-engine.js https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odt-engine-v1.0.0/packages/odt-engine/dist/global.js
```

```html
<script src="./odt-engine.js"></script>
```

GitHub Pages serves the same files: `https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/odt-engine/dist/global.js`. Swap the release tag for `main` to follow the newest build. Sizes: 23.35 KB minified / 8.97 KB gzipped for the module build, 23.82 KB for the script-tag build; types are in `dist/index.d.ts`.

## Quick start

```js
import { parseODT } from './odt-engine.js';

const input = document.querySelector('input[type=file]');
input.addEventListener('change', async () => {
  const doc = await parseODT(input.files[0]);

  document.querySelector('#preview').innerHTML = doc.toHTML();
  console.log(doc.meta.pageLayout); // { width: '21cm', height: '29.7cm', ... }
  console.log(doc.toMarkdown());

  doc.destroy(); // revoke Blob URLs when the preview is removed
});
```

`parseODT` accepts an `ArrayBuffer`, `Uint8Array`, `Blob` or `File`.

## PDF export

`toHTML()` emits a complete HTML document with `@page { size; margin }` rules sized from the document's ODF page layout. Pass it to the bundled iframe helper:

```js
import { parseODT, triggerPrintToPDF } from './odt-engine.js';

const doc = await parseODT(file);
triggerPrintToPDF(doc.toHTML()); // opens the browser print dialog
```

For print shops and headless pipelines, save the same HTML and let Chromium print it to PDF; page dimensions and margins come from the source document.

## API

| Member | Description |
| --- | --- |
| `parseODT(input, options?)` | Async parse. Resolves to an `ODTDocument`. |
| `doc.meta` | `{ format, title, pageLayout }` |
| `doc.body` | Block AST: headings, paragraphs, lists, tables |
| `doc.resources.images` | Map of archive paths to Blob URLs |
| `doc.toAST()` | The complete, JSON-safe AST |
| `doc.toHTML()` | Standalone HTML5 document with paged-media CSS |
| `doc.toMarkdown()` | CommonMark (GFM tables) |
| `doc.toPlainText()` | Unstructured text |
| `doc.destroy()` | Revokes every Blob URL created for images |
| `setLogLevel(level)` | `silent` / `error` / `warn` / `info` / `debug` |
| `triggerPrintToPDF(html, options?)` | Prints HTML in an off-screen iframe |

Logging is tagged and silent by default:

```
[ODF:Zip] Central Directory: 9 entries, ...
[ODF:Styles] ...
[ODF:Parse] AST built: 14 top-level blocks
```

## AST

```js
{
  meta: { format: 'odt', title: 'Report', pageLayout: { width: '21cm', ... } },
  body: [
    { type: 'heading', level: 1, style: 'Heading_20_1', text: 'Report', children: [...] },
    { type: 'paragraph', style: 'Standard', text: 'Hello world', children: [
      { type: 'text', content: 'Hello ' },
      { type: 'span', style: 'Bold', content: 'world', children: [...] },
    ] },
    { type: 'list', ordered: true, style: 'Numbering', items: [[ ...blocks ]] },
    { type: 'table', style: 'Table1', rows: [
      { style: '', cells: [{ colSpan: 2, rowSpan: 1, style: '', children: [...] }] },
    ] },
  ],
  resources: { images: { 'Pictures/logo.png': 'blob:...' } },
}
```

Text runs stay as inline nodes (`text`, `span`, `image`), so consumers can transform styling without reparsing HTML. Inline images carry their frame width and height.

## What it understands

- `<text:h>` headings with outline levels, `<text:p>` paragraphs and inline `<text:span>` runs.
- `<text:a>` links, tabs, explicit spaces, line breaks and bookmarks.
- Nested ordered and bullet lists, including list styles from `styles.xml`.
- Tables with repeated cells, column spans and row spans.
- `draw:frame`/`draw:image` pictures extracted to Blob URLs.
- Style inheritance through `style:parent-style-name`, default styles, automatic styles, page layouts and master pages.
- Metadata title from `meta.xml`.

## Performance and memory

Text is decompressed in memory with the native stream API, without a copy to local storage. The engine is designed for documents in the low-megabyte range. Images are the only persistent resource: call `destroy()` when a document is no longer displayed to release them.

## Limitations

- Reading and rendering only; no editing.
- Footnotes and comments are skipped in this release.
- ZIP64 archives are rejected.
- Node.js needs a `DOMParser` polyfill; browsers need none.

## License

MIT

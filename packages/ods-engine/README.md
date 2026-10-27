# ods-engine

Read `.ods` spreadsheets in the browser without SheetJS, a backend or a LibreOffice install. Typed cells, formulas, merged cells, column widths, CSV, JSON, a raw matrix and print-ready landscape HTML, all in a zero-dependency package.

Keywords: read ods file in browser, ods to json javascript, lightweight ods parser, convert libreoffice calc to csv frontend.

## Use it

One file, no install. Two builds ship: `global.js` for a plain script tag (it defines `window.ODS`) and `index.js` for `import`.

**Script tag** — nothing else needed:

```html
<script src="https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@ods-engine-v1.0.0/packages/ods-engine/dist/global.js"></script>
<script>
  const input = document.querySelector('input[type=file]');
  input.addEventListener('change', () => {
    ODS.parseODS(input.files[0]).then((workbook) => {
      document.querySelector('#preview').innerHTML = workbook.toHTML();
    });
  });
</script>
```

**ES module**:

```js
import { parseODS } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@ods-engine-v1.0.0/packages/ods-engine/dist/index.js';
```

**Or copy the file into your project**:

```bash
curl -sLo ods-engine.js https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@ods-engine-v1.0.0/packages/ods-engine/dist/global.js
```

```html
<script src="./ods-engine.js"></script>
```

GitHub Pages serves the same files: `https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/ods-engine/dist/global.js`. Swap the release tag for `main` to follow the newest build. Sizes: 17.17 KB minified / 7.05 KB gzipped for the module build, 17.64 KB for the script-tag build; types are in `dist/index.d.ts`.

## Quick start

```js
import { parseODS } from './ods-engine.js';

const workbook = await parseODS(file);

workbook.sheetNames;          // ['Sales', 'Notes']
workbook.sheet('Sales').rows; // typed cell objects
workbook.toMatrix('Sales');   // [['Product', 'Units'], ['Widget', 3]]
workbook.toCSV('Sales');      // RFC 4180 text
workbook.toJSON('Sales');     // [{ Product: 'Widget', Units: 3 }]
workbook.toHTML();            // printable landscape workbook
```

`parseODS` accepts an `ArrayBuffer`, `Uint8Array`, `Blob` or `File`.

## API

| Member | Description |
| --- | --- |
| `parseODS(input)` | Async parse. Resolves to an `ODSWorkbook`. |
| `workbook.meta` | `{ format: 'ods', sheetCount }` |
| `workbook.sheets` | Plain object of sheet name to `{ name, columns, rows }` |
| `workbook.sheetNames` | Sheet names in document order |
| `workbook.sheet(name?)` | `ODSTable`, defaults to the first sheet |
| `workbook.toAST()` | The complete spreadsheet AST |
| `workbook.toMatrix(name?)` | Raw 2D values, `null` for empty cells |
| `workbook.toCSV(name?, delimiter?)` | RFC 4180 CSV with CRLF records |
| `workbook.toJSON(name?)` | Records keyed by the first non-empty row |
| `workbook.toHTML()` | Complete landscape HTML document |
| `table.toMatrix()` / `.toCSV()` / `.toJSON()` / `.toHTML()` | Same operations scoped to one sheet |
| `setLogLevel(level)` | Tagged diagnostics, silent by default |

Headers are de-duplicated (`Name`, `Name_2`) and blank headers become `Column1`, `Column2`, so JSON output is always addressable.

## Cell typing

```js
{
  value: 9.99,
  rawText: '9.99',
  type: 'currency',        // string | float | date | boolean | currency | empty
  valueType: 'currency',   // original office:value-type
  formula: 'of:=B2*C2',    // present when the cell has one
  colSpan: 1,
  rowSpan: 1,
  style: 'ce1',
  covered: false,
}
```

- Floats, percentages and currencies become numbers (`valueType` keeps the distinction).
- Booleans become `true` / `false`.
- Dates keep the ODF date string in `value` (`2024-01-15`); `timestamp` is included when parseable.
- Times keep their display text and the original ISO duration in `time`.
- Covered cells from merged ranges stay in `rows` as `covered: true` placeholders so row arrays remain aligned with the visual grid.

## Print to PDF

`toHTML()` produces one `<section>` per sheet with `@page { size: A4 landscape; margin: 10mm }`, table rows that avoid splitting across pages, and page breaks between sheets. Send it through the browser print pipeline:

```js
import { parseODS, triggerPrintToPDF } from './ods-engine.js';

triggerPrintToPDF((await parseODS(file)).toHTML());
```

## Big sheets

LibreOffice pads files with `table:number-rows-repeated="1048576"` and thousands of empty columns. The parser caps row, column and repeat counters, drops trailing blank rows and cells, and keeps interior blank rows for alignment. The caps are exported as `LIMITS` from the package entry point.

## Limitations

- Formulas are preserved, never evaluated; no recalculation engine is included.
- Charts, pivot tables, conditional formats and cell comments are not rendered.
- Styles map to CSS for background, borders, padding, alignment and widths; number formats are not reformatted.
- ZIP64 archives are rejected.
- Node.js requires a `DOMParser` polyfill.

## License

MIT

# OpenDocument Engine Suite (ODT, ODS, ODP)
## Master Product Requirements Document, Implementation Guide, Task List, and AGENTS.md

---

# SECTION 1: PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1.1 Executive Summary & Problem Statement
Client-side web applications currently lack lightweight, zero-dependency, pure-JavaScript libraries capable of parsing OpenDocument Format (ODF) files (`.odt`, `.ods`, `.odp`) with high layout fidelity and extracting structured data for export (specifically PDF generation, CSV/data manipulation, and Markdown/text transformations). 

Existing solutions either require multi-megabyte C++ desktop binaries run server-side (headless LibreOffice), focus exclusively on Microsoft Office formats, or are monolithic bundles (like SheetJS) that only handle spreadsheets and carry prohibitive bundle sizes for lightweight frontend embed targets.

The **OpenDocument Engine Suite** solves this by delivering three independent, specialized, zero-dependency browser-native npm packages:
1. `odt-engine`: Specialized OpenDocument Text parser, layout renderer, and PDF/Markdown exporter.
2. `ods-engine`: Specialized OpenDocument Spreadsheet parser, grid calculation handler, and CSV/JSON/PDF exporter.
3. `odp-engine`: Specialized OpenDocument Presentation parser, slide layout engine, and visual deck/PDF exporter.

## 1.2 Market Positioning & SEO / AEO Strategy
To capture organic developer discovery via conventional search engines (SEO) and LLM-driven Answer Engine Optimization (AEO), the project explicitly avoids a generic monolithic library name. Instead, it publishes three discrete packages with dedicated landing pages, focused keyword targeting, distinct READMEs, and specialized API signatures:

* **Package 1 (`odt-engine`)**: Targeted at searches for *"javascript parse odt"*, *"browser odt to pdf"*, *"convert odt to html in browser"*, and *"pure js libreoffice writer parser"*.
* **Package 2 (`ods-engine`)**: Targeted at searches for *"read ods file in browser"*, *"ods to json javascript"*, *"lightweight ods parser"*, and *"convert libreoffice calc to csv frontend"*.
* **Package 3 (`odp-engine`)**: Targeted at searches for *"javascript parse odp slides"*, *"odp presentation viewer js"*, *"libreoffice impress to pdf client side"*, and *"extract text from odp"*.

Each package is completely tree-shakeable, self-contained, and installable independently so developers do not pay bundle size penalties for formats they do not support.

## 1.3 Goals & Non-Goals

### Goals
* **Zero External Dependencies:** Built 100% on native modern Web APIs: `DecompressionStream('deflate-raw')`, `DataView`, `DOMParser`, and standard CSS Paged Media.
* **Format-Specific Deep Parsing:** Extract not only raw strings, but full semantic structures (headings, inline style runs, tables, merged cells, formulas, embedded raster/vector images, presentation frames).
* **High-Fidelity PDF Readiness:** Export self-contained, CSS-styled HTML incorporating exact physical dimensions (`@page { size: width height; margin: ... }`) allowing the browser’s native print engine (`window.print()`) or headless renderers to generate print-shop-quality PDFs without bundled heavy canvas or PDF layout engines.
* **Structured AST Pipeline:** Expose an immutable, clean JSON Abstract Syntax Tree (AST) for every document type to facilitate arbitrary programmatic transformations.
* **Comprehensive Diagnostic Logging:** Tagged, structured console logs across every step of unpacking and DOM transformation to make frontend debugging deterministic.

### Non-Goals
* **WYSIWYG Editing:** These libraries are parsers, AST builders, and export renderers; they do not provide in-place document editing, spell checking, or cursor manipulation.
* **Server-Only Runtimes Without Polyfills:** The primary design target is modern evergreen browsers (Chrome 80+, Safari 16.4+, Firefox 113+, Edge 80+). Node.js is supported only when native `DecompressionStream` and `DOMParser` are polyfilled.
* **Legacy Format Support:** No support for legacy binary formats (`.doc`, `.xls`, `.ppt`). Only OASIS OpenDocument XML formats are supported.

## 1.4 User Personas & Core Use Cases
* **Frontend Web Application Developer:** Needs to allow users to drag and drop `.odt`, `.ods`, or `.odp` files and instantly preview them or download a rendered PDF without transmitting sensitive customer documents to an external backend.
* **Data Engineer / Integration Developer:** Needs to ingest thousands of government or enterprise `.ods` spreadsheets client-side, extracting raw matrix arrays or JSON datasets with typed cell values.
* **Agentic / LLM Tool Integrator:** Needs to extract clean, hierarchical Markdown from `.odt` files and bulleted slide transcripts from `.odp` presentations for input context windows.

## 1.5 Package Feature Specifications

### 1.5.1 Sequence of Build
Development will proceed strictly in sequence:
1. `odt-engine` (Text Documents)
2. `ods-engine` (Spreadsheets)
3. `odp-engine` (Presentations)

---

### 1.5.2 Package 1: `odt-engine` (OpenDocument Text)
* **Target Format:** OASIS ODF Text Document (`.odt`).
* **Decompression & Resource Handling:**
  * Unpacks ZIP container using Central Directory parsing.
  * Ingests `mimetype`, `META-INF/manifest.xml`, `content.xml`, `styles.xml`, and `meta.xml`.
  * Extracts all binary assets from the `Pictures/` directory into in-memory `Blob` URLs (`URL.createObjectURL`).
* **Style Inheritance Cascade:**
  * Ingests `<style:default-style>` and `<style:style>` from `styles.xml` and `content.xml`.
  * Resolves inheritance chains via `style:parent-style-name`.
  * Resolves text properties: `fo:font-size`, `fo:font-weight`, `fo:font-style`, `fo:color`, `fo:text-decoration`.
  * Resolves block properties: `fo:text-align`, `fo:margin-*`, `fo:padding-*`, `fo:line-height`.
  * Resolves page properties from `<style:page-layout>`: `fo:page-width`, `fo:page-height`, margins, orientation.
* **Content Tree & AST:**
  * Translates `<text:h>` into typed headings (`h1`–`h6`) with outline levels.
  * Translates `<text:p>` into paragraphs with nested inline styled `<text:span>` nodes.
  * Translates `<text:list>` and `<text:list-item>` into ordered/unordered list AST nodes.
  * Translates `<table:table>`, `<table:table-row>`, `<table:table-cell>` into tables with column-span support.
  * Translates `<draw:frame>` and `<draw:image>` into embedded image nodes linked to memory blob URLs.
* **Export Facades:**
  * `.toAST()`: Returns normalized JSON AST.
  * `.toHTML()`: Returns a standalone HTML5 string with an embedded `<style>` block configuring `@page` dimensions for exact 1:1 PDF printing via `window.print()`.
  * `.toMarkdown()`: Returns clean CommonMark.
  * `.toPlainText()`: Returns raw unstructured text content.

---

### 1.5.3 Package 2: `ods-engine` (OpenDocument Spreadsheet)
* **Target Format:** OASIS ODF Spreadsheet (`.ods`).
* **Content Ingestion & Cell Typing:**
  * Parses `<office:spreadsheet>` containing one or more `<table:table>` sheets.
  * Resolves cell value types (`office:value-type="float|currency|percentage|date|time|boolean|string"`).
  * Extracts formulas from `table:formula` attributes (e.g., `of:=SUM([.A1:.A10])`).
* **Sparse Matrix & Repeater Optimization:**
  * Enforces boundary caps on `table:number-columns-repeated` and `table:number-rows-repeated` to prevent infinite memory allocation from LibreOffice filling 1,048,576 blank cells.
  * Evaluates cell spanning (`table:number-columns-spanned`, `table:number-rows-spanned`).
* **Column Sizing & Geometry:**
  * Resolves column widths via `<table:table-column>` and `<style:table-column-properties>`.
* **Export Facades:**
  * `.toAST()`: Full spreadsheet AST containing metadata, sheets, columns, and rows.
  * `.toMatrix(sheetName?)`: Raw 2D JavaScript array `(string | number | boolean | null)[][]`.
  * `.toCSV(sheetName?, delimiter?)`: Standard RFC 4180 compliant CSV string.
  * `.toJSON(sheetName?)`: Array of objects keyed by row header.
  * `.toHTML()`: Rendered multi-sheet HTML tables with colspans, rowspans, and cell background styles, styled with `@page { size: landscape; }` for landscape PDF printing.

---

### 1.5.4 Package 3: `odp-engine` (OpenDocument Presentation)
* **Target Format:** OASIS ODF Presentation (`.odp`).
* **Visual Frame & Absolute Layout Resolution:**
  * Parses `<office:presentation>` containing an ordered sequence of `<draw:page>` elements.
  * Resolves slide canvas geometry (standard 4:3 vs 16:9 widescreen dimensions).
  * Extracts coordinates from draw frames: `svg:x`, `svg:y`, `svg:width`, `svg:height`.
  * Translates coordinates to relative percentages or millimeters for responsive vector-grade presentation.
* **Layering & Shape Ingestion:**
  * Ingests text boxes, vector rectangles, connectors, and image frames.
  * Maps z-ordering and frame style inheritance (borders, background fills, opacity).
* **Export Facades:**
  * `.toAST()`: Array of Slide objects containing absolute geometry elements and text contents.
  * `.toHTML()`: Deck viewer DOM where each slide is an isolated, print-break-separated CSS canvas container (`page-break-after: always`). Triggers exact multi-page slide-deck PDF creation via `window.print()`.
  * `.toMarkdown()`: Hierarchical slide deck transcript with slide titles (`## Slide N`) and bullet points separated by `---`.

## 1.6 Non-Functional Requirements
* **Bundle Footprint:** Minified bundle size of each specialized engine must not exceed **15 KB** (gzipped: < 5 KB).
* **Zero 3rd-Party Dependencies:** `package.json` for all three packages must have an empty `dependencies: {}` map.
* **Execution Performance:**
  * Files under 5MB must parse to AST in `< 150ms` on standard hardware.
  * Decompression must stream directly into memory without intermediate local storage.
* **Reliability & Memory Safety:**
  * Revoke all generated `Blob` URLs via explicit `.destroy()` or `.dispose()` methods to prevent memory leaks when processing large volumes of files.

---

# SECTION 2: TECHNICAL ARCHITECTURE & IMPLEMENTATION GUIDE

## 2.1 Monorepo Architecture
The project is organized as a lightweight pnpm monorepo. Shared utilities are colocated in an internal core package (`@odf-internal/core`) that is statically bundled at compile-time into each standalone distribution package, preserving zero runtime dependencies.

```
/odf-suite
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── core/                       # Internal shared utilities (Zero runtime export)
│   │   ├── src/
│   │   │   ├── zip.js              # Native DecompressionStream Central Directory Zip Reader
│   │   │   ├── xml.js              # DOMParser & localName traversal utilities
│   │   │   ├── styles.js           # OASIS Style Cascade & CSS flattener
│   │   │   └── media.js            # Blob URL lifecycle manager
│   │   └── package.json
│   ├── odt-engine/                 # Standalone Package 1
│   │   ├── src/
│   │   │   ├── index.js            # Public entrypoint
│   │   │   ├── parser.js           # ODT AST builder
│   │   │   └── renderers.js        # HTML/PDF, Markdown, Plaintext renderers
│   │   ├── test/
│   │   ├── README.md
│   │   └── package.json
│   ├── ods-engine/                 # Standalone Package 2
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── parser.js           # Spreadsheet grid parser
│   │   │   └── renderers.js        # Matrix, CSV, JSON, HTML renderers
│   │   ├── test/
│   │   ├── README.md
│   │   └── package.json
│   └── odp-engine/                 # Standalone Package 3
│       ├── src/
│       │   ├── index.js
│       │   ├── parser.js           # Slide canvas coordinate parser
│       │   └── renderers.js        # Slide deck HTML/PDF, Markdown transcript
│       ├── test/
│       │   ├── README.md
│       └── package.json
```

## 2.2 Shared Core Technical Specifications

### 2.2.1 Native Browser ZIP Decompression Engine (`zip.js`)
All OpenDocument files are standard ZIP archives. Instead of importing 100KB+ zip libraries, the core engine parses the Central Directory using `DataView` and streams raw deflate payloads into the browser's native `DecompressionStream`:

```text
[ Binary ArrayBuffer ]
         │
         ▼
[ Read End of Central Directory (EOCD) ] (Locate magic: 0x06054b50)
         │
         ▼
[ Central Directory Records ] (Locate magic: 0x02014b50)
         │
         ├── File Name, Compression Method, Compressed Size
         └── Local Header Offset
         │
         ▼
[ Payload Stream ] ──(If Method == 8)──► new DecompressionStream('deflate-raw')
                   ──(If Method == 0)──► Direct Uint8Array slice
```

### 2.2.2 XML Parsing & Namespace Handling (`xml.js`)
ODF uses numerous XML namespaces (`office:`, `text:`, `table:`, `draw:`, `style:`, `fo:`, `svg:`). Standard `querySelector` calls fail unpredictably in browser XML documents if namespace prefixes differ between versions of LibreOffice or third-party exporters.

**Mandatory Rule:** XML nodes must be traversed using namespace-agnostic lookups matching strictly on `localName`:
```javascript
export const getChildrenByTag = (parent, localName) => 
  Array.from(parent.children).filter(el => el.localName === localName);

export const getFirstChildByTag = (parent, localName) => 
  Array.from(parent.children).find(el => el.localName === localName);

export const getElementsByTag = (root, localName) => 
  Array.from(root.getElementsByTagName('*')).filter(el => el.localName === localName);
```

### 2.2.3 The Style Cascade & CSS Normalizer (`styles.js`)
LibreOffice documents define formatting across `<style:default-style>`, `<style:style>`, and `<style:page-layout>`. The `StyleResolver` flattens these styles into native CSS properties:

| OASIS / FO XML Attribute | Normalized CSS Property | Example Translation |
| :--- | :--- | :--- |
| `fo:font-size` | `font-size` | `12pt` -> `font-size: 12pt;` |
| `fo:font-weight` | `font-weight` | `bold` -> `font-weight: bold;` |
| `fo:font-style` | `font-style` | `italic` -> `font-style: italic;` |
| `fo:color` | `color` | `#333333` -> `color: #333333;` |
| `fo:background-color` | `background-color` | `#ff0000` -> `background-color: #ff0000;` |
| `fo:text-align` | `text-align` | `center` -> `text-align: center;` |
| `fo:margin-*` | `margin-*` | `1.5cm` -> `margin-top: 1.5cm;` |
| `fo:padding-*` | `padding-*` | `2mm` -> `padding-left: 2mm;` |
| `fo:line-height` | `line-height` | `150%` -> `line-height: 150%;` |
| `style:column-width` | `width` | `4.5cm` -> `width: 4.5cm;` |
| `svg:x`, `svg:y` | `left`, `top` | `2cm`, `5cm` -> `left: 2cm; top: 5cm;` |
| `svg:width`, `svg:height` | `width`, `height` | `10cm`, `6cm` -> `width: 10cm; height: 6cm;` |

## 2.3 AST Schemas

### 2.3.1 ODT Document AST
```typescript
interface ODTDocumentAST {
  meta: {
    format: 'odt';
    title?: string;
    pageLayout: {
      width: string;
      height: string;
      marginTop: string;
      marginBottom: string;
      marginLeft: string;
      marginRight: string;
      orientation: 'portrait' | 'landscape';
    };
  };
  body: ODTBlockNode[];
  resources: {
    images: Record<string, string>; // { "Pictures/1000.png": "blob:http://..." }
  };
}

type ODTBlockNode = 
  | { type: 'heading'; level: number; style: string; text: string; children: ODTInlineNode[] }
  | { type: 'paragraph'; style: string; text: string; children: ODTInlineNode[] }
  | { type: 'list'; ordered: boolean; items: ODTBlockNode[][] }
  | { type: 'table'; style: string; rows: ODTTableRow[] };

type ODTInlineNode = 
  | { type: 'text'; content: string }
  | { type: 'span'; style: string; content: string }
  | { type: 'image'; src: string; width: string; height: string };

interface ODTTableRow {
  cells: { colSpan: number; rowSpan: number; style: string; children: ODTBlockNode[] }[];
}
```

### 2.3.2 ODS Spreadsheet AST
```typescript
interface ODSSpreadsheetAST {
  meta: {
    format: 'ods';
    sheetCount: number;
  };
  sheets: Record<string, ODSSheet>;
}

interface ODSSheet {
  name: string;
  columns: { style: string; width: string }[];
  rows: ODSCell[][];
}

interface ODSCell {
  value: string | number | boolean | null;
  rawText: string;
  type: 'string' | 'float' | 'date' | 'boolean' | 'currency' | 'empty';
  formula?: string;
  colSpan: number;
  rowSpan: number;
  style: string;
}
```

### 2.3.3 ODP Presentation AST
```typescript
interface ODPPresentationAST {
  meta: {
    format: 'odp';
    slideCount: number;
    dimensions: { width: string; height: string };
  };
  slides: ODPSlide[];
  resources: {
    images: Record<string, string>;
  };
}

interface ODPSlide {
  slideNumber: number;
  name: string;
  elements: ODPSlideElement[];
}

interface ODPSlideElement {
  type: 'text-box' | 'image' | 'shape';
  geometry: { x: string; y: string; width: string; height: string };
  style: string;
  content?: {
    paragraphs?: { text: string; style: string }[];
    imageSrc?: string;
  };
}
```

## 2.4 High-Fidelity PDF Export Pipeline
Neither package requires an external PDF generation engine. Instead, they produce specialized HTML implementing the **W3C CSS Paged Media Module Level 3** specification:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: 210mm 297mm; /* Exact ODF Page Layout dimensions */
      margin: 20mm 20mm 20mm 20mm;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .page-container {
      width: 210mm;
      min-height: 297mm;
      box-sizing: border-box;
      background: white;
    }
    @media print {
      body { background: none; }
      .page-container { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- Fully styled semantic DOM -->
  </div>
</body>
</html>
```

### Automated PDF Export Trigger
The consumer invokes PDF rendering cleanly via an off-screen iframe:
```javascript
export function triggerPrintToPDF(htmlContent) {
  console.log('[ODF:Export] Spawning isolated print container for PDF synthesis...');
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  iframe.srcdoc = htmlContent;
  iframe.onload = () => {
    console.log('[ODF:Export] Executing browser print subsystem...');
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60000); // Clean up after print dialog finishes
  };
}
```

---

# SECTION 3: DEVELOPMENT TASK LIST & WORK BREAKDOWN STRUCTURE (WBS)

Status: every task below is delivered as of v1.0.0. What shipped, and the two targets that were consciously left unmet, is recorded in `history.md`.

## Phase 1: Core Foundation & Infrastructure
- [x] **TASK-CORE-101**: Monorepo workspace initialization with pnpm and subpackage configurations.
- [x] **TASK-CORE-102**: Implement zero-dependency `unzipContainer` in `packages/core/src/zip.js` with Central Directory parsing and `DecompressionStream('deflate-raw')`.
- [x] **TASK-CORE-103**: Implement namespace-agnostic DOM helper methods in `packages/core/src/xml.js`.
- [x] **TASK-CORE-104**: Implement `StyleResolver` in `packages/core/src/styles.js` resolving inheritance and mapping FO/OASIS properties to CSS.
- [x] **TASK-CORE-105**: Implement `MediaResolver` in `packages/core/src/media.js` extracting `Pictures/*` into `Blob` URLs and tracking teardown lifecycles.
- [x] **TASK-CORE-106**: Add diagnostic logging harness with categorized prefixes (`[ODF:Zip]`, `[ODF:Styles]`, `[ODF:Parse]`).

## Phase 2: `odt-engine` (Package 1: OpenDocument Text)
- [x] **TASK-ODT-201**: Implement `packages/odt-engine/src/parser.js` parsing `<office:text>`, `<text:h>`, `<text:p>`, and `<text:span>`.
- [x] **TASK-ODT-202**: Add list hierarchy parser supporting nested `<text:list>` and bullet numbering.
- [x] **TASK-ODT-203**: Add table layout parser supporting `<table:table>`, `<table:table-ro
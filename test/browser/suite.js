/**
 * Browser conformance suite.
 *
 * Runs against the built `dist` bundles with the browser's own DOMParser,
 * DecompressionStream and Blob URL implementation. The Node suite covers more
 * edge cases; this one exists to catch environment differences and verifies
 * that rendered HTML, image URLs and the print shell work in a real DOM.
 */

import { parseODT, setLogLevel } from '../../packages/odt-engine/dist/index.js';
import { parseODS } from '../../packages/ods-engine/dist/index.js';
import { parseODP } from '../../packages/odp-engine/dist/index.js';
import { buildOdf, MASTER_PAGES, MIME_TYPES, PAGE_LAYOUT, TINY_PNG } from '../helpers/odf.js';
import { buildZip } from '../helpers/zip.js';
import { odtXml, odsXml, odpXml, TARGET_MS } from '../helpers/bench.js';

setLogLevel('silent');

const results = [];
let current = 'suite';

function fail(message) {
  throw new Error(message);
}

const eq = (actual, expected, label = 'value') => {
  if (actual !== expected) {
    fail(`${current}: ${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const ok = (value, label = 'value') => {
  if (!value) fail(`${current}: ${label} is not truthy`);
};
const match = (value, pattern, label = 'value') => {
  if (!pattern.test(String(value))) fail(`${current}: ${label} did not match ${pattern}`);
};
const same = (actual, expected, label = 'value') => {
  eq(JSON.stringify(actual), JSON.stringify(expected), label);
};

async function rejectsWithCode(fn, code, label = 'parse') {
  try {
    await fn();
  } catch (error) {
    eq(error.code, code, `${label} error code`);
    return;
  }
  fail(`${current}: ${label} should have thrown ${code}`);
}

async function test(name, fn) {
  current = name;
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: String((error && error.message) || error) });
  }
}

/* ------------------------------- fixtures ------------------------------- */

const ODT_STYLES = `
<style:style style:name="Heading_20_2" style:family="paragraph">
  <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
</style:style>
<style:style style:name="Bold" style:family="text">
  <style:text-properties fo:font-weight="bold" fo:font-style="italic"/>
</style:style>
<style:style style:name="Underline" style:family="text">
  <style:text-properties fo:text-decoration="underline line-through" fo:color="#a00"/>
</style:style>
<style:list-style style:name="Numbered"><text:list-level-style-number text:level="1"/></style:list-style>
<style:list-style style:name="Bulleted"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></style:list-style>`;

const ODT_BODY = `
<office:text>
  <text:h text:style-name="Heading_20_2">Highlights</text:h>
  <text:p>Revenue <text:span text:style-name="Bold">grew</text:span><text:s text:c="3"/>in Q3<text:tab/>now<text:line-break/>next</text:p>
  <text:p><text:span text:style-name="Underline">Marked</text:span> and <text:a xlink:href="https://example.com/a?b=1&amp;c=2">link</text:a>.</text:p>
  <text:p/>
  <text:list text:style-name="Numbered">
    <text:list-item>
      <text:p>One</text:p>
      <text:list text:style-name="Bulleted"><text:list-item><text:p>Nested</text:p></text:list-item></text:list>
    </text:list-item>
    <text:list-item><text:p>Two</text:p></text:list-item>
  </text:list>
  <table:table>
    <table:table-row>
      <table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="2"><text:p>Merged</text:p></table:table-cell>
      <table:table-cell><text:p>H</text:p></table:table-cell>
    </table:table-row>
    <table:table-row>
      <table:covered-table-cell/>
      <table:table-cell><text:p>B</text:p></table:table-cell>
    </table:table-row>
  </table:table>
  <text:p><draw:frame svg:width="2cm" svg:height="1cm"><draw:image xlink:href="Pictures/logo.png"/></draw:frame></text:p>
</office:text>`;

const odtFixture = () => buildOdf('odt', {
  title: 'Browser Report',
  body: ODT_BODY,
  styles: ODT_STYLES,
  layoutStyles: PAGE_LAYOUT,
  masterPages: MASTER_PAGES,
  pictures: { 'logo.png': TINY_PNG },
});

const ODS_STYLES = `
<style:style style:name="co1" style:family="table-column">
  <style:table-column-properties style:column-width="2cm"/>
</style:style>
<style:style style:name="ce1" style:family="table-cell">
  <style:table-cell-properties fo:background-color="#fff4cc" fo:border="0.5pt solid #999999"/>
</style:style>`;

const ODS_BODY = `
<office:spreadsheet>
  <table:table table:name="Sales">
    <table:table-column table:number-columns-repeated="6" table:style-name="co1"/>
    <table:table-row>
      <table:table-cell office:value-type="string"><text:p>Product</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Units</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Units</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Active</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Updated</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Share</text:p></table:table-cell>
    </table:table-row>
    <table:table-row>
      <table:table-cell table:style-name="ce1" office:value-type="string"><text:p>Widget</text:p></table:table-cell>
      <table:table-cell office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell>
      <table:table-cell office:value-type="float" office:value="7"><text:p>7</text:p></table:table-cell>
      <table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>
      <table:table-cell office:value-type="date" office:date-value="2024-01-15"><text:p>2024-01-15</text:p></table:table-cell>
      <table:table-cell office:value-type="percentage" office:value="0.25"><text:p>25%</text:p></table:table-cell>
    </table:table-row>
    <table:table-row>
      <table:table-cell table:number-columns-spanned="2" office:value-type="string"><text:p>Wide, "quoted"</text:p></table:table-cell>
      <table:covered-table-cell/>
      <table:table-cell office:value-type="string"><text:p>Line one</text:p><text:p>Line two</text:p></table:table-cell>
      <table:table-cell office:value-type="float" office:value="0.5"><text:p>50%</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="32"/>
    </table:table-row>
    <table:table-row>
      <table:table-cell table:formula="of:=SUM([.B2:.B3])" office:value-type="float" office:value="8"><text:p>8</text:p></table:table-cell>
    </table:table-row>
    <table:table-row table:number-rows-repeated="1048576">
      <table:table-cell table:number-columns-repeated="1024"/>
    </table:table-row>
  </table:table>
  <table:table table:name="__proto__">
    <table:table-row><table:table-cell office:value-type="string"><text:p>kept</text:p></table:table-cell></table:table-row>
  </table:table>
</office:spreadsheet>`;

const odsFixture = () => buildOdf('ods', {
  body: ODS_BODY,
  automaticStyles: ODS_STYLES,
});

const ODP_STYLES = `
<style:style style:name="Title" style:family="paragraph">
  <style:text-properties fo:font-size="32pt" fo:font-weight="bold"/>
</style:style>
<style:style style:name="Box" style:family="graphic">
  <style:graphic-properties draw:fill="solid" draw:fill-color="#ffcc00" draw:stroke="none"/>
</style:style>`;

const ODP_BODY = `
<office:presentation>
  <draw:page draw:name="Intro" draw:master-page-name="Default">
    <draw:frame presentation:style-name="TitleBox" svg:x="2cm" svg:y="1.5cm" svg:width="24cm" svg:height="4cm">
      <draw:text-box><text:p text:style-name="Title">Q3 *Review*</text:p></draw:text-box>
    </draw:frame>
    <draw:frame svg:x="2cm" svg:y="7cm" svg:width="20cm" svg:height="10cm">
      <draw:text-box>
        <text:p>Agenda</text:p>
        <text:list>
          <text:list-item><text:p>Bullet A</text:p></text:list-item>
          <text:list-item><text:p>Bullet B</text:p></text:list-item>
        </text:list>
      </draw:text-box>
    </draw:frame>
    <draw:frame svg:x="23cm" svg:y="16cm" svg:width="4cm" svg:height="4cm">
      <draw:image xlink:href="Pictures/slide-logo.png"/>
    </draw:frame>
    <draw:rect draw:style-name="Box" svg:x="1cm" svg:y="18cm" svg:width="5cm" svg:height="2cm"/>
    <presentation:notes>
      <draw:frame svg:width="10cm" svg:height="4cm"><draw:text-box><text:p>Speaker notes are hidden</text:p></draw:text-box></draw:frame>
    </presentation:notes>
  </draw:page>
  <draw:page draw:name="Second" draw:master-page-name="Default">
    <draw:frame svg:x="3cm" svg:y="3cm" svg:width="10cm" svg:height="5cm">
      <draw:text-box><text:p>Wrap up</text:p></draw:text-box>
    </draw:frame>
  </draw:page>
</office:presentation>`;

const odpFixture = () => buildOdf('odp', {
  body: ODP_BODY,
  styles: ODP_STYLES,
  layoutStyles: PAGE_LAYOUT.replace('21cm', '28cm').replace('29.7cm', '21cm'),
  masterPages: `<style:master-page style:name="Default" style:page-layout-name="pm1">
    <style:drawing-page-properties draw:fill="solid" draw:fill-color="#fafafa"/>
  </style:master-page>`,
  pictures: { 'slide-logo.png': TINY_PNG },
});

const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

/* --------------------------------- ODT ---------------------------------- */

await test('odt: parses Uint8Array, Blob and File inputs', async () => {
  const bytes = await odtFixture();
  const fromBytes = await parseODT(bytes);
  eq(fromBytes.meta.title, 'Browser Report', 'title');
  fromBytes.destroy();

  const fromBlob = await parseODT(new Blob([bytes], { type: MIME_TYPES.odt }));
  eq(fromBlob.body.length, 7, 'block count from Blob');
  fromBlob.destroy();

  const fromFile = await parseODT(new File([bytes], 'report.odt', { type: MIME_TYPES.odt }));
  eq(fromFile.meta.format, 'odt', 'format from File');
  fromFile.destroy();
});

await test('odt: resolves heading levels, whitespace, links and inline styles', async () => {
  const doc = await parseODT(await odtFixture());
  const [heading, paragraph, decorated] = doc.body;

  eq(heading.level, 2, 'Heading_20_2 level');
  eq(heading.text, 'Highlights', 'heading text');
  eq(paragraph.text, 'Revenue grew   in Q3\tnow\nnext', 'whitespace expansion');

  const bold = paragraph.children.find((child) => child.type === 'span');
  eq(bold.content, 'grew', 'span content');
  const link = decorated.children.find((child) => child.href);
  eq(link.href, 'https://example.com/a?b=1&c=2', 'decoded link href');
  doc.destroy();
});

await test('odt: renders styles, lists, table spans and escaped HTML', async () => {
  const doc = await parseODT(await odtFixture());
  const html = doc.toHTML();
  const page = parseHTML(html);

  eq(page.querySelectorAll('.odf-page h2').length, 1, 'h2 count');
  eq(page.querySelector('.odf-page h2').textContent, 'Highlights', 'h2 text');
  eq(page.querySelectorAll('ol > li').length, 2, 'list items');
  eq(page.querySelectorAll('ol ul > li').length, 1, 'nested list items');
  eq(page.querySelector('td').getAttribute('colspan'), '2', 'colspan');
  eq(page.querySelector('td').getAttribute('rowspan'), '2', 'rowspan');
  eq(page.querySelectorAll('td').length, 3, 'table cells after span expansion');
  match(html, /<p>&#160;<\/p>/, 'empty paragraph placeholder');
  match(page.querySelector('style').textContent, /@page\{size:21cm 29\.7cm;margin:2cm 2cm 2cm 2\.5cm\}/, 'page rule');
  match(html, /<span style="[^"]*text-decoration:underline line-through/, 'decoration');
  doc.destroy();
});

await test('odt: Markdown and plain text keep spans and row alignment', async () => {
  const doc = await parseODT(await odtFixture());
  const markdown = doc.toMarkdown();
  const text = doc.toPlainText();

  match(markdown, /^## Highlights$/m, 'heading');
  match(markdown, /\*\*\*grew\*\*\*/, 'bold italic run');
  match(markdown, /\[link\]\(https:\/\/example\.com\/a\?b=1&c=2\)/, 'link');
  match(markdown, /^1\. One$/m, 'ordered list');
  match(markdown, /^ {3}- Nested$/m, 'nested bullet');
  match(markdown, /^\| Merged \|  \| H \|$/m, 'header row with colspan');
  match(markdown, /^\|  \|  \| B \|$/m, 'spanned row alignment');
  match(text, /Merged \|  \| H/, 'plain-text table');
  doc.destroy();
});

await test('odt: image Blob URL loads, then is revoked by destroy', async () => {
  const doc = await parseODT(await odtFixture());
  const image = doc.body[doc.body.length - 1].children[0];
  eq(image.type, 'image', 'image node');
  match(image.src, /^blob:/, 'blob URL');

  const response = await fetch(image.src);
  eq(response.ok, true, 'image fetch');
  ok((await response.arrayBuffer()).byteLength > 0, 'image bytes');

  const src = image.src;
  doc.destroy();
  doc.destroy();
  eq(Object.keys(doc.resources.images).length, 0, 'resources after destroy');

  let rejected = false;
  try {
    await fetch(src);
  } catch {
    rejected = true;
  }
  eq(rejected, true, 'revoked Blob URL');
});

/* --------------------------------- ODS ---------------------------------- */

await test('ods: types cells, caps repeats and keeps covered cells aligned', async () => {
  const workbook = await parseODS(await odsFixture());
  same(workbook.sheetNames, ['Sales', '__proto__'], 'sheet names');
  eq(workbook.sheet('__proto__').rows[0][0].value, 'kept', 'null-prototype sheet');

  const sales = workbook.sheet('Sales');
  eq(sales.columns.length, 6, 'column count');
  eq(sales.columns[0].width, '2cm', 'column width');

  const row = sales.rows[1];
  eq(row[1].type, 'float', 'float type');
  eq(row[1].value, 3, 'float value');
  eq(row[3].value, true, 'boolean value');
  eq(row[4].value, '2024-01-15', 'date value');
  eq(row[5].valueType, 'percentage', 'percentage value type');
  eq(row[5].rawText, '25%', 'percentage raw text');

  const wide = sales.rows[2];
  eq(wide[0].colSpan, 2, 'colSpan');
  eq(wide[1].covered, true, 'covered placeholder');
  eq(wide[2].rawText, 'Line one\nLine two', 'multi-paragraph cell');
  eq(sales.rows[3][0].formula, 'of:=SUM([.B2:.B3])', 'formula');
  eq(sales.rows.length, 4, 'trailing blank rows dropped');
});

await test('ods: exports matrix, CSV and JSON from the same AST', async () => {
  const workbook = await parseODS(await odsFixture());
  const csv = workbook.toCSV('Sales');

  match(csv, /^Product,Units,Units,Active,Updated,Share\r\n/, 'CSV header');
  match(csv, /"Wide, ""quoted"""/, 'CSV quoting');
  match(csv, /"Line one\nLine two"/, 'CSV multi-line cell');
  match(csv, /Widget,3,7,TRUE,2024-01-15,25%/, 'CSV values');

  const records = workbook.toJSON('Sales');
  eq(records.length, 3, 'record count');
  eq(records[0].Units, 3, 'first Units column');
  eq(records[0].Units_2, 7, 'duplicate header suffix');
  eq(records[0].Share, 0.25, 'percentage value');
  eq(records[2].Product, 8, 'formula result in JSON');
  eq(workbook.toMatrix('Sales')[1][3], true, 'matrix boolean');
});

await test('ods: rendered HTML exposes sheet sections, spans and type classes', async () => {
  const workbook = await parseODS(await odsFixture());
  const page = parseHTML(workbook.toHTML());
  const sheets = page.querySelectorAll('.odf-sheet');

  eq(sheets.length, 2, 'sheet section count');
  eq(sheets[1].querySelector('.odf-sheet-title').textContent, '__proto__', 'second sheet title');
  eq(page.querySelector('td[colspan="2"]').textContent, 'Wide, "quoted"', 'spanned cell');
  eq(page.querySelectorAll('td.num').length, 5, 'numeric cells');
  eq(page.querySelectorAll('td.bool').length, 1, 'boolean cells');
  eq(page.querySelectorAll('td.date').length, 1, 'date cells');
  match(page.querySelector('td[style]').getAttribute('style'), /background-color:#fff4cc/, 'cell style');
  match(page.querySelector('.odf-table').innerHTML, /Line one<br>Line two/, 'line break');
});

/* --------------------------------- ODP ---------------------------------- */

await test('odp: reads geometry, bullets, background and hidden notes', async () => {
  const deck = await parseODP(await odpFixture());

  eq(deck.meta.slideCount, 2, 'slide count');
  eq(deck.meta.dimensions.width, '28cm', 'slide width');
  eq(deck.slides[0].background, '#fafafa', 'master background');
  same(deck.slides[0].elements.map((element) => element.type), ['text-box', 'text-box', 'image', 'shape'], 'element types');

  const agenda = deck.slides[0].elements[1].content.paragraphs;
  same(agenda.map((paragraph) => paragraph.text), ['Agenda', 'Bullet A', 'Bullet B'], 'paragraphs');
  eq(agenda[1].bullet, true, 'bullet flag');
  eq(JSON.stringify(deck.slides).includes('Speaker notes'), false, 'notes excluded');
  deck.destroy();
});

await test('odp: HTML uses the CSS page box and slide-relative positions', async () => {
  const deck = await parseODP(await odpFixture());
  const html = deck.toHTML();
  const page = parseHTML(html);
  const slides = page.querySelectorAll('.odp-slide');

  eq(slides.length, 2, 'rendered slides');
  eq(slides[0].getAttribute('style').includes('background:#fafafa'), true, 'slide background');
  eq(slides[0].querySelectorAll('.odp-bullet').length, 2, 'bullet paragraphs');
  eq(slides[0].querySelector('img').getAttribute('src').startsWith('blob:'), true, 'image src');
  match(slides[0].querySelector('.odp-text').getAttribute('style'), /left:7\.143%;top:7\.143%;width:85\.714%/, 'frame geometry');
  match(page.querySelector('style').textContent, /@page\{size:28cm 21cm;margin:0\}/, 'slide page rule');
  match(html, /page-break-after:always/, 'print page break');
  deck.destroy();
});

await test('odp: Markdown escapes metacharacters and sections are separated', async () => {
  const deck = await parseODP(await odpFixture());
  const markdown = deck.toMarkdown();

  match(markdown, /^## Slide 1$/m, 'first slide heading');
  match(markdown, /^### Q3 \\\*Review\\\*$/m, 'escaped title');
  match(markdown, /^- Agenda$/m, 'first paragraph as bullet');
  match(markdown, /!\[Slide 1 image\]\(blob:/, 'image');
  match(markdown, /\n---\n/, 'slide separator');
  deck.destroy();
});

await test('odp: empty deck and images without captions degrade cleanly', async () => {
  const deck = await parseODP(await buildOdf('odp', { body: '<office:presentation/>' }));
  eq(deck.meta.slideCount, 0, 'slide count');
  eq(deck.slides.length, 0, 'slides');
  eq(deck.toMarkdown(), '\n', 'empty markdown');
  deck.destroy();
});

/* ------------------------------- containers ----------------------------- */

await test('errors: rejects non-ZIP, non-ODF and malformed XML with tagged codes', async () => {
  await rejectsWithCode(() => parseODT(new Uint8Array([1, 2, 3, 4])), 'NOT_A_ZIP', 'random bytes');
  await rejectsWithCode(
    async () => parseODS(await buildZip([{ name: 'mimetype', content: MIME_TYPES.ods, store: true }])),
    'NOT_ODF',
    'missing content.xml',
  );

  const malformed = await buildZip([
    { name: 'mimetype', content: MIME_TYPES.odt, store: true },
    { name: 'content.xml', content: '<office:document-content><office:body>' },
  ]);
  await rejectsWithCode(() => parseODT(malformed), 'XML_PARSE', 'malformed content.xml');
});

/* ------------------------------- benchmark ------------------------------ */

async function benchmark() {
  const fixtures = [
    ['odt', parseODT, await buildOdf('odt', {
      body: odtXml, layoutStyles: PAGE_LAYOUT, masterPages: MASTER_PAGES,
    }), odtXml.length],
    ['ods', parseODS, await buildOdf('ods', { body: odsXml }), odsXml.length],
    ['odp', parseODP, await buildOdf('odp', {
      body: odpXml, layoutStyles: PAGE_LAYOUT, masterPages: MASTER_PAGES,
    }), odpXml.length],
  ];

  const collect = () => globalThis.gc && globalThis.gc();
  const bench = [];
  for (const [name, parse, bytes, xmlSize] of fixtures) {
    collect();
    await parse(bytes).then((document) => document.destroy()); // warm up the JIT
    const times = [];
    for (let run = 0; run < 7; run++) {
      collect();
      const start = performance.now();
      const document = await parse(bytes);
      times.push(performance.now() - start);
      document.destroy();
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    bench.push({
      name,
      median,
      times,
      xmlSize,
      containerSize: bytes.byteLength,
      met: median <= TARGET_MS,
    });
  }
  return { target: TARGET_MS, runs: bench };
}

const params = new URLSearchParams(location.search);
if (params.get('bench') === '1') {
  try {
    window.__odfBench = await benchmark();
  } catch (error) {
    window.__odfBenchError = String((error && error.message) || error);
  }
}

const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;
const output = document.getElementById('output');
output.textContent = results.map((result) =>
  `${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok ? '' : `\n      ${result.error}`}`,
).join('\n') + `\n\n${passed} passed, ${failed} failed`;

window.__odfResults = { tests: results, passed, failed };
window.__odfDone = true;

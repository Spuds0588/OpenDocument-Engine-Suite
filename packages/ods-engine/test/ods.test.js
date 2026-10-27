import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseODS } from '../src/index.js';
import { buildOdf } from '../../../test/helpers/odf.js';

const AUTOMATIC_STYLES = `
<style:style style:name="co1" style:family="table-column">
  <style:table-column-properties style:column-width="2.5cm"/>
</style:style>
<style:style style:name="ce1" style:family="table-cell">
  <style:table-cell-properties fo:background-color="#fff4cc" fo:border="0.5pt solid #999999"/>
</style:style>`;

const BODY = `
<office:spreadsheet>
  <table:table table:name="Sales">
    <table:table-column table:number-columns-repeated="5" table:style-name="co1"/>
    <table:table-row>
      <table:table-cell table:style-name="ce1" office:value-type="string"><text:p>Product</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Units</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Price</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Active</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>Updated</text:p></table:table-cell>
    </table:table-row>
    <table:table-row>
      <table:table-cell office:value-type="string"><text:p>Widget</text:p></table:table-cell>
      <table:table-cell office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell>
      <table:table-cell office:value-type="currency" office:currency="USD" office:value="9.99"><text:p>9.99</text:p></table:table-cell>
      <table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>
      <table:table-cell office:value-type="date" office:date-value="2024-01-15"><text:p>2024-01-15</text:p></table:table-cell>
    </table:table-row>
    <table:table-row table:number-rows-repeated="2">
      <table:table-cell table:number-columns-repeated="5"/>
    </table:table-row>
    <table:table-row>
      <table:table-cell table:number-columns-spanned="2" office:value-type="string"><text:p>Wide, "quoted"</text:p></table:table-cell>
      <table:covered-table-cell/>
      <table:table-cell office:value-type="string"><text:p>Line one</text:p><text:p>Line two</text:p></table:table-cell>
      <table:table-cell office:value-type="percentage" office:value="0.25"><text:p>25%</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="20"/>
    </table:table-row>
    <table:table-row>
      <table:table-cell table:formula="of:=SUM([.B2:.B3])" office:value-type="float" office:value="8"><text:p>8</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="1024"/>
    </table:table-row>
    <table:table-row table:number-rows-repeated="1048576">
      <table:table-cell table:number-columns-repeated="1024"/>
    </table:table-row>
  </table:table>
  <table:table table:name="Notes">
    <table:table-row>
      <table:table-cell office:value-type="string"><text:p>Line one</text:p><text:p>Line two</text:p></table:table-cell>
    </table:table-row>
  </table:table>
</office:spreadsheet>`;

async function parseFixture() {
  const bytes = await buildOdf('ods', {
    body: BODY,
    automaticStyles: AUTOMATIC_STYLES,
    layoutStyles: `
      <style:page-layout style:name="pm1">
        <style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm"/>
      </style:page-layout>`,
  });
  return parseODS(bytes);
}

test('reads sheet names and metadata', async () => {
  const workbook = await parseFixture();
  assert.equal(workbook.meta.format, 'ods');
  assert.equal(workbook.meta.sheetCount, 2);
  assert.deepEqual(workbook.sheetNames, ['Sales', 'Notes']);
  assert.equal(workbook.sheet().name, 'Sales');
});

test('resolves column widths from automatic styles', async () => {
  const workbook = await parseFixture();
  const sales = workbook.sheet('Sales');
  assert.equal(sales.columns.length, 5);
  assert.equal(sales.columns[0].width, '2.5cm');
});

test('types cell values and keeps formulas, dates and percentages', async () => {
  const workbook = await parseFixture();
  const rows = workbook.sheet('Sales').rows;

  const widget = rows[1];
  assert.equal(widget[0].type, 'string');
  assert.equal(widget[0].value, 'Widget');
  assert.equal(widget[1].type, 'float');
  assert.equal(widget[1].value, 3);
  assert.equal(widget[2].type, 'currency');
  assert.equal(widget[2].value, 9.99);
  assert.equal(widget[3].type, 'boolean');
  assert.equal(widget[3].value, true);
  assert.equal(widget[4].type, 'date');
  assert.equal(widget[4].value, '2024-01-15');

  const percentage = rows[4][3];
  assert.equal(percentage.type, 'float');
  assert.equal(percentage.value, 0.25);
  assert.equal(percentage.valueType, 'percentage');
  assert.equal(percentage.rawText, '25%');

  const formula = rows[5][0];
  assert.equal(formula.formula, 'of:=SUM([.B2:.B3])');
  assert.equal(formula.value, 8);
});

test('caps huge repeat counters and drops trailing blank rows and cells', async () => {
  const workbook = await parseFixture();
  const rows = workbook.sheet('Sales').rows;

  assert.equal(rows.length, 6);
  assert.equal(rows[2].length, 0);
  assert.equal(rows[3].length, 0);
  assert.equal(rows[5].length, 1);
});

test('detects column and row spans with covered placeholders', async () => {
  const workbook = await parseFixture();
  const row = workbook.sheet('Sales').rows[4];

  assert.equal(row[0].colSpan, 2);
  assert.equal(row[1].covered, true);
  assert.equal(row[2].rawText, 'Line one\nLine two');
});

test('exports a typed matrix', async () => {
  const workbook = await parseFixture();
  const matrix = workbook.toMatrix('Sales');

  assert.equal(matrix[0][0], 'Product');
  assert.equal(matrix[1][1], 3);
  assert.equal(matrix[1][3], true);
  assert.equal(matrix[1][4], '2024-01-15');
  assert.deepEqual(matrix[2], []);
});

test('exports RFC 4180 CSV with quoting and custom delimiters', async () => {
  const workbook = await parseFixture();
  const csv = workbook.toCSV('Sales');

  assert.ok(csv.includes('\r\n'));
  assert.ok(csv.includes('"Wide, ""quoted"""'));
  assert.ok(csv.includes('"Line one\nLine two"'));
  assert.ok(csv.includes('Widget,3,9.99,TRUE,2024-01-15'));

  const semicolon = workbook.toCSV('Sales', ';');
  assert.ok(semicolon.includes('Widget;3;9.99;TRUE;2024-01-15'));
  assert.ok(semicolon.includes('"Wide, ""quoted"""'));
});

test('exports JSON records keyed by the header row', async () => {
  const workbook = await parseFixture();
  const records = workbook.toJSON('Sales');

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    Product: 'Widget',
    Units: 3,
    Price: 9.99,
    Active: true,
    Updated: '2024-01-15',
  });
  assert.equal(records[1].Product, 'Wide, "quoted"');
  assert.equal(records[1].Units, null);
  assert.equal(records[1].Price, 'Line one\nLine two');
  assert.equal(records[1].Active, 0.25);
  assert.equal(records[2].Product, 8);
});

test('renders multi-sheet landscape HTML with spans and cell styles', async () => {
  const workbook = await parseFixture();
  const html = workbook.toHTML();

  assert.match(html, /@page\{size:A4 landscape;margin:10mm\}/);
  assert.match(html, /Sales/);
  assert.match(html, /Notes/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /background-color:#fff4cc/);
  assert.match(html, /<td colspan="2" class="text"/);
  assert.match(html, /<td class="num">3<\/td>/);
  assert.match(html, /<td class="date">2024-01-15<\/td>/);
  assert.match(html, /Line one<br>Line two/);
});

test('rejects unknown sheet names with a tagged error', async () => {
  const workbook = await parseFixture();
  assert.throws(
    () => workbook.sheet('Missing'),
    (error) => error.code === 'UNKNOWN_SHEET',
  );
});

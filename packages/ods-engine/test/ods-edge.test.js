import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LIMITS, parseODS } from '../src/index.js';
import { buildOdf } from '../../../test/helpers/odf.js';

async function parseBody(body, options = {}) {
  return parseODS(await buildOdf('ods', {
    body,
    styles: options.styles || '',
    automaticStyles: options.automaticStyles || '',
  }));
}

test('keeps special, duplicate and missing sheet names distinct', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="__proto__">
        <table:table-row><table:table-cell office:value-type="string"><text:p>Proto</text:p></table:table-cell></table:table-row>
      </table:table>
      <table:table table:name="Data">
        <table:table-row><table:table-cell office:value-type="float" office:value="1"><text:p>1</text:p></table:table-cell></table:table-row>
      </table:table>
      <table:table table:name="Data">
        <table:table-row><table:table-cell office:value-type="float" office:value="2"><text:p>2</text:p></table:table-cell></table:table-row>
      </table:table>
      <table:table>
        <table:table-row><table:table-cell office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell></table:table-row>
      </table:table>
    </office:spreadsheet>`);

  assert.deepEqual(workbook.sheetNames, ['__proto__', 'Data', 'Data (2)', 'Sheet']);
  assert.deepEqual(workbook.toMatrix('__proto__'), [['Proto']]);
  assert.deepEqual(workbook.toMatrix('Data (2)'), [[2]]);
  assert.deepEqual(workbook.toMatrix('Sheet'), [[3]]);
});

test('generates JSON records from the first non-empty row with unique headers', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Data">
        <table:table-row><table:table-cell/></table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>Name</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Name</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p></text:p></table:table-cell>
          <table:table-cell office:value-type="float" office:value="0"><text:p>0</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>A</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>B</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>C</text:p></table:table-cell>
          <table:table-cell office:value-type="float" office:value="4"><text:p>4</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  assert.deepEqual(workbook.toJSON('Data'), [
    { Name: 'A', Name_2: 'B', Column3: 'C', 0: 4 },
  ]);
});

test('types explicit strings, formula-only cells, time and false booleans', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Types">
        <table:table-row>
          <table:table-cell office:value-type="string" office:string-value="explicit"><text:p></text:p></table:table-cell>
          <table:table-cell table:formula="of:=SUM([.A1:.A2])" office:value-type="float"><text:p></text:p></table:table-cell>
          <table:table-cell office:value-type="boolean" office:boolean-value="1"><text:p>TRUE</text:p></table:table-cell>
          <table:table-cell office:value-type="boolean" office:boolean-value="false"><text:p>FALSE</text:p></table:table-cell>
          <table:table-cell office:value-type="time" office:time-value="PT12H30M00S"><text:p>12:30</text:p></table:table-cell>
          <table:table-cell office:value-type="float" office:value="not-a-number"><text:p>bad</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const row = workbook.sheet('Types').rows[0];
  assert.equal(row[0].value, 'explicit');
  assert.equal(row[0].type, 'string');

  assert.equal(row[1].formula, 'of:=SUM([.A1:.A2])');
  assert.equal(row[1].value, null);
  assert.equal(row[1].type, 'float');

  assert.equal(row[2].value, true);
  assert.equal(row[3].value, false);
  assert.equal(row[4].type, 'string');
  assert.equal(row[4].value, '12:30');
  assert.equal(row[4].time, 'PT12H30M00S');
  assert.equal(row[5].value, null);

  const csv = workbook.toCSV('Types');
  assert.match(csv, /^explicit,,TRUE,FALSE,12:30,bad$/);
});

test('keeps a blank row inside a row span and renders the grid intact', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Span">
        <table:table-column table:number-columns-repeated="3"/>
        <table:table-row>
          <table:table-cell table:number-rows-spanned="3" office:value-type="string"><text:p>A</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>B</text:p></table:table-cell>
        </table:table-row>
        <table:table-row/>
        <table:table-row>
          <table:covered-table-cell/>
          <table:table-cell office:value-type="string"><text:p>C</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>D</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const sheet = workbook.sheet('Span');
  assert.equal(sheet.rows[0][0].rowSpan, 3);
  assert.deepEqual(sheet.rows[1], []);

  const html = sheet.toHTML();
  assert.match(html, /<tr><td rowspan="3" class="text">A<\/td><td class="text">B<\/td><\/tr>/);
  assert.match(html, /<tr class="odf-blank"><td><\/td><td><\/td><\/tr>/);
  assert.match(html, /<tr><td class="text">C<\/td><\/tr>/);
  assert.match(html, /<tr><td class="text">D<\/td><\/tr>/);
});

test('reads untyped cells and rows nested in groups', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Grouped">
        <table:table-column-group>
          <table:table-columns>
            <table:table-column table:number-columns-repeated="2"/>
          </table:table-columns>
        </table:table-column-group>
        <table:table-row-group>
          <table:table-rows>
            <table:table-row>
              <table:table-cell office:value-type="void"><text:p></text:p></table:table-cell>
              <table:table-cell><text:p>Untyped</text:p></table:table-cell>
            </table:table-row>
          </table:table-rows>
        </table:table-row-group>
      </table:table>
    </office:spreadsheet>`);

  const sheet = workbook.sheet('Grouped');
  assert.equal(sheet.columns.length, 2);
  assert.equal(sheet.rows.length, 1);
  assert.equal(sheet.rows[0][0].type, 'empty');
  assert.equal(sheet.rows[0][1].type, 'string');
  assert.equal(sheet.rows[0][1].value, 'Untyped');
  assert.equal(sheet.rows[0].length, 2);
});

test('reads column widths from table-header-columns', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Header">
        <table:table-header-columns>
          <table:table-column table:style-name="co1" table:number-columns-repeated="2"/>
        </table:table-header-columns>
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>X</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`, {
    automaticStyles: `
      <style:style style:name="co1" style:family="table-column">
        <style:table-column-properties style:column-width="3cm"/>
      </style:style>`,
  });

  const sheet = workbook.sheet('Header');
  assert.equal(sheet.columns.length, 2);
  assert.equal(sheet.columns[0].width, '3cm');
  assert.equal(sheet.columns[1].style, 'co1');
});

test('clips repeated rows at the row cap', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Tall">
        <table:table-row table:number-rows-repeated="20000">
          <table:table-cell office:value-type="string"><text:p>Row</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const rows = workbook.sheet('Tall').rows;
  assert.equal(rows.length, LIMITS.maxRows);
  assert.equal(rows.at(-1)[0].value, 'Row');
});

test('clips repeated columns and cells to the safety limits', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Wide">
        <table:table-column table:number-columns-repeated="5000"/>
        <table:table-row>
          <table:table-cell table:number-columns-repeated="5000" office:value-type="string"><text:p>X</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const sheet = workbook.sheet('Wide');
  assert.equal(sheet.columns.length, LIMITS.maxColumns);
  assert.equal(sheet.rows[0].length, LIMITS.maxCellRepeat);
  assert.equal(LIMITS.maxRows, 10000);
});

test('exports tabs and newlines with quoting', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Text">
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>A<text:tab/>B</text:p></table:table-cell>
          <table:table-cell office:value-type="string"><text:p>Line one</text:p><text:p>Line two</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const sheet = workbook.sheet('Text');
  assert.equal(sheet.rows[0][0].rawText, 'A\tB');
  assert.equal(sheet.rows[0][1].rawText, 'Line one\nLine two');

  const tsv = sheet.toCSV('\t');
  assert.equal(tsv, '"A\tB"\t"Line one\nLine two"');
});

test('handles workbooks with no sheets and empty sheets', async () => {
  const empty = await parseBody('<office:spreadsheet/>');
  assert.equal(empty.meta.sheetCount, 0);
  assert.deepEqual(empty.sheetNames, []);
  assert.throws(() => empty.sheet(), (error) => error.code === 'NO_SHEETS');
  assert.match(empty.toHTML(), /<body><\/body>/);

  const blank = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="Empty"/>
    </office:spreadsheet>`);
  const sheet = blank.sheet();
  assert.deepEqual(sheet.toMatrix(), []);
  assert.equal(sheet.toCSV(), '');
  assert.deepEqual(sheet.toJSON(), []);
  assert.match(sheet.toHTML(), /<tbody><\/tbody>/);
});

test('escapes sheet names in HTML and keeps them as object keys', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="&lt;Sheet&gt;">
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>Cell</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  assert.deepEqual(workbook.sheetNames, ['<Sheet>']);
  assert.match(workbook.toHTML(), /<h2 class="odf-sheet-title">&lt;Sheet&gt;<\/h2>/);
});

test('leaves covered and empty cells blank in display output', async () => {
  const workbook = await parseBody(`
    <office:spreadsheet>
      <table:table table:name="S">
        <table:table-row>
          <table:table-cell office:value-type="string"><text:p>A</text:p></table:table-cell>
          <table:table-cell/>
          <table:table-cell table:number-columns-spanned="2" office:value-type="string"><text:p>Wide</text:p></table:table-cell>
          <table:covered-table-cell/>
        </table:table-row>
      </table:table>
    </office:spreadsheet>`);

  const rows = workbook.sheet('S').rows;
  assert.equal(rows[0][1].type, 'empty');
  assert.equal(rows[0][3].covered, true);
  assert.equal(workbook.toCSV('S').endsWith(','), true);
});

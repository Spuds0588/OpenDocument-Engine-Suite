import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseODT } from '../src/index.js';
import {
  buildOdf,
  MASTER_PAGES,
  PAGE_LAYOUT,
} from '../../../test/helpers/odf.js';
import { buildZip } from '../../../test/helpers/zip.js';

async function parseBody(body, options = {}) {
  return parseODT(await buildOdf('odt', {
    body,
    styles: options.styles || '',
    title: options.title,
    layoutStyles: PAGE_LAYOUT,
    masterPages: MASTER_PAGES,
  }));
}

test('trims XML indentation at block edges and decodes heading style names', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:h text:style-name="Heading_20_1">
        Spaced title
      </text:h>
      <text:h text:style-name="Heading_20_3">Third</text:h>
      <text:p>
        Hello
        world
      </text:p>
      <text:p>  <text:span text:style-name="Bold">Bold</text:span>  </text:p>
    </office:text>`, {
    styles: `
      <style:style style:name="Bold" style:family="text">
        <style:text-properties fo:font-weight="bold"/>
      </style:style>`,
  });

  const [first, second, paragraph, spanOnly] = doc.body;
  assert.equal(first.level, 1);
  assert.equal(first.text, 'Spaced title');
  assert.equal(second.level, 3);
  assert.equal(second.text, 'Third');
  assert.equal(paragraph.text, 'Hello world');
  assert.equal(spanOnly.children.length, 1);
  assert.equal(spanOnly.children[0].content, 'Bold');
  assert.equal(spanOnly.text, 'Bold');

  doc.destroy();
});

test('caps outline levels and falls back to heading style numbers', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:h text:outline-level="9">Deep</text:h>
      <text:h text:style-name="H2">Short</text:h>
      <text:h>Plain</text:h>
    </office:text>`);

  assert.deepEqual(doc.body.map((block) => block.level), [6, 2, 1]);
  doc.destroy();
});

test('expands repeated rows and cells and reads header row groups', async () => {
  const doc = await parseBody(`
    <office:text>
      <table:table>
        <table:table-header-rows>
          <table:table-row table:number-rows-repeated="2">
            <table:table-cell table:number-columns-repeated="2"><text:p>H</text:p></table:table-cell>
          </table:table-row>
        </table:table-header-rows>
        <table:table-row>
          <table:table-cell><text:p>A</text:p></table:table-cell>
          <table:table-cell><text:p>B</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>`);

  const table = doc.body[0];
  assert.equal(table.rows.length, 3);
  assert.deepEqual(table.rows[0].cells.map((cell) => cell.children[0].text), ['H', 'H']);
  assert.deepEqual(table.rows[1].cells.map((cell) => cell.children[0].text), ['H', 'H']);
  assert.deepEqual(table.rows[2].cells.map((cell) => cell.children[0].text), ['A', 'B']);
  doc.destroy();
});

test('keeps a three-row span aligned in the HTML grid', async () => {
  const doc = await parseBody(`
    <office:text>
      <table:table>
        <table:table-row>
          <table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="3"><text:p>Tall</text:p></table:table-cell>
          <table:table-cell><text:p>B</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:covered-table-cell/>
          <table:table-cell><text:p>C</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>D</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>`);

  const rows = doc.body[0].rows;
  assert.equal(rows[1].cells.length, 1);
  assert.equal(rows[2].cells.length, 1);

  const html = doc.toHTML();
  assert.match(html, /<td colspan="2" rowspan="3"><p>Tall<\/p><\/td><td><p>B<\/p><\/td>/);
  assert.match(html, /<tr><td><p>C<\/p><\/td><\/tr>/);
  assert.match(html, /<tr><td><p>D<\/p><\/td><\/tr>/);
  doc.destroy();
});

test('aligns a multi-row span in Markdown and plain-text tables', async () => {
  const doc = await parseBody(`
    <office:text>
      <table:table>
        <table:table-row>
          <table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="3"><text:p>Tall</text:p></table:table-cell>
          <table:table-cell><text:p>B</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:covered-table-cell/>
          <table:table-cell><text:p>C</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>D</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>`);

  // A row span occupies its columns in the following rows, so C and D must
  // start after the two columns covered by "Tall".
  assert.match(
    doc.toMarkdown(),
    /\| Tall \|  \| B \|\n\| --- \| --- \| --- \|\n\|  \|  \| C \|\n\|  \|  \| D \|/,
  );
  assert.match(doc.toPlainText(), /Tall \|  \| B\n \|  \| C\n \|  \| D/);
  doc.destroy();
});

test('handles block-level frames, inline bookmarks and nested list containers', async () => {
  const doc = await parseBody(`
    <office:text>
      <draw:frame svg:width="3cm" svg:height="1cm">
        <draw:image xlink:href="https://example.com/block.png"/>
        <svg:title>Block image</svg:title>
      </draw:frame>
      <text:p><text:bookmark text:name="mark"/>Before<text:meta> field </text:meta>after</text:p>
      <text:list text:style-name="Dots">
        <text:list>
          <text:list-item><text:p>Orphan nested</text:p></text:list-item>
        </text:list>
        <text:list-item><text:p>Regular</text:p></text:list-item>
      </text:list>
    </office:text>`, {
    styles: '<style:list-style style:name="Dots"><text:list-level-style-bullet text:level="1"/></style:list-style>',
  });

  assert.equal(doc.body[0].type, 'paragraph');
  assert.equal(doc.body[0].children[0].type, 'image');
  assert.equal(doc.body[0].children[0].alt, 'Block image');
  assert.equal(doc.body[1].text, 'Before field after');

  const list = doc.body[2];
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0][0].type, 'list');
  assert.equal(list.items[0][0].items[0][0].text, 'Orphan nested');
  assert.equal(list.items[1][0].text, 'Regular');
  doc.destroy();
});

test('parses sections and unknown containers, skipping indexes and notes', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:table-of-content>
        <text:index-body><text:p>TOC entry</text:p></text:index-body>
      </text:table-of-content>
      <text:section><text:p>Inside section</text:p></text:section>
      <text:p>Before<text:note><text:note-body><text:p>Footnote</text:p></text:note-body></text:note>After</text:p>
      <text:foo><text:p>Unknown nested</text:p></text:foo>
    </office:text>`);

  const text = doc.toPlainText();
  assert.match(text, /Inside section/);
  assert.match(text, /BeforeAfter/);
  assert.match(text, /Unknown nested/);
  assert.equal(text.includes('TOC entry'), false);
  assert.equal(text.includes('Footnote'), false);
  doc.destroy();
});

test('handles external and missing images plus non-image frames', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:p>
        <draw:frame svg:width="2cm" svg:height="1cm">
          <draw:image xlink:href="https://example.com/remote.png"/>
          <svg:title>Remote alt</svg:title>
        </draw:frame>
      </text:p>
      <text:p><draw:image xlink:href="Pictures/missing.png"/></text:p>
      <text:p><draw:frame><draw:text-box><text:p>Ignored box</text:p></draw:text-box></draw:frame></text:p>
    </office:text>`);

  const image = doc.body[0].children[0];
  assert.equal(image.type, 'image');
  assert.equal(image.src, 'https://example.com/remote.png');
  assert.equal(image.alt, 'Remote alt');

  const missing = doc.body[1].children[0];
  assert.equal(missing.type, 'image');
  assert.equal(missing.src, null);

  assert.equal(doc.body.length, 3);
  assert.deepEqual(doc.body[2].children, []);
  assert.equal(doc.toHTML().includes('Ignored box'), false);
  doc.destroy();
});

test('escapes HTML and Markdown output, including table pipes', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:h>A &amp; B &lt; C</text:h>
      <text:p>*star* [bracket]</text:p>
      <table:table>
        <table:table-row>
          <table:table-cell><text:p>A | B</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>`, {
    title: '&lt;script&gt;alert(1)&lt;/script&gt;',
  });

  const html = doc.toHTML();
  assert.match(html, /<h1>A &amp; B &lt; C<\/h1>/);
  assert.match(html, /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
  assert.equal(html.includes('<script>alert'), false);

  const markdown = doc.toMarkdown();
  assert.match(markdown, /\\\*star\\\* \\\[bracket\\\]/);
  assert.match(markdown, /A \\\| B/);
  doc.destroy();
});

test('numbers ordered lists in plain text', async () => {
  const doc = await parseBody(`
    <office:text>
      <text:list text:style-name="Numbering">
        <text:list-item><text:p>First</text:p></text:list-item>
        <text:list-item><text:p>Second</text:p></text:list-item>
      </text:list>
    </office:text>`, {
    styles: '<style:list-style style:name="Numbering"><text:list-level-style-number text:level="1"/></style:list-style>',
  });

  assert.equal(doc.toPlainText(), '1. First\n2. Second\n');
  assert.match(doc.toMarkdown(), /^1\. First\n2\. Second/m);
  doc.destroy();
});

test('renders empty documents and exposes a clean AST', async () => {
  const doc = await parseBody('<office:text/>');

  assert.deepEqual(doc.body, []);
  assert.equal(doc.toHTML().startsWith('<!DOCTYPE html>'), true);
  assert.match(doc.toHTML(), /<article class="odf-page"><\/article>/);
  assert.equal(doc.toMarkdown(), '\n');
  assert.equal(doc.toPlainText(), '\n');

  const ast = doc.toAST();
  assert.equal('_styles' in ast, false);
  assert.doesNotThrow(() => JSON.stringify(ast));
  doc.destroy();
});

test('rejects archives without content.xml', async () => {
  const bytes = await buildZip([
    { name: 'mimetype', content: 'application/vnd.oasis.opendocument.text', store: true },
  ]);
  await assert.rejects(
    () => parseODT(bytes),
    (error) => error.code === 'NOT_ODF',
  );
});

test('parses a differently-flavoured container as an empty text document', async () => {
  const bytes = await buildOdf('ods', {
    body: '<office:spreadsheet><table:table table:name="S"/></office:spreadsheet>',
  });
  const doc = await parseODT(bytes);

  assert.equal(doc.meta.format, 'odt');
  assert.deepEqual(doc.body, []);
  doc.destroy();
});

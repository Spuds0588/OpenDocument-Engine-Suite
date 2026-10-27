import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseODT } from '../src/index.js';
import { buildOdf, MASTER_PAGES, PAGE_LAYOUT, TINY_PNG } from '../../../test/helpers/odf.js';

const STYLES = `
<style:style style:name="Heading_20_1" style:family="paragraph">
  <style:text-properties fo:font-size="18pt" fo:font-weight="bold" fo:color="#222222"/>
</style:style>
<style:style style:name="Bold" style:family="text">
  <style:text-properties fo:font-weight="bold" fo:font-style="italic"/>
</style:style>
<style:list-style style:name="Numbering">
  <text:list-level-style-number text:level="1" style:num-format="1"/>
</style:list-style>
<style:list-style style:name="Bullets">
  <text:list-level-style-bullet text:level="1" text:bullet-char="•"/>
</style:list-style>`;

const BODY = `
<office:text>
  <text:h text:outline-level="1" text:style-name="Heading_20_1">Report title</text:h>
  <text:p text:style-name="Standard">Hello <text:span text:style-name="Bold">world</text:span> and <text:a xlink:href="https://example.com">a link</text:a>.<text:s text:c="2"/>Tail<text:tab/>end</text:p>
  <text:p/>
  <text:list text:style-name="Numbering">
    <text:list-item>
      <text:p>First</text:p>
      <text:list text:style-name="Bullets">
        <text:list-item><text:p>Nested</text:p></text:list-item>
      </text:list>
    </text:list-item>
    <text:list-item><text:p>Second</text:p></text:list-item>
  </text:list>
  <table:table table:style-name="Table1">
    <table:table-column table:number-columns-repeated="3"/>
    <table:table-row>
      <table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="2">
        <text:p>Merged</text:p>
      </table:table-cell>
      <table:table-cell><text:p>C1</text:p></table:table-cell>
    </table:table-row>
    <table:table-row>
      <table:covered-table-cell/>
      <table:table-cell><text:p>C2</text:p></table:table-cell>
    </table:table-row>
  </table:table>
  <text:p><draw:frame svg:width="2cm" svg:height="1cm"><draw:image xlink:href="Pictures/logo.png"/></draw:frame></text:p>
</office:text>`;

async function parseFixture() {
  const bytes = await buildOdf('odt', {
    title: 'Quarterly Report',
    body: BODY,
    styles: STYLES,
    layoutStyles: PAGE_LAYOUT,
    masterPages: MASTER_PAGES,
    pictures: { 'logo.png': TINY_PNG },
  });
  return parseODT(bytes);
}

test('reads metadata and page layout', async () => {
  const doc = await parseFixture();
  assert.equal(doc.meta.format, 'odt');
  assert.equal(doc.meta.title, 'Quarterly Report');
  assert.equal(doc.meta.pageLayout.width, '21cm');
  assert.equal(doc.meta.pageLayout.height, '29.7cm');
  assert.equal(doc.meta.pageLayout.marginLeft, '2.5cm');
  assert.equal(doc.meta.pageLayout.orientation, 'portrait');
  doc.destroy();
});

test('parses headings, inline styles, links and whitespace nodes', async () => {
  const doc = await parseFixture();
  const [heading, paragraph] = doc.body;

  assert.equal(heading.type, 'heading');
  assert.equal(heading.level, 1);
  assert.equal(heading.text, 'Report title');

  assert.equal(paragraph.type, 'paragraph');
  assert.equal(paragraph.text, 'Hello world and a link.  Tail\tend');

  const span = paragraph.children.find((child) => child.type === 'span');
  assert.equal(span.content, 'world');
  assert.equal(span.style, 'Bold');

  const link = paragraph.children.find((child) => child.type === 'span' && child.href);
  assert.equal(link.href, 'https://example.com');
  assert.equal(link.content, 'a link');

  doc.destroy();
});

test('parses nested lists with ordered and bullet markers', async () => {
  const doc = await parseFixture();
  const list = doc.body.find((block) => block.type === 'list');

  assert.ok(list);
  assert.equal(list.ordered, true);
  assert.equal(list.items.length, 2);
  assert.deepEqual(list.items[0][0].text, 'First');

  const nested = list.items[0].find((block) => block.type === 'list');
  assert.ok(nested);
  assert.equal(nested.ordered, false);
  assert.equal(nested.items[0][0].text, 'Nested');
  doc.destroy();
});

test('parses tables with merged cells and drops covered placeholders', async () => {
  const doc = await parseFixture();
  const table = doc.body.find((block) => block.type === 'table');

  assert.ok(table);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].cells.length, 2);
  assert.equal(table.rows[0].cells[0].colSpan, 2);
  assert.equal(table.rows[0].cells[0].rowSpan, 2);
  assert.equal(table.rows[0].cells[0].children[0].text, 'Merged');
  assert.equal(table.rows[1].cells.length, 1);
  assert.equal(table.rows[1].cells[0].children[0].text, 'C2');
  doc.destroy();
});

test('resolves embedded images to Blob URLs', async () => {
  const doc = await parseFixture();
  const paragraph = doc.body[doc.body.length - 1];
  const image = paragraph.children[0];

  assert.equal(image.type, 'image');
  assert.match(image.src, /^(blob:|data:)/);
  assert.equal(image.width, '2cm');
  assert.equal(image.height, '1cm');
  assert.ok(doc.resources.images['Pictures/logo.png']);
  doc.destroy();
});

test('renders print-ready HTML with page rules, spans and images', async () => {
  const doc = await parseFixture();
  const html = doc.toHTML();

  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /@page\{size:21cm 29\.7cm;margin:2cm 2cm 2cm 2\.5cm\}/);
  assert.match(html, /<h1[^>]*>Report title<\/h1>/);
  assert.match(html, /<span style="[^"]*font-weight:bold/);
  assert.match(html, /<a href="https:\/\/example\.com"/);
  assert.match(html, /colspan="2" rowspan="2"/);
  assert.match(html, /<img src="(?:blob|data):[^"]*" alt=""/);
  assert.match(html, /<p>&#160;<\/p>/);

  doc.destroy();
});

test('renders Markdown and plain text', async () => {
  const doc = await parseFixture();
  const markdown = doc.toMarkdown();
  const text = doc.toPlainText();

  assert.match(markdown, /^# Report title/m);
  assert.match(markdown, /1\. First/);
  assert.match(markdown, /- Nested/);
  assert.match(markdown, /\*\*\*world\*\*\*/);
  assert.match(markdown, /\[a link\]\(https:\/\/example\.com\)/);
  assert.match(markdown, /\| Merged \|/);

  assert.match(text, /Report title/);
  assert.match(text, /Hello world and a link\./);
  assert.match(text, /- Nested/);
  doc.destroy();
});

test('destroy clears resources and is idempotent', async () => {
  const doc = await parseFixture();
  assert.equal(Object.keys(doc.resources.images).length, 1);
  doc.destroy();
  doc.destroy();
  assert.equal(Object.keys(doc.resources.images).length, 0);
});

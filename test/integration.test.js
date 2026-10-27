import './helpers/env.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { parseODT, triggerPrintToPDF as printODT } from '../packages/odt-engine/src/index.js';
import { parseODS, triggerPrintToPDF as printODS } from '../packages/ods-engine/src/index.js';
import { parseODP, triggerPrintToPDF as printODP } from '../packages/odp-engine/src/index.js';
import { buildOdf } from './helpers/odf.js';
import { buildZip } from './helpers/zip.js';

const ENGINES = [
  ['odt-engine', parseODT],
  ['ods-engine', parseODS],
  ['odp-engine', parseODP],
];

test('all published packages keep empty dependency maps', async () => {
  for (const [name] of ENGINES) {
    const manifest = JSON.parse(
      await readFile(new URL(`../packages/${name}/package.json`, import.meta.url), 'utf8'),
    );
    assert.deepEqual(manifest.dependencies, {}, `${name} must stay dependency-free`);
    assert.equal(manifest.type, 'module');
    assert.equal(manifest.main, './dist/index.js');
  }
});

test('every engine rejects non-ZIP input and archives without content.xml', async () => {
  const notZip = new TextEncoder().encode('plain text, not a container');
  const incomplete = await buildZip([
    { name: 'mimetype', content: 'application/vnd.oasis.opendocument.text', store: true },
  ]);

  for (const [name, parse] of ENGINES) {
    await assert.rejects(
      () => parse(notZip),
      (error) => error.code === 'NOT_A_ZIP',
      `${name} should reject non-ZIP input`,
    );
    await assert.rejects(
      () => parse(incomplete),
      (error) => error.code === 'NOT_ODF',
      `${name} should reject a container without content.xml`,
    );
  }
});

test('an ODS container parsed by the other engines yields an empty AST', async () => {
  const bytes = await buildOdf('ods', {
    body: `<office:spreadsheet><table:table table:name="S">
      <table:table-row><table:table-cell office:value-type="string"><text:p>X</text:p></table:table-cell></table:table-row>
    </table:table></office:spreadsheet>`,
  });

  const text = await parseODT(bytes);
  assert.deepEqual(text.body, []);
  text.destroy();

  const deck = await parseODP(bytes);
  assert.deepEqual(deck.slides, []);
  deck.destroy();
});

test('AST exports are plain JSON and destroy is idempotent', async () => {
  const odt = await parseODT(await buildOdf('odt', {
    body: '<office:text><text:p>Text</text:p></office:text>',
  }));
  const ods = await parseODS(await buildOdf('ods', {
    body: `<office:spreadsheet><table:table table:name="S">
      <table:table-row><table:table-cell office:value-type="float" office:value="1"><text:p>1</text:p></table:table-cell></table:table-row>
    </table:table></office:spreadsheet>`,
  }));
  const odp = await parseODP(await buildOdf('odp', {
    body: `<office:presentation><draw:page draw:name="P">
      <draw:frame svg:width="5cm" svg:height="2cm"><draw:text-box><text:p>Slide</text:p></draw:text-box></draw:frame>
    </draw:page></office:presentation>`,
  }));

  assert.equal(JSON.parse(JSON.stringify(odt.toAST())).meta.format, 'odt');
  assert.equal(JSON.parse(JSON.stringify(ods.toAST())).meta.sheetCount, 1);
  assert.equal(JSON.parse(JSON.stringify(odp.toAST())).meta.slideCount, 1);

  for (const document of [odt, ods, odp]) {
    document.destroy();
    document.destroy();
  }
});

test('every engine exposes the print bridge', () => {
  for (const fn of [printODT, printODS, printODP]) {
    assert.equal(typeof fn, 'function');
  }
});

// Real producer output, not containers built in memory. Provenance and checksums
// for these files live in test/fixtures/real/README.md.
const readReal = async (name) => new Uint8Array(await readFile(new URL(`./fixtures/real/${name}`, import.meta.url)));

const paragraphTexts = (nodes) => nodes.flatMap((node) => [
  ...(node.text ? [node.text] : []),
  ...(node.content?.paragraphs || []).map((paragraph) => paragraph.text),
  ...(node.children ? paragraphTexts(node.children) : []),
  ...(node.elements ? paragraphTexts(node.elements) : []),
]);

test('real LibreOffice and StarOffice text documents parse and export', async () => {
  const characterStyles = await parseODT(await readReal('character-styles.odt'));
  assert.equal(characterStyles.meta.pageLayout.width, '21.001cm');
  const headings = characterStyles.body.filter((block) => block.type === 'heading');
  assert.equal(headings.length, 12);
  assert.equal(headings[0].level, 2);
  assert.equal(headings[0].text, 'Bold');
  assert.match(characterStyles.toMarkdown(), /^## Bold$/m);
  assert.match(characterStyles.toHTML(), /<h2/);
  characterStyles.destroy();

  const starOffice = await parseODT(await readReal('compdocfileformat.odt'));
  assert.equal(starOffice.meta.title, 'The Microsoft Compound Document File Format');
  assert.equal(starOffice.body.filter((block) => block.type === 'table').length, 21);
  assert.equal(starOffice.body.filter((block) => block.type === 'list').length, 29);
  assert.equal(starOffice.body.filter((block) => block.type === 'heading').length, 41);
  const markdown = starOffice.toMarkdown();
  assert.ok(markdown.split('\n').filter((line) => line.startsWith('|')).length > 150, 'Markdown table rows');
  assert.match(markdown, /!\[[^\]]*\]\(blob:/);
  assert.ok(Object.keys(starOffice.resources.images).length > 0, 'embedded picture');
  starOffice.destroy();
});

test('a third-party spreadsheet with a default XML namespace keeps its typed cells', async () => {
  const workbook = await parseODS(await readReal('default_namespace.ods'));
  assert.equal(workbook.meta.sheetCount, 19);
  const sheet = workbook.sheet(workbook.sheetNames[0]);
  assert.equal(sheet.rows.length, 13);
  assert.equal(sheet.columns.length, 387);

  const types = new Set(sheet.rows.flat().map((cell) => cell.type));
  for (const type of ['string', 'float', 'boolean', 'date']) {
    assert.ok(types.has(type), `expected ${type} cells`);
  }

  assert.match(workbook.toCSV(workbook.sheetNames[0]), /^Participant ID/);
  assert.equal(workbook.toJSON(workbook.sheetNames[0]).length, 12);
  workbook.destroy();
});

test('real presentations parse foreign prefixes and degrade on embedded objects', async () => {
  const foreignPrefixes = await parseODP(await readReal('XPathTest-foreignPrefix.odp'));
  assert.equal(foreignPrefixes.meta.slideCount, 2);
  assert.deepEqual(foreignPrefixes.meta.dimensions, { width: '28cm', height: '21cm' });
  assert.deepEqual(paragraphTexts(foreignPrefixes.slides), [
    'Slide dummyOne!!', 'Somegood Content!!', 'Slide dummyTwo!!', 'Point A', 'Point B', 'Point C',
  ]);
  assert.match(foreignPrefixes.toMarkdown(), /^## Slide 2$/m);
  foreignPrefixes.destroy();

  const embedded = await parseODP(await readReal('presentationWithEmbedDoc.odp'));
  assert.equal(embedded.meta.slideCount, 3);
  // The first slide holds an embedded chart: its text box is empty and the
  // replacement image is not in the archive, so the slide stays blank.
  assert.deepEqual(embedded.slides[0].elements, []);
  assert.deepEqual(embedded.slides[1].elements.map((element) => element.type), ['text-box', 'image']);
  assert.match(embedded.toHTML(), /class="odp-slide"/);
  embedded.destroy();
});

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

/** Parse one fixture through each built dist bundle to verify published output. */

import '../test/helpers/env.js';
import assert from 'node:assert/strict';

import { parseODT } from '../packages/odt-engine/dist/index.js';
import { parseODS } from '../packages/ods-engine/dist/index.js';
import { parseODP } from '../packages/odp-engine/dist/index.js';
import { buildOdf, MASTER_PAGES, PAGE_LAYOUT, TINY_PNG } from '../test/helpers/odf.js';

const odt = await parseODT(await buildOdf('odt', {
  title: 'Smoke',
  body: '<office:text><text:h text:outline-level="1">Smoke</text:h><text:p>Body</text:p></office:text>',
  layoutStyles: PAGE_LAYOUT,
  masterPages: MASTER_PAGES,
}));
assert.equal(odt.meta.title, 'Smoke');
assert.match(odt.toHTML(), /@page\{size:21cm 29\.7cm/);
assert.match(odt.toMarkdown(), /^# Smoke/);
odt.destroy();

const ods = await parseODS(await buildOdf('ods', {
  body: `<office:spreadsheet><table:table table:name="S">
    <table:table-row><table:table-cell office:value-type="string"><text:p>Value</text:p></table:table-cell></table:table-row>
    <table:table-row><table:table-cell office:value-type="float" office:value="2"><text:p>2</text:p></table:table-cell></table:table-row>
  </table:table></office:spreadsheet>`,
}));
assert.deepEqual(ods.toJSON('S'), [{ Value: 2 }]);
assert.match(ods.toHTML(), /@page\{size:A4 landscape/);

const odp = await parseODP(await buildOdf('odp', {
  body: `<office:presentation><draw:page draw:name="p1">
    <draw:frame svg:x="1cm" svg:y="1cm" svg:width="5cm" svg:height="2cm">
      <draw:text-box><text:p>Hi</text:p></draw:text-box>
    </draw:frame>
  </draw:page></office:presentation>`,
  layoutStyles: PAGE_LAYOUT,
  masterPages: MASTER_PAGES,
  pictures: { 'logo.png': TINY_PNG },
}));
assert.equal(odp.meta.slideCount, 1);
assert.match(odp.toHTML(), /class="odp-slide"/);
assert.match(odp.toMarkdown(), /### Hi/);
odp.destroy();

console.log('dist smoke test passed: odt, ods and odp bundles parse and render.');

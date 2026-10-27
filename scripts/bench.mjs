/**
 * Measure parse time for roughly 5 MB of document XML.
 *
 * Node with jsdom is a deliberately conservative environment: browser
 * DOMParser implementations are typically faster, but this gives a repeatable
 * lower bound. Run with `npm run bench`.
 */

import '../test/helpers/env.js';
import { performance } from 'node:perf_hooks';

import { parseODT } from '../packages/odt-engine/src/index.js';
import { parseODS } from '../packages/ods-engine/src/index.js';
import { parseODP } from '../packages/odp-engine/src/index.js';
import { buildOdf, MASTER_PAGES, PAGE_LAYOUT } from '../test/helpers/odf.js';

const TARGET_BYTES = 5 * 1024 * 1024;
const TARGET_MS = 150;
const RUNS = 3;

function fill(unit, size = TARGET_BYTES) {
  let body = '';
  let index = 0;
  while (body.length < size) body += unit(index++);
  return body;
}

async function measure(name, parse, bytes, xmlSize) {
  const times = [];
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now();
    const document = await parse(bytes);
    times.push(performance.now() - start);
    document.destroy();
  }
  times.sort((a, b) => a - b);

  const median = times[Math.floor(times.length / 2)];
  const status = median <= TARGET_MS ? 'ok  ' : 'SLOW';
  console.log(
    `${status} ${name}  ${(xmlSize / 1048576).toFixed(2)} MB XML / `
    + `${(bytes.byteLength / 1048576).toFixed(2)} MB container  `
    + `${median.toFixed(0)} ms median (${times.map((time) => time.toFixed(0)).join(', ')} ms)`,
  );
  return median <= TARGET_MS;
}

const odtBody = fill((index) =>
  `<text:p text:style-name="Standard">Paragraph ${index}: Lorem ipsum dolor sit amet, `
  + 'consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</text:p>');

const odsRows = fill((index) =>
  `<table:table-row>`
  + `<table:table-cell office:value-type="string"><text:p>Row ${index}</text:p></table:table-cell>`
  + '<table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="string"><text:p>Alpha beta gamma delta epsilon zeta</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>'
  + '<table:table-cell office:value-type="string"><text:p>Tail cell</text:p></table:table-cell>'
  + '</table:table-row>', 4 * 1024 * 1024);

const odpSlides = fill((index) =>
  `<draw:page draw:name="Slide ${index}" draw:master-page-name="Standard">`
  + '<draw:frame svg:x="1cm" svg:y="1cm" svg:width="20cm" svg:height="4cm">'
  + `<draw:text-box><text:p>Slide ${index} title</text:p>`
  + '<text:list><text:list-item><text:p>First bullet point for the slide</text:p></text:list-item>'
  + '<text:list-item><text:p>Second bullet point for the slide</text:p></text:list-item></text:list>'
  + '</draw:text-box></draw:frame></draw:page>', 4 * 1024 * 1024);

const odtXml = `<office:text>${odtBody}</office:text>`;
const odsXml = `<office:spreadsheet><table:table table:name="Bench">${odsRows}</table:table></office:spreadsheet>`;
const odpXml = `<office:presentation>${odpSlides}</office:presentation>`;

const fixtures = [
  ['odt', parseODT, await buildOdf('odt', {
    body: odtXml,
    layoutStyles: PAGE_LAYOUT,
    masterPages: MASTER_PAGES,
  }), odtXml.length],
  ['ods', parseODS, await buildOdf('ods', { body: odsXml }), odsXml.length],
  ['odp', parseODP, await buildOdf('odp', {
    body: odpXml,
    layoutStyles: PAGE_LAYOUT,
    masterPages: MASTER_PAGES,
  }), odpXml.length],
];

console.log(`Parse target: ${TARGET_MS} ms for a file under 5 MB (${RUNS} runs, median).\n`);
const results = [];
for (const [name, parse, bytes, xmlSize] of fixtures) {
  results.push(await measure(name, parse, bytes, xmlSize));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} engines met the ${TARGET_MS} ms target.`);
if (passed !== results.length) process.exitCode = 1;

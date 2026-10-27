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
import { odtXml, odsXml, odpXml, TARGET_MS } from '../test/helpers/bench.js';

const RUNS = 3;

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

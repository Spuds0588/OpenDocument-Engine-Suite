/**
 * Run the browser conformance suite (and optionally the 5 MB benchmark) in
 * headless Chrome.
 *
 * The page is served over loopback so ES modules and Blob URLs behave exactly
 * as they would in an application. `npm run build` must have run first; the
 * suite imports the published dist bundles, not the source files.
 *
 * Usage: node scripts/browser.mjs [--bench] [--headed]
 *   CHROME_PATH=/path/to/chrome overrides Chrome discovery.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const ALLOWED = ['/test/browser/', '/test/helpers/', '/test/fixtures/', '/packages/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const args = new Set(process.argv.slice(2));
const withBench = args.has('--bench');
const headed = args.has('--headed') || process.env.HEADED === '1';

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  if (!ALLOWED.some((prefix) => pathname.startsWith(prefix))) {
    response.writeHead(404).end('not found');
    return;
  }
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

let browser;
try {
  browser = await chromium.launch({
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
    executablePath: process.env.CHROME_PATH || undefined,
    headless: !headed,
    // The benchmark calls gc() between runs so a collection lands outside the
    // timed parse instead of adding tens of milliseconds of noise.
    args: ['--js-flags=--expose-gc'],
  });
} catch (error) {
  console.error(`Could not launch Chrome: ${error.message}`);
  console.error('Install Chrome or set CHROME_PATH to its executable.');
  server.close();
  process.exit(1);
}

const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => {
  pageErrors.push(error.message);
  console.error(`page error: ${error.message}`);
});
page.on('console', (message) => {
  // The suite deliberately fetches a revoked Blob URL to prove teardown; the
  // browser reports that expected rejection as ERR_FILE_NOT_FOUND.
  if (message.type() === 'error' && !message.text().includes('ERR_FILE_NOT_FOUND')) {
    consoleErrors.push(message.text());
    console.error(`console error: ${message.text()}`);
  }
});

const failures = [];

try {
  await page.goto(`${origin}/test/browser/page.html${withBench ? '?bench=1' : ''}`, {
    waitUntil: 'load',
    timeout: 120000,
  });
  try {
    await page.waitForFunction(() => window.__odfDone === true, null, { timeout: 180000 });
  } catch (error) {
    console.error(`\nSuite did not finish: ${error.message}`);
    const body = await page.evaluate(() => document.getElementById('output')?.textContent || '');
    if (body) console.error(`\nPage output:\n${body}`);
    throw error;
  }

  const { tests, passed, failed } = await page.evaluate(() => window.__odfResults);
  for (const result of tests) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
    if (!result.ok) {
      failures.push(result);
      console.log(`      ${result.error}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (Chrome ${browser.version()})`);

  const metrics = await page.evaluate(() => window.__odfMetrics || null);
  if (metrics?.memory) {
    const { cycles, xmlBytes, growth } = metrics.memory;
    console.log(
      `\nmemory after ${cycles} parse + toHTML + destroy cycles on ${(xmlBytes / 1024).toFixed(0)} KB of XML: `
      + `${growth >= 0 ? '+' : ''}${(growth / 1024).toFixed(0)} KB retained heap`,
    );
  }

  if (withBench) {
    const bench = await page.evaluate(() => window.__odfBench || { error: window.__odfBenchError });
    if (!bench || bench.error) {
      console.error(`\nBenchmark failed in the browser: ${bench?.error || 'no result'}`);
      failures.push({ name: 'benchmark', error: bench?.error || 'no result' });
    } else {
      console.log(`\nBrowser parse benchmark (${bench.runs.length} engines, ${bench.runs[0].times.length} runs after warm-up, median, target ${bench.target} ms):`);
      for (const run of bench.runs) {
        console.log(
          `${run.met ? 'ok  ' : 'SLOW'} ${run.name}  `
          + `${(run.xmlSize / 1048576).toFixed(2)} MB XML / ${(run.containerSize / 1048576).toFixed(2)} MB container  `
          + `${run.median.toFixed(0)} ms median (${run.times.map((time) => time.toFixed(0)).join(', ')} ms)`,
        );
        if (!run.met) failures.push({ name: `bench:${run.name}`, error: `${run.median.toFixed(0)} ms` });
      }
    }
  }

  if (pageErrors.length) console.error(`\nUncaught page errors:\n- ${pageErrors.join('\n- ')}`);
  if (consoleErrors.length) console.error(`\nConsole errors:\n- ${consoleErrors.join('\n- ')}`);
  if (pageErrors.length) failures.push({ name: 'page errors', error: pageErrors.join('; ') });
} finally {
  await browser.close();
  server.close();
}

if (failures.length) process.exitCode = 1;

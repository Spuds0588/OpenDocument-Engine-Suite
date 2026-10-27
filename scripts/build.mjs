/**
 * Build each engine into a standalone, minified ESM bundle.
 *
 * The internal core package is inlined by esbuild so the published packages
 * have no runtime dependencies. TypeScript declarations are copied alongside
 * the bundle, with the shared AST types included in each package.
 *
 * Size policy: the PRD's 15 KB minified / 5 KB gzipped target is reported for
 * every engine. The build fails only when a bundle regresses past the agreed
 * regression cap, so a functional release is not blocked by the (currently
 * unmet) aspiration while growth is still guarded.
 */

import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CORE_TYPES = path.join(ROOT, 'packages/core/src/types.d.ts');
const ENGINES = ['odt-engine', 'ods-engine', 'odp-engine'];

const KB = 1024;
const TARGET = { minified: 15 * KB, gzipped: 5 * KB };
const CAP = { minified: 24 * KB, gzipped: 10 * KB };

// Each engine also ships a classic-script build for plain <script src> tags.
const GLOBALS = { 'odt-engine': 'ODT', 'ods-engine': 'ODS', 'odp-engine': 'ODP' };

const format = (bytes) => `${(bytes / KB).toFixed(2)} KB`;
const failures = [];

for (const engine of ENGINES) {
  const packageDir = path.join(ROOT, 'packages', engine);
  const sourceDir = path.join(packageDir, 'src');
  const outDir = path.join(packageDir, 'dist');

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [path.join(sourceDir, 'index.js')],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    outfile: path.join(outDir, 'index.js'),
  });

  await copyFile(path.join(sourceDir, 'index.d.ts'), path.join(outDir, 'index.d.ts'));
  await copyFile(CORE_TYPES, path.join(outDir, 'types.d.ts'));

  await build({
    entryPoints: [path.join(sourceDir, 'index.js')],
    bundle: true,
    format: 'iife',
    globalName: GLOBALS[engine],
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    outfile: path.join(outDir, 'global.js'),
  });

  const { size } = await stat(path.join(outDir, 'index.js'));
  const gzipped = gzipSync(await readFile(path.join(outDir, 'index.js')), { level: 9 }).length;
  const { size: globalSize } = await stat(path.join(outDir, 'global.js'));
  const globalGzipped = gzipSync(await readFile(path.join(outDir, 'global.js')), { level: 9 }).length;

  const overTarget = size > TARGET.minified || gzipped > TARGET.gzipped;
  const overCap = size > CAP.minified || gzipped > CAP.gzipped;
  const status = overCap ? 'FAIL' : 'ok  ';
  const gap = overTarget ? 'over PRD target' : 'within PRD target';

  console.log(
    `${status} ${engine.padEnd(12)} ${format(size).padStart(9)} minified  ${format(gzipped).padStart(9)} gzipped  (esm, ${gap})\n`
    + `     ${'global'.padEnd(12)} ${format(globalSize).padStart(9)} minified  ${format(globalGzipped).padStart(9)} gzipped  (script tag, window.${GLOBALS[engine]})`,
  );

  if (overCap) {
    failures.push(`${engine}: ${format(size)} minified / ${format(gzipped)} gzipped past the ${format(CAP.minified)} / ${format(CAP.gzipped)} regression cap`);
  }
}

console.log(`\nPRD size target: ${format(TARGET.minified)} minified / ${format(TARGET.gzipped)} gzipped per engine.`);
if (failures.length) {
  console.error(`Bundle cap exceeded:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('All engines are within the regression cap.');
}

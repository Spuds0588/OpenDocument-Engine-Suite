import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertOdfArchive, unzipContainer } from '../src/zip.js';
import { buildZip } from '../../../test/helpers/zip.js';

const encoder = new TextEncoder();

test('reads stored and deflated entries', async () => {
  const bytes = await buildZip([
    { name: 'mimetype', content: 'application/vnd.oasis.opendocument.text', store: true },
    { name: 'content.xml', content: '<office:document-content>Hello</office:document-content>' },
    { name: 'Pictures/logo.bin', content: new Uint8Array([1, 2, 3, 4, 5]) },
  ]);

  const archive = await unzipContainer(bytes);
  assert.deepEqual(
    archive.list().sort(),
    ['Pictures/logo.bin', 'content.xml', 'mimetype'],
  );
  assert.equal(await archive.text('content.xml'), '<office:document-content>Hello</office:document-content>');
  assert.deepEqual(Array.from(archive.bytes('Pictures/logo.bin')), [1, 2, 3, 4, 5]);
  assert.equal(archive.has('styles.xml'), false);
  assert.throws(() => archive.bytes('styles.xml'), /Missing archive entry/);
});

test('accepts Blob input', async () => {
  const bytes = await buildZip([{ name: 'a.txt', content: 'alpha' }]);
  const archive = await unzipContainer(new Blob([bytes]));
  assert.equal(await archive.text('a.txt'), 'alpha');
});

test('reads real deflate output for large text', async () => {
  const content = encoder.encode('abcdef'.repeat(5000));
  const bytes = await buildZip([{ name: 'big.txt', content }]);
  const archive = await unzipContainer(bytes);
  assert.equal((await archive.text('big.txt')).length, content.length);
});

test('ignores an EOCD signature inside the archive comment', async () => {
  const comment = `${'Z'.repeat(8)}PK\x05\x06${'Z'.repeat(22)}`;
  const bytes = await buildZip([{ name: 'a.txt', content: 'alpha' }], { comment });
  const archive = await unzipContainer(bytes);
  assert.deepEqual(archive.list(), ['a.txt']);
  assert.equal(await archive.text('a.txt'), 'alpha');
});


test('reads a clean archive comment and UTF-8 entry names', async () => {
  const bytes = await buildZip(
    [{ name: 'Pictures/naïve.png', content: new Uint8Array([7, 8, 9]) }],
    { comment: 'produced by the fixture writer' },
  );
  const archive = await unzipContainer(bytes);
  assert.equal(archive.has('Pictures/naïve.png'), true);
  assert.deepEqual(Array.from(archive.bytes('Pictures/naïve.png')), [7, 8, 9]);
});

test('reads a typed-array view that does not start at the buffer origin', async () => {
  const bytes = await buildZip([{ name: 'a.txt', content: 'offset' }]);
  const padded = new Uint8Array(bytes.length + 16).fill(0xff);
  padded.set(bytes, 8);
  const view = padded.subarray(8, 8 + bytes.length);

  const archive = await unzipContainer(view);
  assert.equal(await archive.text('a.txt'), 'offset');

  const buffer = Uint8Array.from(bytes).buffer;
  const fromBuffer = await unzipContainer(buffer);
  assert.equal(await fromBuffer.text('a.txt'), 'offset');
});

test('skips encrypted entries and unsupported compression methods', async () => {
  const bytes = await buildZip([
    { name: 'visible.txt', content: 'shown', store: true },
    { name: 'encrypted.txt', content: 'secret', flags: 0x0801 },
    { name: 'bzip.txt', content: 'other', method: 12 },
  ]);
  const archive = await unzipContainer(bytes);
  assert.deepEqual(archive.list(), ['visible.txt']);
  assert.equal(await archive.text('visible.txt'), 'shown');
});

test('rejects ZIP64 archives', async () => {
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(10, 0xffff, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, 0, true);

  await assert.rejects(
    () => unzipContainer(eocd),
    (error) => error.name === 'OdfError' && error.code === 'ZIP64_UNSUPPORTED',
  );
});

test('fails with a tagged error when DecompressionStream is unavailable', async () => {
  const bytes = await buildZip([{ name: 'a.txt', content: 'deflated content' }]);
  const original = globalThis.DecompressionStream;
  delete globalThis.DecompressionStream;
  try {
    await assert.rejects(
      () => unzipContainer(bytes),
      (error) => error.code === 'NO_DECOMPRESSION_STREAM',
    );
  } finally {
    globalThis.DecompressionStream = original;
  }
});

test('reports a corrupt local header', async () => {
  const bytes = await buildZip([{ name: 'a.txt', content: 'alpha' }]);
  bytes.fill(0, 0, 4);

  await assert.rejects(
    () => unzipContainer(bytes),
    (error) => error.name === 'OdfError' && error.code === 'BAD_LOCAL_HEADER',
  );
});

test('accepts ODF containers without a mimetype entry', async () => {
  const archive = await unzipContainer(await buildZip([
    { name: 'content.xml', content: '<office:document-content/>' },
  ]));
  assert.equal(
    assertOdfArchive(archive, 'odt', 'application/vnd.oasis.opendocument.text'),
    archive,
  );
});

test('reports corrupt deflate data as a tagged error', async () => {
  const bytes = await buildZip([{ name: 'a.txt', content: 'hello hello hello hello' }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataStart = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  bytes.fill(0xff, dataStart, dataStart + 4);

  await assert.rejects(
    () => unzipContainer(bytes),
    (error) => error.name === 'OdfError' && error.code === 'CORRUPT_DEFLATE',
  );
});

test('reports a central directory header that runs past the file', async () => {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint32(22, 0x06054b50, true);
  view.setUint16(22 + 10, 1, true);
  view.setUint32(22 + 12, 10, true);
  view.setUint32(22 + 16, 0, true);

  await assert.rejects(
    () => unzipContainer(bytes),
    (error) => error.name === 'OdfError' && error.code === 'TRUNCATED_ZIP',
  );
});

test('rejects a central directory outside the file', async () => {
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, 46, true);
  view.setUint32(16, 0, true);

  await assert.rejects(
    () => unzipContainer(eocd),
    (error) => error.name === 'OdfError' && error.code === 'TRUNCATED_ZIP',
  );
});

test('rejects non-ZIP and truncated input with tagged errors', async () => {
  await assert.rejects(
    () => unzipContainer(encoder.encode('this is not a zip archive at all')),
    (error) => error.name === 'OdfError' && error.code === 'NOT_A_ZIP',
  );

  const valid = await buildZip([{ name: 'a.txt', content: 'alpha' }]);
  await assert.rejects(
    () => unzipContainer(valid.subarray(0, 40)),
    (error) => error.name === 'OdfError',
  );

  await assert.rejects(
    () => unzipContainer(42),
    (error) => error.code === 'BAD_INPUT',
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MediaResolver, mimeForName } from '../src/media.js';

async function withBlobUrls(fn) {
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const created = [];
  const revoked = [];

  URL.createObjectURL = (blob) => {
    const url = `blob:test/${created.length + 1}`;
    created.push({ url, type: blob.type });
    return url;
  };
  URL.revokeObjectURL = (url) => revoked.push(url);

  try {
    return await fn({ created, revoked });
  } finally {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
}

test('maps picture extensions to MIME types', () => {
  assert.equal(mimeForName('Pictures/a.PNG'), 'image/png');
  assert.equal(mimeForName('a.jpeg'), 'image/jpeg');
  assert.equal(mimeForName('a.svg'), 'image/svg+xml');
  assert.equal(mimeForName('a.unknown'), 'application/octet-stream');
});

test('ingests only picture entries and deduplicates repeated paths', async () => {
  return withBlobUrls(async ({ created }) => {
    const media = new MediaResolver();
    const archive = {
      list: () => ['Pictures/a.png', 'Pictures/', 'content.xml', 'Pictures/b.svg'],
      bytes: (name) => new Uint8Array([name.length]),
    };

    await media.ingest(archive);
    assert.deepEqual(Object.keys(media.images), ['Pictures/a.png', 'Pictures/b.svg']);
    assert.deepEqual(created.map((entry) => entry.type), ['image/png', 'image/svg+xml']);

    const again = media.add('Pictures/a.png', new Uint8Array([1]));
    assert.equal(again, 'blob:test/1');
    assert.equal(created.length, 2);
  });
});

test('resolves relative, encoded, basename and external hrefs', async () => {
  await withBlobUrls(() => {
    const media = new MediaResolver();
    media.add('Pictures/My Image.png', new Uint8Array([1]));
    media.add('Pictures/logo.png', new Uint8Array([2]));

    assert.equal(media.urlFor('Pictures/My Image.png'), 'blob:test/1');
    assert.equal(media.urlFor('./Pictures/My%20Image.png'), 'blob:test/1');
    assert.equal(media.urlFor('../Pictures/My%20Image.png'), 'blob:test/1');
    assert.equal(media.urlFor('media/logo.png'), 'blob:test/2');
    assert.equal(media.urlFor('https://example.com/x.png'), 'https://example.com/x.png');
    assert.equal(media.urlFor('data:image/png;base64,AA=='), 'data:image/png;base64,AA==');
    assert.equal(media.urlFor('blob:already'), 'blob:already');
    assert.equal(media.urlFor('Pictures/missing.png'), null);
    assert.equal(media.urlFor(''), null);
  });
});

test('tolerates malformed percent escapes in hrefs', async () => {
  await withBlobUrls(() => {
    const media = new MediaResolver();
    media.add('Pictures/My Image.png', new Uint8Array([1]));

    assert.equal(media.urlFor('Pictures/%E0%A4%A.png'), null);
    assert.equal(media.urlFor('./Pictures/My%20Image.png'), 'blob:test/1');
  });
});

test('fails clearly when Blob URLs are unavailable', () => {
  const original = URL.createObjectURL;
  delete URL.createObjectURL;
  try {
    const media = new MediaResolver();
    assert.throws(
      () => media.add('Pictures/a.png', new Uint8Array([1])),
      (error) => error.code === 'NO_BLOB_URL',
    );
  } finally {
    URL.createObjectURL = original;
  }
});

test('destroy revokes every URL once and is idempotent', async () => {
  await withBlobUrls(({ revoked }) => {
    const media = new MediaResolver();
    media.add('Pictures/a.png', new Uint8Array([1]));
    media.add('Pictures/b.png', new Uint8Array([2]));

    media.destroy();
    assert.deepEqual(revoked, ['blob:test/1', 'blob:test/2']);
    assert.deepEqual(Object.keys(media.images), []);

    media.destroy();
    assert.deepEqual(revoked, ['blob:test/1', 'blob:test/2']);
  });
});

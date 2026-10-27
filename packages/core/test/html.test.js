import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BASE_CSS, escapeAttribute, escapeHtml, pageDocument } from '../src/html.js';

test('escapes text and attribute values, including null', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeAttribute('"quoted"'), '&quot;quoted&quot;');
});

test('wraps renderer output in a complete escaped HTML document', () => {
  const html = pageDocument({
    title: '</title><script>alert(1)</script>',
    css: '.x{color:red}',
    body: '<p>Body</p>',
    lang: 'de',
  });

  assert.match(html, /^<!DOCTYPE html><html lang="de">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<title>&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
  assert.match(html, /<style>.*\.x\{color:red\}<\/style>/);
  assert.match(html, /<body><p>Body<\/p><\/body>/);
  assert.equal(html.includes('<script>alert'), false);
});

test('ships a print reset and defaults', () => {
  assert.match(BASE_CSS, /@media print/);
  const html = pageDocument();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Document<\/title>/);
});

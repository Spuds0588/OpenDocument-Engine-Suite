import '../../../test/helpers/env.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getAttribute,
  getAttributeAny,
  getChildElements,
  getChildrenByTag,
  getElementsByTag,
  getFirstChildByTag,
  getFirstElementByTag,
  hasAttribute,
  isElement,
  localNameOf,
  numericAttribute,
  parseXML,
  textOf,
  walkElements,
} from '../src/xml.js';

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:foo="urn:example:other-prefix"',
].join(' ');

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS}>
  <office:body>
    <foo:text>
      <text:p foo:style-name="P1" text:outline-level="2">Hi<text:s text:c="3"/>there<text:tab/>x<text:line-break/>y</text:p>
      <text:p text:style-name="P2"><text:span>inline</text:span></text:p>
    </foo:text>
  </office:body>
</office:document-content>`;

test('matches elements and attributes by local name across prefixes', () => {
  const doc = parseXML(XML, 'fixture.xml');
  const paragraphs = getElementsByTag(doc, 'p');

  assert.equal(paragraphs.length, 2);
  assert.equal(localNameOf(paragraphs[0]), 'p');
  assert.equal(getAttribute(paragraphs[0], 'style-name'), 'P1');
  assert.equal(getAttributeAny(paragraphs[0], 'missing', 'outline-level'), '2');
  assert.equal(hasAttribute(paragraphs[0], 'outline-level'), true);
  assert.equal(hasAttribute(paragraphs[0], 'nope'), false);
  assert.equal(numericAttribute(paragraphs[0], 'outline-level', 1), 2);
  assert.equal(numericAttribute(paragraphs[0], 'missing', 7), 7);

  const body = getFirstElementByTag(doc, 'body');
  const text = getFirstChildByTag(body, 'text');
  assert.equal(localNameOf(text), 'text');
  assert.equal(getChildrenByTag(text, 'p').length, 2);
  assert.equal(getFirstChildByTag(body, 'missing'), null);

  const first = paragraphs[0];
  assert.equal(getChildElements(first).length, 3);
  assert.equal(isElement(first.firstChild), false);
  assert.equal(localNameOf(null), '');
  assert.equal(textOf(null), '');
});

test('expands text:s, tabs and line breaks when reading text', () => {
  const doc = parseXML(XML, 'fixture.xml');
  const paragraph = getFirstElementByTag(doc, 'p');
  assert.equal(textOf(paragraph), 'Hi   there\tx\ny');
});

test('walks depth-first and stops when the callback returns true', () => {
  const doc = parseXML(XML, 'fixture.xml');
  const seen = [];
  const stopped = walkElements(doc.documentElement, (element, depth) => {
    seen.push(`${localNameOf(element)}@${depth}`);
    return localNameOf(element) === 'p';
  });

  assert.equal(stopped, true);
  assert.equal(seen.at(-1), 'p@2');
  assert.equal(seen.includes('body@0'), true);
});

test('rejects malformed and empty XML with a tagged error', () => {
  assert.throws(
    () => parseXML('<office:body><text:p>broken</office:body>', 'bad.xml'),
    (error) => error.name === 'OdfError' && error.code === 'XML_PARSE',
  );
  assert.throws(
    () => parseXML('', 'empty.xml'),
    (error) => error.name === 'OdfError' && error.code === 'XML_PARSE',
  );
});

test('reports a missing DOMParser', () => {
  const original = globalThis.DOMParser;
  delete globalThis.DOMParser;
  try {
    assert.throws(
      () => parseXML('<root/>'),
      (error) => error.code === 'NO_DOMPARSER',
    );
  } finally {
    globalThis.DOMParser = original;
  }
});

test('getElementsByTag searches descendants, not the root itself', () => {
  const doc = parseXML(XML, 'fixture.xml');
  const body = getFirstElementByTag(doc, 'body');
  const found = getElementsByTag(body, 'body');
  assert.equal(found.length, 0);
  assert.equal(getElementsByTag(null, 'p').length, 0);
});

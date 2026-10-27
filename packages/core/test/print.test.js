import assert from 'node:assert/strict';
import { test } from 'node:test';

import { triggerPrintToPDF } from '../src/print.js';

function withFakeDocument(iframe) {
  const original = globalThis.document;
  const appended = [];
  globalThis.document = {
    createElement: () => iframe,
    body: { appendChild: (node) => appended.push(node) },
  };
  return {
    appended,
    restore: () => {
      globalThis.document = original;
    },
  };
}

test('requires a DOM environment', () => {
  const original = globalThis.document;
  delete globalThis.document;
  try {
    assert.throws(() => triggerPrintToPDF('<p>x</p>'), /requires a DOM environment/);
  } finally {
    globalThis.document = original;
  }
});

test('loads the HTML into a hidden iframe and prints it', () => {
  const calls = [];
  const iframe = {
    style: {},
    setAttribute: (name, value) => calls.push(`attr:${name}=${value}`),
    remove: () => calls.push('remove'),
    contentWindow: {
      focus: () => calls.push('focus'),
      print: () => calls.push('print'),
    },
  };
  const fake = withFakeDocument(iframe);

  try {
    const cleanup = triggerPrintToPDF('<p>print me</p>', { timeout: 5 });
    assert.equal(iframe.srcdoc, '<p>print me</p>');
    assert.deepEqual(fake.appended, [iframe]);
    assert.equal(iframe.style.cssText.includes('width:0'), true);
    assert.equal(calls.includes('attr:aria-hidden=true'), true);

    iframe.onload();
    assert.deepEqual(calls.filter((call) => call === 'focus' || call === 'print'), ['focus', 'print']);

    cleanup();
    assert.equal(calls.filter((call) => call === 'remove').length, 1);
  } finally {
    fake.restore();
  }
});

test('removes the iframe when the frame has no window', () => {
  const calls = [];
  const iframe = {
    style: {},
    setAttribute: () => {},
    remove: () => calls.push('remove'),
    contentWindow: null,
  };
  const fake = withFakeDocument(iframe);

  try {
    triggerPrintToPDF('<p>x</p>');
    iframe.onload();
    assert.deepEqual(calls, ['remove']);
  } finally {
    fake.restore();
  }
});

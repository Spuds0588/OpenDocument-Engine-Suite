import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLogger, getLogLevel, OdfError, setLogLevel } from '../src/log.js';

function captureConsole(method) {
  const original = console[method];
  const calls = [];
  console[method] = (...args) => calls.push(args);
  return {
    calls,
    restore: () => {
      console[method] = original;
    },
  };
}

test('changes levels, ignores unknown levels and prefixes messages', () => {
  const original = getLogLevel();
  try {
    assert.equal(setLogLevel('silent'), 0);
    assert.equal(getLogLevel(), 'silent');

    const warn = captureConsole('warn');
    const debug = captureConsole('debug');
    const log = createLogger('Zip');
    log.warn('visible');
    log.debug('hidden');
    assert.equal(warn.calls.length, 0);
    assert.equal(debug.calls.length, 0);
    warn.restore();
    debug.restore();

    setLogLevel('debug');
    const warnAgain = captureConsole('warn');
    const debugAgain = captureConsole('debug');
    log.warn('careful');
    log.debug('details', 2);
    assert.deepEqual(warnAgain.calls[0], ['[ODF:Zip]', 'careful']);
    assert.deepEqual(debugAgain.calls[0], ['[ODF:Zip]', 'details', 2]);
    warnAgain.restore();
    debugAgain.restore();

    setLogLevel('nonsense');
    assert.equal(getLogLevel(), 'debug');
  } finally {
    setLogLevel(original);
  }
});

test('child loggers keep the full category prefix', () => {
  const original = getLogLevel();
  const debug = captureConsole('debug');
  try {
    setLogLevel('debug');
    createLogger('Parse').child('Table').debug('rows');
    assert.equal(debug.calls[0][0], '[ODF:Parse:Table]');
  } finally {
    debug.restore();
    setLogLevel(original);
  }
});

test('OdfError carries a stable code and optional cause', () => {
  const cause = new Error('root');
  const error = new OdfError('broken', 'XML_PARSE', cause);

  assert.equal(error.name, 'OdfError');
  assert.equal(error.message, 'broken');
  assert.equal(error.code, 'XML_PARSE');
  assert.equal(error.cause, cause);
  assert.equal(new OdfError('plain').code, 'ODF_ERROR');
});

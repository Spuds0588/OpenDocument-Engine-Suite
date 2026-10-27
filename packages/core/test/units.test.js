import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lengthToMm, mm, parseLength } from '../src/units.js';

test('parses supported ODF length units and bare numbers', () => {
  assert.deepEqual(parseLength('2.5cm'), { value: 2.5, unit: 'cm' });
  assert.deepEqual(parseLength(' 12PT '), { value: 12, unit: 'pt' });
  assert.deepEqual(parseLength('-0.5in'), { value: -0.5, unit: 'in' });
  assert.deepEqual(parseLength('42'), { value: 42, unit: 'px' });
  assert.deepEqual(parseLength('1e2mm'), { value: 100, unit: 'mm' });
});

test('returns null for percentages, words and missing values', () => {
  assert.equal(parseLength('50%'), null);
  assert.equal(parseLength('auto'), null);
  assert.equal(parseLength(''), null);
  assert.equal(parseLength(null), null);
  assert.equal(parseLength(undefined), null);
});

test('converts every physical unit to millimetres', () => {
  assert.equal(lengthToMm('1mm'), 1);
  assert.equal(lengthToMm('1cm'), 10);
  assert.equal(lengthToMm('1in'), 25.4);
  assert.ok(Math.abs(lengthToMm('72pt') - 25.4) < 1e-9);
  assert.ok(Math.abs(lengthToMm('6pc') - 25.4) < 1e-9);
  assert.ok(Math.abs(lengthToMm('96px') - 25.4) < 1e-9);
  assert.equal(lengthToMm('30%'), null);
});

test('formats millimetres compactly', () => {
  assert.equal(mm(21), '21mm');
  assert.equal(mm(21.00049), '21mm');
  assert.equal(mm(21.0005), '21.001mm');
  assert.equal(mm(0), '0mm');
});

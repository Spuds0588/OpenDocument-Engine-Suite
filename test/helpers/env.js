/** Test environment shims: Node has no DOMParser, jsdom supplies one. */
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = window.DOMParser;
}

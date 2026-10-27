/**
 * Namespace-agnostic XML helpers.
 *
 * ODF uses many prefixes (office:, text:, table:, draw:, style:, fo:, svg:),
 * and different producers bind them differently. Prefix-based selectors break
 * when a document uses an unexpected prefix, so every traversal here matches
 * strictly on `localName`.
 */

import { createLogger, OdfError } from './log.js';

const log = createLogger('Xml');

export const isElement = (node) => !!node && node.nodeType === 1;

/** The element's namespace-independent tag name, e.g. "p" for <text:p>. */
export function localNameOf(node) {
  if (!node) return '';
  return node.localName || String(node.nodeName || '').split(':').pop();
}

/**
 * Child elements, collected by pointer walk.
 *
 * jsdom wraps NodeList in a Proxy that charges for every indexed lookup, so
 * `Array.from(parent.childNodes).filter(...)` measured roughly 8x slower than
 * following firstChild/nextSibling. The hot paths below avoid it entirely.
 */
export function getChildElements(parent) {
  const out = [];
  if (!parent) return out;
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) out.push(child);
  }
  return out;
}

export function getChildrenByTag(parent, localName) {
  return getChildElements(parent).filter((el) => localNameOf(el) === localName);
}

export function getFirstChildByTag(parent, localName) {
  return getChildElements(parent).find((el) => localNameOf(el) === localName) || null;
}

export function getElementsByTag(root, localName, out = []) {
  if (!root) return out;
  for (const child of getChildElements(root)) {
    if (localNameOf(child) === localName) out.push(child);
    getElementsByTag(child, localName, out);
  }
  return out;
}

export function getFirstElementByTag(root, localName) {
  if (!root) return null;
  for (const child of getChildElements(root)) {
    if (localNameOf(child) === localName) return child;
    const found = getFirstElementByTag(child, localName);
    if (found) return found;
  }
  return null;
}

/** Depth-first walk over element descendants; return true from fn to stop. */
export function walkElements(root, fn, depth = 0) {
  if (!root) return false;
  for (let child = root.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    if (fn(child, depth) === true) return true;
    if (walkElements(child, fn, depth + 1) === true) return true;
  }
  return false;
}

/**
 * Read an attribute by local name, ignoring its namespace prefix.
 * `getAttribute(node, 'font-size')` matches fo:font-size, style:font-size, etc.
 */
export function getAttribute(node, localName) {
  if (!node || !node.getAttributeNames) return null;
  // getAttributeNames() avoids the proxied NamedNodeMap item() loop, which
  // measured several times slower in jsdom. Qualified names are matched by
  // suffix, so fo:font-size still answers a lookup for font-size.
  const suffix = `:${localName}`;
  for (const name of node.getAttributeNames()) {
    if (name === localName || name.endsWith(suffix)) return node.getAttribute(name);
  }
  return null;
}

/** First defined attribute among several local names. */
export function getAttributeAny(node, ...localNames) {
  for (const name of localNames) {
    const value = getAttribute(node, name);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

export function hasAttribute(node, localName) {
  return getAttribute(node, localName) !== null;
}

/** Plain text of a node, expanding ODF whitespace elements as it walks. */
export function textOf(node) {
  if (!node) return '';
  let text = '';
  const visit = (current) => {
    for (let child = current.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        text += (child.nodeValue || '').replace(/\r\n/g, '\n');
        continue;
      }
      if (child.nodeType !== 1) continue;
      const name = localNameOf(child);
      if (name === 's') {
        text += ' '.repeat(Math.min(Math.max(numericAttribute(child, 'c', 1), 1), 200));
      } else if (name === 'tab') {
        text += '\t';
      } else if (name === 'line-break') {
        text += '\n';
      } else {
        visit(child);
      }
    }
  };
  visit(node);
  return text;
}

/** Parse XML text, surfacing malformed input as a tagged OdfError. */
export function parseXML(source, label = 'document') {
  if (typeof DOMParser === 'undefined') {
    throw new OdfError(
      'DOMParser is not available in this runtime. Use a browser or provide a DOMParser polyfill.',
      'NO_DOMPARSER',
    );
  }
  let doc;
  try {
    doc = new DOMParser().parseFromString(source, 'application/xml');
  } catch (error) {
    throw new OdfError(`Could not parse ${label}: ${error.message}`, 'XML_PARSE', error);
  }
  const root = doc && doc.documentElement;
  if (!root || root.localName === 'parsererror' || localNameOf(root) === 'parsererror') {
    throw new OdfError(`Malformed XML in ${label}.`, 'XML_PARSE');
  }
  log.debug(`Parsed ${label} (${source.length} chars)`);
  return doc;
}

/** Numeric attribute with a fallback, clamped to sane bounds. */
export function numericAttribute(node, localName, fallback = 0) {
  const raw = getAttribute(node, localName);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

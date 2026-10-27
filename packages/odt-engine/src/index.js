/**
 * odt-engine
 * Zero-dependency OpenDocument Text (.odt) parser with HTML, Markdown and
 * plain-text export. Rendering relies only on the browser's CSS paged-media
 * engine, so window.print() produces a PDF without extra tooling.
 */

import {
  getLogLevel,
  setLogLevel,
  triggerPrintToPDF,
} from '@odf-internal/core';
import { parseODT as parseDocument } from './parser.js';
import { renderHTML, renderMarkdown, renderPlainText } from './renderers.js';

export class ODTDocument {
  constructor(ast, internals) {
    this.meta = ast.meta;
    this.body = ast.body;
    this.resources = ast.resources;
    Object.defineProperty(this, '_styles', { value: internals.styles });
    Object.defineProperty(this, '_media', { value: internals.media });
  }

  /** Clean JSON AST of the whole document. */
  toAST() {
    return { meta: this.meta, body: this.body, resources: this.resources };
  }

  /** Standalone HTML5 document with @page rules for 1:1 PDF printing. */
  toHTML() {
    return renderHTML(this, this._styles);
  }

  /** CommonMark representation. */
  toMarkdown() {
    return renderMarkdown(this, this._styles);
  }

  /** Unstructured text content. */
  toPlainText() {
    return renderPlainText(this, this._styles);
  }

  /** Revoke Blob URLs created for embedded images. */
  destroy() {
    this._media.destroy();
  }
}

/**
 * Parse an .odt file.
 *
 * @param {ArrayBuffer | Uint8Array | Blob | File} input
 * @param {{ debug?: boolean }} [options]
 * @returns {Promise<ODTDocument>}
 */
export async function parseODT(input, options = {}) {
  const { ast, styles, media } = await parseDocument(input, options);
  return new ODTDocument(ast, { styles, media });
}

export { setLogLevel, getLogLevel, triggerPrintToPDF };
export default parseODT;

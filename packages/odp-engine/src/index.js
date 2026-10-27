/**
 * odp-engine
 * Zero-dependency OpenDocument Presentation (.odp) parser with a positioned
 * slide-deck HTML renderer (print to PDF) and a Markdown transcript.
 */

import {
  getLogLevel,
  setLogLevel,
  triggerPrintToPDF,
} from '@odf-internal/core';
import { parseODP as parseDocument } from './parser.js';
import { renderHTML, renderMarkdown } from './renderers.js';

export class ODPPresentation {
  constructor(ast, internals) {
    this.meta = ast.meta;
    this.slides = ast.slides;
    this.resources = ast.resources;
    Object.defineProperty(this, '_styles', { value: internals.styles });
    Object.defineProperty(this, '_media', { value: internals.media });
  }

  toAST() {
    return { meta: this.meta, slides: this.slides, resources: this.resources };
  }

  /** Slide deck HTML; each slide is a page for window.print() / PDF export. */
  toHTML() {
    return renderHTML(this, this._styles);
  }

  /** Markdown transcript with slide headings and bullets. */
  toMarkdown() {
    return renderMarkdown(this);
  }

  /** Revoke Blob URLs created for embedded images. */
  destroy() {
    this._media.destroy();
  }
}

/**
 * Parse an .odp file.
 *
 * @param {ArrayBuffer | Uint8Array | Blob | File} input
 * @returns {Promise<ODPPresentation>}
 */
export async function parseODP(input) {
  const { ast, styles, media } = await parseDocument(input);
  return new ODPPresentation(ast, { styles, media });
}

export { setLogLevel, getLogLevel, triggerPrintToPDF };
export default parseODP;

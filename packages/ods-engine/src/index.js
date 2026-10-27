/**
 * ods-engine
 * Zero-dependency OpenDocument Spreadsheet (.ods) parser with matrix, CSV,
 * JSON and print-ready landscape HTML export.
 */

import {
  getLogLevel,
  OdfError,
  setLogLevel,
  triggerPrintToPDF,
} from '@odf-internal/core';
import { LIMITS, parseODS as parseDocument } from './parser.js';
import {
  displayText,
  renderSheetHTML,
  renderWorkbookHTML,
  sheetCSV,
  sheetJSON,
  sheetMatrix,
} from './renderers.js';

export class ODSTable {
  constructor(sheet, styles) {
    this.name = sheet.name;
    this.columns = sheet.columns;
    this.rows = sheet.rows;
    Object.defineProperty(this, '_styles', { value: styles });
  }

  /** Raw 2D values, preserving nulls for empty and covered cells. */
  toMatrix() {
    return sheetMatrix(this);
  }

  /** RFC 4180 CSV with CRLF record separators. */
  toCSV(delimiter = ',') {
    return sheetCSV(this, delimiter);
  }

  /** Array of records keyed by the first non-empty row. */
  toJSON() {
    return sheetJSON(this);
  }

  /** Printable landscape HTML for just this sheet. */
  toHTML() {
    return renderSheetHTML(this, this._styles);
  }
}

export class ODSWorkbook {
  constructor(ast, internals) {
    this.meta = ast.meta;
    this.sheets = ast.sheets;
    Object.defineProperty(this, '_styles', { value: internals.styles });
  }

  get sheetNames() {
    return Object.keys(this.sheets);
  }

  /** Get a sheet by name; defaults to the first sheet. */
  sheet(name) {
    const key = name === undefined ? this.sheetNames[0] : name;
    if (key === undefined) throw new OdfError('Workbook contains no sheets.', 'NO_SHEETS');
    const data = this.sheets[key];
    if (!data) throw new OdfError(`Unknown sheet "${key}". Available: ${this.sheetNames.join(', ')}`, 'UNKNOWN_SHEET');
    return new ODSTable(data, this._styles);
  }

  toAST() {
    return { meta: this.meta, sheets: this.sheets };
  }

  toMatrix(sheetName) {
    return this.sheet(sheetName).toMatrix();
  }

  toCSV(sheetName, delimiter = ',') {
    return this.sheet(sheetName).toCSV(delimiter);
  }

  toJSON(sheetName) {
    return this.sheet(sheetName).toJSON();
  }

  toHTML() {
    return renderWorkbookHTML(this, this._styles);
  }

  /** No media is retained by spreadsheets; provided for API symmetry. */
  destroy() {}
}

/**
 * Parse an .ods file.
 *
 * @param {ArrayBuffer | Uint8Array | Blob | File} input
 * @returns {Promise<ODSWorkbook>}
 */
export async function parseODS(input) {
  const { ast, styles } = await parseDocument(input);
  return new ODSWorkbook(ast, { styles });
}

export { LIMITS, displayText as cellText, setLogLevel, getLogLevel, triggerPrintToPDF };
export default parseODS;

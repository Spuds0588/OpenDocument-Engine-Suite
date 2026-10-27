/**
 * ODS renderers: matrix, RFC 4180 CSV, JSON records and landscape HTML.
 */

import { escapeAttribute, escapeHtml, pageDocument } from '@odf-internal/core';

/** Display text for a cell: the stored text, else the typed value. */
export function displayText(cell) {
  if (!cell || cell.covered) return '';
  if (cell.rawText) return cell.rawText;
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'boolean') return cell.value ? 'TRUE' : 'FALSE';
  return String(cell.value);
}

export function sheetMatrix(sheet) {
  return sheet.rows.map((row) => row.map((cell) => cell.value));
}

function csvField(value, delimiter) {
  const needsQuotes = value.includes(delimiter) || /["\r\n]/.test(value) || /^\s|\s$/.test(value);
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

export function sheetCSV(sheet, delimiter = ',') {
  return sheet.rows
    .map((row) => row.map((cell) => csvField(displayText(cell), delimiter)).join(delimiter))
    .join('\r\n');
}

function uniqueHeaders(cells) {
  const seen = new Map();
  return cells.map((cell, index) => {
    const base = displayText(cell).trim() || `Column${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function sheetJSON(sheet) {
  const headerIndex = sheet.rows.findIndex((row) => row.some((cell) => displayText(cell).trim() !== ''));
  if (headerIndex === -1) return [];

  const headers = uniqueHeaders(sheet.rows[headerIndex]);
  const records = [];

  for (const row of sheet.rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => displayText(cell).trim() !== '')) continue;
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ? row[index].value : null;
    });
    records.push(record);
  }
  return records;
}

function typeClass(cell) {
  if (cell.type === 'float' || cell.type === 'currency') return 'num';
  if (cell.type === 'boolean') return 'bool';
  if (cell.type === 'date') return 'date';
  return 'text';
}

function cellContent(cell) {
  return escapeHtml(displayText(cell)).replace(/\n/g, '<br>');
}

function renderSheetTable(sheet, styles) {
  const columnCount = Math.max(
    sheet.columns.length,
    ...sheet.rows.map((row) => row.length),
    0,
  );

  const colgroup = sheet.columns.length
    ? `<colgroup>${sheet.columns.slice(0, columnCount).map((column) => {
      const width = column.width || '';
      return `<col${width ? ` style="width:${escapeAttribute(width)}"` : ''}>`;
    }).join('')}</colgroup>`
    : '';

  const occupied = [];
  const rows = sheet.rows.map((row) => {
    if (!row.length) {
      // Emit only the cells a rowspan does not already cover, otherwise a
      // blank row shifts every following cell out of the grid.
      let html = '';
      for (let column = 0; column < columnCount; column++) {
        if (!(occupied[column] > 0)) html += '<td></td>';
      }
      for (let column = 0; column < occupied.length; column++) {
        if (occupied[column] > 0) occupied[column]--;
      }
      return `<tr class="odf-blank">${html}</tr>`;
    }

    let html = '';
    let column = 0;
    for (const cell of row) {
      if (cell.covered) continue;
      while (occupied[column] > 0) column++;

      const colSpan = Math.max(cell.colSpan, 1);
      const rowSpan = Math.max(cell.rowSpan, 1);
      const spans = `${colSpan > 1 ? ` colspan="${colSpan}"` : ''}${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}`;
      const css = styles.css(cell.style);
      const attributes = `${spans} class="${typeClass(cell)}"${css ? ` style="${escapeAttribute(css)}"` : ''}`;
      html += `<td${attributes}>${cellContent(cell)}</td>`;
      for (let offset = 0; offset < colSpan; offset++) occupied[column + offset] = rowSpan;
      column += colSpan;
    }
    for (let index = 0; index < occupied.length; index++) {
      if (occupied[index] > 0) occupied[index]--;
    }
    return `<tr>${html}</tr>`;
  });

  return `<table class="odf-table">${colgroup}<tbody>${rows.join('')}</tbody></table>`;
}

const SHEET_CSS = '@page{size:A4 landscape;margin:10mm}' +
  '.odf-sheet{width:100%;margin:0 0 20px;padding:10px 12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.16)}' +
  '.odf-sheet-title{margin:0 0 8px;font-size:14pt;font-weight:700}' +
  'table{width:100%;margin:0;font-size:10pt}' +
  'td{padding:2px 5px;border:1px solid #d8d8d8;vertical-align:top;white-space:pre-wrap}' +
  'td.num{text-align:right;font-variant-numeric:tabular-nums}' +
  'td.bool,td.date{text-align:center}' +
  'td:empty::after{content:"\\00a0"}.odf-blank td{height:1.4em}' +
  '@media print{body{background:none}.odf-sheet{box-shadow:none;margin:0;padding:0}' +
  '.odf-sheet+.odf-sheet{page-break-before:always}tr{page-break-inside:avoid}}';

export function renderSheetHTML(sheet, styles) {
  return pageDocument({
    title: sheet.name,
    css: SHEET_CSS,
    body: `<section class="odf-sheet"><h2 class="odf-sheet-title">${escapeHtml(sheet.name)}</h2>${
      renderSheetTable(sheet, styles)
    }</section>`,
  });
}

export function renderWorkbookHTML(ast, styles) {
  const sheets = Object.values(ast.sheets);
  const body = sheets.map((sheet) => `<section class="odf-sheet"><h2 class="odf-sheet-title">${
    escapeHtml(sheet.name)
  }</h2>${renderSheetTable(sheet, styles)}</section>`).join('');

  return pageDocument({
    title: ast.meta.title || 'OpenDocument Spreadsheet',
    css: SHEET_CSS,
    body,
  });
}

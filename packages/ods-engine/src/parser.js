/**
 * OpenDocument Spreadsheet (.ods) parser.
 *
 * Builds typed cell objects (string, float, currency, date, boolean, empty)
 * from office:spreadsheet, caps LibreOffice's giant repeat counters, resolves
 * column widths through the style cascade and keeps covered-cell placeholders
 * so that row arrays stay aligned with the visual grid.
 */

import {
  assertOdfArchive,
  createLogger,
  getAttribute,
  getChildElements,
  getChildrenByTag,
  getFirstElementByTag,
  localNameOf,
  numericAttribute,
  parseXML,
  StyleResolver,
  textOf,
  unzipContainer,
} from '@odf-internal/core';

const log = createLogger('Parse');

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

/** LibreOffice pads sheets to 1,048,576 rows; never allocate that blindly. */
export const LIMITS = {
  maxRows: 10000,
  maxColumns: 1024,
  maxCellRepeat: 1024,
  maxRowRepeat: 10000,
  maxColumnRepeat: 1024,
};

const clamp = (value, max) => Math.min(Math.max(Number.isFinite(value) ? value : 1, 1), max);

function cellText(cellElement) {
  let text = '';
  let found = false;
  const collect = (parent) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      if (localNameOf(child) === 'p') {
        text += (found ? '\n' : '') + textOf(child);
        found = true;
      } else {
        collect(child);
      }
    }
  };
  collect(cellElement);
  return (found ? text : textOf(cellElement)).trim();
}

function typedValue(cellElement) {
  const valueType = getAttribute(cellElement, 'value-type') || '';
  const rawText = cellText(cellElement);
  const formula = getAttribute(cellElement, 'formula');

  const result = {
    value: null,
    rawText,
    type: 'empty',
    valueType: valueType || (rawText ? 'string' : 'empty'),
    covered: false,
  };
  if (formula) result.formula = formula;

  switch (valueType) {
    case 'float':
    case 'percentage': {
      const raw = getAttribute(cellElement, 'value');
      const numeric = raw === null ? NaN : Number(raw);
      result.value = Number.isFinite(numeric) ? numeric : null;
      result.type = 'float';
      break;
    }
    case 'currency': {
      const raw = getAttribute(cellElement, 'value');
      const numeric = raw === null ? NaN : Number(raw);
      result.value = Number.isFinite(numeric) ? numeric : null;
      result.type = 'currency';
      break;
    }
    case 'boolean': {
      const raw = getAttribute(cellElement, 'boolean-value');
      result.value = raw === 'true' || raw === '1';
      result.type = 'boolean';
      break;
    }
    case 'date': {
      const raw = getAttribute(cellElement, 'date-value');
      const parsed = raw ? Date.parse(raw) : NaN;
      result.value = raw || null;
      result.type = 'date';
      result.date = raw || null;
      result.timestamp = Number.isNaN(parsed) ? null : parsed;
      break;
    }
    case 'time': {
      const raw = getAttribute(cellElement, 'time-value');
      result.value = rawText || raw || null;
      result.type = 'string';
      result.time = raw || null;
      break;
    }
    case 'string': {
      const explicit = getAttribute(cellElement, 'string-value');
      result.value = explicit !== null ? explicit : rawText;
      result.type = 'string';
      break;
    }
    case 'void':
      result.type = 'empty';
      break;
    default: {
      // Untyped cells can still carry text from other producers.
      if (rawText) {
        result.value = rawText;
        result.type = 'string';
      }
    }
  }
  return result;
}

function isEmptyCell(cell) {
  return !cell.formula && !cell.covered && cell.type === 'empty' && !cell.rawText;
}

function collectElements(parent, wanted, out = []) {
  for (const child of getChildElements(parent)) {
    const name = localNameOf(child);
    if (name === wanted) out.push(child);
    else if (name === 'table-rows' || name === 'table-row-group' || name === 'table-header-rows' || name === 'table-columns' || name === 'table-header-columns' || name === 'table-column-group') {
      collectElements(child, wanted, out);
    }
  }
  return out;
}

function parseColumns(tableElement, styles) {
  const columns = [];
  for (const columnElement of collectElements(tableElement, 'table-column')) {
    const repeat = clamp(numericAttribute(columnElement, 'number-columns-repeated', 1), LIMITS.maxColumnRepeat);
    const styleName = getAttribute(columnElement, 'style-name') || '';
    const width = styles.resolve(styleName).width || '';
    for (let index = 0; index < repeat && columns.length < LIMITS.maxColumns; index++) {
      columns.push({ style: styleName, width });
    }
  }
  return columns;
}

function parseCells(rowElement) {
  const cells = [];
  for (let cellElement = rowElement.firstChild; cellElement; cellElement = cellElement.nextSibling) {
    if (cellElement.nodeType !== 1) continue;
    const name = localNameOf(cellElement);
    if (name !== 'table-cell' && name !== 'covered-table-cell') continue;

    const repeat = clamp(numericAttribute(cellElement, 'number-columns-repeated', 1), LIMITS.maxCellRepeat);
    const style = getAttribute(cellElement, 'style-name') || '';

    // The typed value, spans and style are per element, not per repeat, so they
    // are read once even when a padded sheet repeats the cell thousands of times.
    if (name === 'covered-table-cell') {
      for (let index = 0; index < repeat; index++) {
        cells.push({
          value: null,
          rawText: '',
          type: 'empty',
          valueType: 'empty',
          colSpan: 1,
          rowSpan: 1,
          style,
          covered: true,
        });
      }
      continue;
    }

    const typed = typedValue(cellElement);
    typed.colSpan = Math.max(numericAttribute(cellElement, 'number-columns-spanned', 1), 1);
    typed.rowSpan = Math.max(numericAttribute(cellElement, 'number-rows-spanned', 1), 1);
    typed.style = style;
    if (repeat === 1) cells.push(typed);
    else {
      for (let index = 0; index < repeat; index++) cells.push({ ...typed });
    }
  }

  while (cells.length && isEmptyCell(cells[cells.length - 1])) cells.pop();
  return cells;
}

function parseSheet(tableElement, styles) {
  const name = getAttribute(tableElement, 'name') || 'Sheet';
  const columns = parseColumns(tableElement, styles);
  const rows = [];
  let pendingBlankRows = 0;

  for (const rowElement of collectElements(tableElement, 'table-row')) {
    const repeat = clamp(numericAttribute(rowElement, 'number-rows-repeated', 1), LIMITS.maxRowRepeat);
    const cells = parseCells(rowElement);

    if (!cells.length) {
      // Defer blank runs: trailing ones are dropped, interior ones are restored
      // when a non-empty row arrives.
      pendingBlankRows = Math.min(pendingBlankRows + repeat, LIMITS.maxRows);
      continue;
    }

    while (pendingBlankRows > 0 && rows.length < LIMITS.maxRows) {
      rows.push([]);
      pendingBlankRows--;
    }

    for (let index = 0; index < repeat && rows.length < LIMITS.maxRows; index++) {
      rows.push(index === 0 && repeat === 1 ? cells : cells.map((cell) => ({ ...cell })));
    }
    if (rows.length >= LIMITS.maxRows) {
      log.warn(`Sheet "${name}" hit the ${LIMITS.maxRows}-row safety cap; remaining rows were skipped.`);
      break;
    }
  }

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  log.debug(`Sheet "${name}": ${rows.length} rows x ${width} columns`);
  return { name, columns, rows };
}

/**
 * Parse an .ods file.
 * @returns {Promise<{ ast: object, styles: StyleResolver }>}
 */
export async function parseODS(input) {
  log.debug('Unpacking .ods container...');
  const archive = assertOdfArchive(await unzipContainer(input), 'ods', ODS_MIME);

  const contentDoc = parseXML(await archive.text('content.xml'), 'content.xml');
  const stylesDoc = archive.has('styles.xml') ? parseXML(await archive.text('styles.xml'), 'styles.xml') : null;

  const styles = new StyleResolver();
  if (stylesDoc) styles.addStylesDoc(stylesDoc);
  styles.addStylesDoc(contentDoc);

  // Null prototype keeps sheet names such as "__proto__" as ordinary keys.
  const sheets = Object.create(null);
  const spreadsheet = getFirstElementByTag(contentDoc, 'spreadsheet');
  const tableElements = spreadsheet ? getChildrenByTag(spreadsheet, 'table') : [];

  for (const tableElement of tableElements) {
    const sheet = parseSheet(tableElement, styles);
    let key = sheet.name;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(sheets, key)) key = `${sheet.name} (${suffix++})`;
    sheets[key] = sheet;
  }

  const title = null;
  const ast = {
    meta: { format: 'ods', sheetCount: Object.keys(sheets).length, title },
    sheets,
  };
  log.debug(`AST built: ${ast.meta.sheetCount} sheet(s)`);
  return { ast, styles };
}

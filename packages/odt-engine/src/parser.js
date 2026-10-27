/**
 * OpenDocument Text (.odt) parser.
 *
 * Turns office:text into the block/inline AST described in the README:
 * headings, paragraphs with styled inline runs, nested lists, tables with
 * spans, and embedded images backed by Blob URLs.
 */

import {
  addLayoutStyles,
  assertOdfArchive,
  createLogger,
  getAttribute,
  getChildElements,
  getFirstChildByTag,
  getFirstElementByTag,
  listType,
  localNameOf,
  masterPage,
  numericAttribute,
  pageLayoutForMaster,
  parseXML,
  MediaResolver,
  StyleResolver,
  textOf,
  unzipContainer,
} from '@odf-internal/core';

const log = createLogger('Parse');

const ODT_MIME = 'application/vnd.oasis.opendocument.text';
const MAX_REPEAT = 1000;
const MAX_HEADING_LEVEL = 6;

/** Collapse XML indentation without touching real single spaces. */
function normalizeText(value) {
  return value.includes('\n') ? value.replace(/[ \t]*\n[ \t]*/g, ' ') : value;
}

function headingLevel(element) {
  const raw = getAttribute(element, 'outline-level');
  const parsed = Number.parseInt(raw || '', 10);
  if (Number.isInteger(parsed) && parsed > 0) return Math.min(parsed, MAX_HEADING_LEVEL);

  // Style names encode spaces as _20_: "Heading_20_1" is "Heading 1".
  const styleName = (getAttribute(element, 'style-name') || '')
    .replace(/_([0-9a-f]{2})_/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  const match = /(?:heading|h)[ _-]?(\d+)/i.exec(styleName);
  if (match) return Math.min(Number(match[1]), MAX_HEADING_LEVEL);
  return 1;
}

/** Drop indentation whitespace at the start or end of an inline run. */
function trimInline(nodes, edge) {
  while (nodes.length) {
    const index = edge === 'start' ? 0 : nodes.length - 1;
    const node = nodes[index];
    if (node.type === 'text') {
      node.content = edge === 'start'
        ? node.content.replace(/^ +/, '')
        : node.content.replace(/ +$/, '');
      if (node.content) return;
      nodes.splice(index, 1);
    } else if (node.type === 'span' && node.children) {
      trimInline(node.children, edge);
      node.content = inlineText(node.children);
      if (node.children.length) return;
      nodes.splice(index, 1);
    } else {
      return;
    }
  }
}

function resolveGeometry(element, styles) {
  const styleName = getAttribute(element, 'style-name') || '';
  const css = styles.resolve(styleName);
  return {
    width: getAttribute(element, 'width') || css.width || '',
    height: getAttribute(element, 'height') || css.height || '',
    x: getAttribute(element, 'x') || css.left || '',
    y: getAttribute(element, 'y') || css.top || '',
  };
}

function parseImageFrame(frame, ctx) {
  const image = getFirstElementByTag(frame, 'image');
  if (!image) return null;
  const href = getAttribute(image, 'href') || '';
  const src = ctx.media.urlFor(href);
  if (!src) log.debug(`Frame references media outside the archive: ${href}`);
  const geometry = resolveGeometry(frame, ctx.styles);
  const title = getFirstElementByTag(frame, 'title');
  return {
    type: 'image',
    src: src || null,
    width: geometry.width,
    height: geometry.height,
    alt: title ? textOf(title).trim() : '',
  };
}

function parseInlineChildren(parent, ctx) {
  const nodes = [];

  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 3) {
      const content = normalizeText(node.nodeValue || '');
      if (content) nodes.push({ type: 'text', content });
      continue;
    }
    if (node.nodeType !== 1) continue;

    switch (localNameOf(node)) {
      case 'span':
      case 'a': {
        const children = parseInlineChildren(node, ctx);
        const item = {
          type: 'span',
          style: getAttribute(node, 'style-name') || '',
          content: children.map((child) => child.content || '').join(''),
          children,
        };
        if (localNameOf(node) === 'a') item.href = getAttribute(node, 'href') || '';
        nodes.push(item);
        break;
      }
      case 'tab':
        nodes.push({ type: 'text', content: '\t' });
        break;
      case 's': {
        const count = Math.min(numericAttribute(node, 'c', 1), 200);
        nodes.push({ type: 'text', content: ' '.repeat(Math.max(count, 1)) });
        break;
      }
      case 'line-break':
        nodes.push({ type: 'text', content: '\n' });
        break;
      case 'frame':
      case 'image': {
        const imageNode = localNameOf(node) === 'image'
          ? {
            type: 'image',
            src: ctx.media.urlFor(getAttribute(node, 'href') || '') || null,
            width: '',
            height: '',
            alt: '',
          }
          : parseImageFrame(node, ctx);
        if (imageNode) nodes.push(imageNode);
        break;
      }
      case 'bookmark':
      case 'bookmark-start':
      case 'bookmark-end':
      case 'meta':
      case 'meta-field':
      case 'soft-page-break':
        nodes.push(...parseInlineChildren(node, ctx));
        break;
      case 'note':
      case 'annotation':
        // Footnotes and comments are not part of the v1 AST.
        log.debug('Skipping note/annotation content');
        break;
      default: {
        const children = parseInlineChildren(node, ctx);
        if (children.length) nodes.push(...children);
        break;
      }
    }
  }

  return nodes;
}

const inlineText = (nodes) => nodes.map((node) => node.content || '').join('');

function parseParagraph(element, ctx) {
  const children = parseInlineChildren(element, ctx);
  trimInline(children, 'start');
  trimInline(children, 'end');
  return {
    type: 'paragraph',
    style: getAttribute(element, 'style-name') || '',
    text: inlineText(children),
    children,
  };
}

function parseHeading(element, ctx) {
  const children = parseInlineChildren(element, ctx);
  trimInline(children, 'start');
  trimInline(children, 'end');
  return {
    type: 'heading',
    level: headingLevel(element),
    style: getAttribute(element, 'style-name') || '',
    text: inlineText(children),
    children,
  };
}

function parseBlocks(parent, ctx) {
  const blocks = [];

  for (const element of getChildElements(parent)) {
    switch (localNameOf(element)) {
      case 'h':
        blocks.push(parseHeading(element, ctx));
        break;
      case 'p':
        blocks.push(parseParagraph(element, ctx));
        break;
      case 'list':
        blocks.push(parseList(element, ctx));
        break;
      case 'table': {
        const table = parseTable(element, ctx);
        if (table) blocks.push(table);
        break;
      }
      case 'section':
      case 'index-body': {
        blocks.push(...parseBlocks(element, ctx));
        break;
      }
      case 'frame': {
        const image = parseImageFrame(element, ctx);
        if (image) {
          blocks.push({
            type: 'paragraph',
            style: getAttribute(element, 'style-name') || '',
            text: '',
            children: [image],
          });
        }
        break;
      }
      case 'table-of-content':
      case 'alphabetical-index':
      case 'illustration-index':
      case 'soft-page-break':
      case 'index-title':
        // Generated content such as a table of contents is metadata, not body
        // text; rendering it would duplicate headings.
        break;
      default: {
        // Defensive: unknown containers may still hold block content.
        const nested = getChildElements(element).some((child) =>
          ['p', 'h', 'list', 'table', 'section'].includes(localNameOf(child)));
        if (nested) blocks.push(...parseBlocks(element, ctx));
        break;
      }
    }
  }

  return blocks;
}

function parseList(element, ctx) {
  const styleName = getAttribute(element, 'style-name') || '';
  const items = [];

  for (const child of getChildElements(element)) {
    const name = localNameOf(child);
    if (name === 'list-item' || name === 'list-header') {
      items.push(parseBlocks(child, ctx));
    } else if (name === 'list') {
      items.push([parseList(child, ctx)]);
    }
  }

  return {
    type: 'list',
    ordered: listType(ctx.styles, styleName) === 'ordered',
    style: styleName,
    items,
  };
}

/** Rows may sit inside header/row groups; keep source order, skip nested tables. */
function collectRows(tableElement, out = []) {
  for (const child of getChildElements(tableElement)) {
    const name = localNameOf(child);
    if (name === 'table-row') out.push(child);
    else if (name === 'table-header-rows' || name === 'table-row-group' || name === 'table-rows') {
      collectRows(child, out);
    }
  }
  return out;
}

function parseTable(element, ctx) {
  const style = getAttribute(element, 'style-name') || '';
  const rows = [];
  let columnCount = 0;

  for (const rowElement of collectRows(element)) {
    const rowStyle = getAttribute(rowElement, 'style-name') || '';
    const rowRepeat = Math.min(numericAttribute(rowElement, 'number-rows-repeated', 1), MAX_REPEAT);
    const cells = [];

    for (const cellElement of getChildElements(rowElement)) {
      // Covered cells are artifacts of a row/column span; the HTML renderer
      // rebuilds the occupied grid from span counts.
      if (localNameOf(cellElement) !== 'table-cell') continue;

      const repeat = Math.min(numericAttribute(cellElement, 'number-columns-repeated', 1), MAX_REPEAT);
      const cell = {
        colSpan: Math.max(numericAttribute(cellElement, 'number-columns-spanned', 1), 1),
        rowSpan: Math.max(numericAttribute(cellElement, 'number-rows-spanned', 1), 1),
        style: getAttribute(cellElement, 'style-name') || '',
        children: parseBlocks(cellElement, ctx),
      };

      if (repeat === 1) cells.push(cell);
      else {
        for (let index = 0; index < repeat; index++) {
          cells.push({ ...cell, children: cell.children.slice() });
        }
      }
    }

    for (let index = 0; index < rowRepeat; index++) {
      rows.push({
        style: rowStyle,
        cells: index === 0 && rowRepeat === 1
          ? cells
          : cells.map((cell) => ({ ...cell, children: cell.children.slice() })),
      });
    }
    columnCount = Math.max(columnCount, cells.length);
  }

  if (!rows.length) return null;
  log.debug(`Table parsed: ${rows.length} rows x ${columnCount} columns`);
  return { type: 'table', style, rows };
}

function readPageLayout(styles) {
  const masters = Array.from(styles.masterPages.values());
  const master = masterPage(styles, 'Standard') || masters.find((entry) => entry.pageLayout) || masters[0];
  const layout = pageLayoutForMaster(styles, master?.name);
  log.debug(`Page layout: ${layout.width} x ${layout.height} (${layout.orientation})`);
  return {
    width: layout.width,
    height: layout.height,
    marginTop: layout.marginTop,
    marginBottom: layout.marginBottom,
    marginLeft: layout.marginLeft,
    marginRight: layout.marginRight,
    orientation: layout.orientation,
  };
}

function readTitle(metaDoc) {
  if (!metaDoc) return null;
  const title = getFirstElementByTag(metaDoc, 'title');
  const value = title ? textOf(title).trim() : '';
  return value || null;
}

/**
 * Parse an .odt file into AST data plus the resolver internals the renderers
 * and document wrapper need.
 */
export async function parseODT(input, options = {}) {
  log.debug('Unpacking .odt container...');
  const archive = assertOdfArchive(await unzipContainer(input), 'odt', ODT_MIME);

  const contentDoc = parseXML(await archive.text('content.xml'), 'content.xml');
  const stylesDoc = archive.has('styles.xml') ? parseXML(await archive.text('styles.xml'), 'styles.xml') : null;
  const metaDoc = archive.has('meta.xml') ? parseXML(await archive.text('meta.xml'), 'meta.xml') : null;

  const styles = new StyleResolver();
  const ingest = (doc) => {
    styles.addStylesDoc(doc);
    addLayoutStyles(styles, doc, true);
  };
  if (stylesDoc) ingest(stylesDoc);
  ingest(contentDoc);

  const media = new MediaResolver();
  await media.ingest(archive);
  if (options.debug) log.info('Parsed container contents');

  const bodyElement = getFirstElementByTag(contentDoc, 'body');
  const textElement = bodyElement ? getFirstChildByTag(bodyElement, 'text') : null;
  const ctx = { styles, media };

  const body = textElement ? parseBlocks(textElement, ctx) : [];
  log.debug(`AST built: ${body.length} top-level blocks`);

  const ast = {
    meta: {
      format: 'odt',
      title: readTitle(metaDoc),
      pageLayout: readPageLayout(styles),
    },
    body,
    resources: { images: media.images },
  };

  return { ast, styles, media };
}

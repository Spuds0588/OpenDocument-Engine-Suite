/**
 * ODT renderers: standalone HTML (print-ready), CommonMark, plain text.
 */

import { escapeAttribute, escapeHtml, pageDocument } from '@odf-internal/core';

function renderInlineHTML(nodes, styles) {
  let html = '';
  for (const node of nodes || []) {
    if (node.type === 'text') {
      html += escapeHtml(node.content);
    } else if (node.type === 'image') {
      if (!node.src) continue;
      const size = [
        node.width ? `width:${node.width}` : '',
        node.height ? `height:${node.height}` : '',
      ].filter(Boolean).join(';');
      html += `<img src="${escapeAttribute(node.src)}" alt="${escapeAttribute(node.alt || '')}"${
        size ? ` style="${escapeAttribute(size)}"` : ''
      }>`;
    } else if (node.type === 'span') {
      const inner = node.children && node.children.length
        ? renderInlineHTML(node.children, styles)
        : escapeHtml(node.content);
      const css = styles.css(node.style);
      if (!inner) continue;
      html += node.href
        ? `<a href="${escapeAttribute(node.href)}"${css ? ` style="${escapeAttribute(css)}"` : ''}>${inner}</a>`
        : `<span${css ? ` style="${escapeAttribute(css)}"` : ''}>${inner}</span>`;
    }
  }
  return html;
}

/** Rebuild the occupied cell grid so row/col spans render correctly. */
function renderTableHTML(table, styles) {
  const occupied = [];
  const rows = [];

  for (const row of table.rows) {
    let html = '';
    let column = 0;
    for (const cell of row.cells) {
      while (occupied[column] > 0) column++;
      const colSpan = Math.max(cell.colSpan, 1);
      const rowSpan = Math.max(cell.rowSpan, 1);
      const spans = `${colSpan > 1 ? ` colspan="${colSpan}"` : ''}${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}`;
      const css = styles.css(cell.style);
      html += `<td${spans}${css ? ` style="${escapeAttribute(css)}"` : ''}>${renderBlocksHTML(cell.children, styles)}</td>`;
      for (let offset = 0; offset < colSpan; offset++) occupied[column + offset] = rowSpan;
      column += colSpan;
    }

    const rowCss = styles.css(row.style);
    rows.push(`<tr${rowCss ? ` style="${escapeAttribute(rowCss)}"` : ''}>${html}</tr>`);
    for (let column = 0; column < occupied.length; column++) {
      if (occupied[column] > 0) occupied[column]--;
    }
  }

  const tableCss = styles.css(table.style);
  return `<table class="odf-table"${tableCss ? ` style="${escapeAttribute(tableCss)}"` : ''}><tbody>${
    rows.join('')
  }</tbody></table>`;
}

function renderBlocksHTML(blocks, styles) {
  let html = '';
  for (const block of blocks || []) {
    const css = styles.css(block.style);
    const styleAttr = css ? ` style="${escapeAttribute(css)}"` : '';

    if (block.type === 'heading') {
      html += `<h${block.level}${styleAttr}>${renderInlineHTML(block.children, styles)}</h${block.level}>`;
    } else if (block.type === 'paragraph') {
      const inner = renderInlineHTML(block.children, styles);
      html += `<p${styleAttr}>${inner || '&#160;'}</p>`;
    } else if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items
        .map((item) => `<li>${renderBlocksHTML(item, styles)}</li>`)
        .join('');
      html += `<${tag}${styleAttr}>${items}</${tag}>`;
    } else if (block.type === 'table') {
      html += renderTableHTML(block, styles);
    }
  }
  return html;
}

export function renderHTML(ast, styles) {
  const page = ast.meta.pageLayout;
  const margins = `${page.marginTop} ${page.marginRight} ${page.marginBottom} ${page.marginLeft}`;
  const css = `@page{size:${page.width} ${page.height};margin:${margins}}` +
    `.odf-page{width:${page.width};min-height:${page.height};padding:${margins};margin:24px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18)}` +
    'h1,h2,h3,h4,h5,h6{margin:.7em 0 .35em;line-height:1.25;font-weight:700}' +
    'p{margin:0 0 .45em}ul,ol{margin:.2em 0 .5em;padding-left:1.8em}' +
    'li>p{margin:0}table{width:100%;margin:.4em 0}' +
    'td,th{padding:2px 4px;vertical-align:top}td>p,th>p{margin:0}' +
    'td:empty::after{content:"\\00a0"}img{display:inline-block}' +
    '@media print{body{background:none}.odf-page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}';

  return pageDocument({
    title: ast.meta.title || 'OpenDocument Text',
    css,
    body: `<article class="odf-page">${renderBlocksHTML(ast.body, styles)}</article>`,
  });
}

/* ------------------------------- Markdown ------------------------------- */

const MD_ESCAPES = /([\\*_`[\]])/g;
const escapeMd = (value) => String(value || '').replace(MD_ESCAPES, '\\$1');

function inlineMarkdown(nodes, styles) {
  let text = '';
  for (const node of nodes || []) {
    if (node.type === 'text') {
      text += escapeMd(node.content);
    } else if (node.type === 'image') {
      if (node.src) text += `![${escapeMd(node.alt || '')}](${node.src})`;
    } else if (node.type === 'span') {
      let inner = node.children && node.children.length
        ? inlineMarkdown(node.children, styles)
        : escapeMd(node.content);
      if (!inner) continue;
      const css = styles.resolve(node.style);
      const bold = /^(bold|[6-9]00)$/.test(String(css['font-weight'] || ''));
      const italic = css['font-style'] === 'italic';
      if (bold && italic) inner = `***${inner}***`;
      else if (bold) inner = `**${inner}**`;
      else if (italic) inner = `*${inner}*`;
      if (node.href) inner = `[${inner}](${node.href})`;
      text += inner;
    }
  }
  return text;
}

function blocksMarkdown(blocks, styles) {
  const parts = [];
  for (const block of blocks || []) {
    if (block.type === 'heading') {
      const content = inlineMarkdown(block.children, styles).trim();
      if (content) parts.push(`${'#'.repeat(block.level)} ${content}`);
    } else if (block.type === 'paragraph') {
      const content = inlineMarkdown(block.children, styles);
      if (content.trim()) parts.push(content);
    } else if (block.type === 'list') {
      const lines = block.items.map((item, index) => {
        const marker = block.ordered ? `${index + 1}. ` : '- ';
        const content = blocksMarkdown(item, styles).trim();
        if (!content) return marker.trimEnd();
        const [first, ...rest] = content.split('\n');
        return marker + first + rest.map((line) => `\n${' '.repeat(marker.length)}${line}`).join('');
      });
      parts.push(lines.join('\n'));
    } else if (block.type === 'table') {
      const grid = tableGrid(block, styles);
      if (!grid.length) continue;
      const width = Math.max(...grid.map((row) => row.length));
      const format = (row) => `| ${Array.from({ length: width }, (_, i) => row[i] || '').join(' | ')} |`;
      const header = grid[0];
      const body = grid.slice(1);
      parts.push([
        format(header),
        `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
        ...body.map(format),
      ].join('\n'));
    }
  }
  return parts.join('\n\n');
}

/** Flatten a table into plain text cells, honouring column spans. */
function tableGrid(table, styles) {
  const occupied = [];
  const grid = [];
  for (const row of table.rows) {
    const cells = [];
    let column = 0;
    for (const cell of row.cells) {
      while (occupied[column] > 0) column++;
      const text = blocksPlain(cell.children, styles).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
      const colSpan = Math.max(cell.colSpan, 1);
      const rowSpan = Math.max(cell.rowSpan, 1);
      cells[column] = text;
      for (let offset = 0; offset < colSpan; offset++) occupied[column + offset] = rowSpan;
      column += colSpan;
    }
    grid.push(cells);
    for (let index = 0; index < occupied.length; index++) {
      if (occupied[index] > 0) occupied[index]--;
    }
  }
  return grid;
}

export function renderMarkdown(ast, styles) {
  return `${blocksMarkdown(ast.body, styles)}\n`;
}

/* ------------------------------ Plain text ------------------------------ */

function inlinePlain(nodes) {
  let text = '';
  for (const node of nodes || []) {
    if (node.type === 'text') text += node.content;
    else if (node.type === 'image') text += node.alt ? `[${node.alt}]` : '';
    else if (node.children) text += inlinePlain(node.children);
    else text += node.content || '';
  }
  return text;
}

function blocksPlain(blocks, styles) {
  const parts = [];
  for (const block of blocks || []) {
    if (block.type === 'heading' || block.type === 'paragraph') {
      parts.push(inlinePlain(block.children));
    } else if (block.type === 'list') {
      parts.push(block.items.map((item, index) =>
        `${block.ordered ? `${index + 1}. ` : '- '}${blocksPlain(item, styles)}`).join('\n'));
    } else if (block.type === 'table') {
      parts.push(tableGrid(block, styles).map((row) => row.join(' | ')).join('\n'));
    }
  }
  return parts.join('\n\n');
}

export function renderPlainText(ast, styles) {
  return `${blocksPlain(ast.body, styles)}\n`;
}

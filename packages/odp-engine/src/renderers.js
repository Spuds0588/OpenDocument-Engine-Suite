/**
 * ODP renderers: absolutely positioned slide deck HTML (print-ready) and a
 * Markdown transcript.
 */

import {
  escapeAttribute,
  escapeHtml,
  lengthToMm,
  pageDocument,
} from '@odf-internal/core';

const escapeMd = (value) => String(value ?? '').replace(/([\\*_`[\]])/g, '\\$1');

function percentOf(value, totalMm) {
  const mm = lengthToMm(value);
  if (mm === null || !totalMm) return null;
  return `${Math.round((mm / totalMm) * 100000) / 1000}%`;
}

function positionStyle(geometry, totalWidth, totalHeight) {
  const parts = [];
  const left = percentOf(geometry.x, totalWidth);
  const top = percentOf(geometry.y, totalHeight);
  const width = percentOf(geometry.width, totalWidth);
  const height = percentOf(geometry.height, totalHeight);

  if (left) parts.push(`left:${left}`);
  if (top) parts.push(`top:${top}`);
  if (width) parts.push(`width:${width}`);
  if (height) parts.push(`height:${height}`);
  parts.push('position:absolute');
  return parts.join(';');
}

function renderParagraphs(paragraphs, styles) {
  return (paragraphs || []).map((paragraph) => {
    const css = styles.css(paragraph.style);
    const bullet = paragraph.bullet
      ? '<span class="odp-bullet-mark" aria-hidden="true">•</span>'
      : '';
    return `<p class="${paragraph.bullet ? 'odp-bullet' : 'odp-paragraph'}"${
      css ? ` style="${escapeAttribute(css)}"` : ''
    }>${bullet}${escapeHtml(paragraph.text)}</p>`;
  }).join('');
}

function renderElement(element, index, totalWidth, totalHeight, styles) {
  const css = styles.css(element.style);
  const position = positionStyle(element.geometry, totalWidth, totalHeight);
  // Geometry comes last so a style's absolute width/height cannot override the
  // slide-relative percentages derived from the frame attributes.
  const base = `${css ? `${css};` : ''}${position};z-index:${index}`;

  if (element.type === 'image' && element.content?.imageSrc) {
    return `<img class="odp-image" src="${escapeAttribute(element.content.imageSrc)}" alt="" style="${escapeAttribute(base)};object-fit:contain">`;
  }

  if (element.type === 'text-box') {
    return `<div class="odp-text" style="${escapeAttribute(base)}">${
      renderParagraphs(element.content?.paragraphs, styles)
    }</div>`;
  }

  const radius = element.shape === 'ellipse' || element.shape === 'circle' ? ';border-radius:50%' : '';
  return `<div class="odp-shape" style="${escapeAttribute(base)}${radius}">${
    renderParagraphs(element.content?.paragraphs, styles)
  }</div>`;
}

export function renderHTML(ast, styles) {
  const { width, height } = ast.meta.dimensions;
  const totalWidth = lengthToMm(width) || 254;
  const totalHeight = lengthToMm(height) || 190.5;

  const css = `@page{size:${width} ${height};margin:0}` +
    '.odp-deck{display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 12px;overflow-x:auto}' +
    '.odp-slide{position:relative;flex:0 0 auto;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2)}' +
    '.odp-text,.odp-shape{overflow:hidden}' +
    '.odp-text p,.odp-shape p{margin:0 0 .25em;line-height:1.25;white-space:pre-wrap;overflow-wrap:break-word}' +
    '.odp-bullet{padding-left:1.15em;text-indent:-1.15em}' +
    '.odp-bullet-mark{display:inline-block;width:1.15em;text-indent:0}' +
    '@media print{body{background:none}.odp-deck{display:block;padding:0;overflow:visible}' +
    '.odp-slide{box-shadow:none;margin:0;page-break-after:always;break-after:page}' +
    '.odp-slide:last-child{page-break-after:auto;break-after:auto}}';

  const slides = ast.slides.map((slide) => {
    const background = slide.background || '#ffffff';
    const elements = slide.elements
      .map((element, index) => renderElement(element, index, totalWidth, totalHeight, styles))
      .join('');
    return `<section class="odp-slide" data-slide="${slide.slideNumber}" style="width:${escapeAttribute(width)};height:${escapeAttribute(height)};background:${escapeAttribute(background)}">${elements}</section>`;
  }).join('');

  return pageDocument({
    title: 'OpenDocument Presentation',
    css,
    body: `<main class="odp-deck">${slides}</main>`,
  });
}

/** Markdown transcript: one "## Slide N" section per slide, separated by ---. */
export function renderMarkdown(ast) {
  const sections = ast.slides.map((slide) => {
    const parts = [`## Slide ${slide.slideNumber}`];
    const bullets = [];
    const images = [];
    let title = null;

    for (const element of slide.elements) {
      for (const paragraph of element.content?.paragraphs || []) {
        if (title === null) title = escapeMd(paragraph.text);
        else bullets.push(`- ${escapeMd(paragraph.text.replace(/\s*\n\s*/g, ' '))}`);
      }
      if (element.content?.imageSrc) {
        images.push(`![Slide ${slide.slideNumber} image](${element.content.imageSrc})`);
      }
    }

    if (title) parts.push(`### ${title}`);
    if (bullets.length) parts.push(bullets.join('\n'));
    if (images.length) parts.push(images.join('\n\n'));
    return parts.join('\n\n');
  });

  return `${sections.join('\n\n---\n\n')}\n`;
}

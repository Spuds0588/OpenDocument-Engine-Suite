/**
 * OpenDocument Presentation (.odp) parser.
 *
 * Slides are ordered draw:page elements. Every visible frame keeps its absolute
 * geometry (svg:x/y/width/height, or the equivalent graphic style properties)
 * so the renderer can position it relative to the slide canvas.
 */

import {
  addLayoutStyles,
  assertOdfArchive,
  createLogger,
  getAttribute,
  getChildElements,
  getChildrenByTag,
  getFirstChildByTag,
  getFirstElementByTag,
  localNameOf,
  masterPage,
  pageLayoutForMaster,
  parseXML,
  StyleResolver,
  textOf,
  MediaResolver,
  unzipContainer,
} from '@odf-internal/core';

const log = createLogger('Parse');

const ODP_MIME = 'application/vnd.oasis.opendocument.presentation';

/** Classic Impress slide size when a document defines no page layout. */
export const DEFAULT_SLIDE_SIZE = { width: '25.4cm', height: '19.05cm' };

const SHAPE_ELEMENTS = new Set([
  'rect',
  'ellipse',
  'circle',
  'polygon',
  'polyline',
  'custom-shape',
  'path',
  'line',
  'connector',
  'caption',
  'measure',
]);

const SKIPPED_ELEMENTS = new Set(['notes', 'controls', 'presentation-notes']);

const normalizeText = (value) => value.replace(/[ \t]*\n[ \t]*/g, ' ').trim();

/**
 * Collect paragraphs from a text box or shape, descending into lists so that
 * bullet structure survives the flattening.
 */
function collectParagraphs(container) {
  const paragraphs = [];

  const visit = (element, bullet = false) => {
    for (const child of getChildElements(element)) {
      const name = localNameOf(child);
      if (name === 'p' || name === 'h') {
        const text = normalizeText(textOf(child));
        if (!text) continue;
        const paragraph = { text, style: getAttribute(child, 'style-name') || '' };
        if (bullet) paragraph.bullet = true;
        paragraphs.push(paragraph);
      } else if (name === 'list') {
        for (const item of getChildrenByTag(child, 'list-item')) visit(item, true);
      } else if (name === 'list-item' || name === 'list-header') {
        visit(child, bullet);
      }
    }
  };

  visit(container);
  return paragraphs;
}

function resolveGeometry(element, styles) {
  const styleName = getAttribute(element, 'style-name') || '';
  const css = styles.resolve(styleName);
  return {
    x: getAttribute(element, 'x') || css.left || '',
    y: getAttribute(element, 'y') || css.top || '',
    width: getAttribute(element, 'width') || css.width || '',
    height: getAttribute(element, 'height') || css.height || '',
  };
}

function parseElement(element, ctx) {
  const image = getFirstElementByTag(element, 'image');
  const textBox = getFirstChildByTag(element, 'text-box') || getFirstElementByTag(element, 'text-box');
  const forceShape = SHAPE_ELEMENTS.has(localNameOf(element));

  let type = 'shape';
  if (image) type = 'image';
  else if (textBox && !forceShape) type = 'text-box';

  const paragraphs = textBox
    ? collectParagraphs(textBox)
    : type === 'shape'
      ? collectParagraphs(element)
      : [];

  let imageSrc = null;
  if (image) {
    const href = getAttribute(image, 'href') || '';
    imageSrc = ctx.media.urlFor(href);
    if (!imageSrc) log.debug(`Image reference not found in archive: ${href}`);
  }

  const geometry = resolveGeometry(element, ctx.styles);
  if (!paragraphs.length && !imageSrc && !geometry.width && !geometry.height) return null;

  const node = {
    type,
    geometry,
    style: getAttribute(element, 'style-name') || '',
    shape: localNameOf(element),
  };
  if (paragraphs.length) node.content = { paragraphs };
  if (imageSrc) node.content = { ...(node.content || {}), imageSrc };
  return node;
}

function parseSlide(pageElement, slideNumber, ctx) {
  const name = getAttribute(pageElement, 'name') || `Slide ${slideNumber}`;
  const elements = [];

  const visit = (parent) => {
    for (const child of getChildElements(parent)) {
      const tag = localNameOf(child);
      if (SKIPPED_ELEMENTS.has(tag)) continue;
      if (tag === 'g') {
        visit(child);
        continue;
      }
      if (tag === 'frame' || SHAPE_ELEMENTS.has(tag)) {
        const node = parseElement(child, ctx);
        if (node) elements.push(node);
      }
    }
  };
  visit(pageElement);

  const masterName = getAttribute(pageElement, 'master-page-name') || '';
  const master = masterPage(ctx.styles, masterName);
  const slide = { slideNumber, name, elements };
  if (master && master.css['background-color']) slide.background = master.css['background-color'];
  return slide;
}

function readDimensions(styles, masterName) {
  if (!styles.pageLayouts.size) return { ...DEFAULT_SLIDE_SIZE };
  const layout = pageLayoutForMaster(styles, masterName);
  return {
    width: layout.width || DEFAULT_SLIDE_SIZE.width,
    height: layout.height || DEFAULT_SLIDE_SIZE.height,
  };
}

/**
 * Parse an .odp file.
 * @returns {Promise<{ ast: object, styles: StyleResolver, media: MediaResolver }>}
 */
export async function parseODP(input) {
  log.debug('Unpacking .odp container...');
  const archive = assertOdfArchive(await unzipContainer(input), 'odp', ODP_MIME);

  const contentDoc = parseXML(await archive.text('content.xml'), 'content.xml');
  const stylesDoc = archive.has('styles.xml') ? parseXML(await archive.text('styles.xml'), 'styles.xml') : null;

  const styles = new StyleResolver();
  const ingest = (doc) => {
    styles.addStylesDoc(doc);
    addLayoutStyles(styles, doc);
  };
  if (stylesDoc) ingest(stylesDoc);
  ingest(contentDoc);

  const media = new MediaResolver();
  await media.ingest(archive);

  const presentation = getFirstElementByTag(contentDoc, 'presentation');
  const pageElements = presentation
    ? getChildrenByTag(presentation, 'page').filter((page) => getAttribute(page, 'class') !== 'notes')
    : [];

  const firstMaster = pageElements.length ? getAttribute(pageElements[0], 'master-page-name') || '' : '';
  const dimensions = readDimensions(styles, firstMaster);

  const ctx = { styles, media };
  const slides = pageElements.map((page, index) => parseSlide(page, index + 1, ctx));

  const ast = {
    meta: {
      format: 'odp',
      slideCount: slides.length,
      dimensions,
    },
    slides,
    resources: { images: media.images },
  };
  log.debug(`AST built: ${slides.length} slide(s) at ${dimensions.width} x ${dimensions.height}`);
  return { ast, styles, media };
}

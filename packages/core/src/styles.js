/**
 * ODF style cascade and CSS normalizer.
 *
 * Resolves default styles, named styles, automatic styles and page layouts into
 * flat CSS declarations, following style:parent-style-name chains. XML
 * attributes are matched by local name, so prefixes do not matter.
 */

import {
  getAttribute,
  getChildElements,
  getChildrenByTag,
  getElementsByTag,
  localNameOf,
  walkElements,
} from './xml.js';
import { lengthToMm } from './units.js';

// Attributes that map 1:1 onto a CSS property.
const IDENTITY = ' font-size font-weight font-style font-family color background-color font-variant letter-spacing text-transform line-height text-indent margin margin-top margin-bottom margin-left margin-right padding padding-top padding-bottom padding-left padding-right border border-top border-bottom border-left border-right border-style border-color border-width width height min-height opacity background-image ';

const ALIAS = {
  'column-width': 'width',
  'row-height': 'height',
  'fill-color': 'background-color',
  'stroke-color': 'border-color',
  'stroke-width': 'border-width',
  x: 'left',
  y: 'top',
};

const DECORATION = 'text-decoration';

function attributes(element) {
  const raw = {};
  if (!element || !element.attributes) return raw;
  for (let index = 0; index < element.attributes.length; index++) {
    const attribute = element.attributes.item(index);
    raw[attribute.localName || String(attribute.name || '').split(':').pop()] = attribute.value;
  }
  return raw;
}

/** Flatten one <style:*-properties> element into CSS declarations. */
export function properties(element) {
  const raw = attributes(element);
  const css = {};

  for (const key in raw) {
    if (IDENTITY.includes(` ${key} `)) css[key] = raw[key];
    else if (ALIAS[key]) css[ALIAS[key]] = raw[key];
  }

  const align = raw['text-align'];
  if (align) css['text-align'] = align === 'start' ? 'left' : align === 'end' ? 'right' : align;

  const decorations = [];
  const underline = raw['text-underline-style'] || raw['text-underline-type'];
  const strike = raw['text-line-through-style'] || raw['text-line-through-type'];
  if (underline && underline !== 'none') decorations.push('underline');
  if (strike && strike !== 'none') decorations.push('line-through');
  if (decorations.length) css[DECORATION] = decorations.join(' ');

  const position = raw['text-position'];
  if (position) {
    if (position.includes('super') || Number.parseFloat(position) > 0) css['vertical-align'] = 'super';
    else if (position.includes('sub') || Number.parseFloat(position) < 0) css['vertical-align'] = 'sub';
  }
  if (raw['vertical-align']) {
    css['vertical-align'] = raw['vertical-align'] === 'automatic' ? 'middle' : raw['vertical-align'];
  }

  if (raw.fill === 'none') css['background-color'] = 'transparent';
  if (raw['fill-color']) css['background-color'] = raw['fill-color'];
  if (raw.stroke && raw.stroke !== 'none') css['border-style'] = 'solid';

  if (raw.align === 'center') {
    css['margin-left'] = 'auto';
    css['margin-right'] = 'auto';
  } else if (raw.align === 'right') css['margin-left'] = 'auto';
  else if (raw.align === 'left') css['margin-right'] = 'auto';

  if (raw['break-before'] === 'page') css['page-break-before'] = 'always';
  if (raw['break-after'] === 'page') css['page-break-after'] = 'always';

  return css;
}

/** Merge every property container inside a style element. */
function extract(element) {
  const css = {};
  for (const child of getChildElements(element)) {
    if (localNameOf(child).endsWith('-properties')) Object.assign(css, properties(child));
  }
  return css;
}

export class StyleResolver {
  constructor() {
    this.styles = new Map();
    this.defaults = new Map();
    this.resolved = new Map();
  }

  /** Index a styles.xml or content.xml document; later documents win. */
  addStylesDoc(doc) {
    if (!doc || !doc.documentElement) return this;
    const root = doc.documentElement;
    const visit = (element) => {
      const tag = localNameOf(element);
      const name = getAttribute(element, 'name');

      if (tag === 'style' && name) {
        this.styles.set(name, {
          name,
          family: getAttribute(element, 'family'),
          parent: getAttribute(element, 'parent-style-name'),
          css: extract(element),
          element,
        });
      } else if (tag === 'default-style') {
        const family = getAttribute(element, 'family');
        if (family) this.defaults.set(family, extract(element));
      }
    };

    visit(root);
    walkElements(root, visit);

    this.resolved.clear();
    return this;
  }

  /** Merged CSS declarations for a named style, parents applied first. */
  resolve(name) {
    if (!name) return {};
    if (this.resolved.has(name)) return this.resolved.get(name);

    const chain = [];
    const seen = new Set();
    let current = name;
    while (current && this.styles.has(current) && !seen.has(current) && chain.length < 32) {
      seen.add(current);
      const style = this.styles.get(current);
      chain.unshift(style);
      current = style.parent;
    }

    const css = {};
    const family = this.styles.get(name)?.family;
    if (family && this.defaults.has(family)) Object.assign(css, this.defaults.get(family));
    for (const style of chain) Object.assign(css, style.css);

    this.resolved.set(name, css);
    return css;
  }

  css(name) {
    return toCss(this.resolve(name));
  }

}

/** Serialize CSS declarations. */
export function toCss(declarations) {
  let css = '';
  for (const key in declarations) {
    const value = declarations[key];
    if (value !== null && value !== undefined && value !== '') css += `${key}:${value};`;
  }
  return css.slice(0, -1);
}

/* ------------------------- Page and list styles ------------------------- */

export const DEFAULT_PAGE_LAYOUT = {
  name: 'default',
  width: '210mm',
  height: '297mm',
  marginTop: '20mm',
  marginBottom: '20mm',
  marginLeft: '20mm',
  marginRight: '20mm',
  orientation: 'portrait',
  background: null,
};

function readPageLayout(name, element) {
  const raw = attributes(getChildrenByTag(element, 'page-layout-properties')[0]);
  const width = raw['page-width'] || raw.width || DEFAULT_PAGE_LAYOUT.width;
  const height = raw['page-height'] || raw.height || DEFAULT_PAGE_LAYOUT.height;
  const widthMm = lengthToMm(width);
  const heightMm = lengthToMm(height);

  return {
    name,
    width,
    height,
    marginTop: raw['margin-top'] || raw.margin || DEFAULT_PAGE_LAYOUT.marginTop,
    marginBottom: raw['margin-bottom'] || raw.margin || DEFAULT_PAGE_LAYOUT.marginBottom,
    marginLeft: raw['margin-left'] || raw.margin || DEFAULT_PAGE_LAYOUT.marginLeft,
    marginRight: raw['margin-right'] || raw.margin || DEFAULT_PAGE_LAYOUT.marginRight,
    orientation: raw['print-orientation'] === 'landscape' || raw['print-orientation'] === 'portrait'
      ? raw['print-orientation']
      : (widthMm && heightMm && widthMm > heightMm ? 'landscape' : 'portrait'),
    background: raw['background-color'] || null,
  };
}

/**
 * Index page layouts, master pages and (optionally) list styles.
 * Imported only by engines that need page geometry; unused by the spreadsheet
 * engine, so esbuild drops it from that bundle.
 */
export function addLayoutStyles(resolver, doc, lists = false) {
  if (!doc || !doc.documentElement) return resolver;
  resolver.pageLayouts ||= new Map();
  resolver.masterPages ||= new Map();
  if (lists) resolver.listStyles ||= new Map();
  const root = doc.documentElement;
  const visit = (element) => {
    const tag = localNameOf(element);
    const name = getAttribute(element, 'name');
    if (tag === 'page-layout' && name) {
      resolver.pageLayouts.set(name, readPageLayout(name, element));
    } else if (tag === 'master-page' && name) {
      const drawing = getChildrenByTag(element, 'drawing-page-properties')[0];
      resolver.masterPages.set(name, {
        name,
        pageLayout: getAttribute(element, 'page-layout-name'),
        css: drawing ? properties(drawing) : {},
      });
    } else if (lists && tag === 'list-style' && name) {
      resolver.listStyles.set(
        name,
        getElementsByTag(element, 'list-level-style-number').length ? 'ordered' : 'bullet',
      );
    }
  };

  visit(root);
  walkElements(root, visit);
  return resolver;
}

export function pageLayout(styles, name) {
  const layout = name ? styles.pageLayouts?.get(name) : null;
  if (layout) return layout;
  const first = styles.pageLayouts?.values().next();
  return first && !first.done ? first.value : { ...DEFAULT_PAGE_LAYOUT };
}

export function masterPage(styles, name) {
  return (name && styles.masterPages?.get(name)) || null;
}

export function pageLayoutForMaster(styles, masterName) {
  return pageLayout(styles, masterPage(styles, masterName)?.pageLayout);
}

export function listType(styles, name) {
  return (name && styles.listStyles?.get(name)) || 'bullet';
}

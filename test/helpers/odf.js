/** Build real OpenDocument ZIP fixtures for the test suites. */

import { buildZip } from './zip.js';

export const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
].join(' ');

export const MIME_TYPES = {
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

export function contentDocument(bodyXml, { automaticStyles = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.3">
<office:scripts/>
<office:font-face-decls/>
<office:automatic-styles>${automaticStyles}</office:automatic-styles>
<office:body>${bodyXml}</office:body>
</office:document-content>`;
}

export function stylesDocument({ styles = '', automaticStyles = '', masterPages = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.3">
<office:font-face-decls/>
<office:styles>${styles}</office:styles>
<office:automatic-styles>${automaticStyles}</office:automatic-styles>
<office:master-styles>${masterPages}</office:master-styles>
</office:document-styles>`;
}

export function metaDocument(title, { creator = 'ODF Suite Tests' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${NS} office:version="1.3">
<office:meta>
<dc:title>${title}</dc:title>
<dc:creator>${creator}</dc:creator>
</office:meta>
</office:document-meta>`;
}

export function manifestDocument(kind) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME_TYPES[kind]}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
}

const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

/**
 * Build a complete ODF container.
 * @param {'odt'|'ods'|'odp'} kind
 * @param {{body: string, styles?: string, automaticStyles?: string,
 *   layoutStyles?: string, masterPages?: string, title?: string,
 *   pictures?: Record<string, Uint8Array>}} options
 */
export async function buildOdf(kind, options) {
  const {
    body,
    styles = '',
    automaticStyles = '',
    layoutStyles = '',
    masterPages = '',
    title = 'Test Document',
    pictures = {},
  } = options;

  const files = [
    { name: 'mimetype', content: MIME_TYPES[kind], store: true },
    { name: 'content.xml', content: contentDocument(body, { automaticStyles }) },
    { name: 'styles.xml', content: stylesDocument({ styles, automaticStyles: layoutStyles, masterPages }) },
    { name: 'meta.xml', content: metaDocument(title) },
    { name: 'META-INF/manifest.xml', content: manifestDocument(kind) },
  ];

  for (const [name, bytes] of Object.entries(pictures)) {
    files.push({ name: name.startsWith('Pictures/') ? name : `Pictures/${name}`, content: bytes });
  }

  return buildZip(files);
}

export { TINY_PNG };

export const PAGE_LAYOUT = `
<style:page-layout style:name="pm1">
  <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"
    fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2.5cm" fo:margin-right="2cm"
    style:print-orientation="portrait"/>
</style:page-layout>`;

export const MASTER_PAGES = '<style:master-page style:name="Standard" style:page-layout-name="pm1"/>';

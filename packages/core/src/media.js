/**
 * Embedded media extraction.
 *
 * Pictures stored in the ZIP are exposed as Blob URLs and tracked so destroy()
 * can revoke every URL deterministically.
 */

import { createLogger, OdfError } from './log.js';

const log = createLogger('Media');

const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

export const mimeForName = (name) => TYPES[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream';

export class MediaResolver {
  constructor() {
    /** @type {Record<string, string>} archive path -> renderable URL */
    this.images = Object.create(null);
  }

  /** Extract every image entry from an unpacked archive. */
  async ingest(archive, prefix = 'Pictures/') {
    for (const name of archive.list()) {
      if (name.startsWith(prefix) && !name.endsWith('/')) this.add(name, archive.bytes(name));
    }
    const count = Object.keys(this.images).length;
    if (count) log.debug(`Registered ${count} embedded image${count === 1 ? '' : 's'}`);
    return this.images;
  }

  add(name, bytes) {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new OdfError('URL.createObjectURL is unavailable; cannot expose embedded images.', 'NO_BLOB_URL');
    }
    const key = name.replace(/^\.\//, '');
    if (this.images[key]) return this.images[key];
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeForName(key) }));
    this.images[key] = url;
    return url;
  }

  /** Resolve an ODF xlink:href (possibly relative or URL-encoded) to a URL. */
  urlFor(href) {
    if (!href) return null;
    if (/^(data:|blob:|https?:)/i.test(href)) return href;

    const cleaned = href.replace(/^\.\//, '').replace(/^\.\.\//, '');
    let decoded = cleaned;
    try {
      decoded = decodeURIComponent(cleaned);
    } catch {
      /* keep the raw href */
    }
    if (this.images[cleaned]) return this.images[cleaned];
    if (this.images[decoded]) return this.images[decoded];

    const base = decoded.split('/').pop();
    for (const name of Object.keys(this.images)) {
      if (name.split('/').pop() === base) return this.images[name];
    }
    log.debug(`No embedded media matched href "${href}"`);
    return null;
  }

  /** Revoke every Blob URL created for this document. */
  destroy() {
    const urls = Object.values(this.images);
    for (const url of urls) URL.revokeObjectURL(url);
    log.debug(`Released ${urls.length} Blob URL(s)`);
    for (const key of Object.keys(this.images)) delete this.images[key];
  }
}

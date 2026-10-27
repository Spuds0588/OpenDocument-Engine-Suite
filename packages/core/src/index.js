/** Internal shared runtime for the OpenDocument Engine Suite. */

export { unzipContainer, assertOdfArchive } from './zip.js';
export {
  parseXML,
  getChildElements,
  getChildrenByTag,
  getFirstChildByTag,
  getElementsByTag,
  getFirstElementByTag,
  walkElements,
  getAttribute,
  getAttributeAny,
  hasAttribute,
  localNameOf,
  textOf,
  numericAttribute,
} from './xml.js';
export {
  StyleResolver,
  toCss,
  DEFAULT_PAGE_LAYOUT,
  addLayoutStyles,
  pageLayout,
  masterPage,
  pageLayoutForMaster,
  listType,
} from './styles.js';
export { MediaResolver, mimeForName } from './media.js';
export { createLogger, setLogLevel, getLogLevel, OdfError } from './log.js';
export { triggerPrintToPDF } from './print.js';
export { parseLength, lengthToMm, mm } from './units.js';
export { escapeHtml, escapeAttribute, pageDocument, BASE_CSS } from './html.js';

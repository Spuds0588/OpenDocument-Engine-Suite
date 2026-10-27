/**
 * Print-to-PDF bridge: render self-contained HTML in an isolated iframe and
 * hand it to the browser's native print pipeline.
 */

import { createLogger } from './log.js';

const log = createLogger('Export');

export function triggerPrintToPDF(htmlContent, { timeout = 60000 } = {}) {
  if (typeof document === 'undefined') throw new Error('triggerPrintToPDF requires a DOM.');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  const cleanup = () => iframe.remove();

  iframe.onload = () => {
    if (!iframe.contentWindow) return cleanup();
    log.debug('Printing export document');
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(cleanup, timeout);
  };

  iframe.srcdoc = htmlContent;
  document.body.appendChild(iframe);
  return cleanup;
}

/** HTML escaping and document shell helpers shared by the renderers. */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
export const escapeAttribute = escapeHtml;

/** Shared print-oriented reset. Engines add their page containers on top. */
export const BASE_CSS = '*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#f1f1f1;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{max-width:100%;height:auto}table{border-collapse:collapse}@media print{body{background:none}}';

/** Wrap renderer output in a complete HTML5 document with paged-media CSS. */
export function pageDocument({ title = 'Document', css = '', body = '', lang = 'en' } = {}) {
  return `<!DOCTYPE html><html lang="${escapeAttribute(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

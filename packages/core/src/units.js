/**
 * Length parsing for ODF geometry attributes (svg:x, fo:page-width, ...).
 * ODF writes physical lengths in cm/mm/in/pt/px/pc; percentages are resolved by
 * the caller because they need a reference dimension.
 */

const MM_PER_UNIT = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
  px: 25.4 / 96,
};

const LENGTH_RE = /^\s*(-?\d*\.?\d+(?:e[+-]?\d+)?)\s*(mm|cm|in|pt|pc|px)?\s*$/i;

/** Parse "2.5cm" into { value: 2.5, unit: 'cm' }; null for percentages or garbage. */
export function parseLength(input) {
  if (input === null || input === undefined) return null;
  const match = LENGTH_RE.exec(String(input));
  if (!match) return null;
  return { value: Number(match[1]), unit: (match[2] || 'px').toLowerCase() };
}

/** Convert a physical ODF length to millimetres; null when not convertible. */
export function lengthToMm(input) {
  const parsed = parseLength(input);
  if (!parsed) return null;
  const factor = MM_PER_UNIT[parsed.unit];
  if (!factor) return null;
  return parsed.value * factor;
}

/** Format millimetres compactly for generated CSS. */
export function mm(value) {
  return `${Math.round(value * 1000) / 1000}mm`;
}

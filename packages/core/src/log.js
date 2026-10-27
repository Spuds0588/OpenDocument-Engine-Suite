/**
 * Tagged diagnostic logging shared by every engine.
 * Silent by default below warnings; one call changes verbosity:
 *   setLogLevel('debug') // [ODF:Zip] ... [ODF:Parse] ...
 */

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
let current = LEVELS.warn;

export function setLogLevel(level) {
  if (level in LEVELS) current = LEVELS[level];
  return current;
}

export function getLogLevel() {
  return Object.keys(LEVELS).find((name) => LEVELS[name] === current) || 'warn';
}

const emit = (level, category, args) => {
  if (LEVELS[level] > current || typeof console === 'undefined') return;
  const method = level === 'debug' ? 'debug' : level;
  if (typeof console[method] === 'function') console[method](`[ODF:${category}]`, ...args);
};

export function createLogger(category) {
  const at = (level) => (...args) => emit(level, category, args);
  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (name) => createLogger(`${category}:${name}`),
  };
}

/** Base error type so consumers can distinguish parser failures. */
export class OdfError extends Error {
  constructor(message, code = 'ODF_ERROR', cause) {
    super(message);
    this.name = 'OdfError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

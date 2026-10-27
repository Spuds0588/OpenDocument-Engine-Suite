/**
 * Minimal ZIP reader for OpenDocument containers.
 *
 * ODF files are ordinary ZIP archives. Instead of shipping a 100 KB zip
 * library, this module walks the Central Directory with a DataView and hands
 * each deflated entry to the platform `DecompressionStream('deflate-raw')`.
 *
 * Supported: stored (method 0) and deflate (method 8) entries, UTF-8 names.
 * Not supported: ZIP64, encrypted archives, legacy compression methods.
 */

import { createLogger, OdfError } from './log.js';

const log = createLogger('Zip');

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new OdfError(
    'Unsupported input: expected ArrayBuffer, Uint8Array, Blob or File.',
    'BAD_INPUT',
  );
}

/** Find the End Of Central Directory record, scanning back over the comment. */
function findEocd(view) {
  const start = Math.max(0, view.byteLength - EOCD_MIN_SIZE - MAX_COMMENT);
  for (let offset = view.byteLength - EOCD_MIN_SIZE; offset >= start; offset--) {
    if (view.getUint32(offset, true) !== SIG_EOCD) continue;
    // A comment may contain the EOCD signature. Only accept the record whose
    // declared comment length ends exactly at the end of the file.
    if (offset + EOCD_MIN_SIZE + view.getUint16(offset + 20, true) === view.byteLength) {
      return offset;
    }
  }
  throw new OdfError(
    'Not a ZIP container: End of Central Directory record not found.',
    'NOT_A_ZIP',
  );
}

/** Inflate one raw-deflate payload through the native stream API. */
async function inflateRaw(bytes, name = 'entry') {
  if (bytes.byteLength === 0) return new Uint8Array(0);
  if (typeof DecompressionStream === 'undefined') {
    throw new OdfError(
      "This runtime has no DecompressionStream('deflate-raw'). Use a modern browser or add a polyfill.",
      'NO_DECOMPRESSION_STREAM',
    );
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    throw new OdfError(`Corrupt ZIP: could not inflate "${name}".`, 'CORRUPT_DEFLATE', error);
  }
}

/**
 * Read a ZIP container into memory.
 *
 * @param {ArrayBuffer | Uint8Array | Blob | File} input
 * @returns {Promise<{ entries: Map<string, ZipEntry>, has(name: string): boolean,
 *   list(): string[], bytes(name: string): Uint8Array, text(name: string): Promise<string> }>}
 */
export async function unzipContainer(input) {
  const bytes = await toBytes(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);

  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  if (centralOffset === 0xffffffff || entryCount === 0xffff || centralSize === 0xffffffff) {
    throw new OdfError('ZIP64 archives are not supported.', 'ZIP64_UNSUPPORTED');
  }
  if (centralOffset + centralSize > bytes.byteLength) {
    throw new OdfError('Corrupt ZIP: Central Directory is outside the file.', 'TRUNCATED_ZIP');
  }

  log.debug(`Central Directory: ${entryCount} entries, ${centralSize} bytes`);
  const entries = new Map();
  let pointer = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (pointer + 46 > bytes.byteLength) {
      throw new OdfError('Corrupt ZIP: Central Directory is truncated.', 'TRUNCATED_ZIP');
    }
    if (view.getUint32(pointer, true) !== SIG_CENTRAL) {
      throw new OdfError(`Corrupt ZIP: bad Central Directory header at ${pointer}.`, 'BAD_CENTRAL_DIRECTORY');
    }

    const flags = view.getUint16(pointer + 8, true);
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const uncompressedSize = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);

    const nameBytes = bytes.subarray(pointer + 46, pointer + 46 + nameLength);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    pointer += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) {
      log.warn(`Skipping encrypted entry "${name}".`);
      continue;
    }
    if (localOffset + 30 > bytes.byteLength) {
      throw new OdfError(`Corrupt ZIP: local header for "${name}" is outside the file.`, 'TRUNCATED_ZIP');
    }
    if (view.getUint32(localOffset, true) !== SIG_LOCAL) {
      throw new OdfError(`Corrupt ZIP: bad local header for "${name}".`, 'BAD_LOCAL_HEADER');
    }

    // Local header lengths can differ from the Central Directory (extra fields
    // such as data descriptors), so they must be read from the local header.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.byteLength) {
      throw new OdfError(`Corrupt ZIP: data for "${name}" is truncated.`, 'TRUNCATED_ZIP');
    }

    const raw = bytes.subarray(dataStart, dataEnd);
    let data;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      data = await inflateRaw(raw, name);
    } else {
      log.warn(`Skipping "${name}": unsupported compression method ${method}.`);
      continue;
    }

    entries.set(name, {
      name,
      method,
      data,
      compressedSize,
      size: uncompressedSize || data.byteLength,
    });
  }

  log.debug(`Unpacked ${entries.size} entries`);

  const textCache = new Map();

  return {
    entries,
    has: (name) => entries.has(name),
    list: () => Array.from(entries.keys()),
    bytes(name) {
      const entry = entries.get(name);
      if (!entry) throw new OdfError(`Missing archive entry: ${name}`, 'MISSING_ENTRY');
      return entry.data;
    },
    async text(name) {
      if (textCache.has(name)) return textCache.get(name);
      const value = new TextDecoder('utf-8').decode(this.bytes(name));
      textCache.set(name, value);
      return value;
    },
  };
}

/**
 * Confirm an archive looks like the expected OpenDocument flavour.
 * A missing or unfamiliar mimetype is a warning; a missing content.xml is fatal.
 */
export function assertOdfArchive(archive, expectedFormat, mimeType) {
  if (!archive.has('content.xml')) {
    throw new OdfError('Not an OpenDocument file: content.xml is missing.', 'NOT_ODF');
  }
  if (archive.has('mimetype')) {
    const declared = new TextDecoder('utf-8').decode(archive.bytes('mimetype')).trim();
    if (declared && declared !== mimeType) {
      log.warn(`Expected mimetype "${mimeType}" for .${expectedFormat}, found "${declared}". Parsing anyway.`);
    }
  } else {
    log.warn('Container has no mimetype entry; parsing by content.xml only.');
  }
  return archive;
}

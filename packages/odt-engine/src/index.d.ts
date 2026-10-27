import type {
  ODTBlockNode,
  ODTDocumentAST,
  ODTMeta,
  ResourceMap,
} from './types.js';

export * from './types.js';

export declare class ODTDocument implements ODTDocumentAST {
  meta: ODTMeta;
  body: ODTBlockNode[];
  resources: ResourceMap;
  toAST(): ODTDocumentAST;
  toHTML(): string;
  toMarkdown(): string;
  toPlainText(): string;
  destroy(): void;
}

export declare function parseODT(
  input: ArrayBuffer | Uint8Array | Blob | File,
  options?: { debug?: boolean },
): Promise<ODTDocument>;

export declare function setLogLevel(level: 'silent' | 'error' | 'warn' | 'info' | 'debug'): number;
export declare function getLogLevel(): string;
export declare function triggerPrintToPDF(html: string, options?: { timeout?: number }): () => void;

export default parseODT;

import type {
  ODPPresentationAST,
  ODPSlide,
  ResourceMap,
} from './types.js';

export * from './types.js';

export declare class ODPPresentation implements ODPPresentationAST {
  meta: ODPPresentationAST['meta'];
  slides: ODPSlide[];
  resources: ResourceMap;
  toAST(): ODPPresentationAST;
  toHTML(): string;
  toMarkdown(): string;
  destroy(): void;
}

export declare function parseODP(
  input: ArrayBuffer | Uint8Array | Blob | File,
): Promise<ODPPresentation>;

export declare function setLogLevel(level: 'silent' | 'error' | 'warn' | 'info' | 'debug'): number;
export declare function getLogLevel(): string;
export declare function triggerPrintToPDF(html: string, options?: { timeout?: number }): () => void;

export default parseODP;

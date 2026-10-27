import type {
  ODSCell,
  ODSMeta,
  ODSSheet,
  ODSSheetTable,
  ODSSpreadsheetAST,
  ODSValue,
} from './types.js';

export * from './types.js';

export declare class ODSTable implements ODSSheetTable {
  name: string;
  columns: { style: string; width: string }[];
  rows: ODSCell[][];
  toMatrix(): ODSValue[][];
  toCSV(delimiter?: string): string;
  toJSON(): Record<string, ODSValue>[];
  toHTML(): string;
}

export declare class ODSWorkbook implements ODSSpreadsheetAST {
  meta: ODSMeta;
  sheets: Record<string, ODSSheet>;
  readonly sheetNames: string[];
  sheet(name?: string): ODSTable;
  toAST(): ODSSpreadsheetAST;
  toMatrix(sheetName?: string): ODSValue[][];
  toCSV(sheetName?: string, delimiter?: string): string;
  toJSON(sheetName?: string): Record<string, ODSValue>[];
  toHTML(): string;
  destroy(): void;
}

export declare function parseODS(
  input: ArrayBuffer | Uint8Array | Blob | File,
): Promise<ODSWorkbook>;

export declare const LIMITS: {
  maxRows: number;
  maxColumns: number;
  maxCellRepeat: number;
  maxRowRepeat: number;
  maxColumnRepeat: number;
};

export declare function cellText(cell: ODSCell): string;
export declare function setLogLevel(level: 'silent' | 'error' | 'warn' | 'info' | 'debug'): number;
export declare function getLogLevel(): string;
export declare function triggerPrintToPDF(html: string, options?: { timeout?: number }): () => void;

export default parseODS;

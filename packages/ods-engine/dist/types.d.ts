/** Shared AST and public API types for the OpenDocument Engine Suite. */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export interface PageLayout {
  width: string;
  height: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  orientation: 'portrait' | 'landscape';
}

export interface ResourceMap {
  images: Record<string, string>;
}

export interface BaseDocument<Meta, Body> {
  meta: Meta;
  body: Body;
  resources: ResourceMap;
  /** JSON AST (same shape as meta/body/resources). */
  toAST(): { meta: Meta; body: Body; resources: ResourceMap };
  /** Release Blob URLs created for embedded images. */
  destroy(): void;
}

/* ------------------------------------------------------------------ */
/* ODT                                                                 */
/* ------------------------------------------------------------------ */

export interface ODTInlineText {
  type: 'text';
  content: string;
}

export interface ODTInlineSpan {
  type: 'span';
  style: string;
  content: string;
  /** Nested inline nodes, when the span contains more than text. */
  children?: ODTInlineNode[];
  /** Set when the span came from a <text:a> hyperlink. */
  href?: string;
}

export interface ODTInlineImage {
  type: 'image';
  src: string | null;
  width: string;
  height: string;
  alt?: string;
}

export type ODTInlineNode = ODTInlineText | ODTInlineSpan | ODTInlineImage;

export interface ODTHeadingNode {
  type: 'heading';
  level: number;
  style: string;
  text: string;
  children: ODTInlineNode[];
}

export interface ODTParagraphNode {
  type: 'paragraph';
  style: string;
  text: string;
  children: ODTInlineNode[];
}

export interface ODTListNode {
  type: 'list';
  ordered: boolean;
  style: string;
  items: ODTBlockNode[][];
}

export interface ODTTableCell {
  colSpan: number;
  rowSpan: number;
  style: string;
  children: ODTBlockNode[];
}

export interface ODTTableRow {
  style: string;
  cells: ODTTableCell[];
}

export interface ODTTableNode {
  type: 'table';
  style: string;
  rows: ODTTableRow[];
}

export type ODTBlockNode =
  | ODTHeadingNode
  | ODTParagraphNode
  | ODTListNode
  | ODTTableNode;

export interface ODTMeta {
  format: 'odt';
  title: string | null;
  pageLayout: PageLayout;
}

export interface ODTDocumentAST {
  meta: ODTMeta;
  body: ODTBlockNode[];
  resources: ResourceMap;
}

/* ------------------------------------------------------------------ */
/* ODS                                                                 */
/* ------------------------------------------------------------------ */

export type ODSValue = string | number | boolean | null;

export interface ODSCell {
  value: ODSValue;
  rawText: string;
  type: 'string' | 'float' | 'date' | 'boolean' | 'currency' | 'empty';
  /** Raw ODF value type, preserving percentage/time distinctions. */
  valueType: string;
  formula?: string;
  colSpan: number;
  rowSpan: number;
  style: string;
  /** True for <table:covered-table-cell> placeholders inside a span. */
  covered: boolean;
}

export interface ODSSheet {
  name: string;
  columns: { style: string; width: string }[];
  rows: ODSCell[][];
}

export interface ODSMeta {
  format: 'ods';
  sheetCount: number;
  title?: string | null;
}

export interface ODSSpreadsheetAST {
  meta: ODSMeta;
  sheets: Record<string, ODSSheet>;
}

export interface ODSSheetTable {
  name: string;
  columns: { style: string; width: string }[];
  rows: ODSCell[][];
  toMatrix(): ODSValue[][];
  toCSV(delimiter?: string): string;
  toJSON(): Record<string, ODSValue>[];
  toHTML(): string;
}

/* ------------------------------------------------------------------ */
/* ODP                                                                 */
/* ------------------------------------------------------------------ */

export interface ODPSlideElement {
  type: 'text-box' | 'image' | 'shape';
  geometry: { x: string; y: string; width: string; height: string };
  style: string;
  /** Source ODF element, e.g. "frame", "rect" or "ellipse". */
  shape?: string;
  content?: {
    paragraphs?: { text: string; style: string; bullet?: boolean }[];
    imageSrc?: string;
  };
}

export interface ODPSlide {
  slideNumber: number;
  name: string;
  elements: ODPSlideElement[];
  /** Background color inherited from the slide master, when defined. */
  background?: string;
}

export interface ODPPresentationAST {
  meta: {
    format: 'odp';
    slideCount: number;
    dimensions: { width: string; height: string };
  };
  slides: ODPSlide[];
  resources: ResourceMap;
}


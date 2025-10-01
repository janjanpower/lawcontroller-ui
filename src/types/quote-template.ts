export interface VariableDef {
  key: string;
  label: string;
  maxUsage?: number;
}

export interface TextInline {
  type: 'text';
  html: string;
}

export interface VarInline {
  type: 'var';
  key: string;
  label: string;
}

export type InlineElement = TextInline | VarInline;

export interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  inlines: InlineElement[];
  align?: 'left' | 'center' | 'right' | 'justify';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface CellMerge {
  r: number;
  c: number;
  rowspan: number;
  colspan: number;
}

export interface ColumnMeta {
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface TableBlock {
  id: string;
  type: 'table';
  rows: string[][];
  merges?: CellMerge[];
  colMeta?: ColumnMeta[];
}

export type Block = ParagraphBlock | TableBlock;

export interface QuoteTemplateSchema {
  version: 1;
  blocks: Block[];
}

export interface VariableUsage {
  key: string;
  count: number;
  maxUsage?: number;
}

export type BlockType = "text" | "table" | "image";

export interface CanvasBlockBase {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h?: number;
  z?: number;
  locked?: boolean;
  groupId?: string;
}

// 文字區塊（增強版）
export interface TextBlock extends CanvasBlockBase {
  type: "text";
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

// 表格區塊（增強版）
export interface TableBlock extends CanvasBlockBase {
  type: "table";
  headers: string[];
  rows: string[][];
  showBorders?: boolean;
  headerStyle?: {
    bold?: boolean;
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
  };
  cellStyle?: {
    padding?: number;
    textAlign?: "left" | "center" | "right";
  };
}

// 圖片區塊
export interface ImageBlock extends CanvasBlockBase {
  type: "image";
  url: string;
  fit?: "cover" | "contain";
  alt?: string;
}

export type CanvasBlock = TextBlock | TableBlock | ImageBlock;

export interface QuoteCanvasSchema {
  page: { width: number; height: number; margin: number };
  blocks: CanvasBlock[];
  gridSize?: number;
  showGrid?: boolean;
}
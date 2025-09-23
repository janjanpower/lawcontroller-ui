export type BlockType = "text" | "table";

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
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

// 合併儲存格資訊
export interface MergedCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// 表格區塊（增強版）
export interface TableBlock extends CanvasBlockBase {
  type: "table";
  headers: string[];
  rows: string[][];
  showBorders?: boolean;
  columnWidths?: number[]; // 欄寬百分比
  mergedCells?: MergedCell[]; // 合併儲存格
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  textAlign?: "left" | "center" | "right";
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

export type CanvasBlock = TextBlock | TableBlock;

export interface QuoteCanvasSchema {
  page: { width: number; height: number; margin: number };
  blocks: CanvasBlock[];
  gridSize?: number;
  showGrid?: boolean;
}
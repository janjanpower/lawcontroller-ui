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
  groupId?: string; // 🆕 分組 ID
}


// 文字區塊（取代 heading + paragraph）
export interface TextBlock extends CanvasBlockBase {
  type: "text";
  text: string;            // 可輸入文字，支援 {{vars}}
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  level?: 1 | 2 | 3;       // 選填，若要保留標題概念
}

// 表格區塊
export interface TableBlock extends CanvasBlockBase {
  type: "table";
  headers: string[];       // 支援 {{vars}}
  rows: string[][];        // 支援 {{vars}}
  showBorders?: boolean;
}

// 圖片區塊
export interface ImageBlock extends CanvasBlockBase {
  type: "image";
  url: string;             // 外部 URL / 上傳後連結
  fit?: "cover" | "contain";
}

export type CanvasBlock =
  | TextBlock
  | TableBlock
  | ImageBlock;

export interface QuoteCanvasSchema {
  page: { width: number; height: number; margin: number }; // A4: 794x1123 @96dpi
  blocks: CanvasBlock[];
}

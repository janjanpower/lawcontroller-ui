export type BlockType = "heading" | "paragraph" | "table" | "signature" | "image";

export interface CanvasBlockBase {
  id: string;
  type: BlockType;
  x: number;   // 畫布座標（px）
  y: number;
  w: number;   // 寬（px）
  h?: number;  // 可選，高度自動撐或手調
  z?: number;  // 疊層
}

export interface HeadingBlock extends CanvasBlockBase {
  type: "heading";
  text: string;            // 支援 {{vars}}
  align?: "left" | "center" | "right";
  level?: 1 | 2 | 3;
}

export interface ParagraphBlock extends CanvasBlockBase {
  type: "paragraph";
  text: string;            // 支援 {{vars}}
}

export interface TableBlock extends CanvasBlockBase {
  type: "table";
  headers: string[];       // 支援 {{vars}}
  rows: string[][];        // 支援 {{vars}}
  showBorders?: boolean;   // 編輯時可看線，輸出時我們會移除
}

export interface SignatureBlock extends CanvasBlockBase {
  type: "signature";
  label?: string;
  lineWidth?: number;      // 簽名線長度(px)
}

export interface ImageBlock extends CanvasBlockBase {
  type: "image";
  url: string;             // 若要支援上傳，先放外部 URL
  fit?: "cover" | "contain";
}

export type CanvasBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | SignatureBlock
  | ImageBlock;

export interface QuoteCanvasSchema {
  page: { width: number; height: number; margin: number }; // A4: 794x1123 @96dpi
  blocks: CanvasBlock[];
}

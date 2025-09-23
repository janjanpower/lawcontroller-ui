// modules/quotes/editor/canvas/FormatToolbar.tsx
import React from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Rows,
  Columns,
  Minus,
  Merge,
  Split,
  Link,
  Table,
} from "lucide-react";
import { CanvasBlock, TextBlock, TableBlock } from "./schema";

interface Props {
  block: CanvasBlock;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onLock: () => void;
}

export default function FormatToolbar({
  block,
  onUpdate,
  onDuplicate,
  onRemove,
  onLock,
}: Props) {
  return (
    <div
      className="absolute -top-12 left-0 bg-white border rounded shadow-sm p-1 flex items-center justify-between"
      style={{ width: `${Math.max(400, block.w * 0.9)}px`, zIndex: 10000 }}
    >
      {/* 左側工具 */}
      <div className="flex gap-1 flex-1">
        {/* ---- 文字區塊工具 ---- */}
        {block.type === "text" && (
          <>
            {/* 字體大小 */}
            <input
              type="number"
              min="8"
              max="72"
              value={(block as TextBlock).fontSize || 14}
              onChange={(e) =>
                onUpdate({ fontSize: parseInt(e.target.value) })
              }
              className="w-12 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-[#334d6d] outline-none"
              title="字體大小"
            />

            {/* 粗體/斜體/底線 */}
            <button
              onClick={() =>
                onUpdate({ bold: !(block as TextBlock).bold })
              }
              className={`p-1 hover:bg-gray-100 rounded ${
                (block as TextBlock).bold
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-600"
              }`}
              title="粗體"
            >
              <Bold className="w-3 h-3" />
            </button>
            <button
              onClick={() =>
                onUpdate({ italic: !(block as TextBlock).italic })
              }
              className={`p-1 hover:bg-gray-100 rounded ${
                (block as TextBlock).italic
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-600"
              }`}
              title="斜體"
            >
              <Italic className="w-3 h-3" />
            </button>
            <button
              onClick={() =>
                onUpdate({ underline: !(block as TextBlock).underline })
              }
              className={`p-1 hover:bg-gray-100 rounded ${
                (block as TextBlock).underline
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-600"
              }`}
              title="底線"
            >
              <Underline className="w-3 h-3" />
            </button>

            {/* 對齊 */}
            <button
              onClick={() => {
                const cur = (block as TextBlock).align || "left";
                const next =
                  cur === "left" ? "center" : cur === "center" ? "right" : "left";
                onUpdate({ align: next });
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
              title="對齊方式"
            >
              {(block as TextBlock).align === "center" ? (
                <AlignCenter className="w-3 h-3" />
              ) : (block as TextBlock).align === "right" ? (
                <AlignRight className="w-3 h-3" />
              ) : (
                <AlignLeft className="w-3 h-3" />
              )}
            </button>

            {/* 背景色 */}
            <div className="relative">
              <button className="p-1 hover:bg-gray-100 rounded" title="文字背景色">
                <Palette className="w-3 h-3 text-gray-600" />
                <input
                  type="color"
                  value={(block as TextBlock).backgroundColor || "#ffffff"}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </button>
            </div>

            {/* 變數標籤顏色 */}
            <div className="relative">
              <button className="p-1 hover:bg-gray-100 rounded" title="變數標籤顏色">
                <Palette className="w-3 h-3 text-blue-600" />
                <input
                  type="color"
                  value={(block as TextBlock).variableColor || "#dbeafe"}
                  onChange={(e) =>
                    onUpdate({ variableColor: e.target.value })
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </button>
            </div>
          </>
        )}

        {/* ---- 表格工具 ---- */}
        {block.type === "table" && (
          <>
            {/* 邊框切換 */}
            <button
              onClick={() =>
                onUpdate({ showBorders: !(block as TableBlock).showBorders })
              }
              className="p-1 hover:bg-gray-100 rounded"
              title="切換邊框"
            >
              <Table
                className={`w-3 h-3 ${
                  (block as TableBlock).showBorders !== false
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              />
            </button>

            {/* 新增刪除列 */}
            <button className="p-1 hover:bg-gray-100 rounded" title="新增列">
              <Rows className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="刪除列">
              <Minus className="w-3 h-3 text-red-600" />
            </button>

            {/* 新增刪除欄 */}
            <button className="p-1 hover:bg-gray-100 rounded" title="新增欄">
              <Columns className="w-3 h-3 text-blue-600" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="刪除欄">
              <Minus className="w-3 h-3 text-orange-600" />
            </button>

            {/* 合併/拆分 */}
            <button className="p-1 hover:bg-gray-100 rounded" title="合併儲存格">
              <Merge className="w-3 h-3 text-purple-600" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="取消合併">
              <Split className="w-3 h-3 text-gray-600" />
            </button>

            {/* 合併相鄰表格 */}
            <button className="p-1 hover:bg-gray-100 rounded" title="合併相鄰表格">
              <Link className="w-3 h-3 text-green-600" />
            </button>
          </>
        )}
      </div>

      {/* 右側通用 */}
      <div className="flex gap-1">
        <button
          onClick={onDuplicate}
          className="p-1 hover:bg-gray-100 rounded"
          title="複製"
        >
          <Copy className="w-3 h-3 text-purple-600" />
        </button>
        <button
          onClick={onLock}
          className="p-1 hover:bg-gray-100 rounded"
          title={block.locked ? "解除鎖定" : "鎖定"}
        >
          {block.locked ? (
            <Lock className="w-3 h-3 text-red-600" />
          ) : (
            <Unlock className="w-3 h-3 text-gray-600" />
          )}
        </button>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-gray-100 rounded"
          title="刪除"
        >
          <Trash2 className="w-3 h-3 text-red-600" />
        </button>
      </div>
    </div>
  );
}

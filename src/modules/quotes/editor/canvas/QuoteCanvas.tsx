import React, { useState } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock, ImageBlock } from "./schema";
import { ALL_VARS } from "./variables";
import { nanoid } from "nanoid";
import VariableInserter from "../canvas/VariableInserter"; // 加上這行

type Props = {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
  onExport: (schema: QuoteCanvasSchema) => void;         // 匯出
  onSaveTemplate: (schema: QuoteCanvasSchema) => void;   // 儲存模板
  onRemoveTemplate: () => void;                          // 移除模板
};

export default function QuoteCanvas({ value, onChange, onExport, onSaveTemplate, onRemoveTemplate }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const addBlock = (type: CanvasBlock["type"]) => {
    const base = { id: nanoid(), x: 40, y: 40, w: 360, z: Date.now() } as const;
    let block: CanvasBlock;
    switch (type) {
      case "text":
        block = {
          ...base,
          type,
          text: "新文字 {{case.client_name}}",
          bold: false,
          italic: false,
          underline: false,
          fontSize: 14,
          align: "left",
          h: 80,
        } as TextBlock;
        break;
      case "table":
        block = {
          ...base,
          type,
          headers: ["項目", "單價", "數量", "小計"],
          rows: [["法律諮詢", "5000", "1", "5000"]],
          showBorders: true,
          h: 180,
        } as TableBlock;
        break;
      case "image":
        block = {
          ...base,
          type,
          url: "https://via.placeholder.com/150",
          fit: "contain",
          h: 120,
        } as ImageBlock;
        break;
      default:
        return;
    }
    onChange({ ...value, blocks: [...value.blocks, block] });
  };

  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b) => (b.id === id ? { ...b, ...patch } as CanvasBlock : b)),
    });
  };

  const removeBlock = (id: string) => {
    onChange({ ...value, blocks: value.blocks.filter((b) => b.id !== id) });
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* 上方操作列 */}
      <div className="flex justify-end gap-2 mb-2">
        <button className="btn" onClick={() => setPreviewOpen(true)}>👁 預覽</button>
        <button className="btn" onClick={() => onSaveTemplate(value)}>💾 儲存模板</button>
        <button className="btn" onClick={onRemoveTemplate}>🗑 移除模板</button>
        <button className="btn" onClick={() => onExport(value)}>📄 匯出</button>
      </div>

      {/* 主體：左側工具列 + 畫布 */}
      <div className="flex gap-3">
        {/* 左側工具列 */}
        <div className="w-44 shrink-0">
          <div className="text-sm font-semibold mb-2">工具</div>
          <div className="grid gap-2">
            <button className="btn" onClick={() => addBlock("text")}>＋ 文字</button>
            <button className="btn" onClick={() => addBlock("table")}>＋ 表格</button>
            <button className="btn" onClick={() => addBlock("image")}>＋ 圖片</button>
          </div>

          <div className="text-sm font-semibold mt-6 mb-2">變數</div>
          <div className="max-h-64 overflow-auto text-xs space-y-1">
            {ALL_VARS.map((v) => (
              <div key={v.key} className="px-2 py-1 rounded bg-gray-100">{`{{${v.key}}}`} — {v.label}</div>
            ))}
          </div>
        </div>

        {/* 右側畫布（A4 頁） */}
        <div
          className="relative bg-[#fafafa] border rounded shadow-inner"
          style={{
            width: value.page.width,
            height: value.page.height,
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            padding: value.page.margin,
          }}
        >
          {value.blocks.map((b) => (
            <Rnd
              key={b.id}
              size={{ width: b.w, height: b.h ?? "auto" }}
              position={{ x: b.x, y: b.y }}
              disableDragging={!!b.locked}
              enableResizing={b.locked ? false : { bottomRight: true, right: true, bottom: true }}
              onDragStop={(_, d) => {
              let newX = Math.round(d.x);
              let newY = Math.round(d.y);

              const tolerance = 10;
              let groupId = b.groupId || b.id;

              // 1️⃣ 吸附邏輯：檢查是否靠近其他 block
              value.blocks.forEach((other) => {
                if (other.id === b.id) return;

                const closeRight = Math.abs(newX + b.w - other.x) < tolerance;
                const closeLeft = Math.abs(newX - (other.x + other.w)) < tolerance;
                const closeBottom = Math.abs(newY + (b.h ?? 0) - other.y) < tolerance;
                const closeTop = Math.abs(newY - ((other.h ?? 0) + other.y)) < tolerance;

                // X 對齊條件
                const alignedY =
                  Math.abs(newY - other.y) < tolerance ||
                  Math.abs(newY + (b.h ?? 0) - (other.y + (other.h ?? 0))) < tolerance;

                // Y 對齊條件
                const alignedX =
                  Math.abs(newX - other.x) < tolerance ||
                  Math.abs(newX + b.w - (other.x + other.w)) < tolerance;

                if ((closeRight && alignedY) || (closeLeft && alignedY)) {
                  // 水平貼齊
                  newX = closeRight ? other.x - b.w : other.x + other.w;
                  newY = other.y;
                  groupId = other.groupId || groupId;
                  updateBlock(other.id, { groupId });
                  updateBlock(b.id, { groupId });
                }

                if ((closeBottom && alignedX) || (closeTop && alignedX)) {
                  // 垂直貼齊
                  newX = other.x;
                  newY = closeBottom ? other.y - (b.h ?? 0) : other.y + (other.h ?? 0);
                  groupId = other.groupId || groupId;
                  updateBlock(other.id, { groupId });
                  updateBlock(b.id, { groupId });
                }
              });

              // 2️⃣ 群組移動：同 group block 一起移動
              const dx = newX - b.x;
              const dy = newY - b.y;
              if (groupId) {
                value.blocks
                  .filter((x) => x.groupId === groupId && x.id !== b.id)
                  .forEach((x) => {
                    updateBlock(x.id, { x: x.x + dx, y: x.y + dy });
                  });
              }

              // 3️⃣ 更新自己
              updateBlock(b.id, { x: newX, y: newY, groupId });
            }}

              onResizeStop={(_, __, ref, ___, pos) =>
                updateBlock(b.id, {
                  w: Math.round(ref.offsetWidth),
                  h: Math.round(ref.offsetHeight),
                  x: pos.x,
                  y: pos.y,
                })
              }
              style={{ zIndex: b.z ?? 1 }}
              className="group"
            >
              <div className="bg-white/90 border border-dashed border-gray-300 rounded p-2 shadow-sm">
                <BlockEditor block={b} onChange={(patch) => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} />
              </div>
            </Rnd>
          ))}
        </div>
      </div>

      {/* 預覽 Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl p-4 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">樣式預覽</h2>
              <button className="icon-btn" onClick={() => setPreviewOpen(false)}>✖</button>
            </div>
            <PreviewRenderer schema={value} />
          </div>
        </div>
      )}
    </div>
  );
}

/* 各 Block 編輯邏輯 */
function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
  onRemove: () => void;
}) {
  if (block.type === "text") {
  const b = block as TextBlock;
  return (
    <div>
      {/* 操作列 */}
      <div className="flex justify-between items-center mb-1">
        <div className="hidden group-hover:flex gap-1">
          <button className="icon-btn" onClick={onRemove}>🗑</button>
          <button
            className="icon-btn"
            title={b.locked ? "解除鎖定" : "鎖定位置"}
            onClick={() => onChange({ locked: !b.locked })}
          >
            {b.locked ? "🔓" : "🔒"}
          </button>
        </div>
      </div>

      {/* 編輯區 */}
      <div
        contentEditable
        suppressContentEditableWarning
        className="leading-6 whitespace-pre-wrap border rounded p-1 min-h-[2em]"
        onInput={(e) => onChange({ text: (e.target as HTMLElement).innerText })}
      >
        {b.text}
      </div>

      {/* 插入變數工具 */}
      <VariableInserter
        onInsert={(v) => onChange({ text: (b.text || "") + v })}
      />
    </div>
  );
}

  if (block.type === "table") {
  const b = block as TableBlock;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs text-gray-500">雙擊儲存格可編輯</div>
        <div className="hidden group-hover:flex gap-1">
          <button className="icon-btn" onClick={onRemove}>🗑</button>
          <button
            className="icon-btn"
            title={b.locked ? "解除鎖定" : "鎖定位置"}
            onClick={() => onChange({ locked: !b.locked })}
          >
            {b.locked ? "🔓" : "🔒"}
          </button>
        </div>
      </div>

      <table className="w-full border border-gray-300">
        <thead>
          <tr>
            {b.headers.map((h, i) => (
              <th
                key={i}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const headers = [...b.headers];
                  headers[i] = (e.target as HTMLElement).innerText;
                  onChange({ headers });
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const rows = b.rows.map((r) => [...r]);
                    rows[ri][ci] = (e.target as HTMLElement).innerText;
                    onChange({ rows });
                  }}
                  className="relative"   // 🆕 這裡加上 relative
                >
                  {cell}
                  {/* 🆕 插入變數按鈕 */}
                  <div className="absolute right-1 bottom-1">
                    <VariableInserter
                      onInsert={(v) => {
                        const rows = b.rows.map((r) => [...r]);
                        rows[ri][ci] = (rows[ri][ci] || "") + v;
                        onChange({ rows });
                      }}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>


      </table>

      <div className="mt-2 flex gap-2">
        {/* 新增列 */}
        <button
          className="btn-xs"
          onClick={() => {
            onChange({
              rows: [...b.rows, new Array(b.headers.length).fill("")],
            });
          }}
        >
          ＋ 新增一列
        </button>

        {/* 新增行 */}
        <button
          className="btn-xs"
          onClick={() => {
            const newHeaders = [...b.headers, `欄位${b.headers.length + 1}`];
            const newRows = b.rows.map((r) => [...r, ""]);
            onChange({ headers: newHeaders, rows: newRows });
          }}
        >
          ＋ 新增一行
        </button>
      </div>

      {/* 插入變數 */}
      <VariableInserter
        onInsert={(v) => {
          const rows = [...b.rows];
          if (rows.length > 0 && rows[0].length > 0) {
            rows[0][0] = (rows[0][0] || "") + v;
            onChange({ rows });
          }
        }}
      />
    </div>
  );
}



  if (block.type === "image") {
    const b = block as ImageBlock;
    return (
      <div>
        <div className="flex justify-between mb-1">
          <input
            className="text-xs border rounded px-1 py-0.5 w-56"
            placeholder="圖片 URL"
            value={b.url}
            onChange={(e) => onChange({ url: e.target.value } as any)}
          />
          <div className="hidden group-hover:flex gap-1">
            <button className="icon-btn" onClick={onRemove}>🗑</button>
            <button
              className="icon-btn"
              title={b.locked ? "解除鎖定" : "鎖定位置"}
              onClick={() => onChange({ locked: !b.locked } as any)}
            >
              {b.locked ? "🔓" : "🔒"}
            </button>
          </div>
        </div>
        <img src={b.url} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }

  return null;
}

/* 預覽渲染器 */
function PreviewRenderer({ schema }: { schema: QuoteCanvasSchema }) {
  return (
    <div
      style={{
        width: schema.page.width,
        height: schema.page.height,
        background: "#fff",
        margin: "0 auto",
        padding: schema.page.margin,
      }}
    >
      {schema.blocks.map((b) => {
        if (b.type === "text") {
          return (
            <div
              key={b.id}
              style={{
                fontSize: b.fontSize ?? 14,
                fontWeight: b.bold ? "bold" : "normal",
                fontStyle: b.italic ? "italic" : "normal",
                textDecoration: b.underline ? "underline" : "none",
                textAlign: b.align ?? "left",
                marginBottom: "0.5em",
              }}
            >
              {b.text}
            </div>
          );
        }
        if (b.type === "table") {
          return (
            <table key={b.id} style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1em" }}>
              <thead>
                <tr>
                  {b.headers.map((h, i) => (
                    <th key={i} style={{ border: "1px solid #ccc", padding: "4px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ border: "1px solid #ccc", padding: "4px" }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (b.type === "image") {
          return <img key={b.id} src={b.url} alt="" style={{ maxWidth: "100%", marginBottom: "1em" }} />;
        }
        return null;
      })}
    </div>
  );
}

import React, { useMemo } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, HeadingBlock, ParagraphBlock, TableBlock, SignatureBlock } from "./schema";
import { ALL_VARS } from "./variables";
import { nanoid } from "nanoid";

type Props = {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
};

export default function QuoteCanvas({ value, onChange }: Props) {
  const addBlock = (type: CanvasBlock["type"]) => {
    const base = { id: nanoid(), x: 40, y: 40, w: 360 } as const;
    let block: CanvasBlock;
    switch (type) {
      case "heading":
        block = { ...base, type, text: "報價單", level: 1, h: 60, z: Date.now() };
        break;
      case "paragraph":
        block = { ...base, type, text: "客戶：{{case.client_name}}", h: 80, z: Date.now() };
        break;
      case "table":
        block = {
          ...base,
          type,
          headers: ["項目", "單價", "數量", "小計"],
          rows: [["法律諮詢", "5000", "1", "5000"]],
          showBorders: true,
          h: 180, z: Date.now()
        };
        break;
      case "signature":
        block = { ...base, type, label: "律師簽章", h: 60, z: Date.now() };
        break;
      case "image":
        block = { ...base, type, url: "https://via.placeholder.com/150", fit: "contain", h: 120, z: Date.now() };
        break;
      default:
        return;
    }
    onChange({ ...value, blocks: [...value.blocks, block] });
  };

  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    onChange({
      ...value,
      blocks: value.blocks.map(b => (b.id === id ? { ...b, ...patch } as CanvasBlock : b)),
    });
  };

  const removeBlock = (id: string) => {
    onChange({ ...value, blocks: value.blocks.filter(b => b.id !== id) });
  };

  return (
    <div className="flex gap-3">
      {/* 左側工具列 */}
      <div className="w-44 shrink-0">
        <div className="text-sm font-semibold mb-2">工具</div>
        <div className="grid gap-2">
          <button className="btn" onClick={() => addBlock("heading")}>＋ 標題</button>
          <button className="btn" onClick={() => addBlock("paragraph")}>＋ 文字</button>
          <button className="btn" onClick={() => addBlock("table")}>＋ 表格</button>
          <button className="btn" onClick={() => addBlock("signature")}>＋ 簽章</button>
          <button className="btn" onClick={() => addBlock("image")}>＋ 圖片</button>
        </div>

        <div className="text-sm font-semibold mt-6 mb-2">變數</div>
        <div className="max-h-64 overflow-auto text-xs space-y-1">
          {ALL_VARS.map(v => (
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
            enableResizing={{ bottomRight: true, right: true, bottom: true }}
            onDragStop={(_, d) => updateBlock(b.id, { x: Math.round(d.x), y: Math.round(d.y) })}
            onResizeStop={(_, __, ref, ___, pos) =>
              updateBlock(b.id, { w: Math.round(ref.offsetWidth), h: Math.round(ref.offsetHeight), x: pos.x, y: pos.y })
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
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
  onRemove: () => void;
}) {
  if (block.type === "heading") {
    const b = block as HeadingBlock;
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <select
            className="text-xs border rounded px-1 py-0.5"
            value={b.level ?? 1}
            onChange={(e) => onChange({ level: Number(e.target.value) as any })}
          >
            <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
          </select>
          <div className="hidden group-hover:flex gap-1">
            <button className="icon-btn" onClick={onRemove}>🗑</button>
          </div>
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          className="font-bold"
          onInput={(e) => onChange({ text: (e.target as HTMLElement).innerText })}
        >{b.text}</div>
      </div>
    );
  }

  if (block.type === "paragraph") {
    const b = block as ParagraphBlock;
    return (
      <div>
        <div className="flex justify-end mb-1">
          <button className="icon-btn" onClick={onRemove}>🗑</button>
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          className="leading-6 whitespace-pre-wrap"
          onInput={(e) => onChange({ text: (e.target as HTMLElement).innerText })}
        >{b.text}</div>
      </div>
    );
  }

  if (block.type === "table") {
    const b = block as TableBlock;
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs text-gray-500">雙擊儲存格可編輯，Enter 建新列</div>
          <div className="hidden group-hover:flex gap-1">
            <button className="icon-btn" onClick={onRemove}>🗑</button>
          </div>
        </div>
        <table className={`w-full ${b.showBorders ? "border border-gray-300" : ""}`}>
          <thead>
            <tr>
              {b.headers.map((h, i) => (
                <th key={i} className="p-1 border-b border-gray-300 text-left text-sm" contentEditable suppressContentEditableWarning
                    onInput={(e)=> {
                      const headers = [...b.headers];
                      headers[i] = (e.target as HTMLElement).innerText;
                      onChange({ headers } as any);
                    }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1 text-sm border-t"
                      contentEditable suppressContentEditableWarning
                      onInput={(e)=> {
                        const rows = b.rows.map(r => [...r]);
                        rows[ri][ci] = (e.target as HTMLElement).innerText;
                        onChange({ rows } as any);
                      }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex gap-2">
          <button className="btn-xs" onClick={()=>{
            onChange({ rows: [...b.rows, new Array(b.headers.length).fill("")] } as any);
          }}>＋ 新增一列</button>
        </div>
      </div>
    );
  }

  if (block.type === "signature") {
    const b = block as SignatureBlock;
    return (
      <div>
        <div className="flex justify-end mb-1">
          <button className="icon-btn" onClick={onRemove}>🗑</button>
        </div>
        <div className="text-sm mb-1">{b.label ?? "簽章"}</div>
        <div className="border-b border-black" style={{ width: (b.lineWidth ?? 240) }} />
      </div>
    );
  }

  // image
  return (
    <div>
      <div className="flex justify-between mb-1">
        <input
          className="text-xs border rounded px-1 py-0.5 w-56"
          placeholder="圖片 URL"
          value={(block as any).url}
          onChange={(e)=> onChange({ url: e.target.value } as any)}
        />
        <div className="hidden group-hover:flex gap-1">
          <button className="icon-btn" onClick={onRemove}>🗑</button>
        </div>
      </div>
      <img src={(block as any).url} alt="" className="w-full h-full object-contain" />
    </div>
  );
}

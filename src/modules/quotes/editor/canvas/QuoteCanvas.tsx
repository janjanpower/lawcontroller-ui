import React, { useMemo, useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, HeadingBlock, ParagraphBlock, TableBlock, SignatureBlock } from "./schema";
import { ALL_VARS } from "./variables";
import { nanoid } from "nanoid";

type Props = {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
};

export default function QuoteCanvas({ value, onChange }: Props) {
  const [showGrid, setShowGrid] = useState(true);
  const [snapSize, setSnapSize] = useState(8);
  const [highlightCenter, setHighlightCenter] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const pageW = value.page.width, pageH = value.page.height, margin = value.page.margin ?? 40;
  const centerX = margin + (pageW - margin*2)/2;
  const centerY = margin + (pageH - margin*2)/2;

  // 群組移動：若 block 有 groupId，移動時帶動同組其他 block
  const moveBlockBy = (id: string, dx: number, dy: number) => {
    const blk = value.blocks.find(b => b.id === id);
    if (!blk) return;
    const gid = blk.groupId;
    const ids = gid ? value.blocks.filter(b => b.groupId === gid).map(b => b.id) : [id];
    const next = value.blocks.map(b => ids.includes(b.id) ? { ...b, x: Math.round((b.x + dx)/snapSize)*snapSize, y: Math.round((b.y + dy)/snapSize)*snapSize } : b);
    onChange({ ...value, blocks: next });
  };

  const toggleLock = (id: string) => {
    onChange({ ...value, blocks: value.blocks.map(b => b.id === id ? { ...b, locked: !b.locked } : b) });
  };

  // 相接偵測：靠近（<=8px）邊緣提供「合併」按鈕 → 指派同 groupId
  const [pendingAttach, setPendingAttach] = useState<{a:string,b:string}|null>(null);
  useEffect(() => {
    // 簡化：檢查最後兩個互相靠近的 block
    const blks = value.blocks;
    for (let i=0;i<blks.length;i++) for (let j=i+1;j<blks.length;j++) {
      const A = blks[i], B = blks[j];
      const nearX = Math.abs((A.x+A.w) - B.x) <= 8 || Math.abs((B.x+B.w) - A.x) <= 8;
      const nearY = Math.abs((A.y+A.h!) - B.y) <= 8 || Math.abs((B.y+B.h!) - A.y) <= 8;
      if (nearX || nearY) { setPendingAttach({a:A.id,b:B.id}); return; }
    }
    setPendingAttach(null);
  }, [value.blocks]);

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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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
          <Rnd grid={[snapSize, snapSize]}
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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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
    <div className="relative">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>顯示格線</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={highlightCenter} onChange={e=>setHighlightCenter(e.target.checked)}/>置中輔助線</label>
        <label className="inline-flex items-center gap-1">貼齊間距
          <input type="number" className="w-16 border rounded px-1 py-0.5" value={snapSize} min={2} max={32} step={2} onChange={e=>setSnapSize(parseInt(e.target.value)||8)}/>
          px
        </label>
        {pendingAttach && (
          <button className="px-2 py-1 text-xs bg-amber-100 border rounded" onClick={()=>{
            const gid = crypto?.randomUUID?.() || String(Date.now());
            onChange({ ...value, blocks: value.blocks.map(b => (b.id===pendingAttach.a||b.id===pendingAttach.b) ? { ...b, groupId: gid } : b) });
            setPendingAttach(null);
          }}>將相鄰元件合併移動</button>
        )}
      </div>
      <div ref={canvasRef} className="relative border bg-white" style={{ width: pageW, height: pageH }}>
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH}>
            {/* 格線 */}
            {Array.from({length: Math.floor(pageW/snapSize)}).map((_,i)=>(
              <line key={'v'+i} x1={i*snapSize} y1={0} x2={i*snapSize} y2={pageH} stroke="#eee" strokeWidth="1"/>
            ))}
            {Array.from({length: Math.floor(pageH/snapSize)}).map((_,i)=>(
              <line key={'h'+i} x1={0} y1={i*snapSize} x2={pageW} y2={i*snapSize} stroke="#eee" strokeWidth="1"/>
            ))}
            {highlightCenter && (
              <>
                <line x1={centerX} y1={0} x2={centerX} y2={pageH} stroke="#82b1ff" strokeDasharray="4 4"/>
                <line x1={0} y1={centerY} x2={pageW} y2={centerY} stroke="#82b1ff" strokeDasharray="4 4"/>
              </>
            )}
          </svg>
        )}

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

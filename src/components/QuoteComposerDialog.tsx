import React, { useState, useEffect } from "react";
import QuoteCanvas from "../modules/quotes/editor/canvas/QuoteCanvas";
import type { QuoteCanvasSchema } from "../modules/quotes/editor/canvas/schema";
import { getFirmCodeOrThrow } from "../utils/api";

const A4PX = { width: 794, height: 1123, margin: 40 }; // 96dpi A4 約略尺寸

interface Props {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export default function QuoteComposerDialog({ isOpen, onClose, caseId }: Props) {
  const [schema, setSchema] = useState<QuoteCanvasSchema>({
    page: A4PX,
    blocks: [],
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!isOpen) return null;

  /** 讀取模板清單 */
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const res = await fetch(`/api/quote-templates?firm_code=${firmCode}`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data || []);
        }
      } catch (err) {
        console.error("載入模板失敗", err);
      }
    })();
  }, [isOpen]);

  /** 套用模板 */
  const applyTemplate = (tpl: any) => {
    if (tpl?.content_json) {
      setSchema(tpl.content_json);
    }
  };

  /** 儲存模板 */
  const handleSaveAsTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const name = prompt("請輸入模板名稱：", "我的模板");
      if (!name) return;

      const res = await fetch(`/api/quote-templates?firm_code=${firmCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          content_json: schema,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "儲存模板失敗");
        return;
      }

      alert("模板已儲存！");
      const reload = await fetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  /** 移除模板 */
  const handleRemoveTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const tplId = prompt("請輸入要移除的模板 ID：");
      if (!tplId) return;

      const res = await fetch(`/api/quote-templates/${tplId}?firm_code=${firmCode}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "移除模板失敗");
        return;
      }

      alert("模板已移除！");
      // ✅ 重新載入模板清單
      const reload = await fetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  /** 匯出 PDF → 直接下載 */
  const handleExport = async (current: QuoteCanvasSchema) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await fetch(`/api/quotes/render-pdf?firm_code=${firmCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          schema_json: current,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.detail || "匯出失敗");
        return;
      }

      // 後端回傳 PDF bytes
      const blob = await res.blob();
      if (blob.type !== "application/pdf") {
        const text = await blob.text();
        alert("匯出失敗：" + text);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quote_${caseId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId } }));
      onClose();
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <h2 className="text-lg font-semibold">建立報價單</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* 套用模板下拉選單 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <span className="text-sm text-gray-600">套用模板：</span>
          <select
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) applyTemplate(tpl);
            }}
            className="border rounded p-1 text-sm"
          >
            <option value="">選擇模板</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        </div>

        {/* 編輯器 */}
        <div className="flex-1 overflow-y-auto p-4">
          <QuoteCanvas
            value={schema}
            onChange={setSchema}
            onExport={handleExport}
            onSaveTemplate={handleSaveAsTemplate}
            onRemoveTemplate={handleRemoveTemplate}
          />
        </div>

        {/* 底部操作列 */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">取消</button>
          <button onClick={() => setPreviewOpen(true)} className="px-4 py-2 rounded bg-gray-500 text-white">
            👁 預覽
          </button>
          <button onClick={handleSaveAsTemplate} className="px-4 py-2 rounded bg-purple-600 text-white">
            💾 儲存模板
          </button>
          <button onClick={handleRemoveTemplate} className="px-4 py-2 rounded bg-red-600 text-white">
            🗑 移除模板
          </button>
          <button onClick={() => handleExport(schema)} className="px-4 py-2 rounded bg-blue-600 text-white">
            📄 匯出
          </button>
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
            <PreviewRenderer schema={schema} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 簡單的預覽渲染器：根據 block 的位置還原畫面 */
function PreviewRenderer({ schema }: { schema: QuoteCanvasSchema }) {
  return (
    <div
      style={{
        width: schema.page.width,
        height: schema.page.height,
        background: "#fff",
        margin: "0 auto",
        padding: schema.page.margin,
        position: "relative",
      }}
    >
      {schema.blocks.map((b) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h ?? "auto",
        };

        if (b.type === "text") {
          const tb = b as any;
          return (
            <div
              key={b.id}
              style={{
                ...style,
                fontSize: tb.fontSize ?? 14,
                fontWeight: tb.bold ? "bold" : "normal",
                fontStyle: tb.italic ? "italic" : "normal",
                textDecoration: tb.underline ? "underline" : "none",
                textAlign: tb.align ?? "left",
              }}
            >
              {tb.text}
            </div>
          );
        }
        if (b.type === "table") {
          const tb = b as any;
          return (
            <table
              key={b.id}
              style={{
                ...style,
                borderCollapse: "collapse",
                background: "#fff",
              }}
            >
              <thead>
                <tr>
                  {tb.headers.map((h: string, i: number) => (
                    <th key={i} style={{ border: "1px solid #ccc", padding: "4px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((row: string[], ri: number) => (
                  <tr key={ri}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} style={{ border: "1px solid #ccc", padding: "4px" }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (b.type === "image") {
          const ib = b as any;
          return <img key={b.id} src={ib.url} alt="" style={{ ...style, objectFit: ib.fit ?? "contain" }} />;
        }
        return null;
      })}
    </div>
  );
}

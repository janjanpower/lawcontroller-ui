import React, { useState, useEffect } from "react";
import QuoteCanvas from "../modules/quotes/editor/canvas/QuoteCanvas";
import type { QuoteCanvasSchema } from "../modules/quotes/editor/canvas/schema";
import { getFirmCodeOrThrow, apiFetch } from "../utils/api";
import { X, Eye, Save, Download, Trash2 } from "lucide-react";

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
    gridSize: 10,
    showGrid: true,
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  /** 讀取模板清單 */
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        const firmCode = getFirmCodeOrThrow();
        const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data || []);
        }
      } catch (err) {
        console.error("載入模板失敗", err);
      } finally {
        setLoading(false);
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
      const name = prompt("請輸入模板名稱：", "自訂報價單模板");
      if (!name) return;

      setLoading(true);
      const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: `由案件 ${caseId} 建立的自訂模板`,
          content_json: schema,
          is_default: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "儲存模板失敗");
        return;
      }

      alert("模板已儲存！");
      const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    } finally {
      setLoading(false);
    }
  };

  /** 移除模板 */
  const handleRemoveTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      
      if (templates.length === 0) {
        alert("目前沒有可移除的模板");
        return;
      }

      // 顯示模板選擇對話框
      const templateOptions = templates.map(t => `${t.id}: ${t.name}`).join('\n');
      const selectedTemplate = prompt(`請選擇要移除的模板：\n\n${templateOptions}\n\n請輸入模板 ID：`);
      
      if (!selectedTemplate) return;
      
      const template = templates.find(t => t.id === selectedTemplate || t.name === selectedTemplate);
      if (!template) {
        alert("找不到指定的模板");
        return;
      }

      if (!confirm(`確定要刪除模板「${template.name}」嗎？此操作無法復原。`)) {
        return;
      }

      setLoading(true);
      const res = await apiFetch(`/api/quote-templates/${template.id}?firm_code=${firmCode}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "移除模板失敗");
        return;
      }

      alert("模板已移除！");
      const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    } finally {
      setLoading(false);
    }
  };

  /** 匯出 PDF → 直接下載 */
  const handleExport = async (current: QuoteCanvasSchema) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      setLoading(true);
      const res = await apiFetch(`/api/quotes/render-pdf?firm_code=${firmCode}`, {
        method: "POST",
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
      a.download = `報價單_${caseId}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId } }));
      onClose();
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Save className="w-5 h-5" />
            建立報價單
          </h2>
          <button 
            onClick={onClose} 
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 工具列 */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">套用模板：</span>
              <select
                onChange={(e) => {
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (tpl) applyTemplate(tpl);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                disabled={loading}
              >
                <option value="">選擇現有模板</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#334d6d]"></div>
                處理中...
              </div>
            )}
          </div>
        </div>

        {/* 編輯器 */}
        <div className="flex-1 overflow-hidden">
          <QuoteCanvas
            value={schema}
            onChange={setSchema}
            onExport={handleExport}
            onSaveTemplate={handleSaveAsTemplate}
            onRemoveTemplate={handleRemoveTemplate}
            caseId={caseId}
          />
        </div>

        {/* 底部操作列 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
            disabled={loading}
          >
            取消
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setPreviewOpen(true)} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <Eye className="w-4 h-4" />
              預覽
            </button>
            <button 
              onClick={handleSaveAsTemplate} 
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              儲存模板
            </button>
            <button 
              onClick={handleRemoveTemplate} 
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors flex items-center gap-2"
              disabled={loading || templates.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              移除模板
            </button>
            <button 
              onClick={() => handleExport(schema)} 
              className="px-6 py-2 bg-[#334d6d] hover:bg-[#3f5a7d] text-white rounded-md transition-colors flex items-center gap-2 font-medium"
              disabled={loading}
            >
              <Download className="w-4 h-4" />
              匯出 PDF
            </button>
          </div>
        </div>
      </div>

      {/* 預覽對話框 */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl max-h-[90vh] overflow-auto">
            <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                報價單預覽
              </h2>
              <button 
                onClick={() => setPreviewOpen(false)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <PreviewRenderer schema={schema} />
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
              >
                關閉預覽
              </button>
              <button 
                onClick={() => {
                  setPreviewOpen(false);
                  handleExport(schema);
                }}
                className="px-6 py-2 bg-[#334d6d] hover:bg-[#3f5a7d] text-white rounded-md transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <Download className="w-4 h-4" />
                直接匯出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 預覽渲染器：根據 schema 渲染最終效果 */
function PreviewRenderer({ schema }: { schema: QuoteCanvasSchema }) {
  return (
    <div
      className="bg-white shadow-lg mx-auto"
      style={{
        width: schema.page.width,
        height: schema.page.height,
        position: "relative",
        transform: "scale(0.8)",
        transformOrigin: "top center",
      }}
    >
      {schema.blocks.map((block) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: block.x,
          top: block.y,
          width: block.w,
          height: block.h || "auto",
          zIndex: block.z || 1,
        };

        if (block.type === "text") {
          const textBlock = block as TextBlock;
          return (
            <div
              key={block.id}
              style={{
                ...style,
                fontSize: textBlock.fontSize || 14,
                fontWeight: textBlock.bold ? "bold" : "normal",
                fontStyle: textBlock.italic ? "italic" : "normal",
                textDecoration: textBlock.underline ? "underline" : "none",
                textAlign: textBlock.align || "left",
                color: textBlock.color || "#000000",
                backgroundColor: textBlock.backgroundColor || "transparent",
                padding: "4px",
                wordWrap: "break-word",
              }}
            >
              {textBlock.text}
            </div>
          );
        }

        if (block.type === "table") {
          const tableBlock = block as TableBlock;
          return (
            <table
              key={block.id}
              style={{
                ...style,
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
              className="border border-gray-400"
            >
              <thead>
                <tr>
                  {tableBlock.headers.map((header, i) => (
                    <th
                      key={i}
                      className="border border-gray-400 px-2 py-1"
                      style={{
                        fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                        backgroundColor: tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                        textAlign: tableBlock.headerStyle?.textAlign || "center",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableBlock.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-gray-400 px-2 py-1"
                        style={{
                          textAlign: tableBlock.cellStyle?.textAlign || "left",
                          padding: tableBlock.cellStyle?.padding || 4,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }

        if (block.type === "image") {
          const imageBlock = block as ImageBlock;
          return (
            <img
              key={block.id}
              src={imageBlock.url}
              alt={imageBlock.alt || "圖片"}
              style={{
                ...style,
                objectFit: imageBlock.fit || "contain",
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
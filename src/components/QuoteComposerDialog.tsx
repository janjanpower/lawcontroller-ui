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
  const [loading, setLoading] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);

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
      setCurrentTemplateId(tpl.id);
    }
  };

  /** 儲存模板 */
  const handleSaveAsTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      
      // 檢查是否有當前模板ID（從 QuoteCanvas 傳來）
      const currentTemplateId = (schema as any).currentTemplateId;
      
      if (currentTemplateId) {
        // 更新現有模板
        const currentTemplate = templates.find(t => t.id === currentTemplateId);
        if (currentTemplate) {
          setLoading(true);
          const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${firmCode}`, {
            method: "PUT",
            body: JSON.stringify({
              name: currentTemplate.name,
              description: currentTemplate.description,
              content_json: schema,
              is_default: currentTemplate.is_default
            }),
          });

          if (res.ok) {
            alert("模板已更新！");
          } else {
            const err = await res.json();
            alert(err?.detail || "更新模板失敗");
          }
        }
      } else {
        // 創建新模板
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
      }
      
      // 重新載入模板列表
      const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    } finally {
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  /** 移除模板 */
  const handleRemoveTemplate = async () => {
    if (!currentTemplateId) {
      alert("請先選擇一個模板");
      return;
    }

    try {
      const firmCode = getFirmCodeOrThrow();
      const template = templates.find(t => t.id === currentTemplateId);
      if (!template) {
        alert("找不到當前模板");
        return;
      }

      if (!confirm(`確定要刪除模板「${template.name}」嗎？此操作無法復原。`)) {
        return;
      }

      setLoading(true);
      const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${firmCode}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "移除模板失敗");
        return;
      }

      alert("模板已移除！");
      
      // 重新載入模板列表
      const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
      
      // 清空當前模板並使用預設模板
      setCurrentTemplateId(null);
      setSchema({ page: A4PX, blocks: [], gridSize: 10, showGrid: true });
      
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
        <div className="px-6 py-3 border-b bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#334d6d]"></div>
              處理中...
            </div>
          )}
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
              onClick={handleSaveAsTemplate} 
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              儲存模板
            </button>
            <button 
              onClick={handleRemoveTemplate} 
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors flex items-center gap-2"
              disabled={loading}
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
    </div>
  );
}
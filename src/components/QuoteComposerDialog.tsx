import React, { useState, useEffect } from "react";
import QuoteCanvas from "../modules/quotes/editor/canvas/QuoteCanvas";
import type { QuoteCanvasSchema } from "../modules/quotes/editor/canvas/schema";
import { getFirmCodeOrThrow, apiFetch } from "../utils/api";
import { X, FileText, Download, Save, Trash2 } from "lucide-react";
import 'react/jsx-runtime'

const A4PX = { width: 794, height: 1123, margin: 30 };

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* 標題列 */}
        <div className="bg-gradient-to-r from-[#334d6d] to-[#3f5a7d] text-white px-8 py-5 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-3 tracking-wide">
            <FileText className="w-5 h-5" />
            建立報價單
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-all duration-200 p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 編輯器 */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <QuoteCanvas
            value={schema}
            onChange={setSchema}
            onExport={handleExport}
            onSaveTemplate={() => {}}
            onRemoveTemplate={() => {}}
            caseId={caseId}
          />
        </div>
      </div>
    </div>
  );
}
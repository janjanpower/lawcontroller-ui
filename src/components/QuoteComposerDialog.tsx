import React, { useState, useEffect } from "react";
import QuoteComposer, { CardData } from "../modules/quotes/editor/QuoteComposer";
import { getFirmCodeOrThrow } from "../utils/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export default function QuoteComposerDialog({ isOpen, onClose, caseId }: Props) {
  const [schema, setSchema] = useState<CardData[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

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
    if (tpl?.content_json?.sections) {
      setSchema(tpl.content_json.sections);
    }
  };

  /** 存成模板 */
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
          content_json: { sections: schema },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "儲存模板失敗");
        return;
      }

      alert("模板已儲存！");
      // 重新載入模板清單
      const reload = await fetch(`/api/quote-templates?firm_code=${firmCode}`);
      if (reload.ok) {
        const data = await reload.json();
        setTemplates(data || []);
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  /** 匯出 PDF */
  const handleSave = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await fetch(`/api/quotes/render-pdf?firm_code=${firmCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          schema_json: { sections: schema },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "匯出失敗");
        return;
      }

      const data = await res.json();
      alert("PDF 匯出成功！");
      console.log("PDF 位置:", data.pdf_url);

      // 自動開啟 PDF 頁面
      window.open(data.pdf_url, "_blank");

      // 通知案件檔案刷新
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
          <QuoteComposer value={schema} onChange={setSchema} />
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">取消</button>
          <button onClick={handleSaveAsTemplate} className="px-4 py-2 rounded bg-purple-600 text-white">
            存成模板
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white">
            儲存並匯出
          </button>
        </div>
      </div>
    </div>
  );
}

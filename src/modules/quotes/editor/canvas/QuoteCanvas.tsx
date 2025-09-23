import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { nanoid } from "nanoid";
import {
  QuoteCanvasSchema,
  CanvasBlock,
  TextBlock,
  TableBlock,
} from "./schema";
import { type VariableDef } from "./variables";
import {
  Eye,
  EyeOff,
  Type,
  Table,
  Copy,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";
import { apiFetch, getFirmCodeOrThrow } from "../../../../utils/api";

// 子元件
import BlockRenderer from "./BlockRenderer";
import FormatToolbar from "./FormatToolbar";

type Props = {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
  onExport: (schema: QuoteCanvasSchema) => void;
  onSaveTemplate: () => void;
  onRemoveTemplate: () => void;
  caseId?: string;
};

export default function QuoteCanvas({
  value,
  onChange,
  onExport,
  onSaveTemplate,
  onRemoveTemplate,
  caseId,
}: Props) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [vars, setVars] = useState<VariableDef[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null
  );
  const [caseContext, setCaseContext] = useState<any>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  const gridSize = value.gridSize || 10;

  /** ------------------ 載入資料 ------------------ **/
  useEffect(() => {
    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
        if (res.ok) setTemplates(await res.json());
      } catch (err) {
        console.error("載入模板失敗", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        // 變數
        const varsRes = await apiFetch(
          `/api/cases/${caseId}/variables?firm_code=${firmCode}`
        );
        if (varsRes.ok) setVars(await varsRes.json());

        // 上下文
        const caseRes = await apiFetch(
          `/api/cases/${caseId}?firm_code=${firmCode}`
        );
        if (caseRes.ok) {
          const caseData = await caseRes.json();
          setCaseContext({
            case: {
              client_name: caseData.client_name || "",
              case_number: caseData.case_number || "",
              court: caseData.court || "",
              lawyer_name: caseData.lawyer_name || "",
              case_type: caseData.case_type || "",
              case_reason: caseData.case_reason || "",
            },
            firm: { name: localStorage.getItem("law_firm_name") || "" },
            sys: {
              now: new Date().toLocaleDateString("zh-TW"),
              year: new Date().getFullYear(),
              month: new Date().getMonth() + 1,
              day: new Date().getDate(),
            },
          });
        }
      } catch (err) {
        console.error("載入案件資料失敗", err);
      }
    })();
  }, [caseId]);

  /** ------------------ 區塊操作 ------------------ **/
  const snapToGridHelper = useCallback(
    (v: number) => (snapToGrid ? Math.round(v / gridSize) * gridSize : v),
    [snapToGrid, gridSize]
  );

  const addBlock = (type: CanvasBlock["type"]) => {
    const maxZ = Math.max(0, ...value.blocks.map((b) => b.z || 0));
    const base = {
      id: nanoid(),
      x: snapToGridHelper(40),
      y: snapToGridHelper(40),
      w: 360,
      z: maxZ + 1,
      locked: false,
    } as const;

    let block: CanvasBlock =
      type === "text"
        ? {
            ...base,
            type,
            text: "新文字區塊",
            fontSize: 14,
            color: "#000000",
            align: "left",
            h: 40,
          } as TextBlock
        : {
            ...base,
            type,
            headers: ["", "", "", ""],
            rows: [["", "", "", ""]],
            showBorders: true,
            h: 120,
            headerStyle: { bold: true, backgroundColor: "#f3f4f6" },
            cellStyle: { padding: 8, textAlign: "left" },
            columnWidths: [25, 25, 25, 25],
            mergedCells: [],
          } as TableBlock;

    onChange({ ...value, blocks: [...value.blocks, block] });
    setSelectedBlockId(block.id);
  };

  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    const maxZ = Math.max(0, ...value.blocks.map((b) => b.z || 0));
    onChange({
      ...value,
      blocks: value.blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patch,
              z: selectedBlockId === id && !patch.z ? maxZ + 1 : b.z,
            }
          : b
      ),
    });
  };

  const removeBlock = (id: string) => {
    onChange({ ...value, blocks: value.blocks.filter((b) => b.id !== id) });
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const duplicateBlock = (id: string) => {
    const block = value.blocks.find((b) => b.id === id);
    if (!block) return;
    const maxZ = Math.max(0, ...value.blocks.map((b) => b.z || 0));
    const newBlock = { ...block, id: nanoid(), x: block.x + 20, y: block.y + 20, z: maxZ + 1 };
    onChange({ ...value, blocks: [...value.blocks, newBlock] });
    setSelectedBlockId(newBlock.id);
  };

  const selectBlock = (id: string) => {
    const maxZ = Math.max(0, ...value.blocks.map((b) => b.z || 0));
    updateBlock(id, { z: maxZ + 1 });
    setSelectedBlockId(id);
  };

  /** ------------------ 畫布渲染 ------------------ **/
  const selectedBlock = value.blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="flex gap-4 h-full">
      {/* 左側工具面板 */}
      <div className="w-64 bg-gray-50 p-4 rounded-lg overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">檢視模式</h3>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? "編輯模式" : "預覽模式"}
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">新增物件</h3>
          <button
            onClick={() => addBlock("text")}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-md text-sm"
          >
            <Type className="w-4 h-4" /> 文字
          </button>
          <button
            onClick={() => addBlock("table")}
            className="w-full flex items-center gap-2 px-3 py-2 mt-2 bg-green-100 hover:bg-green-200 rounded-md text-sm"
          >
            <Table className="w-4 h-4" /> 表格
          </button>
        </div>
      </div>

      {/* 畫布 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div
            ref={canvasRef}
            className="relative bg-white border rounded shadow-lg mx-auto"
            style={{
              width: value.page.width,
              height: value.page.height,
              backgroundImage: showGrid
                ? `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`
                : undefined,
              backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : undefined,
            }}
            onClick={() => setSelectedBlockId(null)}
          >
            {value.blocks
              .sort((a, b) => (a.z || 0) - (b.z || 0))
              .map((block) => (
                <Rnd
                  key={block.id}
                  size={{ width: block.w, height: block.h || "auto" }}
                  position={{ x: block.x, y: block.y }}
                  disableDragging={block.locked || previewMode}
                  onDragStop={(_, d) => updateBlock(block.id, { x: snapToGridHelper(d.x), y: snapToGridHelper(d.y) })}
                  onResizeStop={(_, __, ref, ___, pos) =>
                    updateBlock(block.id, {
                      w: snapToGridHelper(ref.offsetWidth),
                      h: snapToGridHelper(ref.offsetHeight),
                      x: snapToGridHelper(pos.x),
                      y: snapToGridHelper(pos.y),
                    })
                  }
                  style={{ zIndex: selectedBlockId === block.id ? 9999 : block.z || 1 }}
                  className={`group ${selectedBlockId === block.id ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div
                    className="w-full h-full border border-dashed border-gray-300 bg-white p-2 cursor-pointer relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!previewMode) selectBlock(block.id);
                    }}
                  >
                    <BlockRenderer
                      block={block}
                      previewMode={previewMode}
                      caseContext={caseContext}
                      onUpdate={(patch) => updateBlock(block.id, patch)}
                    />

                    {!previewMode && selectedBlockId === block.id && (
                      <FormatToolbar
                        block={block}
                        onUpdate={(patch) => updateBlock(block.id, patch)}
                        onDuplicate={() => duplicateBlock(block.id)}
                        onRemove={() => removeBlock(block.id)}
                        onLock={() => updateBlock(block.id, { locked: !block.locked })}
                      />
                    )}
                  </div>
                </Rnd>
              ))}
          </div>
        </div>
      </div>
      {/* 底部操作列 */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end items-center gap-3">
            <button
              onClick={onSaveTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
            >
              儲存模板
            </button>
            <button
              onClick={onRemoveTemplate}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors text-sm"
            >
              移除模板
            </button>
            <button
              onClick={() => onExport(value)}
              className="px-4 py-2 bg-[#334d6d] hover:bg-[#3f5a7d] text-white rounded-md transition-colors text-sm"
            >
              匯出 PDF
            </button>
          </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import { 
  Type, Table, Lock, Unlock, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, Plus, Minus, Trash2, 
  Eye, EyeOff 
} from "lucide-react";

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
  const canvasRef = useRef<HTMLDivElement>(null);

  const gridSize = value.gridSize || 10;

  // 載入案件變數（包含階段）
  useEffect(() => {
    if (!caseId) return;
    
    (async () => {
      try {
        const firmCode = localStorage.getItem('firm_code') || localStorage.getItem('law_firm_code') || '';
        const res = await fetch(`/api/cases/${caseId}/variables?firm_code=${firmCode}`);
        if (res.ok) {
          const caseVars = await res.json();
          setVars(caseVars);
        } else {
          // 如果 API 不存在，使用基本案件資料
          const caseRes = await fetch(`/api/cases/${caseId}?firm_code=${firmCode}`);
          if (caseRes.ok) {
            const caseData = await caseRes.json();
            const basicVars: VariableDef[] = [
              { key: "case.client_name", label: "客戶姓名", value: caseData.client_name },
              { key: "case.case_number", label: "案件編號", value: caseData.case_number },
              { key: "case.court", label: "法院", value: caseData.court },
              { key: "case.lawyer_name", label: "律師姓名", value: caseData.lawyer_name },
              { key: "case.case_type", label: "案件類型", value: caseData.case_type },
              { key: "case.case_reason", label: "案由", value: caseData.case_reason },
              { key: "firm.name", label: "事務所名稱", value: localStorage.getItem('law_firm_name') || '' },
              { key: "sys.now", label: "今天日期", value: new Date().toISOString().split('T')[0] },
            ];
            setVars(basicVars);
          }
        }
      } catch (err) {
        console.error("載入案件變數失敗", err);
      }
    })();
  }, [caseId]);

  // 網格對齊輔助函數
  const snapToGridHelper = useCallback((value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  // 新增區塊
  const addBlock = (type: CanvasBlock["type"]) => {
    const base = { 
      id: nanoid(), 
      x: snapToGridHelper(40), 
      y: snapToGridHelper(40), 
      w: 360, 
      z: Date.now(),
      locked: false
    } as const;
    
    let block: CanvasBlock;
    switch (type) {
      case "text":
        block = {
          ...base,
          type,
          text: "新文字區塊",
          bold: false,
          italic: false,
          underline: false,
          fontSize: 14,
          align: "left",
          color: "#000000",
          h: 40,
        } as TextBlock;
        break;
      case "table":
        block = {
          ...base,
          type,
          headers: ["項目", "數量", "單價", "小計"],
          rows: [["法律諮詢", "1", "5000", "5000"]],
          showBorders: true,
          h: 120,
          headerStyle: { bold: true, backgroundColor: "#f3f4f6" },
          cellStyle: { padding: 8, textAlign: "left" },
        } as TableBlock;
        break;
      default:
        return;
    }
    
    onChange({ ...value, blocks: [...value.blocks, block] });
    setSelectedBlockId(block.id);
  };

  // 更新區塊
  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    onChange({
      ...value,
      blocks: value.blocks.map((b) => (b.id === id ? { ...b, ...patch } as CanvasBlock : b)),
    });
  };

  // 刪除區塊
  const removeBlock = (id: string) => {
    onChange({ ...value, blocks: value.blocks.filter((b) => b.id !== id) });
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  // 插入變數到文字區塊
  const insertVariableToText = (blockId: string, varKey: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TextBlock;
    if (block && block.type === "text") {
      updateBlock(blockId, { text: block.text + `{{${varKey}}}` });
    }
  };

  // 通用插入變數函數
  const insertVariableToBlock = (blockId: string, varKey: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    
    if (block?.type === "text") {
      insertVariableToText(blockId, varKey);
    } else if (block?.type === "table") {
      // 插入到表格的第一個儲存格
      const tableBlock = block as TableBlock;
      if (tableBlock.rows.length > 0 && tableBlock.rows[0].length > 0) {
        const newRows = [...tableBlock.rows];
        newRows[0][0] += `{{${varKey}}}`;
        updateBlock(blockId, { rows: newRows });
      }
    }
  };

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="flex gap-4 h-full">
      {/* 左側工具面板 */}
      <div className="w-64 bg-gray-50 p-4 rounded-lg overflow-y-auto">
        {/* 新增區塊工具 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">新增元素</h3>
          <div className="space-y-2">
            <button
              onClick={() => addBlock("text")}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-md text-sm transition-colors"
            >
              <Type className="w-4 h-4" />
              文字
            </button>
            <button
              onClick={() => addBlock("table")}
              className="w-full flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 rounded-md text-sm transition-colors"
            >
              <Table className="w-4 h-4" />
              表格
            </button>
          </div>
        </div>

        {/* 畫布設定 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">畫布設定</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded"
              />
              顯示格線
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="rounded"
              />
              對齊格線
            </label>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
            >
              {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {previewMode ? "編輯模式" : "預覽模式"}
            </button>
          </div>
        </div>

        {/* 選中區塊的屬性面板 */}
        {selectedBlock && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">區塊屬性</h3>
            <BlockPropertiesPanel
              block={selectedBlock}
              vars={vars}
              onUpdate={(patch) => updateBlock(selectedBlock.id, patch)}
              onDelete={() => removeBlock(selectedBlock.id)}
              onInsertVariable={(varKey) => insertVariableToBlock(selectedBlock.id, varKey)}
            />
          </div>
        )}

      </div>

      {/* 右側畫布區域 */}
      <div className="flex-1 flex flex-col">
        {/* 畫布容器 */}
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
            {/* 中心線輔助 */}
            {showGrid && (
              <>
                <div
                  className="absolute bg-red-300 opacity-50"
                  style={{
                    left: value.page.width / 2 - 0.5,
                    top: 0,
                    width: 1,
                    height: value.page.height,
                    pointerEvents: "none",
                  }}
                />
                <div
                  className="absolute bg-red-300 opacity-50"
                  style={{
                    left: 0,
                    top: value.page.height / 2 - 0.5,
                    width: value.page.width,
                    height: 1,
                    pointerEvents: "none",
                  }}
                />
              </>
            )}

            {/* 渲染所有區塊 */}
            {value.blocks.map((block) => (
              <Rnd
                key={block.id}
                size={{ width: block.w, height: block.h || "auto" }}
                position={{ x: block.x, y: block.y }}
                disableDragging={block.locked || previewMode}
                enableResizing={
                  block.locked || previewMode
                    ? false
                    : {
                        top: true,
                        right: true,
                        bottom: true,
                        left: true,
                        topRight: true,
                        bottomRight: true,
                        bottomLeft: true,
                        topLeft: true,
                      }
                }
                onDragStop={(_, d) => {
                  const newX = snapToGridHelper(d.x);
                  const newY = snapToGridHelper(d.y);
                  updateBlock(block.id, { x: newX, y: newY });
                }}
                onResizeStop={(_, __, ref, ___, pos) => {
                  const newW = snapToGridHelper(ref.offsetWidth);
                  const newH = snapToGridHelper(ref.offsetHeight);
                  const newX = snapToGridHelper(pos.x);
                  const newY = snapToGridHelper(pos.y);
                  updateBlock(block.id, { w: newW, h: newH, x: newX, y: newY });
                }}
                style={{ zIndex: block.z || 1 }}
                className={`group ${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div
                  className={`w-full h-full ${
                    previewMode 
                      ? 'border-none bg-transparent' 
                      : 'border border-dashed border-gray-300 hover:border-gray-400'
                  } ${!previewMode ? 'bg-white' : ''} rounded p-2 cursor-pointer`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!previewMode) {
                      setSelectedBlockId(block.id);
                    }
                  }}
                >
                  <BlockRenderer block={block} previewMode={previewMode} />
                  
                  {/* 區塊控制按鈕 */}
                  {!previewMode && selectedBlockId === block.id && (
                    <div className="absolute -top-8 left-0 flex gap-1 bg-white border rounded shadow-sm p-1">
                      {block.type === "table" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const tableBlock = block as TableBlock;
                              const newRows = [...tableBlock.rows, new Array(tableBlock.headers.length).fill("")];
                              updateBlock(block.id, { rows: newRows });
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="新增列"
                          >
                            <Plus className="w-3 h-3 text-green-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const tableBlock = block as TableBlock;
                              if (tableBlock.rows.length > 1) {
                                const newRows = tableBlock.rows.slice(0, -1);
                                updateBlock(block.id, { rows: newRows });
                              }
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="刪除列"
                            disabled={(block as TableBlock).rows.length <= 1}
                          >
                            <Minus className="w-3 h-3 text-red-600" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateBlock(block.id, { locked: !block.locked });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title={block.locked ? "解除鎖定" : "鎖定位置"}
                      >
                        {block.locked ? (
                          <Unlock className="w-3 h-3 text-orange-600" />
                        ) : (
                          <Lock className="w-3 h-3 text-gray-600" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="刪除區塊"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
              </Rnd>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 區塊渲染器
function BlockRenderer({ block, previewMode }: { block: CanvasBlock; previewMode: boolean }) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;
    return (
      <div
        style={{
          fontSize: textBlock.fontSize || 14,
          fontWeight: textBlock.bold ? "bold" : "normal",
          fontStyle: textBlock.italic ? "italic" : "normal",
          textDecoration: textBlock.underline ? "underline" : "none",
          textAlign: textBlock.align || "left",
          color: textBlock.color || "#000000",
          backgroundColor: textBlock.backgroundColor || "transparent",
          width: "100%",
          height: "100%",
          padding: "4px",
          border: "none",
          outline: "none",
          resize: "none",
          overflow: "hidden",
        }}
      >
        {textBlock.text}
      </div>
    );
  }

  if (block.type === "table") {
    const tableBlock = block as TableBlock;
    return (
      <table className="w-full h-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {tableBlock.headers.map((header, i) => (
              <th
                key={i}
                className="border border-gray-300 p-1"
                style={{
                  fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                  backgroundColor: tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                  textAlign: tableBlock.headerStyle?.textAlign || "left",
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
                  className="border border-gray-300 p-1"
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

  return null;
}

// 區塊屬性面板
function BlockPropertiesPanel({
  block,
  vars,
  onUpdate,
  onDelete,
  onInsertVariable
}: {
  block: CanvasBlock;
  vars: VariableDef[];
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onDelete: () => void;
  onInsertVariable: (varKey: string) => void;
}) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;
    return (
      <div className="space-y-3">
        {/* 文字內容 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">文字內容</label>
          <textarea
            value={textBlock.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
            rows={3}
            placeholder="輸入文字內容..."
          />
        </div>

        {/* 文字格式工具 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">格式設定</label>
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => onUpdate({ bold: !textBlock.bold })}
              className={`p-1 rounded ${textBlock.bold ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="粗體"
            >
              <Bold className="w-3 h-3" />
            </button>
            <button
              onClick={() => onUpdate({ italic: !textBlock.italic })}
              className={`p-1 rounded ${textBlock.italic ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="斜體"
            >
              <Italic className="w-3 h-3" />
            </button>
            <button
              onClick={() => onUpdate({ underline: !textBlock.underline })}
              className={`p-1 rounded ${textBlock.underline ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="底線"
            >
              <Underline className="w-3 h-3" />
            </button>
          </div>

          {/* 對齊方式 */}
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => onUpdate({ align: "left" })}
              className={`p-1 rounded ${textBlock.align === "left" ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="靠左對齊"
            >
              <AlignLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => onUpdate({ align: "center" })}
              className={`p-1 rounded ${textBlock.align === "center" ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="置中對齊"
            >
              <AlignCenter className="w-3 h-3" />
            </button>
            <button
              onClick={() => onUpdate({ align: "right" })}
              className={`p-1 rounded ${textBlock.align === "right" ? 'bg-blue-200' : 'bg-gray-100'} hover:bg-blue-200`}
              title="靠右對齊"
            >
              <AlignRight className="w-3 h-3" />
            </button>
          </div>

          {/* 字體大小 */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">字體大小:</label>
            <input
              type="number"
              value={textBlock.fontSize || 14}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 14 })}
              className="w-16 px-1 py-1 border border-gray-300 rounded text-xs"
              min="8"
              max="72"
            />
          </div>
        </div>

        {/* 變數插入 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">插入變數到文字</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {vars.map((v) => (
              <button
                key={v.key}
                onClick={() => onInsertVariable(v.key)}
                className="w-full text-left px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded transition-colors"
              >
                <div className="font-mono text-blue-600">{`{{${v.key}}}`}</div>
                <div className="text-gray-600">{v.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "table") {
    const tableBlock = block as TableBlock;
    return (
      <div className="space-y-3">
        {/* 表格內容編輯 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">表格內容</label>
          <div className="border border-gray-300 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {tableBlock.headers.map((header, i) => (
                    <th key={i} className="border-r border-gray-300 p-1">
                      <input
                        value={header}
                        onChange={(e) => {
                          const newHeaders = [...tableBlock.headers];
                          newHeaders[i] = e.target.value;
                          onUpdate({ headers: newHeaders });
                        }}
                        className="w-full bg-transparent text-center font-semibold"
                        placeholder={`欄位 ${i + 1}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableBlock.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td key={colIndex} className="border-r border-gray-300 p-1">
                        <input
                          value={cell}
                          onChange={(e) => {
                            const newRows = [...tableBlock.rows];
                            newRows[rowIndex][colIndex] = e.target.value;
                            onUpdate({ rows: newRows });
                          }}
                          className="w-full bg-transparent text-center"
                          placeholder="內容"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 新增/刪除欄位 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">欄位操作</label>
          <div className="flex gap-1">
            <button
              onClick={() => {
                const newHeaders = [...tableBlock.headers, "新欄位"];
                const newRows = tableBlock.rows.map(row => [...row, ""]);
                onUpdate({ headers: newHeaders, rows: newRows });
              }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-xs"
            >
              <Plus className="w-3 h-3" />
              新增欄
            </button>
            <button
              onClick={() => {
                if (tableBlock.headers.length > 1) {
                  const newHeaders = tableBlock.headers.slice(0, -1);
                  const newRows = tableBlock.rows.map(row => row.slice(0, -1));
                  onUpdate({ headers: newHeaders, rows: newRows });
                }
              }}
              className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-xs"
              disabled={tableBlock.headers.length <= 1}
            >
              <Minus className="w-3 h-3" />
              刪除欄
            </button>
          </div>
        </div>

        {/* 變數插入到表格 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">插入變數到第一個儲存格</label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {vars.map((v) => (
              <button
                key={v.key}
                onClick={() => onInsertVariable(v.key)}
                className="w-full text-left px-2 py-1 text-xs bg-green-50 hover:bg-green-100 rounded transition-colors"
              >
                <div className="font-mono text-blue-600">{`{{${v.key}}}`}</div>
                <div className="text-gray-600">{v.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
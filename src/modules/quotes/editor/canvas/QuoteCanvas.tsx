import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import {
  Type, Table, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Plus, Minus, Trash2,
  Eye, EyeOff, Copy, Columns, Rows, Merge, Split
} from "lucide-react";
import { apiFetch, getFirmCodeOrThrow } from "../../../../utils/api";

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
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const gridSize = value.gridSize || 10;

  // 載入模板列表
  useEffect(() => {
    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data || []);
        }
      } catch (err) {
        console.error("載入模板失敗", err);
      }
    })();
  }, []);

  // 載入案件變數（包含階段）
  useEffect(() => {
    if (!caseId) return;

    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const res = await apiFetch(`/api/cases/${caseId}/variables?firm_code=${firmCode}`);
        if (res.ok) {
          const caseVars = await res.json();
          setVars(caseVars);
        } else {
          // 如果 API 不存在，使用基本案件資料
          const caseRes = await apiFetch(`/api/cases/${caseId}?firm_code=${firmCode}`);
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
          columnWidths: [25, 15, 25, 25], // 預設欄寬百分比
          mergedCells: [], // 合併儲存格資訊
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

  // 複製區塊
  const duplicateBlock = (id: string) => {
    const block = value.blocks.find(b => b.id === id);
    if (!block) return;

    const newBlock = {
      ...block,
      id: nanoid(),
      x: block.x + 20,
      y: block.y + 20,
      z: Date.now(),
    };

    onChange({ ...value, blocks: [...value.blocks, newBlock] });
    setSelectedBlockId(newBlock.id);
  };

  // 插入變數到區塊
  const insertVariableToBlock = (blockId: string, varKey: string) => {
    const block = value.blocks.find(b => b.id === blockId);

    if (block?.type === "text") {
      const textBlock = block as TextBlock;
      updateBlock(blockId, { text: textBlock.text + `{{${varKey}}}` });
    } else if (block?.type === "table" && selectedCellId) {
      const tableBlock = block as TableBlock;
      const [rowIndex, colIndex] = selectedCellId.split('-').map(Number);

      if (tableBlock.rows[rowIndex] && tableBlock.rows[rowIndex][colIndex] !== undefined) {
        const newRows = [...tableBlock.rows];
        newRows[rowIndex][colIndex] += `{{${varKey}}}`;
        updateBlock(blockId, { rows: newRows });
      }
    }
  };

  // 套用模板
  const applyTemplate = (tpl: any) => {
    if (tpl?.content_json) {
      onChange(tpl.content_json);
      setSelectedBlockId(null);
    }
  };

  // 表格操作函數
  const addTableRow = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const newRow = new Array(block.headers.length).fill("");
    updateBlock(blockId, { rows: [...block.rows, newRow] });
  };

  const removeTableRow = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table" || block.rows.length <= 1) return;

    const newRows = block.rows.slice(0, -1);
    updateBlock(blockId, { rows: newRows });
  };

  const addTableColumn = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const newHeaders = [...block.headers, "新欄位"];
    const newRows = block.rows.map(row => [...row, ""]);
    const newWidths = [...(block.columnWidths || []), 15];

    updateBlock(blockId, {
      headers: newHeaders,
      rows: newRows,
      columnWidths: newWidths
    });
  };

  const removeTableColumn = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table" || block.headers.length <= 1) return;

    const newHeaders = block.headers.slice(0, -1);
    const newRows = block.rows.map(row => row.slice(0, -1));
    const newWidths = (block.columnWidths || []).slice(0, -1);

    updateBlock(blockId, {
      headers: newHeaders,
      rows: newRows,
      columnWidths: newWidths
    });
  };

  // 合併/解除合併儲存格
  const toggleCellMerge = (blockId: string, rowIndex: number, colIndex: number) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const mergedCells = block.mergedCells || [];
    const cellKey = `${rowIndex}-${colIndex}`;

    // 檢查是否已合併
    const existingMerge = mergedCells.find(m => m.startRow === rowIndex && m.startCol === colIndex);

    if (existingMerge) {
      // 解除合併
      const newMergedCells = mergedCells.filter(m => m !== existingMerge);
      updateBlock(blockId, { mergedCells: newMergedCells });
    } else {
      // 合併（預設合併右邊一格）
      if (colIndex < block.headers.length - 1) {
        const newMerge = {
          startRow: rowIndex,
          startCol: colIndex,
          endRow: rowIndex,
          endCol: colIndex + 1
        };
        updateBlock(blockId, { mergedCells: [...mergedCells, newMerge] });
      }
    }
  };

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="flex gap-4 h-full">
      {/* 左側工具面板 */}
      <div className="w-64 bg-gray-50 p-4 rounded-lg overflow-y-auto">

         {/* 套用模板 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">套用模板</h3>
          <select
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) applyTemplate(tpl);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
          >
            <option value="">選擇現有模板</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        </div>

        {/* 預覽模式 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">檢視模式</h3>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? "編輯模式" : "預覽模式"}
          </button>
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
          </div>
        </div>

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

        {/* 可用變數 */}
        {vars.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">插入變數</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {vars.map((v) => (
                <button
                  key={v.key}
                  onClick={() => selectedBlockId && insertVariableToBlock(selectedBlockId, v.key)}
                  disabled={!selectedBlockId}
                  className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                    selectedBlockId
                      ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
                      : 'bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="font-mono text-blue-600">{`{{${v.key}}}`}</div>
                  <div className="text-gray-600">{v.label}</div>
                </button>
              ))}
            </div>
            {!selectedBlockId && (
              <p className="text-xs text-gray-500 mt-2">請先選擇一個區塊來插入變數</p>
            )}
            {selectedBlock?.type === "table" && (
              <p className="text-xs text-blue-600 mt-2">表格模式：點擊儲存格後再插入變數</p>
            )}
          </div>
        )}

        {/* 區塊屬性 */}
        {selectedBlock && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">區塊屬性</h3>

            {/* 表格區塊屬性 */}
            {selectedBlock.type === "table" && (
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={(selectedBlock as TableBlock).showBorders !== false}
                      onChange={(e) => updateBlock(selectedBlock.id, { showBorders: e.target.checked })}
                      className="rounded"
                    />
                    顯示邊框
                  </label>
                </div>
              </div>
            )}
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
            onClick={() => {
              setSelectedBlockId(null);
              setSelectedCellId(null);
            }}
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
                      ? ''
                      : 'border border-dashed border-gray-300 hover:border-gray-400 bg-white'
                  } rounded p-2 cursor-pointer`}
                  style={{
                    backgroundColor: previewMode ? 'transparent' : 'white'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!previewMode) {
                      setSelectedBlockId(block.id);
                    }
                  }}
                >
                  {/* 文字區塊屬性控制面板 - 移到上方 */}
                  {!previewMode && selectedBlockId === block.id && block.type === "text" && (
                    <div className="absolute -top-20 left-0 bg-white border rounded-lg shadow-lg p-3 z-50 min-w-80">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-600">字體大小:</label>
                          <input
                            type="number"
                            min="8"
                            max="72"
                            value={(block as TextBlock).fontSize || 14}
                            onChange={(e) => updateBlock(block.id, { fontSize: Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-600">顏色:</label>
                          <input
                            type="color"
                            value={(block as TextBlock).color || "#000000"}
                            onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                            className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-600">背景:</label>
                          <input
                            type="color"
                            value={(block as TextBlock).backgroundColor || "#ffffff"}
                            onChange={(e) => updateBlock(block.id, { backgroundColor: e.target.value })}
                            className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const textBlock = block as TextBlock;
                            updateBlock(block.id, { bold: !textBlock.bold });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).bold ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="粗體"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const textBlock = block as TextBlock;
                            updateBlock(block.id, { italic: !textBlock.italic });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).italic ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="斜體"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const textBlock = block as TextBlock;
                            updateBlock(block.id, { underline: !textBlock.underline });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).underline ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="底線"
                        >
                          <Underline className="w-3 h-3" />
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlock(block.id, { align: "left" });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).align === "left" ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="靠左對齊"
                        >
                          <AlignLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlock(block.id, { align: "center" });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).align === "center" ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="置中對齊"
                        >
                          <AlignCenter className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlock(block.id, { align: "right" });
                          }}
                          className={`p-1 rounded text-xs ${(block as TextBlock).align === "right" ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                          title="靠右對齊"
                        >
                          <AlignRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  <BlockRenderer
                    block={block}
                    previewMode={previewMode}
                    selectedCellId={selectedCellId}
                    onUpdate={(patch) => updateBlock(block.id, patch)}
                    onCellSelect={(cellId) => setSelectedCellId(cellId)}
                    onColumnResize={(colIndex, newWidth) => {
                      if (block.type === "table") {
                        const tableBlock = block as TableBlock;
                        const newWidths = [...(tableBlock.columnWidths || [])];
                        newWidths[colIndex] = newWidth;
                        updateBlock(block.id, { columnWidths: newWidths });
                      }
                    }}
                  />

                  {/* 區塊控制按鈕 */}
                  {!previewMode && selectedBlockId === block.id && (
                    <div className="absolute -top-8 left-0 flex gap-1 bg-white border rounded shadow-sm p-1">
                      {/* 表格區塊的操作 */}
                      {block.type === "table" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addTableRow(block.id);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="新增列"
                          >
                            <Rows className="w-3 h-3 text-green-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTableRow(block.id);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="刪除列"
                            disabled={(block as TableBlock).rows.length <= 1}
                          >
                            <Minus className="w-3 h-3 text-red-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addTableColumn(block.id);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="新增欄"
                          >
                            <Columns className="w-3 h-3 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTableColumn(block.id);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="刪除欄"
                            disabled={(block as TableBlock).headers.length <= 1}
                          >
                            <Minus className="w-3 h-3 text-orange-600" />
                          </button>
                          {selectedCellId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const [rowIndex, colIndex] = selectedCellId.split('-').map(Number);
                                toggleCellMerge(block.id, rowIndex, colIndex);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="合併/解除合併儲存格"
                            >
                              <Merge className="w-3 h-3 text-purple-600" />
                            </button>
                          )}
                        </>
                      )}

                      {/* 通用操作 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateBlock(block.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="複製區塊"
                      >
                        <Copy className="w-3 h-3 text-purple-600" />
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
function BlockRenderer({
  block,
  previewMode,
  selectedCellId,
  onUpdate,
  onCellSelect,
  onColumnResize
}: {
  block: CanvasBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string | null) => void;
  onColumnResize?: (colIndex: number, newWidth: number) => void;
}) {
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // 處理欄位調整
  const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (block.type !== "table") return;

    const tableBlock = block as TableBlock;
    const currentWidth = tableBlock.columnWidths?.[colIndex] || 25;

    setResizingColumn(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);

    document.addEventListener('mousemove', handleColumnResizeMove);
    document.addEventListener('mouseup', handleColumnResizeEnd);
  };

  const handleColumnResizeMove = (e: MouseEvent) => {
    if (resizingColumn === null || !onColumnResize) return;

    const deltaX = e.clientX - resizeStartX;
    const deltaPercent = (deltaX / 400) * 100; // 假設表格寬度為 400px
    const newWidth = Math.max(5, Math.min(80, resizeStartWidth + deltaPercent));

    onColumnResize(resizingColumn, Math.round(newWidth));
  };

  const handleColumnResizeEnd = () => {
    setResizingColumn(null);
    document.removeEventListener('mousemove', handleColumnResizeMove);
    document.removeEventListener('mouseup', handleColumnResizeEnd);
  };

  if (block.type === "text") {
    const textBlock = block as TextBlock;

    if (previewMode) {
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
          }}
        >
          {textBlock.text}
        </div>
      );
    }

    return (
      <textarea
        value={textBlock.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
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
        placeholder="輸入文字內容..."
      />
    );
  }

  if (block.type === "table") {
    const tableBlock = block as TableBlock;
    const columnWidths = tableBlock.columnWidths || [];
    const mergedCells = tableBlock.mergedCells || [];

    // 檢查儲存格是否被合併
    const isCellMerged = (rowIndex: number, colIndex: number) => {
      return mergedCells.some(merge =>
        rowIndex >= merge.startRow && rowIndex <= merge.endRow &&
        colIndex >= merge.startCol && colIndex <= merge.endCol &&
        !(rowIndex === merge.startRow && colIndex === merge.startCol)
      );
    };

    // 取得合併儲存格的 span
    const getCellSpan = (rowIndex: number, colIndex: number) => {
      const merge = mergedCells.find(m =>
        m.startRow === rowIndex && m.startCol === colIndex
      );
      return merge ? {
        rowSpan: merge.endRow - merge.startRow + 1,
        colSpan: merge.endCol - merge.startCol + 1
      } : { rowSpan: 1, colSpan: 1 };
    };

    return (
      <div className="relative w-full h-full">
        {/* 欄位調整線 - 只在非預覽模式顯示 */}
        {!previewMode && (
          <div className="absolute top-0 left-0 right-0 h-full pointer-events-none z-10">
            {tableBlock.headers.map((_, i) => {
              if (i === tableBlock.headers.length - 1) return null; // 最後一欄不需要調整線

              const leftPercent = columnWidths.slice(0, i + 1).reduce((sum, w) => sum + (w || 25), 0);

              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-1 cursor-col-resize pointer-events-auto group hover:bg-blue-300 transition-colors"
                  style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => handleColumnResizeStart(e, i)}
                  title={`調整第 ${i + 1} 欄寬度`}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-6 bg-blue-500 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-0.5 h-4 bg-white rounded"></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <table
          className="w-full h-full text-xs relative"
          style={{
            borderCollapse: "collapse",
            border: tableBlock.showBorders !== false ? "1px solid #d1d5db" : "none"
          }}
        >
          <thead>
            <tr>
              {tableBlock.headers.map((header, i) => (
                <th
                  key={i}
                  className={`${tableBlock.showBorders !== false ? "border border-gray-300" : ""} p-1 relative`}
                  style={{
                    fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                    backgroundColor: tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                    textAlign: tableBlock.headerStyle?.textAlign || "left",
                    width: columnWidths[i] ? `${columnWidths[i]}%` : "auto",
                  }}
                >
                  {previewMode ? (
                    header
                  ) : (
                    <input
                      value={header}
                      onChange={(e) => {
                        const newHeaders = [...tableBlock.headers];
                        newHeaders[i] = e.target.value;
                        onUpdate({ headers: newHeaders });
                      }}
                      className="w-full bg-transparent text-center font-semibold border-none outline-none"
                      placeholder={`欄位 ${i + 1}`}
                    />
                  )}

                  {/* 欄位寬度顯示 */}
                  {!previewMode && (
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 bg-white px-1 rounded border">
                      {columnWidths[i] || 25}%
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
        <tbody>
          {tableBlock.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => {
                if (isCellMerged(rowIndex, colIndex)) {
                  return null; // 被合併的儲存格不渲染
                }

                const span = getCellSpan(rowIndex, colIndex);
                const cellId = `${rowIndex}-${colIndex}`;
                const isSelected = selectedCellId === cellId;

                return (
                  <td
                    key={colIndex}
                    className={`${tableBlock.showBorders !== false ? "border border-gray-300" : ""} p-1 ${
                      isSelected ? 'bg-blue-100' : ''
                    }`}
                    style={{
                      textAlign: tableBlock.cellStyle?.textAlign || "left",
                      padding: tableBlock.cellStyle?.padding || 4,
                      width: columnWidths[colIndex] ? `${columnWidths[colIndex]}%` : "auto",
                    }}
                    rowSpan={span.rowSpan}
                    colSpan={span.colSpan}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!previewMode) {
                        onCellSelect(cellId);
                      }
                    }}
                  >
                    {previewMode ? (
                      cell
                    ) : (
                      <input
                        value={cell}
                        onChange={(e) => {
                          const newRows = [...tableBlock.rows];
                          newRows[rowIndex][colIndex] = e.target.value;
                          onUpdate({ rows: newRows });
                        }}
                        className="w-full bg-transparent text-center border-none outline-none"
                        placeholder="內容"
                        onFocus={() => onCellSelect(cellId)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    );
  }

  return null;
}
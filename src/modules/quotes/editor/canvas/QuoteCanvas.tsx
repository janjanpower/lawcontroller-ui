import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import {
  Type, Table, Plus, Minus, Trash2,
  Eye, EyeOff, Copy, Columns, Rows, Merge, Split, Lock, Unlock
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
            {selectedBlock.type === "table" && (
              <div className="text-xs text-gray-600">
                表格區塊 - 拖拽欄位邊界調整寬度
              </div>
            )}
            {selectedBlock.type === "text" && (
              <div className="text-xs text-gray-600">
                文字區塊 - 使用上方工具列編輯格式
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

                  <BlockRenderer
                    block={block}
                    previewMode={previewMode}
                    selectedCellId={selectedCellId}
                    onUpdate={(patch) => updateBlock(block.id, patch)}
                    onCellSelect={(cellId) => setSelectedCellId(cellId)}
                  />

                  {/* 區塊控制按鈕 */}
                  {!previewMode && selectedBlockId === block.id && (
                    <div className="absolute -top-10 left-0 right-0 flex justify-between items-center bg-white border rounded shadow-sm p-1">
                      {/* 左側：功能控制項 */}
                      <div className="flex gap-1">
                      {/* 鎖定/解鎖按鈕 */}

                      {/* 文字區塊的格式工具 */}
                      {block.type === "text" && (
                        <>
                          {/* 字體大小 */}
                          <input
                            type="number"
                            min="8"
                            max="72"
                            value={(block as TextBlock).fontSize || 14}
                            onChange={(e) => updateBlock(block.id, { fontSize: parseInt(e.target.value) })}
                            className="w-10 px-1 py-0.5 text-xs border rounded"
                            title="字體大小"
                            onClick={(e) => e.stopPropagation()}
                          />

                          {/* 粗體 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBlock(block.id, { bold: !(block as TextBlock).bold });
                            }}
                            className={`p-1 hover:bg-gray-100 rounded font-bold text-xs ${
                              (block as TextBlock).bold ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                            }`}
                            title="粗體"
                          >
                            B
                          </button>

                          {/* 斜體 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBlock(block.id, { italic: !(block as TextBlock).italic });
                            }}
                            className={`p-1 hover:bg-gray-100 rounded italic text-xs ${
                              (block as TextBlock).italic ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                            }`}
                            title="斜體"
                          >
                            I
                          </button>

                          {/* 底線 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBlock(block.id, { underline: !(block as TextBlock).underline });
                            }}
                            className={`p-1 hover:bg-gray-100 rounded underline text-xs ${
                              (block as TextBlock).underline ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                            }`}
                            title="底線"
                          >
                            U
                          </button>

                          {/* 文字對齊 - 改為 icon 按鈕 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentAlign = (block as TextBlock).align || "left";
                              const nextAlign = currentAlign === "left" ? "center" : currentAlign === "center" ? "right" : "left";
                              updateBlock(block.id, { align: nextAlign });
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title={`文字對齊: ${(block as TextBlock).align === "center" ? "置中" : (block as TextBlock).align === "right" ? "靠右" : "靠左"}`}
                          >
                            {(block as TextBlock).align === "center" ? (
                              <span className="text-xs font-bold text-gray-600">⫸</span>
                            ) : (block as TextBlock).align === "right" ? (
                              <span className="text-xs font-bold text-gray-600">⫷</span>
                            ) : (
                              <span className="text-xs font-bold text-gray-600">⫸</span>
                            )}
                          </button>

                          {/* 文字顏色 */}
                          <input
                            type="color"
                            value={(block as TextBlock).color || "#000000"}
                            onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                            className="w-5 h-5 border rounded cursor-pointer"
                            title="文字顏色"
                            onClick={(e) => e.stopPropagation()}
                          />

                          {/* 背景顏色 */}
                          <input
                            type="color"
                            value={(block as TextBlock).backgroundColor || "#ffffff"}
                            onChange={(e) => updateBlock(block.id, { backgroundColor: e.target.value })}
                            className="w-5 h-5 border rounded cursor-pointer"
                            title="背景顏色"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </>
                      )}

                      {/* 表格區塊的操作 */}
                      {block.type === "table" && (
                        <>
                          {/* 顯示邊框切換 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const tableBlock = block as TableBlock;
                              updateBlock(block.id, { showBorders: !tableBlock.showBorders });
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="切換邊框顯示"
                          >
                            <Table className={`w-3 h-3 ${(block as TableBlock).showBorders !== false ? 'text-blue-600' : 'text-gray-400'}`} />
                          </button>

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
                      </div>

                      {/* 右側：通用操作（複製、鎖定、刪除） */}
                      <div className="flex gap-1">
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

                      {/* 鎖定/解鎖按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateBlock(block.id, { locked: !block.locked });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title={block.locked ? "解除鎖定" : "鎖定元素"}
                      >
                        {block.locked ? (
                          <Lock className="w-3 h-3 text-red-600" />
                        ) : (
                          <Unlock className="w-3 h-3 text-gray-600" />
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
  onCellSelect
}: {
  block: CanvasBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string | null) => void;
}) {

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
          padding: "1px",
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
        <TableRenderer
          tableBlock={tableBlock}
          previewMode={previewMode}
          selectedCellId={selectedCellId}
          onUpdate={onUpdate}
          onCellSelect={onCellSelect}
          mergedCells={mergedCells}
          isCellMerged={isCellMerged}
          getCellSpan={getCellSpan}
        />
      </div>
    );
  }

  return null;
}

// 表格渲染器組件
function TableRenderer({
  tableBlock,
  previewMode,
  selectedCellId,
  onUpdate,
  onCellSelect,
  mergedCells,
  isCellMerged,
  getCellSpan
}: {
  tableBlock: TableBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string | null) => void;
  mergedCells: any[];
  isCellMerged: (rowIndex: number, colIndex: number) => boolean;
  getCellSpan: (rowIndex: number, colIndex: number) => { rowSpan: number; colSpan: number };
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [resizing, setResizing] = useState<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  // 處理欄位寬度調整
  const handleMouseDown = (e: React.MouseEvent, colIndex: number) => {
    console.log('handleMouseDown triggered for column', colIndex);
    e.preventDefault();
    e.stopPropagation();

    if (!tableRef.current) return;

    const table = tableRef.current;
    const startX = e.clientX;

    // 取得當前欄寬
    const th = table.querySelector(`th:nth-child(${colIndex + 1})`) as HTMLElement;
    if (!th) return;
    const startWidth = th.offsetWidth;

    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (!table) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);

      // 更新表頭寬度
      const th = table.querySelector(`th:nth-child(${colIndex + 1})`) as HTMLElement;
      if (th) {
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
        th.style.maxWidth = `${newWidth}px`;
      }

      // 更新該欄所有儲存格寬度
      const cells = table.querySelectorAll(`td:nth-child(${colIndex + 1})`);
      cells.forEach((cell) => {
        (cell as HTMLElement).style.width = `${newWidth}px`;
        (cell as HTMLElement).style.minWidth = `${newWidth}px`;
        (cell as HTMLElement).style.maxWidth = `${newWidth}px`;
      });
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  return (
    <table
      ref={tableRef}
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
              className={`${tableBlock.showBorders !== false ? "border border-gray-300" : ""} p-1 relative group bg-gray-50`}
              style={{
                fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                backgroundColor: tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                textAlign: tableBlock.headerStyle?.textAlign || "left",
                minWidth: "60px",
                position: "relative"
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

              {/* 欄位調整控制項 */}
              {!previewMode && i < tableBlock.headers.length - 1 && (
                <div
                  className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors z-10"
                  onMouseDown={(e) => handleMouseDown(e, i)}
                  title="拖拽調整欄寬"
                  style={{
                    transform: 'translateX(50%)',
                    borderRight: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderRight = '1px solid transparent';
                  }}
                />
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
  );
}
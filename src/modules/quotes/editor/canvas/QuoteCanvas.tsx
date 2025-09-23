import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import {
  Type, Table, Plus, Minus, Trash2,
  Eye, EyeOff, Copy, Columns, Rows, Merge, Split, Lock, Unlock,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette,
  Save, Download, Link
} from "lucide-react";
import { apiFetch, getFirmCodeOrThrow } from "../../../../utils/api";
import { renderString } from "../../../../utils/templateEngine";

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
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [caseContext, setCaseContext] = useState<any>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  const gridSize = value.gridSize || 10;

  // 載入模板列表
  const loadTemplates = async () => {
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
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 載入案件變數和上下文
  useEffect(() => {
    if (!caseId) return;

    (async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        
        // 載入變數定義
        const varsRes = await apiFetch(`/api/cases/${caseId}/variables?firm_code=${firmCode}`);
        if (varsRes.ok) {
          const caseVars = await varsRes.json();
          setVars(caseVars);
        }

        // 載入案件上下文數據
        const caseRes = await apiFetch(`/api/cases/${caseId}?firm_code=${firmCode}`);
        if (caseRes.ok) {
          const caseData = await caseRes.json();
          const context = {
            case: {
              client_name: caseData.client_name || '',
              case_number: caseData.case_number || '',
              court: caseData.court || '',
              lawyer_name: caseData.lawyer_name || '',
              case_type: caseData.case_type || '',
              case_reason: caseData.case_reason || '',
            },
            firm: {
              name: localStorage.getItem('law_firm_name') || '',
            },
            sys: {
              now: new Date().toLocaleDateString('zh-TW'),
              year: new Date().getFullYear(),
              month: new Date().getMonth() + 1,
            }
          };
          setCaseContext(context);
        }
      } catch (err) {
        console.error("載入案件資料失敗", err);
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
    const maxZ = Math.max(0, ...value.blocks.map(b => b.z || 0));
    const base = {
      id: nanoid(),
      x: snapToGridHelper(40),
      y: snapToGridHelper(40),
      w: 360,
      z: maxZ + 1,
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
          headers: ["", "", "", ""],
          rows: [["", "", "", ""]],
          showBorders: true,
          h: 120,
          headerStyle: { bold: true, backgroundColor: "#f3f4f6" },
          cellStyle: { padding: 8, textAlign: "left" },
          columnWidths: [25, 25, 25, 25],
          mergedCells: [],
        } as TableBlock;
        break;
      default:
        return;
    }

    onChange({ ...value, blocks: [...value.blocks, block] });
    setSelectedBlockId(block.id);
  };

  // 更新區塊並確保選中的區塊在最前面
  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    const maxZ = Math.max(0, ...value.blocks.map(b => b.z || 0));
    const updatedBlocks = value.blocks.map((b) => {
      if (b.id === id) {
        const updated = { ...b, ...patch } as CanvasBlock;
        // 如果是選中的區塊，確保它在最前面
        if (selectedBlockId === id && !patch.z) {
          updated.z = maxZ + 1;
        }
        return updated;
      }
      return b;
    });

    onChange({ ...value, blocks: updatedBlocks });
  };

  // 選中區塊時將其置於最前
  const selectBlock = (id: string) => {
    const maxZ = Math.max(0, ...value.blocks.map(b => b.z || 0));
    updateBlock(id, { z: maxZ + 1 });
    setSelectedBlockId(id);
    setSelectedCells([]);
    setSelectedCellId(null);
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

    const maxZ = Math.max(0, ...value.blocks.map(b => b.z || 0));
    const newBlock = {
      ...block,
      id: nanoid(),
      x: block.x + 20,
      y: block.y + 20,
      z: maxZ + 1,
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
      setCurrentTemplateId(tpl.id);
      setSelectedBlockId(null);
    }
  };

  // 另存新模板
  const handleSaveAsNewTemplate = async () => {
    const name = prompt("請輸入新模板名稱：", "自訂報價單模板");
    if (!name) return;

    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: `由案件 ${caseId} 建立的自訂模板`,
          content_json: value,
          is_default: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "儲存模板失敗");
        return;
      }

      alert("新模板已儲存！");
      
      // 重新載入模板列表
      await loadTemplates();
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  // 更新當前模板
  const handleUpdateCurrentTemplate = async () => {
    if (!currentTemplateId) {
      // 如果沒有當前模板，直接呼叫另存新模板
      await handleSaveAsNewTemplate();
      return;
    }

    try {
      const firmCode = getFirmCodeOrThrow();
      const currentTemplate = templates.find(t => t.id === currentTemplateId);
      
      if (!currentTemplate) {
        alert("找不到當前模板");
        return;
      }

      if (!confirm(`確定要更新模板「${currentTemplate.name}」嗎？`)) {
        return;
      }

      const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${firmCode}`, {
        method: "PUT",
        body: JSON.stringify({
          name: currentTemplate.name,
          description: currentTemplate.description,
          content_json: value,
          is_default: currentTemplate.is_default,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "更新模板失敗");
        return;
      }

      alert("模板已更新！");
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  // 移除當前模板
  const handleRemoveCurrentTemplate = async () => {
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
      await loadTemplates();

      // 清空當前模板並使用預設模板
      setCurrentTemplateId(null);
      setSchema({ page: A4PX, blocks: [], gridSize: 10, showGrid: true });

    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
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

    const newHeaders = [...block.headers, ""];
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

  // 合併選中的儲存格
  const mergeSelectedCells = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table" || selectedCells.length < 2) return;

    const cells = selectedCells.map(cellId => {
      const [row, col] = cellId.split('-').map(Number);
      return { row, col };
    });

    const minRow = Math.min(...cells.map(c => c.row));
    const maxRow = Math.max(...cells.map(c => c.row));
    const minCol = Math.min(...cells.map(c => c.col));
    const maxCol = Math.max(...cells.map(c => c.col));

    const newMerge = {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol
    };

    const mergedCells = block.mergedCells || [];
    updateBlock(blockId, { mergedCells: [...mergedCells, newMerge] });
    setSelectedCells([]);
  };

  // 重置儲存格合併
  const resetCellMerges = (blockId: string) => {
    updateBlock(blockId, { mergedCells: [] });
    setSelectedCells([]);
  };

  // 檢查兩個表格是否相鄰
  const findAdjacentTable = (currentBlock: TableBlock) => {
    const threshold = 20; // 相鄰判斷閾值

    return value.blocks.find(block => {
      if (block.id === currentBlock.id || block.type !== "table") return false;
      
      const otherTable = block as TableBlock;
      
      // 檢查垂直相鄰（上下相連）
      const isVerticallyAdjacent = 
        Math.abs((currentBlock.y + (currentBlock.h || 0)) - otherTable.y) < threshold ||
        Math.abs((otherTable.y + (otherTable.h || 0)) - currentBlock.y) < threshold;
      
      // 檢查水平重疊
      const hasHorizontalOverlap = 
        !(currentBlock.x + currentBlock.w < otherTable.x || 
          otherTable.x + otherTable.w < currentBlock.x);
      
      return isVerticallyAdjacent && hasHorizontalOverlap;
    }) as TableBlock | undefined;
  };

  // 合併兩個相鄰的表格
  const mergeTables = (blockId1: string, blockId2: string) => {
    const block1 = value.blocks.find(b => b.id === blockId1) as TableBlock;
    const block2 = value.blocks.find(b => b.id === blockId2) as TableBlock;
    
    if (!block1 || !block2 || block1.type !== "table" || block2.type !== "table") return;

    // 確定哪個表格在上方
    const upperTable = block1.y < block2.y ? block1 : block2;
    const lowerTable = block1.y < block2.y ? block2 : block1;
    const upperBlockId = block1.y < block2.y ? blockId1 : blockId2;
    const lowerBlockId = block1.y < block2.y ? blockId2 : blockId1;

    // 合併表格內容
    const mergedHeaders = upperTable.headers;
    const mergedRows = [...upperTable.rows, ...lowerTable.rows];
    const newHeight = (upperTable.h || 120) + (lowerTable.h || 120);

    // 更新上方表格
    updateBlock(upperBlockId, {
      headers: mergedHeaders,
      rows: mergedRows,
      h: newHeight
    });

    // 刪除下方表格
    removeBlock(lowerBlockId);
    
    // 選中合併後的表格
    setSelectedBlockId(upperBlockId);
  };

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);
  const adjacentTable = selectedBlock?.type === "table" ? findAdjacentTable(selectedBlock as TableBlock) : null;

  return (
    <div className="flex gap-4 h-full">
      {/* 左側工具面板 */}
      <div className="w-64 bg-gray-50 p-4 rounded-lg overflow-y-auto">
        {/* 套用模板 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">模板選單</h3>
          <select
            value={currentTemplateId || ""}
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) {
                applyTemplate(tpl);
              } else {
                setCurrentTemplateId(null);
              }
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
          >
            <option value="">選擇模板</option>
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
          <h3 className="text-sm font-semibold mb-3 text-gray-700">新增物件</h3>
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
            <h3 className="text-sm font-semibold mb-3 text-gray-700">變數便條</h3>
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
                  <div className="font-mono text-blue-600 bg-blue-100 px-1 rounded">{`{{${v.key}}}`}</div>
                  <div className="text-gray-600">{v.label}</div>
                </button>
              ))}
            </div>
            {!selectedBlockId && (
              <p className="text-xs text-gray-500 mt-2">請先選擇一個區塊來插入變數</p>
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
              setSelectedCells([]);
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
            {value.blocks
              .sort((a, b) => (a.z || 0) - (b.z || 0))
              .map((block) => (
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
                  style={{ zIndex: selectedBlockId === block.id ? 9999 : (block.z || 1) }}
                  className={`group ${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div
                    className={`w-full h-full ${
                      previewMode
                        ? ''
                        : 'border border-dashed border-gray-300 hover:border-gray-400 bg-white'
                    } rounded p-2 cursor-pointer relative`}
                    style={{
                      backgroundColor: previewMode ? 'transparent' : 'white'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!previewMode) {
                        selectBlock(block.id);
                      }
                    }}
                  >
                    <BlockRenderer
                      block={block}
                      previewMode={previewMode}
                      selectedCellId={selectedCellId}
                      selectedCells={selectedCells}
                      caseContext={caseContext}
                      onUpdate={(patch) => updateBlock(block.id, patch)}
                      onCellSelect={(cellId, isMultiSelect) => {
                        if (isMultiSelect) {
                          setSelectedCells(prev => 
                            prev.includes(cellId) 
                              ? prev.filter(id => id !== cellId)
                              : [...prev, cellId]
                          );
                        } else {
                          setSelectedCellId(cellId);
                          setSelectedCells([cellId]);
                        }
                      }}
                    />

                    {/* 區塊控制按鈕 - 固定寬度比例 */}
                    {!previewMode && selectedBlockId === block.id && (
                      <div 
                        className="absolute -top-12 left-0 bg-white border rounded shadow-sm p-1 flex items-center justify-between"
                        style={{ 
                          width: `${Math.max(400, block.w * 0.9)}px`,
                          zIndex: 10000
                        }}
                      >
                        {/* 左側：功能控制項 */}
                        <div className="flex gap-1 flex-1">
                          {/* 文字區塊的格式工具 */}
                          {block.type === "text" && (
                            <>
                              <input
                                type="number"
                                min="8"
                                max="72"
                                value={(block as TextBlock).fontSize || 14}
                                onChange={(e) => updateBlock(block.id, { fontSize: parseInt(e.target.value) })}
                                className="w-12 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-[#334d6d] outline-none"
                                title="字體大小"
                                onClick={(e) => e.stopPropagation()}
                              />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(block.id, { bold: !(block as TextBlock).bold });
                                }}
                                className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                  (block as TextBlock).bold ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                                }`}
                                title="粗體"
                              >
                                <Bold className="w-3 h-3" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(block.id, { italic: !(block as TextBlock).italic });
                                }}
                                className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                  (block as TextBlock).italic ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                                }`}
                                title="斜體"
                              >
                                <Italic className="w-3 h-3" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(block.id, { underline: !(block as TextBlock).underline });
                                }}
                                className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                  (block as TextBlock).underline ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                                }`}
                                title="底線"
                              >
                                <Underline className="w-3 h-3" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentAlign = (block as TextBlock).align || "left";
                                  const nextAlign = currentAlign === "left" ? "center" : currentAlign === "center" ? "right" : "left";
                                  updateBlock(block.id, { align: nextAlign });
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600"
                                title={`對齊方式: ${(block as TextBlock).align === "center" ? "置中" : (block as TextBlock).align === "right" ? "靠右" : "靠左"}`}
                              >
                                {(block as TextBlock).align === "center" ? (
                                  <AlignCenter className="w-3 h-3" />
                                ) : (block as TextBlock).align === "right" ? (
                                  <AlignRight className="w-3 h-3" />
                                ) : (
                                  <AlignLeft className="w-3 h-3" />
                                )}
                              </button>

                              <div className="relative">
                                <button
                                  className="p-1 hover:bg-gray-100 rounded transition-colors relative"
                                  title="文字顏色"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Palette className="w-3 h-3 text-gray-600" />
                                  <input
                                    type="color"
                                    value={(block as TextBlock).color || "#000000"}
                                    onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </button>
                              </div>
                            </>
                          )}

                          {/* 表格區塊的操作 */}
                          {block.type === "table" && (
                            <>
                              {/* 文字格式工具（左側） */}
                              <input
                                type="number"
                                min="8"
                                max="72"
                                value={14}
                                onChange={(e) => {
                                  const tableBlock = block as TableBlock;
                                  updateBlock(block.id, {
                                    cellStyle: {
                                      ...tableBlock.cellStyle,
                                      fontSize: parseInt(e.target.value)
                                    }
                                  });
                                }}
                                className="w-12 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-[#334d6d] outline-none"
                                title="字體大小"
                                onClick={(e) => e.stopPropagation()}
                              />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const tableBlock = block as TableBlock;
                                  updateBlock(block.id, {
                                    headerStyle: {
                                      ...tableBlock.headerStyle,
                                      bold: !tableBlock.headerStyle?.bold
                                    }
                                  });
                                }}
                                className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                  (block as TableBlock).headerStyle?.bold ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                                }`}
                                title="粗體"
                              >
                                <Bold className="w-3 h-3" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const tableBlock = block as TableBlock;
                                  const currentAlign = tableBlock.cellStyle?.textAlign || "left";
                                  const nextAlign = currentAlign === "left" ? "center" : currentAlign === "center" ? "right" : "left";
                                  updateBlock(block.id, {
                                    cellStyle: {
                                      ...tableBlock.cellStyle,
                                      textAlign: nextAlign
                                    }
                                  });
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-600"
                                title={`對齊方式: ${(block as TableBlock).cellStyle?.textAlign === "center" ? "置中" : (block as TableBlock).cellStyle?.textAlign === "right" ? "靠右" : "靠左"}`}
                              >
                                {(block as TableBlock).cellStyle?.textAlign === "center" ? (
                                  <AlignCenter className="w-3 h-3" />
                                ) : (block as TableBlock).cellStyle?.textAlign === "right" ? (
                                  <AlignRight className="w-3 h-3" />
                                ) : (
                                  <AlignLeft className="w-3 h-3" />
                                )}
                              </button>

                              {/* 分隔線 */}
                              <div className="w-px h-6 bg-gray-300 mx-1"></div>

                              {/* 表格操作工具（右側） */}
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
                                <Plus className="w-3 h-3 text-green-600" />
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

                              {/* 合併儲存格工具 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  mergeSelectedCells(block.id);
                                }}
                                disabled={selectedCells.length < 2}
                                className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                  selectedCells.length >= 2 ? 'text-purple-600' : 'text-gray-400'
                                }`}
                                title={`合併選中儲存格 (${selectedCells.length})`}
                              >
                                <Merge className="w-3 h-3" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetCellMerges(block.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="重置所有合併"
                              >
                                <Split className="w-3 h-3 text-orange-600" />
                              </button>

                              {/* 表格合併工具 */}
                              {adjacentTable && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    mergeTables(block.id, adjacentTable.id);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  title="合併相鄰表格"
                                >
                                  <Link className="w-3 h-3 text-green-600" />
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* 右側：通用操作 */}
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
  selectedCells,
  caseContext,
  onUpdate,
  onCellSelect
}: {
  block: CanvasBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  selectedCells: string[];
  caseContext: any;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string, isMultiSelect?: boolean) => void;
}) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;

    if (previewMode) {
      // 在預覽模式下渲染變數
      const renderedText = renderString(textBlock.text, caseContext);
      
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
            whiteSpace: "pre-wrap",
          }}
        >
          {renderedText}
        </div>
      );
    }

    return (
      <VariableAwareTextarea
        value={textBlock.text}
        onChange={(text) => onUpdate({ text })}
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
    const mergedCells = tableBlock.mergedCells || [];

    return (
      <div className="relative w-full h-full">
        <TableRenderer
          tableBlock={tableBlock}
          previewMode={previewMode}
          selectedCellId={selectedCellId}
          selectedCells={selectedCells}
          caseContext={caseContext}
          onUpdate={onUpdate}
          onCellSelect={onCellSelect}
          mergedCells={mergedCells}
        />
      </div>
    );
  }

  return null;
}

// 變數感知的文字輸入框
function VariableAwareTextarea({
  value,
  onChange,
  style,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 處理變數標籤的刪除
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      if (start === end) {
        // 檢查是否在變數標籤內
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(start);
        
        // 查找最近的變數標籤
        const varMatch = beforeCursor.match(/\{\{[^}]*$/);
        if (varMatch) {
          const varStart = start - varMatch[0].length;
          const varEndMatch = afterCursor.match(/^[^}]*\}\}/);
          if (varEndMatch) {
            const varEnd = start + varEndMatch[0].length;
            e.preventDefault();
            
            // 刪除整個變數標籤
            const newValue = value.substring(0, varStart) + value.substring(varEnd);
            onChange(newValue);
            
            // 設置游標位置
            setTimeout(() => {
              textarea.setSelectionRange(varStart, varStart);
            }, 0);
            return;
          }
        }
      }
    }
  };

  // 渲染帶有變數標籤高亮的文字
  const renderHighlightedText = () => {
    const parts = value.split(/(\{\{[^}]*\}\})/);
    return parts.map((part, index) => {
      if (part.match(/^\{\{.*\}\}$/)) {
        return (
          <span
            key={index}
            className="bg-blue-100 border border-blue-300 rounded px-1 mx-0.5"
            style={{ backgroundColor: '#dbeafe', borderColor: '#93c5fd' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative w-full h-full">
      {/* 背景顯示高亮的變數標籤 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          ...style,
          color: 'transparent',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {renderHighlightedText()}
      </div>
      
      {/* 實際的輸入框 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          ...style,
          backgroundColor: 'transparent',
          position: 'relative',
          zIndex: 2,
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

// 表格渲染器組件
function TableRenderer({
  tableBlock,
  previewMode,
  selectedCellId,
  selectedCells,
  caseContext,
  onUpdate,
  onCellSelect,
  mergedCells
}: {
  tableBlock: TableBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  selectedCells: string[];
  caseContext: any;
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string, isMultiSelect?: boolean) => void;
  mergedCells: any[];
}) {
  const tableRef = useRef<HTMLTableElement>(null);

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

  // 處理欄位寬度調整
  const handleMouseDown = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tableRef.current) return;

    const table = tableRef.current;
    const startX = e.clientX;
    const th = table.querySelector(`th:nth-child(${colIndex + 1})`) as HTMLElement;
    if (!th) return;
    const startWidth = th.offsetWidth;

    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      if (!table) return;

      const deltaX = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);

      const th = table.querySelector(`th:nth-child(${colIndex + 1})`) as HTMLElement;
      if (th) {
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
        th.style.maxWidth = `${newWidth}px`;
      }

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
              className={`${tableBlock.showBorders !== false ? "border border-gray-300" : ""} p-1 relative group`}
              style={{
                fontWeight: tableBlock.headerStyle?.bold ? "bold" : "normal",
                backgroundColor: tableBlock.headerStyle?.backgroundColor || "#f3f4f6",
                textAlign: tableBlock.headerStyle?.textAlign || "left",
                minWidth: "60px",
                position: "relative"
              }}
            >
              {previewMode ? (
                renderString(header, caseContext)
              ) : (
                <VariableAwareInput
                  value={header}
                  onChange={(newValue) => {
                    const newHeaders = [...tableBlock.headers];
                    newHeaders[i] = newValue;
                    onUpdate({ headers: newHeaders });
                  }}
                  className="w-full bg-transparent text-center font-semibold border-none outline-none"
                  placeholder={`欄位 ${i + 1}`}
                />
              )}

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
                return null;
              }

              const span = getCellSpan(rowIndex, colIndex);
              const cellId = `${rowIndex}-${colIndex}`;
              const isSelected = selectedCells.includes(cellId);

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
                      const isMultiSelect = e.ctrlKey || e.metaKey;
                      onCellSelect(cellId, isMultiSelect);
                    }
                  }}
                >
                  {previewMode ? (
                    renderString(cell, caseContext)
                  ) : (
                    <VariableAwareInput
                      value={cell}
                      onChange={(newValue) => {
                        const newRows = [...tableBlock.rows];
                        newRows[rowIndex][colIndex] = newValue;
                        onUpdate({ rows: newRows });
                      }}
                      className="w-full bg-transparent text-center border-none outline-none"
                      placeholder=""
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

// 變數感知的輸入框
function VariableAwareInput({
  value,
  onChange,
  className,
  placeholder,
  onFocus
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const input = inputRef.current;
    if (!input) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      
      if (start === end) {
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(start);
        
        const varMatch = beforeCursor.match(/\{\{[^}]*$/);
        if (varMatch) {
          const varStart = start - varMatch[0].length;
          const varEndMatch = afterCursor.match(/^[^}]*\}\}/);
          if (varEndMatch) {
            const varEnd = start + varEndMatch[0].length;
            e.preventDefault();
            
            const newValue = value.substring(0, varStart) + value.substring(varEnd);
            onChange(newValue);
            
            setTimeout(() => {
              input.setSelectionRange(varStart, varStart);
            }, 0);
            return;
          }
        }
      }
    }
  };

  // 渲染帶有變數標籤高亮的文字
  const renderHighlightedText = () => {
    const parts = value.split(/(\{\{[^}]*\}\})/);
    return parts.map((part, index) => {
      if (part.match(/^\{\{.*\}\}$/)) {
        return (
          <span
            key={index}
            className="bg-blue-100 border border-blue-300 rounded px-1 mx-0.5"
            style={{ backgroundColor: '#dbeafe', borderColor: '#93c5fd' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative w-full h-full">
      {/* 背景顯示高亮的變數標籤 */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center"
        style={{
          color: 'transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          zIndex: 1,
          fontSize: 'inherit',
          fontFamily: 'inherit',
          padding: '2px 4px',
        }}
      >
        {renderHighlightedText()}
      </div>
      
      {/* 實際的輸入框 */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        className={className}
        placeholder={placeholder}
        style={{
          backgroundColor: 'transparent',
          position: 'relative',
          zIndex: 2,
        }}
      />
    </div>
  );
}
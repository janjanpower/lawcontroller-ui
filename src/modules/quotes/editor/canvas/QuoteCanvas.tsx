import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import {
  Type, Table, Plus, Minus, Trash2,
  Eye, EyeOff, Copy, Columns, Rows, Merge, Split, Lock, Unlock,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette
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

// 變數標籤組件
const VariableTag: React.FC<{
  varKey: string;
  value?: string;
  color?: string;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  previewMode?: boolean;
}> = ({ varKey, value, color = "#3b82f6", onColorChange, onDelete, previewMode }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (previewMode && value !== undefined) {
    return <span style={{ color }}>{value}</span>;
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono cursor-pointer select-none"
      style={{ backgroundColor: color + "20", color, border: `1px solid ${color}` }}
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <span>{`{{${varKey}}}`}</span>
      {!previewMode && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="w-3 h-3 rounded-full border border-white"
            style={{ backgroundColor: color }}
            title="選擇顏色"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="text-red-500 hover:text-red-700"
            title="刪除標籤"
          >
            ×
          </button>
          {showColorPicker && (
            <div className="absolute z-50 mt-2">
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange?.(e.target.value)}
                className="w-8 h-8"
              />
            </div>
          )}
        </>
      )}
    </span>
  );
};

// 富文本編輯器組件
const RichTextEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  vars: VariableDef[];
  previewMode?: boolean;
  style?: React.CSSProperties;
}> = ({ value, onChange, vars, previewMode, style }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [variableTags, setVariableTags] = useState<Record<string, { color: string; value?: string }>>({});

  // 解析文本中的變數標籤
  const parseContent = useCallback(() => {
    if (!editorRef.current || previewMode) return;

    const content = editorRef.current.innerHTML;
    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match;
    const foundVars: Record<string, { color: string; value?: string }> = {};

    while ((match = variableRegex.exec(content)) !== null) {
      const varKey = match[1];
      const varDef = vars.find(v => v.key === varKey);
      foundVars[varKey] = {
        color: variableTags[varKey]?.color || "#3b82f6",
        value: varDef?.value
      };
    }

    setVariableTags(foundVars);
  }, [vars, variableTags, previewMode]);

  // 渲染內容（預覽模式或編輯模式）
  const renderContent = useCallback(() => {
    if (previewMode) {
      // 預覽模式：替換變數為實際值
      let content = value;
      Object.entries(variableTags).forEach(([varKey, { value: varValue }]) => {
        if (varValue !== undefined) {
          content = content.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), varValue);
        }
      });
      return content;
    }

    // 編輯模式：顯示變數標籤
    return value.replace(/\{\{([^}]+)\}\}/g, (match, varKey) => {
      const tag = variableTags[varKey] || { color: "#3b82f6" };
      return `<span class="variable-tag" data-var="${varKey}" style="background-color: ${tag.color}20; color: ${tag.color}; border: 1px solid ${tag.color}; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; cursor: pointer; user-select: none;">${match}</span>`;
    });
  }, [value, variableTags, previewMode]);

  const insertVariable = (varKey: string) => {
    if (!editorRef.current || previewMode) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const varTag = `{{${varKey}}}`;
      
      const textNode = document.createTextNode(varTag);
      range.deleteContents();
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      // 更新內容
      onChange(editorRef.current.innerText);
      parseContent();
    }
  };

  useEffect(() => {
    parseContent();
  }, [parseContent]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable={!previewMode}
        suppressContentEditableWarning={true}
        onInput={() => {
          if (editorRef.current && !previewMode) {
            onChange(editorRef.current.innerText);
          }
        }}
        onBlur={parseContent}
        style={style}
        className={`w-full h-full p-2 border-none outline-none ${previewMode ? '' : 'min-h-[40px]'}`}
        dangerouslySetInnerHTML={{ __html: renderContent() }}
      />
      
      {/* 變數插入按鈕 */}
      {!previewMode && vars.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-2">
          <div className="flex flex-wrap gap-1">
            {vars.slice(0, 6).map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                title={`插入 {{${v.key}}}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
          fontFamily: "Noto Sans TC",
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
          cellStyle: { padding: 8, textAlign: "left", fontFamily: "Noto Sans TC", fontSize: 12 },
          columnWidths: [25, 15, 25, 25],
          mergedCells: [],
          hasFixedHeader: false, // 新增：不固定標題行
        } as TableBlock;
        break;
      default:
        return;
    }

    onChange({ ...value, blocks: [...value.blocks, block] });
    setSelectedBlockId(block.id);
  };

  // 更新區塊並置頂
  const updateBlock = (id: string, patch: Partial<CanvasBlock>) => {
    const updatedBlocks = value.blocks.map((b) => {
      if (b.id === id) {
        const updated = { ...b, ...patch } as CanvasBlock;
        // 如果是當前選中的區塊，將其 z-index 設為最高
        if (selectedBlockId === id) {
          updated.z = Math.max(...value.blocks.map(block => block.z || 0)) + 1;
        }
        return updated;
      }
      return b;
    });

    onChange({ ...value, blocks: updatedBlocks });
  };

  // 選中區塊時置頂
  const selectBlock = (id: string) => {
    setSelectedBlockId(id);
    setSelectedCellId(null);
    setSelectedCells([]);
    
    // 將選中的區塊置頂
    const maxZ = Math.max(...value.blocks.map(block => block.z || 0));
    updateBlock(id, { z: maxZ + 1 });
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
      setCurrentTemplateId(tpl.id);
      setSelectedBlockId(null);
    }
  };

  // 儲存模板（更新或新建）
  const handleSaveTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      
      if (currentTemplateId) {
        // 更新現有模板
        const currentTemplate = templates.find(t => t.id === currentTemplateId);
        if (currentTemplate) {
          const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${firmCode}`, {
            method: "PUT",
            body: JSON.stringify({
              name: currentTemplate.name,
              description: currentTemplate.description,
              content_json: value,
              is_default: currentTemplate.is_default
            }),
          });

          if (res.ok) {
            alert("模板已更新！");
            // 重新載入模板列表
            const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
            if (reload.ok) {
              const data = await reload.json();
              setTemplates(data || []);
            }
          } else {
            const err = await res.json();
            alert(err?.detail || "更新模板失敗");
          }
        }
      } else {
        // 創建新模板
        const name = prompt("請輸入模板名稱：", "自訂報價單模板");
        if (!name) return;

        const res = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`, {
          method: "POST",
          body: JSON.stringify({
            name,
            description: `由案件 ${caseId} 建立的自訂模板`,
            content_json: value,
            is_default: false,
          }),
        });

        if (res.ok) {
          const newTemplate = await res.json();
          setCurrentTemplateId(newTemplate.id);
          alert("模板已儲存！");
          
          // 重新載入模板列表
          const reload = await apiFetch(`/api/quote-templates?firm_code=${firmCode}`);
          if (reload.ok) {
            const data = await reload.json();
            setTemplates(data || []);
          }
        } else {
          const err = await res.json();
          alert(err?.detail || "儲存模板失敗");
        }
      }
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

  // 合併儲存格功能
  const mergeCells = (blockId: string) => {
    if (selectedCells.length < 2) {
      alert("請選擇至少兩個儲存格進行合併");
      return;
    }

    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

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

    const mergedCells = [...(block.mergedCells || []), newMerge];
    updateBlock(blockId, { mergedCells });
    setSelectedCells([]);
  };

  // 拆除合併
  const unmergeCells = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const mergedCells = (block.mergedCells || []).filter(merge => {
      return !selectedCells.some(cellId => {
        const [row, col] = cellId.split('-').map(Number);
        return row >= merge.startRow && row <= merge.endRow &&
               col >= merge.startCol && col <= merge.endCol;
      });
    });

    updateBlock(blockId, { mergedCells });
    setSelectedCells([]);
  };

  // 檢查儲存格是否被合併
  const isCellMerged = (blockId: string, rowIndex: number, colIndex: number) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return false;

    const mergedCells = block.mergedCells || [];
    return mergedCells.some(merge =>
      rowIndex >= merge.startRow && rowIndex <= merge.endRow &&
      colIndex >= merge.startCol && colIndex <= merge.endCol &&
      !(rowIndex === merge.startRow && colIndex === merge.startCol)
    );
  };

  // 取得合併儲存格的 span
  const getCellSpan = (blockId: string, rowIndex: number, colIndex: number) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return { rowSpan: 1, colSpan: 1 };

    const mergedCells = block.mergedCells || [];
    const merge = mergedCells.find(m =>
      m.startRow === rowIndex && m.startCol === colIndex
    );
    return merge ? {
      rowSpan: merge.endRow - merge.startRow + 1,
      colSpan: merge.endCol - merge.startCol + 1
    } : { rowSpan: 1, colSpan: 1 };
  };

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);

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
                  <div className="font-mono text-blue-600">{`{{${v.key}}}`}</div>
                  <div className="text-gray-600">{v.label}</div>
                </button>
              ))}
            </div>
            {!selectedBlockId && (
              <p className="text-xs text-gray-500 mt-2">請先選擇一個區塊來插入變數</p>
            )}
          </div>
        )}

        {/* 合併儲存格控制 */}
        {selectedBlock?.type === "table" && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">儲存格操作</h3>
            <div className="space-y-2">
              <button
                onClick={() => mergeCells(selectedBlockId!)}
                disabled={selectedCells.length < 2}
                className="w-full px-3 py-2 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-md text-sm transition-colors"
              >
                合併選中儲存格 ({selectedCells.length})
              </button>
              <button
                onClick={() => unmergeCells(selectedBlockId!)}
                disabled={selectedCells.length === 0}
                className="w-full px-3 py-2 bg-orange-100 hover:bg-orange-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-md text-sm transition-colors"
              >
                拆除合併
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              按住 Ctrl/Cmd 點擊多個儲存格進行選擇
            </p>
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
              .sort((a, b) => (a.z || 0) - (b.z || 0)) // 按 z-index 排序
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
                style={{ zIndex: block.z || 1 }}
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
                    vars={vars}
                    onUpdate={(patch) => updateBlock(block.id, patch)}
                    onCellSelect={(cellId, isMultiSelect) => {
                      if (isMultiSelect && selectedCells.includes(cellId)) {
                        setSelectedCells(prev => prev.filter(id => id !== cellId));
                      } else if (isMultiSelect) {
                        setSelectedCells(prev => [...prev, cellId]);
                      } else {
                        setSelectedCellId(cellId);
                        setSelectedCells([cellId]);
                      }
                    }}
                    isCellMerged={(row, col) => isCellMerged(block.id, row, col)}
                    getCellSpan={(row, col) => getCellSpan(block.id, row, col)}
                  />

                  {/* 區塊控制按鈕 - 固定寬度比例 */}
                  {!previewMode && selectedBlockId === block.id && (
                    <div 
                      className="absolute bg-white border rounded shadow-sm p-1 flex justify-between items-center"
                      style={{
                        top: -40,
                        left: 0,
                        right: 0,
                        height: 32,
                        zIndex: 1000
                      }}
                    >
                      {/* 左側：功能控制項 (70%) */}
                      <div className="flex gap-1 flex-1 overflow-x-auto">
                        {/* 通用文字工具 */}
                        {(block.type === "text" || block.type === "table") && (
                          <>
                            {/* 字體選擇 */}
                            <select
                              value={(block as any).fontFamily || "Noto Sans TC"}
                              onChange={(e) => updateBlock(block.id, { fontFamily: e.target.value })}
                              className="text-xs border rounded px-1 py-0.5 focus:ring-1 focus:ring-[#334d6d] outline-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="Noto Sans TC">思源黑體</option>
                              <option value="Microsoft JhengHei">微軟正黑體</option>
                              <option value="Arial">Arial</option>
                              <option value="Times New Roman">Times New Roman</option>
                              <option value="Courier New">Courier New</option>
                            </select>

                            {/* 字體大小 */}
                            <input
                              type="number"
                              min="8"
                              max="72"
                              value={(block as any).fontSize || 14}
                              onChange={(e) => updateBlock(block.id, { fontSize: parseInt(e.target.value) })}
                              className="w-12 px-1 py-0.5 text-xs border rounded focus:ring-1 focus:ring-[#334d6d] outline-none"
                              title="字體大小"
                              onClick={(e) => e.stopPropagation()}
                            />

                            {/* 粗體 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlock(block.id, { bold: !(block as any).bold });
                              }}
                              className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                (block as any).bold ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                              }`}
                              title="粗體"
                            >
                              <Bold className="w-3 h-3" />
                            </button>

                            {/* 斜體 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlock(block.id, { italic: !(block as any).italic });
                              }}
                              className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                (block as any).italic ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                              }`}
                              title="斜體"
                            >
                              <Italic className="w-3 h-3" />
                            </button>

                            {/* 底線 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlock(block.id, { underline: !(block as any).underline });
                              }}
                              className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                (block as any).underline ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                              }`}
                              title="底線"
                            >
                              <Underline className="w-3 h-3" />
                            </button>

                            {/* 文字對齊 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentAlign = (block as any).align || "left";
                                const nextAlign = currentAlign === "left" ? "center" : currentAlign === "center" ? "right" : "left";
                                updateBlock(block.id, { align: nextAlign });
                              }}
                              className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                                (block as any).align ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                              }`}
                              title={`對齊方式: ${(block as any).align === "center" ? "置中" : (block as any).align === "right" ? "靠右" : "靠左"}`}
                            >
                              {(block as any).align === "center" ? (
                                <AlignCenter className="w-3 h-3" />
                              ) : (block as any).align === "right" ? (
                                <AlignRight className="w-3 h-3" />
                              ) : (
                                <AlignLeft className="w-3 h-3" />
                              )}
                            </button>

                            {/* 顏色選擇器 */}
                            <div className="relative">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors relative"
                                title="文字顏色"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Palette className="w-3 h-3 text-gray-600" />
                                <input
                                  type="color"
                                  value={(block as any).color || "#000000"}
                                  onChange={(e) => updateBlock(block.id, { color: e.target.value })}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </button>
                            </div>

                            {/* 背景顏色 */}
                            <div className="relative">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors relative"
                                title="背景顏色"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  className="w-3 h-3 border border-gray-300 rounded-sm"
                                  style={{ backgroundColor: (block as any).backgroundColor || "#ffffff" }}
                                />
                                <input
                                  type="color"
                                  value={(block as any).backgroundColor || "#ffffff"}
                                  onChange={(e) => updateBlock(block.id, { backgroundColor: e.target.value })}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </button>
                            </div>
                          </>
                        )}

                        {/* 表格專用工具 */}
                        {block.type === "table" && (
                          <>
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                mergeCells(block.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="合併選中儲存格"
                              disabled={selectedCells.length < 2}
                            >
                              <Merge className="w-3 h-3 text-purple-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                unmergeCells(block.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="拆除合併"
                              disabled={selectedCells.length === 0}
                            >
                              <Split className="w-3 h-3 text-orange-600" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* 右側：通用操作 (30%) */}
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
  vars,
  onUpdate,
  onCellSelect,
  isCellMerged,
  getCellSpan
}: {
  block: CanvasBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  selectedCells: string[];
  vars: VariableDef[];
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string, isMultiSelect?: boolean) => void;
  isCellMerged: (rowIndex: number, colIndex: number) => boolean;
  getCellSpan: (rowIndex: number, colIndex: number) => { rowSpan: number; colSpan: number };
}) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;

    return (
      <RichTextEditor
        value={textBlock.text}
        onChange={(text) => onUpdate({ text })}
        vars={vars}
        previewMode={previewMode}
        style={{
          fontSize: textBlock.fontSize || 14,
          fontWeight: textBlock.bold ? "bold" : "normal",
          fontStyle: textBlock.italic ? "italic" : "normal",
          textDecoration: textBlock.underline ? "underline" : "none",
          textAlign: textBlock.align || "left",
          color: textBlock.color || "#000000",
          backgroundColor: textBlock.backgroundColor || "transparent",
          fontFamily: textBlock.fontFamily || "Noto Sans TC",
        }}
      />
    );
  }

  if (block.type === "table") {
    const tableBlock = block as TableBlock;

    return (
      <div className="relative w-full h-full overflow-auto">
        <table
          className="w-full h-full text-xs relative"
          style={{
            borderCollapse: "collapse",
            border: tableBlock.showBorders !== false ? "1px solid #d1d5db" : "none",
            fontFamily: (tableBlock.cellStyle as any)?.fontFamily || "Noto Sans TC",
            fontSize: (tableBlock.cellStyle as any)?.fontSize || 12,
          }}
        >
          <tbody>
            {/* 將標題行作為普通行處理 */}
            {[tableBlock.headers, ...tableBlock.rows].map((row, rowIndex) => (
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
                        isSelected ? 'bg-blue-100' : rowIndex === 0 ? 'bg-gray-50' : ''
                      }`}
                      style={{
                        textAlign: (tableBlock.cellStyle as any)?.textAlign || "left",
                        padding: tableBlock.cellStyle?.padding || 4,
                        fontWeight: rowIndex === 0 && tableBlock.headerStyle?.bold ? "bold" : "normal",
                        backgroundColor: isSelected ? '#dbeafe' : 
                                       rowIndex === 0 ? (tableBlock.headerStyle?.backgroundColor || "#f3f4f6") : 
                                       'transparent',
                        fontFamily: (tableBlock.cellStyle as any)?.fontFamily || "Noto Sans TC",
                        fontSize: (tableBlock.cellStyle as any)?.fontSize || 12,
                        color: (tableBlock.cellStyle as any)?.color || "#000000",
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
                        // 預覽模式：替換變數
                        <div
                          dangerouslySetInnerHTML={{
                            __html: cell.replace(/\{\{([^}]+)\}\}/g, (match: string, varKey: string) => {
                              const varDef = vars.find(v => v.key === varKey);
                              return varDef?.value || match;
                            })
                          }}
                        />
                      ) : (
                        <RichTextEditor
                          value={cell}
                          onChange={(newValue) => {
                            const newRows = rowIndex === 0 ? 
                              [row.map((c, i) => i === colIndex ? newValue : c), ...tableBlock.rows] :
                              tableBlock.rows.map((r, i) => 
                                i === rowIndex - 1 ? r.map((c, j) => j === colIndex ? newValue : c) : r
                              );
                            
                            if (rowIndex === 0) {
                              onUpdate({ headers: newRows[0], rows: newRows.slice(1) });
                            } else {
                              onUpdate({ rows: newRows });
                            }
                          }}
                          vars={vars}
                          previewMode={false}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontFamily: (tableBlock.cellStyle as any)?.fontFamily || "Noto Sans TC",
                            fontSize: (tableBlock.cellStyle as any)?.fontSize || 12,
                            color: (tableBlock.cellStyle as any)?.color || "#000000",
                          }}
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
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from "./schema";
import { nanoid } from "nanoid";
import { type VariableDef } from "./variables";
import {
  Type, Table, Plus, Minus, Trash2,
  Eye, EyeOff, Copy, Columns, Rows, Lock, Unlock,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette,
  Move, GripVertical
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

// 變數便條組件
const VariableTag: React.FC<{
  label: string;
  value?: string;
  color?: string;
  previewMode?: boolean;
  onDelete?: () => void;
}> = ({ label, value, color = "#3b82f6", previewMode, onDelete }) => {
  if (previewMode && value !== undefined) {
    return <span style={{ color }}>{value}</span>;
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer select-none bg-blue-100 border border-blue-300 text-blue-800 hover:bg-blue-200 align-baseline"
      contentEditable={false}
      suppressContentEditableWarning={true}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        verticalAlign: 'baseline',
        lineHeight: '1.2',
        display: 'inline-flex',
        alignItems: 'center'
      }}
    >
      <span>{label}</span>
      {!previewMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete?.();
          }}
          className="text-red-500 hover:text-red-700 ml-1 text-xs leading-none"
          title="刪除便條"
        >
          ×
        </button>
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
  showVariablePanel?: boolean;
}> = ({ value, onChange, vars, previewMode, style, showVariablePanel }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // 保存和恢復游標位置
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset
      };
    }
    return null;
  };

  const restoreCursorPosition = (position: any) => {
    if (!position || !editorRef.current) return;

    try {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStart(position.startContainer, position.startOffset);
        range.setEnd(position.endContainer, position.endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (e) {
      // 如果恢復失敗，將游標設到末尾
      const selection = window.getSelection();
      if (selection && editorRef.current) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  // 解析文本並渲染變數便條
  const renderContent = useCallback(() => {
    if (previewMode) {
      // 預覽模式：替換變數為實際值
      let content = value;
      vars.forEach(v => {
        if (v.value !== undefined) {
          const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
          content = content.replace(regex, v.value);
        }
      });
      return content;
    }

    // 編輯模式：返回原始文本，便條會在 DOM 中動態渲染
    return value;
  }, [value, vars, previewMode, onChange]);

  // 將文本中的變數標籤轉換為便條元素
  const renderVariableTags = useCallback(() => {
    if (!editorRef.current || previewMode) return;

    const cursorPos = saveCursorPosition();
    let html = value;

    // 將 {{varKey}} 替換為便條 HTML
    html = html.replace(/\{\{([^}]+)\}\}/g, (match, varKey) => {
      const varDef = vars.find(v => v.key === varKey);
      const label = varDef?.label || varKey;

      return `<span class="variable-tag inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer select-none bg-blue-100 border border-blue-300 text-blue-800 hover:bg-blue-200"
                    data-var="${varKey}"
                    contenteditable="false"
                    style="vertical-align: baseline; line-height: 1.2; display: inline-flex; align-items: center;">
                <span>${label}</span>
                <button class="text-red-500 hover:text-red-700 ml-1 text-xs leading-none" title="刪除便條">×</button>
              </span>`;
    });

    editorRef.current.innerHTML = html;

    // 為便條添加刪除事件
    const tags = editorRef.current.querySelectorAll('.variable-tag');
    tags.forEach(tag => {
      const deleteBtn = tag.querySelector('button');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const varKey = tag.getAttribute('data-var');
          if (varKey) {
            const newValue = value.replace(`{{${varKey}}}`, '');
            onChange(newValue);
          }
        });
      }
    });

    // 恢復游標位置
    if (cursorPos) {
      setTimeout(() => restoreCursorPosition(cursorPos), 0);
    }
  }, [value, vars, previewMode, onChange]);

  // 處理輸入
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (previewMode) return;

    const target = e.currentTarget;
    const cursorPos = saveCursorPosition();
    let newValue = '';

    // 遍歷所有子節點，提取文本和變數標籤
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.classList.contains('variable-tag')) {
          const varKey = element.getAttribute('data-var');
          return varKey ? `{{${varKey}}}` : '';
        } else {
          let result = '';
          node.childNodes.forEach(child => {
            result += processNode(child);
          });
          return result;
        }
      }
      return '';
    };

    target.childNodes.forEach(child => {
      newValue += processNode(child);
    });

    onChange(newValue);

    // 延遲恢復游標位置
    setTimeout(() => {
      if (cursorPos) {
        restoreCursorPosition(cursorPos);
      }
    }, 0);
  };

  // 插入變數
  const insertVariable = (varKey: string) => {
    if (!editorRef.current || previewMode) return;

    const selection = window.getSelection();
    let insertPos = value.length;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';
      const textBeforeInValue = value.indexOf(textBeforeCursor);
      if (textBeforeInValue !== -1) {
        insertPos = textBeforeInValue + textBeforeCursor.length;
      }
    }

    const newValue = value.substring(0, insertPos) + `{{${varKey}}}` + value.substring(insertPos);
    onChange(newValue);
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (previewMode) return;

    // 處理 Backspace：如果選中便條則刪除整個便條
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // 檢查是否選中了便條
        const selectedNode = range.commonAncestorContainer;
        let tagElement: Element | null = null;

        if (selectedNode.nodeType === Node.ELEMENT_NODE) {
          tagElement = selectedNode as Element;
        } else if (selectedNode.parentElement) {
          tagElement = selectedNode.parentElement;
        }

        // 如果選中的是便條或便條內的元素，刪除整個便條
        if (tagElement && (tagElement.classList.contains('variable-tag') || tagElement.closest('.variable-tag'))) {
          e.preventDefault();
          const varTag = tagElement.classList.contains('variable-tag') ? tagElement : tagElement.closest('.variable-tag');
          if (varTag) {
            const varKey = varTag.getAttribute('data-var');
            if (varKey) {
              const newValue = value.replace(`{{${varKey}}}`, '');
              onChange(newValue);
            }
          }
          return;
        }

        // 如果游標緊鄰便條，刪除整個便條
        if (range.collapsed && range.startOffset === 0) {
          const container = range.startContainer;
          const prevSibling = container.previousSibling;
          if (prevSibling && (prevSibling as Element).classList?.contains('variable-tag')) {
            e.preventDefault();
            const varKey = (prevSibling as Element).getAttribute('data-var');
            if (varKey) {
              const newValue = value.replace(`{{${varKey}}}`, '');
              onChange(newValue);
            }
            return;
          }
        }
      }
    }
  };

  // 當值或變數改變時重新渲染便條
  useEffect(() => {
    renderVariableTags();
  }, [renderVariableTags]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable={!previewMode}
        suppressContentEditableWarning={true}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={style}
        className={`w-full h-full p-2 border-none outline-none leading-relaxed ${previewMode ? '' : 'min-h-[40px]'}`}
        dangerouslySetInnerHTML={previewMode ? { __html: renderContent() as string } : undefined}
      />

      {/* 變數插入按鈕 */}
      {!previewMode && showVariablePanel && vars.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-2">
          <div className="flex flex-wrap gap-1">
            {vars.slice(0, 6).map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
                title={`插入 ${v.label}`}
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

// 表格儲存格組件
const TableCell: React.FC<{
  value: string;
  onChange: (value: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  showResizeHandle: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}> = ({
  value,
  onChange,
  isSelected,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  showResizeHandle,
  onResizeStart,
  style
}) => {
  const cellRef = useRef<HTMLDivElement>(null);

  return (
    <td
      className={`border border-gray-300 p-1 relative group hover:bg-gray-50 ${isSelected ? 'bg-blue-100' : ''}`}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onSelect}
    >
      <div
        ref={cellRef}
        contentEditable
        suppressContentEditableWarning={true}
        onInput={(e) => {
          const target = e.currentTarget;
          onChange(target.textContent || '');
        }}
        className="w-full h-full outline-none min-h-[20px] leading-relaxed"
        style={{ wordBreak: 'break-word' }}
        suppressContentEditableWarning={true}
      />

      {/* 欄寬調整手柄 */}
      {showResizeHandle && (
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          onMouseDown={onResizeStart}
          title="拖移調整欄寬"
          style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
        >
          <div className="w-0.5 h-4 bg-blue-500 rounded"></div>
        </div>
      )}
    </td>
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
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [resizingColumn, setResizingColumn] = useState<{ blockId: string; colIndex: number } | null>(null);
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

  // 載入案件變數（包含階段）
  useEffect(() => {
    if (!caseId) return;

    (async () => {
      try {
        setLoading(true);
        const firmCode = getFirmCodeOrThrow();

        // 載入案件資料
        const caseRes = await apiFetch(`/api/cases/${caseId}?firm_code=${firmCode}`);
        if (!caseRes.ok) {
          throw new Error('無法載入案件資料');
        }
        const caseData = await caseRes.json();

        // 載入事務所資料
        const firmRes = await apiFetch(`/api/firms/current?firm_code=${firmCode}`);
        let firmData = {};
        if (firmRes.ok) {
          firmData = await firmRes.json();
        } else {
          // 如果沒有專門的事務所 API，從 localStorage 取得
          firmData = {
            firm_name: localStorage.getItem('law_firm_name') || '',
            firm_code: firmCode,
          };
        }

        // 載入案件階段
        const stagesRes = await apiFetch(`/api/cases/${caseId}/stages?firm_code=${firmCode}`);
        let stageVars: VariableDef[] = [];
        if (stagesRes.ok) {
          const stages = await stagesRes.json();
          stageVars = stages.map((stage: any) => ({
            key: `stage.${stage.stage_name}`,
            label: `階段：${stage.stage_name}`,
            value: stage.stage_date || stage.stage_name
          }));
        }

        // 組合所有變數
        const today = new Date();
        const allVars: VariableDef[] = [
          // 案件相關變數
          { key: "case.client_name", label: "客戶姓名", value: caseData.client_name || '' },
          { key: "case.case_number", label: "案件編號", value: caseData.case_number || '' },
          { key: "case.case_type", label: "案件類型", value: caseData.case_type || '' },
          { key: "case.case_reason", label: "案由", value: caseData.case_reason || '' },
          { key: "case.court", label: "法院", value: caseData.court || '' },
          { key: "case.division", label: "股別", value: caseData.division || '' },
          { key: "case.lawyer_name", label: "律師姓名", value: caseData.lawyer_name || '' },
          { key: "case.legal_affairs_name", label: "法務姓名", value: caseData.legal_affairs_name || '' },
          { key: "case.opposing_party", label: "對造", value: caseData.opposing_party || '' },
          { key: "case.progress", label: "目前進度", value: caseData.progress || '' },
          { key: "case.progress_date", label: "進度日期", value: caseData.progress_date || '' },

          // 事務所相關變數
          { key: "firm.name", label: "事務所名稱", value: (firmData as any).firm_name || '' },
          { key: "firm.code", label: "事務所代碼", value: (firmData as any).firm_code || firmCode },

          // 系統變數（移除前導零）
          { key: "sys.now", label: "今天日期", value: today.toISOString().split('T')[0] },
          { key: "sys.day", label: "今天日期", value: String(today.getDate()) }, // 移除前導零
          { key: "sys.year", label: "今年年份", value: String(today.getFullYear()) },
          { key: "sys.month", label: "本月月份", value: String(today.getMonth() + 1) },

          // 階段變數
          ...stageVars
        ];

        setVars(allVars);
      } catch (err) {
        console.error("載入案件變數失敗", err);
        // 設定基本的備用變數
        const today = new Date();
        const fallbackVars: VariableDef[] = [
          { key: "case.client_name", label: "客戶姓名", value: '' },
          { key: "case.case_number", label: "案件編號", value: '' },
          { key: "firm.name", label: "事務所名稱", value: localStorage.getItem('law_firm_name') || '' },
          { key: "sys.now", label: "今天日期", value: today.toISOString().split('T')[0] },
          { key: "sys.day", label: "今天日期", value: String(today.getDate()) },
        ];
        setVars(fallbackVars);
      } finally {
        setLoading(false);
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
          text: "",
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
          headers: ["", "", ""],
          rows: [["", "", ""], ["", "", ""], ["", "", ""]],
          showBorders: true,
          h: 120,
          headerStyle: { bold: false, backgroundColor: "transparent" },
          cellStyle: { padding: 8, textAlign: "left", fontFamily: "Noto Sans TC", fontSize: 12 },
          columnWidths: [33.33, 33.33, 33.34],
          mergedCells: [],
          hasFixedHeader: false,
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
            await loadTemplates();
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
          await loadTemplates();
        } else {
          const err = await res.json();
          alert(err?.detail || "儲存模板失敗");
        }
      }
    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  // 移除模板
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

      const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${firmCode}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err?.detail || "移除模板失敗");
        return;
      }

      alert("模板已移除！");
      await loadTemplates();

      // 清空當前模板並使用預設模板
      setCurrentTemplateId(null);
      onChange({ page: { width: 794, height: 1123, margin: 40 }, blocks: [], gridSize: 10, showGrid: true });

    } catch (e: any) {
      alert("發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  // 表格操作函數
  const addTableRow = (blockId: string) => {
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const colCount = Math.max(block.headers.length, block.rows[0]?.length || 3);
    const newRow = new Array(colCount).fill("");
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
    const currentWidths = block.columnWidths || [];
    const totalWidth = currentWidths.reduce((sum, w) => sum + w, 0);
    const newWidth = Math.max(10, (100 - totalWidth) / (currentWidths.length + 1));
    const newWidths = [...currentWidths, newWidth];

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

  // 處理欄寬調整
  const handleColumnResize = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;

    const { blockId, colIndex } = resizingColumn;
    const block = value.blocks.find(b => b.id === blockId) as TableBlock;
    if (!block || block.type !== "table") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const relativeX = e.clientX - rect.left;
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!blockElement) return;

    const blockRect = blockElement.getBoundingClientRect();
    const tableWidth = blockRect.width;
    const newWidthPercent = Math.max(5, Math.min(80, ((relativeX - blockRect.left) / tableWidth) * 100));

    const newWidths = [...(block.columnWidths || [])];
    newWidths[colIndex] = newWidthPercent;

    updateBlock(blockId, { columnWidths: newWidths });
  }, [resizingColumn, value.blocks, updateBlock]);

  // 監聽滑鼠事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        handleColumnResize(e);
      }
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, handleColumnResize]);

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

        {/* 可用變數便條 */}
        {vars.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">變數便條</h3>
            <p className="text-xs text-gray-500 mb-2">點擊便條插入到選中的內容裡</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {vars.map((v) => (
                <button
                  key={v.key}
                  onClick={() => selectedBlockId && insertVariableToBlock(selectedBlockId, v.key)}
                  disabled={!selectedBlockId}
                  className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center justify-between ${
                    selectedBlockId
                      ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer border border-blue-200'
                      : 'bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-gray-800">{v.label}</span>
                  {selectedBlockId && (
                    <Plus className="w-3 h-3 text-blue-600" />
                  )}
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
        {/* 頂部工具列 */}
        {selectedBlock && (
          <div className="bg-white border-b p-3 flex items-center gap-2 flex-wrap">
            {/* 文字格式工具 */}
            {(selectedBlock.type === "text") && (
              <>
                {/* 字體選擇 */}
                <select
                  value={(selectedBlock as any).fontFamily || "Noto Sans TC"}
                  onChange={(e) => updateBlock(selectedBlock.id, { fontFamily: e.target.value })}
                  className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-[#334d6d] outline-none"
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
                  value={(selectedBlock as any).fontSize || 14}
                  onChange={(e) => updateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#334d6d] outline-none"
                  title="字體大小"
                />

                {/* 粗體 */}
                <button
                  onClick={() => updateBlock(selectedBlock.id, { bold: !(selectedBlock as any).bold })}
                  className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                    (selectedBlock as any).bold ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                  }`}
                  title="粗體"
                >
                  <Bold className="w-4 h-4" />
                </button>

                {/* 斜體 */}
                <button
                  onClick={() => updateBlock(selectedBlock.id, { italic: !(selectedBlock as any).italic })}
                  className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                    (selectedBlock as any).italic ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                  }`}
                  title="斜體"
                >
                  <Italic className="w-4 h-4" />
                </button>

                {/* 底線 */}
                <button
                  onClick={() => updateBlock(selectedBlock.id, { underline: !(selectedBlock as any).underline })}
                  className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                    (selectedBlock as any).underline ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                  }`}
                  title="底線"
                >
                  <Underline className="w-4 h-4" />
                </button>

                {/* 文字對齊 */}
                <button
                  onClick={() => {
                    const currentAlign = (selectedBlock as any).align || "left";
                    const nextAlign = currentAlign === "left" ? "center" : currentAlign === "center" ? "right" : "left";
                    updateBlock(selectedBlock.id, { align: nextAlign });
                  }}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title={`對齊方式: ${(selectedBlock as any).align === "center" ? "置中" : (selectedBlock as any).align === "right" ? "靠右" : "靠左"}`}
                >
                  {(selectedBlock as any).align === "center" ? (
                    <AlignCenter className="w-4 h-4" />
                  ) : (selectedBlock as any).align === "right" ? (
                    <AlignRight className="w-4 h-4" />
                  ) : (
                    <AlignLeft className="w-4 h-4" />
                  )}
                </button>

                {/* 文字顏色 */}
                <div className="relative">
                  <button
                    className="p-1 hover:bg-gray-100 rounded transition-colors relative"
                    title="文字顏色"
                  >
                    <Palette className="w-4 h-4 text-gray-600" />
                    <input
                      type="color"
                      value={(selectedBlock as any).color || "#000000"}
                      onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </button>
                </div>
              </>
            )}

            {/* 表格工具 */}
            {selectedBlock.type === "table" && (
              <>
                <button
                  onClick={() => {
                    const tableBlock = selectedBlock as TableBlock;
                    updateBlock(selectedBlock.id, { showBorders: !tableBlock.showBorders });
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="切換邊框顯示"
                >
                  <Table className={`w-4 h-4 ${(selectedBlock as TableBlock).showBorders !== false ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>

                <button
                  onClick={() => addTableRow(selectedBlock.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="新增列"
                >
                  <Rows className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={() => removeTableRow(selectedBlock.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="刪除列"
                  disabled={(selectedBlock as TableBlock).rows.length <= 1}
                >
                  <Minus className="w-4 h-4 text-red-600" />
                </button>
                <button
                  onClick={() => addTableColumn(selectedBlock.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="新增欄"
                >
                  <Columns className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  onClick={() => removeTableColumn(selectedBlock.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="刪除欄"
                  disabled={(selectedBlock as TableBlock).headers.length <= 1}
                >
                  <Minus className="w-4 h-4 text-orange-600" />
                </button>
              </>
            )}

            {/* 分隔線 */}
            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* 通用操作 */}
            <button
              onClick={() => duplicateBlock(selectedBlock.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="複製區塊"
            >
              <Copy className="w-4 h-4 text-purple-600" />
            </button>

            <button
              onClick={() => updateBlock(selectedBlock.id, { locked: !selectedBlock.locked })}
              className="p-1 hover:bg-gray-100 rounded"
              title={selectedBlock.locked ? "解除鎖定" : "鎖定元素"}
            >
              {selectedBlock.locked ? (
                <Lock className="w-4 h-4 text-red-600" />
              ) : (
                <Unlock className="w-4 h-4 text-gray-600" />
              )}
            </button>

            <button
              onClick={() => removeBlock(selectedBlock.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="刪除區塊"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

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
                style={{ zIndex: block.z || 1 }}
                className={`group ${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div
                  data-block-id={block.id}
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
                    hoveredCellId={hoveredCellId}
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
                    onCellHover={(cellId) => setHoveredCellId(cellId)}
                    onColumnResizeStart={(colIndex) => {
                      setResizingColumn({ blockId: block.id, colIndex });
                    }}
                  />
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
  hoveredCellId,
  vars,
  onUpdate,
  onCellSelect,
  onCellHover,
  onColumnResizeStart
}: {
  block: CanvasBlock;
  previewMode: boolean;
  selectedCellId: string | null;
  selectedCells: string[];
  hoveredCellId: string | null;
  vars: VariableDef[];
  onUpdate: (patch: Partial<CanvasBlock>) => void;
  onCellSelect: (cellId: string, isMultiSelect?: boolean) => void;
  onCellHover: (cellId: string | null) => void;
  onColumnResizeStart: (colIndex: number) => void;
}) {
  if (block.type === "text") {
    const textBlock = block as TextBlock;

    return (
      <RichTextEditor
        value={textBlock.text}
        onChange={(text) => onUpdate({ text })}
        vars={vars}
        previewMode={previewMode}
        showVariablePanel={false}
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
            {tableBlock.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => {
                  const cellId = `${rowIndex}-${colIndex}`;
                  const isSelected = selectedCells.includes(cellId);
                  const isHovered = hoveredCellId === cellId;
                  const columnWidth = tableBlock.columnWidths?.[colIndex];

                  return (
                    <TableCell
                      key={colIndex}
                      value={cell}
                      onChange={(newValue) => {
                        const newRows = [...tableBlock.rows];
                        newRows[rowIndex][colIndex] = newValue;
                        onUpdate({ rows: newRows });
                      }}
                      isSelected={isSelected}
                      onSelect={() => {
                        const isMultiSelect = false; // 暫時簡化
                        onCellSelect(cellId, isMultiSelect);
                      }}
                      onMouseEnter={() => onCellHover(cellId)}
                      onMouseLeave={() => onCellHover(null)}
                      showResizeHandle={isHovered && colIndex < row.length - 1 && !previewMode}
                      onResizeStart={(e) => {
                        e.preventDefault();
                        onColumnResizeStart(colIndex);
                      }}
                      style={{
                        width: columnWidth ? `${columnWidth}%` : 'auto',
                        textAlign: (tableBlock.cellStyle as any)?.textAlign || "left",
                        padding: tableBlock.cellStyle?.padding || 4,
                        fontFamily: (tableBlock.cellStyle as any)?.fontFamily || "Noto Sans TC",
                        fontSize: (tableBlock.cellStyle as any)?.fontSize || 12,
                        color: (tableBlock.cellStyle as any)?.color || "#000000",
                        border: tableBlock.showBorders !== false ? "1px solid #d1d5db" : "none",
                      }}
                    />
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
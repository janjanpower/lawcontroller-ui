import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import {
  Type,
  Table,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Minus,
  Settings,
  ChevronDown,
  X,
  Tag
} from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../../../../utils/api';
import type { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from './schema';

interface QuoteCanvasProps {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
  onExport: (schema: QuoteCanvasSchema) => void;
  onSaveTemplate: () => void;
  onRemoveTemplate: () => void;
  caseId: string;
}

interface VariableDef {
  key: string;
  label: string;
  value: string;
}



// ===== 半受控 contentEditable（處理 IME 與 caret） =====
type EditableContentProps = {
  html: string;
  onCommit: (html: string) => void;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onFocusIn?: () => void;   // 👈 新增
  onFocusOut?: () => void;  // 👈 新增
};


function getTextNodesIn(node: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  let cur = walker.nextNode();
  while (cur) { out.push(cur as Text); cur = walker.nextNode(); }
  return out;
}

function saveSelection(root: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const texts = getTextNodesIn(root);
  let start = 0, end = 0, passed = 0;
  for (const tn of texts) {
    const len = tn.nodeValue?.length ?? 0;
    if (tn === range.startContainer) start = passed + range.startOffset;
    if (tn === range.endContainer)   end   = passed + range.endOffset;
    passed += len;
  }
  return { start, end };
}

function restoreSelection(root: HTMLElement, selInfo: { start: number; end: number } | null) {
  if (!selInfo) return;
  const texts = getTextNodesIn(root);
  const sel = window.getSelection();
  if (!sel) return;

  let startNode: Text | null = null, endNode: Text | null = null;
  let startOffset = 0, endOffset = 0, passed = 0;

  for (const tn of texts) {
    const len = tn.nodeValue?.length ?? 0;
    if (!startNode && passed + len >= selInfo.start) {
      startNode = tn; startOffset = selInfo.start - passed;
    }
    if (!endNode && passed + len >= selInfo.end) {
      endNode = tn; endOffset = selInfo.end - passed; break;
    }
    passed += len;
  }
  if (!startNode) startNode = texts[texts.length - 1] || null;
  if (!endNode)   endNode   = startNode;

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, Math.max(0, Math.min(startNode.nodeValue?.length ?? 0, startOffset)));
    range.setEnd(endNode,   Math.max(0, Math.min(endNode.nodeValue?.length ?? 0, endOffset)));
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// ===== 在目前選取（caret）插入 HTML（成功回 true；不在 contentEditable 時回 false） =====
function insertHtmlAtCaret(html: string): boolean {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  // 確保選取在 contentEditable 內
  const container = range.commonAncestorContainer as HTMLElement | Text;
  const host = (container.nodeType === 1 ? container : container.parentElement) as HTMLElement | null;
  if (!host) return false;
  if (!host.closest('[contenteditable="true"]')) return false;

  const temp = document.createElement('div');
  temp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let node: ChildNode | null;
  let lastNode: ChildNode | null = null;
  // 將 temp 內容移入片段
  // eslint-disable-next-line no-cond-assign
  while ((node = temp.firstChild)) {
    lastNode = frag.appendChild(node);
  }
  range.deleteContents();
  range.insertNode(frag);

  // 把 caret 放到插入內容之後
  if (lastNode) {
    const newRange = document.createRange();
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
  return true;
}


const EditableContent: React.FC<EditableContentProps> = ({
  html,
  onCommit,
  readOnly,
  className,
  style,
  placeholder,
  onFocusIn,
  onFocusOut
}) => {

  const ref = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastCommitted = useRef(html);

  // 外部 html 變更時：非聚焦或唯讀才覆寫 DOM（避免 caret 跳）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const focused = document.activeElement === el;
    if (focused && !readOnly) return;
    if (lastCommitted.current !== html) {
      el.innerHTML = html || "";
      lastCommitted.current = html || "";
    }
  }, [html, readOnly]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const newHtml = el.innerHTML;
    if (newHtml !== lastCommitted.current) {
      lastCommitted.current = newHtml;
      onCommit(newHtml);
    }
  }, [onCommit]);

  const onInput = useCallback(() => {
    // 半受控：打字不回寫（避免每鍵重繪與 caret 丟失）
    if (isComposing) return;
  }, [isComposing]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const el = ref.current;
      const saved = el ? saveSelection(el) : null;
      commit();
      requestAnimationFrame(() => {
        if (el) restoreSelection(el, saved);
      });
      e.preventDefault();
    }
  }, [commit]);

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      className={className}
      style={{
        outline: "none",
        minHeight: 20,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style
      }}
      data-placeholder={placeholder || ""}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onFocus={() => onFocusIn?.()}
      onBlur={(e) => { commit(); onFocusOut?.(); }}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => { setIsComposing(false); commit(); }}
      // 初次掛載使用外部值
      dangerouslySetInnerHTML={{ __html: lastCommitted.current || html || "" }}
      suppressContentEditableWarning
    />
  );
};


// ===== Rich Text Editor（改為半受控 + 預覽替換） =====
const RichTextEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  style: React.CSSProperties;
  vars: VariableDef[];
  isPreview: boolean;
}> = ({ content, onChange, style, vars, isPreview }) => {
  // 預覽時才替換變數；編輯時維持原字串（避免把 {{}} 寫回）
  const previewHtml = React.useMemo(() => {
    if (!isPreview) return content;
    let rendered = content || "";
    for (const v of vars) {
      const re = new RegExp(`{{${v.key}}}`, "g");
      rendered = rendered.replace(re, v.value || v.label || "");
    }
    return rendered;
  }, [content, vars, isPreview]);

  return (
    <EditableContent
      html={isPreview ? previewHtml : content}
      readOnly={isPreview}
      onCommit={(html) => onChange(html)}
      onFocusIn={() => setIsEditing(true)}
      onFocusOut={() => setIsEditing(false)}
      style={{
        minHeight: "40px",
        padding: "8px",
        border: isPreview ? "none" : "1px dashed #ccc",
        lineHeight: "1.5",
        ...style
      }}
    />
  );
};


// ===== Table Cell（改為半受控；僅選中且非預覽時可編輯） =====
const TableCell: React.FC<{
  content: string;
  onChange: (content: string) => void;
  style: React.CSSProperties;
  vars: VariableDef[];
  isPreview: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ content, onChange, style, vars, isPreview, isSelected, onClick }) => {
  const previewHtml = React.useMemo(() => {
    if (!isPreview) return content;
    let rendered = content || "";
    for (const v of vars) {
      const re = new RegExp(`{{${v.key}}}`, "g");
      rendered = rendered.replace(re, v.value || v.label || "");
    }
    return rendered;
  }, [content, vars, isPreview]);

  return (
    <td
      style={{
        border: "1px solid #ddd",
        padding: "8px",
        minHeight: "30px",
        cursor: isPreview ? "default" : "pointer",
        ...style, // 先套用外部樣式
        backgroundColor: isSelected ? "#e3f2fd" : (style?.backgroundColor as any) // 再以選取狀態覆蓋
      }}
      onClick={onClick}
    >

      <EditableContent
        html={isPreview ? previewHtml : content}
        readOnly={isPreview || !isSelected}
        onCommit={(html) => onChange(html)}
        onFocusIn={() => setIsEditing(true)}
        onFocusOut={() => setIsEditing(false)}
        style={{ lineHeight: "1.4", minHeight: 20 }}
      />

    </td>
  );
};


// Variable Tag Component
const VariableTag: React.FC<{
  varKey: string;
  label: string;
  onInsert: () => void;
}> = ({ varKey, label, onInsert }) => (
  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-2 hover:bg-blue-100 transition-colors">
    <div className="flex-1 min-w-0">
      <div className="text-xs font-mono text-blue-700 truncate">
        {`{{${varKey}}}`}
      </div>
      <div className="text-xs text-gray-600 truncate">
        {label}
      </div>
    </div>
    <button
      onClick={onInsert}
      className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex-shrink-0"
    >
      插入
    </button>
  </div>
);

export default function QuoteCanvas({
  value,
  onChange,
  onExport,
  onSaveTemplate,
  onRemoveTemplate,
  caseId
}: QuoteCanvasProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showVariablePanel, setShowVariablePanel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // 載入變數和模板
  useEffect(() => {
    loadVariables();
    loadTemplates();
  }, [caseId]);

  const loadVariables = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/cases/${caseId}/variables?firm_code=${encodeURIComponent(firmCode)}`);
      if (res.ok) {
        const data = await res.json();
        setVariables(data || []);
      }
    } catch (error) {
      console.error('載入變數失敗:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/quote-templates?firm_code=${encodeURIComponent(firmCode)}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('載入模板失敗:', error);
    }
  };

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);
  const isTextSelected = selectedBlock?.type === 'text';
  const isTableSelected = selectedBlock?.type === 'table';

  // 新增文字區塊
  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 50,
      y: 50,
      w: 300,
      h: 60,
      text: '點擊編輯文字',
      fontSize: 14,
      align: 'left'
    };

    onChange({
      ...value,
      blocks: [...value.blocks, newBlock]
    });
    setSelectedBlockId(newBlock.id);
  };

  // 新增表格區塊
  const addTableBlock = () => {
    const newBlock: TableBlock = {
      id: `table-${Date.now()}`,
      type: 'table',
      x: 50,
      y: 150,
      w: 400,
      h: 200,
      headers: ['項目', '數量', '單價', '小計'],
      rows: [
        ['項目1', '1', '1000', '1000'],
        ['項目2', '2', '500', '1000']
      ],
      showBorders: true,
      columnWidths: [40, 15, 20, 25]
    };

    onChange({
      ...value,
      blocks: [...value.blocks, newBlock]
    });
    setSelectedBlockId(newBlock.id);
  };

  // 複製區塊
  const copyBlock = () => {
    if (!selectedBlock) return;

    const newBlock = {
      ...selectedBlock,
      id: `${selectedBlock.type}-${Date.now()}`,
      x: selectedBlock.x + 20,
      y: selectedBlock.y + 20
    };

    onChange({
      ...value,
      blocks: [...value.blocks, newBlock]
    });
    setSelectedBlockId(newBlock.id);
  };

  // 鎖定/解鎖區塊
  const toggleLock = () => {
    if (!selectedBlock) return;

    const updatedBlocks = value.blocks.map(block =>
      block.id === selectedBlockId
        ? { ...block, locked: !block.locked }
        : block
    );

    onChange({
      ...value,
      blocks: updatedBlocks
    });
  };

  // 移除區塊
  const removeBlock = () => {
    if (!selectedBlock) return;

    const updatedBlocks = value.blocks.filter(block => block.id !== selectedBlockId);
    onChange({
      ...value,
      blocks: updatedBlocks
    });
    setSelectedBlockId(null);
    setSelectedCellId(null);
  };

  // 更新區塊
  const updateBlock = (blockId: string, updates: Partial<CanvasBlock>) => {
    const updatedBlocks = value.blocks.map(block =>
      block.id === blockId ? { ...block, ...updates } : block
    );

    onChange({
      ...value,
      blocks: updatedBlocks
    });
  };

  // 插入變數到目前選取（支援 Text、Table 的儲存格與表頭），若無聚焦則附加到選中元素尾端
  const insertVariableToBlock = (varKey: string) => {
    const varTag = `{{${varKey}}}`;

    // 1) 優先嘗試在目前 caret 插入
    const ok = insertHtmlAtCaret(varTag);
    if (ok) return;

    // 2) 沒有聚焦 caret 時：走選中元素的後備策略
    if (!selectedBlock) return;

    if (selectedBlock.type === 'text') {
      const textBlock = selectedBlock as TextBlock;
      updateBlock(selectedBlock.id, { text: (textBlock.text || '') + varTag });
      return;
    }

    if (selectedBlock.type === 'table' && selectedCellId) {
      const tableBlock = selectedBlock as TableBlock;

      // header-<colIndex>
      if (selectedCellId.startsWith('header-')) {
        const colIndex = Number(selectedCellId.split('-')[1]);
        if (!Number.isNaN(colIndex)) {
          const newHeaders = [...tableBlock.headers];
          newHeaders[colIndex] = (newHeaders[colIndex] || '') + varTag;
          updateBlock(selectedBlock.id, { headers: newHeaders });
        }
        return;
      }

      // row-col
      const [rStr, cStr] = selectedCellId.split('-');
      const r = Number(rStr);
      const c = Number(cStr);
      if (!Number.isNaN(r) && !Number.isNaN(c)) {
        const newRows = tableBlock.rows.map((row) => [...row]);
        newRows[r][c] = (newRows[r][c] || '') + varTag;
        updateBlock(selectedBlock.id, { rows: newRows });
      }
    }
  };


  // 格式化工具函數
  const updateTextFormat = (property: keyof TextBlock, value: any) => {
    if (!selectedBlock || selectedBlock.type !== 'text') return;
    updateBlock(selectedBlock.id, { [property]: value });
  };

  // 表格操作函數
  const addTableRow = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    const newRow = new Array(tableBlock.headers.length).fill('');
    updateBlock(selectedBlock.id, {
      rows: [...tableBlock.rows, newRow]
    });
  };

  const removeTableRow = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    if (tableBlock.rows.length > 1) {
      updateBlock(selectedBlock.id, {
        rows: tableBlock.rows.slice(0, -1)
      });
    }
  };

  const addTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;

    updateBlock(selectedBlock.id, {
      headers: [...tableBlock.headers, '新欄位'],
      rows: tableBlock.rows.map(row => [...row, '']),
      columnWidths: [...(tableBlock.columnWidths || []), 20]
    });
  };

  const removeTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    if (tableBlock.headers.length > 1) {
      updateBlock(selectedBlock.id, {
        headers: tableBlock.headers.slice(0, -1),
        rows: tableBlock.rows.map(row => row.slice(0, -1)),
        columnWidths: tableBlock.columnWidths?.slice(0, -1)
      });
    }
  };

  // 模板管理
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('請輸入模板名稱');
      return;
    }

    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      const payload = {
        name: templateName,
        description: '',
        content_json: value,
        is_default: false
      };

      let res;
      if (currentTemplateId) {
        // 更新現有模板
        res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // 建立新模板
        res = await apiFetch(`/api/quote-templates?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const data = await res.json();
        setCurrentTemplateId(data.id);
        await loadTemplates();
        alert(currentTemplateId ? '模板更新成功' : '模板儲存成功');
      } else {
        const error = await res.json();
        alert(error.detail || '儲存失敗');
      }
    } catch (error) {
      console.error('儲存模板失敗:', error);
      alert('儲存模板失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTemplate = async () => {
    if (!currentTemplateId) return;

    if (!confirm('確定要刪除此模板嗎？')) return;

    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setCurrentTemplateId(null);
        setTemplateName('');
        // 重置為空白畫布
        onChange({
          page: value.page,
          blocks: [],
          gridSize: value.gridSize,
          showGrid: value.showGrid
        });
        await loadTemplates();
        alert('模板刪除成功');
      } else {
        const error = await res.json();
        alert(error.detail || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除模板失敗:', error);
      alert('刪除模板失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (template: any) => {
    setCurrentTemplateId(template.id);
    setTemplateName(template.name);
    onChange(template.content_json);
    setShowTemplateDropdown(false);
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左側變數面板 */}
      {showVariablePanel && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                變數標籤
              </h3>
              <button
                onClick={() => setShowVariablePanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              點擊插入變數到選中的元素
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {variables.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  載入變數中...
                </div>
              ) : (
                variables.map((variable) => (
                  <VariableTag
                    key={variable.key}
                    varKey={variable.key}
                    label={variable.label}
                    onInsert={() => insertVariableToBlock(variable.key)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主要編輯區域 */}
      <div className="flex-1 flex flex-col">
        {/* 頂部工具列 */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            {/* 左側：全域工具 */}
            <div className="flex items-center gap-4">
              {/* 預覽模式切換 */}
              <button
                onClick={() => setIsPreview(!isPreview)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  isPreview
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {isPreview ? '編輯模式' : '預覽模式'}
                </span>
              </button>

              {/* 新增元素 */}
              {!isPreview && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={addTextBlock}
                    className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                  >
                    <Type className="w-4 h-4" />
                    <span className="text-sm font-medium">文字</span>
                  </button>
                  <button
                    onClick={addTableBlock}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-sm font-medium">表格</span>
                  </button>
                </div>
              )}

              {/* 變數面板切換 */}
              {!showVariablePanel && (
                <button
                  onClick={() => setShowVariablePanel(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  <span className="text-sm font-medium">變數</span>
                </button>
              )}
            </div>

            {/* 中間：格式化工具（根據選中元素顯示） */}
            {selectedBlock && !isPreview && (
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                {/* 文字格式化工具 */}
                {isTextSelected && (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateTextFormat('bold', !(selectedBlock as TextBlock).bold)}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).bold ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateTextFormat('italic', !(selectedBlock as TextBlock).italic)}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).italic ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <Italic className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateTextFormat('underline', !(selectedBlock as TextBlock).underline)}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).underline ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <Underline className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-px h-6 bg-gray-300" />

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateTextFormat('align', 'left')}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).align === 'left' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateTextFormat('align', 'center')}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).align === 'center' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateTextFormat('align', 'right')}
                        className={`p-2 rounded ${(selectedBlock as TextBlock).align === 'right' ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-px h-6 bg-gray-300" />

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={(selectedBlock as TextBlock).fontSize || 14}
                        onChange={(e) => updateTextFormat('fontSize', parseInt(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="8"
                        max="72"
                      />
                      <input
                        type="color"
                        value={(selectedBlock as TextBlock).color || '#000000'}
                        onChange={(e) => updateTextFormat('color', e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        title="文字顏色"
                      />
                      <input
                        type="color"
                        value={(selectedBlock as TextBlock).backgroundColor || '#ffffff'}
                        onChange={(e) => updateTextFormat('backgroundColor', e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        title="背景顏色"
                      />
                    </div>
                  </>
                )}

                {/* 表格工具 */}
                {isTableSelected && (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={addTableRow}
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">列</span>
                      </button>
                      <button
                        onClick={removeTableRow}
                        className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                        <span className="text-xs">列</span>
                      </button>
                      <button
                        onClick={addTableColumn}
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">欄</span>
                      </button>
                      <button
                        onClick={removeTableColumn}
                        className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                        <span className="text-xs">欄</span>
                      </button>
                    </div>

                    {selectedCellId && (
                      <>
                        <div className="w-px h-6 bg-gray-300" />
                        <input
                          type="color"
                          value="#ffffff"
                          onChange={(e) => {
                            // TODO: 實現儲存格背景色
                            console.log('設定儲存格背景色:', e.target.value);
                          }}
                          className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                          title="儲存格背景色"
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 右側：模板和匯出工具 */}
            <div className="flex items-center gap-3">
              {/* 模板選擇 */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">模板</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showTemplateDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowTemplateDropdown(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      <div className="p-3 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="模板名稱"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSaveTemplate}
                            disabled={loading}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                          >
                            {currentTemplateId ? '更新' : '儲存'}
                          </button>
                          {currentTemplateId && (
                            <button
                              onClick={handleRemoveTemplate}
                              disabled={loading}
                              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {templates.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            尚無模板
                          </div>
                        ) : (
                          templates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => loadTemplate(template)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                currentTemplateId === template.id ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                            >
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(template.created_at).toLocaleDateString('zh-TW')}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 匯出按鈕 */}
              <button
                onClick={() => onExport(value)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">匯出</span>
              </button>
            </div>
          </div>
        </div>

        {/* 畫布區域 */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div
            ref={canvasRef}
            className="relative mx-auto bg-white shadow-lg"
            style={{
              width: value.page.width,
              height: value.page.height,
              backgroundImage: value.showGrid
                ? `radial-gradient(circle, #ddd 1px, transparent 1px)`
                : 'none',
              backgroundSize: value.showGrid ? `${value.gridSize}px ${value.gridSize}px` : 'auto'
            }}
            onClick={() => {
              setSelectedBlockId(null);
              setSelectedCellId(null);
            }}
          >
            {/* 中心線輔助 */}
            {!isPreview && (
              <>
                <div
                  className="absolute border-l border-blue-300 border-dashed opacity-30"
                  style={{ left: value.page.width / 2, top: 0, height: '100%' }}
                />
                <div
                  className="absolute border-t border-blue-300 border-dashed opacity-30"
                  style={{ top: value.page.height / 2, left: 0, width: '100%' }}
                />
              </>
            )}

            {/* 渲染所有區塊 */}
            {value.blocks.map((block) => (
              <Rnd
                key={block.id}
                size={{ width: block.w, height: block.h || 'auto' }}
                position={{ x: block.x, y: block.y }}
                onDragStop={(e, d) => {
                  updateBlock(block.id, { x: d.x, y: d.y });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateBlock(block.id, {
                    w: ref.offsetWidth,
                    h: ref.offsetHeight,
                    x: position.x,
                    y: position.y
                  });
                }}
                disableDragging={isPreview || block.locked || isEditing}
                enableResizing={!isPreview && !block.locked && !isEditing}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(block.id);
                  if (block.type === 'text') {
                    setSelectedCellId(null);
                  }
                }}
                className={`${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''} ${
                  block.locked ? 'opacity-75' : ''
                }`}
              >
                {/* 浮動操作工具列 */}
                {selectedBlockId === block.id && !isPreview && (
                  <div className="absolute -top-10 right-0 flex items-center gap-1 bg-gray-800 text-white px-2 py-1 rounded-md shadow-lg z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyBlock();
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="複製"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock();
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                      title={block.locked ? "解鎖" : "鎖定"}
                    >
                      {block.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock();
                      }}
                      className="p-1 hover:bg-red-600 rounded"
                      title="移除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* 渲染區塊內容 */}
                {block.type === 'text' && (
                  <RichTextEditor
                    content={(block as TextBlock).text}
                    onChange={(text) => updateBlock(block.id, { text })}
                    style={{
                      fontSize: (block as TextBlock).fontSize || 14,
                      fontWeight: (block as TextBlock).bold ? 'bold' : 'normal',
                      fontStyle: (block as TextBlock).italic ? 'italic' : 'normal',
                      textDecoration: (block as TextBlock).underline ? 'underline' : 'none',
                      textAlign: (block as TextBlock).align || 'left',
                      color: (block as TextBlock).color || '#000000',
                      backgroundColor: (block as TextBlock).backgroundColor || 'transparent',
                      width: '100%',
                      height: '100%'
                    }}
                    vars={variables}
                    isPreview={isPreview}
                  />
                )}

                {block.type === 'table' && (
                  <div className="w-full h-full overflow-auto">
                    <table className="w-full h-full border-collapse">
                      <thead>
                        <tr>
                          {(block as TableBlock).headers.map((header, colIndex) => (
                            <th
                              key={colIndex}
                              className="border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-left relative"
                              style={{
                                width: `${(block as TableBlock).columnWidths?.[colIndex] || 25}%`
                              }}
                            >
                              <TableCell
                                content={header}
                                onChange={(newContent) => {
                                  const newHeaders = [...(block as TableBlock).headers];
                                  newHeaders[colIndex] = newContent;
                                  updateBlock(block.id, { headers: newHeaders });
                                }}
                                style={{
                                  border: 'none',
                                  padding: 0,
                                  backgroundColor: 'transparent'
                                }}
                                vars={variables}
                                isPreview={isPreview}
                                isSelected={selectedCellId === `header-${colIndex}`}
                                onClick={() => {
                                  setSelectedCellId(`header-${colIndex}`);
                                  setSelectedBlockId(block.id);
                                }}
                              />

                              {/* 欄位調整手柄 */}
                              {!isPreview && colIndex < (block as TableBlock).headers.length - 1 && (
                                <div
                                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                                  onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  const startX = e.clientX;
                                  const table = block as TableBlock;
                                  const startWidths = (table.columnWidths && table.columnWidths.length === table.headers.length)
                                    ? [...table.columnWidths]
                                    : new Array(table.headers.length).fill(100 / table.headers.length);

                                  const thisIndex = colIndex;
                                  const nextIndex = colIndex + 1;

                                  const onMouseMove = (moveEvt: MouseEvent) => {
                                    const delta = moveEvt.clientX - startX; // px
                                    // 以容器寬度換算百分比
                                    const container = (e.currentTarget as HTMLElement).closest('table') as HTMLTableElement | null;
                                    const totalPx = container?.getBoundingClientRect().width || 1;
                                    const deltaPct = (delta / totalPx) * 100;

                                    let newW = startWidths[thisIndex] + deltaPct;
                                    let nextW = startWidths[nextIndex] - deltaPct;

                                    // 最小寬度限制，避免負值或太窄
                                    const MIN = 5;
                                    if (newW < MIN) { nextW -= (MIN - newW); newW = MIN; }
                                    if (nextW < MIN) { newW -= (MIN - nextW); nextW = MIN; }

                                    const newWidths = [...startWidths];
                                    newWidths[thisIndex] = newW;
                                    newWidths[nextIndex] = nextW;

                                    updateBlock(block.id, { columnWidths: newWidths });
                                  };

                                  const onMouseUp = () => {
                                    document.removeEventListener('mousemove', onMouseMove);
                                    document.removeEventListener('mouseup', onMouseUp);
                                  };

                                  document.addEventListener('mousemove', onMouseMove);
                                  document.addEventListener('mouseup', onMouseUp);
                                }}

                                />
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(block as TableBlock).rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <TableCell
                                key={`${rowIndex}-${colIndex}`}
                                content={cell}
                                onChange={(newContent) => {
                                  const newRows = [...(block as TableBlock).rows];
                                  newRows[rowIndex][colIndex] = newContent;
                                  updateBlock(block.id, { rows: newRows });
                                }}
                                style={{
                                  width: `${(block as TableBlock).columnWidths?.[colIndex] || 25}%`
                                }}
                                vars={variables}
                                isPreview={isPreview}
                                isSelected={selectedCellId === `${rowIndex}-${colIndex}`}
                                onClick={() => {
                                  setSelectedCellId(`${rowIndex}-${colIndex}`);
                                  setSelectedBlockId(block.id);
                                }}
                              />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Rnd>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
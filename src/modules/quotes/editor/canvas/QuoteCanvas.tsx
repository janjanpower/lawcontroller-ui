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

  const container = range.commonAncestorContainer as HTMLElement | Text;
  const host = (container.nodeType === 1 ? container : container.parentElement) as HTMLElement | null;
  if (!host) return false;
  if (!host.closest('[contenteditable="true"]')) return false;

  const temp = document.createElement('div');
  temp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let node: ChildNode | null;
  let lastNode: ChildNode | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((node = temp.firstChild)) {
    lastNode = frag.appendChild(node);
  }
  range.deleteContents();
  range.insertNode(frag);

  if (lastNode) {
    const newRange = document.createRange();
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
  return true;
}

function renderWithVariables(html: string, vars: VariableDef[]) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html || "";

  const dict = new Map<string, string>();
  vars.forEach(v => dict.set(v.key, v.value ?? v.label ?? ""));

  wrap.querySelectorAll('span.var-chip').forEach((chip) => {
    const el = chip as HTMLElement;
    const key = el.dataset.varKey || "";
    const text = dict.get(key) ?? el.innerText ?? "";
    el.replaceWith(document.createTextNode(text));
  });

  return wrap.innerHTML;
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
  // IME 組字中按 Enter：只確認選字，不插入段落也不提交，避免 caret 亂跳
  if (isComposing && e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // Ctrl/Cmd + Enter：提交但保存/還原 caret
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    const el = ref.current;
    const saved = el ? saveSelection(el) : null;
    commit();
    requestAnimationFrame(() => {
      if (el) restoreSelection(el, saved);
    });
    e.preventDefault();
    return;
  }

  // 原子刪除：在 chip 前按 Backspace 或在 chip 後按 Delete → 一次刪整顆
  if (e.key === "Backspace" || e.key === "Delete") {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;

    const host = ref.current;
    if (!host) return;

    const isChip = (el: Node | null) =>
      el instanceof HTMLElement && el.classList.contains("var-chip");

    // 找到光標左右節點
    let left: Node | null = null;
    let right: Node | null = null;

    if (node.nodeType === Node.TEXT_NODE) {
      // 文字節點情況
      left = (node as Text).splitText ? (offset === 0 ? node.previousSibling : null) : null;
      right = (node as Text).splitText ? (offset === (node.nodeValue?.length ?? 0) ? node.nextSibling : null) : null;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      left = el.childNodes[offset - 1] ?? el.previousSibling;
      right = el.childNodes[offset] ?? el.nextSibling;
    }

    // Backspace：若左邊是 chip → 刪除 chip
    if (e.key === "Backspace" && isChip(left)) {
      (left as HTMLElement).remove();
      e.preventDefault();
      return;
    }
    // Delete：若右邊是 chip → 刪除 chip
    if (e.key === "Delete" && isChip(right)) {
      (right as HTMLElement).remove();
      e.preventDefault();
      return;
    }
  }
}, [commit, isComposing]);

  return (
  <div
    ref={ref}
    contentEditable={!readOnly}
    spellCheck={false}       // 關閉拼字檢查紅底線
    autoCorrect="off"        // 關閉自動更正（iOS/Chrome）
    autoCapitalize="off"     // 關閉自動首字大寫
    className={className}
    style={{
      outline: "none",
      minHeight: 20,
      height: "100%",
      maxHeight: "100%",
      overflow: "auto",
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
    onCompositionEnd={() => {
      const el = ref.current;
      const saved = el ? saveSelection(el) : null;
      setIsComposing(false);
      commit();
      requestAnimationFrame(() => {
        if (el) restoreSelection(el, saved);
      });
    }}
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
  onFocusIn?: () => void;   // 新增
  onFocusOut?: () => void;  // 新增
}> = ({ content, onChange, style, vars, isPreview, onFocusIn, onFocusOut }) => {

  // 預覽時才替換變數；編輯時維持原字串（避免把 {{}} 寫回）
  const previewHtml = React.useMemo(() => {
  return isPreview ? renderWithVariables(content, vars) : content;
}, [content, vars, isPreview]);

  return (
    <EditableContent
      html={isPreview ? previewHtml : content}
      readOnly={isPreview}
      onCommit={(html) => onChange(html)}
      onFocusIn={onFocusIn}     // ← 改這裡
      onFocusOut={onFocusOut}   // ← 改這裡
      style={{
        minHeight: "40px",
        height: "100%",
        maxHeight: "100%",
        padding: "8px",
        border: "none",          // 移除虛線
        overflow: "auto",        // 超出時滾動
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
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
  onFocusIn?: () => void;
  onFocusOut?: () => void;
}> = ({ content, onChange, style, vars, isPreview, isSelected, onClick, onFocusIn, onFocusOut }) => {
  const previewHtml = React.useMemo(() => (isPreview ? renderWithVariables(content, vars) : content), [content, vars, isPreview]);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px",
        minHeight: 24,
        cursor: isPreview ? "default" : "text",
        ...style, // ← 先展開外部樣式
        backgroundColor: isSelected ? "#e3f2fd" : (style?.backgroundColor as any) // ← 最後決定底色
      }}
    >
      <EditableContent
        html={isPreview ? previewHtml : content}
        readOnly={isPreview || !isSelected}
        onCommit={(html) => onChange(html)}
        onFocusIn={onFocusIn}
        onFocusOut={onFocusOut}
        style={{ lineHeight: "1.4", minHeight: 20, width: "100%", height: "100%" }}
      />
    </div>
  );
};



// Variable Tag Component
const VariableTag: React.FC<{ label: string; onInsert: () => void; }> = ({ label, onInsert }) => (
  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-2 hover:bg-blue-100 transition-colors">
    <div className="flex-1 min-w-0">
      <div className="text-sm text-blue-700 truncate">{label}</div>
    </div>
    <button
      onMouseDown={(e) => e.preventDefault()} // ← 保持原本的 selection/caret
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
        const data: VariableDef[] = await res.json();

        // 內建「當日」(day，無前導 0) 一起放進變數清單
        const filtered = (data || []).filter(v => ['階段名稱', '階段日期'].includes(v.label));
        setVariables(filtered);
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
    headers: [],                    // ← 無表頭
    rows: [['', '', '']],           // ← 先給 1 列 3 欄
    showBorders: true,
    columnWidths: [33.33, 33.33, 33.34]
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

  type InsertVarPayload = { key: string; label: string };


const startResizeColumn = (e: React.MouseEvent, blk: CanvasBlock, colIndex: number) => {
  e.preventDefault();
  e.stopPropagation();
  if (blk.type !== 'table') return;

  const table = blk as TableBlock;
  const startX = e.clientX;

  const containerTable = (e.currentTarget as HTMLElement).closest('table') as HTMLTableElement | null;
  const totalPx = containerTable?.getBoundingClientRect().width || 1;

  const cols = Math.max(
    table.columnWidths?.length || 0,
    table.headers.length > 0 ? table.headers.length : (table.rows[0]?.length || 0)
  );

  const startWidths = (table.columnWidths && table.columnWidths.length === cols)
    ? [...table.columnWidths]
    : new Array(cols).fill(100 / cols);

  const nextIndex = colIndex + 1;

  const onMouseMove = (moveEvt: MouseEvent) => {
    const deltaPx = moveEvt.clientX - startX;
    const deltaPct = (deltaPx / totalPx) * 100;

    let w1 = startWidths[colIndex] + deltaPct;
    let w2 = startWidths[nextIndex] - deltaPct;

    const MIN = 5;
    if (w1 < MIN) { w2 -= (MIN - w1); w1 = MIN; }
    if (w2 < MIN) { w1 -= (MIN - w2); w2 = MIN; }

    const newWidths = [...startWidths];
    newWidths[colIndex] = w1;
    newWidths[nextIndex] = w2;

    updateBlock(blk.id, { columnWidths: newWidths });
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // 取最新的 widths 正規化成總和 100
    if (blk.type === 'table') {
      const t = blk as TableBlock;
      const widths = (t.columnWidths && t.columnWidths.length)
        ? t.columnWidths
        : new Array(
            Math.max(t.headers.length, t.rows[0]?.length || 0)
          ).fill(100 / Math.max(t.headers.length, t.rows[0]?.length || 1));
      const sum = widths.reduce((a,b)=>a+b,0) || 1;
      const norm = widths.map(w => (w / sum) * 100);
      updateBlock(blk.id, { columnWidths: norm });
    }
  };



const insertVariableToBlock = (payload: InsertVarPayload) => {
  const baseStyle = 'padding:2px 6px;border-radius:4px;display:inline-block;background-color:#FFF3BF;';
  // chip 顯示「名稱文字」，用 data-var-key 綁定替換用 key
  const chipHtml = `<span class="var-chip" contenteditable="false" data-var-key="${payload.key}" style="${baseStyle}">${payload.label}</span>`;

  if (insertHtmlAtCaret(chipHtml)) return;
  if (!selectedBlock) return;

  const appendToHtml = (html: string) => (html || '') + chipHtml;

  if (selectedBlock.type === 'text') {
    const tb = selectedBlock as TextBlock;
    updateBlock(selectedBlock.id, { text: appendToHtml(tb.text) });
    return;
  }

  if (selectedBlock.type === 'table' && selectedCellId) {
    const tb = selectedBlock as TableBlock;

    if (selectedCellId.startsWith('header-')) {
      const colIndex = Number(selectedCellId.split('-')[1]);
      if (!Number.isNaN(colIndex)) {
        const headers = [...tb.headers];
        headers[colIndex] = appendToHtml(headers[colIndex] || '');
        updateBlock(selectedBlock.id, { headers });
      }
      return;
    }

    const [rStr, cStr] = selectedCellId.split('-');
    const r = Number(rStr);
    const c = Number(cStr);
    if (!Number.isNaN(r) && !Number.isNaN(c)) {
      const rows = tb.rows.map(row => [...row]);
      rows[r][c] = appendToHtml(rows[r][c] || '');
      updateBlock(selectedBlock.id, { rows });
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
    const t = selectedBlock as TableBlock;

    const cols = Math.max(
      t.headers.length,
      t.rows[0]?.length || 3
    );
    const newRow = new Array(cols).fill('');
    updateBlock(selectedBlock.id, { rows: [...t.rows, newRow] });
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
    const t = selectedBlock as TableBlock;

    const cols = Math.max(t.headers.length, t.rows[0]?.length || 0);
    const nextCols = cols + 1;

    // 1) 欄位資料結構
    const nextHeaders = t.headers.length ? [...t.headers, ''] : t.headers;
    const nextRows = t.rows.map(r => [...r, '']);

    // 2) 欄寬正規化：舊欄縮放到 (cols/nextCols)*原本，最後新增一格 100/nextCols
    const existing = (t.columnWidths && t.columnWidths.length === cols)
      ? [...t.columnWidths]
      : new Array(cols).fill(100 / cols);

    const scaled = existing.map(w => w * (cols / nextCols));
    const newLast = 100 / nextCols;
    const nextWidths = [...scaled, newLast];

    updateBlock(selectedBlock.id, { headers: nextHeaders, rows: nextRows, columnWidths: nextWidths });
  };


  const removeTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const t = selectedBlock as TableBlock;

    const cols = Math.max(t.headers.length, t.rows[0]?.length || 0);
    if (cols <= 1) return;

    const nextCols = cols - 1;

    const nextHeaders = t.headers.length ? t.headers.slice(0, -1) : t.headers;
    const nextRows = t.rows.map(r => r.slice(0, -1));

    const existing = (t.columnWidths && t.columnWidths.length === cols)
      ? [...t.columnWidths]
      : new Array(cols).fill(100 / cols);

    const trimmed = existing.slice(0, -1);
    const sum = trimmed.reduce((a, b) => a + b, 0);
    const nextWidths = sum === 0
      ? new Array(nextCols).fill(100 / nextCols)
      : trimmed.map(w => (w / sum) * 100);

    updateBlock(selectedBlock.id, { headers: nextHeaders, rows: nextRows, columnWidths: nextWidths });
  };


  // === 浮動工具列輔助：避免點工具列時 contentEditable 失焦、讓 execCommand 作用在當前選取 ===
  const preventBlur = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    // 讓 input/select/textarea 正常工作（例如顏色選擇器）
    if (el.closest('input, select, textarea')) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const cellExec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);


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
              {variables
                .filter(v => ['階段名稱', '階段日期'].includes(v.label))
                .map(v => (
                  <VariableTag
                    key={v.key}
                    label={v.label}
                    onInsert={() => insertVariableToBlock({ key: v.key, label: v.label })}
                  />
                ))}
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

                      <div className="max-h-64 overflow-y-auto">
                        {/* 新增模板項目（含 ICON） */}
                        <button
                          onClick={() => { setCurrentTemplateId(null); setTemplateName(''); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700">新增模板</span>
                        </button>

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
              setIsEditing(false);
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
                bounds="parent"
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
                  <div
                    className="absolute -top-10 right-0 flex items-center gap-1 bg-gray-800 text-white px-2 py-1 rounded-md shadow-lg z-10"
                    onMouseDown={preventBlur} // 讓點工具列不會把焦點從可編輯區移走
                    onTouchStart={preventBlur}
                  >
                    {/* 複製 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); copyBlock(); }}
                      className="p-1 hover:bg-gray-700 rounded"
                      title="複製"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    {/* 鎖定/解鎖 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLock(); }}
                      className="p-1 hover:bg-gray-700 rounded"
                      title={block.locked ? "解鎖" : "鎖定"}
                    >
                      {block.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    </button>

                    {/* 刪除 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(); }}
                      className="p-1 hover:bg-red-600 rounded"
                      title="移除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* 文字區塊工具（簡約 ICON） */}
                    {block.type === 'text' && (
                      <>
                        <div className="w-px h-4 bg-gray-600 mx-1" />
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('bold', !(block as TextBlock).bold); }}
                          className="p-1 hover:bg-gray-700 rounded" title="粗體"
                        >
                          <Bold className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('italic', !(block as TextBlock).italic); }}
                          className="p-1 hover:bg-gray-700 rounded" title="斜體"
                        >
                          <Italic className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('underline', !(block as TextBlock).underline); }}
                          className="p-1 hover:bg-gray-700 rounded" title="底線"
                        >
                          <Underline className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('align','left'); }}
                          className="p-1 hover:bg-gray-700 rounded" title="靠左"
                        >
                          <AlignLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('align','center'); }}
                          className="p-1 hover:bg-gray-700 rounded" title="置中"
                        >
                          <AlignCenter className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); updateTextFormat('align','right'); }}
                          className="p-1 hover:bg-gray-700 rounded" title="靠右"
                        >
                          <AlignRight className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {/* 表格工具（簡約 ICON） */}
                    {block.type === 'table' && (
                      <>
                        <div className="w-px h-4 bg-gray-600 mx-1" />
                        <button
                          onClick={(e)=>{ e.stopPropagation(); addTableRow(); }}
                          className="p-1 hover:bg-gray-700 rounded" title="加列"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); removeTableRow(); }}
                          className="p-1 hover:bg-gray-700 rounded" title="減列"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); addTableColumn(); }}
                          className="p-1 hover:bg-gray-700 rounded" title="加欄"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); removeTableColumn(); }}
                          className="p-1 hover:bg-gray-700 rounded" title="減欄"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        {/* 有選中儲存格時，顯示底色與文字工具（作用在該 cell 的當前選取） */}
                        {selectedCellId && (
                          <>
                            <div className="w-px h-4 bg-gray-600 mx-1" />
                            {/* 儲存格底色（針對 body cell；header 不套） */}
                            {!selectedCellId.startsWith('header-') && (
                              <input
                                type="color"
                                className="w-5 h-5"
                                title="儲存格底色"
                                onChange={(evt) => {
                                  const color = evt.target.value;
                                  const tb = (selectedBlock as TableBlock);
                                  const [rStr, cStr] = selectedCellId.split('-');
                                  const r = Number(rStr), c = Number(cStr);
                                  if (Number.isNaN(r) || Number.isNaN(c)) return;

                                  const rows = tb.rows.map(row => [...row]);
                                  const current = rows[r][c] || '';
                                  // 用一個 div wrapper 記錄背景色；再次變更會覆蓋舊 wrapper
                                  const inner = current.replace(/<div data-cell-bg[^>]*>([\s\S]*?)<\/div>/, '$1');
                                  rows[r][c] = `<div data-cell-bg style="background:${color};padding:6px;">${inner}</div>`;
                                  updateBlock(block.id, { rows });
                                }}
                              />
                            )}

                            {/* 針對儲存格選取範圍的文字工具（使用 execCommand） */}
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('bold'); }} className="p-1 hover:bg-gray-700 rounded" title="粗體">
                              <Bold className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('italic'); }} className="p-1 hover:bg-gray-700 rounded" title="斜體">
                              <Italic className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('underline'); }} className="p-1 hover:bg-gray-700 rounded" title="底線">
                              <Underline className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyLeft'); }} className="p-1 hover:bg-gray-700 rounded" title="靠左">
                              <AlignLeft className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyCenter'); }} className="p-1 hover:bg-gray-700 rounded" title="置中">
                              <AlignCenter className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyRight'); }} className="p-1 hover:bg-gray-700 rounded" title="靠右">
                              <AlignRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </>
                    )}
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
                    onFocusIn={() => setIsEditing(true)}     // 新增
                    onFocusOut={() => setIsEditing(false)}   // 新增
                  />
                )}

                {block.type === 'table' && (
                  <div className="w-full h-full overflow-auto">
                    <table className="w-full h-full border-collapse">
                      {(block as TableBlock).headers.length > 0 && (
                        <thead>
                          <tr>
                            {(block as TableBlock).headers.map((header, colIndex) => (
                              <th
                                key={colIndex}
                                className="border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-left relative"
                                style={{
                                  width: `${(block as TableBlock).columnWidths?.[colIndex] ?? (100 / (block as TableBlock).headers.length)}%`
                                }}
                              >
                                <TableCell
                                  content={header}
                                  onChange={(newContent) => {
                                    const newHeaders = [...(block as TableBlock).headers];
                                    newHeaders[colIndex] = newContent;
                                    updateBlock(block.id, { headers: newHeaders });
                                  }}
                                  style={{ border: 'none', padding: 0, backgroundColor: 'transparent' }}
                                  vars={variables}
                                  isPreview={isPreview}
                                  isSelected={selectedCellId === `header-${colIndex}`}
                                  onClick={() => { setSelectedCellId(`header-${colIndex}`); setSelectedBlockId(block.id); }}
                                  onFocusIn={() => setIsEditing(true)}
                                  onFocusOut={() => setIsEditing(false)}
                                />

                                {!isPreview && colIndex < (block as TableBlock).headers.length - 1 && (
                                  <div
                                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                                    onMouseDown={(e) => startResizeColumn(e, block, colIndex)}
                                  />
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}

                      <tbody>
                        {(block as TableBlock).rows.map((row, rowIndex) => {
                          const colCount = row.length;
                          return (
                            <tr key={rowIndex}>
                              {row.map((cell, colIndex) => (
                                <td
                                  key={`${rowIndex}-${colIndex}`}
                                  className="relative"
                                  style={{ width: `${(block as TableBlock).columnWidths?.[colIndex] ?? (100 / colCount)}%` }}
                                >
                                  <TableCell
                                    content={cell}
                                    onChange={(newContent) => {
                                      const newRows = [...(block as TableBlock).rows];
                                      newRows[rowIndex][colIndex] = newContent;
                                      updateBlock(block.id, { rows: newRows });
                                    }}
                                    style={{}}
                                    vars={variables}
                                    isPreview={isPreview}
                                    isSelected={selectedCellId === `${rowIndex}-${colIndex}`}
                                    onClick={() => { setSelectedCellId(`${rowIndex}-${colIndex}`); setSelectedBlockId(block.id); }}
                                    onFocusIn={() => setIsEditing(true)}
                                    onFocusOut={() => setIsEditing(false)}
                                  />

                                  {/* 無表頭：第一列掛欄寬拖移手柄 */}
                                  {!isPreview && (block as TableBlock).headers.length === 0 && rowIndex === 0 && colIndex < row.length - 1 && (
                                    <div
                                      className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none" // ← select-none
                                      onMouseDown={(e) => startResizeColumn(e, block, colIndex)}
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
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
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
  Tag,
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

function extractCellBg(html: string): string | null {
  // data-cell-bg 的 inline style（你目前 color picker 寫入的結構）
  const m1 = html.match(/data-cell-bg[^>]*style="[^"]*background(?:-color)?\s*:\s*([^;"']+)/i);
  // 退而求其次，掃一般 style
  const m2 = html.match(/style="[^"]*background(?:-color)?\s*:\s*([^;"']+)/i);
  const raw = (m1?.[1] || m2?.[1] || '').trim();
  if (!raw) return null;
  if (raw.startsWith('#')) return raw;
  return cssColorToHex(raw);
}

// 把 'red'、'rgb(255,0,0)' 之類轉成 '#rrggbb'（提供給 <input type="color">）
function cssColorToHex(input: string): string {
  const probe = document.createElement('div');
  probe.style.color = input;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color; // e.g. "rgb(255, 0, 0)"
  document.body.removeChild(probe);
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#000000';
  const r = Number(m[1]).toString(16).padStart(2, '0');
  const g = Number(m[2]).toString(16).padStart(2, '0');
  const b = Number(m[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function isDark(hex: string) {
  const h = hex.replace('#','');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = (0.299*r + 0.587*g + 0.114*b) / 255; // 0~1
  return l < 0.5;
}


const EditableContent = React.forwardRef<HTMLDivElement, EditableContentProps>(({
  html,
  onCommit,
  readOnly,
  className,
  style,
  placeholder,
  onFocusIn,
  onFocusOut
}, forwardedRef) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastCommitted = useRef(html);

  // 讓外部可以 ref.current?.focus()
  useEffect(() => {
    if (!forwardedRef) return;
    if (typeof forwardedRef === 'function') forwardedRef(ref.current);
    else (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = ref.current;
  }, [forwardedRef]);

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
    if (isComposing) return;
  }, [isComposing]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing && e.key === "Enter") {
      e.preventDefault(); e.stopPropagation(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const el = ref.current;
      const saved = el ? saveSelection(el) : null;
      commit();
      requestAnimationFrame(() => { if (el) restoreSelection(el, saved); });
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      const isChip = (el: Node | null) => el instanceof HTMLElement && el.classList.contains("var-chip");

      let left: Node | null = null;
      let right: Node | null = null;

      if (node.nodeType === Node.TEXT_NODE) {
        left = (offset === 0) ? node.previousSibling : null;
        right = (offset === (node.nodeValue?.length ?? 0)) ? node.nextSibling : null;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        left = el.childNodes[offset - 1] ?? el.previousSibling;
        right = el.childNodes[offset] ?? el.nextSibling;
      }

      if (e.key === "Backspace" && isChip(left)) { (left as HTMLElement).remove(); e.preventDefault(); return; }
      if (e.key === "Delete" && isChip(right)) { (right as HTMLElement).remove(); e.preventDefault(); return; }
    }
  }, [commit, isComposing]);

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      tabIndex={0}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      className={className}
      style={{
        outline: "none",
        minHeight: 20,
        height: "100%",
        maxHeight: "100%",
        overflow: "visible",              // ← 不要卷軸，讓內容撐開
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style
      }}
      data-placeholder={placeholder || ""}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onFocus={() => onFocusIn?.()}
      onBlur={() => { commit(); onFocusOut?.(); }}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => {
        const el = ref.current;
        const saved = el ? saveSelection(el) : null;
        setIsComposing(false);
        commit();
        requestAnimationFrame(() => { if (el) restoreSelection(el, saved); });
      }}
      dangerouslySetInnerHTML={{ __html: lastCommitted.current || html || "" }}
      suppressContentEditableWarning
    />
  );
});




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
        height: "auto",
        maxHeight: "none",
        padding: "8px",
        border: "none",          // 移除虛線
        overflow: "visible",        // 超出時滾動
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
  onSelect: () => void;
}> = ({ content, onChange, style, vars, isPreview, isSelected, onSelect }) => {
  const previewHtml = React.useMemo(
    () => (isPreview ? renderWithVariables(content, vars) : content),
    [content, vars, isPreview]
  );

  const ecRef = useRef<HTMLDivElement>(null);
  const start = useRef<{x:number;y:number}|null>(null);
  const moved = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    // 不阻止冒泡 → Rnd 若有拖動會接手；若沒拖動，mouseUp 再聚焦編輯
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!start.current) return;
    const dx = Math.abs(e.clientX - start.current.x);
    const dy = Math.abs(e.clientY - start.current.y);
    if (dx > 3 || dy > 3) moved.current = true; // 3px 閾值
  };
  const onMouseUp = () => {
    if (!moved.current && !isPreview) {
      onSelect();
      requestAnimationFrame(() => ecRef.current?.focus());
    }
    start.current = null;
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        padding: "4px",
        minHeight: 24,
        height: "100%",
        cursor: isPreview ? "default" : "text",
        ...style,
        backgroundColor: 'transparent',
        outline: isSelected ? '2px solid #90caf9' : 'none',
        outlineOffset: 0,
      }}
    >
      <EditableContent
        ref={ecRef as any}
        html={isPreview ? previewHtml : content}
        readOnly={isPreview || !isSelected}
        onCommit={(html) => onChange(html)}
        style={{ lineHeight: "1.4", minHeight: 20, width: "100%", height: "100%" }}
      />
    </div>
  );
};

// Variable Tag Component
const VariableTag: React.FC<{
  label: string;
  color: string;
  onColorChange: (c:string)=>void;
  onInsert: () => void;
}> = ({ label, color, onColorChange, onInsert }) => {
  const dark = isDark(color);
  return (
    <div
      className="flex items-center justify-between border rounded-md p-2 transition-colors"
      style={{ backgroundColor: color, borderColor: '#00000022' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* 小色票（可改色） */}
        <div className="relative inline-flex items-center">
          <div className="w-5 h-5 rounded border border-white/50 overflow-hidden" />
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={color}
            onChange={(e)=>onColorChange(e.target.value)}
            title="標籤底色"
          />
        </div>
        <div className={`text-sm truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{label}</div>
      </div>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsert}
        className={`ml-2 px-2 py-1 rounded text-xs transition-colors flex-shrink-0 ${dark ? 'bg-white text-gray-800' : 'bg-gray-800 text-white'}`}
      >
        插入
      </button>
    </div>
  );
};




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
  const [varColors, setVarColors] = useState<Record<string,string>>({});

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
        let data: VariableDef[] = await res.json();
        // 排除
        data = (data || []).filter(v => !['階段狀態','階段順序'].includes(v.label));
        // 加入「當日」
        const today = new Date();
        const d = today.getDate(); // 無前導 0
        data.unshift({ key: 'today_day', label: '當日', value: String(d) });
        setVariables(data);
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
  e.preventDefault(); e.stopPropagation();
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
  if (nextIndex >= cols) return;

  let liveWidths = startWidths.slice();

  const onMouseMove = (moveEvt: MouseEvent) => {
    const deltaPx = moveEvt.clientX - startX;
    const deltaPct = (deltaPx / totalPx) * 100;

    let w1 = startWidths[colIndex] + deltaPct;
    let w2 = startWidths[nextIndex] - deltaPct;

    const MIN = 5;
    if (w1 < MIN) { w2 -= (MIN - w1); w1 = MIN; }
    if (w2 < MIN) { w1 -= (MIN - w2); w2 = MIN; }

    liveWidths = [...startWidths];
    liveWidths[colIndex] = w1;
    liveWidths[nextIndex] = w2;

    updateBlock(blk.id, { columnWidths: liveWidths });
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const sum = liveWidths.reduce((a,b)=>a+b,0) || 1;
    const norm = liveWidths.map(w => (w / sum) * 100);
    updateBlock(blk.id, { columnWidths: norm });
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};



const startResizeRow = (e: React.MouseEvent, blk: CanvasBlock, rowIndex: number) => {
  e.preventDefault();
  e.stopPropagation();
  if (blk.type !== 'table') return;

  const t = blk as TableBlock;
  const startY = e.clientY;

  // 目前各列高度（px）。若還沒建，先用每列 32px
  const rows = t.rows || [];
  const init = ((t as any).rowHeights as number[] | undefined) ?? new Array(rows.length).fill(32);

  const next = rowIndex + 1;
  let live = init.slice();

  // 以目前這兩列的總和來分配，確保拉一個、另一個跟著反向變化
  const sumPair = (init[rowIndex] ?? 32) + (init[next] ?? 32);

  const onMove = (mv: MouseEvent) => {
    const dy = mv.clientY - startY;
    let h1 = (init[rowIndex] ?? 32) + dy;
    let h2 = sumPair - h1;

    const MIN = 20;
    if (h1 < MIN) { h2 -= (MIN - h1); h1 = MIN; }
    if (h2 < MIN) { h1 -= (MIN - h2); h2 = MIN; }

    live = init.slice();
    live[rowIndex] = h1;
    live[next] = h2;

    updateBlock(blk.id, { ...(blk as any), rowHeights: live } as any);
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    updateBlock(blk.id, { ...(blk as any), rowHeights: live } as any);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};



const insertVariableToBlock = (payload: InsertVarPayload) => {
  const color = (varColors && varColors[payload.key]) || '#FFF3BF';
  const baseStyle = 'padding:2px 6px;border-radius:4px;display:inline-block;';
  const chipHtml = `<span class="var-chip" contenteditable="false" data-var-key="${payload.key}" style="${baseStyle}background-color:${color};">${payload.label}</span>`;

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
  const preventBlur = (e: React.SyntheticEvent) => {
    const target = e.target as HTMLElement;
    // 讓 input/select/textarea 正常工作（例如顏色選擇器）
    if (target.closest('input, select, textarea')) {
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
            {variables.length === 0 ? (
              <div className="text-sm text-gray-500 space-y-2">
                <div>目前沒有可用的變數。</div>
                <button
                  onClick={loadVariables}
                  className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                >
                  重新載入
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map(v => {
                  const color = varColors[v.key] || '#e6f0ff'; // 預設淡藍
                  return (
                    <VariableTag
                      key={v.key}
                      label={v.label || v.key}
                      color={color}
                      onColorChange={(c)=> setVarColors(s => ({...s, [v.key]: c}))}
                      onInsert={() => insertVariableToBlock({ key: v.key, label: v.label || v.key })}
                    />
                  );
                })}
              </div>
            )}
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

                        {/* 文字底色（深藍底容器，方塊顯示目前底色） */}
                          <div className="relative inline-flex items-center ml-1 rounded bg-[#334d6d] p-0.5" title="文字底色">
                            <div
                              className="w-5 h-5 rounded border border-white/30"
                              style={{ background: (block as TextBlock).backgroundColor || '#ffffff' }}
                            />
                            <input
                              type="color"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              value={(block as TextBlock).backgroundColor || '#ffffff'}
                              onChange={(e) => { e.stopPropagation(); updateTextFormat('backgroundColor', e.target.value); }}
                            />
                          </div>

                          {/* 文字體色（深藍底容器，方塊顯示目前字色） */}
                          <div className="relative inline-flex items-center ml-1 rounded bg-[#334d6d] p-0.5" title="文字體色">
                            <div
                              className="w-5 h-5 rounded border border-white/30"
                              style={{ background: (block as TextBlock).color || '#000000' }}
                            />
                            <input
                              type="color"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              value={(block as TextBlock).color || '#000000'}
                              onChange={(e) => { e.stopPropagation(); updateTextFormat('color', e.target.value); }}
                            />
                          </div>

                        {/* 字體大小 */}
                        <select
                          onChange={(e) => { e.stopPropagation(); updateTextFormat('fontSize', Number(e.target.value)); }}
                          value={(block as TextBlock).fontSize || 14}
                          className="text-xs bg-gray-700/50 rounded px-1 py-1 ml-1"
                        >
                          {[10,12,14,16,18,20,24,28,32].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
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

                    {/* 表格工具列（簡化版：欄/列群組 + 字體大小 + 儲存格底色同步） */}
                      {block.type === 'table' && (
                        <>
                          <div className="w-px h-4 bg-white/20 mx-1" />

                          {(() => {
                            const tb = selectedBlock as TableBlock;

                            // 取目前選到的 cell 底色（沒有就白色）
                            let cellBgHex = '#ffffff';
                            let canPaint = false;
                            let selR = -1, selC = -1;

                            if (selectedCellId && !selectedCellId.startsWith('header-')) {
                              const [rStr, cStr] = selectedCellId.split('-');
                              selR = Number(rStr);
                              selC = Number(cStr);
                              if (!Number.isNaN(selR) && !Number.isNaN(selC)) {
                                const html = tb.rows?.[selR]?.[selC] ?? '';
                                const found = extractCellBg(html);
                                if (found) cellBgHex = found;
                                canPaint = true;
                              }
                            }

                            const applyCellBg = (hex: string) => {
                              if (!canPaint) return;
                              const rows = tb.rows.map(row => [...row]);
                              const cur = rows[selR][selC] || '';
                              // 移除舊的 data-cell-bg wrapper，再包一次（你原本的策略）
                              const inner = cur.replace(/<div data-cell-bg[^>]*>([\s\S]*?)<\/div>/, '$1');
                              rows[selR][selC] = `<div data-cell-bg style="background:${hex};padding:6px;">${inner}</div>`;
                              updateBlock(block.id, { rows });
                            };

                            return (
                              <>
                                {/* 欄位群組：左 [+]｜「欄」字樣｜右 [-] */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); addTableColumn(); }}
                                    className="p-1 hover:bg-white/10 rounded"
                                    title="加欄"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs opacity-80 px-1 select-none">欄</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeTableColumn(); }}
                                    className="p-1 hover:bg-white/10 rounded"
                                    title="減欄"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* 列群組：左 [+]｜「列」字樣｜右 [-] */}
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); addTableRow(); }}
                                    className="p-1 hover:bg-white/10 rounded"
                                    title="加列"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs opacity-80 px-1 select-none">列</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeTableRow(); }}
                                    className="p-1 hover:bg-white/10 rounded"
                                    title="減列"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="w-px h-4 bg-white/20 mx-2" />

                                {/* 字體大小（整張表） */}
                                <label className="flex items-center gap-1 text-xs">
                                  <span className="opacity-80 select-none">字體</span>
                                  <select
                                    value={(tb as any).fontSize ?? 14}
                                    onChange={(e) => {
                                      const size = parseInt(e.target.value, 10) || 14;
                                      updateBlock(block.id, { ...(tb as any), fontSize: size } as any);
                                    }}
                                    className="bg-white text-gray-800 rounded px-1 py-0.5 text-xs outline-none"
                                    onMouseDown={preventBlur}
                                  >
                                    {[12, 13, 14, 16, 18, 20, 22, 24].map(sz => (
                                      <option key={sz} value={sz}>{sz}</option>
                                    ))}
                                  </select>
                                </label>

                                {/* 儲存格底色（跟著目前 cell 顏色同步顯示／修改） */}
                                <div className="flex items-center gap-1 ml-2">
                                  <span className="text-xs opacity-80 select-none">底色</span>
                                  <div
                                    className="rounded px-1 py-0.5"
                                    style={{ background: 'rgba(255,255,255,0.1)' }} // 深藍工具列上的淡遮色
                                  >
                                    <input
                                      type="color"
                                      className="w-5 h-5 block border-0 p-0 bg-transparent cursor-pointer"
                                      value={cellBgHex}
                                      disabled={!canPaint}
                                      title={canPaint ? '儲存格底色' : '請先選取一個儲存格'}
                                      onChange={(evt) => applyCellBg(evt.target.value)}
                                      onMouseDown={preventBlur}
                                    />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}


                        {block.type === 'table' && selectedCellId && (
                          <>
                            <div className="w-px h-4 bg-white/20 mx-2" />
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('bold'); }} className="p-1 hover:bg-white/10 rounded" title="粗體">
                              <Bold className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('italic'); }} className="p-1 hover:bg-white/10 rounded" title="斜體">
                              <Italic className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('underline'); }} className="p-1 hover:bg-white/10 rounded" title="底線">
                              <Underline className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyLeft'); }} className="p-1 hover:bg-white/10 rounded" title="靠左">
                              <AlignLeft className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyCenter'); }} className="p-1 hover:bg-white/10 rounded" title="置中">
                              <AlignCenter className="w-3 h-3" />
                            </button>
                            <button onClick={(e)=>{ e.stopPropagation(); cellExec('justifyRight'); }} className="p-1 hover:bg-white/10 rounded" title="靠右">
                              <AlignRight className="w-3 h-3" />
                            </button>
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
                  <div className="w-full h-full overflow-visible">
                    {(() => {
                      const tb = block as TableBlock;
                      const borders = tb.showBorders;
                      return (
                        <table
                            className={`w-full h-full border-collapse ${borders ? 'border border-gray-300' : ''}`}
                            style={{ fontSize: (tb as any).fontSize ?? 14 }}
                           >
                          {tb.headers.length > 0 && (
                            <thead>
                              <tr>
                                {tb.headers.map((header, colIndex) => (
                                  <th
                                    key={colIndex}
                                    className={`${borders ? 'border border-gray-300' : ''} p-2 text-sm font-medium text-left relative`}
                                    style={{
                                      width: `${tb.columnWidths?.[colIndex] ?? (100 / tb.headers.length)}%`,
                                      // 讓表頭也能吃整格底色；沒有設定時就不覆蓋
                                      backgroundColor: extractCellBg(header) || undefined,
                                    }}
                                  >
                                    <TableCell
                                      content={header}
                                      onChange={(newContent) => {
                                        const newHeaders = [...tb.headers];
                                        newHeaders[colIndex] = newContent;
                                        updateBlock(block.id, { headers: newHeaders });
                                      }}
                                      style={{}}
                                      vars={variables}
                                      isPreview={isPreview}
                                      isSelected={selectedCellId === `header-${colIndex}`}
                                      onSelect={() => {
                                        setSelectedCellId(`header-${colIndex}`);
                                        setSelectedBlockId(block.id);
                                        setIsEditing(true);
                                      }}
                                    />

                                    {!isPreview && colIndex < tb.headers.length - 1 && (
                                      <div
                                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
                                        onMouseDown={(e) => startResizeColumn(e, block, colIndex)}
                                      />
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}


                          <tbody>
                          {tb.rows.map((row, rowIndex) => {
                            const colCount = row.length;
                            const rowH = (tb as any).rowHeights?.[rowIndex]; // px 或 undefined
                            return (
                              <tr key={rowIndex} style={{ height: rowH ? `${rowH}px` : undefined }}>
                                {row.map((cell, colIndex) => {
                                  const cellId = `${rowIndex}-${colIndex}`;
                                  const selected = selectedCellId === cellId;
                                  return (
                                    <td
                                      key={cellId}
                                      className={`relative ${borders ? 'border border-gray-300' : ''}`}
                                      style={{
                                        width: `${tb.columnWidths?.[colIndex] ?? (100 / colCount)}%`,
                                        backgroundColor: extractCellBg(cell) || undefined,   // ← 整格底色
                                      }}
                                    >
                                      <TableCell
                                        content={cell}
                                        onChange={(newContent) => {
                                          const newRows = [...tb.rows];
                                          newRows[rowIndex] = [...newRows[rowIndex]];
                                          newRows[rowIndex][colIndex] = newContent;
                                          updateBlock(block.id, { rows: newRows });
                                        }}
                                        style={{}}
                                        vars={variables}
                                        isPreview={isPreview}
                                        isSelected={selected}
                                        onSelect={() => { setSelectedCellId(cellId); setSelectedBlockId(block.id); setIsEditing(true); }}
                                      />

                                      {/* 垂直把手 */}
                                      {!isPreview && (
                                        (selected || (tb.headers.length === 0 && rowIndex === 0)) && colIndex < row.length - 1 && (
                                          <div
                                            className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
                                            onMouseDown={(e) => startResizeColumn(e, block, colIndex)}
                                          />
                                        )
                                      )}

                                      {/* 水平把手 */}
                                      {!isPreview && rowIndex < tb.rows.length - 1 && (
                                        (selected || colIndex === 0) && (
                                          <div
                                            className="absolute bottom-0 left-0 w-full h-2 cursor-row-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
                                            onMouseDown={(e) => startResizeRow(e, block, rowIndex)}
                                          />
                                        )
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>

                        </table>
                      );
                    })()}
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
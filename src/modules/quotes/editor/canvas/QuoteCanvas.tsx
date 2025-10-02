import DOMPurify from 'dompurify';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import {
  Type, Table, Eye, EyeOff, Download, Trash2, Copy,
  Lock, Unlock, Bold, Italic, Underline, AlignLeft,
  AlignCenter, AlignRight, Plus, Minus, Settings,
  ChevronDown, X, Tag,
} from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../../../../utils/api';
import type { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from './schema';

// ===== Snap / Bounds helpers =====
const SNAP_TOLERANCE = 6; // 吸附容忍距離（px）
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const round = (v: number) => Math.round(v);
const snapToStep = (v: number, step: number) => round(v / step) * step;

// ✅ 在這裡加入（imports 之後、helpers 附近最清楚）
const MIN_CELL_PX = 10; // 欄寬最小 & 列高最小 一致
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
  if (!html) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // 只認 data-cell-bg 容器，不掃其他內層元素
  const holder = wrap.querySelector('[data-cell-bg]') as HTMLElement | null;
  if (!holder) return null;

  const inline = holder.getAttribute('style') || '';
  const m = inline.match(/background-color\s*:\s*([^;]+)/i);
  const raw = m?.[1]?.trim() || '';
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

// ---- HTML sanitize helper（集中設定允許的標籤與屬性）----
const sanitizeHtml = (dirty: string) => {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b','i','u','br','div','span','p','strong','em',
      'ul','ol','li',
      'table','thead','tbody','tr','th','td','colgroup','col',
      'a'
    ],
    ALLOWED_ATTR: [
      'style','data-var-key','contenteditable',
      'href','target','rel'
    ],
    FORBID_ATTR: [
      'onerror','onload','onclick','onmouseover','onfocus','onblur'
    ],
  });

  // 事後補 rel，避免 target="_blank" 的安全性問題
  const wrap = document.createElement('div');
  wrap.innerHTML = clean;
  wrap.querySelectorAll('a[target="_blank"]:not([rel])').forEach(a => {
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return wrap.innerHTML;
};


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
      const clean = sanitizeHtml(html || "");
      el.innerHTML = clean;
      lastCommitted.current = clean;
    }
  }, [html, readOnly]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const dirty = el.innerHTML;
    const clean = sanitizeHtml(dirty);
    if (clean !== lastCommitted.current) {
      lastCommitted.current = clean;
      onCommit(clean);
    }
  }, [onCommit]);

  const onInput = useCallback(() => {
  if (isComposing) return;
  // 保留選取
  const el = ref.current;
  const saved = el ? saveSelection(el) : null;

  // 立即 sanitize 並 commit（避免需要 blur 才同步到 state）
  if (el) {
    const dirty = el.innerHTML;
    const clean = sanitizeHtml(dirty);
    if (clean !== lastCommitted.current) {
      lastCommitted.current = clean;
      onCommit(clean);
    }
  }

  // 下一禎恢復 caret（避免輸入斷點跑掉）
  requestAnimationFrame(() => {
    if (el) restoreSelection(el, saved);
  });
}, [isComposing, onCommit]);

// ⬇️ 插在 onInput 後面、return JSX 之前
const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
  if (readOnly) return;

  const isMac = /mac/i.test(navigator.platform);
  const meta = isMac ? e.metaKey : e.ctrlKey;

  // Cmd/Ctrl + B / I / U
  if (meta && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
    if (k === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
    if (k === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
  }

  // Tab：避免跳焦點，改成插入兩個空白
  if (e.key === 'Tab') {
    e.preventDefault();
    insertHtmlAtCaret('&nbsp;&nbsp;');
    const el = ref.current;
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // Escape：離開編輯
  if (e.key === 'Escape') {
    (e.currentTarget as HTMLDivElement).blur();
  }
}, [readOnly]);

const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
  if (readOnly) return;
  e.preventDefault();

  // 取用者貼上內容（html 優先，其次純文字），且立刻 sanitize
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  const safe = sanitizeHtml(html || (text ? text.replace(/\n/g, '<br>') : ''));

  // 插到目前 caret
  insertHtmlAtCaret(safe);

  // 觸發 input，讓外層 onCommit 能即時拿到變更
  const el = ref.current;
  if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
}, [readOnly]);


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
        overflow: "visible",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style
      }}
      data-placeholder={placeholder || ""}
      onInput={onInput}
      onKeyDown={onKeyDown}   // ← 這行你原本就有，但之前沒有實作
      onPaste={onPaste}       // ← 這行是新加的
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
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(lastCommitted.current || html || "") }}
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
  const minTextH = Math.max(24, Math.ceil((((style as any)?.fontSize ?? 14) as number) * 1.6));
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
        minHeight: minTextH,
        height: "auto",
        maxHeight: "none",
        padding: "4px",            // ← 8px → 4px
        border: "none",
        overflow: "hidden",
        borderRadius: 6,
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
  onSelect: (e?: React.MouseEvent) => void;
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
  const onMouseUp = (e: React.MouseEvent) => {
    if (!moved.current && !isPreview) {
      onSelect?.(e);
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
        height: "auto",          // ← 改這行
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
        style={{ lineHeight: "1.4", minHeight: 20, width: "100%", height: "auto" }}
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
      className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:shadow-sm cursor-pointer border border-transparent hover:border-gray-200"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative inline-flex items-center flex-shrink-0">
          <div className="w-5 h-5 rounded-md border border-white/30 overflow-hidden shadow-sm" />
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={color}
            onChange={(e)=>onColorChange(e.target.value)}
            title="標籤底色"
          />
        </div>
        <div className={`text-xs font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{label}</div>
      </div>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsert}
        className={`ml-2 p-1.5 rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 ${dark ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-900/10 hover:bg-gray-900/20 text-gray-800'}`}
        title="插入"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Mini glyphs for border & vertical align ────────────────────────────────
const BOX_BORDER = "border-gray-400";
const GLYPH = "bg-gray-700";
const BorderGlyph: React.FC<{ t?: boolean; r?: boolean; b?: boolean; l?: boolean; className?: string }> = ({ t, r, b, l, className }) => (
  <span className={`inline-block w-4 h-4 relative ${className || ''}`}>
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    {t && <span className={`absolute left-0 right-0 top-0 h-[2px] ${GLYPH}`} />}
    {r && <span className={`absolute right-0 top-0 bottom-0 w-[2px] ${GLYPH}`} />}
    {b && <span className={`absolute left-0 right-0 bottom-0 h-[2px] ${GLYPH}`} />}
    {l && <span className={`absolute left-0 top-0 bottom-0 w-[2px] ${GLYPH}`} />}
  </span>
);

const BorderOuterGlyph = () => <BorderGlyph t r b l />;
const BorderTopGlyph = () => <BorderGlyph t />;
const BorderBottomGlyph = () => <BorderGlyph b />;
const BorderLeftGlyph = () => <BorderGlyph l />;
const BorderRightGlyph = () => <BorderGlyph r />;
const BorderNoneGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    <span className={`absolute -rotate-45 left-[1px] right-[1px] top-1/2 h-[2px] ${GLYPH}`} />
  </span>
);
const BorderInnerGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    <span className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[2px] ${GLYPH}`} />
    <span className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-[2px] ${GLYPH}`} />
  </span>
);

// 垂直對齊小圖示
const VAlignTopGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    <span className={`absolute left-1 right-1 top-1 h-[2px] ${GLYPH}`} />
    <span className={`absolute left-1 right-1 top-[6px] h-[2px] ${GLYPH} opacity-60`} />
  </span>
);
const VAlignMiddleGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    <span className={`absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[2px] ${GLYPH}`} />
  </span>
);

const ColsGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className="absolute inset-0 rounded-sm border border-gray-400" />
    <span className="absolute top-1 bottom-1 left-[6px] w-[2px] bg-gray-700" />
    <span className="absolute top-1 bottom-1 right-[6px] w-[2px] bg-gray-700" />
  </span>
);

const RowsGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className="absolute inset-0 rounded-sm border border-gray-400" />
    <span className="absolute left-1 right-1 top-[6px] h-[2px] bg-gray-700" />
    <span className="absolute left-1 right-1 bottom-[6px] h-[2px] bg-gray-700" />
  </span>
);


const VAlignBottomGlyph: React.FC = () => (
  <span className="inline-block w-4 h-4 relative">
    <span className={`absolute inset-0 rounded-sm border ${BOX_BORDER}`} />
    <span className={`absolute left-1 right-1 bottom-1 h-[2px] ${GLYPH}`} />
    <span className={`absolute left-1 right-1 bottom-[6px] h-[2px] ${GLYPH} opacity-60`} />
  </span>
);

const HoverAddRemove: React.FC<{
  title: string;
  glyph: React.ReactNode;
  onAdd: () => void;
  onRemove: () => void;
}> = ({ title, glyph, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // 40ms 幾乎立即、仍避免抖動
    timeoutRef.current = setTimeout(() => setOpen(false), 40);
  };


  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e)=>{ e.stopPropagation(); }}
    >
      {/* + 按鈕在上方（絕對定位，懸浮） */}
      {open && (
        <button
          className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-800 transition-all z-[10001]"
          onClick={(e)=>{ e.stopPropagation(); onAdd(); }}
          onMouseEnter={handleMouseEnter}
          title={`${title} +`}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}

      {/* 中間的主按鈕 */}
      <button className="p-1 rounded hover:bg-gray-100 transition-colors" title={title}>
        {glyph}
      </button>

      {/* - 按鈕在下方（絕對定位，懸浮） */}
      {open && (
        <button
          className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-800 transition-all z-[10001]"
          onClick={(e)=>{ e.stopPropagation(); onRemove(); }}
          onMouseEnter={handleMouseEnter}
          title={`${title} -`}
        >
          <Minus className="w-3 h-3" />
        </button>
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
  const [selectedRange, setSelectedRange] = useState<{
    start?: { r: number; c: number };
    end?: { r: number; c: number };
  } | null>(null);

  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [borderThickness, setBorderThickness] = useState(1);
  const [borderColor, setBorderColor] = useState('#000000');      // 框線顏色（預設黑）
  const [showAlignMenu, setShowAlignMenu] = useState(false);      // 對齊群組面板
  const [lastTableTextColor, setLastTableTextColor] = useState('#000000'); // 表格文字體色顯示用
  const [lastTextColor, setLastTextColor] = useState('#000000');
  const [lastTextBgColor, setLastTextBgColor] = useState('#ffffff'); // 文字背景色

  // ===== 即時拖曳/縮放暫存（不打擾父層 onChange 頻率） =====
  const livePosRef  = useRef<Record<string, { x: number; y: number }>>({});
  const liveSizeRef = useRef<Record<string, { w: number; h: number }>>({});
  const liveColsPxRef = useRef<Record<string, number[]>>({});
  const liveRowsHeightRef = useRef<Record<string, number[]>>({});
  const [liveTick, setLiveTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const invalidate = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setLiveTick((t) => t + 1);
    });
  };

  // === 取得欄寬(px)與計算表格外框最小寬（要讀取 liveColsPxRef，所以放在 component 內） ===
  const getColPxArray = useCallback((tb: TableBlock, liveKey: string) => {
    const live = liveColsPxRef.current[liveKey];
    if (live && live.length) return live.slice();

    const saved = ((tb as any).columnWidthsPx as number[] | undefined) ?? [];
    if (saved.length) return saved.slice();

    const cols = tb.headers.length || (tb.rows[0]?.length ?? 1);
    return new Array(Math.max(cols, 1)).fill(120); // 給合理預設寬
  }, []);

  const getTableMinWidth = useCallback((tb: TableBlock, liveKey: string): number => {
    const arr = getColPxArray(tb, liveKey);
    const sum = arr.reduce((a, b) => a + (b || 0), 0);
    const pad = tb.showBorders ? (arr.length + 1) : 0; // 邊框微量緩衝
    return Math.max(sum + pad, 100);
  }, [getColPxArray]);


  useEffect(() => {
    setShowBorderMenu(false);
    setShowAlignMenu(false);
  }, [selectedBlockId, isPreview, isEditing]);

  useEffect(() => {
    if (!showAlignMenu && !showBorderMenu) return;

    const onDown = (ev: MouseEvent) => {
      setShowAlignMenu(false);
      setShowBorderMenu(false);
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAlignMenu, showBorderMenu]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const blk = value.blocks.find(b => b.id === selectedBlockId);
    if (!blk || blk.type !== 'text' || !isEditing) return;

    const readCurrentColor = () => {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode as Node | null;
      const el = (node && (node.nodeType === 1 ? (node as HTMLElement) : node.parentElement)) || null;
      if (!el) return;
      const computed = getComputedStyle(el).color;
      setLastTextColor(cssColorToHex(computed));

      // 同時讀取背景色
      const bgColor = getComputedStyle(el).backgroundColor;
      // 如果是透明或 rgba(0,0,0,0)，使用白色
      if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
        setLastTextBgColor('#ffffff');
      } else {
        setLastTextBgColor(cssColorToHex(bgColor));
      }
    };

    readCurrentColor();
    document.addEventListener('selectionchange', readCurrentColor);
    return () => document.removeEventListener('selectionchange', readCurrentColor);
  }, [selectedBlockId, isEditing, value.blocks]);


  useEffect(() => {
    // 只在選到表格區塊時才處理
    if (!selectedBlockId) return;
    const blk = value.blocks.find(b => b.id === selectedBlockId);
    if (!blk || blk.type !== 'table') return;

    const readCurrentColor = () => {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;

      // 取目前 caret 所在節點（沒有就用父元素）
      const node = sel.anchorNode as Node | null;
      const el =
        (node && (node.nodeType === 1 ? (node as HTMLElement) : node.parentElement)) ||
        null;
      if (!el) return;

      const computed = getComputedStyle(el).color; // e.g. "rgb(34, 34, 34)"
      setLastTableTextColor(cssColorToHex(computed));
    };

    // 1) 進入/切換 cell 先讀一次
    readCurrentColor();

    // 2) caret 在同一格內移動或變動時也更新
    document.addEventListener('selectionchange', readCurrentColor);
    return () => document.removeEventListener('selectionchange', readCurrentColor);
  }, [selectedBlockId, selectedCellId, isEditing, value.blocks]);



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

        // 直接移除任何與「階段」的「狀態 / 順序」變數
        data = (data || []).filter(v => {
          const s = `${v.label || ''}${v.key || ''}`;
          const hasStateOrOrder = /狀態|順序/i.test(v.label || '');
          const isStage = /階段|stage/i.test(s);
          return !(hasStateOrOrder && isStage);
        });

        // 加入「當日」
        const today = new Date();
        const d = today.getDate();
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
  const newBlock: TableBlock & { columnWidthsPx?: number[] } = {
    id: `table-${Date.now()}`,
    type: 'table',
    x: 50,
    y: 150,
    w: 400,
    h: 200,
    headers: [],                      // 無表頭
    rows: [['', '', '']],             // 1 列 3 欄
    showBorders: true,
    columnWidthsPx: [120, 160, 120],  // ← 直接用 px
  };

  onChange({
    ...value,
    blocks: [...value.blocks, newBlock as TableBlock]
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

  const maxWidth = blk.w || 600;                   // 外框當最大寬
  const borderPadding = table.showBorders ? 2 : 0; // 邊框微誤差
  const availableWidth = maxWidth - borderPadding;

  const cols = Math.max(
    (table as any).columnWidthsPx?.length || 0,
    table.headers.length || (table.rows[0]?.length || 1)
  );

  // 起始欄寬（px），若無就平均分掉可用寬
  const startPxArr: number[] = (() => {
    const arr = (table as any).columnWidthsPx as number[] | undefined;
    if (arr && arr.length === cols) return arr.slice();
    return new Array(cols).fill(Math.max(MIN_CELL_PX, availableWidth / cols));
  })();

  const startX = e.clientX;
  const startW = startPxArr[colIndex];

  let live = startPxArr.slice();
  let rafId: number | null = null;

  const onMove = (mv: MouseEvent) => {
    const dx = mv.clientX - startX;
    let newW = startW + dx;
    if (newW < MIN_CELL_PX) newW = MIN_CELL_PX;

    const other = startPxArr.reduce((s, w, i) => i === colIndex ? s : s + w, 0);
    const maxAllowed = availableWidth - other;
    if (newW > maxAllowed) newW = Math.max(MIN_CELL_PX, maxAllowed);

    live = startPxArr.slice();
    live[colIndex] = newW;

    liveColsPxRef.current[blk.id] = live.slice();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(invalidate);
  };

  const onUp = () => {
    if (rafId) cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    const finalColWidths = liveColsPxRef.current[blk.id] ?? live;
    updateBlock(blk.id, { ...(blk as any), columnWidthsPx: finalColWidths } as any);
    delete liveColsPxRef.current[blk.id];
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

const startResizeRow = (e: React.MouseEvent, blk: CanvasBlock, rowIndex: number) => {
  e.preventDefault(); e.stopPropagation();
  if (blk.type !== 'table') return;
  const t = blk as TableBlock;

  const maxHeight = blk.h || 300;                 // 外框當最大高
  const rows = t.rows || [];
  const rowCount = Math.max(1, rows.length);

  // 初始各列高（若未存，平均分掉外框高）
  const init: number[] = (() => {
    const saved = (t as any).rowHeights as number[] | undefined;
    if (saved && saved.length === rowCount) return saved.slice();
    const base = Math.max(MIN_CELL_PX, maxHeight / rowCount);
    return new Array(rowCount).fill(base);
  })();

  // 確保合計不超過外框（初次亦對齊）
  let total = init.reduce((s, h) => s + h, 0);
  if (total !== maxHeight) {
    const ratio = maxHeight / total;
    for (let i = 0; i < init.length; i++) init[i] = Math.max(MIN_CELL_PX, init[i] * ratio);
    // 因為最小值夾住可能造成誤差，再次校正最後一列
    const sum = init.reduce((s, h) => s + h, 0);
    init[init.length - 1] += (maxHeight - sum);
  }

  const startY = e.clientY;
  const startH = init[rowIndex];

  let live = init.slice();
  let rafId: number | null = null;

  const onMove = (mv: MouseEvent) => {
    const dy = mv.clientY - startY;
    let newH = startH + dy;
    if (newH < MIN_CELL_PX) newH = MIN_CELL_PX;

    // 其他列總高
    const otherSum = init.reduce((s, h, i) => i === rowIndex ? s : s + h, 0);
    const maxAllowed = maxHeight - otherSum;
    if (newH > maxAllowed) newH = Math.max(MIN_CELL_PX, maxAllowed);

    live = init.slice();
    live[rowIndex] = newH;

    liveRowsHeightRef.current[blk.id] = live.slice();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(invalidate);
  };

  const onUp = () => {
    if (rafId) cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    const finalHeights = liveRowsHeightRef.current[blk.id] ?? live;
    updateBlock(blk.id, { ...(t as any), rowHeights: finalHeights } as any);
    delete liveRowsHeightRef.current[blk.id];
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};



const recolorHtmlForKey = useCallback((html: string, key: string, color: string) => {
  if (!html) return html;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll(`span.var-chip[data-var-key="${key}"]`).forEach((el) => {
    const node = el as HTMLElement;
    const prev = node.getAttribute('style') || '';
    const next = /background-color\s*:\s*[^;]+/i.test(prev)
      ? prev.replace(/background-color\s*:\s*[^;]+/i, `background-color:${color}`)
      : `${prev};background-color:${color}`;
    node.setAttribute('style', next);
  });
  return wrap.innerHTML;
}, []);


const handleVarColorChange = useCallback((key: string, color: string) => {
  setVarColors(s => ({ ...s, [key]: color }));

  const newBlocks = value.blocks.map(b => {
    if (b.type === 'text') {
      const t = b as TextBlock;
      return { ...t, text: recolorHtmlForKey(t.text, key, color) } as CanvasBlock;
    }
    if (b.type === 'table') {
      const t = b as TableBlock;
      const headers = (t.headers || []).map(h => recolorHtmlForKey(h, key, color));
      const rows = (t.rows || []).map(row => row.map(cell => recolorHtmlForKey(cell, key, color)));
      return { ...t, headers, rows } as CanvasBlock;
    }
    return b;
  });

  onChange({ ...value, blocks: newBlocks });
}, [onChange, recolorHtmlForKey, value]);

const insertVariableToBlock = (payload: InsertVarPayload) => {
  // 確保變數顏色已初始化
  const color = varColors[payload.key] || '#e6f0ff';
  if (!varColors[payload.key]) {
    setVarColors(prev => ({ ...prev, [payload.key]: color }));
  }

  const baseStyle = 'padding:2px 6px;border-radius:4px;display:inline-block;';
  const chipHtml = `<span class="var-chip" contenteditable="false" data-var-key="${payload.key}" style="${baseStyle}background-color:${color};">${payload.label}</span>`;

  // 嘗試在當前光標位置插入
  if (insertHtmlAtCaret(chipHtml)) {
    // 成功插入後，觸發當前編輯區域的 commit 來更新狀態
    // 這確保預覽模式能立即看到變數
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const container = sel.getRangeAt(0).commonAncestorContainer;
      const editableEl = (container.nodeType === 1 ? container : container.parentElement)?.closest('[contenteditable="true"]') as HTMLElement;
      if (editableEl) {
        // 觸發 input 事件來提交更改
        editableEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return;
  }

  // 如果沒有光標位置，回退到附加到選中的區塊
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

    // 內容
    const nextHeaders = t.headers.length ? [...t.headers, ''] : t.headers;
    const nextRows = t.rows.map(r => [...r, '']);

    // 欄寬（px）— 保持舊欄不變，新欄給預設寬
    const pxArr = ((t as any).columnWidthsPx as number[] | undefined)?.slice() || [];
    const DEFAULT_PX = 120;
    while (pxArr.length < cols) pxArr.push(DEFAULT_PX);
    pxArr.push(DEFAULT_PX); // 新增一欄的預設寬

    updateBlock(t.id, { ...(t as any), headers: nextHeaders, rows: nextRows, columnWidthsPx: pxArr } as any);


  };



  const removeTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const t = selectedBlock as TableBlock;

    const cols = Math.max(t.headers.length, t.rows[0]?.length || 0);
    if (cols <= 1) return;

    const nextCols = cols - 1;

    const nextHeaders = t.headers.length ? t.headers.slice(0, -1) : t.headers;
    const nextRows = t.rows.map(r => r.slice(0, -1));

    // 欄寬（px）— 直接去掉最後一欄，不重算其他欄
    const pxArr = ((t as any).columnWidthsPx as number[] | undefined)?.slice() || [];
    const trimmed = pxArr.slice(0, nextCols);

    updateBlock(t.id, { ...(t as any), headers: nextHeaders, rows: nextRows, columnWidthsPx: trimmed } as any);

  };

  // === 浮動工具列輔助：避免點工具列時 contentEditable 失焦、讓 execCommand 作用在當前選取 ===
  const preventBlur = (e: React.SyntheticEvent) => {
    // 總是阻止默認行為和冒泡，確保不會失去焦點
    e.preventDefault();
    e.stopPropagation();
  };

  const cellExec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

    // 取得目前選取的矩形範圍內所有 cell
  const getRangeCells = useCallback((tb: TableBlock) => {
    if (!selectedRange?.start || !selectedRange?.end) return [];
    const r1 = Math.min(selectedRange.start.r, selectedRange.end.r);
    const r2 = Math.max(selectedRange.start.r, selectedRange.end.r);
    const c1 = Math.min(selectedRange.start.c, selectedRange.end.c);
    const c2 = Math.max(selectedRange.start.c, selectedRange.end.c);
    const cells: Array<{r:number;c:number}> = [];
    for (let r=r1; r<=r2; r++) for (let c=c1; c<=c2; c++) cells.push({r,c});
    return cells;
  }, [selectedRange]);

  // 垂直對齊（top/middle/bottom）
  const applyVerticalAlign = (val: 'top'|'middle'|'bottom') => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tb = selectedBlock as TableBlock;
    const cells = getRangeCells(tb);
    const map = { ...( (tb as any).vAlignMap || {} ) } as Record<string,string>;
    cells.forEach(({r,c}) => { map[`${r}-${c}`] = val; });
    updateBlock(tb.id, { ...(tb as any), vAlignMap: map } as any);
  };

  // 框線：上/下/左/右/外框/內框/無 + 粗細
  type BorderSpec = { t?: number; r?: number; b?: number; l?: number; color?: string };

  const applyBorders = (mode: 'top'|'bottom'|'left'|'right'|'outer'|'inner'|'none', thickness: number) => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tb = selectedBlock as TableBlock;
    const cells = getRangeCells(tb);
    if (cells.length === 0) return;

    const r1 = Math.min(...cells.map(c=>c.r));
    const r2 = Math.max(...cells.map(c=>c.r));
    const c1 = Math.min(...cells.map(c=>c.c));
    const c2 = Math.max(...cells.map(c=>c.c));

    const map = { ...((tb as any).cellBorderMap || {}) } as Record<string, BorderSpec>;
    const edgeColor = borderColor || '#000000';

    const hasEdge = (r:number,c:number,edge:keyof BorderSpec,need:number) => {
      const cur = map[`${r}-${c}`];
      return !!cur && cur[edge] === need;
    };
    const setEdge = (r:number,c:number,edge:keyof BorderSpec,val:number|undefined) => {
      const k = `${r}-${c}`;
      const cur = map[k] || {};
      if (val === undefined || val === 0) delete cur[edge];
      else cur[edge] = val;
      if (Object.keys(cur).length === 0) delete map[k];
      else {
        cur.color = edgeColor;
        map[k] = cur;
      }
    };

    if (mode === 'none') {
      cells.forEach(({r,c}) => { delete map[`${r}-${c}`]; });
      updateBlock(tb.id, { ...(tb as any), cellBorderMap: map } as any);
      return;
    }

    const applySimple = (edge: keyof BorderSpec) => {
      const allOn = cells.every(({r,c}) => hasEdge(r,c,edge, thickness));
      const nextVal = allOn ? undefined : thickness;
      cells.forEach(({r,c}) => setEdge(r,c, edge, nextVal));
    };

    if (mode === 'top')    applySimple('t');
    if (mode === 'bottom') applySimple('b');
    if (mode === 'left')   applySimple('l');
    if (mode === 'right')  applySimple('r');

    if (mode === 'outer') {
      // 全外框都已存在？
      const allOn =
        cells.every(({r,c}) => {
          const isTop = r===r1, isBottom = r===r2, isLeft = c===c1, isRight = c===c2;
          return (!isTop    || hasEdge(r,c,'t',thickness)) &&
                (!isBottom || hasEdge(r,c,'b',thickness)) &&
                (!isLeft   || hasEdge(r,c,'l',thickness)) &&
                (!isRight  || hasEdge(r,c,'r',thickness));
        });
      const next = allOn ? undefined : thickness;
      for (let r=r1;r<=r2;r++) for (let c=c1;c<=c2;c++) {
        if (r===r1) setEdge(r,c,'t',next);
        if (r===r2) setEdge(r,c,'b',next);
        if (c===c1) setEdge(r,c,'l',next);
        if (c===c2) setEdge(r,c,'r',next);
      }
    }

    if (mode === 'inner') {
      // 判斷內框是否全部都有（用下/右判斷 + 對應的上/左）
      const innerCells: Array<{r:number;c:number;edge:keyof BorderSpec}> = [];
      for (let r=r1; r<=r2; r++) for (let c=c1; c<=c2; c++) {
        if (r<r2) innerCells.push({r,c,edge:'b'});
        if (c<c2) innerCells.push({r,c,edge:'r'});
        if (r>r1) innerCells.push({r,c,edge:'t'});
        if (c>c1) innerCells.push({r,c,edge:'l'});
      }
      const allOn = innerCells.every(({r,c,edge}) => hasEdge(r,c,edge,thickness));
      const next = allOn ? undefined : thickness;

      for (let r=r1; r<=r2; r++) for (let c=c1; c<=c2; c++) {
        if (r<r2) setEdge(r,c,'b',next);
        if (c<c2) setEdge(r,c,'r',next);
        if (r>r1) setEdge(r,c,'t',next);
        if (c>c1) setEdge(r,c,'l',next);
      }
    }

    updateBlock(tb.id, { ...(tb as any), cellBorderMap: map } as any);
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
    <div className="flex h-full bg-[#fafbfc]">
      {/* 左側變數面板 */}
      {showVariablePanel && (
        <div className="w-64 bg-white flex flex-col shadow-sm">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">變數標籤</h3>
              </div>
              <button
                onClick={() => setShowVariablePanel(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              點擊標籤插入變數
            </p>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="flex-1 overflow-y-auto px-3 py-4">
            {variables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Tag className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-3">目前沒有可用的變數</p>
                <button
                  onClick={loadVariables}
                  className="px-4 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  重新載入
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {variables.map(v => {
                  return (
                    <VariableTag
                      key={v.key}
                      label={v.label || v.key}
                      color={varColors[v.key] || '#e6f0ff'}
                      onColorChange={(c)=> handleVarColorChange(v.key, c)}   // ← 改這裡
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
        <div className="bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            {/* 左側：全域工具 */}
            <div className="flex items-center gap-2">
              {/* 預覽模式切換 */}
              <button
                onClick={() => setIsPreview(!isPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isPreview
                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>
                  {isPreview ? '編輯' : '預覽'}
                </span>
              </button>

              {/* 新增元素 */}
              {!isPreview && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-1" />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={addTextBlock}
                      className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Type className="w-4 h-4" />
                      <span>文字</span>
                    </button>
                    <button
                      onClick={addTableBlock}
                      className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                      <Table className="w-4 h-4" />
                      <span>表格</span>
                    </button>
                  </div>
                </>
              )}

              {/* 變數面板切換 */}
              {!showVariablePanel && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-1" />
                  <button
                    onClick={() => setShowVariablePanel(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
                  >
                    <Tag className="w-4 h-4" />
                    <span>變數</span>
                  </button>
                </>
              )}
            </div>

            {/* 右側：模板和匯出工具 */}
            <div className="flex items-center gap-2">
              {/* 模板選擇 */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium"
                >
                  <Settings className="w-4 h-4" />
                  <span>模板</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showTemplateDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTemplateDropdown(false)} />
                    <div className="absolute top-full right-0 mt-3 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-20 overflow-hidden">
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
                        <input
                          type="text"
                          placeholder="輸入模板名稱..."
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleSaveTemplate}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium disabled:opacity-50 shadow-sm"
                          >
                            {currentTemplateId ? '更新模板' : '儲存模板'}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto">
                        {/* 新增模板：清空畫布 */}
                        <button
                          onClick={() => {
                            setCurrentTemplateId(null);
                            setTemplateName('');
                            onChange({ page: value.page, blocks: [], gridSize: value.gridSize, showGrid: value.showGrid });
                          }}
                          className="w-full text-left px-4 py-3.5 hover:bg-blue-50 transition-all border-b border-gray-100 flex items-center gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                            <Plus className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm text-gray-900 font-medium">建立新模板</span>
                        </button>

                        {templates.map((template) => {
                          const isActive = currentTemplateId === template.id;
                          return (
                            <div
                              key={template.id}
                              className={`group w-full px-4 py-3 transition-all border-b border-gray-50 last:border-b-0 ${
                                isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <button
                                onClick={() => loadTemplate(template)}
                                className="w-full text-left flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                                    isActive ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'
                                  }`}>
                                    <Settings className={`w-4 h-4 ${
                                      isActive ? 'text-white' : 'text-gray-600'
                                    }`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${
                                      isActive ? 'text-blue-600' : 'text-gray-900'
                                    }`}>
                                      {template.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {new Date(template.created_at).toLocaleDateString('zh-TW')}
                                    </div>
                                  </div>
                                </div>

                                {/* Trash ICON */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    (async () => {
                                      try {
                                        setLoading(true);
                                        const firmCode = getFirmCodeOrThrow();
                                        const res = await apiFetch(`/api/quote-templates/${template.id}?firm_code=${encodeURIComponent(firmCode)}`, {
                                          method: 'DELETE'
                                        });
                                        if (res.ok) {
                                          if (currentTemplateId === template.id) {
                                            setCurrentTemplateId(null);
                                            setTemplateName('');
                                            onChange({ page: value.page, blocks: [], gridSize: value.gridSize, showGrid: value.showGrid });
                                          }
                                          await loadTemplates();
                                        } else {
                                          const err = await res.json();
                                          alert(err.detail || '刪除失敗');
                                        }
                                      } finally {
                                        setLoading(false);
                                      }
                                    })();
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 transition-all"
                                  title="刪除模板"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 匯出按鈕（保持在模板選單之外） */}
              <button
                onClick={() => onExport(value)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#334d6d] to-[#3f5a7d] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>匯出文件</span>
              </button>

            </div>
          </div>
        </div>

        {/* 畫布區域 */}
        <div className="flex-1 overflow-auto bg-[#fafbfc] p-8">
          <div
            ref={canvasRef}
            className="relative mx-auto bg-white shadow-lg rounded-lg border border-gray-200"
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
                  className="absolute border-l border-blue-400/20 border-dashed"
                  style={{ left: value.page.width / 2, top: 0, height: '100%' }}
                />
                <div
                  className="absolute border-t border-blue-400/20 border-dashed"
                  style={{ top: value.page.height / 2, left: 0, width: '100%' }}
                />
              </>
            )}

            {/* 渲柔所有區塊 */}
            {value.blocks.map((block) => {
              // 計算最小尺寸：根據字體大小
              const fontSize = block.type === 'text' ? ((block as TextBlock).fontSize || 14) : ((block as any).fontSize || 14);
              let minWidth = Math.max(100, fontSize * 3);
              const minHeight = Math.max(40, fontSize * 2);

              // 表格：設定合理的最小寬度，外框可自由調整作為最大寬度限制
              if (block.type === 'table') {
                minWidth = 200; // 表格最小寬度
              }


              return (
              <Rnd
                bounds="parent"
                key={block.id}
                size={{
                  width:  (liveSizeRef.current[block.id]?.w ?? block.w),
                  height: (liveSizeRef.current[block.id]?.h ?? block.h) || 'auto',
                }}
                position={{
                  x: livePosRef.current[block.id]?.x ?? block.x,
                  y: livePosRef.current[block.id]?.y ?? block.y,
                }}
                minWidth={minWidth}
                minHeight={minHeight}
                onDrag={(e, d) => {
                  livePosRef.current[block.id] = { x: d.x, y: d.y };
                  invalidate();
                }}
                onDragStop={(e, d) => {
                  delete livePosRef.current[block.id];
                  updateBlock(block.id, { x: d.x, y: d.y });
                }}
                onResize={(e, direction, ref, delta, position) => {
                  liveSizeRef.current[block.id] = { w: ref.offsetWidth, h: ref.offsetHeight };
                  livePosRef.current[block.id]  = { x: position.x, y: position.y };
                  invalidate();
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                const payload: any = {
                  w: ref.offsetWidth,
                  h: ref.offsetHeight,
                  x: position.x,
                  y: position.y,
                };

                // ✅ 若為表格：外框縮放時，欄寬＆列高都按比例縮放
                if (block.type === 'table' && (delta.width !== 0 || delta.height !== 0)) {
                  const tb = block as TableBlock;

                  const oldW = Math.max(1, block.w || 1); // 避免除以 0
                  const oldH = Math.max(1, block.h || 1);
                  const newW = ref.offsetWidth;
                  const newH = ref.offsetHeight;

                  // 欄寬（px）按比例縮放，且不低於 MIN_CELL_PX
                  const curCol = (tb as any).columnWidthsPx as number[] | undefined;
                  if (curCol && curCol.length > 0 && delta.width !== 0) {
                    const ratioW = newW / oldW;
                    payload.columnWidthsPx = curCol.map(w => Math.max(MIN_CELL_PX, w * ratioW));
                  }

                  // 列高（px）按比例縮放，總和校正為 newH，且每列不低於 MIN_CELL_PX
                  const curRow = (tb as any).rowHeights as number[] | undefined;
                  if (curRow && curRow.length > 0 && delta.height !== 0) {
                    const ratioH = newH / oldH;

                    // 第一步：先各自縮放並套用最小值
                    let scaled = curRow.map(h => Math.max(MIN_CELL_PX, h * ratioH));

                    // 第二步：校正總和，讓列高合計 = newH（把差值補到最後一列）
                    const sum = scaled.reduce((s, h) => s + h, 0);
                    const diff = newH - sum;
                    scaled[scaled.length - 1] = Math.max(MIN_CELL_PX, scaled[scaled.length - 1] + diff);

                    payload.rowHeights = scaled;
                  }
                }

                delete liveSizeRef.current[block.id];
                delete livePosRef.current[block.id];
                updateBlock(block.id, payload);
              }}


                disableDragging={isPreview || block.locked || isEditing}
                enableResizing={!isPreview && !block.locked && !isEditing}
                dragGrid={[1, 1]}
                resizeGrid={[1, 1]}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(block.id);
                  if (block.type === 'text') {
                    setSelectedCellId(null);
                  }
                }}
                className={`${selectedBlockId === block.id ? 'relative' : 'hover:ring-1 hover:ring-gray-300'} ${
                  block.locked ? 'opacity-60' : ''
                } transition-all`}
                style={{ willChange: 'transform,width,height' }}
              >
                {/* 自定義選取框 - 四角 90 度符號，透明背景，比內容大 */}
                {selectedBlockId === block.id && !isPreview && (
                  <div className="absolute -inset-2 pointer-events-none">
                    {/* 左上角 */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-l-[3px] border-t-[3px] border-blue-600" />
                    {/* 右上角 */}
                    <div className="absolute top-0 right-0 w-6 h-6 border-r-[3px] border-t-[3px] border-blue-600" />
                    {/* 左下角 */}
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-l-[3px] border-b-[3px] border-blue-600" />
                    {/* 右下角 */}
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-r-[3px] border-b-[3px] border-blue-600" />
                  </div>
                )}

                {/* 浮動操作工具列 */}
                {selectedBlockId === block.id && !isPreview && (
                  <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-0.5
                                bg-white text-gray-700 px-1 py-1 rounded-lg shadow-xl border border-gray-200
                                leading-none backdrop-blur-sm"
                      style={{ zIndex: 2147483640 }}
                      onMouseDown={preventBlur}
                      onTouchStart={preventBlur}
                    >
                    {/* 複製 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); copyBlock(); }}
                      className="p-1 hover:bg-gray-100 rounded transition-all"
                      title="複製"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* 鎖定/解鎖 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLock(); }}
                      className="p-1 hover:bg-gray-100 rounded transition-all"
                      title={block.locked ? "解鎖" : "鎖定"}
                    >
                      {block.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>

                    {/* 刪除 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(); }}
                      className="p-1 hover:bg-red-50 rounded transition-all hover:text-red-600"
                      title="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* 文字區塊工具（簡約 ICON） */}
                    {block.type === 'text' && (
                      <>
                        <div className="w-px h-4 bg-gray-200 mx-0.5" />

                        {/* 字體大小 */}
                        <select
                          onChange={(e) => { e.stopPropagation(); updateTextFormat('fontSize', Number(e.target.value)); }}
                          value={(block as TextBlock).fontSize || 14}
                          className="h-6 text-xs rounded px-1.5 bg-white text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          {[10,12,14,16,18,20,24,28,32].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>

                        {/* 文字體色（無外框底色 + 依選取更新） */}
                        <div
                          className="relative inline-flex items-center ml-0.5 p-0.5 border border-gray-200 rounded hover:border-gray-300 transition-colors"
                          title="文字體色"
                          onMouseDown={preventBlur}
                        >
                          <div className="w-4 h-4 rounded" style={{ background: lastTextColor }} />
                          <input
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={lastTextColor}
                            onChange={(e) => {
                              setLastTextColor(e.target.value);
                              document.execCommand('foreColor', false, e.target.value);
                            }}
                          />
                        </div>


                        {/* 文字底色（根據選取顯示） */}
                        <div
                          className="relative inline-flex items-center ml-0.5 p-0.5 border border-gray-200 rounded hover:border-gray-300 transition-colors"
                          title="文字底色"
                          onMouseDown={preventBlur}
                        >
                          <div className="w-4 h-4 rounded" style={{ background: lastTextBgColor }} />
                          <input
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={lastTextBgColor}
                            onChange={(e) => {
                              setLastTextBgColor(e.target.value);
                              document.execCommand('hiliteColor', false, e.target.value);
                            }}
                          />
                        </div>

                        {/* 對齊群組（在 B/I/U 左邊） */}
                        <div className="ml-0.5 flex items-center gap-0.5">
                      <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('justifyLeft'); }} className="p-1 rounded hover:bg-gray-100 transition-colors" title="靠左"><AlignLeft className="w-3.5 h-3.5" /></button>
                      <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('justifyCenter'); }} className="p-1 rounded hover:bg-gray-100 transition-colors" title="置中"><AlignCenter className="w-3.5 h-3.5" /></button>
                      <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('justifyRight'); }} className="p-1 rounded hover:bg-gray-100 transition-colors" title="靠右"><AlignRight className="w-3.5 h-3.5" /></button>
                    </div>

                        <div className="w-px h-4 bg-gray-200 mx-0.5" />

                        {/* B/I/U 放最右 */}
                        <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('bold'); }} className="p-1 hover:bg-gray-100 rounded transition-colors" title="粗體"><Bold className="w-3.5 h-3.5" /></button>
                        <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('italic'); }} className="p-1 hover:bg-gray-100 rounded transition-colors" title="斜體"><Italic className="w-3.5 h-3.5" /></button>
                        <button onClick={(e)=>{ e.stopPropagation(); document.execCommand('underline'); }} className="p-1 hover:bg-gray-100 rounded transition-colors" title="底線"><Underline className="w-3.5 h-3.5" /></button>
                      </>
                    )}

                    {/* 表格工具列（簡化版：欄/列群組 + 字體大小 + 儲存格底色同步） */}
                      {block.type === 'table' && (
                        <>
                          <div className="w-px h-4 bg-gray-200 mx-0.5" />
                        {(() => {
                          const tb = selectedBlock as TableBlock;

                          // 目前選到的 cell 底色
                          let cellBgHex = '#ffffff';
                          let canPaint = false;
                          let selR = -1, selC = -1;
                          if (selectedCellId && !selectedCellId.startsWith('header-')) {
                            const [rStr, cStr] = selectedCellId.split('-');
                            selR = Number(rStr); selC = Number(cStr);
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
                            const inner = cur.replace(/<div data-cell-bg[^>]*>([\s\S]*?)<\/div>/, '$1');
                            rows[selR][selC] = `<div data-cell-bg style="background-color:${hex};padding:4px;">${inner}</div>`;
                            updateBlock(block.id, { rows });
                          };

                          return (
                            <>
                              {/* ───── ② 增減欄/列 + 儲存格底色 ───── */}
                              <HoverAddRemove title="欄" glyph={<ColsGlyph />} onAdd={addTableColumn} onRemove={removeTableColumn} />
                              <div className="ml-1" />
                              <HoverAddRemove title="列" glyph={<RowsGlyph />} onAdd={addTableRow} onRemove={removeTableRow} />

                              {/* 儲存格底色（無外框底色）— 靠近增刪群組 */}
                              <div
                                className="ml-0.5 relative inline-flex items-center p-0.5 border border-gray-200 rounded hover:border-gray-300 transition-colors"
                                title={canPaint ? '儲存格底色' : '請先選取一個儲存格'}
                                onMouseDown={preventBlur}
                              >
                                <div className="w-4 h-4 rounded" style={{ background: cellBgHex }} />
                                <input
                                  type="color"
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  value={cellBgHex}
                                  disabled={!canPaint}
                                  onChange={(evt) => applyCellBg(evt.target.value)}
                                />
                              </div>

                              {/* 分隔線 */}
                              <div className="w-px h-4 bg-gray-200 mx-0.5" />

                              {/* ───── ③ 字體大小 + 字體顏色（無外框底色） ───── */}
                              <select
                                value={(tb as any).fontSize ?? 14}
                                onChange={(e) => {
                                  const size = parseInt(e.target.value, 10) || 14;
                                  updateBlock(block.id, { ...(tb as any), fontSize: size } as any);
                                }}
                                className="h-6 text-xs rounded px-1.5 bg-white text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors"
                                onMouseDown={preventBlur}
                              >
                                {[12, 13, 14, 16, 18, 20, 22, 24].map(sz => (
                                  <option key={sz} value={sz}>{sz}px</option>
                                ))}
                              </select>

                              <div
                                className="relative inline-flex items-center ml-0.5 p-0.5 border border-gray-200 rounded hover:border-gray-300 transition-colors"
                                title="文字體色"
                                onMouseDown={preventBlur}
                              >
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: lastTableTextColor }} />
                                <input
                                  type="color"
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  value={lastTableTextColor}
                                  onChange={(e) => { setLastTableTextColor(e.target.value); document.execCommand('foreColor', false, e.target.value); }}
                                />
                              </div>

                              {/* 分隔線 */}
                              <div className="w-px h-5 bg-gray-200 mx-1" />

                              {/* ───── ④ 表格框線 ───── */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowBorderMenu(v => !v);
                                    setShowAlignMenu(false);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                                  title="框線"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                  </svg>
                                </button>

                                {showBorderMenu && (
                                  <div
                                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-2xl border border-gray-200 p-2"
                                    style={{ width: 'max-content', maxWidth: '400px', zIndex: 2147483645 }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-gray-600">粗細</span>
                                        <select
                                          className="border border-gray-200 text-xs rounded px-1.5 py-0.5 text-gray-700 bg-white hover:border-gray-300 transition-colors"
                                          value={borderThickness}
                                          onChange={e=>setBorderThickness(parseInt(e.target.value,10)||1)}
                                        >
                                          {[0,1,2,3,4,6].map(n => <option key={n} value={n}>{n}px</option>)}
                                        </select>
                                      </div>

                                      <div className="w-px h-4 bg-gray-200" />

                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-gray-600">顏色</span>
                                        <div className="relative inline-flex items-center p-0.5 border border-gray-200 rounded hover:border-gray-300 transition-colors">
                                          <div className="w-4 h-4 rounded" style={{ backgroundColor: borderColor }} />
                                          <input
                                            type="color"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            value={borderColor}
                                            onChange={(e)=>setBorderColor(e.target.value)}
                                          />
                                        </div>
                                      </div>

                                      <div className="w-px h-4 bg-gray-200" />

                                      <div className="flex items-center gap-1">
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="無" onClick={()=>applyBorders('none', 0)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <rect x="2" y="2" width="12" height="12" rx="1" />
                                            <line x1="2" y1="14" x2="14" y2="2" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="外框" onClick={()=>applyBorders('outer', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="2" width="12" height="12" rx="1" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="內框" onClick={()=>applyBorders('inner', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <line x1="8" y1="2" x2="8" y2="14" />
                                            <line x1="2" y1="8" x2="14" y2="8" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="上框" onClick={()=>applyBorders('top', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="2" y1="2" x2="14" y2="2" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="下框" onClick={()=>applyBorders('bottom', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="2" y1="14" x2="14" y2="14" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="左框" onClick={()=>applyBorders('left', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="2" y1="2" x2="2" y2="14" />
                                          </svg>
                                        </button>
                                        <button className="p-1 rounded hover:bg-gray-100 transition-all" title="右框" onClick={()=>applyBorders('right', borderThickness)}>
                                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="14" y1="2" x2="14" y2="14" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 分隔線 */}
                              <div className="w-px h-4 bg-gray-200 mx-0.5" />

                              {/* ───── ⑤ 對齊工具（同上排顏色，可見） ───── */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAlignMenu(v => !v);
                                  setShowBorderMenu(false);    // ← 互斥
                                }}
                                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                                  title="對齊"
                                >
                                  <AlignCenter className="w-3.5 h-3.5" />
                                </button>
                                {showAlignMenu && (
                                  <div
                                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-2xl border border-gray-200 p-2"
                                    style={{ zIndex: 2147483645 }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {/* 水平和垂直對齊在一列 */}
                                    <div className="flex items-center gap-1">
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>document.execCommand('justifyLeft')}   title="靠左"><AlignLeft className="w-3.5 h-3.5 text-gray-700" /></button>
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>document.execCommand('justifyCenter')} title="置中"><AlignCenter className="w-3.5 h-3.5 text-gray-700" /></button>
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>document.execCommand('justifyRight')}  title="靠右"><AlignRight className="w-3.5 h-3.5 text-gray-700" /></button>
                                      <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>applyVerticalAlign('top')}    title="上"><VAlignTopGlyph /></button>
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>applyVerticalAlign('middle')} title="中"><VAlignMiddleGlyph /></button>
                                      <button className="p-1 rounded hover:bg-gray-100 transition-colors" onClick={()=>applyVerticalAlign('bottom')} title="下"><VAlignBottomGlyph /></button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ───── ⑥ B/I/U 最右 ───── */}
                              <div className="w-px h-4 bg-gray-200 mx-0.5" />
                              <button onClick={(e)=>{ e.stopPropagation(); cellExec('bold'); }}      className="p-1 hover:bg-gray-100 rounded transition-colors" title="粗體"><Bold className="w-3.5 h-3.5" /></button>
                              <button onClick={(e)=>{ e.stopPropagation(); cellExec('italic'); }}    className="p-1 hover:bg-gray-100 rounded transition-colors" title="斜體"><Italic className="w-3.5 h-3.5" /></button>
                              <button onClick={(e)=>{ e.stopPropagation(); cellExec('underline'); }} className="p-1 hover:bg-gray-100 rounded transition-colors" title="底線"><Underline className="w-3.5 h-3.5" /></button>
                            </>
                            );
                          })()}
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
                            className={`${borders ? 'border border-black' : ''} h-full border-collapse w-auto max-w-full`}
                            style={{ fontSize: (tb as any).fontSize ?? 14, tableLayout: 'fixed' }}
                          >
                            {/* 以 colgroup 套用欄寬（優先使用 px，其次百分比） */}
                            <colgroup>
                              {Array.from({ length: (tb.headers.length || (tb.rows[0]?.length ?? 0)) || 0 }).map((_, i) => {
                                const livePx = liveColsPxRef.current[block.id]?.[i];
                                const pxArr  = (tb as any).columnWidthsPx as number[] | undefined;
                                const pctArr = tb.columnWidths as number[] | undefined;
                                const colCount = (tb.headers.length || (tb.rows[0]?.length ?? 0)) || 1;
                                const style: React.CSSProperties = livePx != null
                                  ? { width: `${livePx}px` }
                                  : pxArr && pxArr[i] != null
                                    ? { width: `${pxArr[i]}px` }
                                    : { width: `${pctArr?.[i] ?? (100 / colCount)}%` };
                                return <col key={i} style={style} />;
                              })}
                            </colgroup>

                          {tb.headers.length > 0 && (
                            <thead>
                              <tr>
                                {tb.headers.map((header, colIndex) => (
                                  <th
                                    key={colIndex}
                                    className={`${borders ? 'border border-black' : ''} p-1 text-sm font-medium text-left relative`}
                                    style={{
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
                                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
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
                              // 優先使用即時拖曳中的列高
                              const liveRowHeights = liveRowsHeightRef.current[block.id];
                              const rowH = liveRowHeights?.[rowIndex] ?? (tb as any).rowHeights?.[rowIndex];
                              const baseRowMin = MIN_CELL_PX;

                              return (
                                <tr key={rowIndex} style={{ height: rowH ? `${rowH}px` : undefined, minHeight: baseRowMin, lineHeight: 1.4 }}>
                                  {row.map((cell, colIndex) => {
                                    const cellId = `${rowIndex}-${colIndex}`;
                                    const selected = selectedCellId === cellId;

                                    const vAlignMap = (tb as any).vAlignMap || {};
                                    const borderMap = (tb as any).cellBorderMap || {};
                                    const bspec = (borderMap[cellId] || {}) as { t?: number; r?: number; b?: number; l?: number; color?: string };
                                    const vAlign = (vAlignMap[cellId] as any) || 'middle';
                                    const edgeColor = bspec.color || '#000000';

                                    return (
                                      <td
                                        key={cellId}
                                        className={`${borders ? 'border border-black' : ''} relative`}
                                        style={{
                                          backgroundColor: extractCellBg(cell) || undefined,
                                          verticalAlign: vAlign,
                                          borderTop:    bspec.t ? `${bspec.t}px solid ${edgeColor}` : undefined,
                                          borderRight:  bspec.r ? `${bspec.r}px solid ${edgeColor}` : undefined,
                                          borderBottom: bspec.b ? `${bspec.b}px solid ${edgeColor}` : undefined,
                                          borderLeft:   bspec.l ? `${bspec.l}px solid ${edgeColor}` : undefined,
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
                                          onSelect={(e) => {
                                            setSelectedBlockId(block.id);
                                            setIsEditing(true);
                                            if (e?.shiftKey && selectedCellId) {
                                              const [sr, sc] = selectedCellId.split('-').map(Number);
                                              setSelectedCellId(cellId);
                                              setSelectedRange({ start: { r: sr, c: sc }, end: { r: rowIndex, c: colIndex } });
                                            } else {
                                              setSelectedCellId(cellId);
                                              setSelectedRange({ start: { r: rowIndex, c: colIndex }, end: { r: rowIndex, c: colIndex } });
                                            }
                                          }}
                                        />

                                        {/* 垂直把手（調欄寬） */}
                                        {!isPreview && (
                                          (selected || (tb.headers.length === 0 && rowIndex === 0)) && colIndex < row.length - 1 && (
                                            <div
                                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
                                              onMouseDown={(e) => startResizeColumn(e, block, colIndex)}
                                            />
                                          )
                                        )}

                                        {/* 水平把手（調列高） */}
                                        {!isPreview && rowIndex < tb.rows.length - 1 && (
                                          (selected || colIndex === 0) && (
                                            <div
                                              className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize bg-transparent hover:bg-blue-400/50 transition-colors select-none"
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
            );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
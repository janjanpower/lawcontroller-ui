import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import {
  Type,
  Table as TableIcon,
  Eye,
  EyeOff,
  Download,
  Settings,
  ChevronDown,
  X,
  Tag,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Minus,
  Copy,
  Lock,
  Unlock,
  Trash2
} from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../../../../utils/api';
import type { QuoteCanvasSchema, CanvasBlock, TextBlock, TableBlock } from './schema';

// ===== Snap / Bounds helpers =====
const SNAP_TOLERANCE = 6; // 吸附容忍距離（px）
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const round = (v: number) => Math.round(v);
const snapToStep = (v: number, step: number) => round(v / step) * step;

interface QuoteCanvasProps {
  value: QuoteCanvasSchema;
  onChange: (schema: QuoteCanvasSchema) => void;
  onExport: (schema: QuoteCanvasSchema) => void;
  onSaveTemplate: () => void;
  onRemoveTemplate: () => void;
  caseId: string;
}

interface VariableTag {
  key: string;
  label: string;
  value: string;
}

// --- 文字中變數 token 與便條（pill）互轉 ---
const decorateTokensToPills = (html: string, vars: VariableTag[]) => {
  // 支援 {{key}} 或 {{key|#RRGGBB}}
  return html.replace(/\{\{([\w.]+?)(?:\|(#?[0-9a-fA-F]{3,8}))?\}\}/g, (_m, k: string, c?: string) => {
    const color = c || '#FEF3C7'; // 默認淡黃色
    // 可編輯時顯示為色塊 + X
    return (
      `<span class="var-pill" data-key="${k}" data-color="${color}" ` +
      `contenteditable="false" style="display:inline-flex;align-items:center;padding:2px 6px;` +
      `border-radius:6px;border:1px solid ${color};background:${color};gap:4px;">` +
      `<span class="var-label" style="font-family:monospace">{{${k}}}</span>` +
      `<button class="var-remove" style="all:unset;cursor:pointer;font-weight:700">×</button>` +
      `</span>`
    );
  });
};

const serializePillsToTokens = (el: HTMLElement) => {
  // 將 var-pill 轉回 {{key|#color}}
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.var-pill').forEach((pill) => {
    const p = pill as HTMLElement;
    const key = p.dataset.key || '';
    const color = p.dataset.color || '';
    const token = `{{${key}${color ? '|' + color : ''}}}`;
    p.replaceWith(document.createTextNode(token));
  });
  return clone.innerHTML;
};

// Rich Text Editor Component
const RichTextEditor: React.FC<{
  content: string;
  onChange: (c: string) => void;
  style: React.CSSProperties;
  vars: VariableTag[];
  isPreview: boolean;
}> = ({ content, onChange, style, vars, isPreview }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = React.useState<{ el: HTMLElement; x: number; y: number } | null>(null);

  const renderContent = () => {
    if (isPreview) {
      // 預覽：將 {{key}} / {{key|#color}} 直接替換成值（不顯示色塊）
      let rendered = content;
      vars.forEach(v => {
        const re = new RegExp(`\\{\\{${v.key}(?:\\|#[0-9a-fA-F]{3,8})?\\}\\}`, 'g');
        rendered = rendered.replace(re, v.value || v.label);
      });
      return rendered;
    }
    return decorateTokensToPills(content, vars);
  };

  const commitFromDOM = () => {
    if (!editorRef.current) return;
    const serialized = serializePillsToTokens(editorRef.current);
    onChange(serialized);
  };

  const handleInput = () => commitFromDOM();

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const pill = target.closest('.var-pill') as HTMLElement | null;
      if (!pill) { setPicker(null); return; }
      if (target.classList.contains('var-remove')) {
        pill.remove();
        commitFromDOM();
        setPicker(null);
        return;
      }
      const r = pill.getBoundingClientRect();
      setPicker({ el: pill, x: r.left + r.width / 2, y: r.top });
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  return (
    <>
      <div
        ref={editorRef}
        data-editor-root
        contentEditable={!isPreview}
        onInput={handleInput}
        style={{ ...style, minHeight: '40px', padding: '8px', border: isPreview ? 'none' : '1px dashed #ccc', outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}
        suppressContentEditableWarning={true}
        dangerouslySetInnerHTML={{ __html: renderContent() }}
      />
      {/* 便條色票（每張便條獨立） */}
      {!isPreview && picker && (
        <div
          style={{ position: 'fixed', left: picker.x, top: picker.y - 8, transform: 'translate(-50%, -100%)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
        >
          <input
            type="color"
            defaultValue={(picker.el.dataset.color as string) || '#FEF3C7'}
            onChange={(e) => {
              const c = e.target.value;
              picker.el.dataset.color = c;
              const style = picker.el.getAttribute('style') || '';
              const next = style
                .replace(/background:[^;]+;/, '')
                .replace(/border:[^;]+;/, '') + `background:${c};border:1px solid ${c};`;
              picker.el.setAttribute('style', next);
              commitFromDOM();
            }}
          />
        </div>
      )}
    </>
  );
};

// Table Cell Component (支援多行與變數便條)
const TableCell: React.FC<{
  content: string;
  onChange: (content: string) => void;
  style: React.CSSProperties;
  vars: VariableTag[];
  isPreview: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ content, onChange, style, vars, isPreview, isSelected, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);

  const commit = () => { if (!ref.current) return; onChange(serializePillsToTokens(ref.current)); };
  const html = isPreview
    ? vars.reduce((acc, v) => acc.replace(new RegExp(`\\{\\{${v.key}(?:\\|#[0-9a-fA-F]{3,8})?\\}\\}`, 'g'), v.value || v.label), content)
    : decorateTokensToPills(content, vars);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onClickInner = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const pill = t.closest('.var-pill') as HTMLElement | null;
      if (!pill) return;
      if (t.classList.contains('var-remove')) { pill.remove(); commit(); }
    };
    el.addEventListener('click', onClickInner);
    return () => el.removeEventListener('click', onClickInner);
  }, []);

  return (
    <td
      style={{
        ...style,
        border: '1px solid #ddd',
        padding: '8px',
        minHeight: '30px',
        backgroundColor: isSelected ? '#e3f2fd' : (style as any).backgroundColor,
        cursor: isPreview ? 'default' : 'pointer'
      }}
      onClick={onClick}
    >
      <div
        ref={ref}
        data-editor-root
        contentEditable={!isPreview && isSelected}
        onInput={commit}
        style={{ outline: 'none', minHeight: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}
        dangerouslySetInnerHTML={{ __html: html }}
        suppressContentEditableWarning={true}
      />
    </td>
  );
};

// Variable Tag Item (左側清單)
const VariableTagItem: React.FC<{
  varKey: string;
  label: string;
  onInsert: () => void;
}> = ({ varKey, label, onInsert }) => (
  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-2 hover:bg-blue-100 transition-colors">
    <div className="flex-1 min-w-0">
      <div className="text-xs font-mono text-blue-700 truncate">{`{{${varKey}}}`}</div>
      <div className="text-xs text-gray-600 truncate">{label}</div>
    </div>
    <button onClick={onInsert} className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex-shrink-0">
      插入
    </button>
  </div>
);

export default function QuoteCanvas({ value, onChange, onExport, onSaveTemplate, onRemoveTemplate, caseId }: QuoteCanvasProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [variables, setVariables] = useState<VariableTag[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showVariablePanel, setShowVariablePanel] = useState(true);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedBlock = value.blocks.find(b => b.id === selectedBlockId);
  const isTextSelected = selectedBlock?.type === 'text';
  const isTableSelected = selectedBlock?.type === 'table';

  // 選取作用（字元級）的快捷指令
  const execOnSelection = (cmd: string, value?: string) => {
    try {
      document.execCommand(cmd, false, value);
      const sel = window.getSelection();
      const anchorEl = (sel?.anchorNode as any) instanceof Element ? (sel!.anchorNode as Element) : sel?.anchorNode?.parentElement;
      const root = (anchorEl as HTMLElement)?.closest('[data-editor-root]') as HTMLElement | null;
      if (root) root.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      // no-op
    }
  };

  const applyFontSize = (px: number) => {
    if (!px || Number.isNaN(px)) return;
    execOnSelection('fontSize', '7'); // 先置入 <font size="7">
    const sel = window.getSelection();
    const root = (sel?.anchorNode as any)?.parentElement?.closest('[data-editor-root]') as HTMLElement | null;
    if (!root) return;
    root.querySelectorAll('font[size="7"]').forEach((el) => {
      const span = document.createElement('span');
      (span.style as any).fontSize = `${px}px`;
      span.innerHTML = (el as HTMLElement).innerHTML;
      (el as HTMLElement).replaceWith(span);
    });
    root.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // 吸附/邊界
  const applyDragSnap = (x: number, y: number, w: number, h: number) => {
    const W = value.page.width - value.page.margin * 2;
    const H = value.page.height - value.page.margin * 2;
    let nx = x, ny = y;
    if (value.showGrid && value.gridSize) {
      const sx = snapToStep(nx, value.gridSize);
      const sy = snapToStep(ny, value.gridSize);
      if (Math.abs(sx - nx) <= SNAP_TOLERANCE) nx = sx;
      if (Math.abs(sy - ny) <= SNAP_TOLERANCE) ny = sy;
    }
    const cx = W / 2 - w / 2;
    const cy = H / 2 - h / 2;
    if (Math.abs(nx - cx) <= SNAP_TOLERANCE) nx = cx;
    if (Math.abs(ny - cy) <= SNAP_TOLERANCE) ny = cy;
    nx = clamp(nx, 0, Math.max(0, W - w));
    ny = clamp(ny, 0, Math.max(0, H - h));
    return { x: round(nx), y: round(ny) };
  };

  // 載入變數和模板
  useEffect(() => {
    loadVariables();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } as any;

    onChange({ ...value, blocks: [...value.blocks, newBlock] });
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
    } as any;

    onChange({ ...value, blocks: [...value.blocks, newBlock] });
    setSelectedBlockId(newBlock.id);
  };

  // 複製區塊
  const copyBlock = () => {
    if (!selectedBlock) return;
    const newBlock = { ...selectedBlock, id: `${selectedBlock.type}-${Date.now()}`, x: selectedBlock.x + 20, y: selectedBlock.y + 20 } as CanvasBlock;
    onChange({ ...value, blocks: [...value.blocks, newBlock] });
    setSelectedBlockId(newBlock.id);
  };

  // 鎖定/解鎖區塊
  const toggleLock = () => {
    if (!selectedBlock) return;
    const updatedBlocks = value.blocks.map(block => (block.id === selectedBlockId ? { ...block, locked: !(block as any).locked } : block));
    onChange({ ...value, blocks: updatedBlocks });
  };

  // 移除區塊
  const removeBlock = () => {
    if (!selectedBlock) return;
    const updatedBlocks = value.blocks.filter(block => block.id !== selectedBlockId);
    onChange({ ...value, blocks: updatedBlocks });
    setSelectedBlockId(null);
    setSelectedCellId(null);
  };

  // 更新區塊
  const updateBlock = (blockId: string, updates: Partial<CanvasBlock>) => {
    const updatedBlocks = value.blocks.map(block => (block.id === blockId ? { ...block, ...updates } : block));
    onChange({ ...value, blocks: updatedBlocks });
  };

  // 插入變數到區塊（目前採「附加到末尾」；需要插入到游標時，可改為 execCommand('insertHTML', ...)）
  const insertVariableToBlock = (varKey: string) => {
    if (!selectedBlock) return;
    const varTag = `{{${varKey}}}`;
    if (selectedBlock.type === 'text') {
      const textBlock = selectedBlock as TextBlock;
      updateBlock(selectedBlock.id, { text: (textBlock.text || '') + varTag } as any);
    } else if (selectedBlock.type === 'table' && selectedCellId) {
      const tableBlock = selectedBlock as TableBlock;
      const [rowIndex, colIndex] = selectedCellId.split('-').map(Number);
      if (rowIndex >= 0 && colIndex >= 0) {
        const newRows = [...tableBlock.rows];
        if (newRows[rowIndex] && newRows[rowIndex][colIndex] !== undefined) {
          newRows[rowIndex][colIndex] = (newRows[rowIndex][colIndex] || '') + varTag;
          updateBlock(selectedBlock.id, { rows: newRows } as any);
        }
      }
    }
  };

  // 表格操作
  const addTableRow = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    const newRow = new Array(tableBlock.headers.length).fill('');
    updateBlock(selectedBlock.id, { rows: [...tableBlock.rows, newRow] } as any);
  };

  const removeTableRow = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    if (tableBlock.rows.length > 1) {
      updateBlock(selectedBlock.id, { rows: tableBlock.rows.slice(0, -1) } as any);
    }
  };

  const addTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    updateBlock(selectedBlock.id, {
      headers: [...tableBlock.headers, '新欄位'],
      rows: tableBlock.rows.map(row => [...row, '']),
      columnWidths: [...(tableBlock.columnWidths || []), 20]
    } as any);
  };

  const removeTableColumn = () => {
    if (!selectedBlock || selectedBlock.type !== 'table') return;
    const tableBlock = selectedBlock as TableBlock;
    if (tableBlock.headers.length > 1) {
      updateBlock(selectedBlock.id, {
        headers: tableBlock.headers.slice(0, -1),
        rows: tableBlock.rows.map(row => row.slice(0, -1)),
        columnWidths: tableBlock.columnWidths?.slice(0, -1)
      } as any);
    }
  };

  // 模板管理
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { alert('請輸入模板名稱'); return; }
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();
      const payload = { name: templateName, description: '', content_json: value, is_default: false };
      let res: Response;
      if (currentTemplateId) {
        res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${encodeURIComponent(firmCode)}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        res = await apiFetch(`/api/quote-templates?firm_code=${encodeURIComponent(firmCode)}`, { method: 'POST', body: JSON.stringify(payload) });
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
    } finally { setLoading(false); }
  };

  const handleRemoveTemplate = async () => {
    if (!currentTemplateId) return;
    if (!confirm('確定要刪除此模板嗎？')) return;
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/quote-templates/${currentTemplateId}?firm_code=${encodeURIComponent(firmCode)}`, { method: 'DELETE' });
      if (res.ok) {
        setCurrentTemplateId(null);
        setTemplateName('');
        onChange({ page: value.page, blocks: [], gridSize: value.gridSize, showGrid: value.showGrid } as any);
        await loadTemplates();
        alert('模板刪除成功');
      } else {
        const error = await res.json();
        alert(error.detail || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除模板失敗:', error);
      alert('刪除模板失敗');
    } finally { setLoading(false); }
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
              <button onClick={() => setShowVariablePanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600">點擊插入變數到選中的元素</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {variables.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">載入變數中...</div>
              ) : (
                variables.map((variable) => (
                  <VariableTagItem key={variable.key} varKey={variable.key} label={variable.label} onInsert={() => insertVariableToBlock(variable.key)} />
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
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isPreview ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="text-sm font-medium">{isPreview ? '編輯模式' : '預覽模式'}</span>
              </button>

              {/* 新增元素 */}
              {!isPreview && (
                <div className="flex items-center gap-2">
                  <button onClick={addTextBlock} className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors">
                    <Type className="w-4 h-4" />
                    <span className="text-sm font-medium">文字</span>
                  </button>
                  <button onClick={addTableBlock} className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors">
                    <TableIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">表格</span>
                  </button>
                </div>
              )}

              {/* 變數面板切換 */}
              {!showVariablePanel && (
                <button onClick={() => setShowVariablePanel(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
                  <Tag className="w-4 h-4" />
                  <span className="text-sm font-medium">變數</span>
                </button>
              )}
            </div>

            {/* 中間：格式化工具（文字或表格儲存格皆可作用於『選取文字』） */}
            {selectedBlock && !isPreview && (
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                {(isTextSelected || (isTableSelected && !!selectedCellId)) && (
                  <>
                    <div className="flex items-center gap-1">
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('bold'); }} className="p-2 rounded hover:bg-gray-200" title="粗體">
                        <Bold className="w-4 h-4" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('italic'); }} className="p-2 rounded hover:bg-gray-200" title="斜體">
                        <Italic className="w-4 h-4" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('underline'); }} className="p-2 rounded hover:bg-gray-200" title="底線">
                        <Underline className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-px h-6 bg-gray-300" />

                    <div className="flex items-center gap-1">
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('justifyLeft'); }} className="p-2 rounded hover:bg-gray-200" title="靠左">
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('justifyCenter'); }} className="p-2 rounded hover:bg-gray-200" title="置中">
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); execOnSelection('justifyRight'); }} className="p-2 rounded hover:bg-gray-200" title="靠右">
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-px h-6 bg-gray-300" />

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={14}
                        onBlur={(e) => applyFontSize(parseInt(e.target.value, 10))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min={8}
                        max={72}
                        title="字級（套用於選取文字）"
                      />
                      <input
                        type="color"
                        onChange={(e) => execOnSelection('foreColor', e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        title="文字顏色（選取）"
                      />
                      <input
                        type="color"
                        onChange={(e) => execOnSelection('hiliteColor', e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        title="背景顏色（選取）"
                      />
                    </div>
                  </>
                )}

                {/* 表格工具 */}
                {isTableSelected && (
                  <>
                    <div className="w-px h-6 bg-gray-300" />
                    <div className="flex items-center gap-1">
                      <button onClick={addTableRow} className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">列</span>
                      </button>
                      <button onClick={removeTableRow} className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                        <Minus className="w-3 h-3" />
                        <span className="text-xs">列</span>
                      </button>
                      <button onClick={addTableColumn} className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">欄</span>
                      </button>
                      <button onClick={removeTableColumn} className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                        <Minus className="w-3 h-3" />
                        <span className="text-xs">欄</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 右側：模板和匯出工具 */}
            <div className="flex items-center gap-3">
              {/* 模板選擇 */}
              <div className="relative">
                <button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">模板</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showTemplateDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTemplateDropdown(false)} />
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      <div className="p-3 border-b border-gray-200">
                        <input type="text" placeholder="模板名稱" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={handleSaveTemplate} disabled={loading} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50">
                            {currentTemplateId ? '更新' : '儲存'}
                          </button>
                          {currentTemplateId && (
                            <button onClick={handleRemoveTemplate} disabled={loading} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50">
                              刪除
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {templates.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">尚無模板</div>
                        ) : (
                          templates.map((template) => (
                            <button key={template.id} onClick={() => loadTemplate(template)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${currentTemplateId === template.id ? 'bg-blue-50 text-blue-700' : ''}`}>
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-gray-500 mt-1">{new Date(template.created_at).toLocaleDateString('zh-TW')}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 匯出按鈕 */}
              <button onClick={() => onExport(value)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">匯出</span>
              </button>
            </div>
          </div>
        </div>

        {/* 畫布區域 */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          {/* 外框：A4 紙張 */}
          <div className="relative mx-auto bg-white shadow-lg" style={{ width: value.page.width, height: value.page.height }}>
            {/* 內頁可編輯區（阻擋出框）：以 page.margin 內縮 */}
            <div
              ref={canvasRef}
              className="absolute"
              style={{
                left: value.page.margin,
                top: value.page.margin,
                width: value.page.width - value.page.margin * 2,
                height: value.page.height - value.page.margin * 2,
                backgroundImage: value.showGrid ? `radial-gradient(circle, #ddd 1px, transparent 1px)` : 'none',
                backgroundSize: value.showGrid ? `${value.gridSize}px ${value.gridSize}px` : 'auto'
              }}
              onClick={() => { setSelectedBlockId(null); setSelectedCellId(null); }}
            >
              {/* 可視邊界虛線框 */}
              <div className="pointer-events-none absolute inset-0 border border-dashed border-gray-300" />

              {/* 中心線輔助（相對內頁尺寸）*/}
              {!isPreview && (
                <>
                  <div className="absolute border-l border-blue-300 border-dashed opacity-30" style={{ left: (value.page.width - value.page.margin * 2) / 2, top: 0, height: '100%' }} />
                  <div className="absolute border-t border-blue-300 border-dashed opacity-30" style={{ top: (value.page.height - value.page.margin * 2) / 2, left: 0, width: '100%' }} />
                </>
              )}

              {/* 渲染所有區塊 */}
              {value.blocks.map((block) => (
                <Rnd
                  key={block.id}
                  bounds="parent"
                  size={{ width: (block as any).w, height: (block as any).h || 'auto' }}
                  position={{ x: (block as any).x, y: (block as any).y }}
                  disableDragging={isPreview || (block as any).locked}
                  enableResizing={!isPreview && !(block as any).locked}
                  onDragStop={(e, d) => {
                    const { x, y } = applyDragSnap(d.x, d.y, (block as any).w, (block as any).h || 0);
                    updateBlock(block.id, { x, y } as any);
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    const w = ref.offsetWidth;
                    const h = ref.offsetHeight;
                    const { x, y } = applyDragSnap(position.x, position.y, w, h);
                    updateBlock(block.id, { w, h, x, y } as any);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(block.id);
                    if (block.type === 'text') setSelectedCellId(null);
                  }}
                  className={`${selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''} ${(block as any).locked ? 'opacity-75' : ''}`}
                >
                  {/* 浮動操作工具列 */}
                  {selectedBlockId === block.id && !isPreview && (
                    <div className="absolute -top-10 right-0 flex items-center gap-1 bg-gray-800 text-white px-2 py-1 rounded-md shadow-lg z-10">
                      <button onClick={(e) => { e.stopPropagation(); copyBlock(); }} className="p-1 hover:bg-gray-700 rounded" title="複製">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleLock(); }} className="p-1 hover:bg-gray-700 rounded" title={(block as any).locked ? '解鎖' : '鎖定'}>
                        {(block as any).locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(); }} className="p-1 hover:bg-red-600 rounded" title="移除">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* 渲染區塊內容 */}
                  {block.type === 'text' && (
                    <RichTextEditor
                      content={(block as TextBlock).text as any}
                      onChange={(text) => updateBlock(block.id, { text } as any)}
                      style={{
                        fontSize: (block as TextBlock).fontSize || 14,
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
                                style={{ width: `${(block as TableBlock).columnWidths?.[colIndex] || 25}%` }}
                              >
                                <TableCell
                                  content={header}
                                  onChange={(newContent) => {
                                    const newHeaders = [...(block as TableBlock).headers];
                                    newHeaders[colIndex] = newContent;
                                    updateBlock(block.id, { headers: newHeaders } as any);
                                  }}
                                  style={{ border: 'none', padding: 0, backgroundColor: 'transparent' }}
                                  vars={variables}
                                  isPreview={isPreview}
                                  isSelected={selectedCellId === `header-${colIndex}`}
                                  onClick={() => { setSelectedCellId(`header-${colIndex}`); setSelectedBlockId(block.id); }}
                                />
                                {/* 欄位調整手柄（可後續實作） */}
                                {!isPreview && colIndex < (block as TableBlock).headers.length - 1 && (
                                  <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors" />
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
                                    updateBlock(block.id, { rows: newRows } as any);
                                  }}
                                  style={{ width: `${(block as TableBlock).columnWidths?.[colIndex] || 25}%` }}
                                  vars={variables}
                                  isPreview={isPreview}
                                  isSelected={selectedCellId === `${rowIndex}-${colIndex}`}
                                  onClick={() => { setSelectedCellId(`${rowIndex}-${colIndex}`); setSelectedBlockId(block.id); }}
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
    </div>
  );
}

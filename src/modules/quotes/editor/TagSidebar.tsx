import  { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, X, Download, Plus, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { renderString, computeRow, evalExpr } from '../utils/templateEngine';

type Dict = Record<string, any>;

type Column = {
  key: string;
  header: string;
  width?: string;
  align?: 'left'|'center'|'right';
  type?: 'text'|'number'|'currency'|'date'|'formula';
  formula?: string;
};

type Section =
  | { type: 'header'; html: string }
  | { type: 'text'; markdown?: string; html?: string }
  | { type: 'divider' }
  | { type: 'spacer'; size?: number }
  | {
      type: 'table';
      title?: string;
      columns: Column[];
      items_path?: string;
      show_total?: boolean;
      total_formula?: string;
    };

type QuoteTemplate = {
  id?: string;
  name: string;
  style?: { primary?: string; fontFamily?: string };
  sections: Section[];
};

interface QuoteComposerProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  template?: QuoteTemplate;
}

function formatCell(v: any, type?: Column['type']) {
  if (v == null) return '';
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(Number(v)||0);
    case 'number':
      return String(v);
    case 'date': {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    default:
      return String(v);
  }
}

async function handleDeleteTemplate() {
    if (!confirm('確定要移除這個模板？此動作無法復原')) return;
    // TODO: 呼叫後端 API 刪除模板（需提供 template.id）
    alert('模板已移除（請串接 API）');
  }

export default function QuoteComposer({ isOpen, onClose, caseId, template }: QuoteComposerProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<Dict>({});
  const [items, setItems] = useState<Dict[]>([]);
  const [tagList, setTagList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [designMode, setDesignMode] = useState(false);
  const [tplName, setTplName] = useState(template?.name || "自訂報價單模板");

  const fallbackTemplate: QuoteTemplate = {
    name: '律師費用報價單（預設）',
    style: { primary: '#334d6d', fontFamily: 'Noto Sans TC, sans-serif' },
    sections: [
      { type: 'header', html: '<h1 style="font-weight:700;margin:0">律師費用報價單</h1><div>{{ firm.firm_name }}</div>' },
      { type: 'text', markdown: '委任人 {{ case.client_name }} 於 {{ case.court }} 第 {{ case.case_number }} 號案件，委任律師 {{ case.lawyer_name }}。' },
      { type: 'divider' },
      {
        type: 'table',
        title: '費用明細',
        columns: [
          { key:'item', header:'項目', width:'40%' },
          { key:'qty', header:'數量', width:'10%', type:'number' },
          { key:'unit_price', header:'單價', width:'20%', type:'currency' },
          { key:'subtotal', header:'小計', width:'20%', type:'currency', formula:'qty * unit_price' },
          { key:'note', header:'備註', width:'10%' },
        ],
        items_path: 'quote.items',
        show_total: true,
        total_formula: 'sum(subtotal)',
      },
      { type: 'spacer', size: 12 },
      { type: 'text', markdown: '**付款方式**：{{ quote.payment }}  \n**有效期限**：{{ quote.valid_until | date("YYYY-MM-DD") }}' },
    ]
  };

  const tpl = template || fallbackTemplate;

  // 載入上下文資料 + tagList
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/quote-context/${caseId}`);
        const data = await res.json();
        const base = data?.context ?? {};
        base.quote = { items: [], payment: '匯款 / 現金', valid_until: new Date().toISOString() };
        setCtx(base);
        setItems(base.quote.items);
        setTagList(data?.tagList ?? []);
      } catch (e) {
        console.error('load context failed', e);
        try {
          const res = await apiFetch(`/api/cases/${caseId}`);
          const caseData = await res.json();
          setCtx({ case: caseData, firm: {}, quote: { items: [], payment:'', valid_until:new Date().toISOString() } });
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, caseId]);

  const computedItems = useMemo(() => {
    const t = tpl.sections.find(s => s.type === 'table') as Extract<Section,{type:'table'}> | undefined;
    if (!t) return items;
    return items.map(row => computeRow(row, t.columns));
  }, [items, tpl]);

  const totalValue = useMemo(() => {
    const table = tpl.sections.find(s => s.type === 'table') as Extract<Section,{type:'table'}> | undefined;
    if (!table || !table.total_formula) return 0;
    if (!/sum\(/.test(table.total_formula)) {
      const scope: Dict = {};
      return evalExpr(table.total_formula, scope);
    }
    const m = /sum\((\w+)\)/.exec(table.total_formula);
    const key = m?.[1] ?? 'subtotal';
    return computedItems.reduce((s, r) => s + (Number(r[key])||0), 0);
  }, [computedItems, tpl]);

  const addRow = () => setItems(prev => [...prev, { item: '', qty: 1, unit_price: 0, note: '' }]);
  const delRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateCell = (idx: number, key: string, val: any) =>
    setItems(prev => prev.map((r,i) => i===idx ? { ...r, [key]: val } : r));

  const handleExportPDF = async () => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2 });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210, pageHeight = 297;
      const imgWidth = pageWidth - 20, imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(img, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
      pdf.save(`quote-${caseId}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const payload = {
        name: tplName || "自訂報價單模板",
        description: "",
        content_json: tpl,
        is_default: false,
      };
      const res = await apiFetch(`/api/quote-templates?firm_code=${encodeURIComponent(firmCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({detail:""}));
        alert(`儲存失敗：${err.detail || res.statusText}`);
        return;
      }
      alert("模板已儲存！");
    } catch (e:any) {
      alert("儲存模板發生錯誤：" + (e.message || "未知錯誤"));
    }
  };

  const handleSaveToCase = async () => {
    if (!previewRef.current) return;
    const canvas = await html2canvas(previewRef.current, { scale: 2 });
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b || new Blob()), 'image/png', 1));
    const file = new File([blob], `quote-${Date.now()}.png`, { type: 'image/png' });
    const form = new FormData();
    form.append('file', file);
    form.append('folder_type', 'progress');
    const firmCode = getFirmCodeOrThrow();
    await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`, {
      method: 'POST',
      body: form,
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    alert('已儲存到案件資料夾');
  };

  if (!isOpen) return null;

  const primary = tpl.style?.primary ?? '#334d6d';
  const fontFamily = tpl.style?.fontFamily ?? 'Noto Sans TC, sans-serif';

  const renderSection = (s: Section, i: number) => {
    if (s.type === 'header') {
      return (
        <div key={i} style={{ textAlign:'center', borderBottom:`2px solid ${primary}`, paddingBottom:16, marginBottom:24 }}>
          <div dangerouslySetInnerHTML={{ __html: renderString(s.html, ctx) }} />
        </div>
      );
    }
    if (s.type === 'text') {
      const html = s.html ?? (s.markdown ? renderString(s.markdown, ctx).replace(/\n/g,'<br/>') : '');
      return (
        <div key={i} className="mb-4">
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {designMode && (
            <select
              className="mt-2 border rounded px-2 py-1 text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  alert(`插入標籤：{{ ${e.target.value} }}`);
                  e.target.value = '';
                }
              }}
            >
              <option value="">插入標籤...</option>
              {tagList.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
        </div>
      );
    }
    if (s.type === 'divider') return <hr key={i} className="my-4" />;
    if (s.type === 'spacer') return <div key={i} style={{ height: s.size ?? 12 }} />;
    if (s.type === 'table') {
      return (
        <div key={i} className="my-4">
          {s.title && <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  {s.columns.map(c => (
                    <th key={c.key} className="px-3 py-2 text-left text-sm text-gray-700 border-b" style={{ width: c.width }}>{c.header}</th>
                  ))}
                  <th className="px-2 py-2 border-b"></th>
                </tr>
              </thead>
              <tbody>
                {computedItems.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    {s.columns.map(c => (
                      <td key={c.key} className="px-3 py-2 text-sm" style={{ textAlign: c.align ?? 'left' }}>
                        {c.type === 'formula'
                          ? formatCell(row[c.key], c.type)
                          : (
                            <input
                              className="w-full outline-none"
                              value={row[c.key] ?? ''}
                              onChange={e => updateCell(idx, c.key, c.type==='number' || c.type==='currency' ? Number(e.target.value) : e.target.value)}
                            />
                          )
                        }
                      </td>
                    ))}
                    <td className="px-2 text-right">
                      <button onClick={() => delRow(idx)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {s.show_total && (
                <tfoot className="bg-gray-100">
                  <tr>
                    <td className="px-3 py-3 text-sm font-semibold" colSpan={s.columns.length - 1}>總計</td>
                    <td className="px-3 py-3 text-sm font-bold text-right">
                      {new Intl.NumberFormat('zh-TW', { style:'currency', currency:'TWD', minimumFractionDigits:0 }).format(totalValue)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <button onClick={addRow} className="mt-2 inline-flex items-center px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
            <Plus className="w-4 h-4 mr-1"/>新增一列
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-[#334d6d] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5"/><span>建立報價單（可客製模板）</span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 p-4 overflow-auto" style={{ fontFamily }}>
          <div ref={previewRef} className="bg-white shadow p-8 mx-auto" style={{ width:'210mm', minHeight:'297mm' }}>
            {loading ? <div>載入中…</div> : tpl.sections.map(renderSection)}
          </div>
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 flex items-center gap-3 justify-end">
          <label className="mr-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={designMode} onChange={e=>setDesignMode(e.target.checked)} />
            設計模式（可插入標籤）
          </label>

          <input
            value={tplName}
            onChange={e=>setTplName(e.target.value)}
            placeholder="模板名稱"
            className="px-3 py-2 border rounded"
            style={{ minWidth: 200 }}
          />

          <button onClick={handleSaveTemplate} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">
            儲存模板
          </button>
          <button onClick={handleDeleteTemplate} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">移除模板</button>

          <button onClick={handleSaveToCase} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">儲存到案件</button>
          <button disabled={exporting} onClick={handleExportPDF} className="px-4 py-2 rounded bg-[#334d6d] text-white hover:bg-[#3f5a7d] inline-flex items-center gap-2">
            <Download className="w-4 h-4"/>{exporting ? '匯出中…' : '匯出'}
          </button>
        </div>
      </div>
    </div>
  );
}

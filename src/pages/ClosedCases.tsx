import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, Trash2, X } from 'lucide-react';
import { apiFetch } from '../utils/api';

/** 確認對話框 */
interface CustomConfirmDialogProps {
  isOpen: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
}
const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-800 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">取消</button>
          <button onClick={onConfirm} className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d]">確定</button>
        </div>
      </div>
    </div>
  );
};

/** 成功對話框 */
interface CustomSuccessDialogProps { isOpen: boolean; title: string; message: string; onClose: () => void; }
const CustomSuccessDialog: React.FC<CustomSuccessDialogProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-800 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">確定</button>
        </div>
      </div>
    </div>
  );
};

type CaseItem = {
  id: string;
  caseNumber: string;
  client: string;
  caseType: string;
  lawyer: string;
  closedDate: string;
};

export default function ClosedCases() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [filteredCases, setFilteredCases] = useState<CaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const allSelected = filteredCases.length > 0 && selectedCaseIds.length === filteredCases.length;

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState<CaseItem | null>(null);

  const readJson = async (res: Response) => {
    try { return await res.json(); } catch { return {}; }
  };

  /** 載入結案案件 */
  const loadClosedCases = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/cases?status=closed');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || '載入結案案件失敗');

      const transformed: CaseItem[] = (data.items || []).map((item: any) => ({
        id: item.id,
        caseNumber: item.case_number || '',
        client: item.client_name || item.client?.name || '',
        caseType: item.case_type || '',
        lawyer: item.lawyer_name || item.lawyer?.full_name || '',
        closedDate: item.closed_at || item.progress_date || new Date().toISOString().split('T')[0],
      }));
      setCases(transformed);
    } catch (e) {
      console.error(e);
      alert(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClosedCases(); }, [loadClosedCases]);

  /** 搜尋 */
  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredCases(cases); return; }
    const term = searchTerm.toLowerCase();
    setFilteredCases(
      cases.filter(c =>
        [c.caseNumber, c.client, c.caseType, c.lawyer].some(v => String(v).toLowerCase().includes(term))
      )
    );
  }, [searchTerm, cases]);

  /** 匯出 */
  const handleExportData = (caseItem: CaseItem) => {
    setSelectedCaseForExport(caseItem);
    setDialogMessage(`確定要匯出案件「${caseItem.client} - ${caseItem.caseNumber}」嗎？`);
    setShowConfirmDialog(true);
  };
  const confirmExport = () => {
    setShowConfirmDialog(false);
    setTimeout(() => {
      if (!selectedCaseForExport) return;
      setDialogMessage(`案件「${selectedCaseForExport.client} - ${selectedCaseForExport.caseNumber}」匯出成功！`);
      setShowSuccessDialog(true);
      setSelectedCaseForExport(null);
    }, 800);
  };
  const cancelExport = () => { setShowConfirmDialog(false); setSelectedCaseForExport(null); };

  /** 單筆刪除（修正成 /api 前綴） */
  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('確定要刪除此案件嗎？')) return;
    try {
      const res = await apiFetch(`/api/cases/${caseId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await readJson(res);
        throw new Error(err?.detail || '刪除失敗，請稍後再試');
      }
      setCases(prev => prev.filter(c => c.id !== caseId));
      setSelectedCaseIds(prev => prev.filter(id => id !== caseId));
      if (selectedCase?.id === caseId) setSelectedCase(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || String(e));
    }
  };

  /** 批次刪除（修正路徑 & 明確 JSON） */
  const handleBatchDelete = async () => {
    if (selectedCaseIds.length === 0) return;
    if (!confirm(`確定要刪除 ${selectedCaseIds.length} 筆案件嗎？`)) return;

    try {
      const res = await apiFetch(`/api/cases/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedCaseIds }),
      });
      if (!res.ok) {
        const err = await readJson(res);
        throw new Error(err?.detail || '批次刪除失敗，請稍後再試');
      }
      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      if (selectedCase && selectedCaseIds.includes(selectedCase.id)) setSelectedCase(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || String(e));
    }
  };

  /** 全選 / 取消 */
  const handleSelectAll = (selectAll: boolean) => {
    setSelectedCaseIds(selectAll ? filteredCases.map(c => c.id) : []);
  };
  /** 單筆勾選 */
  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋結案案件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm w-full sm:w-64"
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個結案案件
          </div>
        )}
      </div>

      {/* 列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">選擇</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案號</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">當事人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案件類型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">律師</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">結案日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCases.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedCase(row)}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(row.id)}
                        onChange={() => toggleSelectCase(row.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.caseNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.client}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {row.caseType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.lawyer}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.closedDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleExportData(row)} className="text-gray-400 hover:text-green-600 transition-colors" title="匯出資料">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCase(row.id)} className="text-red-500 hover:text-red-700" title="刪除此案件">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCases.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">無符合條件的結案案件</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">結案詳情</h3>
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleExportData(selectedCase)} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2">
                    <Download className="w-4 h-4" /><span>匯出資料</span>
                  </button>
                  <button onClick={() => setSelectedCase(null)} className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="關閉詳情">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-500">案號</label><p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p></div>
                <div><label className="text-sm font-medium text-gray-500">當事人</label><p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p></div>
                <div><label className="text-sm font-medium text-gray-500">案件類型</label><p className="text-sm text-gray-900 mt-1">{selectedCase.caseType}</p></div>
                <div><label className="text-sm font-medium text-gray-500">律師</label><p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p></div>
                <div><label className="text-sm font-medium text-gray-500">結案日期</label><p className="text-sm text-gray-900 mt-1">{selectedCase.closedDate}</p></div>
                <button onClick={() => setSelectedCase(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="關閉詳情">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 批量操作工具列（手機版支援） */}
      {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4">
          <div className="animate-slide-up">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4">
              <div className="text-center mb-3">
                <span className="text-sm text-gray-700 font-medium">已選擇 {selectedCaseIds.length} 筆案件</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                  <button onClick={() => handleSelectAll(true)} disabled={allSelected}
                    className={`w-full sm:w-auto px-4 py-2 text-sm underline transition-colors rounded-md ${
                      allSelected ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}>
                    {allSelected ? '已全選' : '全選'}
                  </button>
                  <button onClick={() => handleSelectAll(false)} className="w-full sm:w-auto px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm underline rounded-md">
                    取消選擇
                  </button>
                </div>
                <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
                <button onClick={handleBatchDelete} className="w-full sm:w-auto bg-red-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center justify-center space-x-2 hover:shadow-md">
                  <Trash2 className="w-4 h-4" /><span>刪除</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 對話框 */}
      <CustomConfirmDialog isOpen={showConfirmDialog} title="確認匯出" message={dialogMessage} onConfirm={confirmExport} onCancel={cancelExport} />
      <CustomSuccessDialog isOpen={showSuccessDialog} title="匯出成功" message={dialogMessage} onClose={() => setShowSuccessDialog(false)} />
    </div>
  );
}

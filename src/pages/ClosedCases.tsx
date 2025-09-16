import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, Trash2, X } from 'lucide-react';
import { apiFetch } from '../utils/api';

// 自訂確認對話框組件
interface CustomConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-800 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};

// 自訂成功對話框組件
interface CustomSuccessDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

const CustomSuccessDialog: React.FC<CustomSuccessDialogProps> = ({
  isOpen,
  title,
  message,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-800 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ClosedCases() {
  const [cases, setCases] = useState<any[]>([]);
  const [filteredCases, setFilteredCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState<any | null>(null);

  // ✅ 新增：多選狀態
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const allSelected = filteredCases.length > 0 && selectedCaseIds.length === filteredCases.length;

  // 載入結案案件列表
  const loadClosedCases = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/cases?status=closed');
      const data = await response.json();

      if (response.ok) {
        const transformedCases = (data.items || []).map((item: any) => ({
          id: item.id,
          caseNumber: item.case_number || '',
          client: item.client_name || item.client?.name || '',
          caseType: item.case_type || '',
          lawyer: item.lawyer_name || item.lawyer?.full_name || '',
          closedDate: item.closed_at || item.progress_date || new Date().toISOString().split('T')[0],
        }));
        setCases(transformedCases);
      }
    } catch (error) {
      console.error('載入結案案件錯誤:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClosedCases();
  }, [loadClosedCases]);

  // 搜尋功能
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCases(cases);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = cases.filter((c) =>
      [c.caseNumber, c.client, c.caseType, c.lawyer].some((v) =>
        String(v).toLowerCase().includes(term)
      )
    );
    setFilteredCases(filtered);
  }, [searchTerm, cases]);

  // 匯出
  const handleExportData = (caseItem: any) => {
    setSelectedCaseForExport(caseItem);
    setDialogMessage(`確定要匯出案件「${caseItem.client} - ${caseItem.caseNumber}」嗎？`);
    setShowConfirmDialog(true);
  };

  const confirmExport = () => {
    setShowConfirmDialog(false);
    setTimeout(() => {
      setDialogMessage(`案件「${selectedCaseForExport.client} - ${selectedCaseForExport.caseNumber}」匯出成功！`);
      setShowSuccessDialog(true);
      setSelectedCaseForExport(null);
    }, 1000);
  };

  const cancelExport = () => {
    setShowConfirmDialog(false);
    setSelectedCaseForExport(null);
  };

  // 單筆刪除
  const handleDeleteCase = async (caseId: string) => {
    if (!confirm("確定要刪除此案件嗎？")) return;
    try {
      await apiFetch(`/cases/${caseId}`, { method: "DELETE" });
      setCases((prev) => prev.filter((c) => c.id !== caseId));
      setSelectedCaseIds((prev) => prev.filter((id) => id !== caseId));
    } catch (err) {
      console.error("刪除失敗", err);
    }
  };

  // ✅ 批次刪除
  const handleBatchDelete = async () => {
    if (!confirm(`確定要刪除 ${selectedCaseIds.length} 筆案件嗎？`)) return;
    try {
      await apiFetch(`/cases/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ ids: selectedCaseIds }),
      });
      setCases((prev) => prev.filter((c) => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
    } catch (err) {
      console.error("批次刪除失敗", err);
    }
  };

  // ✅ 全選/取消選取
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedCaseIds(filteredCases.map((c) => c.id));
    } else {
      setSelectedCaseIds([]);
    }
  };

  // ✅ 勾選單筆
  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 案件列表 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">案號</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">當事人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">案件類型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">律師</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">結案日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCases.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                  } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.includes(row.id)}
                      onChange={() => toggleSelectCase(row.id)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.caseNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.client}</td>
                  <td className="px-6 py-4 text-sm">{row.caseType}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.lawyer}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{row.closedDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleExportData(row)}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="匯出資料"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCase(row.id)}
                        className="text-red-500 hover:text-red-700"
                        title="刪除此案件"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ 批量操作工具列 */}
      {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4">
          <div className="animate-slide-up">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4">
              <div className="text-center mb-3">
                <span className="text-sm text-gray-700 font-medium">
                  已選擇 {selectedCaseIds.length} 筆案件
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                  <button
                    onClick={() => handleSelectAll(true)}
                    disabled={allSelected}
                    className={`w-full sm:w-auto px-4 py-2 text-sm underline transition-colors rounded-md ${
                      allSelected
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {allSelected ? '已全選' : '全選'}
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm underline transition-colors rounded-md"
                  >
                    取消選擇
                  </button>
                </div>
                <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
                <button
                  onClick={handleBatchDelete}
                  className="w-full sm:w-auto bg-red-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center justify-center space-x-2 transition-all hover:shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>刪除</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 對話框 */}
      <CustomConfirmDialog
        isOpen={showConfirmDialog}
        title="確認匯出"
        message={dialogMessage}
        onConfirm={confirmExport}
        onCancel={cancelExport}
      />
      <CustomSuccessDialog
        isOpen={showSuccessDialog}
        title="匯出成功"
        message={dialogMessage}
        onClose={() => setShowSuccessDialog(false)}
      />
    </div>
  );
}

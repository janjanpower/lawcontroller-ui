import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, Trash2, X, RotateCcw } from 'lucide-react'
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import FolderTree from '../components/FolderTree';


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
          <button onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">取消</button>
          <button onClick={onConfirm} className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d]">確定</button>
        </div>
      </div>
    </div>
  );
};

// 自訂成功對話框組件
interface CustomSuccessDialogProps { isOpen: boolean; title: string; message: string; onClose: () => void; }
const CustomSuccessDialog: React.FC<CustomSuccessDialogProps> = ({ isOpen, title, message, onClose }) => {
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
          <button onClick={onClose} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">確定</button>
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
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const allSelected = filteredCases.length > 0 && selectedCaseIds.length === filteredCases.length;

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState<any | null>(null);

  // 載入結案案件
  const loadClosedCases = React.useCallback(async () => {
    setLoading(true);
    try {
      const firmCode = getFirmCodeOrThrow();
      // 直接查詢已結案的案件
      const response = await apiFetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}&status=closed`);
      const data = await response.json();

      console.log('API 回應資料:', data);

      if (response.ok) {
        // 取得已結案的案件
        const closedCases = data.items || [];

        console.log('已結案案件數量:', closedCases.length);

        const transformedCases = closedCases.map((item: any) => ({
          id: item.id,
          caseNumber: item.case_number || '',
          client: item.client_name || item.client?.name || '',
          caseType: item.case_type || '',
          lawyer: item.lawyer_name || item.lawyer?.full_name || '',
          closedDate: item.closed_at ? item.closed_at.split('T')[0] : (item.updated_at ? item.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        }));

        console.log('轉換後的結案案件:', transformedCases);
        setCases(transformedCases);
      } else {
        console.error('載入結案案件失敗:', data);
      }
    } catch (error) {
      console.error('載入結案案件錯誤:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClosedCases(); }, [loadClosedCases]);


  // 匯出所有案件的報價單
  const handleExportQuoteAll = () => {
    if (filteredCases.length === 0) {
      alert("目前沒有案件可匯出報價單");
      return;
    }
    setDialogMessage(`確定要匯出 ${filteredCases.length} 筆結案案件的報價單嗎？`);
    setShowConfirmDialog(true);
  };

  // 還原案件
  const handleReopenCase = async (caseId: string) => {
    if (!confirm('確定要還原此案件嗎？')) return;
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(
        `/api/cases/${caseId}/restore?firm_code=${encodeURIComponent(firmCode)}`,
        { method: 'POST' }
      );

      if (res.ok) {
        // ✅ 重新載入結案案件列表
        await loadClosedCases();

        // ✅ 移除選取中的案件
        setSelectedCaseIds(prev => prev.filter(id => id !== caseId));

        // ✅ 如果正在看詳情，且是同一個案件 → 清掉
        setSelectedCase(prev => (prev?.id === caseId ? null : prev));

        // ✅ 顯示成功訊息（用 CustomSuccessDialog）
        setDialogMessage('案件已還原到案件總覽');
        setShowSuccessDialog(true);
      } else {
        const err = await res.json();
        alert(err?.detail || '還原失敗');
      }
    } catch (e: any) {
      console.error(e);
      alert('還原發生錯誤: ' + (e.message || '未知錯誤'));
    }
  };


  // 批量下載
const handleBatchDownload = async () => {
  if (selectedCaseIds.length === 0) return;
  const firmCode = getFirmCodeOrThrow();

  try {
    const res = await fetch(`/api/cases/batch-download?firm_code=${encodeURIComponent(firmCode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedCaseIds),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err?.detail || "下載失敗");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cases.zip";
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    alert("下載發生錯誤: " + (e.message || "未知錯誤"));
  }
};


  // 批量還原
  const handleBatchRestore = async () => {
    if (selectedCaseIds.length === 0) return;
    if (!confirm(`確定要還原 ${selectedCaseIds.length} 筆案件嗎？`)) return;

    try {
      const firmCode = getFirmCodeOrThrow();
      let successCount = 0;

      for (const caseId of selectedCaseIds) {
        const res = await apiFetch(
          `/api/cases/${caseId}/restore?firm_code=${encodeURIComponent(firmCode)}`,
          { method: 'POST' }
        );
        if (res.ok) successCount++;
      }

      // ✅ 統一刷新
      await loadClosedCases();

      // ✅ 清除選取
      setSelectedCaseIds([]);
      setSelectedCase(null);

      // ✅ 用 CustomSuccessDialog 顯示結果
      setDialogMessage(`成功還原 ${successCount} 筆案件到案件總覽`);
      setShowSuccessDialog(true);

    } catch (err: any) {
      console.error(err);
      alert('批量還原失敗: ' + (err.message || '未知錯誤'));
    }
  };



  // 搜尋
  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredCases(cases); return; }
    const term = searchTerm.toLowerCase();
    setFilteredCases(
      cases.filter(c =>
        [c.caseNumber, c.client, c.caseType, c.lawyer].some(v => String(v).toLowerCase().includes(term))
      )
    );
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
      if (!selectedCaseForExport) return;
      setDialogMessage(`案件「${selectedCaseForExport.client} - ${selectedCaseForExport.caseNumber}」匯出成功！`);
      setShowSuccessDialog(true);
      setSelectedCaseForExport(null);
    }, 800);
  };
  const cancelExport = () => { setShowConfirmDialog(false); setSelectedCaseForExport(null); };

  // 單筆刪除 ✅ 修正路徑
  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('確定要刪除此案件嗎？')) return;
    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        setSelectedCaseIds(prev => prev.filter(id => id !== caseId));
        if (selectedCase?.id === caseId) setSelectedCase(null);
        alert('案件已刪除');
      } else {
        const err = await res.json();
        alert(err?.detail || '刪除失敗');
      }
    } catch (e) {
      console.error(e);
      alert('刪除發生錯誤: ' + (e.message || '未知錯誤'));
    }
  };

  // 批次刪除 ✅ 修正路徑
  const handleBatchDelete = async () => {
    if (selectedCaseIds.length === 0) return;
    if (!confirm(`確定要刪除 ${selectedCaseIds.length} 筆案件嗎？`)) return;

    setLoading(true);
    try {
      const firmCode = getFirmCodeOrThrow();
      let successCount = 0;
      let failedCases = [];

      // 逐一刪除每個案件
      for (const caseId of selectedCaseIds) {
        try {
          const res = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            successCount++;
          } else {
            const err = await res.json();
            const caseInfo = cases.find(c => c.id === caseId);
            failedCases.push(`${caseInfo?.client || caseId}: ${err?.detail || '刪除失敗'}`);
          }
        } catch (error) {
          const caseInfo = cases.find(c => c.id === caseId);
          failedCases.push(`${caseInfo?.client || caseId}: ${error.message || '網路錯誤'}`);
        }
      }

      // 更新本地狀態 - 移除成功刪除的案件
      const successfullyDeleted = selectedCaseIds.slice(0, successCount);
      setCases(prev => prev.filter(c => !successfullyDeleted.includes(c.id)));
      setSelectedCaseIds([]);

      if (selectedCase && successfullyDeleted.includes(selectedCase.id)) {
        setSelectedCase(null);
      }

      // 顯示結果
      if (failedCases.length === 0) {
        alert(`成功刪除 ${successCount} 筆案件`);
      } else {
        alert(`成功刪除 ${successCount} 筆案件\n\n失敗的案件：\n${failedCases.join('\n')}`);
      }

    } catch (e) {
      console.error(e);
      alert('批次刪除發生錯誤: ' + (e.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (selectAll: boolean) => {
    setSelectedCaseIds(selectAll ? filteredCases.map(c => c.id) : []);
  };
  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* 匯出報價單（放左邊） */}
            <button
              onClick={() => handleExportQuoteAll()}
              className="px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] text-sm font-medium"
            >
              匯出報價單
            </button>

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

            {/* 篩選按鈕 */}
            <button onClick={() => setShowFilters(!showFilters)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">選擇</th>
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
                <React.Fragment key={row.id}>
                  {/* 案件主列 */}
                  <tr
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`}
                    onClick={() =>
                      setExpandedCaseId(expandedCaseId === row.id ? null : row.id)
                    }
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(row.id)}
                        onChange={() => toggleSelectCase(row.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">{row.caseNumber}</td>
                    <td className="px-6 py-4 text-sm">{row.client}</td>
                    <td className="px-6 py-4 text-sm">{row.caseType}</td>
                    <td className="px-6 py-4 text-sm">{row.lawyer}</td>
                    <td className="px-6 py-4 text-sm">{row.closedDate}</td>
                    <td className="px-6 py-4 text-sm"> ... 操作按鈕 ... </td>
                  </tr>

                  {/* ✅ 展開列 (放在主列後面) */}
                  {expandedCaseId === row.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-6 py-3">
                        <FolderTree
                          caseId={row.id}
                          clientName={row.client}
                          isExpanded={true}
                          onToggle={() => setExpandedCaseId(null)}
                          readOnly
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* 批量操作工具列 */}
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
                {/* 批量下載 */}
                <button
                  onClick={handleBatchDownload}
                  className="w-full sm:w-auto bg-blue-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-blue-600 flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>下載</span>
                </button>


                {/* 批量還原 */}
                <button
                  onClick={handleBatchRestore}
                  className="w-full sm:w-auto bg-green-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-green-600 flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>還原</span>
                </button>

                {/* 批量刪除 */}
                <button
                  onClick={handleBatchDelete}
                  className="w-full sm:w-auto bg-red-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center justify-center space-x-2"
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
      <CustomConfirmDialog isOpen={showConfirmDialog} title="確認匯出" message={dialogMessage} onConfirm={confirmExport} onCancel={cancelExport} />
      <CustomSuccessDialog isOpen={showSuccessDialog} title="匯出成功" message={dialogMessage} onClose={() => setShowSuccessDialog(false)} />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, FileText, User, Building, Eye, Folder, X, CheckSquare, Square, Archive, Trash2 } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { saveAs } from 'file-saver';

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
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // 載入結案案件列表
  const loadClosedCases = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/cases?status=closed');
      const data = await response.json();

      if (response.ok) {
        // 轉換後端資料為前端格式
        const transformedCases = (data.items || []).map((item: any) => ({
          id: item.id,
          caseNumber: item.case_number || '',
          client: item.client_name || item.client?.name || '',
          caseType: item.case_type || '',
          lawyer: item.lawyer_name || item.lawyer?.full_name || '',
          legalAffairs: item.legal_affairs_name || item.legal_affairs?.full_name || '',
          caseReason: item.case_reason || '',
          opposingParty: item.opposing_party || '',
          court: item.court || '',
          division: item.division || '',
          progress: item.progress || '',
          progressDate: item.progress_date || '',
          closedDate: item.closed_at || item.progress_date || new Date().toISOString().split('T')[0],
          status: 'completed',
          stages: [] // 可以後續從 API 載入
        }));
        setCases(transformedCases);
      } else {
        console.error('載入結案案件失敗:', data.detail);
      }
    } catch (error) {
      console.error('載入結案案件錯誤:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
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
      [
        c.id,
        c.caseNumber,
        c.client,
        c.caseType,
        c.lawyer,
        c.legalAffairs,
        c.caseReason,
        c.opposingParty,
        c.court,
        c.division,
      ]
        .map((v) => String(v).toLowerCase())
        .some((v) => v.includes(term))
    );
    setFilteredCases(filtered);
  }, [searchTerm, cases]);

  // 全選/取消全選
  const handleSelectAll = () => {
    if (selectedCases.length === filteredCases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(filteredCases.map(c => c.id));
    }
  };

  // 單選案件
  const handleSelectCase = (caseId: string) => {
    setSelectedCases(prev =>
      prev.includes(caseId)
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  // 批量匯出資料
  const handleBatchExport = async () => {
    if (selectedCases.length === 0) {
      alert('請先選擇要匯出的案件');
      return;
    }

    const selectedCaseData = cases.filter(c => selectedCases.includes(c.id));
    setDialogMessage(
      `確定要匯出 ${selectedCases.length} 個結案案件的完整資料嗎？\n\n` +
      `將會匯出以下內容：\n` +
      `• 所有案件的狀紙資料夾\n` +
      `• 案件資訊 Excel 檔案\n` +
      `• 進度追蹤資料夾\n` +
      `• 所有階段相關文件\n` +
      `• 案件摘要報告\n\n` +
      `匯出案件：\n${selectedCaseData.map(c => `• ${c.client} - ${c.caseNumber}`).join('\n')}`
    );
    setShowConfirmDialog(true);
  };

  // 單一案件匯出
  const handleExportData = React.useCallback((caseItem) => {
    setSelectedCaseForExport(caseItem);
    setDialogMessage(
      `確定要匯出案件「${caseItem.client} - ${caseItem.caseNumber}」的完整資料嗎？\n\n` +
      `將會匯出以下內容：\n` +
      `• 狀紙資料夾及所有文件\n` +
      `• 案件資訊 Excel 檔案\n` +
      `• 進度追蹤資料夾及階段文件\n` +
      `• 案件摘要報告\n` +
      `• 所有相關附件`
    );
    setShowConfirmDialog(true);
  }, []);

  // 實際匯出功能
  const performExport = async (casesToExport: any[]) => {
    setIsExporting(true);
    try {
      const firmCode = getFirmCodeOrThrow();

      for (const caseItem of casesToExport) {
        try {
          // 1. 取得案件完整資料
          const caseResponse = await apiFetch(`/api/cases/${caseItem.id}?firm_code=${encodeURIComponent(firmCode)}`);
          const caseData = await caseResponse.json();

          // 2. 取得案件檔案列表
          const filesResponse = await apiFetch(`/api/cases/${caseItem.id}/files?firm_code=${encodeURIComponent(firmCode)}`);
          const filesData = await filesResponse.json();

          // 3. 取得案件階段
          const stagesResponse = await apiFetch(`/api/cases/${caseItem.id}/stages?firm_code=${encodeURIComponent(firmCode)}`);
          const stagesData = await stagesResponse.json();

          // 4. 建立案件摘要 Excel
          const summaryData = {
            案號: caseData.case_number || '',
            當事人: caseData.client_name || '',
            案件類型: caseData.case_type || '',
            案由: caseData.case_reason || '',
            對造: caseData.opposing_party || '',
            法院: caseData.court || '',
            股別: caseData.division || '',
            律師: caseData.lawyer_name || '',
            法務: caseData.legal_affairs_name || '',
            結案日期: caseItem.closedDate,
            最終進度: caseData.progress || '',
            階段數量: Array.isArray(stagesData) ? stagesData.length : 0,
            檔案數量: (filesData.pleadings?.length || 0) + (filesData.info?.length || 0) + (filesData.progress?.length || 0)
          };

          // 5. 建立 Excel 內容
          const XLSX = await import('xlsx');
          const wb = XLSX.utils.book_new();

          // 案件摘要工作表
          const summaryWs = XLSX.utils.json_to_sheet([summaryData]);
          XLSX.utils.book_append_sheet(wb, summaryWs, '案件摘要');

          // 階段記錄工作表
          if (Array.isArray(stagesData) && stagesData.length > 0) {
            const stagesForExcel = stagesData.map(stage => ({
              階段名稱: stage.stage_name || stage.name,
              日期: stage.stage_date,
              時間: stage.stage_time || '',
              完成狀態: stage.is_completed || stage.completed ? '已完成' : '未完成',
              備註: stage.note || '',
              建立時間: stage.created_at ? new Date(stage.created_at).toLocaleString('zh-TW') : ''
            }));
            const stagesWs = XLSX.utils.json_to_sheet(stagesForExcel);
            XLSX.utils.book_append_sheet(wb, stagesWs, '階段記錄');
          }

          // 檔案清單工作表
          const allFiles = [
            ...(filesData.pleadings || []).map(f => ({ ...f, 資料夾: '狀紙' })),
            ...(filesData.info || []).map(f => ({ ...f, 資料夾: '案件資訊' })),
            ...(filesData.progress || []).map(f => ({ ...f, 資料夾: '案件進度' }))
          ];

          if (allFiles.length > 0) {
            const filesForExcel = allFiles.map(file => ({
              檔案名稱: file.name,
              資料夾: file.資料夾,
              檔案大小: file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '',
              上傳時間: file.created_at ? new Date(file.created_at).toLocaleString('zh-TW') : '',
              檔案類型: file.content_type || ''
            }));
            const filesWs = XLSX.utils.json_to_sheet(filesForExcel);
            XLSX.utils.book_append_sheet(wb, filesWs, '檔案清單');
          }

          // 6. 匯出 Excel 檔案
          const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          const fileName = `結案案件_${caseItem.client}_${caseItem.caseNumber || caseItem.id}_${new Date().toISOString().split('T')[0]}.xlsx`;
          saveAs(excelBlob, fileName);

          console.log(`案件 ${caseItem.client} 資料匯出完成`);
        } catch (error) {
          console.error(`匯出案件 ${caseItem.client} 失敗:`, error);
        }
      }

      // 顯示成功訊息
      const exportedCount = casesToExport.length;
      setDialogMessage(
        `成功匯出 ${exportedCount} 個結案案件的完整資料！\n\n` +
        `匯出內容包括：\n` +
        `• 案件摘要 Excel 檔案\n` +
        `• 階段記錄詳情\n` +
        `• 檔案清單資訊\n\n` +
        `檔案已下載到您的下載資料夾中。`
      );
      setShowSuccessDialog(true);

      // 清除選擇
      setSelectedCases([]);
      setSelectedCaseForExport(null);

    } catch (error) {
      console.error('匯出過程發生錯誤:', error);
      alert(`匯出失敗: ${error.message || '請稍後再試'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const confirmExport = React.useCallback(() => {
    setShowConfirmDialog(false);

    if (selectedCaseForExport) {
      // 單一案件匯出
      performExport([selectedCaseForExport]);
    } else if (selectedCases.length > 0) {
      // 批量匯出
      const casesToExport = cases.filter(c => selectedCases.includes(c.id));
      performExport(casesToExport);
    }
  }, [selectedCaseForExport, selectedCases, cases]);

  const cancelExport = React.useCallback(() => {
    setShowConfirmDialog(false);
    setSelectedCaseForExport(null);
  }, []);

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedCases.length === 0) {
      alert('請先選擇要刪除的案件');
      return;
    }

    const selectedCaseData = cases.filter(c => selectedCases.includes(c.id));
    if (confirm(`確定要永久刪除 ${selectedCases.length} 個結案案件嗎？\n\n${selectedCaseData.map(c => `• ${c.client} - ${c.caseNumber}`).join('\n')}\n\n此操作無法復原！`)) {
      try {
        const firmCode = getFirmCodeOrThrow();

        for (const caseId of selectedCases) {
          const response = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            console.error(`刪除案件 ${caseId} 失敗`);
          }
        }

        // 重新載入列表
        await loadClosedCases();
        setSelectedCases([]);
        alert(`成功刪除 ${selectedCases.length} 個案件`);
      } catch (error) {
        console.error('批量刪除失敗:', error);
        alert('刪除失敗，請稍後再試');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-[#334d6d]">結案案件</h2>
              <span className="ml-3 text-sm text-gray-500">({filteredCases.length} 件)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* 搜尋 */}
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
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors self-center sm:self-auto"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 批量操作工具列 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                {selectedCases.length === filteredCases.length && filteredCases.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#334d6d]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>全選 ({selectedCases.length}/{filteredCases.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBatchExport}
                disabled={selectedCases.length === 0 || isExporting}
                className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>匯出中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    <span>批量匯出</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBatchDelete}
                disabled={selectedCases.length === 0}
                className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>批量刪除</span>
              </button>
            </div>
          </div>

          {/* 搜尋結果統計 */}
          {searchTerm && (
            <div className="text-sm text-green-600">
              找到 {filteredCases.length}/{cases.length} 個結案案件
            </div>
          )}
        </div>
      </div>

      {/* 案件列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            {/* 桌面版表格 */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center"
                      >
                        {selectedCases.length === filteredCases.length && filteredCases.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[#334d6d]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      案號
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      當事人
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      案件類型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      律師
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      結案日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCases.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${selectedCases.includes(row.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCase(row.id);
                          }}
                          className="flex items-center justify-center"
                        >
                          {selectedCases.includes(row.id) ? (
                            <CheckSquare className="w-4 h-4 text-[#334d6d]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                        onClick={() => setSelectedCase(row)}
                      >
                        {row.caseNumber}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                        onClick={() => setSelectedCase(row)}
                      >
                        {row.client}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => setSelectedCase(row)}
                      >
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {row.caseType}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                        onClick={() => setSelectedCase(row)}
                      >
                        {row.lawyer}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                        onClick={() => setSelectedCase(row)}
                      >
                        {row.closedDate}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedCase(row)}
                            className="text-gray-400 hover:text-[#334d6d] transition-colors"
                            title="檢視"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportData(row)}
                            className="text-gray-400 hover:text-green-600 transition-colors"
                            title="匯出資料"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機版卡片列表 */}
            <div className="lg:hidden p-4 space-y-3">
              {filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`bg-white rounded-lg border p-4 transition-all duration-200 ${
                    selectedCase?.id === caseItem.id ? 'border-[#334d6d] bg-blue-50 shadow-md' : 'border-gray-200 hover:shadow-sm'
                  } ${selectedCases.includes(caseItem.id) ? 'ring-2 ring-blue-200' : ''}`}
                >
                  {/* 頂部：選擇框和主要資訊 */}
                  <div className="flex items-start space-x-3 mb-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCase(caseItem.id);
                      }}
                      className="mt-1 flex-shrink-0"
                    >
                      {selectedCases.includes(caseItem.id) ? (
                        <CheckSquare className="w-5 h-5 text-[#334d6d]" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedCase(caseItem)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 text-base">{caseItem.client}</h3>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {caseItem.caseType}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        {caseItem.caseNumber && (
                          <div className="flex items-center">
                            <FileText className="w-3 h-3 mr-2 text-gray-400" />
                            <span className="font-medium">案號：</span>
                            <span>{caseItem.caseNumber}</span>
                          </div>
                        )}
                        {caseItem.lawyer && (
                          <div className="flex items-center">
                            <User className="w-3 h-3 mr-2 text-gray-400" />
                            <span className="font-medium">律師：</span>
                            <span>{caseItem.lawyer}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Archive className="w-3 h-3 mr-2 text-gray-400" />
                          <span className="font-medium">結案：</span>
                          <span>{caseItem.closedDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 底部：操作按鈕 */}
                  <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedCase(caseItem)}
                      className="text-[#334d6d] hover:text-[#3f5a7d] text-sm font-medium flex items-center space-x-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>檢視</span>
                    </button>
                    <button
                      onClick={() => handleExportData(caseItem)}
                      className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
                    >
                      <Download className="w-4 h-4" />
                      <span>匯出</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">結案案件詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExportData(selectedCase)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>匯出資料</span>
                  </button>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">案號</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">當事人</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">案件類型</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseType}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">案由</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason || '未填寫'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">律師</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">法務</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs || '未指派'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">法院</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.court || '未填寫'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">股別</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.division || '未填寫'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">對造</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty || '未填寫'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">最終進度</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.progress}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">結案日期</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.closedDate}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 自訂確認對話框 */}
      <CustomConfirmDialog
        isOpen={showConfirmDialog}
        title="確認匯出資料"
        message={dialogMessage}
        onConfirm={confirmExport}
        onCancel={cancelExport}
      />

      {/* 自訂成功對話框 */}
      <CustomSuccessDialog
        isOpen={showSuccessDialog}
        title="匯出成功"
        message={dialogMessage}
        onClose={() => setShowSuccessDialog(false)}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, FileText, User, Building, Eye, Folder, X } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState(null);

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

  // 匯出資料功能
  const handleExportData = React.useCallback((caseItem) => {
    setSelectedCaseForExport(caseItem);
    setDialogMessage(
      `確定要匯出案件「${caseItem.client} - ${caseItem.caseNumber}」的資料夾嗎？\n\n` +
      `將會匯出以下內容：\n` +
      `• 狀紙資料夾\n` +
      `• 案件資訊 (Excel檔案)\n` +
      `• 進度追蹤資料夾\n` +
      `• 所有階段相關文件`
    );
    setShowConfirmDialog(true);
  }, []);

  const confirmExport = React.useCallback(() => {
    setShowConfirmDialog(false);
    // 模擬匯出過程
    setTimeout(() => {
      setDialogMessage(
        `案件「${selectedCaseForExport.client} - ${selectedCaseForExport.caseNumber}」資料匯出成功！\n\n` +
        `匯出位置：下載資料夾\n` +
        `檔案名稱：${selectedCaseForExport.id}_${selectedCaseForExport.client}_結案資料.zip`
      );
      setShowSuccessDialog(true);
      setSelectedCaseForExport(null);
    }, 1000);
  }, [selectedCaseForExport]);

  const cancelExport = React.useCallback(() => {
    setShowConfirmDialog(false);
    setSelectedCaseForExport(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-[#334d6d]">結案案件</h2>
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

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個結案案件
          </div>
        )}
      </div>

      {/* 案件列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
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
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedCase(row)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.caseNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.client}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {row.caseType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.lawyer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
        </div>

        {/* 手機版卡片列表 */}
        <div className="lg:hidden p-4 space-y-4">
          {filteredCases.map((caseItem) => (
            <div
              key={caseItem.id}
              className={`bg-white rounded-xl border-2 p-4 transition-all duration-200 ${
                selectedCase?.id === caseItem.id 
                  ? 'border-[#334d6d] bg-blue-50 shadow-lg' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {/* 頂部：當事人和案號 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                    {caseItem.client}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    案號：{caseItem.caseNumber || '未設定'}
                  </p>
                </div>
                <div className="ml-3">
                  <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {caseItem.caseType}
                  </span>
                </div>
              </div>

              {/* 中間：案件資訊 */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-gray-500 w-12 flex-shrink-0">律師</span>
                  <span className="text-gray-900 font-medium">{caseItem.lawyer || '未指派'}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-gray-500 w-12 flex-shrink-0">結案</span>
                  <span className="text-gray-900">{caseItem.closedDate}</span>
                </div>
              </div>

              {/* 底部：操作按鈕 */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedCase(caseItem)}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#334d6d] text-white rounded-lg hover:bg-[#3f5a7d] transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  <span>檢視詳情</span>
                </button>
                
                <button
                  onClick={() => handleExportData(caseItem)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>匯出</span>
                </button>
              </div>
            </div>
          ))}

          {filteredCases.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? '找不到符合條件的結案案件' : '尚無結案案件'}
              </p>
            </div>
          )}
        </div>

        {/* 右側詳情面板 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            {/* 手機版全屏詳情 */}
            <div className="lg:hidden fixed inset-0 bg-white z-50 overflow-auto">
              {/* 手機版標題列 */}
              <div className="bg-[#334d6d] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-lg font-semibold">案件詳情</h3>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="p-2 text-white hover:text-gray-300 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 手機版詳情內容 */}
              <div className="p-4">
                {/* 當事人資訊卡片 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 text-lg mb-2">{selectedCase.client}</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-blue-700">案號：{selectedCase.caseNumber || '未設定'}</p>
                    <p className="text-blue-700">類型：{selectedCase.caseType}</p>
                  </div>
                </div>

                {/* 詳細資訊 */}
                <div className="space-y-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">案件資訊</h5>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <span className="text-gray-500 text-sm w-16 flex-shrink-0 mt-0.5">律師</span>
                        <span className="text-gray-900 text-sm font-medium">{selectedCase.lawyer || '未指派'}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 text-sm w-16 flex-shrink-0 mt-0.5">結案</span>
                        <span className="text-gray-900 text-sm">{selectedCase.closedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 手機版操作按鈕 */}
                <div className="space-y-3">
                  <button
                    onClick={() => handleExportData(selectedCase)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <Download className="w-5 h-5" />
                    <span>匯出當事人資料夾</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 桌面版詳情 */}
            <div className="hidden lg:block p-6">
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
                  <label className="text-sm font-medium text-gray-500">律師</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p>
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
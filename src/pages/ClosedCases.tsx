import React, { useState, useEffect } from 'react';
import { Download, Search, Filter, FileText, User, Building, Eye, Folder } from 'lucide-react';

// 模擬結案案件資料
const mockClosedCases = [
  {
    id: '3',
    caseNumber: '112年度行訴字第9012號',
    client: '趙六',
    caseType: '行政',
    lawyer: '黃律師',
    legalAffairs: '吳法務',
    caseReason: '行政處分撤銷',
    opposingParty: '市政府',
    court: '台北高等行政法院',
    division: '行政庭',
    progress: '已結案',
    progressDate: '2024-01-25',
    closedDate: '2024-01-25',
    stages: [
      { name: '委任', date: '2023-12-01', completed: true },
      { name: '起訴', date: '2023-12-15', completed: true },
      { name: '開庭', date: '2024-01-10', completed: true },
      { name: '判決', date: '2024-01-20', completed: true },
      { name: '已結案', date: '2024-01-25', completed: true },
    ],
  },
  {
    id: '4',
    caseNumber: '111年度民訴字第5678號',
    client: '李四',
    caseType: '民事',
    lawyer: '陳律師',
    legalAffairs: '林法務',
    caseReason: '契約糾紛',
    opposingParty: '王五',
    court: '台北地方法院',
    division: '民事庭',
    progress: '已結案',
    progressDate: '2024-01-20',
    closedDate: '2024-01-20',
    stages: [
      { name: '委任', date: '2023-11-01', completed: true },
      { name: '起訴', date: '2023-11-15', completed: true },
      { name: '調解', date: '2023-12-10', completed: true },
      { name: '和解', date: '2024-01-15', completed: true },
      { name: '已結案', date: '2024-01-20', completed: true },
    ],
  },
];

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
  const [cases, setCases] = useState(mockClosedCases);
  const [filteredCases, setFilteredCases] = useState(mockClosedCases);
  const [selectedCase, setSelectedCase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [selectedCaseForExport, setSelectedCaseForExport] = useState(null);

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
  const handleExportData = (caseItem) => {
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
  };

  const confirmExport = () => {
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
  };

  const cancelExport = () => {
    setShowConfirmDialog(false);
    setSelectedCaseForExport(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">結案案件</h2>
          </div>

          <div className="flex-1 flex items-center justify-end space-x-4">
            {/* 搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋結案案件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm w-64"
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

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個結案案件
          </div>
        )}
      </div>

      {/* 案件列表 + 右側詳情 */}
      <div className="flex-1 flex">
        {/* 列表 */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    ID
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
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedCase(row)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.id}
                    </td>
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

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">結案案件詳情</h3>
                <button
                  onClick={() => handleExportData(selectedCase)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>匯出資料</span>
                </button>
              </div>

              {/* 基本資訊 */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">案號</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">案由</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">對造</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">負責法院</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.court}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">結案日期</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.closedDate}</p>
                  </div>
                </div>
              </div>

              <hr className="my-6" />

              {/* 案件進度歷程 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">案件進度歷程</h4>
                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-2 rounded-md bg-gray-50">
                      <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                          <span className="text-xs text-gray-500">{stage.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
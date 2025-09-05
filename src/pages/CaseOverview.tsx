// src/pages/CaseOverview.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  FileText,
  User,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

import CaseForm from '../components/CaseForm';
import ImportDataDialog from '../components/ImportDataDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import DateReminderWidget from '../components/DateReminderWidget';

/** 供 CaseForm 使用的型別（與 CaseForm.tsx 相容） */
export interface FormCaseData {
  case_id?: string;
  case_type: string;
  client: string;
  lawyer?: string;
  legal_affairs?: string;
  case_reason?: string;
  case_number?: string;
  opposing_party?: string;
  court?: string;
  division?: string;
  progress?: string;
  progress_date?: string;
  created_date?: string;
}

/** 內部表格/詳情用型別（本頁維護資料結構） */
interface Stage {
  name: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  note?: string;
}

type Status = 'active' | 'pending' | 'completed' | 'urgent';

export interface TableCase {
  id: string;
  caseNumber: string;
  client: string;
  caseType: string;
  lawyer: string;
  legalAffairs: string;
  caseReason: string;
  opposingParty: string;
  court: string;
  division: string;
  progress: string;
  progressDate: string;
  status: Status;
  stages: Stage[];
}

/** DateReminderWidget 需要的資料型別 */
interface ReminderCaseData {
  case_id: string;
  client: string;
  case_type: string;
  progress_stages?: Record<string, string>;
  progress_times?: Record<string, string>;
  progress_notes?: Record<string, string>;
}

/* ------------------ 模擬案件資料 ------------------ */
const mockCaseData: TableCase[] = [
  {
    id: '1',
    caseNumber: '112年度民訴字第1234號',
    client: '張三',
    caseType: '民事',
    lawyer: '李律師',
    legalAffairs: '王法務',
    caseReason: '債務糾紛',
    opposingParty: '李四',
    court: '台北地方法院',
    division: '民事庭',
    progress: '起訴',
    progressDate: '2024-01-15',
    status: 'active',
    stages: [
      { name: '委任', date: '2024-01-10', completed: true },
      { name: '起訴', date: '2024-01-15', completed: true },
      { name: '開庭', date: '2024-02-20', completed: false },
      { name: '判決', date: '2024-03-15', completed: false },
    ],
  },
  {
    id: '2',
    caseNumber: '112年度刑訴字第5678號',
    client: '王五',
    caseType: '刑事',
    lawyer: '陳律師',
    legalAffairs: '林法務',
    caseReason: '詐欺案件',
    opposingParty: '檢察官',
    court: '新北地方法院',
    division: '刑事庭',
    progress: '偵查',
    progressDate: '2024-01-20',
    status: 'urgent',
    stages: [
      { name: '委任', date: '2024-01-05', completed: true },
      { name: '偵查', date: '2024-01-20', completed: true },
      { name: '起訴', date: '2024-02-10', completed: false },
    ],
  },
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
    status: 'completed',
    stages: [
      { name: '委任', date: '2023-12-01', completed: true },
      { name: '起訴', date: '2023-12-15', completed: true },
      { name: '開庭', date: '2024-01-10', completed: true },
      { name: '判決', date: '2024-01-20', completed: true },
      { name: '已結案', date: '2024-01-25', completed: true },
    ],
  },
];

/* ------------------ 工具：型別轉換 ------------------ */
function tableToFormCase(c: TableCase): FormCaseData {
  return {
    case_id: c.id,
    case_type: c.caseType,
    client: c.client,
    lawyer: c.lawyer,
    legal_affairs: c.legalAffairs,
    case_reason: c.caseReason,
    case_number: c.caseNumber,
    opposing_party: c.opposingParty,
    court: c.court,
    division: c.division,
    progress: c.progress,
    progress_date: c.progressDate,
  };
}

function formToTableCase(form: FormCaseData, base?: TableCase): TableCase {
  const nowId = base?.id ?? String(Date.now()); // 新增時用 timestamp 產 id
  return {
    id: nowId,
    caseNumber: form.case_number ?? base?.caseNumber ?? '',
    client: form.client,
    caseType: form.case_type,
    lawyer: form.lawyer ?? '',
    legalAffairs: form.legal_affairs ?? '',
    caseReason: form.case_reason ?? '',
    opposingParty: form.opposing_party ?? '',
    court: form.court ?? '',
    division: form.division ?? '',
    progress: form.progress ?? base?.progress ?? '',
    progressDate: form.progress_date ?? base?.progressDate ?? '',
    status: base?.status ?? 'active',
    stages:
      base?.stages ??
      [
        {
          name: '委任',
          date: new Date().toISOString().split('T')[0],
          completed: true,
        },
      ],
  };
}

/* ------------------ 主元件 ------------------ */
export default function CaseOverview() {
  const [cases, setCases] = useState<TableCase[]>(mockCaseData);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>(mockCaseData);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);

  // 搜尋 & 欄位控制
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    caseNumber: true,
    client: true,
    caseType: true,
    lawyer: true,
    legalAffairs: true,
    progress: true,
    progressDate: true,
    court: false,
    division: false,
  });

  // Dialog 狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);

  const [showImportDialog, setShowImportDialog] = useState(false);

  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    onConfirm?: () => void;
  }>({
    title: '',
    message: '',
    type: 'info',
  });

  /* -------- 搜尋 -------- */
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCases(cases);
      return;
    }
    const term = searchTerm.toLowerCase();
    const next = cases.filter((c) =>
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
        c.progress,
        c.progressDate,
        c.status,
      ]
        .map((v) => String(v).toLowerCase())
        .some((v) => v.includes(term)),
    );
    setFilteredCases(next);
  }, [searchTerm, cases]);

  /* -------- 狀態圓角標籤顏色 -------- */
  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /* -------- 右側詳情的階段小圓色塊 -------- */
  const getStageColor = (stage: Stage, isCurrent: boolean): string => {
    if (!stage.date) return 'bg-gray-200 text-gray-600';
    const stageDate = new Date(stage.date);
    const today = new Date();
    const diffDays = Math.ceil((stageDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    if (stage.completed) return 'bg-green-500 text-white';
    if (diffDays < 0) return 'bg-red-500 text-white';
    if (diffDays <= 3) return 'bg-yellow-400 text-black';
    return isCurrent ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white';
  };

  /* -------- 新增 / 編輯 / 刪除 -------- */
  const handleAddCase = () => {
    setCaseFormMode('add');
    setEditingCase({
      case_type: '',
      client: '',
      lawyer: '',
      legal_affairs: '',
      case_reason: '',
      case_number: '',
      opposing_party: '',
      court: '',
      division: '',
      progress: '',
      progress_date: '',
    });
    setShowCaseForm(true);
  };

  const handleEditCase = (row: TableCase) => {
    setCaseFormMode('edit');
    setEditingCase(tableToFormCase(row));
    setShowCaseForm(true);
  };

  const handleSaveCase = async (form: FormCaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        const newRow = formToTableCase(form);
        setCases((prev) => [...prev, newRow]);
        setSelectedCase(newRow);
        showSuccess('案件新增成功！');
      } else {
        setCases((prev) =>
          prev.map((c) => (c.id === (form.case_id ?? '') ? formToTableCase(form, c) : c)),
        );
        const updated = formToTableCase(form, selectedCase ?? undefined);
        setSelectedCase(updated);
        showSuccess('案件更新成功！');
      }
      return true;
    } catch {
      showError('操作失敗，請稍後再試');
      return false;
    }
  };

  const confirmDeleteCase = (row: TableCase) => {
    setDialogConfig({
      title: '確認刪除',
      message: `確定要刪除案件「${row.client} - ${row.caseNumber}」嗎？此操作無法復原。`,
      type: 'warning',
      onConfirm: () => {
        setCases((prev) => prev.filter((c) => c.id !== row.id));
        if (selectedCase?.id === row.id) setSelectedCase(null);
        setShowUnifiedDialog(false);
      },
    });
    setShowUnifiedDialog(true);
  };

  const showSuccess = (message: string) => {
    setDialogConfig({
      title: '成功',
      message,
      type: 'success',
    });
    setShowUnifiedDialog(true);
  };

  const showError = (message: string) => {
    setDialogConfig({
      title: '錯誤',
      message,
      type: 'error',
    });
    setShowUnifiedDialog(true);
  };

  /* -------- 匯入完成（Excel dialog） -------- */
  const handleImportComplete = () => {
    showSuccess('資料匯入完成！');
  };

  /* -------- 提醒元件需要的資料 -------- */
  const reminderData: ReminderCaseData[] = useMemo(
    () =>
      cases.map((c) => {
        const stagesMap = c.stages.reduce<Record<string, string>>((acc, s) => {
          acc[s.name] = s.date;
          return acc;
        }, {});
        return {
          case_id: c.id,
          client: c.client,
          case_type: c.caseType,
          progress_stages: stagesMap,
          progress_times: {}, // 若未有時間，可留空
          progress_notes: {},
        };
      }),
    [cases],
  );

  const onCaseSelectFromReminder = (reminderCase: ReminderCaseData) => {
    const found = cases.find((c) => c.id === reminderCase.case_id);
    if (found) setSelectedCase(found);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航欄 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center">
                  <Building className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-[#334d6d]">案件管理系統</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>管理員</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* 左側導航 */}
        <nav className="w-48 bg-[#2c3e50] text-white">
          <div className="p-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-300 uppercase tracking-wider mb-3">主選單</div>

              <div className="bg-[#3498db] rounded-md">
                <a href="#" className="flex items-center space-x-3 px-3 py-2 text-white">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">案件區分</span>
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* 主要內容區域 */}
        <main className="flex-1 flex flex-col">
          {/* 頂部工具列 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAddCase}
                    className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>新增案件</span>
                  </button>

                  <button
                    onClick={() => setShowImportDialog(true)}
                    className="bg-[#27ae60] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#229954] transition-colors flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>上傳資料</span>
                  </button>

                  <button
                    onClick={() => setShowImportDialog(true)}
                    className="bg-[#8e44ad] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#7d3c98] transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>匯入資料</span>
                  </button>

                </div>

              </div>

              <div className="flex-1 flex items-center justify-end space-x-4">
                {/* 跑馬燈：日期提醒 */}
                <div className="w-[420px] mr-4">
                  <DateReminderWidget
                    caseData={reminderData}
                    onCaseSelect={onCaseSelectFromReminder}
                  />
                </div>

                {/* 搜尋 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜尋案件..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm w-64"
                  />
                </div>
                <button
                  onClick={() => setShowFilters((s) => !s)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 搜尋結果統計 */}
            {searchTerm && (
              <div className="mt-2 text-sm text-green-600">
                找到 {filteredCases.length}/{cases.length} 個案件
              </div>
            )}
          </div>

          {/* 欄位控制區域 */}
          {showFilters && (
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">顯示欄位：</span>
                {Object.entries(visibleColumns).map(([key, visible]) => (
                  <label key={key} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                    />
                    <span className="text-gray-600">
                      {key === 'caseNumber'
                        ? '案號'
                        : key === 'client'
                        ? '當事人'
                        : key === 'caseType'
                        ? '案件類型'
                        : key === 'lawyer'
                        ? '律師'
                        : key === 'legalAffairs'
                        ? '法務'
                        : key === 'progress'
                        ? '進度'
                        : key === 'progressDate'
                        ? '進度日期'
                        : key === 'court'
                        ? '法院'
                        : key === 'division'
                        ? '股別'
                        : key}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 案件列表 + 右側詳情 */}
          <div className="flex-1 flex">
            {/* 列表 */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        選擇
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        ID
                      </th>
                      {visibleColumns.caseNumber && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          案號
                        </th>
                      )}
                      {visibleColumns.client && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          當事人
                        </th>
                      )}
                      {visibleColumns.caseType && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          案件類型
                        </th>
                      )}
                      {visibleColumns.lawyer && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          律師
                        </th>
                      )}
                      {visibleColumns.legalAffairs && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          法務
                        </th>
                      )}
                      {visibleColumns.progress && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          進度
                        </th>
                      )}
                      {visibleColumns.progressDate && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          進度日期
                        </th>
                      )}
                      {visibleColumns.court && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          法院
                        </th>
                      )}
                      {visibleColumns.division && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          股別
                        </th>
                      )}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.id}
                        </td>
                        {visibleColumns.caseNumber && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.caseNumber}
                          </td>
                        )}
                        {visibleColumns.client && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.client}
                          </td>
                        )}
                        {visibleColumns.caseType && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                row.status,
                              )}`}
                            >
                              {row.caseType}
                            </span>
                          </td>
                        )}
                        {visibleColumns.lawyer && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.lawyer}
                          </td>
                        )}
                        {visibleColumns.legalAffairs && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.legalAffairs}
                          </td>
                        )}
                        {visibleColumns.progress && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.progress}
                          </td>
                        )}
                        {visibleColumns.progressDate && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {row.progressDate}
                          </td>
                        )}
                        {visibleColumns.court && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.court}
                          </td>
                        )}
                        {visibleColumns.division && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.division}
                          </td>
                        )}
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedCase(row); }}
                              className="text-gray-400 hover:text-[#334d6d] transition-colors"
                              title="檢視"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditCase(row); }}
                              className="text-gray-400 hover:text-[#334d6d] transition-colors"
                              title="編輯"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmDeleteCase(row); }}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="刪除"
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

            {/* 右側詳情 */}
            {selectedCase && (
              <div className="w-96 bg-white border-l border-gray-200 overflow-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                    <button className="text-gray-400 hover:text-gray-600" title="更多">
                      <MoreHorizontal className="w-5 h-5" />
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
                        <label className="text-sm font-medium text-gray-500">負責股別</label>
                        <p className="text-sm text-gray-900 mt-1">{selectedCase.division}</p>
                      </div>
                    </div>
                  </div>

                  <hr className="my-6" />

                  {/* 進度階段 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                      <button
                        onClick={() => handleEditCase(selectedCase)}
                        className="bg-[#27ae60] text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-[#229954] transition-colors flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>新增階段</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {selectedCase.stages.map((stage, idx) => {
                        const isCurrent = stage.name === selectedCase.progress;
                        return (
                          <div key={`${stage.name}-${idx}`} className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getStageColor(
                                stage,
                                isCurrent,
                              )}`}
                            >
                              {stage.name.slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">
                                  {stage.name}
                                </span>
                                {stage.completed ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : isCurrent ? (
                                  <Clock className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-gray-300" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{stage.date}</p>
                              {stage.note && (
                                <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                                  📄 {stage.note}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 對話框們 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleSaveCase}
        caseData={editingCase}
        mode={caseFormMode}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <UnifiedDialog
        isOpen={showUnifiedDialog}
        onClose={() => setShowUnifiedDialog(false)}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        showCancel={dialogConfig.type === 'warning'}
        onConfirm={() => {
          dialogConfig.onConfirm?.();
        }}
      />
    </div>
  );
}

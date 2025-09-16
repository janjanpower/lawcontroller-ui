import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Filter, Upload, Download, FileText, Trash2, X, Eye, Edit, Calendar, Clock, User, Building, AlertTriangle } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import StageEditDialog, { type StageFormData } from '../components/StageEditDialog';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import WriteDocument from '../pages/WriteDocument';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage, canTransferToClosedCases, filterCasesWithoutClosedStage } from '../utils/caseStage';

interface CaseData {
  case_id: string;
  case_type: string;
  client: string;
  lawyer: string;
  legal_affairs: string;
  case_reason: string;
  case_number: string;
  opposing_party: string;
  court: string;
  division: string;
  progress: string;
  progress_date: string;
  created_date: string;
  progress_stages?: Record<string, string>;
  progress_times?: Record<string, string>;
  progress_notes?: Record<string, string>;
}

interface VisibleColumns {
  caseNumber: boolean;
  client: boolean;
  caseType: boolean;
  lawyer: boolean;
  legalAffairs: boolean;
  progress: boolean;
  progressDate: boolean;
  court: boolean;
  division: boolean;
}

const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  caseNumber: true,
  client: true,
  caseType: true,
  lawyer: true,
  legalAffairs: true,
  progress: true,
  progressDate: true,
  court: false,
  division: false,
};

export default function CaseOverview() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [filteredCases, setFilteredCases] = useState<CaseData[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showWriteDocument, setShowWriteDocument] = useState(false);
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);
  const [showClosedTransferDialog, setShowClosedTransferDialog] = useState(false);
  const [showTransferWarningDialog, setShowTransferWarningDialog] = useState(false);
  const [casesWithoutClosedStage, setCasesWithoutClosedStage] = useState<CaseData[]>([]);

  // 全選狀態
  const allSelected = filteredCases.length > 0 && selectedCaseIds.length === filteredCases.length;

  // 載入案件資料
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}&status=open`);
      const data = await response.json();

      if (response.ok) {
        const transformedCases = (data.items || []).map((item: any) => ({
          case_id: item.id,
          case_type: item.case_type || '',
          client: item.client_name || item.client?.name || '',
          lawyer: item.lawyer_name || item.lawyer?.full_name || '',
          legal_affairs: item.legal_affairs_name || item.legal_affairs?.full_name || '',
          case_reason: item.case_reason || '',
          case_number: item.case_number || '',
          opposing_party: item.opposing_party || '',
          court: item.court || '',
          division: item.division || '',
          progress: item.progress || '',
          progress_date: item.progress_date || '',
          created_date: item.created_at || '',
          progress_stages: item.progress_stages || {},
          progress_times: item.progress_times || {},
          progress_notes: item.progress_notes || {},
        }));

        setCases(transformedCases);
      } else {
        console.error('載入案件失敗:', data);
      }
    } catch (error) {
      console.error('載入案件錯誤:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // 搜尋和過濾功能
  useEffect(() => {
    let filtered = cases;

    if (statusFilter !== 'all') {
      // 這裡可以根據需要添加狀態過濾邏輯
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.case_type === typeFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
        [c.case_number, c.client, c.case_type, c.lawyer, c.legal_affairs, c.case_reason, c.court, c.division]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredCases(filtered);
  }, [searchTerm, cases, statusFilter, typeFilter]);

  // 處理轉移結案 - 新增檢查邏輯
  const handleTransferToClosed = () => {
    if (selectedCaseIds.length === 0) {
      alert('請先選擇要轉移的案件');
      return;
    }

    const selectedCases = cases.filter(c => selectedCaseIds.includes(c.case_id));

    // 檢查哪些案件沒有結案階段
    const casesWithoutClosed = filterCasesWithoutClosedStage(selectedCases);

    if (casesWithoutClosed.length > 0) {
      // 有案件沒有結案階段，顯示警告對話框
      setCasesWithoutClosedStage(casesWithoutClosed);
      setShowTransferWarningDialog(true);
    } else {
      // 所有案件都有結案階段，直接轉移
      setShowClosedTransferDialog(true);
    }
  };

  // 強制轉移（即使沒有結案階段）
  const handleForceTransfer = () => {
    setShowTransferWarningDialog(false);
    setShowClosedTransferDialog(true);
  };

  // 確認轉移到結案案件
  const confirmTransferToClosed = async (payload?: { targetPath?: string }) => {
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      // 逐一更新案件狀態為已結案
      for (const caseId of selectedCaseIds) {
        const updateResponse = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_closed: true,
            closed_at: new Date().toISOString()
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error(`更新案件 ${caseId} 失敗:`, errorData);
        }
      }

      // 重新載入案件列表
      await loadCases();

      // 清除選擇
      setSelectedCaseIds([]);
      setShowClosedTransferDialog(false);
      setCasesWithoutClosedStage([]);

      alert(`成功轉移 ${selectedCaseIds.length} 個案件到結案案件`);
    } catch (error) {
      console.error('轉移案件失敗:', error);
      alert('轉移案件失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 其他現有的函數保持不變...
  const handleCaseSelect = (caseId: string, checked: boolean) => {
    setSelectedCaseIds(prev =>
      checked ? [...prev, caseId] : prev.filter(id => id !== caseId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedCaseIds(checked ? filteredCases.map(c => c.case_id) : []);
  };

  const handleAddCase = () => {
    setCaseFormMode('add');
    setEditingCase(null);
    setShowCaseForm(true);
  };

  const handleEditCase = (caseData: CaseData) => {
    setCaseFormMode('edit');
    setEditingCase(caseData);
    setShowCaseForm(true);
  };

  const handleSaveCase = async (caseData: CaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        setCases(prev => [caseData, ...prev]);
      } else {
        setCases(prev => prev.map(c => c.case_id === caseData.case_id ? caseData : c));
      }
      return true;
    } catch (error) {
      console.error('保存案件失敗:', error);
      return false;
    }
  };

  const handleImportComplete = async (importedCases: any[]) => {
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      for (const importCase of importedCases) {
        const caseDataForAPI = {
          case_type: importCase.case_type || '民事',
          client_name: importCase.client || importCase.client_name,
          case_reason: importCase.case_reason,
          case_number: importCase.case_number,
          court: importCase.court,
          division: importCase.division,
          lawyer_name: importCase.lawyer,
          legal_affairs_name: importCase.legal_affairs,
        };

        const response = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caseDataForAPI),
        });

        if (!response.ok) {
          console.error('匯入案件失敗:', await response.text());
        }
      }

      await loadCases();
      alert(`成功匯入 ${importedCases.length} 筆案件`);
    } catch (error) {
      console.error('匯入失敗:', error);
      alert('匯入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const toggleFolderExpansion = (caseId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const handleAddStage = (caseData: CaseData) => {
    setSelectedCase(caseData);
    setStageDialogMode('add');
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  const handleEditStage = (caseData: CaseData, stageIndex: number) => {
    setSelectedCase(caseData);
    setStageDialogMode('edit');
    setEditingStageIndex(stageIndex);
    setShowStageDialog(true);
  };

  const handleSaveStage = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const firmCode = getFirmCodeOrThrow();

      if (stageDialogMode === 'add') {
        const response = await apiFetch(`/api/cases/${selectedCase.case_id}/stages?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST',
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time,
            note: stageData.note,
            is_completed: false,
            sort_order: 0
          }),
        });

        if (response.ok) {
          // 建立階段資料夾
          FolderManager.createStageFolder(selectedCase.case_id, stageData.stageName);

          // 更新本地案件資料
          setCases(prev => prev.map(c => {
            if (c.case_id === selectedCase.case_id) {
              const newStages = { ...c.progress_stages };
              const newTimes = { ...c.progress_times };
              const newNotes = { ...c.progress_notes };

              newStages[stageData.stageName] = stageData.date;
              if (stageData.time) newTimes[stageData.stageName] = stageData.time;
              if (stageData.note) newNotes[stageData.stageName] = stageData.note;

              return {
                ...c,
                progress_stages: newStages,
                progress_times: newTimes,
                progress_notes: newNotes
              };
            }
            return c;
          }));

          return true;
        }
      } else {
        // 編輯模式
        const response = await apiFetch(`/api/cases/${selectedCase.case_id}/stages/${editingStageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time,
            note: stageData.note
          }),
        });

        if (response.ok) {
          // 更新本地案件資料
          setCases(prev => prev.map(c => {
            if (c.case_id === selectedCase.case_id) {
              const stages = Object.keys(c.progress_stages || {});
              const oldStageName = stages[editingStageIndex];

              if (oldStageName) {
                const newStages = { ...c.progress_stages };
                const newTimes = { ...c.progress_times };
                const newNotes = { ...c.progress_notes };

                // 如果階段名稱改變，需要更新 key
                if (oldStageName !== stageData.stageName) {
                  delete newStages[oldStageName];
                  if (newTimes[oldStageName]) {
                    newTimes[stageData.stageName] = newTimes[oldStageName];
                    delete newTimes[oldStageName];
                  }
                  if (newNotes[oldStageName]) {
                    newNotes[stageData.stageName] = newNotes[oldStageName];
                    delete newNotes[oldStageName];
                  }
                }

                newStages[stageData.stageName] = stageData.date;
                if (stageData.time) newTimes[stageData.stageName] = stageData.time;
                if (stageData.note) newNotes[stageData.stageName] = stageData.note;

                return {
                  ...c,
                  progress_stages: newStages,
                  progress_times: newTimes,
                  progress_notes: newNotes
                };
              }
            }
            return c;
          }));

          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('保存階段失敗:', error);
      return false;
    }
  };

  const handleDeleteStage = async (caseData: CaseData, stageIndex: number) => {
    const stages = Object.keys(caseData.progress_stages || {});
    const stageName = stages[stageIndex];

    if (!stageName) return;

    if (confirm(`確定要刪除階段「${stageName}」嗎？`)) {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(`/api/cases/${caseData.case_id}/stages/${stageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // 檢查階段資料夾是否有檔案
          const hasFiles = await FolderManager.hasFilesInStageFolder(caseData.case_id, stageName);

          if (hasFiles) {
            const deleteFiles = confirm(`階段「${stageName}」中有檔案，是否一併刪除？`);
            if (deleteFiles) {
              await FolderManager.deleteStageFolder(caseData.case_id, stageName);
            }
          }

          // 從前端樹移除階段資料夾節點
          FolderManager.removeStageFolderNode(caseData.case_id, stageName);

          // 更新本地案件資料
          setCases(prev => prev.map(c => {
            if (c.case_id === caseData.case_id) {
              const newStages = { ...c.progress_stages };
              const newTimes = { ...c.progress_times };
              const newNotes = { ...c.progress_notes };

              delete newStages[stageName];
              delete newTimes[stageName];
              delete newNotes[stageName];

              return {
                ...c,
                progress_stages: newStages,
                progress_times: newTimes,
                progress_notes: newNotes
              };
            }
            return c;
          }));

          alert('階段已刪除');
        }
      } catch (error) {
        console.error('刪除階段失敗:', error);
        alert('刪除階段失敗');
      }
    }
  };

  const getStageStatus = (caseData: CaseData, stageName: string) => {
    const stageDate = caseData.progress_stages?.[stageName];
    if (!stageDate) return 'default';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(stageDate);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'in-progress';
    if (diffDays <= 3) return 'pending';
    return 'default';
  };

  const formatStageDisplay = (caseData: CaseData, stageName: string) => {
    const date = caseData.progress_stages?.[stageName];
    const time = caseData.progress_times?.[stageName];

    if (!date) return stageName;

    const formattedDate = new Date(date).toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit'
    });

    return time ? `${formattedDate} ${time} ${stageName}` : `${formattedDate} ${stageName}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <button
                onClick={handleAddCase}
                className="bg-[#3498db] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <button
                onClick={() => setShowFileUpload(true)}
                className="bg-green-600 text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Upload className="w-4 h-4" />
                <span>上傳檔案</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-purple-600 text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>匯入資料</span>
              </button>

              <button
                onClick={() => setShowWriteDocument(true)}
                className="bg-indigo-600 text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <FileText className="w-4 h-4" />
                <span>撰寫文件</span>
              </button>
            </div>

            <DateReminderWidget caseData={cases} onCaseSelect={setSelectedCase} />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋案件..."
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

        {/* 過濾器 */}
        {showFilters && (
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-700">篩選條件：</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有狀態</option>
              <option value="active">進行中</option>
              <option value="pending">待處理</option>
              <option value="urgent">緊急</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有類型</option>
              <option value="民事">民事</option>
              <option value="刑事">刑事</option>
            </select>
          </div>
        )}

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個案件
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
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  {visibleColumns.caseNumber && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案號</th>
                  )}
                  {visibleColumns.client && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">當事人</th>
                  )}
                  {visibleColumns.caseType && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案件類型</th>
                  )}
                  {visibleColumns.lawyer && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">律師</th>
                  )}
                  {visibleColumns.legalAffairs && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">法務</th>
                  )}
                  {visibleColumns.progress && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">進度</th>
                  )}
                  {visibleColumns.progressDate && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">進度日期</th>
                  )}
                  {visibleColumns.court && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">法院</th>
                  )}
                  {visibleColumns.division && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">股別</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCases.map((caseData, index) => (
                  <React.Fragment key={caseData.case_id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCase?.case_id === caseData.case_id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={(e) => {
                        if (e.target.type === 'checkbox' || e.target.closest('input[type="checkbox"]')) {
                          return;
                        }
                        setSelectedCase(caseData);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                          checked={selectedCaseIds.includes(caseData.case_id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCaseSelect(caseData.case_id, e.target.checked);
                          }}
                        />
                      </td>
                      {visibleColumns.caseNumber && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.case_number}</td>
                      )}
                      {visibleColumns.client && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.client}</td>
                      )}
                      {visibleColumns.caseType && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.case_type}</td>
                      )}
                      {visibleColumns.lawyer && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.lawyer}</td>
                      )}
                      {visibleColumns.legalAffairs && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.legal_affairs}</td>
                      )}
                      {visibleColumns.progress && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.progress}</td>
                      )}
                      {visibleColumns.progressDate && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.progress_date}</td>
                      )}
                      {visibleColumns.court && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.court}</td>
                      )}
                      {visibleColumns.division && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{caseData.division}</td>
                      )}
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedCase(caseData)}
                            className="text-gray-400 hover:text-[#334d6d] transition-colors"
                            title="檢視"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditCase(caseData)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* 展開的進度階段 */}
                    {selectedCase?.case_id === caseData.case_id && (
                      <tr>
                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            {/* 進度階段 */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900 flex items-center">
                                  <Calendar className="w-4 h-4 mr-2" />
                                  進度階段
                                </h4>
                                <button
                                  onClick={() => handleAddStage(caseData)}
                                  className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-1 text-sm"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>新增階段</span>
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {Object.keys(caseData.progress_stages || {}).map((stageName, stageIndex) => (
                                  <div
                                    key={stageName}
                                    className={`stage-tag ${getStageStatus(caseData, stageName)} cursor-pointer group relative`}
                                    onClick={() => handleEditStage(caseData, stageIndex)}
                                  >
                                    <span>{formatStageDisplay(caseData, stageName)}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteStage(caseData, stageIndex);
                                      }}
                                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-red-200"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {Object.keys(caseData.progress_stages || {}).length === 0 && (
                                  <span className="text-sm text-gray-500">尚無進度階段</span>
                                )}
                              </div>
                            </div>

                            {/* 資料夾樹 */}
                            <FolderTree
                              caseId={caseData.case_id}
                              clientName={caseData.client}
                              isExpanded={expandedFolders[caseData.case_id] || false}
                              onToggle={() => toggleFolderExpansion(caseData.case_id)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-2 transition-colors lg:hidden"
                  title="關閉詳情"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 案件基本資訊 */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">案號</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.case_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">當事人</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">案件類型</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.case_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">案由</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.case_reason}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">律師</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">法務</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.legal_affairs}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">法院</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.court}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">股別</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.division}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">目前進度</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.progress}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">建立日期</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.created_date}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 批量操作工具列 */}
      {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4">
          <div className="animate-slide-up">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4">
              <div className="text-center mb-3">
                <span className="text-sm text-gray-700 font-medium">已選擇 {selectedCaseIds.length} 個案件</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                  <button
                    onClick={() => handleSelectAll(true)}
                    disabled={allSelected}
                    className={`w-full sm:w-auto px-4 py-2 text-sm underline transition-colors rounded-md ${
                      allSelected ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {allSelected ? '已全選' : '全選'}
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm underline rounded-md"
                  >
                    取消選擇
                  </button>
                </div>
                <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
                <button
                  onClick={handleTransferToClosed}
                  className="w-full sm:w-auto bg-[#f39c12] text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-[#d68910] flex items-center justify-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>轉移結案</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 對話框們 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleSaveCase}
        caseData={editingCase}
        mode={caseFormMode}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          setShowFileUpload(false);
          if (selectedCase) {
            // 重新載入選中案件的資料夾
          }
        }}
        selectedCaseIds={selectedCaseIds}
        cases={cases.map(c => ({ id: c.case_id, client: c.client, caseNumber: c.case_number }))}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <WriteDocument
        isOpen={showWriteDocument}
        onClose={() => setShowWriteDocument(false)}
        caseId={selectedCase?.case_id}
        clientName={selectedCase?.client}
      />

      <StageEditDialog
        isOpen={showStageDialog}
        mode={stageDialogMode}
        initial={
          stageDialogMode === 'edit' && selectedCase && editingStageIndex >= 0
            ? {
                stageName: Object.keys(selectedCase.progress_stages || {})[editingStageIndex] || '',
                date: Object.values(selectedCase.progress_stages || {})[editingStageIndex] || '',
                time: selectedCase.progress_times?.[Object.keys(selectedCase.progress_stages || {})[editingStageIndex]] || '',
                note: selectedCase.progress_notes?.[Object.keys(selectedCase.progress_stages || {})[editingStageIndex]] || ''
              }
            : undefined
        }
        onClose={() => setShowStageDialog(false)}
        onSave={handleSaveStage}
        caseId={selectedCase?.case_id}
      />

      <ClosedTransferDialog
        isOpen={showClosedTransferDialog}
        cases={selectedCaseIds.map(id => {
          const c = cases.find(x => x.case_id === id);
          return { id, caseNo: c?.case_number, title: c?.client };
        })}
        onClose={() => setShowClosedTransferDialog(false)}
        onConfirm={confirmTransferToClosed}
      />

      {/* 轉移警告對話框 */}
      {showTransferWarningDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="bg-yellow-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h2 className="text-lg font-semibold flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                轉移確認
              </h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-800 mb-3">
                  以下 {casesWithoutClosedStage.length} 個案件沒有「結案」階段：
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 max-h-32 overflow-y-auto">
                  {casesWithoutClosedStage.map((caseItem, index) => (
                    <div key={caseItem.case_id} className="text-sm text-yellow-800">
                      {index + 1}. {caseItem.client} - {caseItem.case_number || caseItem.case_type}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>建議：</strong>先為這些案件新增「結案」階段，再進行轉移，這樣可以更完整地記錄案件的處理流程。
                </p>
              </div>

              <p className="text-sm text-gray-600">
                您仍然可以選擇直接轉移這些案件，但建議先新增結案階段以完善案件記錄。
              </p>
            </div>
            <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowTransferWarningDialog(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowTransferWarningDialog(false);
                  alert('請先為案件新增「結案」階段，然後再進行轉移');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                先新增結案階段
              </button>
              <button
                onClick={handleForceTransfer}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                仍要轉移
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
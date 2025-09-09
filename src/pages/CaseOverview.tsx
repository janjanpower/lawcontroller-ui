import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, Upload, Download, Eye, Edit, Trash2, X, FileText, User, Calendar, Building, Folder, FolderOpen } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import type { StageFormData } from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage } from '../utils/caseStage';
import { isUUID } from '../utils/id';
import { apiFetch, getFirmCodeOrThrow, hasAuthToken, clearLoginAndRedirect } from '../utils/api';

interface CaseData {
  case_id: string;
  case_type: string;
  client: string;
  client_id_number?: string;
  client_phone?: string;
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

export default function CaseOverview() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [filteredCases, setFilteredCases] = useState<CaseData[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClosedTransferDialog, setShowClosedTransferDialog] = useState(false);
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<CaseData | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');

  // 欄位顯示控制
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
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

  // 載入案件列表
  const loadCases = async () => {
    try {
      if (!hasAuthToken()) {
        console.warn('沒有登入 token，無法載入案件');
        clearLoginAndRedirect();
        return;
      }

      const firmCode = getFirmCodeOrThrow();
      const response = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}&status=open`);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('認證失敗，清除登入狀態');
          clearLoginAndRedirect();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('載入的案件資料:', data);

      if (data.items && Array.isArray(data.items)) {
        const transformedCases = data.items.map((apiCase: any) => {
          const caseData: CaseData = {
            case_id: apiCase.id,
            case_type: apiCase.case_type || '',
            client: apiCase.client_name || apiCase.client?.name || '',
            lawyer: apiCase.lawyer_name || apiCase.lawyer?.full_name || '',
            legal_affairs: apiCase.legal_affairs_name || apiCase.legal_affairs?.full_name || '',
            case_reason: apiCase.case_reason || '',
            case_number: apiCase.case_number || '',
            opposing_party: apiCase.opposing_party || '',
            court: apiCase.court || '',
            division: apiCase.division || '',
            progress: apiCase.progress || '',
            progress_date: apiCase.progress_date || '',
            created_date: apiCase.created_at ? apiCase.created_at.split('T')[0] : '',
            progress_stages: {},
            progress_times: {},
            progress_notes: {}
          };

          // 為每個案件建立預設資料夾結構
          FolderManager.createDefaultFolders(caseData.case_id);
          FolderManager.createCaseInfoExcel(caseData.case_id, {
            caseNumber: caseData.case_number || '',
            client: caseData.client,
            caseType: caseData.case_type,
            lawyer: caseData.lawyer || '',
            legalAffairs: caseData.legal_affairs || '',
            caseReason: caseData.case_reason || '',
            opposingParty: caseData.opposing_party || '',
            court: caseData.court || '',
            division: caseData.division || '',
            progress: caseData.progress || '',
            progressDate: caseData.progress_date || '',
            createdDate: caseData.created_date || ''
          });

          return caseData;
        });

        setCases(transformedCases);
        console.log('案件資料轉換完成，數量:', transformedCases.length);
      } else {
        console.warn('API 回應格式異常:', data);
        setCases([]);
      }
    } catch (error) {
      console.error('載入案件列表失敗:', error);
      if (error.message.includes('登入')) {
        clearLoginAndRedirect();
      }
    }
  };

  // 初始載入
  useEffect(() => {
    loadCases();
  }, []);

  // 搜尋和過濾功能
  useEffect(() => {
    let filtered = cases;

    // 狀態過濾
    if (statusFilter !== 'all') {
      if (statusFilter === 'closed') {
        filtered = filtered.filter(c => hasClosedStage(Object.keys(c.progress_stages || {}).map(name => ({ name }))));
      } else if (statusFilter === 'open') {
        filtered = filtered.filter(c => !hasClosedStage(Object.keys(c.progress_stages || {}).map(name => ({ name }))));
      }
    }

    // 類型過濾
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.case_type === typeFilter);
    }

    // 律師過濾
    if (lawyerFilter !== 'all') {
      filtered = filtered.filter(c => c.lawyer === lawyerFilter);
    }

    // 搜尋過濾
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
        [
          c.case_id,
          c.case_number,
          c.client,
          c.case_type,
          c.lawyer,
          c.legal_affairs,
          c.case_reason,
          c.opposing_party,
          c.court,
          c.division,
        ]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredCases(filtered);
  }, [searchTerm, cases, statusFilter, typeFilter, lawyerFilter]);

  // 取得唯一值用於過濾器選項
  const uniqueTypes = useMemo(() => [...new Set(cases.map(c => c.case_type).filter(Boolean))], [cases]);
  const uniqueLawyers = useMemo(() => [...new Set(cases.map(c => c.lawyer).filter(Boolean))], [cases]);

  // 全選/取消全選
  const handleSelectAll = () => {
    const currentPageCaseIds = filteredCases.map(c => c.case_id);
    const isAllSelected = currentPageCaseIds.every(id => selectedCaseIds.includes(id));

    if (isAllSelected) {
      // 取消全選：移除當前頁面的所有選擇
      setSelectedCaseIds(prev => prev.filter(id => !currentPageCaseIds.includes(id)));
    } else {
      // 全選：添加當前頁面未選擇的案件
      setSelectedCaseIds(prev => [...new Set([...prev, ...currentPageCaseIds])]);
    }
  };

  // 檢查是否全選
  const isAllSelected = useMemo(() => {
    const currentPageCaseIds = filteredCases.map(c => c.case_id);
    return currentPageCaseIds.length > 0 && currentPageCaseIds.every(id => selectedCaseIds.includes(id));
  }, [filteredCases, selectedCaseIds]);

  // 案件選擇處理
  const handleCaseSelect = (caseId: string, checked: boolean) => {
    setSelectedCaseIds(prev =>
      checked
        ? [...prev, caseId]
        : prev.filter(id => id !== caseId)
    );
  };

  // 清除選擇
  const handleClearSelection = () => {
    setSelectedCaseIds([]);
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedCaseIds.length === 0) return;

    const confirmMessage = `確定要刪除選中的 ${selectedCaseIds.length} 個案件嗎？此操作無法復原。`;
    if (!confirm(confirmMessage)) return;

    try {
      const firmCode = getFirmCodeOrThrow();

      // 逐一刪除選中的案件
      for (const caseId of selectedCaseIds) {
        const response = await fetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `刪除案件 ${caseId} 失敗`);
        }
      }

      // 重新載入案件列表
      await loadCases();

      // 清除選擇
      setSelectedCaseIds([]);

      alert(`成功刪除 ${selectedCaseIds.length} 個案件`);
    } catch (error) {
      console.error('批量刪除失敗:', error);
      alert(`刪除失敗: ${error.message}`);
    }
  };

  // 新增案件
  const handleAddCase = () => {
    setEditingCase(null);
    setCaseFormMode('add');
    setShowCaseForm(true);
  };

  // 編輯案件
  const handleEditCase = (caseData: CaseData) => {
    setEditingCase(caseData);
    setCaseFormMode('edit');
    setShowCaseForm(true);
  };

  // 保存案件（新增或編輯）
  const handleSaveCase = async (caseData: CaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        // 新增案件到列表
        setCases(prev => [caseData, ...prev]);
        console.log('案件新增到前端列表成功');
      } else {
        // 更新案件列表
        setCases(prev => prev.map(c =>
          c.case_id === caseData.case_id ? caseData : c
        ));
        console.log('案件更新到前端列表成功');
      }
      return true;
    } catch (error) {
      console.error('保存案件到前端列表失敗:', error);
      return false;
    }
  };

  // 刪除案件
  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('確定要刪除此案件嗎？此操作無法復原。')) return;

    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await fetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '刪除案件失敗');
      }

      // 從列表中移除案件
      setCases(prev => prev.filter(c => c.case_id !== caseId));

      // 如果刪除的是當前選中的案件，清除選中狀態
      if (selectedCase?.case_id === caseId) {
        setSelectedCase(null);
      }

      alert('案件已刪除');
    } catch (error) {
      console.error('刪除案件失敗:', error);
      alert(`刪除失敗: ${error.message}`);
    }
  };

  // 新增階段
  const handleAddStage = (caseData: CaseData) => {
    setSelectedCase(caseData);
    setStageDialogMode('add');
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  // 編輯階段
  const handleEditStage = (caseData: CaseData, stageIndex: number) => {
    setSelectedCase(caseData);
    setStageDialogMode('edit');
    setEditingStageIndex(stageIndex);
    setShowStageDialog(true);
  };

  // 保存階段
  const handleSaveStage = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const firmCode = getFirmCodeOrThrow();

      if (stageDialogMode === 'add') {
        // 新增階段
        const response = await fetch(`/api/cases/${selectedCase.case_id}/stages?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time,
            note: stageData.note,
            is_completed: false,
            sort_order: 0
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '新增階段失敗');
        }

        console.log('階段新增成功');
      } else {
        // 編輯階段
        const response = await fetch(`/api/cases/${selectedCase.case_id}/stages/${editingStageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time,
            note: stageData.note
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '更新階段失敗');
        }

        console.log('階段更新成功');
      }

      // 更新本地案件資料
      setCases(prev => prev.map(c => {
        if (c.case_id === selectedCase.case_id) {
          const updatedStages = { ...c.progress_stages };
          const updatedTimes = { ...c.progress_times };
          const updatedNotes = { ...c.progress_notes };

          if (stageDialogMode === 'add') {
            updatedStages[stageData.stageName] = stageData.date;
            if (stageData.time) updatedTimes[stageData.stageName] = stageData.time;
            if (stageData.note) updatedNotes[stageData.stageName] = stageData.note;
          } else {
            // 編輯模式：需要找到原始階段名稱並更新
            const stageNames = Object.keys(updatedStages);
            if (editingStageIndex >= 0 && editingStageIndex < stageNames.length) {
              const oldStageName = stageNames[editingStageIndex];
              delete updatedStages[oldStageName];
              delete updatedTimes[oldStageName];
              delete updatedNotes[oldStageName];

              updatedStages[stageData.stageName] = stageData.date;
              if (stageData.time) updatedTimes[stageData.stageName] = stageData.time;
              if (stageData.note) updatedNotes[stageData.stageName] = stageData.note;
            }
          }

          // 建立階段資料夾
          FolderManager.createStageFolder(c.case_id, stageData.stageName);

          return {
            ...c,
            progress_stages: updatedStages,
            progress_times: updatedTimes,
            progress_notes: updatedNotes
          };
        }
        return c;
      }));

      return true;
    } catch (error) {
      console.error('保存階段失敗:', error);
      alert(`保存階段失敗: ${error.message}`);
      return false;
    }
  };

  // 刪除階段
  const handleDeleteStage = async (caseData: CaseData, stageIndex: number) => {
    const stageNames = Object.keys(caseData.progress_stages || {});
    if (stageIndex < 0 || stageIndex >= stageNames.length) return;

    const stageName = stageNames[stageIndex];
    if (!confirm(`確定要刪除階段「${stageName}」嗎？`)) return;

    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await fetch(`/api/cases/${caseData.case_id}/stages/${stageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '刪除階段失敗');
      }

      // 更新本地案件資料
      setCases(prev => prev.map(c => {
        if (c.case_id === caseData.case_id) {
          const updatedStages = { ...c.progress_stages };
          const updatedTimes = { ...c.progress_times };
          const updatedNotes = { ...c.progress_notes };

          delete updatedStages[stageName];
          delete updatedTimes[stageName];
          delete updatedNotes[stageName];

          return {
            ...c,
            progress_stages: updatedStages,
            progress_times: updatedTimes,
            progress_notes: updatedNotes
          };
        }
        return c;
      }));

      console.log('階段刪除成功');
    } catch (error) {
      console.error('刪除階段失敗:', error);
      alert(`刪除階段失敗: ${error.message}`);
    }
  };

  // 檔案上傳完成回調
  const handleFileUploadComplete = () => {
    console.log('檔案上傳完成');
    // 可以在這裡重新載入檔案列表或更新 UI
  };

  // 匯入完成回調
  const handleImportComplete = (importedCases: any[]) => {
    console.log('匯入的案件:', importedCases);

    // 將匯入的案件轉換為系統格式並添加到列表
    const newCases: CaseData[] = importedCases.map((imported, index) => {
      const caseId = `imported_${Date.now()}_${index}`;
      const caseData: CaseData = {
        case_id: caseId,
        case_type: imported.type,
        client: imported.title.split(' / ')[2] || imported.title,
        case_reason: imported.fields['案由'] || imported.title,
        case_number: imported.fields['案號'] || '',
        lawyer: imported.fields['律師'] || '',
        legal_affairs: imported.fields['法務'] || '',
        opposing_party: imported.fields['對造'] || imported.fields['被告'] || '',
        court: imported.fields['法院'] || '',
        division: imported.fields['股別'] || '',
        progress: '委任',
        progress_date: new Date().toISOString().split('T')[0],
        created_date: new Date().toISOString().split('T')[0],
        progress_stages: { '委任': new Date().toISOString().split('T')[0] },
        progress_times: {},
        progress_notes: {}
      };

      // 為匯入的案件建立資料夾結構
      FolderManager.createDefaultFolders(caseId);
      FolderManager.createCaseInfoExcel(caseId, {
        caseNumber: caseData.case_number || '',
        client: caseData.client,
        caseType: caseData.case_type,
        lawyer: caseData.lawyer || '',
        legalAffairs: caseData.legal_affairs || '',
        caseReason: caseData.case_reason || '',
        opposingParty: caseData.opposing_party || '',
        court: caseData.court || '',
        division: caseData.division || '',
        progress: caseData.progress || '',
        progressDate: caseData.progress_date || '',
        createdDate: caseData.created_date || ''
      });

      return caseData;
    });

    setCases(prev => [...newCases, ...prev]);
    alert(`成功匯入 ${newCases.length} 筆案件`);
  };

  // 資料夾展開/收合
  const toggleFolder = (caseId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // 欄位顯示切換
  const toggleColumn = (column: keyof VisibleColumns) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // 轉移到結案案件
  const handleTransferToClosed = () => {
    if (selectedCaseIds.length === 0) {
      alert('請先選擇要轉移的案件');
      return;
    }

    const selectedCases = cases.filter(c => selectedCaseIds.includes(c.case_id));
    setShowClosedTransferDialog(true);
  };

  // 確認轉移到結案
  const handleConfirmTransfer = async (payload?: { targetPath?: string }) => {
    try {
      // 為選中的案件添加「已結案」階段
      const updatedCases = cases.map(c => {
        if (selectedCaseIds.includes(c.case_id)) {
          const updatedStages = { ...c.progress_stages };
          updatedStages['已結案'] = new Date().toISOString().split('T')[0];

          // 建立結案階段資料夾
          FolderManager.createStageFolder(c.case_id, '已結案');

          return {
            ...c,
            progress_stages: updatedStages,
            progress: '已結案'
          };
        }
        return c;
      });

      setCases(updatedCases);
      setSelectedCaseIds([]);
      setShowClosedTransferDialog(false);

      alert(`成功轉移 ${selectedCaseIds.length} 筆案件到結案狀態`);
    } catch (error) {
      console.error('轉移案件失敗:', error);
      alert('轉移失敗，請稍後再試');
    }
  };

  // 取得階段顯示文字和樣式
  const getStageDisplay = (caseData: CaseData) => {
    const stages = caseData.progress_stages || {};
    const times = caseData.progress_times || {};
    const notes = caseData.progress_notes || {};

    if (Object.keys(stages).length === 0) {
      return (
        <span className="stage-tag default">
          {caseData.progress || '無進度'}
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(stages).map(([stageName, stageDate]) => {
          const today = new Date();
          const targetDate = new Date(stageDate);
          const diffTime = targetDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let stageClass = 'default';
          if (stageName.includes('結案')) {
            stageClass = 'completed';
          } else if (diffDays < 0) {
            stageClass = 'overdue';
          } else if (diffDays === 0) {
            stageClass = 'in-progress';
          } else if (diffDays <= 3) {
            stageClass = 'pending';
          }

          const displayText = times[stageName]
            ? `${stageName} (${times[stageName]})`
            : stageName;

          return (
            <span
              key={stageName}
              className={`stage-tag small ${stageClass}`}
              title={`${stageDate}${times[stageName] ? ` ${times[stageName]}` : ''}${notes[stageName] ? `\n備註: ${notes[stageName]}` : ''}`}
            >
              {displayText}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>

            {/* 日期提醒小工具 */}
            <div className="w-full sm:w-auto">
              <DateReminderWidget
                caseData={cases}
                onCaseSelect={(caseData) => setSelectedCase(caseData)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* 搜尋 */}
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

            {/* 功能按鈕 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddCase}
                className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>
              <button
                onClick={() => setShowFileUpload(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>上傳檔案</span>
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>匯入Excel</span>
              </button>
            </div>
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
              <option value="open">進行中</option>
              <option value="closed">已結案</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有類型</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={lawyerFilter}
              onChange={(e) => setLawyerFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有律師</option>
              {uniqueLawyers.map(lawyer => (
                <option key={lawyer} value={lawyer}>{lawyer}</option>
              ))}
            </select>
          </div>
        )}

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個案件
          </div>
        )}

        {/* 批量操作工具列 */}
        {selectedCaseIds.length > 0 && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-800">
                已選擇 {selectedCaseIds.length} 筆案件
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isAllSelected ? '取消全選' : '全選'}
              </button>
              <button
                onClick={handleClearSelection}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                取消選擇
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTransferToClosed}
                className="bg-[#f39c12] text-white px-3 py-1.5 rounded-md text-sm hover:bg-[#d68910] transition-colors flex items-center space-x-1"
              >
                <FileText className="w-4 h-4" />
                <span>轉移至結案</span>
              </button>
              <button
                onClick={handleBatchDelete}
                className="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-red-700 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除</span>
              </button>
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                    />
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
                      委任律師
                    </th>
                  )}
                  {visibleColumns.legalAffairs && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      法務
                    </th>
                  )}
                  {visibleColumns.progress && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      進度階段
                    </th>
                  )}
                  {visibleColumns.court && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      負責法院
                    </th>
                  )}
                  {visibleColumns.division && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      負責股別
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCases.map((caseData, index) => (
                  <React.Fragment key={caseData.case_id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCase?.case_id === caseData.case_id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => setSelectedCase(caseData)}
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(caseData.case_id)}
                          onChange={(e) => handleCaseSelect(caseData.case_id, e.target.checked)}
                          className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                        />
                      </td>
                      {visibleColumns.caseNumber && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.case_number}
                        </td>
                      )}
                      {visibleColumns.client && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.client}
                        </td>
                      )}
                      {visibleColumns.caseType && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {caseData.case_type}
                          </span>
                        </td>
                      )}
                      {visibleColumns.lawyer && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.lawyer}
                        </td>
                      )}
                      {visibleColumns.legalAffairs && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.legal_affairs}
                        </td>
                      )}
                      {visibleColumns.progress && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStageDisplay(caseData)}
                        </td>
                      )}
                      {visibleColumns.court && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.court}
                        </td>
                      )}
                      {visibleColumns.division && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {caseData.division}
                        </td>
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
                          <button
                            onClick={() => handleDeleteCase(caseData.case_id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleFolder(caseData.case_id)}
                            className="text-gray-400 hover:text-green-600 transition-colors"
                            title="檔案管理"
                          >
                            {expandedFolders[caseData.case_id] ? (
                              <FolderOpen className="w-4 h-4" />
                            ) : (
                              <Folder className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* 資料夾樹狀結構 */}
                    {expandedFolders[caseData.case_id] && (
                      <tr>
                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-6 py-4 bg-gray-50">
                          <FolderTree
                            caseId={caseData.case_id}
                            clientName={caseData.client}
                            isExpanded={true}
                            onToggle={() => toggleFolder(caseData.case_id)}
                            onFileUpload={(folderPath) => {
                              console.log(`上傳檔案到: ${folderPath}`);
                            }}
                            onFolderCreate={(parentPath) => {
                              console.log(`在 ${parentPath} 建立資料夾`);
                            }}
                            onDelete={(path, type) => {
                              console.log(`刪除 ${type}: ${path}`);
                            }}
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

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditCase(selectedCase)}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
                  </button>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 基本資訊 */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">案號</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.case_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">案由</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.case_reason}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">對造</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.opposing_party}</p>
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

              {/* 案件進度 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={() => handleAddStage(selectedCase)}
                    className="bg-[#27ae60] text-white px-3 py-1 rounded text-xs hover:bg-[#229954] transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {Object.entries(selectedCase.progress_stages || {}).map(([stageName, stageDate], index) => {
                    const stageTime = selectedCase.progress_times?.[stageName];
                    const stageNote = selectedCase.progress_notes?.[stageName];

                    return (
                      <div key={stageName} className="flex items-center justify-between p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{stageName}</span>
                            <span className="text-xs text-gray-500">{stageDate}</span>
                          </div>
                          {stageTime && (
                            <div className="text-xs text-gray-600 mt-1">時間: {stageTime}</div>
                          )}
                          {stageNote && (
                            <div className="text-xs text-gray-600 mt-1">備註: {stageNote}</div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={() => handleEditStage(selectedCase, index)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="編輯階段"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteStage(selectedCase, index)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="刪除階段"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {Object.keys(selectedCase.progress_stages || {}).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">尚無進度階段</p>
                      <button
                        onClick={() => handleAddStage(selectedCase)}
                        className="mt-2 text-[#334d6d] hover:text-[#3f5a7d] text-sm"
                      >
                        點擊新增第一個階段
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 案件表單對話框 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleSaveCase}
        caseData={editingCase}
        mode={caseFormMode}
      />

      {/* 階段編輯對話框 */}
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

      {/* 檔案上傳對話框 */}
      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={handleFileUploadComplete}
        selectedCaseIds={selectedCaseIds}
        cases={cases.map(c => ({
          id: c.case_id,
          client: c.client,
          caseNumber: c.case_number || c.case_id
        }))}
      />

      {/* 匯入資料對話框 */}
      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      {/* 轉移至結案對話框 */}
      <ClosedTransferDialog
        isOpen={showClosedTransferDialog}
        cases={selectedCaseIds.map(id => {
          const caseData = cases.find(c => c.case_id === id);
          return {
            id,
            caseNo: caseData?.case_number,
            title: caseData?.client
          };
        })}
        onClose={() => setShowClosedTransferDialog(false)}
        onConfirm={handleConfirmTransfer}
      />
    </div>
  );
}
// src/pages/CaseOverview.tsx
import { useNavigate } from 'react-router-dom';
import { hasClosedStage } from '../utils/caseStage';
import StageEditDialog, { StageFormData } from '../components/StageEditDialog';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  Folder,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import CaseForm from '../components/CaseForm';
import ImportDataDialog from '../components/ImportDataDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import DateReminderWidget from '../components/DateReminderWidget';
import FolderTree from '../components/FolderTree';

// 導入型別
import type {
  TableCase,
  FormCaseData,
  ReminderCaseData,
  CaseStatus,
  Stage,
  DialogConfig,
  VisibleColumns,
} from '../types';
import CaseStageManager from '../utils/caseStageManager';

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
  const nowId = base?.id ?? `case_${Date.now()}`;
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
    stages: base?.stages ?? [],
  };
}

/* ------------------ 主元件 ------------------ */
export default function CaseOverview() {
  const navigate = useNavigate();

  // 案件資料狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);

  // 載入案件列表
  const loadCases = async () => {
    try {
      const firmCode = localStorage.getItem('law_firm_code') || 'default';
      const response = await fetch(`/api/cases?firm_code=${firmCode}&status=open`);
      
      if (response.ok) {
        const data = await response.json();
        // 轉換API資料格式為前端格式
        const transformedCases = (data.items || []).map((apiCase: any) => ({
          id: apiCase.id,
          caseNumber: apiCase.case_number || '',
          client: apiCase.client?.name || '',
          caseType: apiCase.case_type || '',
          lawyer: '', // 需要從用戶資料中取得
          legalAffairs: '', // 需要從用戶資料中取得
          caseReason: apiCase.case_reason || '',
          opposingParty: apiCase.opposing_party || '',
          court: apiCase.court || '',
          division: apiCase.division || '',
          progress: apiCase.progress || '',
          progressDate: apiCase.progress_date || '',
          status: apiCase.is_closed ? 'completed' : 'active',
          stages: [], // 初始為空陣列
        }));
        setCases(transformedCases);
      } else {
        // 處理錯誤回應
        let errorMessage = '載入案件列表失敗';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // 如果不是JSON格式，使用預設錯誤訊息
          errorMessage = `伺服器錯誤: ${response.status} ${response.statusText}`;
        }
        console.error('載入案件列表失敗:', errorMessage);
        showError(errorMessage);
      }
    } catch (error) {
      console.error('載入案件列表錯誤:', error);
      showError('無法連接到伺服器');
    }
  };

  // 初始載入
  useEffect(() => {
    loadCases();
    
    // 載入持久化的階段資料
    const stageManager = CaseStageManager.getInstance();
    setCases(prevCases => 
      prevCases.map(caseItem => ({
        ...caseItem,
        stages: stageManager.getCaseStages(caseItem.id)
      }))
    );
  }, []);

  // 選擇和轉移狀態
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // 資料夾樹狀態 - 只允許一個展開
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // 搜尋和篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
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

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);

  const [showImportDialog, setShowImportDialog] = useState(false);

  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
    title: '',
    message: '',
    type: 'info',
  });

  // 進度編輯對話框狀態
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [stageInitial, setStageInitial] = useState<Partial<StageFormData>>({});
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);

  /* -------- 階段管理功能 -------- */
  const getStageSuggestions = (caseId?: string): string[] => {
    if (!caseId) return ['委任', '起訴', '開庭', '判決', '上訴', '執行', '結案'];
    const found = cases.find((c) => c.id === caseId);
    const names = (found?.stages ?? []).map((s) => s.name);
    const base = ['委任', '起訴', '開庭', '判決', '上訴', '執行', '結案'];
    return Array.from(new Set([...names, ...base]));
  };

  const openAddStage = () => {
    if (!selectedCase) return;
    setStageDialogMode('add');
    setEditingStageIndex(null);
    setStageInitial({
      stageName: '',
      date: new Date().toISOString().slice(0, 10),
      time: '',
      note: '',
    });
    setShowStageDialog(true);
  };

  const openEditStage = (idx: number) => {
    if (!selectedCase) return;
    const st = selectedCase.stages[idx];
    setStageDialogMode('edit');
    setEditingStageIndex(idx);
    setStageInitial({
      stageName: st.name,
      date: st.date,
      time: st.time ?? '',
      note: st.note ?? '',
    });
    setShowStageDialog(true);
  };

  const handleDeleteStage = (idx: number) => {
    if (!selectedCase) return;
    
    const stageManager = CaseStageManager.getInstance();
    
    const stage = selectedCase.stages[idx];
    setDialogConfig({
      title: '確認刪除階段',
      message: `確定要刪除階段「${stage.name}」嗎？此操作無法復原。`,
      type: 'warning',
      onConfirm: () => {
        stageManager.deleteStage(selectedCase.id, idx);
        
        const updatedStages = stageManager.getCaseStages(selectedCase.id);
        const updatedCase = { ...selectedCase, stages: updatedStages };
        
        setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCase : c)));
        setSelectedCase(updatedCase);
        setShowUnifiedDialog(false);
        showSuccess('階段已刪除');
      },
    });
    setShowUnifiedDialog(true);
  };

  const handleSaveStage = async (data: StageFormData): Promise<boolean> => {
    if (!selectedCase) return false;
    
    const stageManager = CaseStageManager.getInstance();

    try {
      // 先同步到後端
      const response = await fetch(`/api/cases/${selectedCase.id}/stages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.stageName,
          stage_date: data.date,
          completed: false,
          sort_order: selectedCase.stages.length
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('新增階段到後端失敗:', errorData);
        showError('新增階段失敗: ' + (errorData.detail || '未知錯誤'));
        return false;
      }

      // 後端成功後更新前端狀態
    } catch (error) {
      console.error('新增階段請求失敗:', error);
      showError('新增階段失敗: 無法連接到伺服器');
      return false;
    }
    
    // 使用 CaseStageManager 處理階段資料
    if (stageDialogMode === 'add') {
      const newStage = {
        name: data.stageName,
        date: data.date,
        note: data.note,
        time: data.time,
        completed: false,
      };
      
      stageManager.addStage(selectedCase.id, newStage);
      
      const updatedStages = stageManager.getCaseStages(selectedCase.id);
      const updatedCase = { ...selectedCase, stages: updatedStages };
      
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCase : c)));
      setSelectedCase(updatedCase);
    } else if (editingStageIndex !== null) {
      const updatedStage = {
        name: data.stageName,
        date: data.date,
        note: data.note,
        time: data.time,
        completed: selectedCase.stages[editingStageIndex]?.completed || false,
      };
      
      stageManager.updateStage(selectedCase.id, editingStageIndex, updatedStage);
      
      const updatedStages = stageManager.getCaseStages(selectedCase.id);
      const updatedCase = { ...selectedCase, stages: updatedStages };
      
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCase : c)));
      setSelectedCase(updatedCase);
    }
    
    return true;
  };

  /* -------- 資料夾樹管理 -------- */
  const handleFolderToggle = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null); // 收合當前展開的
    } else {
      setExpandedCaseId(caseId); // 展開新的，自動收合舊的
    }
  };

  const handleFileUpload = (caseId: string, folderPath: string) => {
    console.log(`案件 ${caseId} 上傳檔案到: ${folderPath}`);
    // TODO: 實現檔案上傳邏輯
  };

  const handleFolderCreate = (caseId: string, parentPath: string) => {
    console.log(`案件 ${caseId} 在 ${parentPath} 建立資料夾`);
    // TODO: 實現資料夾建立邏輯
  };

  const handleFileDelete = (caseId: string, path: string, type: 'folder' | 'file') => {
    console.log(`案件 ${caseId} 刪除 ${type}: ${path}`);
    // TODO: 實現刪除邏輯
  };

  /* -------- 轉移結案邏輯 -------- */
  const handleTransferToClosed = () => {
    if (selectedIds.length === 0) {
      setDialogConfig({
        title: '提示',
        message: '請先勾選要轉移的案件',
        type: 'warning',
      });
      setShowUnifiedDialog(true);
      return;
    }
    const selectedCases = cases.filter((c) => selectedIds.includes(c.id));
    const notClosed = selectedCases.filter((c) => !hasClosedStage(c.stages));
    if (notClosed.length > 0) {
      const list = notClosed.map((c) => `#${c.id} ${c.caseNumber}`).join('\n');
      setDialogConfig({
        title: '無法轉移',
        message: `以下案件尚未新增「已結案」階段，無法轉移：\n\n${list}\n\n請先到案件詳情 → 新增階段，加入「已結案」。`,
        type: 'warning',
      });
      setShowUnifiedDialog(true);
      return;
    }
    setShowTransferConfirm(true);
  };

  /* -------- 搜尋功能 -------- */
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
        .some((v) => v.includes(term))
    );
    setFilteredCases(next);
  }, [searchTerm, cases]);

  /* -------- 樣式工具函數 -------- */
  const getStatusColor = (status: CaseStatus) => {
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

  /* -------- 案件 CRUD 操作 -------- */
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
      const stageManager = CaseStageManager.getInstance();
      
      if (caseFormMode === 'add') {
        const newRow = formToTableCase(form);
        setCases((prev) => [...prev, newRow]);
        setSelectedCase(newRow);
        
        // 建立預設資料夾結構
        stageManager.createDefaultFolders(newRow.id);
        
        showSuccess('案件新增成功！');
      } else {
        setCases((prev) =>
          prev.map((c) => (c.id === (form.case_id ?? '') ? formToTableCase(form, c) : c))
        );
        const updated = formToTableCase(form, selectedCase ?? undefined);
        setSelectedCase(updated);
        
        // 更新案件資訊 Excel
        if (form.case_id) {
          stageManager.updateCaseInfoExcel(form.case_id, form);
        }
        
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

  /* -------- 工具函數 -------- */
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

  const handleImportComplete = () => {
    showSuccess('資料匯入完成！');
  };

  /* -------- 提醒元件資料 -------- */
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
          progress_times: {},
          progress_notes: {},
        };
      }),
    [cases]
  );

  const onCaseSelectFromReminder = (reminderCase: ReminderCaseData) => {
    const found = cases.find((c) => c.id === reminderCase.case_id);
    if (found) setSelectedCase(found);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAddCase}
                className="bg-[#3498db] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-[#27ae60] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#229954] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <Upload className="w-4 h-4" />
                <span>上傳資料</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-[#8e44ad] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#7d3c98] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <Download className="w-4 h-4" />
                <span>匯入資料</span>
              </button>

              <button
                onClick={handleTransferToClosed}
                className="bg-[#f39c12] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#d68910] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <CheckCircle className="w-4 h-4" />
                <span>轉移結案</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
            {/* 跑馬燈：日期提醒 */}
            <div className="w-full sm:w-64 order-2 sm:order-1">
              <DateReminderWidget
                caseData={reminderData}
                onCaseSelect={onCaseSelectFromReminder}
              />
            </div>

            {/* 搜尋 */}
            <div className="relative flex-1 sm:flex-none order-1 sm:order-2">
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
              onClick={() => setShowFilters((s) => !s)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors order-3"
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
        <div className="bg-gray-50 border-b border-gray-200 px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="text-sm font-medium text-gray-700">顯示欄位：</span>
            {Object.entries(visibleColumns).map(([key, visible]) => (
              <label key={key} className="flex items-center space-x-1 text-xs sm:text-sm whitespace-nowrap">
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
                <span className="text-gray-600 text-xs sm:text-sm">
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
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    選擇
                  </th>
                  {visibleColumns.client && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      當事人
                    </th>
                  )}
                  {visibleColumns.caseNumber && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      案號
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCases.map((row, index) => (
                  <>
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
                          checked={selectedIds.includes(row.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, row.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                            }
                          }}
                        />
                      </td>

                      {visibleColumns.client && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.client}
                        </td>
                      )}
                      {visibleColumns.caseNumber && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.caseNumber}
                        </td>
                      )}
                      {visibleColumns.caseType && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              row.status
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCase(row);
                            }}
                            className="text-gray-400 hover:text-[#334d6d] transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFolderToggle(row.id);
                            }}
                            className={`transition-colors ${
                              expandedCaseId === row.id
                                ? 'text-blue-600 hover:text-blue-700'
                                : 'text-gray-400 hover:text-blue-600'
                            }`}
                            title="展開/收合資料夾"
                          >
                            <Folder className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteCase(row);
                            }}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* 資料夾樹展開區域 - 緊接在對應案件下方 */}
                    {expandedCaseId === row.id && (
                      <tr key={`folder-${row.id}`} className="bg-gray-50">
                        <td colSpan={10} className="px-0 py-0">
                          <div className="px-6 py-4">
                            <FolderTree
                              caseId={row.id}
                              clientName={row.client}
                              isExpanded={true}
                              onToggle={() => handleFolderToggle(row.id)}
                              onFileUpload={(folderPath) => handleFileUpload(row.id, folderPath)}
                              onFolderCreate={(parentPath) => handleFolderCreate(row.id, parentPath)}
                              onDelete={(path, type) => handleFileDelete(row.id, path, type)}
                              s3Config={{
                                endpoint: process.env.VITE_SPACES_ENDPOINT || 'https://sgp1.digitaloceanspaces.com',
                                accessKey: process.env.VITE_SPACES_ACCESS_KEY || '',
                                secretKey: process.env.VITE_SPACES_SECRET_KEY || '',
                                bucket: process.env.VITE_SPACES_BUCKET || '',
                                region: process.env.VITE_SPACES_REGION || 'sgp1'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
                  {/* 手機版關閉按鈕 */}
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600" title="更多">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
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
                    onClick={openAddStage}
                    className="bg-[#27ae60] text-white px-3 py-1.5 rounded-md hover:bg-[#229954] transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => {
                    const isCurrent = stage.name === selectedCase.progress;
                    return (
                      <div
                        key={`${stage.name}-${idx}`}
                        className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50 group"
                      >
                        <div
                          className={`min-w-[88px] px-3 py-1 rounded-xl text-xs font-semibold text-center ${getStageColor(
                            stage,
                            isCurrent
                          )}`}
                        >
                          {stage.name}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span 
                              className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                              onClick={() => openEditStage(idx)}
                              title="點擊編輯此進度"
                            >
                              {stage.name}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {stage.date}
                                {stage.time ? ` ${stage.time}` : ''}
                              </span>
                              <button
                                onClick={() => handleDeleteStage(idx)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all"
                                title="刪除階段"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {stage.note && (
                            <p className="text-xs text-gray-500 mt-1">{stage.note}</p>
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

      <StageEditDialog
        isOpen={showStageDialog}
        mode={stageDialogMode}
        initial={stageInitial}
        suggestions={getStageSuggestions(selectedCase?.id)}
        onClose={() => setShowStageDialog(false)}
        onSave={handleSaveStage}
      />

      {/* 轉移確認框 */}
      {showTransferConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="bg-[#334d6d] text-white px-5 py-3 rounded-t-xl">
              <h3 className="text-lg font-semibold">確認轉移至結案案件</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                即將轉移 {selectedIds.length} 筆案件至「結案案件」。
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowTransferConfirm(false)}
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowTransferConfirm(false);
                  navigate('/closed-cases');
                }}
                className="px-4 py-2 rounded-md bg-[#f39c12] hover:bg-[#d68910] text-white"
              >
                確認轉移
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
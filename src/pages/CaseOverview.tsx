import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Upload, Download, Eye, Edit, Trash2,
  FileText, User, Building, Calendar, Clock, ChevronDown, ChevronUp,
  MoreVertical, X, CheckCircle, AlertCircle, Archive, Folder,
  MoreHorizontal
} from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog, { type StageFormData } from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import { parseExcelToCases } from '../utils/importers';
import { FolderManager } from '../utils/folderManager';
import ConfirmDialog from '../components/ConfirmDialog';
import { hasClosedStage } from '../utils/caseStage';
import { apiFetch, getFirmCodeOrThrow, hasAuthToken, clearLoginAndRedirect } from '../utils/api';
import type { TableCase, Stage, CaseStatus, VisibleColumns, DialogConfig } from '../types';

export default function CaseOverview() {
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed' | 'urgent'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({
    title: '',
    message: '',
    type: 'info'
  });

  // 表單狀態
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<TableCase | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStage, setEditingStage] = useState<{ index: number; stage: Stage } | null>(null);

  // 顯示控制
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    caseNumber: true,
    client: true,
    caseType: true,
    lawyer: true,
    legalAffairs: true,
    progress: true,
    progressDate: true,
    court: false,
    division: false
  });

  // 檢查登入狀態
  useEffect(() => {
    if (!hasAuthToken()) {
      console.warn('沒有登入 token，重新導向到登入頁面');
      clearLoginAndRedirect();
      return;
    }
    loadCases();
  }, []);

  // 載入案件列表
  const loadCases = useCallback(async () => {
    if (!hasAuthToken()) {
      console.warn('登入狀態不完整，無法載入案件');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}&status=open`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('載入案件失敗:', errorText);
        throw new Error(`載入案件失敗: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('載入的案件資料:', data);

      // 轉換後端資料為前端格式
      const transformedCases: TableCase[] = await Promise.all((data.items || []).map(async (apiCase: any) => {
        // 載入案件的階段資料
        let stages: Stage[] = [];
        try {
          const stagesResponse = await apiFetch(`/api/cases/${apiCase.id}/stages?firm_code=${encodeURIComponent(firmCode)}`);
          if (stagesResponse.ok) {
            const stagesData = await stagesResponse.json();
            stages = (stagesData || []).map((stage: any) => ({
              name: stage.stage_name,
              date: stage.stage_date || '',
              completed: stage.is_completed || false,
              note: stage.note || '',
              time: stage.stage_time || ''
            }));
          }
        } catch (error) {
          console.error(`載入案件 ${apiCase.id} 的階段失敗:`, error);
        }

        return {
        id: apiCase.id,
        caseNumber: apiCase.case_number || '未設定',
        client: apiCase.client_name || apiCase.client?.name || '未知客戶',
        caseType: apiCase.case_type || '未分類',
        lawyer: apiCase.lawyer_name || apiCase.lawyer?.full_name || '',
        legalAffairs: apiCase.legal_affairs_name || apiCase.legal_affairs?.full_name || '',
        caseReason: apiCase.case_reason || '',
        opposingParty: apiCase.opposing_party || '',
        court: apiCase.court || '',
        division: apiCase.division || '',
        progress: apiCase.progress || '委任',
        progressDate: apiCase.progress_date || new Date().toISOString().split('T')[0],
        status: 'active' as CaseStatus,
        stages: stages
        };
      }));

      setCases(transformedCases);
      console.log('轉換後的案件資料:', transformedCases);

    } catch (error) {
      console.error('載入案件失敗:', error);
      setError(error.message || '載入案件失敗');

      // 如果是認證錯誤，清除登入狀態
      if (error.message?.includes('登入狀態已過期')) {
        clearLoginAndRedirect();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 搜尋和過濾
  useEffect(() => {
    let filtered = cases;

    // 狀態過濾
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // 搜尋過濾
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
        [
          c.caseNumber,
          c.client,
          c.caseType,
          c.lawyer,
          c.legalAffairs,
          c.caseReason,
          c.opposingParty,
          c.court,
          c.division,
          c.progress
        ]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredCases(filtered);
  }, [searchTerm, cases, statusFilter]);

  // 新增案件
  const handleAddCase = async (caseData: any): Promise<boolean> => {
    try {
      console.log('DEBUG: handleAddCase 收到資料:', caseData);

      // 轉換為 TableCase 格式
      const newCase: TableCase = {
        id: caseData.case_id,
        caseNumber: caseData.case_number || '未設定',
        client: caseData.client || '未知客戶',
        caseType: caseData.case_type || '未分類',
        lawyer: caseData.lawyer || '',
        legalAffairs: caseData.legal_affairs || '',
        caseReason: caseData.case_reason || '',
        opposingParty: caseData.opposing_party || '',
        court: caseData.court || '',
        division: caseData.division || '',
        progress: caseData.progress || '委任',
        progressDate: caseData.progress_date || new Date().toISOString().split('T')[0],
        status: 'active' as CaseStatus,
        stages: []
      };

      console.log('DEBUG: 轉換後的案件資料:', newCase);

      // 更新本地狀態
      setCases(prev => [newCase, ...prev]);

      // 建立預設資料夾和 Excel 檔案
      FolderManager.createDefaultFolders(newCase.id);
      FolderManager.createCaseInfoExcel(newCase.id, {
        caseNumber: newCase.caseNumber,
        client: newCase.client,
        caseType: newCase.caseType,
        lawyer: newCase.lawyer,
        legalAffairs: newCase.legalAffairs,
        caseReason: newCase.caseReason,
        opposingParty: newCase.opposingParty,
        court: newCase.court,
        division: newCase.division,
        progress: newCase.progress,
        progressDate: newCase.progressDate,
        createdDate: new Date().toISOString().split('T')[0]
      });

      console.log('DEBUG: 案件新增成功');
      return true;
    } catch (error) {
      console.error('新增案件到本地狀態失敗:', error);
      return false;
    }
  };

  // 編輯案件
  const handleEditCase = async (caseData: any): Promise<boolean> => {
    if (!caseData.case_id) {
      console.error('編輯案件失敗: 缺少 case_id');
      setDialogConfig({
        title: '編輯失敗',
        message: '案件 ID 不存在，無法編輯',
        type: 'error'
      });
      setShowUnifiedDialog(true);
      return false;
    }

    try {
      console.log('DEBUG: handleEditCase 收到資料:', caseData);

      // 更新本地狀態
      setCases(prev => prev.map(c =>
        c.id === caseData.case_id ? {
          ...c,
          caseNumber: caseData.case_number || c.caseNumber,
          client: caseData.client || c.client,
          caseType: caseData.case_type || c.caseType,
          lawyer: caseData.lawyer || c.lawyer,
          legalAffairs: caseData.legal_affairs || c.legalAffairs,
          caseReason: caseData.case_reason || c.caseReason,
          opposingParty: caseData.opposing_party || c.opposingParty,
          court: caseData.court || c.court,
          division: caseData.division || c.division,
          progress: caseData.progress || c.progress,
          progressDate: caseData.progress_date || c.progressDate
        } : c
      ));

      // 更新 Excel 檔案
      FolderManager.updateCaseInfoExcel(caseData.case_id, {
        caseNumber: caseData.case_number,
        client: caseData.client,
        caseType: caseData.case_type,
        lawyer: caseData.lawyer,
        legalAffairs: caseData.legal_affairs,
        caseReason: caseData.case_reason,
        opposingParty: caseData.opposing_party,
        court: caseData.court,
        division: caseData.division,
        progress: caseData.progress,
        progressDate: caseData.progress_date
      });

      console.log('DEBUG: 案件編輯成功');
      return true;
    } catch (error) {
      console.error('編輯案件失敗:', error);
      return false;
    }
  };

  // 刪除案件
  const handleDeleteCase = async (caseId: string) => {
    if (!hasAuthToken()) {
      clearLoginAndRedirect();
      return;
    }

    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        setSelectedCase(null);
        setDialogConfig({
          title: '刪除成功',
          message: '案件已成功刪除',
          type: 'success'
        });
        setShowUnifiedDialog(true);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || '刪除案件失敗');
      }
    } catch (error) {
      console.error('刪除案件失敗:', error);
      setDialogConfig({
        title: '刪除失敗',
        message: error.message || '刪除案件失敗',
        type: 'error'
      });
      setShowUnifiedDialog(true);
    }
  };

  // 新增階段
  const handleAddStage = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const firmCode = getFirmCodeOrThrow();

      // 呼叫後端 API 新增階段
      const response = await apiFetch(`/api/cases/${selectedCase.id}/stages?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'POST',
        body: JSON.stringify({
          stage_name: stageData.stageName,
          stage_date: stageData.date,
          stage_time: stageData.time,
          note: stageData.note,
          is_completed: false,
          sort_order: selectedCase.stages.length
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '新增階段失敗');
      }

      const newStage: Stage = {
        name: stageData.stageName,
        date: stageData.date,
        completed: false,
        note: stageData.note,
        time: stageData.time
      };

      // 更新本地狀態
      setCases(prev => prev.map(c =>
        c.id === selectedCase.id
          ? { ...c, stages: [...c.stages, newStage] }
          : c
      ));

      // 建立階段資料夾
      FolderManager.createStageFolder(selectedCase.id, stageData.stageName);

      console.log('階段新增成功:', newStage);
      return true;
    } catch (error) {
      console.error('新增階段失敗:', error);
      setDialogConfig({
        title: '新增階段失敗',
        message: error.message || '新增階段失敗',
        type: 'error'
      });
      setShowUnifiedDialog(true);
      return false;
    }
  };

  // 編輯階段
  const handleEditStage = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase || !editingStage) return false;

    try {
      const firmCode = getFirmCodeOrThrow();

      // 呼叫後端 API 更新階段
      const response = await apiFetch(`/api/cases/${selectedCase.id}/stages/${editingStage.index}?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage_name: stageData.stageName,
          stage_date: stageData.date,
          stage_time: stageData.time,
          note: stageData.note
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '更新階段失敗');
      }

      const updatedStage: Stage = {
        name: stageData.stageName,
        date: stageData.date,
        completed: editingStage.stage.completed,
        note: stageData.note,
        time: stageData.time
      };

      // 更新本地狀態
      setCases(prev => prev.map(c =>
        c.id === selectedCase.id
          ? {
              ...c,
              stages: c.stages.map((stage, index) =>
                index === editingStage.index ? updatedStage : stage
              )
            }
          : c
      ));

      console.log('階段編輯成功:', updatedStage);
      return true;
    } catch (error) {
      console.error('編輯階段失敗:', error);
      setDialogConfig({
        title: '編輯階段失敗',
        message: error.message || '編輯階段失敗',
        type: 'error'
      });
      setShowUnifiedDialog(true);
      return false;
    }
  };

  // 切換階段完成狀態
  const toggleStageCompletion = (stageIndex: number) => {
    if (!selectedCase) return;

    const stage = selectedCase.stages[stageIndex];
    if (!stage) return;

    // 呼叫後端 API 更新階段完成狀態
    const updateStageStatus = async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(`/api/cases/${selectedCase.id}/stages/${stageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_completed: !stage.completed
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '更新階段狀態失敗');
        }
      } catch (error) {
        console.error('更新階段狀態失敗:', error);
        // 恢復原狀態
        setCases(prev => prev.map(c =>
          c.id === selectedCase.id
            ? {
                ...c,
                stages: c.stages.map((s, index) =>
                  index === stageIndex
                    ? { ...s, completed: stage.completed }
                    : s
                )
              }
            : c
        ));
      }
    };

    setCases(prev => prev.map(c =>
      c.id === selectedCase.id
        ? {
            ...c,
            stages: c.stages.map((stage, index) =>
              index === stageIndex
                ? { ...stage, completed: !stage.completed }
                : stage
            )
          }
        : c
    ));

    // 異步更新後端
    updateStageStatus();
  };

  // Excel 匯入
  const handleImportComplete = async (importedCases: any[]) => {
    try {
      setLoading(true);

      console.log('匯入的案件:', importedCases);

      setDialogConfig({
        title: '匯入成功',
        message: `成功匯入 ${importedCases.length} 筆案件資料`,
        type: 'success'
      });
      setShowUnifiedDialog(true);

      // 重新載入案件列表
      await loadCases();
    } catch (error) {
      console.error('Excel 匯入失敗:', error);
      setDialogConfig({
        title: '匯入失敗',
        message: error.message || '匯入過程發生錯誤',
        type: 'error'
      });
      setShowUnifiedDialog(true);
    } finally {
      setLoading(false);
    }
  };

  // 轉移到結案案件
  const handleTransferToClosed = async (payload?: { targetPath?: string }) => {
    if (selectedCaseIds.length === 0) return;

    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      // 批量更新案件狀態為已結案
      for (const caseId of selectedCaseIds) {
        const response = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_closed: true,
            closed_at: new Date().toISOString().split('T')[0]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `轉移案件 ${caseId} 失敗`);
        }
      }

      // 從當前列表移除已轉移的案件
      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      setSelectedCase(null);

      setDialogConfig({
        title: '轉移成功',
        message: `成功轉移 ${selectedCaseIds.length} 筆案件到結案案件`,
        type: 'success'
      });
      setShowUnifiedDialog(true);

    } catch (error) {
      console.error('轉移案件失敗:', error);
      setDialogConfig({
        title: '轉移失敗',
        message: error.message || '轉移案件失敗',
        type: 'error'
      });
      setShowUnifiedDialog(true);
    } finally {
      setLoading(false);
    }
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedCaseIds.length === 0) return;

    const confirmMessage = `確定要刪除選中的 ${selectedCaseIds.length} 筆案件嗎？此操作無法復原。`;
    if (!confirm(confirmMessage)) return;

    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();

      for (const caseId of selectedCaseIds) {
        const response = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `刪除案件 ${caseId} 失敗`);
        }
      }

      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      setSelectedCase(null);

      setDialogConfig({
        title: '刪除成功',
        message: `成功刪除 ${selectedCaseIds.length} 筆案件`,
        type: 'success'
      });
      setShowUnifiedDialog(true);

    } catch (error) {
      console.error('批量刪除失敗:', error);
      setDialogConfig({
        title: '刪除失敗',
        message: error.message || '批量刪除失敗',
        type: 'error'
      });
      setShowUnifiedDialog(true);
    } finally {
      setLoading(false);
    }
  };

  // 勾選案件
  const handleCaseSelect = (caseId: string, checked: boolean) => {
    setSelectedCaseIds(prev =>
      checked
        ? [...prev, caseId]
        : prev.filter(id => id !== caseId)
    );
  };

  // 全選/取消全選
  const handleSelectAll = (checked: boolean) => {
    setSelectedCaseIds(checked ? filteredCases.map(c => c.id) : []);
  };

  // 資料夾樹管理
  const handleFolderToggle = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null); // 收合當前展開的
    } else {
      setExpandedCaseId(caseId); // 展開新的，自動收合舊的
    }
  };

  // 取得狀態顏色
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

  const getStatusText = (status: CaseStatus) => {
    switch (status) {
      case 'active':
        return '進行中';
      case 'pending':
        return '待處理';
      case 'completed':
        return '已完成';
      case 'urgent':
        return '緊急';
      default:
        return '未知';
    }
  };

  // Helper functions for stage status
  const getStageStatus = (stage: Stage) => {
    if (stage.completed) return 'completed';
    if (!stage.date) return 'no-date';

    const stageDate = new Date(stage.date);
    const today = new Date();
    const diffDays = Math.ceil((stageDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'urgent';
    return 'normal';
  };

  const getStageStatusText = (stage: Stage) => {
    if (stage.completed) return '已完成';
    if (!stage.date) return '未設定日期';

    const stageDate = new Date(stage.date);
    const today = new Date();
    const diffDays = Math.ceil((stageDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return '已逾期';
    if (diffDays === 0) return '今日到期';
    if (diffDays <= 3) return `${diffDays}天後到期`;
    return '正常';
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setCaseFormMode('add');
                  setEditingCase(null);
                  setShowCaseForm(true);
                }}
                className="bg-[#3498db] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <button
                onClick={() => setShowFileUpload(true)}
                className="bg-[#27ae60] text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-[#229954] transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
              >
                <Upload className="w-4 h-4" />
                <span>上傳檔案</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-green-600 text-white px-3 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-1 sm:space-x-2 flex-1 sm:flex-none justify-center"
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

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
            {/* 跑馬燈：日期提醒 */}
            <div className="w-full sm:w-64 order-2 sm:order-1">
              <DateReminderWidget
                caseData={cases.map(c => ({
                  case_id: c.id,
                  client: c.client,
                  case_type: c.caseType,
                  progress_stages: c.stages.reduce((acc, stage) => {
                    acc[stage.name] = stage.date;
                    return acc;
                  }, {} as Record<string, string>),
                  progress_times: c.stages.reduce((acc, stage) => {
                    if (stage.time) acc[stage.name] = stage.time;
                    return acc;
                  }, {} as Record<string, string>),
                  progress_notes: c.stages.reduce((acc, stage) => {
                    if (stage.note) acc[stage.name] = stage.note;
                    return acc;
                  }, {} as Record<string, string>)
                }))}
                onCaseSelect={(caseData) => {
                  const foundCase = cases.find(c => c.id === caseData.case_id);
                  if (foundCase) {
                    setSelectedCase(foundCase);
                    setExpandedCaseId(foundCase.id);
                  }
                }}
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
          </div>
        </div>

        {/* 批量操作工具列 */}
        {selectedCaseIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-slide-up">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl px-6 py-4 flex items-center space-x-6">
              <span className="text-sm text-gray-700 font-medium">
                已選擇 {selectedCaseIds.length} 筆案件
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
                >
                  取消選擇
                </button>
                <div className="w-px h-5 bg-gray-300"></div>
                <button
                  onClick={handleBatchDelete}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center space-x-2 transition-all hover:shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>刪除</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
        <ConfirmDialog
                    ? '股別'
                </span>
              </label>
            ))}
          onConfirm={dialogConfig.onConfirm || (() => setDialogConfig(null))}
          onCancel={() => setDialogConfig(null)}
          showCancel={dialogConfig.type === 'warning' || dialogConfig.type === 'error'}
        </div>
      )}

      {/* 案件列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#334d6d]"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadCases}
                  className="mt-2 bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d]"
                >
                  重新載入
                </button>
              </div>
            </div>
          ) : (
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
                            checked={selectedCaseIds.includes(row.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCaseSelect(row.id, e.target.checked);
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
                            <div className="flex items-center space-x-2">
                              {row.lawyer}
                            </div>
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
                                if (!row.id) {
                                  alert('案件 ID 不存在，無法編輯');
                                  return;
                                }
                                setCaseFormMode('edit');
                                setEditingCase({
                                  ...row,
                                  case_id: row.id // 確保 case_id 存在
                                });
                                setShowCaseForm(true);
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
                                handleDeleteCase(row.id);
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
                                onToggle={() => {}} // 空函數，因為已經在這裡展開了
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
          )}
        </div>

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (!selectedCase.id) {
                        alert('案件 ID 不存在，無法編輯');
                        return;
                      }
                      setCaseFormMode('edit');
                      setEditingCase({
                        ...selectedCase,
                        case_id: selectedCase.id // 確保 case_id 存在
                      });
                      setShowCaseForm(true);
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
                  </button>
                  {/* 統一的關閉按鈕 - 手機和桌面都在右邊 */}
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-2 transition-colors"
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
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">案由</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason || '未設定'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">對造</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty || '未設定'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">負責法院</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.court || '未設定'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">負責股別</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.division || '未設定'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">委任律師</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer || '未指派'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">法務</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs || '未指派'}</p>
                  </div>
                </div>
              </div>

              <hr className="my-6" />

              {/* 進度階段 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={() => {
                      setStageDialogMode('add');
                      setEditingStage(null);
                      setShowStageDialog(true);
                    }}
                    className="bg-[#27ae60] text-white px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedCase.stages.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      尚未新增任何階段
                    </div>
                  ) : (
                    selectedCase.stages.map((stage, stageIndex) => {
                      const isCurrent = stage.name === selectedCase.progress;
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

                      return (
                        <div
                          key={`${stage.name}-${stageIndex}`}
                          className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 group border border-gray-100 mb-2"
                        >
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div
                                  className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${getStageColor(stage, isCurrent)}`}
                                  onClick={() => {
                                    setStageDialogMode('edit');
                                    setEditingStage({ index: stageIndex, stage });
                                    setShowStageDialog(true);
                                  }}
                                  title="點擊編輯此進度"
                                >
                                  {stage.name}
                                </div>
                                {stage.note && (
                                  <p className="text-xs text-gray-500 mt-2 ml-1">{stage.note}</p>
                                )}
                              </div>

                              <div className="flex flex-col items-end space-y-1">
                                <div className="bg-white px-2 py-1 rounded-md shadow-sm border border-gray-200">
                                  <span className="text-xs font-medium text-gray-700">
                                    {stage.date}
                                    {stage.time ? ` ${stage.time}` : ''}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => {
                                      const folderPath = FolderManager.getStageFolder(selectedCase.id, stage.name);
                                      console.log(`開啟階段資料夾: ${folderPath}`);
                                      alert(`開啟階段資料夾：${stage.name}\n路徑：${folderPath}`);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-all p-1 rounded"
                                    title="開啟階段資料夾"
                                  >
                                    <Folder className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`確定要刪除階段「${stage.name}」嗎？`)) {
                                        const deleteStage = async () => {
                                          try {
                                            const firmCode = getFirmCodeOrThrow();
                                            const response = await apiFetch(`/api/cases/${selectedCase.id}/stages/${stageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
                                              method: 'DELETE'
                                            });

                                            if (!response.ok) {
                                              const errorData = await response.json();
                                              throw new Error(errorData.detail || '刪除階段失敗');
                                            }

                                            // 成功後更新本地狀態
                                            setCases(prev => prev.map(c =>
                                              c.id === selectedCase.id
                                                ? {
                                                    ...c,
                                                    stages: c.stages.filter((_, index) => index !== stageIndex)
                                                  }
                                                : c
                                            ));
                                          } catch (error) {
                                            console.error('刪除階段失敗:', error);
                                            setDialogConfig({
                                              title: '刪除階段失敗',
                                              message: error.message || '刪除階段失敗',
                                              type: 'error'
                                            });
                                            setShowUnifiedDialog(true);
                                          }
                                        };
                                        deleteStage();
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all p-1 rounded"
                                    title="刪除階段"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 對話框們 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => {
          setShowCaseForm(false);
          setEditingCase(null);
        }}
        onSave={caseFormMode === 'add' ? handleAddCase : handleEditCase}
        caseData={editingCase}
        mode={caseFormMode}
      />

      <StageEditDialog
        isOpen={showStageDialog}
        mode={stageDialogMode}
        initial={editingStage ? {
          stageName: editingStage.stage.name,
          date: editingStage.stage.date,
          time: editingStage.stage.time,
          note: editingStage.stage.note
        } : undefined}
        onClose={() => {
          setShowStageDialog(false);
          setEditingStage(null);
        }}
        onSave={stageDialogMode === 'add' ? handleAddStage : handleEditStage}
        caseId={selectedCase?.id}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          setShowFileUpload(false);
          // 重新載入案件資料或檔案列表
        }}
        selectedCaseIds={selectedCaseIds}
        cases={cases.map(c => ({
          id: c.id,
          client: c.client,
          caseNumber: c.caseNumber
        }))}
      />

      <ClosedTransferDialog
        isOpen={showClosedTransfer}
        cases={selectedCaseIds.map(id => {
          const caseItem = cases.find(c => c.id === id);
          return {
            id,
            caseNo: caseItem?.caseNumber,
            title: caseItem?.client
          };
        })}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={handleTransferToClosed}
      />

      <UnifiedDialog
        isOpen={showUnifiedDialog}
        onClose={() => setShowUnifiedDialog(false)}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        onConfirm={dialogConfig.onConfirm}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
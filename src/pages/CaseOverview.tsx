import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Upload, Download, Eye, Edit, Trash2,
  FileText, User, Building, Calendar, Clock, ChevronDown, ChevronUp,
  MoreVertical, X, CheckCircle, AlertCircle, Archive
} from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog, { type StageFormData } from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import { parseExcelToCases } from '../utils/importers';
import { FolderManager } from '../utils/folderManager';
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
    court: true,
    division: true
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
      const transformedCases: TableCase[] = (data.items || []).map((apiCase: any) => ({
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
        stages: [] // 階段資料需要另外載入
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
      return false;
    }
  };

  // 編輯階段
  const handleEditStage = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase || !editingStage) return false;

    try {
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
      return false;
    }
  };

  // 切換階段完成狀態
  const toggleStageCompletion = (stageIndex: number) => {
    if (!selectedCase) return;

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
  };

  // Excel 匯入
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const importedCases = await parseExcelToCases(file);

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
        message: error.message || 'Excel 檔案格式錯誤',
        type: 'error'
      });
      setShowUnifiedDialog(true);
    } finally {
      setLoading(false);
      // 清除檔案選擇
      event.target.value = '';
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

  // 取得狀態顏色
  const getStatusColor = (status: CaseStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
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

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* 左側：標題和基本操作 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setCaseFormMode('add');
                  setEditingCase(null);
                  setShowCaseForm(true);
                }}
                className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <label className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>匯入Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 右側：搜尋和過濾 */}
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

        {/* 批量操作工具列 */}
        {selectedCaseIds.length > 0 && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm text-blue-800">
                已選擇 {selectedCaseIds.length} 筆案件
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFileUpload(true)}
                  className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>上傳檔案</span>
                </button>
                <button
                  onClick={() => setShowClosedTransfer(true)}
                  className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700 flex items-center space-x-1"
                >
                  <Archive className="w-3 h-3" />
                  <span>轉移結案</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>批量刪除</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 過濾器 */}
        {showFilters && (
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-700">狀態篩選：</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">全部</option>
              <option value="active">進行中</option>
              <option value="pending">待處理</option>
              <option value="urgent">緊急</option>
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

      {/* 提醒小工具 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
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
                    <th className="px-6 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.length === filteredCases.length && filteredCases.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCases.map((caseItem, index) => (
                    <React.Fragment key={caseItem.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedCase?.id === caseItem.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                        } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        onClick={() => setSelectedCase(caseItem)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.includes(caseItem.id)}
                            onChange={(e) => handleCaseSelect(caseItem.id, e.target.checked)}
                            className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                          />
                        </td>
                        {visibleColumns.caseNumber && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.caseNumber}
                          </td>
                        )}
                        {visibleColumns.client && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.client}
                          </td>
                        )}
                        {visibleColumns.caseType && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(caseItem.status)}`}>
                              {caseItem.caseType}
                            </span>
                          </td>
                        )}
                        {visibleColumns.lawyer && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.lawyer}
                          </td>
                        )}
                        {visibleColumns.legalAffairs && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.legalAffairs}
                          </td>
                        )}
                        {visibleColumns.progress && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {caseItem.progress}
                          </td>
                        )}
                        {visibleColumns.progressDate && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {caseItem.progressDate}
                          </td>
                        )}
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedCase(caseItem)}
                              className="text-gray-400 hover:text-[#334d6d] transition-colors"
                              title="檢視"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setCaseFormMode('edit');
                                setEditingCase(caseItem);
                                setShowCaseForm(true);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="編輯"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCase(caseItem.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展開的詳細資訊 */}
                      {expandedCaseId === caseItem.id && (
                        <tr>
                          <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* 案件詳細資訊 */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">案由：</span>
                                  <span className="text-gray-900">{caseItem.caseReason || '未設定'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">對造：</span>
                                  <span className="text-gray-900">{caseItem.opposingParty || '未設定'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">負責法院：</span>
                                  <span className="text-gray-900">{caseItem.court || '未設定'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">負責股別：</span>
                                  <span className="text-gray-900">{caseItem.division || '未設定'}</span>
                                </div>
                              </div>

                              {/* 階段管理 */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-gray-900">案件階段</h4>
                                  <button
                                    onClick={() => {
                                      setStageDialogMode('add');
                                      setEditingStage(null);
                                      setShowStageDialog(true);
                                    }}
                                    className="bg-[#27ae60] text-white px-3 py-1 rounded text-sm hover:bg-[#229954] flex items-center space-x-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>新增階段</span>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {caseItem.stages.length === 0 ? (
                                    <div className="text-sm text-gray-500 text-center py-4">
                                      尚未新增任何階段
                                    </div>
                                  ) : (
                                    caseItem.stages.map((stage, stageIndex) => (
                                      <div
                                        key={stageIndex}
                                        className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                                      >
                                        <div className="flex items-center space-x-3">
                                          <button
                                            onClick={() => toggleStageCompletion(stageIndex)}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                              stage.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-300 hover:border-green-500'
                                            }`}
                                          >
                                            {stage.completed && <CheckCircle className="w-3 h-3" />}
                                          </button>
                                          <div>
                                            <div className={`text-sm font-medium ${stage.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                              {stage.name}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center space-x-2">
                                              <span className="flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {stage.date}
                                              </span>
                                              {stage.time && (
                                                <span className="flex items-center">
                                                  <Clock className="w-3 h-3 mr-1" />
                                                  {stage.time}
                                                </span>
                                              )}
                                            </div>
                                            {stage.note && (
                                              <div className="text-xs text-gray-600 mt-1">
                                                備註：{stage.note}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setStageDialogMode('edit');
                                            setEditingStage({ index: stageIndex, stage });
                                            setShowStageDialog(true);
                                          }}
                                          className="text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* 資料夾樹 */}
                              <FolderTree
                                caseId={caseItem.id}
                                clientName={caseItem.client}
                                isExpanded={expandedCaseId === caseItem.id}
                                onToggle={() => setExpandedCaseId(expandedCaseId === caseItem.id ? null : caseItem.id)}
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
          )}
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
                  <button
                    onClick={() => {
                      setCaseFormMode('edit');
                      setEditingCase(selectedCase);
                      setShowCaseForm(true);
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
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

              {/* 案件進度 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={() => {
                      setStageDialogMode('add');
                      setEditingStage(null);
                      setShowStageDialog(true);
                    }}
                    className="bg-[#27ae60] text-white px-2 py-1 rounded text-xs hover:bg-[#229954] flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedCase.stages.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      尚未新增任何階段
                    </div>
                  ) : (
                    selectedCase.stages.map((stage, stageIndex) => (
                      <div
                        key={stageIndex}
                        className="flex items-center justify-between p-2 border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleStageCompletion(stageIndex)}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              stage.completed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500'
                            }`}
                          >
                            {stage.completed && <CheckCircle className="w-2 h-2" />}
                          </button>
                          <div>
                            <div className={`text-xs font-medium ${stage.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {stage.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {stage.date} {stage.time && `${stage.time}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setStageDialogMode('edit');
                            setEditingStage({ index: stageIndex, stage });
                            setShowStageDialog(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      </div>
                    ))
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
    </div>
  );
}
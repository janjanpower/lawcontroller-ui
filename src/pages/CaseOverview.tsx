import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Upload, Download, Eye, Edit, Trash2, X, ChevronDown, ChevronUp, Calendar, Clock, User, Building, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage } from '../utils/caseStage';
import type { TableCase, Stage, VisibleColumns } from '../types';

export default function CaseOverview() {
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);

  // 表單狀態
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<TableCase | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);

  // 資料夾展開狀態
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

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

  // 統一對話框狀態
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    onConfirm: () => {},
  });

  // 載入案件列表
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/cases?status=open');
      const data = await response.json();
      
      if (response.ok) {
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
          status: 'active',
          stages: []
        }));
        setCases(transformedCases);
      } else {
        console.error('載入案件失敗:', data.detail);
      }
    } catch (error) {
      console.error('載入案件錯誤:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadCases();
  }, [loadCases]);

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

  // 案件表單處理
  const handleCaseFormSave = async (caseData: any): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        const newCase: TableCase = {
          id: caseData.case_id,
          caseNumber: caseData.case_number || '',
          client: caseData.client || '',
          caseType: caseData.case_type || '',
          lawyer: caseData.lawyer || '',
          legalAffairs: caseData.legal_affairs || '',
          caseReason: caseData.case_reason || '',
          opposingParty: caseData.opposing_party || '',
          court: caseData.court || '',
          division: caseData.division || '',
          progress: caseData.progress || '委任',
          progressDate: caseData.progress_date || '',
          status: 'active',
          stages: []
        };

        setCases(prev => [newCase, ...prev]);
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
          progressDate: newCase.progressDate
        });

        setDialogConfig({
          title: '新增成功',
          message: `案件「${newCase.client}」已成功新增`,
          type: 'success',
          onConfirm: () => {}
        });
        setShowUnifiedDialog(true);
      } else {
        setCases(prev => prev.map(c => 
          c.id === caseData.case_id ? {
            ...c,
            caseType: caseData.case_type || c.caseType,
            client: caseData.client || c.client,
            lawyer: caseData.lawyer || c.lawyer,
            legalAffairs: caseData.legal_affairs || c.legalAffairs,
            caseReason: caseData.case_reason || c.caseReason,
            caseNumber: caseData.case_number || c.caseNumber,
            opposingParty: caseData.opposing_party || c.opposingParty,
            court: caseData.court || c.court,
            division: caseData.division || c.division,
            progress: caseData.progress || c.progress,
            progressDate: caseData.progress_date || c.progressDate
          } : c
        ));

        if (selectedCase && selectedCase.id === caseData.case_id) {
          setSelectedCase(prev => prev ? {
            ...prev,
            caseType: caseData.case_type || prev.caseType,
            client: caseData.client || prev.client,
            lawyer: caseData.lawyer || prev.lawyer,
            legalAffairs: caseData.legal_affairs || prev.legalAffairs,
            caseReason: caseData.case_reason || prev.caseReason,
            caseNumber: caseData.case_number || prev.caseNumber,
            opposingParty: caseData.opposing_party || prev.opposingParty,
            court: caseData.court || prev.court,
            division: caseData.division || prev.division,
            progress: caseData.progress || prev.progress,
            progressDate: caseData.progress_date || prev.progressDate
          } : null);
        }

        setDialogConfig({
          title: '更新成功',
          message: `案件「${caseData.client}」已成功更新`,
          type: 'success',
          onConfirm: () => {}
        });
        setShowUnifiedDialog(true);
      }
      return true;
    } catch (error) {
      console.error('案件表單儲存失敗:', error);
      return false;
    }
  };

  // 階段管理
  const handleStageFormSave = async (stageData: any): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const response = await apiFetch(`/api/cases/${selectedCase.id}/stages`, {
        method: 'POST',
        body: JSON.stringify({
          stage_name: stageData.stageName,
          stage_date: stageData.date,
          stage_time: stageData.time,
          note: stageData.note,
          is_completed: false,
          sort_order: selectedCase.stages.length
        }),
      });

      if (response.ok) {
        const newStage: Stage = {
          name: stageData.stageName,
          date: stageData.date,
          time: stageData.time,
          note: stageData.note,
          completed: false
        };

        const updatedCase = {
          ...selectedCase,
          stages: [...selectedCase.stages, newStage]
        };

        setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
        setSelectedCase(updatedCase);
        FolderManager.createStageFolder(selectedCase.id, stageData.stageName);

        setDialogConfig({
          title: '階段新增成功',
          message: `階段「${stageData.stageName}」已新增到案件中`,
          type: 'success',
          onConfirm: () => {}
        });
        setShowUnifiedDialog(true);
        return true;
      }
    } catch (error) {
      console.error('新增階段失敗:', error);
    }
    return false;
  };

  // 匯入資料處理
  const handleImportComplete = async (importedCases: any[]) => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const importCase of importedCases) {
        try {
          const firmCode = getFirmCodeOrThrow();
          const caseDataForAPI = {
            firm_code: firmCode,
            case_type: importCase.case_type || '未分類',
            client_name: importCase.client || '未知客戶',
            case_reason: importCase.case_reason || null,
            case_number: importCase.case_number || null,
            court: importCase.court || null,
            division: importCase.division || null,
            lawyer_name: importCase.lawyer || null,
            legal_affairs_name: importCase.legal_affairs || null
          };

          const response = await apiFetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'POST',
            body: JSON.stringify(caseDataForAPI),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error('匯入案件失敗:', await response.text());
          }
        } catch (error) {
          errorCount++;
          console.error('匯入案件錯誤:', error);
        }
      }

      await loadCases();

      setDialogConfig({
        title: '匯入完成',
        message: `成功匯入 ${successCount} 筆案件${errorCount > 0 ? `，${errorCount} 筆失敗` : ''}`,
        type: successCount > 0 ? 'success' : 'warning',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    } catch (error) {
      console.error('匯入處理失敗:', error);
      setDialogConfig({
        title: '匯入失敗',
        message: '匯入過程中發生錯誤，請稍後再試',
        type: 'error',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    }
  };

  // 結案轉移處理
  const handleClosedTransfer = async () => {
    try {
      const casesToTransfer = selectedCaseIds.map(id => cases.find(c => c.id === id)).filter(Boolean);
      
      for (const caseItem of casesToTransfer) {
        if (caseItem) {
          const response = await apiFetch(`/api/cases/${caseItem.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              is_closed: true,
              closed_at: new Date().toISOString().split('T')[0]
            }),
          });

          if (!response.ok) {
            console.error('轉移案件失敗:', await response.text());
          }
        }
      }

      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      setSelectedCase(null);

      setDialogConfig({
        title: '轉移完成',
        message: `已將 ${casesToTransfer.length} 筆案件轉移至結案案件`,
        type: 'success',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    } catch (error) {
      console.error('結案轉移失敗:', error);
      setDialogConfig({
        title: '轉移失敗',
        message: '轉移過程中發生錯誤，請稍後再試',
        type: 'error',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    }
  };

  // 刪除案件
  const handleDeleteCase = async (caseId: string) => {
    try {
      const response = await apiFetch(`/api/cases/${caseId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCases(prev => prev.filter(c => c.id !== caseId));
        if (selectedCase?.id === caseId) {
          setSelectedCase(null);
        }
        setSelectedCaseIds(prev => prev.filter(id => id !== caseId));

        setDialogConfig({
          title: '刪除成功',
          message: '案件已成功刪除',
          type: 'success',
          onConfirm: () => {}
        });
        setShowUnifiedDialog(true);
      }
    } catch (error) {
      console.error('刪除案件失敗:', error);
      setDialogConfig({
        title: '刪除失敗',
        message: '刪除案件時發生錯誤',
        type: 'error',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    }
  };

  // 獲取階段狀態樣式
  const getStageStatusClass = (stage: Stage, index: number, stages: Stage[]) => {
    if (stage.completed) return 'completed';
    
    // 檢查是否逾期
    if (stage.date) {
      const stageDate = new Date(stage.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      stageDate.setHours(0, 0, 0, 0);
      
      if (stageDate < today) return 'overdue';
      if (stageDate.getTime() === today.getTime()) return 'in-progress';
    }
    
    // 檢查前一個階段是否完成
    if (index > 0 && !stages[index - 1].completed) return 'pending';
    
    return 'in-progress';
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* 第一行：標題和主要操作 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>
              {selectedCaseIds.length > 0 && (
                <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  已選擇 {selectedCaseIds.length} 筆
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setCaseFormMode('add');
                  setEditingCase(null);
                  setShowCaseForm(true);
                }}
                className="bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">匯入Excel</span>
                <span className="sm:hidden">匯入</span>
              </button>

              {selectedCaseIds.length > 0 && (
                <>
                  <button
                    onClick={() => setShowFileUpload(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">上傳檔案</span>
                    <span className="sm:hidden">上傳</span>
                  </button>

                  <button
                    onClick={() => setShowClosedTransfer(true)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">轉為結案</span>
                    <span className="sm:hidden">結案</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 第二行：搜尋和過濾 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋案件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* 搜尋結果統計 */}
          {searchTerm && (
            <div className="text-sm text-green-600">
              找到 {filteredCases.length}/{cases.length} 個案件
            </div>
          )}
        </div>

        {/* 日期提醒小工具 */}
        <div className="mt-4">
          <DateReminderWidget
            caseData={cases.map(c => ({
              case_id: c.id,
              client: c.client,
              case_type: c.caseType,
              progress_stages: c.stages.reduce((acc, stage, idx) => {
                acc[stage.name] = stage.date;
                return acc;
              }, {} as Record<string, string>),
              progress_times: c.stages.reduce((acc, stage, idx) => {
                if (stage.time) acc[stage.name] = stage.time;
                return acc;
              }, {} as Record<string, string>),
              progress_notes: c.stages.reduce((acc, stage, idx) => {
                if (stage.note) acc[stage.name] = stage.note;
                return acc;
              }, {} as Record<string, string>)
            }))}
            onCaseSelect={(caseData) => {
              const foundCase = cases.find(c => c.id === caseData.case_id);
              if (foundCase) setSelectedCase(foundCase);
            }}
          />
        </div>
      </div>

      {/* 案件列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 案件列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCase ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            {/* 桌面版表格 */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.length === filteredCases.length && filteredCases.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCaseIds(filteredCases.map(c => c.id));
                          } else {
                            setSelectedCaseIds([]);
                          }
                        }}
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
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(row.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCaseIds(prev => [...prev, row.id]);
                            } else {
                              setSelectedCaseIds(prev => prev.filter(id => id !== row.id));
                            }
                          }}
                          className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                        />
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
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="stage-tag small default">
                            {row.progress}
                          </span>
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
                            onClick={() => setSelectedCase(row)}
                            className="text-gray-400 hover:text-[#334d6d] transition-colors"
                            title="檢視"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setCaseFormMode('edit');
                              setEditingCase(row);
                              setShowCaseForm(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`確定要刪除案件「${row.client}」嗎？`)) {
                                handleDeleteCase(row.id);
                              }
                            }}
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

            {/* 手機版卡片列表 */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredCases.map((row) => (
                <div
                  key={row.id}
                  className={`bg-white rounded-lg border shadow-sm transition-all duration-200 ${
                    selectedCase?.id === row.id ? 'border-[#334d6d] bg-blue-50 shadow-md' : 'border-gray-200 hover:shadow-md'
                  }`}
                >
                  {/* 卡片頭部 */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setSelectedCase(row)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.includes(row.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedCaseIds(prev => [...prev, row.id]);
                              } else {
                                setSelectedCaseIds(prev => prev.filter(id => id !== row.id));
                              }
                            }}
                            className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                          />
                          <h3 className="font-semibold text-gray-900 text-base">{row.client}</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">案件類型</span>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {row.caseType}
                            </span>
                          </div>
                          
                          {row.caseNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">案號</span>
                              <span className="text-sm text-gray-900 font-mono">{row.caseNumber}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">進度</span>
                            <span className="stage-tag small default">
                              {row.progress}
                            </span>
                          </div>
                          
                          {row.progressDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">進度日期</span>
                              <span className="text-sm text-gray-500">{row.progressDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 律師和法務資訊 */}
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div className="bg-gray-50 rounded-md p-2">
                        <div className="text-xs text-gray-500 mb-1">律師</div>
                        <div className="text-gray-900 font-medium">{row.lawyer || '未指派'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-md p-2">
                        <div className="text-xs text-gray-500 mb-1">法務</div>
                        <div className="text-gray-900 font-medium">{row.legalAffairs || '未指派'}</div>
                      </div>
                    </div>

                    {/* 案件詳細資訊 */}
                    {(row.caseReason || row.court || row.division) && (
                      <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                        {row.caseReason && (
                          <div>
                            <span className="text-gray-600">案由：</span>
                            <span className="text-gray-900">{row.caseReason}</span>
                          </div>
                        )}
                        {row.court && (
                          <div>
                            <span className="text-gray-600">法院：</span>
                            <span className="text-gray-900">{row.court}</span>
                          </div>
                        )}
                        {row.division && (
                          <div>
                            <span className="text-gray-600">股別：</span>
                            <span className="text-gray-900">{row.division}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCase(row);
                      }}
                      className="px-3 py-1.5 text-xs text-[#334d6d] hover:text-[#3f5a7d] hover:bg-white rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>檢視</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCaseFormMode('edit');
                        setEditingCase(row);
                        setShowCaseForm(true);
                      }}
                      className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-white rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>編輯</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`確定要刪除案件「${row.client}」嗎？`)) {
                          handleDeleteCase(row.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-red-600 hover:text-red-800 hover:bg-white rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>刪除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右側詳情面板 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-4 lg:p-6">
              {/* 標題和關閉按鈕 */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="關閉詳情"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 基本資訊 */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">當事人</label>
                    <p className="text-base font-semibold text-gray-900 mt-1">{selectedCase.client}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">案件類型</label>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mt-1">
                        {selectedCase.caseType}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">案號</label>
                      <p className="text-sm text-gray-900 mt-1 font-mono">{selectedCase.caseNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">律師</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer || '未指派'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">法務</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs || '未指派'}</p>
                    </div>
                  </div>

                  {(selectedCase.caseReason || selectedCase.opposingParty) && (
                    <div className="grid grid-cols-1 gap-4">
                      {selectedCase.caseReason && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">案由</label>
                          <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason}</p>
                        </div>
                      )}
                      {selectedCase.opposingParty && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">對造</label>
                          <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedCase.court || selectedCase.division) && (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedCase.court && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">法院</label>
                          <p className="text-sm text-gray-900 mt-1">{selectedCase.court}</p>
                        </div>
                      )}
                      {selectedCase.division && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">股別</label>
                          <p className="text-sm text-gray-900 mt-1">{selectedCase.division}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <hr className="my-6" />

              {/* 案件進度 - 優化排版 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-gray-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-[#334d6d]" />
                    案件進度
                  </h4>
                  <button
                    onClick={() => {
                      setStageDialogMode('add');
                      setEditingStageIndex(-1);
                      setShowStageDialog(true);
                    }}
                    className="bg-[#27ae60] text-white px-3 py-1.5 rounded-md hover:bg-[#229954] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>

                {selectedCase.stages.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCase.stages.map((stage, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className={`stage-tag small ${getStageStatusClass(stage, index, selectedCase.stages)}`}>
                                {stage.name}
                              </span>
                              {stage.completed && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="w-3 h-3 mr-1" />
                                <span>{stage.date}</span>
                                {stage.time && (
                                  <>
                                    <Clock className="w-3 h-3 ml-3 mr-1" />
                                    <span>{stage.time}</span>
                                  </>
                                )}
                              </div>
                              
                              {stage.note && (
                                <div className="text-gray-700 bg-white rounded-md p-2 mt-2 border border-gray-100">
                                  <span className="text-xs text-gray-500">備註：</span>
                                  <span className="ml-1">{stage.note}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-1 ml-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStageDialogMode('edit');
                                setEditingStageIndex(index);
                                setShowStageDialog(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                              title="編輯階段"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`確定要刪除階段「${stage.name}」嗎？`)) {
                                  const updatedStages = selectedCase.stages.filter((_, i) => i !== index);
                                  const updatedCase = { ...selectedCase, stages: updatedStages };
                                  setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
                                  setSelectedCase(updatedCase);
                                  FolderManager.removeStageFolderNode(selectedCase.id, stage.name);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                              title="刪除階段"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">尚未建立任何進度階段</p>
                    <p className="text-xs text-gray-400 mt-1">點擊上方「新增階段」開始記錄進度</p>
                  </div>
                )}
              </div>

              <hr className="my-6" />

              {/* 案件資料夾 */}
              <div>
                <FolderTree
                  caseId={selectedCase.id}
                  clientName={selectedCase.client}
                  isExpanded={expandedFolders[selectedCase.id] || false}
                  onToggle={() => {
                    setExpandedFolders(prev => ({
                      ...prev,
                      [selectedCase.id]: !prev[selectedCase.id]
                    }));
                  }}
                  onFileUpload={() => {}}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 對話框組件 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleCaseFormSave}
        caseData={editingCase}
        mode={caseFormMode}
      />

      <StageEditDialog
        isOpen={showStageDialog}
        mode={stageDialogMode}
        initial={
          stageDialogMode === 'edit' && editingStageIndex >= 0 && selectedCase
            ? {
                stageName: selectedCase.stages[editingStageIndex]?.name || '',
                date: selectedCase.stages[editingStageIndex]?.date || '',
                time: selectedCase.stages[editingStageIndex]?.time || '',
                note: selectedCase.stages[editingStageIndex]?.note || ''
              }
            : undefined
        }
        onClose={() => setShowStageDialog(false)}
        onSave={handleStageFormSave}
        caseId={selectedCase?.id}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          setShowFileUpload(false);
          if (selectedCase) {
            setExpandedFolders(prev => ({ ...prev, [selectedCase.id]: true }));
          }
        }}
        selectedCaseIds={selectedCaseIds}
        cases={cases}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <ClosedTransferDialog
        isOpen={showClosedTransfer}
        cases={selectedCaseIds.map(id => {
          const c = cases.find(x => x.id === id);
          return { id, caseNo: c?.caseNumber, title: c?.client };
        })}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={handleClosedTransfer}
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
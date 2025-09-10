import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Upload, Download, Eye, Edit, Trash2,
  FileText, User, Building, Calendar, Clock, ChevronDown, ChevronRight,
  X, AlertCircle, CheckCircle, Folder
} from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { analyzeExcelFile } from '../utils/smartExcelAnalyzer';
import { hasClosedStage } from '../utils/caseStage';
import { FolderManager } from '../utils/folderManager';
import type { TableCase, Stage, FormCaseData, VisibleColumns } from '../types';

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

export default function CaseOverview() {
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showClosedTransferDialog, setShowClosedTransferDialog] = useState(false);

  // 表單狀態
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);
  const [dialogMessage, setDialogMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});

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

  // 資料夾樹狀態
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 載入案件列表
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/cases?status=open');
      const data = await response.json();

      if (response.ok) {
        // 轉換後端資料為前端格式
        const transformedCases: TableCase[] = (data.items || []).map((item: any) => ({
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
          stages: [] // 可以後續從 API 載入
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

  // 搜尋和過濾功能
  useEffect(() => {
    let filtered = cases;

    // 狀態過濾
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // 類型過濾
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.caseType === typeFilter);
    }

    // 搜尋過濾
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
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
    }

    setFilteredCases(filtered);
  }, [searchTerm, cases, statusFilter, typeFilter]);

  // 載入案件階段
  const loadCaseStages = useCallback(async (caseId: string) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(`/api/cases/${caseId}/stages?firm_code=${encodeURIComponent(firmCode)}`);

      if (response.ok) {
        const stages = await response.json();
        console.log('載入的階段資料:', stages);

        // 轉換階段資料格式
        const transformedStages: Stage[] = stages.map((stage: any) => ({
          name: stage.stage_name || stage.name,
          date: stage.stage_date || stage.date || '',
          time: stage.stage_time || stage.time || '',
          note: stage.note || '',
          completed: stage.is_completed || stage.completed || false
        }));

        // 更新案件的階段資料
        setCases(prev => prev.map(c =>
          c.id === caseId ? { ...c, stages: transformedStages } : c
        ));

        // 如果當前選中的案件是這個案件，也更新選中案件的階段
        setSelectedCase(prev =>
          prev && prev.id === caseId ? { ...prev, stages: transformedStages } : prev
        );

        return transformedStages;
      } else {
        console.error('載入階段失敗:', await response.text());
        return [];
      }
    } catch (error) {
      console.error('載入階段錯誤:', error);
      return [];
    }
  }, []);

  // 選擇案件時載入階段
  const handleCaseSelect = useCallback(async (caseItem: TableCase) => {
    setSelectedCase(caseItem);

    // 載入階段資料
    await loadCaseStages(caseItem.id);
  }, [loadCaseStages]);

  // 新增/編輯案件
  const handleAddCase = () => {
    setCaseFormMode('add');
    setEditingCase(null);
    setShowCaseForm(true);
  };

  const handleEditCase = (caseItem: TableCase) => {
    setCaseFormMode('edit');
    setEditingCase({
      case_id: caseItem.id,
      case_type: caseItem.caseType,
      client: caseItem.client,
      lawyer: caseItem.lawyer,
      legal_affairs: caseItem.legalAffairs,
      case_reason: caseItem.caseReason,
      case_number: caseItem.caseNumber,
      opposing_party: caseItem.opposingParty,
      court: caseItem.court,
      division: caseItem.division,
      progress: caseItem.progress,
      progress_date: caseItem.progressDate,
    });
    setShowCaseForm(true);
  };

  const handleCaseSave = async (caseData: FormCaseData): Promise<boolean> => {
    try {
      console.log('DEBUG: handleCaseSave 收到資料:', caseData);

      if (caseFormMode === 'add') {
        // 新增案件
        const newCase: TableCase = {
          id: caseData.case_id || '',
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
          progressDate: caseData.progress_date || new Date().toISOString().split('T')[0],
          status: 'active',
          stages: []
        };

        console.log('DEBUG: 新增案件到列表:', newCase);
        setCases(prev => [newCase, ...prev]);

        // 建立預設資料夾
        if (newCase.id) {
          FolderManager.createDefaultFolders(newCase.id);
          console.log(`已為新案件 ${newCase.id} 建立預設資料夾`);
        }

        console.log('DEBUG: 案件新增成功');
        return true;
      } else {
        // 編輯案件
        console.log('DEBUG: 編輯案件模式');
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
            progressDate: caseData.progress_date || c.progressDate,
          } : c
        ));

        // 如果編輯的是當前選中的案件，也更新選中案件
        if (selectedCase && selectedCase.id === caseData.case_id) {
          setSelectedCase(prev => prev ? {
            ...prev,
            caseNumber: caseData.case_number || prev.caseNumber,
            client: caseData.client || prev.client,
            caseType: caseData.case_type || prev.caseType,
            lawyer: caseData.lawyer || prev.lawyer,
            legalAffairs: caseData.legal_affairs || prev.legalAffairs,
            caseReason: caseData.case_reason || prev.caseReason,
            opposingParty: caseData.opposing_party || prev.opposingParty,
            court: caseData.court || prev.court,
            division: caseData.division || prev.division,
            progress: caseData.progress || prev.progress,
            progressDate: caseData.progress_date || prev.progressDate,
          } : null);
        }

        console.log('DEBUG: 案件編輯成功');
        return true;
      }
    } catch (error) {
      console.error('DEBUG: handleCaseSave 失敗:', error);
      return false;
    }
  };

  // 刪除案件
  const handleDeleteCase = (caseItem: TableCase) => {
    setDialogMessage(
      `確定要刪除案件「${caseItem.client} - ${caseItem.caseNumber}」嗎？\n\n` +
      `此操作將會：\n` +
      `• 刪除案件基本資料\n` +
      `• 刪除所有進度階段\n` +
      `• 刪除所有相關檔案\n` +
      `• 此操作無法復原`
    );
    setPendingAction(() => async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(`/api/cases/${caseItem.id}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setCases(prev => prev.filter(c => c.id !== caseItem.id));
          setSelectedCases(prev => {
            const newSet = new Set(prev);
            newSet.delete(caseItem.id);
            return newSet;
          });
          if (selectedCase?.id === caseItem.id) {
            setSelectedCase(null);
          }
          alert('案件刪除成功');
        } else {
          const errorData = await response.json();
          alert(`刪除失敗: ${errorData.detail || '未知錯誤'}`);
        }
      } catch (error) {
        console.error('刪除案件錯誤:', error);
        alert('刪除案件時發生錯誤');
      }
    });
    setShowConfirmDialog(true);
  };

  // 階段管理
  const handleAddStage = () => {
    setStageDialogMode('add');
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  const handleEditStage = (index: number) => {
    setStageDialogMode('edit');
    setEditingStageIndex(index);
    setShowStageDialog(true);
  };

  const handleStageSave = async (stageData: { stageName: string; date: string; time?: string; note?: string }): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const firmCode = getFirmCodeOrThrow();

      if (stageDialogMode === 'add') {
        // 新增階段
        const response = await apiFetch(`/api/cases/${selectedCase.id}/stages?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST',
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time || null,
            note: stageData.note || null,
            is_completed: false,
            sort_order: selectedCase.stages.length
          }),
        });

        if (response.ok) {
          // 重新載入階段資料
          await loadCaseStages(selectedCase.id);

          // 建立階段資料夾
          FolderManager.createStageFolder(selectedCase.id, stageData.stageName);

          // 刷新資料夾樹
          FolderManager.refreshFolderTree(selectedCase.id);

          console.log(`已為案件 ${selectedCase.id} 新增階段: ${stageData.stageName}`);
          return true;
        } else {
          const errorData = await response.json();
          alert(`新增階段失敗: ${errorData.detail || '未知錯誤'}`);
          return false;
        }
      } else {
        // 編輯階段
        const response = await apiFetch(`/api/cases/${selectedCase.id}/stages/${editingStageIndex}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            stage_name: stageData.stageName,
            stage_date: stageData.date,
            stage_time: stageData.time || null,
            note: stageData.note || null,
          }),
        });

        if (response.ok) {
          // 重新載入階段資料
          await loadCaseStages(selectedCase.id);
          return true;
        } else {
          const errorData = await response.json();
          alert(`編輯階段失敗: ${errorData.detail || '未知錯誤'}`);
          return false;
        }
      }
    } catch (error) {
      console.error('階段操作錯誤:', error);
      alert('階段操作時發生錯誤');
      return false;
    }
  };

  const handleDeleteStage = async (index: number) => {
    if (!selectedCase || index < 0 || index >= selectedCase.stages.length) return;

    const stage = selectedCase.stages[index];
    const hasFiles = await FolderManager.hasFilesInStageFolder(selectedCase.id, stage.name);

    let confirmMessage = `確定要刪除階段「${stage.name}」嗎？`;
    if (hasFiles) {
      confirmMessage += '\n\n⚠️ 此階段資料夾內有檔案，刪除後檔案也會一併移除。';
    }

    if (confirm(confirmMessage)) {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(`/api/cases/${selectedCase.id}/stages/${index}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          // 如果有檔案，先刪除階段資料夾
          if (hasFiles) {
            await FolderManager.deleteStageFolder(selectedCase.id, stage.name);
          }

          // 從前端樹移除階段資料夾節點
          FolderManager.removeStageFolderNode(selectedCase.id, stage.name);

          // 重新載入階段資料
          await loadCaseStages(selectedCase.id);

          console.log(`已刪除階段: ${stage.name}`);
        } else {
          const errorData = await response.json();
          alert(`刪除階段失敗: ${errorData.detail || '未知錯誤'}`);
        }
      } catch (error) {
        console.error('刪除階段錯誤:', error);
        alert('刪除階段時發生錯誤');
      }
    }
  };

  // 匯入資料
  const handleImportComplete = async (importedCases: any[]) => {
    console.log('開始匯入案件:', importedCases);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const importCase of importedCases) {
      try {
        // 轉換匯入資料為 API 格式
        const caseDataForAPI = {
          firm_code: getFirmCodeOrThrow(),
          case_type: importCase.case_type || '未分類',
          client_name: importCase.client || '未知客戶',
          case_reason: importCase.case_reason || null,
          case_number: importCase.case_number || null,
          court: importCase.court || null,
          division: importCase.division || null,
          lawyer_name: importCase.lawyer || null,
          legal_affairs_name: importCase.legal_affairs || null
        };

        const response = await apiFetch('/api/cases', {
          method: 'POST',
          body: JSON.stringify(caseDataForAPI),
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
          const errorData = await response.json();
          errors.push(`${importCase.client || '未知'}: ${errorData.detail || '未知錯誤'}`);
        }
      } catch (error) {
        failCount++;
        errors.push(`${importCase.client || '未知'}: ${error.message || '網路錯誤'}`);
      }
    }

    // 重新載入案件列表
    await loadCases();

    // 顯示匯入結果
    let message = `匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`;
    if (errors.length > 0) {
      message += `\n\n錯誤詳情:\n${errors.slice(0, 5).join('\n')}`;
      if (errors.length > 5) {
        message += `\n... 還有 ${errors.length - 5} 個錯誤`;
      }
    }
    alert(message);
  };

  // 批量操作
  const handleSelectAll = () => {
    if (selectedCases.size === filteredCases.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(filteredCases.map(c => c.id)));
    }
  };

  const handleCaseCheck = (caseId: string, checked: boolean) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(caseId);
      } else {
        newSet.delete(caseId);
      }
      return newSet;
    });
  };

  const handleBatchDelete = () => {
    if (selectedCases.size === 0) {
      alert('請先選擇要刪除的案件');
      return;
    }

    const selectedCaseItems = cases.filter(c => selectedCases.has(c.id));
    setDialogMessage(
      `確定要刪除 ${selectedCases.size} 個案件嗎？\n\n` +
      `案件列表：\n${selectedCaseItems.map(c => `• ${c.client} - ${c.caseNumber}`).join('\n')}\n\n` +
      `此操作將會刪除所有相關資料，無法復原。`
    );
    setPendingAction(() => async () => {
      let successCount = 0;
      let failCount = 0;

      for (const caseId of selectedCases) {
        try {
          const firmCode = getFirmCodeOrThrow();
          const response = await apiFetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      // 重新載入案件列表
      await loadCases();
      setSelectedCases(new Set());
      setSelectedCase(null);

      alert(`批量刪除完成\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
    });
    setShowConfirmDialog(true);
  };

  const handleTransferToClosed = () => {
    if (selectedCases.size === 0) {
      alert('請先選擇要轉移的案件');
      return;
    }
    setShowClosedTransferDialog(true);
  };

  const handleClosedTransferConfirm = async () => {
    const selectedCaseItems = cases.filter(c => selectedCases.has(c.id));

    for (const caseItem of selectedCaseItems) {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(`/api/cases/${caseItem.id}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_closed: true,
            closed_at: new Date().toISOString().split('T')[0]
          }),
        });

        if (response.ok) {
          console.log(`案件 ${caseItem.id} 已轉移至結案`);
        }
      } catch (error) {
        console.error(`轉移案件 ${caseItem.id} 失敗:`, error);
      }
    }

    // 重新載入案件列表
    await loadCases();
    setSelectedCases(new Set());
    setSelectedCase(null);
    setShowClosedTransferDialog(false);
    alert('案件已轉移至結案案件');
  };

  // 資料夾樹操作
  const toggleFolderExpansion = (caseId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  // 階段建立後的回調
  const handleStageCreated = () => {
    // 刷新當前選中案件的資料夾樹
    if (selectedCase) {
      FolderManager.refreshFolderTree(selectedCase.id);
      // 可以在這裡觸發資料夾樹的重新渲染
      console.log(`階段建立完成，已刷新案件 ${selectedCase.id} 的資料夾樹`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '進行中';
      case 'pending':
        return '待處理';
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>

            {/* 日期提醒小工具 */}
            <div className="w-full sm:w-80">
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
                  if (foundCase) {
                    handleCaseSelect(foundCase);
                  }
                }}
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
              <option value="行政">行政</option>
              <option value="家事">家事</option>
              <option value="商事">商事</option>
            </select>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={handleAddCase}
            className="bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>新增案件</span>
          </button>
          <button
            onClick={() => setShowFileUpload(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>上傳檔案</span>
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>匯入資料</span>
          </button>

          {/* 批量操作 */}
          {selectedCases.size > 0 && (
            <>
              <button
                onClick={handleBatchDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除選中 ({selectedCases.size})</span>
              </button>
              <button
                onClick={handleTransferToClosed}
                className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>轉移結案 ({selectedCases.size})</span>
              </button>
            </>
          )}
        </div>

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
                  <th className="px-6 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedCases.size === filteredCases.length && filteredCases.length > 0}
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
                    onClick={() => handleCaseSelect(row)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCases.has(row.id)}
                        onChange={(e) => handleCaseCheck(row.id, e.target.checked)}
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
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
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
                          onClick={() => handleCaseSelect(row)}
                          className="text-gray-400 hover:text-[#334d6d] transition-colors"
                          title="檢視"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditCase(row)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCase(row)}
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
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditCase(selectedCase)}
                    className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
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

              {/* 案件進度 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={handleAddStage}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-2 rounded-md bg-gray-50 group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        stage.completed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {stage.completed ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{stage.date}</span>
                            {stage.time && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {stage.time}
                              </span>
                            )}
                          </div>
                        </div>
                        {stage.note && (
                          <p className="text-xs text-gray-600 mt-1">{stage.note}</p>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                        <button
                          onClick={() => handleEditStage(idx)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="編輯階段"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(idx)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="刪除階段"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-6" />

              {/* 資料夾樹 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件資料夾</h4>
                  <button
                    onClick={() => toggleFolderExpansion(selectedCase.id)}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    {expandedFolders.has(selectedCase.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <FolderTree
                  caseId={selectedCase.id}
                  caseNumber={selectedCase.caseNumber}
                  clientName={selectedCase.client}
                  isExpanded={expandedFolders.has(selectedCase.id)}
                  onToggle={() => toggleFolderExpansion(selectedCase.id)}
                  onFileUpload={(folderPath) => {
                    console.log('檔案上傳到資料夾:', folderPath);
                  }}
                  onFolderCreate={(parentPath) => {
                    console.log('在路徑建立資料夾:', parentPath);
                  }}
                  onDelete={(path, type) => {
                    console.log('刪除:', type, path);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 對話框 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => setShowCaseForm(false)}
        onSave={handleCaseSave}
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
                note: selectedCase.stages[editingStageIndex]?.note || '',
              }
            : undefined
        }
        onClose={() => setShowStageDialog(false)}
        onSave={handleStageSave}
        caseId={selectedCase?.id}
        onStageCreated={handleStageCreated}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          console.log('檔案上傳完成');
          // 如果有選中的案件，刷新其資料夾樹
          if (selectedCase) {
            FolderManager.refreshFolderTree(selectedCase.id);
          }
        }}
        selectedCaseIds={Array.from(selectedCases)}
        cases={cases}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <CustomConfirmDialog
        isOpen={showConfirmDialog}
        title="確認操作"
        message={dialogMessage}
        onConfirm={() => {
          setShowConfirmDialog(false);
          pendingAction();
        }}
        onCancel={() => setShowConfirmDialog(false)}
      />

      <ClosedTransferDialog
        isOpen={showClosedTransferDialog}
        cases={Array.from(selectedCases).map(id => {
          const c = cases.find(x => x.id === id);
          return { id, caseNo: c?.caseNumber, title: c?.client };
        })}
        onClose={() => setShowClosedTransferDialog(false)}
        onConfirm={handleClosedTransferConfirm}
      />
    </div>
  );
}
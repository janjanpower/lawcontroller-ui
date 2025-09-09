import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Upload, Download, Eye, Edit, Trash2, X, CheckSquare, Square, Minus } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { hasClosedStage } from '../utils/caseStage';
import { FolderManager } from '../utils/folderManager';
import type { TableCase, Stage, FormCaseData, ReminderCaseData, VisibleColumns } from '../types';

// 自訂確認對話框組件
interface CustomConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
}

const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  showCheckbox = false,
  checkboxLabel = '',
  checkboxChecked = false,
  onCheckboxChange,
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
          {showCheckbox && (
            <div className="mt-4 flex items-center">
              <input
                type="checkbox"
                id="confirm-checkbox"
                checked={checkboxChecked}
                onChange={(e) => onCheckboxChange?.(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="confirm-checkbox" className="text-sm text-gray-700">
                {checkboxLabel}
              </label>
            </div>
          )}
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
            disabled={showCheckbox && !checkboxChecked}
            className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export default function CaseOverview() {
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFolderTree, setShowFolderTree] = useState<Record<string, boolean>>({});
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogTitle, setDialogTitle] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferConfirmChecked, setTransferConfirmChecked] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');

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
      const response = await apiFetch('/api/cases?status=open');
      const data = await response.json();
      
      if (response.ok) {
        const transformedCases = (data.items || []).map((apiCase: any) => ({
          id: apiCase.id,
          caseNumber: apiCase.case_number || '',
          client: apiCase.client_name || apiCase.client?.name || '',
          caseType: apiCase.case_type || '',
          lawyer: apiCase.lawyer_name || apiCase.lawyer?.full_name || '',
          legalAffairs: apiCase.legal_affairs_name || apiCase.legal_affairs?.full_name || '',
          caseReason: apiCase.case_reason || '',
          opposingParty: apiCase.opposing_party || '',
          court: apiCase.court || '',
          division: apiCase.division || '',
          progress: apiCase.progress || '',
          progressDate: apiCase.progress_date || '',
          status: 'active' as const,
          stages: []
        }));
        setCases(transformedCases);
      } else {
        console.error('載入案件失敗:', data.detail);
      }
    } catch (error) {
      console.error('載入案件錯誤:', error);
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
      filtered = filtered.filter(c => c.status === statusFilter);
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
  }, [searchTerm, cases, statusFilter]);

  // 全選/取消全選功能
  const handleSelectAll = () => {
    if (selectedCaseIds.length === filteredCases.length) {
      // 如果已全選，則取消全選
      setSelectedCaseIds([]);
    } else {
      // 否則全選
      setSelectedCaseIds(filteredCases.map(c => c.id));
    }
  };

  // 檢查是否全選
  const isAllSelected = selectedCaseIds.length === filteredCases.length && filteredCases.length > 0;
  const isPartialSelected = selectedCaseIds.length > 0 && selectedCaseIds.length < filteredCases.length;

  // 案件選擇處理
  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseIds(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  // 新增案件
  const handleAddCase = () => {
    setCaseFormMode('add');
    setEditingCase(null);
    setShowCaseForm(true);
  };

  // 編輯案件
  const handleEditCase = (caseData: TableCase) => {
    setCaseFormMode('edit');
    setEditingCase({
      case_id: caseData.id,
      case_type: caseData.caseType,
      client: caseData.client,
      lawyer: caseData.lawyer,
      legal_affairs: caseData.legalAffairs,
      case_reason: caseData.caseReason,
      case_number: caseData.caseNumber,
      opposing_party: caseData.opposingParty,
      court: caseData.court,
      division: caseData.division,
      progress: caseData.progress,
      progress_date: caseData.progressDate
    });
    setShowCaseForm(true);
  };

  // 保存案件
  const handleSaveCase = async (caseData: FormCaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        // 新增案件
        const newCase: TableCase = {
          id: caseData.case_id || `case_${Date.now()}`,
          caseNumber: caseData.case_number || '',
          client: caseData.client,
          caseType: caseData.case_type,
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

        // 建立預設資料夾（只有案件資訊和案件進度）
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

        setCases(prev => [newCase, ...prev]);
        
        setDialogTitle('新增成功');
        setDialogMessage(`案件「${newCase.client} - ${newCase.caseType}」已成功新增！`);
        setShowSuccessDialog(true);
      } else {
        // 編輯案件
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

        // 更新案件資訊 Excel
        if (caseData.case_id) {
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
        }

        setDialogTitle('更新成功');
        setDialogMessage(`案件「${caseData.client} - ${caseData.case_type}」已成功更新！`);
        setShowSuccessDialog(true);
      }
      return true;
    } catch (error) {
      console.error('保存案件失敗:', error);
      return false;
    }
  };

  // 刪除案件
  const handleDeleteCases = () => {
    if (selectedCaseIds.length === 0) return;

    const caseNames = selectedCaseIds.map(id => {
      const caseData = cases.find(c => c.id === id);
      return caseData ? `${caseData.client} - ${caseData.caseType}` : id;
    }).join('\n');

    setDialogTitle('確認刪除');
    setDialogMessage(`確定要刪除以下 ${selectedCaseIds.length} 個案件嗎？\n\n${caseNames}\n\n此操作無法復原。`);
    setConfirmAction(() => () => {
      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      setDialogTitle('刪除成功');
      setDialogMessage(`已成功刪除 ${selectedCaseIds.length} 個案件。`);
      setShowSuccessDialog(true);
    });
    setShowConfirmDialog(true);
  };

  // 轉移到結案案件
  const handleTransferToClosed = () => {
    if (selectedCaseIds.length === 0) return;

    // 檢查選中的案件是否都有"已結案"階段
    const selectedCases = cases.filter(c => selectedCaseIds.includes(c.id));
    const casesWithoutClosedStage = selectedCases.filter(c => !hasClosedStage(c.stages));

    if (casesWithoutClosedStage.length > 0) {
      // 有案件沒有"已結案"階段，需要提醒
      const caseNames = casesWithoutClosedStage.map(c => `${c.client} - ${c.caseType}`).join('\n');
      setTransferMessage(
        `以下案件尚未設定「已結案」階段：\n\n${caseNames}\n\n建議先新增「已結案」階段後再轉移。\n如果確定要轉移，請勾選下方確認選項。`
      );
      setTransferConfirmChecked(false);
      setShowTransferConfirm(true);
    } else {
      // 所有案件都有"已結案"階段，直接轉移
      setShowClosedTransfer(true);
    }
  };

  // 確認轉移（有警告的情況）
  const handleConfirmTransfer = () => {
    setShowTransferConfirm(false);
    setShowClosedTransfer(true);
  };

  // 執行轉移
  const handleTransferConfirm = () => {
    const transferredCases = cases.filter(c => selectedCaseIds.includes(c.id));
    
    // 從案件列表中移除
    setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
    setSelectedCaseIds([]);
    setShowClosedTransfer(false);

    setDialogTitle('轉移成功');
    setDialogMessage(`已成功將 ${transferredCases.length} 個案件轉移到結案案件。`);
    setShowSuccessDialog(true);
  };

  // 新增階段
  const handleAddStage = async (stageData: { stageName: string; date: string; time?: string; note?: string }): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const newStage: Stage = {
        name: stageData.stageName,
        date: stageData.date,
        time: stageData.time,
        note: stageData.note,
        completed: false
      };

      // 更新案件的階段列表
      setCases(prev => prev.map(c => 
        c.id === selectedCase.id 
          ? { ...c, stages: [...c.stages, newStage] }
          : c
      ));

      // 建立階段資料夾
      FolderManager.createStageFolder(selectedCase.id, stageData.stageName);

      setDialogTitle('新增成功');
      setDialogMessage(`階段「${stageData.stageName}」已成功新增！`);
      setShowSuccessDialog(true);

      return true;
    } catch (error) {
      console.error('新增階段失敗:', error);
      return false;
    }
  };

  // 匯入資料處理
  const handleImportComplete = async (importedCases: any[]) => {
    try {
      console.log('開始處理匯入的案件資料:', importedCases);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const importedCase of importedCases) {
        try {
          // 轉換匯入的資料格式
          const caseData: FormCaseData = {
            case_type: importedCase.type || '未知',
            client: importedCase.fields?.當事人 || importedCase.fields?.客戶 || importedCase.fields?.姓名 || '未知客戶',
            case_reason: importedCase.fields?.案由 || importedCase.fields?.事由 || '',
            case_number: importedCase.fields?.案號 || importedCase.fields?.機關 || '',
            court: importedCase.fields?.法院 || importedCase.fields?.負責法院 || '',
            division: importedCase.fields?.股別 || importedCase.fields?.分機 || '',
            lawyer: importedCase.fields?.委任律師 || importedCase.fields?.律師 || '',
            legal_affairs: importedCase.fields?.法務 || importedCase.fields?.承辦人 || '',
            opposing_party: importedCase.fields?.對造 || importedCase.fields?.被告 || '',
            progress: '委任',
            progress_date: new Date().toISOString().split('T')[0]
          };

          console.log('轉換後的案件資料:', caseData);

          // 呼叫保存函數
          const success = await handleSaveCase(caseData);
          if (success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${caseData.client} - ${caseData.case_type}`);
          }
        } catch (error) {
          console.error('處理單一案件失敗:', error);
          errorCount++;
          errors.push(`${importedCase.title || '未知案件'}: ${error.message}`);
        }
      }

      // 顯示匯入結果
      if (successCount > 0) {
        setDialogTitle('匯入完成');
        let message = `成功匯入 ${successCount} 筆案件！`;
        if (errorCount > 0) {
          message += `\n\n失敗 ${errorCount} 筆：\n${errors.slice(0, 5).join('\n')}`;
          if (errors.length > 5) {
            message += `\n... 還有 ${errors.length - 5} 筆失敗`;
          }
        }
        setDialogMessage(message);
        setShowSuccessDialog(true);
      } else {
        setDialogTitle('匯入失敗');
        setDialogMessage(`所有案件匯入都失敗了：\n${errors.slice(0, 5).join('\n')}`);
        setShowConfirmDialog(true);
      }

    } catch (error) {
      console.error('匯入處理失敗:', error);
      setDialogTitle('匯入錯誤');
      setDialogMessage(`匯入過程發生錯誤：${error.message}`);
      setShowConfirmDialog(true);
    }
  };

  // 切換資料夾樹顯示
  const toggleFolderTree = (caseId: string) => {
    setShowFolderTree(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // 取得案件狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // 取得案件狀態文字
  const getStatusText = (status: string) => {
    switch (status) {
      case 'urgent':
        return '緊急';
      case 'pending':
        return '待處理';
      case 'completed':
        return '已完成';
      default:
        return '進行中';
    }
  };

  // 轉換案件資料為提醒格式
  const convertToReminderData = (cases: TableCase[]): ReminderCaseData[] => {
    return cases.map(c => ({
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
    }));
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>
            
            {/* 批量操作工具列 */}
            {selectedCaseIds.length > 0 && (
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-md">
                <span className="text-sm text-blue-700">已選擇 {selectedCaseIds.length} 個案件</span>
                <button
                  onClick={handleDeleteCases}
                  className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>刪除</span>
                </button>
                <button
                  onClick={handleTransferToClosed}
                  className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>轉移結案</span>
                </button>
                <button
                  onClick={() => setShowFileUpload(true)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>上傳檔案</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={handleAddCase}
              className="bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2 justify-center sm:justify-start"
            >
              <Plus className="w-4 h-4" />
              <span>新增案件</span>
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2 justify-center sm:justify-start"
            >
              <Download className="w-4 h-4" />
              <span>匯入資料</span>
            </button>
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
            <span className="text-sm font-medium text-gray-700">狀態篩選：</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

      {/* 日期提醒小工具 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
        <DateReminderWidget 
          caseData={convertToReminderData(cases)}
          onCaseSelect={(reminderCase) => {
            const fullCase = cases.find(c => c.id === reminderCase.case_id);
            if (fullCase) {
              setSelectedCase(fullCase);
            }
          }}
        />
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
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                      title={isAllSelected ? "取消全選" : "全選"}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#334d6d]" />
                      ) : isPartialSelected ? (
                        <Minus className="w-4 h-4 text-[#334d6d]" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
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
                  <React.Fragment key={row.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCase?.id === row.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => setSelectedCase(row)}
                    >
                      <td 
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(row.id)}
                          onChange={() => handleCaseSelect(row.id)}
                          className="w-4 h-4 text-[#334d6d] border-gray-300 rounded focus:ring-[#334d6d]"
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
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}>
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
                            onClick={() => setSelectedCase(row)}
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
                        </div>
                      </td>
                    </tr>

                    {/* 資料夾樹（展開時顯示） */}
                    {showFolderTree[row.id] && (
                      <tr>
                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-6 py-4">
                          <FolderTree
                            caseId={row.id}
                            clientName={row.client}
                            isExpanded={true}
                            onToggle={() => toggleFolderTree(row.id)}
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
                    className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>編輯</span>
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={() => setShowStageDialog(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-2 rounded-md bg-gray-50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        stage.completed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {stage.completed ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                          <span className="text-xs text-gray-500">{stage.date}</span>
                        </div>
                        {stage.time && (
                          <div className="text-xs text-gray-500">時間：{stage.time}</div>
                        )}
                        {stage.note && (
                          <div className="text-xs text-gray-600 mt-1">{stage.note}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-6" />

              {/* 檔案管理 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">檔案管理</h4>
                  <button
                    onClick={() => toggleFolderTree(selectedCase.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{showFolderTree[selectedCase.id] ? '收合' : '展開'}資料夾</span>
                  </button>
                </div>

                {showFolderTree[selectedCase.id] && (
                  <FolderTree
                    caseId={selectedCase.id}
                    clientName={selectedCase.client}
                    isExpanded={true}
                    onToggle={() => toggleFolderTree(selectedCase.id)}
                  />
                )}
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

      <StageEditDialog
        isOpen={showStageDialog}
        mode="add"
        onClose={() => setShowStageDialog(false)}
        onSave={handleAddStage}
        caseId={selectedCase?.id}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          setShowFileUpload(false);
          setSelectedCaseIds([]);
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
          const caseData = cases.find(c => c.id === id);
          return {
            id,
            caseNo: caseData?.caseNumber,
            title: caseData ? `${caseData.client} - ${caseData.caseType}` : id
          };
        })}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={handleTransferConfirm}
      />

      {/* 轉移確認對話框（有警告的情況） */}
      <CustomConfirmDialog
        isOpen={showTransferConfirm}
        title="轉移確認"
        message={transferMessage}
        onConfirm={handleConfirmTransfer}
        onCancel={() => setShowTransferConfirm(false)}
        showCheckbox={true}
        checkboxLabel="我了解風險，仍要轉移這些案件"
        checkboxChecked={transferConfirmChecked}
        onCheckboxChange={setTransferConfirmChecked}
      />

      {/* 通用確認對話框 */}
      <CustomConfirmDialog
        isOpen={showConfirmDialog}
        title={dialogTitle}
        message={dialogMessage}
        onConfirm={() => {
          setShowConfirmDialog(false);
          confirmAction();
        }}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {/* 通用成功對話框 */}
      <CustomSuccessDialog
        isOpen={showSuccessDialog}
        title={dialogTitle}
        message={dialogMessage}
        onClose={() => setShowSuccessDialog(false)}
      />
    </div>
  );
}
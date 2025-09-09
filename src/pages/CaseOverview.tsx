import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Eye, Edit, Trash2, Upload, Download, FileText, User, Building, Calendar, Clock, X, CheckCircle, AlertTriangle } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
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
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'error';
}

const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '確定',
  cancelText = '取消',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-[#334d6d]';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className={`${getTypeColor()} text-white px-6 py-4 flex items-center justify-between rounded-t-lg`}>
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
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 ${getTypeColor()} text-white rounded-md hover:opacity-90 transition-colors`}
          >
            {confirmText}
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
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // 表單狀態
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);

  // 其他狀態
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
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

  // 對話框訊息
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info' as 'info' | 'warning' | 'error'
  });

  // 載入案件列表
  const loadCases = async () => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(`/api/cases?status=open&firm_code=${encodeURIComponent(firmCode)}`);
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
          stages: [] // 階段資料需要另外載入
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

  // 案件表單處理
  const handleAddCase = () => {
    setCaseFormMode('add');
    setEditingCase(null);
    setShowCaseForm(true);
  };

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
      progress_date: caseData.progressDate,
    });
    setShowCaseForm(true);
  };

  const handleSaveCase = async (caseData: FormCaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        // 新增案件到本地狀態
        const newCase: TableCase = {
          id: caseData.case_id || `temp_${Date.now()}`,
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
          progressDate: caseData.progress_date || '',
          status: 'active',
          stages: []
        };

        setCases(prev => [newCase, ...prev]);

        // 建立預設資料夾結構（只建立三個基本資料夾）
        if (caseData.case_id) {
          FolderManager.createDefaultFolders(caseData.case_id);
          FolderManager.createCaseInfoExcel(caseData.case_id, {
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
        }
      } else {
        // 編輯案件
        setCases(prev => prev.map(c =>
          c.id === caseData.case_id ? {
            ...c,
            caseType: caseData.case_type,
            client: caseData.client,
            lawyer: caseData.lawyer || '',
            legalAffairs: caseData.legal_affairs || '',
            caseReason: caseData.case_reason || '',
            caseNumber: caseData.case_number || '',
            opposingParty: caseData.opposing_party || '',
            court: caseData.court || '',
            division: caseData.division || '',
            progress: caseData.progress || '',
            progressDate: caseData.progress_date || '',
          } : c
        ));

        // 更新案件資訊 Excel 檔案
        if (caseData.case_id) {
          FolderManager.updateCaseInfoExcel(caseData.case_id, {
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
          });
        }
      }
      return true;
    } catch (error) {
      console.error('保存案件失敗:', error);
      return false;
    }
  };

  // 刪除案件
  const handleDeleteCase = (caseId: string) => {
    const caseToDelete = cases.find(c => c.id === caseId);
    if (!caseToDelete) return;

    setDialogConfig({
      title: '確認刪除',
      message: `確定要刪除案件「${caseToDelete.client} - ${caseToDelete.caseNumber}」嗎？\n\n此操作無法復原，將會刪除所有相關的階段、提醒和檔案。`,
      onConfirm: () => {
        setCases(prev => prev.filter(c => c.id !== caseId));
        if (selectedCase?.id === caseId) {
          setSelectedCase(null);
        }
        setShowConfirmDialog(false);
      },
      type: 'error'
    });
    setShowConfirmDialog(true);
  };

  // 階段管理
  const handleAddStage = (caseData: TableCase) => {
    setSelectedCase(caseData);
    setStageDialogMode('add');
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  const handleEditStage = (caseData: TableCase, stageIndex: number) => {
    setSelectedCase(caseData);
    setStageDialogMode('edit');
    setEditingStageIndex(stageIndex);
    setShowStageDialog(true);
  };

  const handleSaveStage = async (stageData: { stageName: string; date: string; time?: string; note?: string }): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const newStage: Stage = {
        name: stageData.stageName,
        date: stageData.date,
        time: stageData.time,
        note: stageData.note,
        completed: false
      };

      if (stageDialogMode === 'add') {
        // 新增階段
        setCases(prev => prev.map(c =>
          c.id === selectedCase.id
            ? { ...c, stages: [...c.stages, newStage] }
            : c
        ));

        // 建立階段資料夾
        FolderManager.createStageFolder(selectedCase.id, stageData.stageName);
      } else {
        // 編輯階段
        setCases(prev => prev.map(c =>
          c.id === selectedCase.id
            ? {
                ...c,
                stages: c.stages.map((stage, index) =>
                  index === editingStageIndex ? newStage : stage
                )
              }
            : c
        ));
      }

      return true;
    } catch (error) {
      console.error('保存階段失敗:', error);
      return false;
    }
  };

  // 匯入資料處理
  const handleImportComplete = async (importedCases: any[]) => {
    try {
      const newCases: TableCase[] = [];

      for (const importedCase of importedCases) {
        const caseId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 從匯入的欄位中提取資料
        const fields = importedCase.fields || {};

        const newCase: TableCase = {
          id: caseId,
          caseNumber: fields['案號'] || fields['案件編號'] || '',
          client: fields['當事人'] || fields['原告'] || fields['被告'] || importedCase.title || '未知當事人',
          caseType: importedCase.type,
          lawyer: fields['律師'] || fields['委任律師'] || '',
          legalAffairs: fields['法務'] || '',
          caseReason: fields['案由'] || fields['案件原因'] || '',
          opposingParty: fields['對造'] || fields['被告'] || fields['上訴人'] || '',
          court: fields['法院'] || fields['負責法院'] || '',
          division: fields['股別'] || fields['庭別'] || '',
          progress: '委任',
          progressDate: new Date().toISOString().split('T')[0],
          status: 'active',
          stages: []
        };

        newCases.push(newCase);

        // 建立預設資料夾結構
        FolderManager.createDefaultFolders(caseId);
        FolderManager.createCaseInfoExcel(caseId, {
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

        // 模擬向後端發送新增案件請求
        try {
          const firmCode = getFirmCodeOrThrow();
          const response = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firm_code: firmCode,
              case_type: fields.case_type || newCase.caseType,
              client_name: fields.client || newCase.client,
              case_reason: fields.case_reason || null,
              case_number: fields.case_number || null,
              court: fields.court || null,
              division: fields.division || null,
              lawyer_name: fields.lawyer || null,
              legal_affairs_name: fields.legal_affairs || null
            }),
          });

          if (response.ok) {
            const responseData = await response.json();
            console.log('案件成功寫入資料庫:', responseData);
            // 更新本地案件ID為後端返回的ID
            newCase.id = responseData.id;
          } else {
            console.error('案件寫入資料庫失敗:', await response.text());
          }
        } catch (error) {
          console.error('發送案件到後端失敗:', error);
        }
      }

      // 更新案件列表
      setCases(prev => [...newCases, ...prev]);

      setDialogConfig({
        title: '匯入成功',
        message: `成功匯入 ${newCases.length} 筆案件資料！\n\n已自動建立案件資料夾結構，您可以開始上傳相關檔案。`,
        onConfirm: () => setShowSuccessDialog(false),
        type: 'info'
      });
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('匯入處理失敗:', error);
      setDialogConfig({
        title: '匯入失敗',
        message: `匯入過程發生錯誤：${error.message || '未知錯誤'}`,
        onConfirm: () => setShowConfirmDialog(false),
        type: 'error'
      });
      setShowConfirmDialog(true);
    }
  };

  // 轉移到結案案件
  const handleTransferToClosed = () => {
    if (selectedCaseIds.length === 0) {
      setDialogConfig({
        title: '提醒',
        message: '請先勾選要轉移的案件',
        onConfirm: () => setShowConfirmDialog(false),
        type: 'warning'
      });
      setShowConfirmDialog(true);
      return;
    }

    // 檢查選中的案件是否都有「已結案」階段
    const selectedCases = cases.filter(c => selectedCaseIds.includes(c.id));
    const casesWithoutClosedStage = selectedCases.filter(c => !hasClosedStage(c.stages));

    if (casesWithoutClosedStage.length > 0) {
      const caseList = casesWithoutClosedStage.map(c => `• ${c.client} - ${c.caseNumber}`).join('\n');
      setDialogConfig({
        title: '無法轉移',
        message: `以下案件尚未有「已結案」階段，無法轉移：\n\n${caseList}\n\n請先為這些案件新增「已結案」階段，或取消勾選這些案件。`,
        onConfirm: () => setShowConfirmDialog(false),
        type: 'warning'
      });
      setShowConfirmDialog(true);
      return;
    }

    setShowClosedTransfer(true);
  };

  const handleConfirmTransfer = async () => {
    try {
      const selectedCases = cases.filter(c => selectedCaseIds.includes(c.id));

      // 移除已轉移的案件
      setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
      setSelectedCaseIds([]);
      setShowClosedTransfer(false);

      setDialogConfig({
        title: '轉移成功',
        message: `成功轉移 ${selectedCases.length} 筆案件到結案案件！`,
        onConfirm: () => setShowSuccessDialog(false),
        type: 'info'
      });
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('轉移案件失敗:', error);
      setDialogConfig({
        title: '轉移失敗',
        message: `轉移過程發生錯誤：${error.message || '未知錯誤'}`,
        onConfirm: () => setShowConfirmDialog(false),
        type: 'error'
      });
      setShowConfirmDialog(true);
    }
  };

  // 勾選處理
  const handleCaseSelect = (caseId: string, checked: boolean) => {
    if (checked) {
      setSelectedCaseIds(prev => [...prev, caseId]);
    } else {
      setSelectedCaseIds(prev => prev.filter(id => id !== caseId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCaseIds(filteredCases.map(c => c.id));
    } else {
      setSelectedCaseIds([]);
    }
  };

  // 資料夾展開/收合
  const toggleFolder = (caseId: string) => {
    setExpandedFolders(prev => ({
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

  // 轉換案件資料為提醒組件格式
  const reminderCaseData: ReminderCaseData[] = cases.map(c => ({
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

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>

            {/* 日期提醒組件 */}
            <div className="w-full sm:w-80">
              <DateReminderWidget
                caseData={reminderCaseData}
                onCaseSelect={(caseData) => {
                  const foundCase = cases.find(c => c.id === caseData.case_id);
                  if (foundCase) {
                    setSelectedCase(foundCase);
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
            </select>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddCase}
            className="bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2"
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
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>匯入資料</span>
          </button>

          <button
            onClick={handleTransferToClosed}
            disabled={selectedCaseIds.length === 0}
            className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span>轉移結案</span>
          </button>

          {/* 批量操作工具列 */}
          {selectedCaseIds.length > 0 && (
            <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-gray-300">
              <span className="text-sm text-gray-600">
                已選擇 {selectedCaseIds.length} 個案件
              </span>
              <button
                onClick={() => {
                  if (confirm(`確定要刪除選中的 ${selectedCaseIds.length} 個案件嗎？此操作無法復原。`)) {
                    setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
                    setSelectedCaseIds([]);
                  }
                }}
                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>批量刪除</span>
              </button>
              <button
                onClick={() => setSelectedCaseIds([])}
                className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600"
              >
                取消選擇
              </button>
            </div>
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
            {/* 桌面版表格 */}
            <div className="hidden lg:block">
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
                            onChange={(e) => handleCaseSelect(row.id, e.target.checked)}
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
                            <button
                              onClick={() => handleDeleteCase(row.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 資料夾展開區域 */}
                      {expandedFolders[row.id] && (
                        <tr>
                          <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-6 py-4 bg-gray-50">
                            <FolderTree
                              caseId={row.id}
                              clientName={row.client}
                              isExpanded={true}
                              onToggle={() => toggleFolder(row.id)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機版卡片列表 */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredCases.map((row) => (
                <div key={row.id} className="space-y-3">
                  <div
                    className={`bg-white rounded-lg border p-4 transition-colors space-y-3 ${
                      selectedCase?.id === row.id ? 'border-[#334d6d] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(row.id)}
                          onChange={(e) => handleCaseSelect(row.id, e.target.checked)}
                          className="mt-1 rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                        />
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedCase(row)}
                        >
                          <div className="font-medium text-gray-900">{row.client}</div>
                          <div className="text-sm text-gray-600">{row.caseNumber}</div>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}>
                        {getStatusText(row.status)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">類型：</span>
                        <span className="text-gray-900">{row.caseType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">律師：</span>
                        <span className="text-gray-900">{row.lawyer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">進度：</span>
                        <span className="text-gray-900">{row.progress}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleFolder(row.id)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="檔案"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditCase(row)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCase(row.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 手機版資料夾展開區域 */}
                  {expandedFolders[row.id] && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <FolderTree
                        caseId={row.id}
                        clientName={row.client}
                        isExpanded={true}
                        onToggle={() => toggleFolder(row.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右側詳情 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto">
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
                  {/* 手機版關閉按鈕 */}
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 案件基本資訊 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Building className="w-4 h-4 mr-2 text-[#334d6d]" />
                  案件基本資訊
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">案號</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">案件類型</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.caseType}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">當事人</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">委任律師</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer || '未指定'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">法務</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs || '未指定'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 案件詳細資訊 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-[#334d6d]" />
                  案件詳細資訊
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">案由</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason || '未填寫'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">對造</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.opposingParty || '未填寫'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">負責法院</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.court || '未填寫'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">負責股別</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.division || '未填寫'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">目前進度</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.progress || '未填寫'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">進度日期</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedCase.progressDate || '未填寫'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 舊的基本資訊區塊移除，替換為上面的新結構 */}
              <div className="space-y-4 mb-6" style={{ display: 'none' }}>
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
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-[#334d6d]" />
                    案件進度
                  </h4>
                  <button
                    onClick={() => handleAddStage(selectedCase)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-3 p-2 rounded-md bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleEditStage(selectedCase, idx)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        stage.completed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {stage.completed ? '✓' : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                          <div className="text-xs text-gray-500 flex items-center space-x-2">
                            <span>{stage.date}</span>
                            {stage.time && (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>{stage.time}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {stage.note && (
                          <div className="text-xs text-gray-600 mt-1">{stage.note}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedCase.stages.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      尚無進度階段
                    </div>
                  )}
                </div>
              </div>

              <hr className="my-6" />

              {/* 檔案管理 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-[#334d6d]" />
                    檔案管理
                  </h4>
                  <button
                    onClick={() => toggleFolder(selectedCase.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex items-center space-x-1"
                  >
                    <FileText className="w-3 h-3" />
                    <span>{expandedFolders[selectedCase.id] ? '收合' : '展開'}</span>
                  </button>
                </div>

                {expandedFolders[selectedCase.id] && (
                  <FolderTree
                    caseId={selectedCase.id}
                    clientName={selectedCase.client}
                    isExpanded={true}
                    onToggle={() => toggleFolder(selectedCase.id)}
                  />
                )}
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
                stageName: selectedCase.stages[editingStageIndex]?.name || '',
                date: selectedCase.stages[editingStageIndex]?.date || '',
                time: selectedCase.stages[editingStageIndex]?.time,
                note: selectedCase.stages[editingStageIndex]?.note,
              }
            : undefined
        }
        onClose={() => setShowStageDialog(false)}
        onSave={handleSaveStage}
        caseId={selectedCase?.id}
      />

      {/* 檔案上傳對話框 */}
      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          // 重新載入檔案列表
          console.log('檔案上傳完成');
        }}
        selectedCaseIds={selectedCaseIds}
        cases={cases}
      />

      {/* 匯入資料對話框 */}
      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />
      {/* 結案轉移對話框 */}
      <ClosedTransferDialog
        isOpen={showClosedTransfer}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={handleConfirmTransfer}
        selectedCases={cases.filter(c => selectedCaseIds.includes(c.id))}
      />

      {/* 自訂確認對話框 */}
      <CustomConfirmDialog
        isOpen={showConfirmDialog}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={dialogConfig.onConfirm}
        onCancel={() => setShowConfirmDialog(false)}
        type={dialogConfig.type}
      />

      {/* 自訂成功對話框 */}
      <CustomSuccessDialog
        isOpen={showSuccessDialog}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onClose={() => setShowSuccessDialog(false)}
      />
    </div>
  );
}
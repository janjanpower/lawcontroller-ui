import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Filter, Upload, Download, FileText, User, Building, 
  Eye, Edit, Trash2, X, Calendar, Clock, AlertTriangle, CheckCircle2,
  MoreVertical, Folder, Settings
} from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import DateReminderWidget from '../components/DateReminderWidget';
import FolderTree from '../components/FolderTree';
import WriteDocument from '../pages/WriteDocument';
import UnifiedDialog from '../components/UnifiedDialog';
import MobileCardList from '../components/MobileCardList';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage } from '../utils/caseStage';
import type { TableCase, Stage, FormCaseData, VisibleColumns } from '../types';

export default function CaseOverview() {
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  // 對話框狀態
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showWriteDocument, setShowWriteDocument] = useState(false);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);

  // 表單狀態
  const [caseFormMode, setCaseFormMode] = useState<'add' | 'edit'>('add');
  const [editingCase, setEditingCase] = useState<FormCaseData | null>(null);
  const [stageDialogMode, setStageDialogMode] = useState<'add' | 'edit'>('add');
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);

  // 資料夾和檔案狀態
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [s3Config] = useState({
    endpoint: import.meta.env.VITE_SPACES_ENDPOINT || '',
    accessKey: import.meta.env.VITE_SPACES_ACCESS_KEY || '',
    secretKey: import.meta.env.VITE_SPACES_SECRET_KEY || '',
    bucket: import.meta.env.VITE_SPACES_BUCKET || '',
    region: import.meta.env.VITE_SPACES_REGION || 'sgp1'
  });

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
    division: false
  });

  // 對話框配置
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    onConfirm: () => {}
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
          status: 'active' as const,
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

  // 渲染案件卡片內容
  const renderCaseCard = (caseItem: TableCase, index: number) => (
    <>
      {/* 頂部：當事人和案號 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {caseItem.client}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            案號：{caseItem.caseNumber || '未設定'}
          </p>
        </div>
        <div className="ml-3 flex flex-col items-end space-y-1">
          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            {caseItem.caseType}
          </span>
          <span className={`stage-tag small ${getProgressStageClass(caseItem.progress)}`}>
            {caseItem.progress || '委任'}
          </span>
        </div>
      </div>

      {/* 中間：案件資訊 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm">
          <User className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="text-gray-500 w-12 flex-shrink-0">律師</span>
          <span className="text-gray-900 font-medium">{caseItem.lawyer || '未指派'}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <Building className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="text-gray-500 w-12 flex-shrink-0">法務</span>
          <span className="text-gray-900">{caseItem.legalAffairs || '未指派'}</span>
        </div>

        {caseItem.progressDate && (
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
            <span className="text-gray-500 w-12 flex-shrink-0">日期</span>
            <span className="text-gray-900">{caseItem.progressDate}</span>
          </div>
        )}
      </div>

      {/* 底部：操作按鈕 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditCase(caseItem);
            }}
            className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Edit className="w-4 h-4" />
            <span>編輯</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddStage(caseItem);
            }}
            className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>階段</span>
          </button>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCase(caseItem);
          }}
          className="flex items-center space-x-1 px-3 py-2 bg-[#334d6d] text-white rounded-lg hover:bg-[#3f5a7d] transition-colors text-sm font-medium"
        >
          <Eye className="w-4 h-4" />
          <span>詳情</span>
        </button>
      </div>
    </>
  );

  // 獲取進度階段樣式
  const getProgressStageClass = (progress: string) => {
    if (!progress) return 'default';
    const p = progress.toLowerCase();
    if (p.includes('結案') || p.includes('完成')) return 'completed';
    if (p.includes('開庭') || p.includes('審理')) return 'in-progress';
    if (p.includes('委任') || p.includes('起訴')) return 'pending';
    return 'default';
  };

  // 案件操作函數
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
      progress_date: caseItem.progressDate
    });
    setShowCaseForm(true);
  };

  const handleAddStage = (caseItem: TableCase) => {
    setSelectedCase(caseItem);
    setStageDialogMode('add');
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  const handleSaveCase = async (caseData: FormCaseData): Promise<boolean> => {
    try {
      if (caseFormMode === 'add') {
        const newCase: TableCase = {
          id: caseData.case_id || `temp-${Date.now()}`,
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
      } else {
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
            progressDate: caseData.progress_date || ''
          } : c
        ));

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
      }
      return true;
    } catch (error) {
      console.error('儲存案件失敗:', error);
      return false;
    }
  };

  const handleImportComplete = async (importedCases: any[]) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      let successCount = 0;
      let errorCount = 0;

      for (const importCase of importedCases) {
        try {
          const caseDataForAPI = {
            firm_code: firmCode,
            case_type: importCase.case_type || '未分類',
            client_name: importCase.client || '未知當事人',
            case_reason: importCase.case_reason || null,
            case_number: importCase.case_number || null,
            court: importCase.court || null,
            division: importCase.division || null,
            lawyer_name: importCase.lawyer || null,
            legal_affairs_name: importCase.legal_affairs || null
          };

          const response = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

      setDialogConfig({
        title: '匯入完成',
        message: `成功匯入 ${successCount} 筆案件${errorCount > 0 ? `，${errorCount} 筆失敗` : ''}`,
        type: successCount > 0 ? 'success' : 'error',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);

      if (successCount > 0) {
        await loadCases();
      }
    } catch (error) {
      console.error('批量匯入失敗:', error);
      setDialogConfig({
        title: '匯入失敗',
        message: '批量匯入過程中發生錯誤，請稍後再試',
        type: 'error',
        onConfirm: () => {}
      });
      setShowUnifiedDialog(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>
            
            {/* 手機版操作按鈕 */}
            <div className="flex items-center space-x-2 sm:hidden">
              <button
                onClick={handleAddCase}
                className="bg-[#3498db] text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>新增</span>
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>匯入</span>
              </button>
            </div>

            {/* 桌面版操作按鈕 */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={handleAddCase}
                className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>匯入Excel</span>
              </button>
              <button
                onClick={() => setShowFileUpload(true)}
                disabled={selectedCases.length === 0}
                className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>上傳檔案</span>
              </button>
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

        {/* 日期提醒小工具 */}
        <div className="mt-4">
          <DateReminderWidget
            caseData={cases.map(c => ({
              case_id: c.id,
              client: c.client,
              case_type: c.caseType,
              progress_stages: c.stages?.reduce((acc, stage) => {
                acc[stage.name] = stage.date;
                return acc;
              }, {} as Record<string, string>) || {}
            }))}
            onCaseSelect={(caseData) => {
              const foundCase = cases.find(c => c.id === caseData.case_id);
              if (foundCase) setSelectedCase(foundCase);
            }}
          />
        </div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedCases.length === filteredCases.length && filteredCases.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCases(filteredCases.map(c => c.id));
                          } else {
                            setSelectedCases([]);
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCases.map((caseItem, index) => (
                    <tr
                      key={caseItem.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCase?.id === caseItem.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => setSelectedCase(caseItem)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCases.includes(caseItem.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCases(prev => [...prev, caseItem.id]);
                            } else {
                              setSelectedCases(prev => prev.filter(id => id !== caseItem.id));
                            }
                          }}
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
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`stage-tag small ${getProgressStageClass(caseItem.progress)}`}>
                            {caseItem.progress || '委任'}
                          </span>
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
                            onClick={() => handleEditCase(caseItem)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機版卡片列表 - 使用模組化組件 */}
            <MobileCardList
              items={filteredCases}
              renderCard={renderCaseCard}
              keyExtractor={(caseItem) => caseItem.id}
              emptyMessage="案件"
              emptyIcon={<FileText className="w-12 h-12" />}
              onItemClick={setSelectedCase}
              selectedItemId={selectedCase?.id}
              searchTerm={searchTerm}
              totalCount={cases.length}
            />
          </div>
        </div>

        {/* 右側詳情面板 */}
        {selectedCase && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            {/* 手機版全屏詳情 */}
            <div className="lg:hidden fixed inset-0 bg-white z-50 overflow-auto">
              {/* 手機版標題列 */}
              <div className="bg-[#334d6d] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-lg font-semibold">案件詳情</h3>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="p-2 text-white hover:text-gray-300 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 手機版詳情內容 */}
              <div className="p-4">
                {/* 當事人資訊卡片 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 text-lg mb-2">{selectedCase.client}</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-blue-700">案號：{selectedCase.caseNumber || '未設定'}</p>
                    <p className="text-blue-700">類型：{selectedCase.caseType}</p>
                  </div>
                </div>

                {/* 詳細資訊 */}
                <div className="space-y-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">案件資訊</h5>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <span className="text-gray-500 text-sm w-16 flex-shrink-0 mt-0.5">律師</span>
                        <span className="text-gray-900 text-sm font-medium">{selectedCase.lawyer || '未指派'}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 text-sm w-16 flex-shrink-0 mt-0.5">法務</span>
                        <span className="text-gray-900 text-sm">{selectedCase.legalAffairs || '未指派'}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 text-sm w-16 flex-shrink-0 mt-0.5">進度</span>
                        <span className={`stage-tag small ${getProgressStageClass(selectedCase.progress)}`}>
                          {selectedCase.progress || '委任'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 手機版操作按鈕 */}
                <div className="space-y-3">
                  <button
                    onClick={() => handleEditCase(selectedCase)}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <Edit className="w-5 h-5" />
                    <span>編輯案件</span>
                  </button>
                  
                  <button
                    onClick={() => handleAddStage(selectedCase)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    <span>新增階段</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 桌面版詳情 */}
            <div className="hidden lg:block p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">案件詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditCase(selectedCase)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
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

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">案號</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">當事人</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">案件類型</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseType}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">律師</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">法務</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">進度</label>
                  <div className="mt-1">
                    <span className={`stage-tag ${getProgressStageClass(selectedCase.progress)}`}>
                      {selectedCase.progress || '委任'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 資料夾樹 */}
              <div className="mt-6">
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
                  s3Config={s3Config}
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
        onSave={handleSaveCase}
        caseData={editingCase}
        mode={caseFormMode}
      />

      <StageEditDialog
        isOpen={showStageDialog}
        mode={stageDialogMode}
        onClose={() => setShowStageDialog(false)}
        onSave={async () => true}
        caseId={selectedCase?.id}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          setShowFileUpload(false);
          setSelectedCases([]);
        }}
        selectedCaseIds={selectedCases}
        cases={cases.map(c => ({
          id: c.id,
          client: c.client,
          caseNumber: c.caseNumber
        }))}
      />

      <ImportDataDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      <ClosedTransferDialog
        isOpen={showClosedTransfer}
        cases={selectedCases.map(id => {
          const c = cases.find(case => case.id === id);
          return { id, caseNo: c?.caseNumber, title: c?.client };
        })}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={async () => {
          setShowClosedTransfer(false);
          setSelectedCases([]);
        }}
      />

      <WriteDocument
        isOpen={showWriteDocument}
        onClose={() => setShowWriteDocument(false)}
        caseId={selectedCase?.id}
        clientName={selectedCase?.client}
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
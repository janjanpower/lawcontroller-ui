import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Eye, Edit, Trash2, Upload, Download, X, Calendar, Clock, User, FileText, Building, Phone, Mail, ChevronDown, ChevronUp, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog, { type StageFormData } from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import FolderTree from '../components/FolderTree';
import ImportDataDialog from '../components/ImportDataDialog';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import DateReminderWidget from '../components/DateReminderWidget';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage } from '../utils/caseStage';
import type { TableCase, Stage, CaseStatus, VisibleColumns } from '../types';

interface CaseData {
  case_id?: string;
  case_type: string;
  client: string;
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
}

export default function CaseOverview() {
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseData | null>(null);
  const [editingStageIndex, setEditingStageIndex] = useState<number>(-1);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

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
          status: 'active' as CaseStatus,
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

  // 案件操作
  const handleCaseSave = async (caseData: CaseData): Promise<boolean> => {
    try {
      if (editingCase) {
        // 編輯模式
        const updatedCases = cases.map(c => 
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
        );
        setCases(updatedCases);
        setEditingCase(null);
      } else {
        // 新增模式
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
          progress: caseData.progress || '',
          progressDate: caseData.progress_date || '',
          status: 'active',
          stages: []
        };
        setCases(prev => [newCase, ...prev]);
      }
      return true;
    } catch (error) {
      console.error('儲存案件失敗:', error);
      return false;
    }
  };

  // 階段操作
  const handleStageAdd = (caseItem: TableCase) => {
    setSelectedCase(caseItem);
    setEditingStageIndex(-1);
    setShowStageDialog(true);
  };

  const handleStageEdit = (caseItem: TableCase, stageIndex: number) => {
    setSelectedCase(caseItem);
    setEditingStageIndex(stageIndex);
    setShowStageDialog(true);
  };

  const handleStageSave = async (stageData: StageFormData): Promise<boolean> => {
    if (!selectedCase) return false;

    try {
      const newStage: Stage = {
        name: stageData.stageName,
        date: stageData.date,
        completed: false,
        note: stageData.note,
        time: stageData.time
      };

      const updatedCases = cases.map(c => {
        if (c.id === selectedCase.id) {
          const newStages = [...c.stages];
          if (editingStageIndex >= 0) {
            newStages[editingStageIndex] = newStage;
          } else {
            newStages.push(newStage);
            FolderManager.createStageFolder(c.id, stageData.stageName);
          }
          return { ...c, stages: newStages };
        }
        return c;
      });

      setCases(updatedCases);
      return true;
    } catch (error) {
      console.error('儲存階段失敗:', error);
      return false;
    }
  };

  const handleStageDelete = async (caseItem: TableCase, stageIndex: number) => {
    if (!confirm('確定要刪除此階段嗎？')) return;

    const stage = caseItem.stages[stageIndex];
    if (!stage) return;

    try {
      const hasFiles = await FolderManager.hasFilesInStageFolder(caseItem.id, stage.name);
      if (hasFiles) {
        const confirmDelete = confirm(
          `階段「${stage.name}」包含檔案，刪除階段將同時刪除所有相關檔案。確定要繼續嗎？`
        );
        if (!confirmDelete) return;
        await FolderManager.deleteStageFolder(caseItem.id, stage.name);
      }

      FolderManager.removeStageFolderNode(caseItem.id, stage.name);

      const updatedCases = cases.map(c => {
        if (c.id === caseItem.id) {
          const newStages = c.stages.filter((_, idx) => idx !== stageIndex);
          return { ...c, stages: newStages };
        }
        return c;
      });

      setCases(updatedCases);
    } catch (error) {
      console.error('刪除階段失敗:', error);
      alert('刪除階段失敗，請稍後再試');
    }
  };

  // 檔案操作
  const handleFileUploadComplete = () => {
    console.log('檔案上傳完成');
  };

  // 匯入功能
  const handleImportComplete = async (importedCases: any[]) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      let successCount = 0;
      let errorCount = 0;

      for (const importCase of importedCases) {
        try {
          const response = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              case_type: importCase.case_type || '未分類',
              client_name: importCase.client || importCase.client_name,
              case_reason: importCase.case_reason,
              case_number: importCase.case_number,
              court: importCase.court,
              division: importCase.division,
              lawyer_name: importCase.lawyer,
              legal_affairs_name: importCase.legal_affairs,
              progress: importCase.progress || '委任'
            }),
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

      alert(`匯入完成！成功: ${successCount} 筆，失敗: ${errorCount} 筆`);
      if (successCount > 0) {
        await loadCases();
      }
    } catch (error) {
      console.error('批量匯入失敗:', error);
      alert('匯入過程發生錯誤，請稍後再試');
    }
  };

  // 轉移到結案
  const handleClosedTransfer = async (payload?: { targetPath?: string }) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      let successCount = 0;

      for (const caseId of selectedCaseIds) {
        try {
          const response = await fetch(`/api/cases/${caseId}?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              is_closed: true,
              closed_at: new Date().toISOString().split('T')[0]
            }),
          });

          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error('轉移案件失敗:', error);
        }
      }

      if (successCount > 0) {
        setCases(prev => prev.filter(c => !selectedCaseIds.includes(c.id)));
        setSelectedCaseIds([]);
        alert(`成功轉移 ${successCount} 個案件到結案案件`);
      }
    } catch (error) {
      console.error('批量轉移失敗:', error);
      alert('轉移過程發生錯誤');
    }
  };

  const getStageStatusIcon = (stage: Stage) => {
    if (stage.completed) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    
    if (stage.date) {
      const stageDate = new Date(stage.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      stageDate.setHours(0, 0, 0, 0);
      
      if (stageDate < today) {
        return <XCircle className="w-4 h-4 text-red-600" />;
      } else if (stageDate.getTime() === today.getTime()) {
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      }
    }
    
    return <Clock className="w-4 h-4 text-blue-600" />;
  };

  const getStageStatusText = (stage: Stage) => {
    if (stage.completed) return '已完成';
    
    if (stage.date) {
      const stageDate = new Date(stage.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      stageDate.setHours(0, 0, 0, 0);
      
      if (stageDate < today) return '逾期';
      if (stageDate.getTime() === today.getTime()) return '今日';
      
      const diffTime = stageDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays}天後`;
    }
    
    return '待處理';
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">案件總覽</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowCaseForm(true)}
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
              {selectedCaseIds.length > 0 && (
                <button
                  onClick={() => setShowClosedTransfer(true)}
                  className="bg-[#f39c12] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#d68910] transition-colors flex items-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>轉移結案 ({selectedCaseIds.length})</span>
                </button>
              )}
            </div>
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

        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCases.length}/{cases.length} 個案件
          </div>
        )}
      </div>

      {/* 日期提醒小工具 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
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
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.progress}
                        </td>
                      )}
                      {visibleColumns.progressDate && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {row.progressDate}
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
                              setEditingCase({
                                case_id: row.id,
                                case_type: row.caseType,
                                client: row.client,
                                lawyer: row.lawyer,
                                legal_affairs: row.legalAffairs,
                                case_reason: row.caseReason,
                                case_number: row.caseNumber,
                                opposing_party: row.opposingParty,
                                court: row.court,
                                division: row.division,
                                progress: row.progress,
                                progress_date: row.progressDate
                              });
                              setShowCaseForm(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('確定要刪除此案件嗎？此操作無法復原。')) {
                                try {
                                  const firmCode = getFirmCodeOrThrow();
                                  const response = await fetch(`/api/cases/${row.id}?firm_code=${encodeURIComponent(firmCode)}`, {
                                    method: 'DELETE'
                                  });
                                  if (response.ok) {
                                    setCases(prev => prev.filter(c => c.id !== row.id));
                                    if (selectedCase?.id === row.id) {
                                      setSelectedCase(null);
                                    }
                                  }
                                } catch (error) {
                                  console.error('刪除案件失敗:', error);
                                }
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

            {/* 手機版卡片列表 - 優化排版 */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`bg-white rounded-lg border shadow-sm transition-all duration-200 ${
                    selectedCase?.id === caseItem.id ? 'border-[#334d6d] bg-blue-50 shadow-md' : 'border-gray-200 hover:shadow-md'
                  }`}
                >
                  {/* 卡片頭部 - 重要資訊 */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setSelectedCase(caseItem)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-base mb-1">{caseItem.client}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {caseItem.caseType}
                          </span>
                          {caseItem.caseNumber && (
                            <span className="text-xs text-gray-500">#{caseItem.caseNumber}</span>
                          )}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.includes(caseItem.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedCaseIds(prev => [...prev, caseItem.id]);
                          } else {
                            setSelectedCaseIds(prev => prev.filter(id => id !== caseItem.id));
                          }
                        }}
                        className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                      />
                    </div>

                    {/* 案件詳情 */}
                    <div className="space-y-2 text-sm">
                      {caseItem.caseReason && (
                        <div className="flex items-start">
                          <span className="text-gray-500 w-16 flex-shrink-0">案由：</span>
                          <span className="text-gray-900">{caseItem.caseReason}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        {caseItem.lawyer && (
                          <div className="flex items-center">
                            <User className="w-3 h-3 text-gray-400 mr-1" />
                            <span className="text-gray-600 text-xs">{caseItem.lawyer}</span>
                          </div>
                        )}
                        {caseItem.court && (
                          <div className="flex items-center">
                            <Building className="w-3 h-3 text-gray-400 mr-1" />
                            <span className="text-gray-600 text-xs">{caseItem.court}</span>
                          </div>
                        )}
                      </div>

                      {/* 進度資訊 */}
                      {caseItem.progress && (
                        <div className="bg-gray-50 rounded-md p-2 mt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">目前進度</span>
                            {caseItem.progressDate && (
                              <span className="text-xs text-gray-400">{caseItem.progressDate}</span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-900 mt-1">{caseItem.progress}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 卡片底部 - 操作按鈕 */}
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        編輯
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCase(caseItem);
                        }}
                        className="text-[#334d6d] hover:text-[#3f5a7d] text-sm font-medium"
                      >
                        檢視詳情
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                    onClick={() => handleStageAdd(selectedCase)}
                    className="bg-[#27ae60] text-white px-3 py-1.5 rounded-md hover:bg-[#229954] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增階段</span>
                  </button>
                  {/* 只保留一個關閉按鈕 */}
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
                  <label className="text-sm font-medium text-gray-500">當事人</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.client}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">案件類型</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.caseType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">案號</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.caseNumber}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">律師</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.lawyer}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">法務</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCase.legalAffairs}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">案由</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCase.caseReason}</p>
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
              </div>

              <hr className="my-6" />

              {/* 案件進度 - 優化排版 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件進度</h4>
                  <button
                    onClick={() => handleStageAdd(selectedCase)}
                    className="text-[#27ae60] hover:text-[#229954] text-xs flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {selectedCase.stages.map((stage, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      {/* 階段標題行 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStageStatusIcon(stage)}
                          <span className="font-medium text-gray-900 text-sm">{stage.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            stage.completed 
                              ? 'bg-green-100 text-green-700' 
                              : getStageStatusText(stage) === '逾期'
                              ? 'bg-red-100 text-red-700'
                              : getStageStatusText(stage) === '今日'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {getStageStatusText(stage)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStageEdit(selectedCase, idx)}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="編輯階段"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStageDelete(selectedCase, idx)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="刪除階段"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* 日期時間資訊 */}
                      {(stage.date || stage.time) && (
                        <div className="flex items-center space-x-4 text-xs text-gray-600 mb-2">
                          {stage.date && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{stage.date}</span>
                            </div>
                          )}
                          {stage.time && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{stage.time}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 備註 */}
                      {stage.note && (
                        <div className="bg-white rounded-md p-2 border border-gray-100">
                          <p className="text-xs text-gray-700">{stage.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {selectedCase.stages.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">尚無進度記錄</p>
                      <button
                        onClick={() => handleStageAdd(selectedCase)}
                        className="text-[#27ae60] hover:text-[#229954] text-sm mt-2"
                      >
                        新增第一個階段
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <hr className="my-6" />

              {/* 資料夾樹 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">案件資料夾</h4>
                  <button
                    onClick={() => setExpandedFolders(prev => ({
                      ...prev,
                      [selectedCase.id]: !prev[selectedCase.id]
                    }))}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedFolders[selectedCase.id] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <FolderTree
                  caseId={selectedCase.id}
                  clientName={selectedCase.client}
                  isExpanded={expandedFolders[selectedCase.id] || false}
                  onToggle={() => setExpandedFolders(prev => ({
                    ...prev,
                    [selectedCase.id]: !prev[selectedCase.id]
                  }))}
                  onFileUpload={() => setShowFileUpload(true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 對話框 */}
      <CaseForm
        isOpen={showCaseForm}
        onClose={() => {
          setShowCaseForm(false);
          setEditingCase(null);
        }}
        onSave={handleCaseSave}
        caseData={editingCase}
        mode={editingCase ? 'edit' : 'add'}
      />

      <StageEditDialog
        isOpen={showStageDialog}
        mode={editingStageIndex >= 0 ? 'edit' : 'add'}
        initial={editingStageIndex >= 0 && selectedCase ? {
          stageName: selectedCase.stages[editingStageIndex]?.name || '',
          date: selectedCase.stages[editingStageIndex]?.date || '',
          time: selectedCase.stages[editingStageIndex]?.time || '',
          note: selectedCase.stages[editingStageIndex]?.note || ''
        } : undefined}
        onClose={() => {
          setShowStageDialog(false);
          setEditingStageIndex(-1);
        }}
        onSave={handleStageSave}
        caseId={selectedCase?.id}
      />

      <FileUploadDialog
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={handleFileUploadComplete}
        selectedCaseIds={selectedCaseIds}
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
        cases={selectedCaseIds.map(id => {
          const c = cases.find(x => x.id === id);
          return { id, caseNo: c?.caseNumber, title: c?.client };
        })}
        onClose={() => setShowClosedTransfer(false)}
        onConfirm={handleClosedTransfer}
      />
    </div>
  );
}
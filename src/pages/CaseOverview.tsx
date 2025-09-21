import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Upload, Download, Eye, Edit, Trash2,
  FileText, User, Building, Calendar, Clock, ChevronDown, ChevronUp,
  MoreVertical, X, CheckCircle, AlertCircle, Archive, Folder,
  MoreHorizontal, PenTool
} from 'lucide-react';
import CaseForm from '../components/CaseForm';
import StageEditDialog, { type StageFormData } from '../components/StageEditDialog';
import FileUploadDialog from '../components/FileUploadDialog';
import FolderTree from '../components/FolderTree';
import DateReminderWidget from '../components/DateReminderWidget';
import ClosedTransferDialog from '../components/ClosedTransferDialog';
import UnifiedDialog from '../components/UnifiedDialog';
import ImportDataDialog from '../components/ImportDataDialog';
import WriteDocument from '../pages/WriteDocument';
import { parseExcelToCases } from '../utils/importers';
import { FolderManager } from '../utils/folderManager';
import { hasClosedStage } from '../utils/caseStage';
import { apiFetch, getFirmCodeOrThrow, hasAuthToken, clearLoginAndRedirect } from '../utils/api';
import type { TableCase, Stage, CaseStatus, VisibleColumns, DialogConfig } from '../types';
import FilePreviewDialog from "../components/FilePreviewDialog";

export default function CaseOverview() {
  // 基本狀態
  const [cases, setCases] = useState<TableCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<TableCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TableCase | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const allSelected =
  selectedCaseIds.length > 0 &&
  selectedCaseIds.length === filteredCases.length &&
  filteredCases.length > 0;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed' | 'urgent'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<any[]>([]);

  // 對話框狀態

  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showClosedTransfer, setShowClosedTransfer] = useState(false);
  const [showUnifiedDialog, setShowUnifiedDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showWriteDocument, setShowWriteDocument] = useState(false);
  const [writeDocumentCaseId, setWriteDocumentCaseId] = useState<string>('');
  const [writeDocumentClientName, setWriteDocumentClientName] = useState<string>('');
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

  // ✅ 新增：結案階段檢查對話框
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningList, setWarningList] = useState<TableCase[]>([]);

  // 檢查登入狀態
  useEffect(() => {
    if (!hasAuthToken()) {
      console.warn('沒有登入 token，重新導向到登入頁面');
      clearLoginAndRedirect();
      return;
    }
    loadCases();
  }, []);

  const loadCases = useCallback(async () => {
  if (!hasAuthToken()) {
    console.warn('登入狀態不完整，無法載入案件');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const firmCode = getFirmCodeOrThrow();
    const response = await apiFetch(
      `/api/cases?firm_code=${encodeURIComponent(firmCode)}&status=open`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('載入案件失敗:', errorText);
      throw new Error(`載入案件失敗: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('載入的案件資料:', data);

    // ✅ 加這裡，避免後端回傳格式不對整個掛掉
    if (!data || !Array.isArray(data.items)) {
      console.warn("API 回傳格式不符合預期:", data);
      setCases([]);  // 預設清空
      return;
    }

    // 轉換後端資料為前端格式
    const transformedCases: TableCase[] = await Promise.all(
      (data.items || []).map(async (apiCase: any) => {
        let stages: Stage[] = [];

        try {
          // 先抓案件的階段
          const stagesResponse = await apiFetch(
            `/api/cases/${apiCase.id}/stages?firm_code=${encodeURIComponent(firmCode)}`
          );

          // 再抓案件檔案（含 stage 對應的檔案）
          let filesData: any = {};
          try {
            const filesResponse = await apiFetch(
              `/api/cases/${apiCase.id}/files?firm_code=${encodeURIComponent(firmCode)}`
            );
            if (filesResponse.ok) {
              filesData = await filesResponse.json();
            }
          } catch (err) {
            console.warn(`載入案件 ${apiCase.id} 的檔案失敗:`, err);
          }

          if (stagesResponse.ok) {
            const stagesData = await stagesResponse.json();

            // 準備 folderId mapping：folder_name → folder_id
            const folderIdMap: Record<string, string> = {};
            if (filesData.folders && Array.isArray(filesData.folders)) {
              filesData.folders.forEach((f: any) => {
                if (f.folder_type === "stage") {
                  folderIdMap[f.folder_name] = f.id;
                }
              });
            }

            stages = (stagesData || []).map((stage: any) => {
              // 用 folder_name 找對應的 folderId
              const folderId = folderIdMap[stage.stage_name];
              // 找出屬於這個 folder 的檔案
              const stageFiles = folderId
                ? (filesData.stage || []).filter((f: any) => f.folder_id === folderId)
                : [];

              return {
                id: stage.id, // 還是保留 stage.id
                name: stage.stage_name,
                date: stage.stage_date || "",
                completed: stage.is_completed || false,
                note: stage.note || "",
                time: stage.stage_time || "",
                files: stageFiles, // ✅ 改成用 folder_id mapping
              };
            });
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
          progress: apiCase.progress || '',
          progressDate:
            apiCase.progress_date || new Date().toISOString().split('T')[0],
          status: 'active' as CaseStatus,
          stages: stages,
        };
      })
    );

    setCases(transformedCases);
    console.log('轉換後的案件資料:', transformedCases);
  } catch (error: any) {
    console.error('載入案件失敗:', error);
    setError(error.message || '載入案件失敗');
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
        progress: caseData.progress || '',
        progressDate: caseData.progress_date || new Date().toISOString().split('T')[0],
        status: 'active' as CaseStatus,
        stages: []
      };

      console.log('DEBUG: 轉換後的案件資料:', newCase);

      // 更新本地狀態
      setCases(prev => [newCase, ...prev]);


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

  // ✅ 重新抓某案件的詳細資料
  const refreshCaseDetail = async (caseId: string) => {
    try {
      const firmCode = getFirmCodeOrThrow();

      const stagesResp = await apiFetch(`/api/cases/${caseId}/stages?firm_code=${encodeURIComponent(firmCode)}`);
      const filesResp = await apiFetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);

      if (!stagesResp.ok || !filesResp.ok) return;
      const stagesData = await stagesResp.json();
      const filesData = await filesResp.json();

      // 準備 folderId mapping
      const folderIdMap: Record<string, string> = {};
      if (filesData.folders) {
        filesData.folders.forEach((f: any) => {
          if (f.folder_type === "stage") folderIdMap[f.folder_name] = f.id;
        });
      }

      const stages: Stage[] = (stagesData || []).map((stage: any) => {
        const folderId = folderIdMap[stage.stage_name];
        const stageFiles = folderId
          ? (filesData.stage || []).filter((f: any) => f.folder_id === folderId)
          : [];
        return {
          id: stage.id,
          name: stage.stage_name,
          date: stage.stage_date || "",
          completed: stage.is_completed || false,
          note: stage.note || "",
          time: stage.stage_time || "",
          files: stageFiles,
        };
      });

      setCases(prev =>
        prev.map(c => c.id === caseId ? { ...c, stages } : c)
      );
      setSelectedCase(prev =>
        prev && prev.id === caseId ? { ...prev, stages } : prev
      );
    } catch (err) {
      console.error("refreshCaseDetail 失敗:", err);
    }
  };

  // ✅ 監聽 caseDetail:refresh → 即時更新右側詳情
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.caseId) {
        refreshCaseDetail(e.detail.caseId); // 重新抓該案件的 stages + files
      }
    };
    window.addEventListener("caseDetail:refresh", handler);
    return () => window.removeEventListener("caseDetail:refresh", handler);
  }, []);


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
    const res = await apiFetch(
      `/api/cases/${selectedCase.id}/stages?firm_code=${encodeURIComponent(firmCode)}`,
      {
        method: "POST",
        body: JSON.stringify({
          stage_name: stageData.stageName,
          stage_date: stageData.date,
          stage_time: stageData.time,
          note: stageData.note,
          is_completed: false,
          sort_order: selectedCase.stages.length,
        }),
      }
    );
    if (!res.ok) throw new Error((await res.json()).detail || "新增階段失敗");
    const data = await res.json();

    const newStage: Stage = {
      id: data.id,
      name: data.stage_name,
      date: data.stage_date,
      completed: data.is_completed,
      note: data.note,
      time: data.stage_time,
      files: [],
      folderId: data.folder_id ?? null,     // ✅ 存起來
    };

    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, stages: [...c.stages, newStage] } : c));
    setSelectedCase(prev => prev && prev.id === selectedCase.id ? { ...prev, stages: [...prev.stages, newStage] } : prev);

    // 只有沒有 folder_id 才備援建一個（會掛到案件進度）
    if (!data.folder_id) {
      await apiFetch(
        `/api/cases/${selectedCase.id}/folders?firm_code=${encodeURIComponent(firmCode)}`,
        {
          method: "POST",
          body: JSON.stringify({
            folder_name: stageData.stageName,
            folder_type: "stage",
            parent_type: "progress",
          }),
        }
      );
    }

    // 重新載入資料夾樹
    window.dispatchEvent(new CustomEvent("folders:refresh", { detail: { caseId: selectedCase.id } }));
    window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId: selectedCase.id } }));
    return true;
  } catch (e: any) {
    setDialogConfig({ title: "新增階段失敗", message: e.message || "新增階段失敗", type: "error" });
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
    const response = await apiFetch(
      `/api/cases/${selectedCase.id}/stages/${editingStage.stage.id}?firm_code=${encodeURIComponent(firmCode)}`, {
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
      ...editingStage.stage,     // ✅ 保留原本的 files
      id: editingStage.stage.id,
      name: stageData.stageName,
      date: stageData.date,
      note: stageData.note,
      time: stageData.time,
      completed: editingStage.stage.completed
    };

    // 更新本地狀態（cases）
    setCases(prev => prev.map(c =>
      c.id === selectedCase.id
        ? { ...c, stages: c.stages.map((s, i) => i === editingStage.index ? updatedStage : s) }
        : c
    ));

    // 更新右側詳情（selectedCase）
    setSelectedCase(prev =>
      prev && prev.id === selectedCase.id
        ? { ...prev, stages: prev.stages.map((s, i) => i === editingStage.index ? updatedStage : s) }
        : prev
    );

    // 🔔 通知資料夾樹同步
    window.dispatchEvent(new CustomEvent("folders:refresh", { detail: { caseId: selectedCase.id } }));
    window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId: selectedCase.id } }));

    console.log('階段編輯成功:', updatedStage);
    return true;
  } catch (error: any) {
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

  // 檢查是否有檔案
const handleDeleteStage = async (stageId: string, stageName: string, stageIndex: number) => {
  if (!selectedCase) return;

  try {
    const firmCode = getFirmCodeOrThrow();
    const res = await apiFetch(
      `/api/cases/${selectedCase.id}/stages/${stageId}/files/count?firm_code=${encodeURIComponent(firmCode)}`
    );

    const data = await res.json();
    const fileCount = data.count ?? 0;

    if (fileCount > 0) {
      // 有檔案 → 跳出自訂確認視窗
      setDialogConfig({
        title: '資料夾內仍有檔案',
        message: `階段「${stageName}」的資料夾內仍有 ${fileCount} 個檔案，確定要一併刪除嗎？此操作無法復原。`,
        type: 'warning',
        onConfirm: async () => {
          await actuallyDeleteStage(stageId, stageName, stageIndex);   // ✅ 用函數參數，而不是不存在的 stage
        },
      });
      setShowUnifiedDialog(true);
      return;
    }

    // 沒檔案 → 直接刪除
    await actuallyDeleteStage(stageId, stageName, stageIndex);
  } catch (err) {
    // API 失敗時，保守視為有檔案
    setDialogConfig({
      title: '刪除確認',
      message: `無法檢查階段「${stageName}」的檔案狀態，是否仍要刪除？`,
      type: 'warning',
      onConfirm: async () => {
        await actuallyDeleteStage(stageId, stageName, stageIndex);
      },
    });

    setShowUnifiedDialog(true);
  }
};

// 真正刪除
const actuallyDeleteStage = async (stageId: string, stageName: string, stageIndex: number) => {
  if (!selectedCase) return;

  try {
    const firmCode = getFirmCodeOrThrow();
    const resp = await apiFetch(
      `/api/cases/${selectedCase.id}/stages/${stageId}?firm_code=${encodeURIComponent(firmCode)}`,
      { method: 'DELETE' }
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '刪除階段失敗');
    }

    // 更新前端列表
    setCases(prev => prev.map(c =>
      c.id === selectedCase.id
        ? { ...c, stages: c.stages.filter(s => s.id !== stageId) }
        : c
    ));
    setSelectedCase(prev =>
      prev && prev.id === selectedCase.id
        ? { ...prev, stages: prev.stages.filter(s => s.id !== stageId) }
        : prev
    );

    setDialogConfig({
      title: '刪除成功',
      message: `已刪除階段「${stageName}」`,
      type: 'success',
    });
    setShowUnifiedDialog(true);
    window.dispatchEvent(new CustomEvent("folders:refresh", { detail: { caseId: selectedCase.id } }));
    window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId: selectedCase.id } }));

  } catch (err: any) {
    setDialogConfig({
      title: '刪除失敗',
      message: err?.message || '刪除階段時發生錯誤',
      type: 'error',
    });
    setShowUnifiedDialog(true);
  }
};

const handleDownload = async (fileId: string) => {
  try {
    const firmCode = getFirmCodeOrThrow();
    const res = await apiFetch(`/api/files/${fileId}/url?firm_code=${encodeURIComponent(firmCode)}`);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || '取得下載連結失敗');
    }

    const data = await res.json();
    if (data?.url) {
      const link = document.createElement('a');
      link.href = data.url;
      link.download = data.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      throw new Error('回傳缺少下載 URL');
    }
  } catch (err: any) {
    console.error('下載檔案失敗:', err);
    alert(err?.message || '下載檔案失敗');
  }
};

// ✅ 檔案預覽
const handlePreview = async (fileId: string) => {
  try {
    const firmCode = getFirmCodeOrThrow();
    const res = await apiFetch(`/api/files/${fileId}/url?firm_code=${encodeURIComponent(firmCode)}`);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "取得檔案預覽連結失敗");
    }

    const data = await res.json();
    setPreviewFiles([data]);   // FilePreviewDialog 支援陣列
    setPreviewOpen(true);
  } catch (err: any) {
    console.error("預覽檔案失敗:", err);
    alert(err?.message || "預覽檔案失敗");
  }
};


  // 切換階段完成狀態（含樂觀更新與回滾，同步列表與右側詳情）
  const toggleStageCompletion = (stageIndex: number) => {
    if (!selectedCase) return;

    const stage = selectedCase.stages[stageIndex];
    if (!stage) return;

    const newCompleted = !stage.completed; // 用固定值避免多次取反不一致

    // 呼叫後端 API 更新階段完成狀態
    const updateStageStatus = async () => {
      try {
        const firmCode = getFirmCodeOrThrow();
        const response = await apiFetch(
          `/api/cases/${selectedCase.id}/stages/${stage.id}?firm_code=${encodeURIComponent(firmCode)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ is_completed: newCompleted }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '更新階段狀態失敗');
        }
      } catch (error) {
        console.error('更新階段狀態失敗:', error);

        // 🔁 回滾：列表
        setCases(prev => prev.map(c =>
          c.id === selectedCase.id
            ? {
                ...c,
                stages: c.stages.map((s, i) =>
                  i === stageIndex ? { ...s, completed: stage.completed } : s
                ),
              }
            : c
        ));

        // 🔁 回滾：右側詳情
        setSelectedCase(prev =>
          prev && prev.id === selectedCase.id
            ? {
                ...prev,
                stages: prev.stages.map((s, i) =>
                  i === stageIndex ? { ...s, completed: stage.completed } : s
                ),
              }
            : prev
        );
      }
    };

    // ✅ 樂觀更新：列表
    setCases(prev => prev.map(c =>
      c.id === selectedCase.id
        ? {
            ...c,
            stages: c.stages.map((s, i) =>
              i === stageIndex ? { ...s, completed: newCompleted } : s
            ),
          }
        : c
    ));

    // ✅ 樂觀更新：右側詳情
    setSelectedCase(prev =>
      prev && prev.id === selectedCase.id
        ? {
            ...prev,
            stages: prev.stages.map((s, i) =>
              i === stageIndex ? { ...s, completed: newCompleted } : s
            ),
          }
        : prev
    );

    // ▶ 實際送後端
    updateStageStatus();
    window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId: selectedCase.id } }));

  };



  // 工具：轉字串、裁長度、去空白
  const S = (v: any) => (v == null ? '' : String(v).trim());
  const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

  // 必填欄位（依後端慣例）
  const REQUIRED = { client_name: true, case_type: true };
  // 欄位長度上限（避免 DB 長度爆掉）
  const LIMITS: Record<string, number> = {
    client_name: 100,
    case_type: 50,
    case_reason: 200,
    case_number: 100,
    court: 100,
    division: 100,
    lawyer_name: 100,
    legal_affairs_name: 100,
  };

  const sanitize = (x: any) => {
    // 對齊 CaseForm 新增的命名與預設
    let obj: any = {
      case_type: S(x.case_type) || '未分類',
      client_name: S(x.client),               // client → client_name
      case_reason: S(x.case_reason) || '',
      case_number: S(x.case_number) || '',
      court: S(x.court) || '',
      division: S(x.division) || '',
      lawyer_name: S(x.lawyer) || '',
      legal_affairs_name: S(x.legal_affairs) || '',
    };
    // 長度裁切
    for (const k of Object.keys(obj)) {
      const lim = LIMITS[k];
      if (lim && typeof obj[k] === 'string') obj[k] = cut(obj[k], lim);
    }
    // 空字串→null（但必填欄位除外）
    for (const k of Object.keys(obj)) {
      if (!obj[k] && !REQUIRED[k as keyof typeof REQUIRED]) obj[k] = null;
    }
    return obj;
  };

  const isValid = (payload: any) => !!payload.client_name && !!payload.case_type;

  const handleImportComplete = async (importedCases: any[]) => {
    try {
      setLoading(true);

      if (!Array.isArray(importedCases) || !importedCases.length) {
        setDialogConfig({
          title: '沒有可匯入的資料',
          message: '解析結果為空，請確認 Excel 欄位標題與內容。',
          type: 'warning'
        });
        setShowUnifiedDialog(true);
        return;
      }

      const firmCode = getFirmCodeOrThrow();

      // 清理＋驗證
      const prepared = importedCases.map(sanitize);
      const valid = prepared.filter(isValid);
      const skipped = prepared.length - valid.length; // 因缺必填而略過的數量

      let ok = 0, fail = 0;
      const errs: string[] = [];

      for (const item of valid) {
        // ⚠️ 完全比照 CaseForm：URL 帶 firm_code，body 也帶 firm_code
        const payload = { firm_code: firmCode, ...item };
        try {
          const res = await fetch(`/api/cases?firm_code=${encodeURIComponent(firmCode)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const text = await res.text();
            console.error('Create case failed:', res.status, text, 'payload=', payload);
            fail++; errs.push(`${res.status}: ${text}`.slice(0, 600));
          } else {
            ok++;
          }
        } catch (e: any) {
          console.error('Network error while creating case:', e, 'payload=', payload);
          fail++; errs.push(e?.message || '網路錯誤');
        }
      }

      await loadCases();

      setDialogConfig({
        title: '匯入完成',
        message:
          `成功新增 ${ok} 筆案件` +
          (skipped ? `（略過 ${skipped} 筆：缺少必填欄位）` : '') +
          (fail ? `，失敗 ${fail} 筆\n\n錯誤（前 5 筆）：\n- ${errs.slice(0, 5).join('\n- ')}${errs.length > 5 ? '\n(其餘略)' : ''}` : ''),
        type: fail ? 'warning' : 'success'
      });
      setShowUnifiedDialog(true);
    } catch (e: any) {
      setDialogConfig({ title: '匯入失敗', message: e?.message || '發生未知錯誤', type: 'error' });
      setShowUnifiedDialog(true);
    } finally {
      setLoading(false);
    }
  };




  // ✅ 抽出共用轉移邏輯
  const doTransferToClosed = async (ids: string[]) => {
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();
      for (const caseId of ids) {
        const response = await apiFetch(`/api/cases/${caseId}/close?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'POST'
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `轉移案件 ${caseId} 失敗`);
        }
      }
      setCases(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedCaseIds([]);
      setSelectedCase(null);
      setDialogConfig({
        title: '轉移成功',
        message: `成功轉移 ${ids.length} 筆案件到結案案件`,
        type: 'success'
      });
      setShowUnifiedDialog(true);
    } catch (error: any) {
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


  // ✅ 修改：轉移邏輯加檢查
  const handleTransferToClosed = async () => {
    if (selectedCaseIds.length === 0) return;
    const withoutClosedStage = selectedCaseIds
      .map((id) => cases.find((c) => c.id === id))
      .filter(
        (caseItem): caseItem is TableCase =>
          !!caseItem && !caseItem.stages?.some((s) => s.name === '結案')
      );
    if (withoutClosedStage.length > 0) {
      setWarningList(withoutClosedStage);
      setWarningDialogOpen(true);
      return;
    }
    await doTransferToClosed(selectedCaseIds);
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
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <button
                onClick={() => {
                  setCaseFormMode('add');
                  setEditingCase(null);
                  setShowCaseForm(true);
                }}
                className="bg-[#3498db] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>新增案件</span>
              </button>

              <button
                onClick={() => setShowFileUpload(true)}
                className="bg-[#27ae60] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-[#229954] transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Upload className="w-4 h-4" />
                <span>上傳檔案</span>
              </button>

              <button
                onClick={() => setShowImportDialog(true)}
                className="bg-[#ff7525] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>匯入資料</span>
              </button>

              <button
                onClick={handleTransferToClosed}
                className="bg-[#f39c12] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-[#d68910] transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                <span>轉移結案</span>
              </button>

              <button
                onClick={() => {
                  if (selectedCaseIds.length === 1) {
                    const selectedCase = filteredCases.find(c => c.id === selectedCaseIds[0]);
                    if (selectedCase) {
                      setWriteDocumentCaseId(selectedCase.id);
                      setWriteDocumentClientName(selectedCase.client);
                    }
                  }
                  setShowWriteDocument(true);
                }}
                className="bg-[#7d37b6] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <PenTool className="w-4 h-3.5" />
                <span>撰寫文件</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-6">
            {/* 跑馬燈：日期提醒 */}
            <div className="w-full sm:w-80 order-2 sm:order-1">
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
              {/* 搜尋結果統計 - 顯示在輸入框內右側 */}
              {searchTerm && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2  text-sm text-green-600 bg-gray-50 px-1.5 py-0.5 rounded pointer-events-none">
                  {filteredCases.length} / {cases.length} 個案件
                </div>
              )}
            </div>
            </div>

        </div>


        {/* 分界線上的篩選按鈕 - 懸停顯示 */}
        <div className="group absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 z-50">
          <div className="relative">
            {/* 觸發區域 */}
            <div className="w-16 h-4 bg-transparent cursor-pointer"></div>

            {/* 滑出的篩選按鈕 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                         opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100
                         transition-all duration-300 ease-out
                         p-2 bg-white border border-gray-300 rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 ${
                showFilters ? 'opacity-100 scale-100 bg-gray-100 border-gray-400' : ''
              }`}
            >
              <Filter className="w-4 h-4 text-gray-600" />
            </button>

            {/* 下拉選單 */}
            {showFilters && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilters(false)}
                />
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">顯示欄位</h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(visibleColumns).map(([key, visible]) => (
                      <label key={key} className="flex items-center space-x-2 text-sm cursor-pointer">
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
                        <span className="text-gray-600">
                          {key === 'caseNumber' ? '案號' :
                           key === 'client' ? '當事人' :
                           key === 'caseType' ? '案件類型' :
                           key === 'lawyer' ? '律師' :
                           key === 'legalAffairs' ? '法務' :
                           key === 'progress' ? '進度' :
                           key === 'progressDate' ? '進度日期' :
                           key === 'court' ? '法院' :
                           key === 'division' ? '股別' : key}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 批量操作工具列 */}
        {selectedCaseIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4">
            <div className="animate-slide-up">
              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4">
                {/* 頂部：選中數量 */}
                <div className="text-center mb-3">
                  <span className="text-sm text-gray-700 font-medium">
                    已選擇 {selectedCaseIds.length} 筆案件
                  </span>
                </div>

                {/* 手機版：垂直排列按鈕 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                    <button
                      onClick={() => handleSelectAll(true)}
                      disabled={allSelected}
                      className={`w-full sm:w-auto px-4 py-2 text-sm underline transition-colors rounded-md ${
                        allSelected
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      title="全選目前清單"
                    >
                      {allSelected ? '已全選' : '全選'}
                    </button>

                    <button
                      onClick={() => handleSelectAll(false)}
                      className="w-full sm:w-auto px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm underline transition-colors rounded-md"
                    >
                      取消選擇
                    </button>
                  </div>

                  {/* 分隔線 - 手機版隱藏 */}
                  <div className="hidden sm:block w-px h-5 bg-gray-300"></div>

                  <button
                    onClick={handleBatchDelete}
                    className="w-full sm:w-auto bg-red-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center justify-center space-x-2 transition-all hover:shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>刪除</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 欄位控制區域 - 已移除，改為上方的下拉選單 */}

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
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ">
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
                     <React.Fragment key={row.id}>
                      <tr
                        className={`cursor-pointer transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } hover:bg-gray-100 ${
                          selectedCase?.id === row.id ? 'border-2 border-[#334d6d]' : ''
                        }`}
                        onClick={(e) => {
                          if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') return;
                          setSelectedCase(row);
                        }}
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

                                const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
                                const normalizeDate = (v: any) =>
                                  typeof v === 'string' ? v.slice(0, 10) : (v instanceof Date ? v.toISOString().slice(0,10) : '');

                                const formData = {
                                  case_id: row.id,
                                  case_number: toStr(row.caseNumber),
                                  client: toStr(row.client),
                                  case_type: toStr(row.caseType),
                                  lawyer: toStr(row.lawyer),
                                  legal_affairs: toStr(row.legalAffairs),
                                  case_reason: toStr(row.caseReason),
                                  opposing_party: toStr(row.opposingParty),
                                  court: toStr(row.court),
                                  division: toStr(row.division),
                                  progress: toStr(row.progress),
                                  progress_date: normalizeDate(row.progressDate),
                                };

                                setCaseFormMode('edit');
                                setEditingCase(formData);
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
                        <tr className="bg-gray-50">
                          <td colSpan={10} className="px-0 py-0">
                            <div className="px-6 py-4">
                              <FolderTree
                                caseId={row.id}
                                clientName={row.client}
                                isExpanded={true}
                                onToggle={() => setExpandedCaseId(null)} // 可以收合
                                onCaseDetailRefresh={(id) => {
                                  window.dispatchEvent(
                                    new CustomEvent("caseDetail:refresh", { detail: { caseId: id } })
                                  );
                                }}
                                s3Config={{
                                  endpoint: import.meta.env.VITE_SPACES_ENDPOINT || 'https://sgp1.digitaloceanspaces.com',
                                  accessKey: import.meta.env.VITE_SPACES_ACCESS_KEY || '',
                                  secretKey: import.meta.env.VITE_SPACES_SECRET_KEY || '',
                                  bucket: import.meta.env.VITE_SPACES_BUCKET || '',
                                  region: import.meta.env.VITE_SPACES_REGION || 'sgp1',
                                }}
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
                  <button
                    onClick={() => {
                      if (!selectedCase?.id) {
                        alert('案件 ID 不存在，無法編輯');
                        return;
                      }

                      const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
                      const normalizeDate = (v: any) =>
                        typeof v === 'string'
                          ? v.slice(0, 10)
                          : v instanceof Date
                          ? v.toISOString().slice(0, 10)
                          : '';

                      const formData = {
                        case_id: selectedCase.id,
                        case_number: toStr(selectedCase.caseNumber),
                        client: toStr(selectedCase.client),
                        case_type: toStr(selectedCase.caseType),
                        lawyer: toStr(selectedCase.lawyer),
                        legal_affairs: toStr(selectedCase.legalAffairs),
                        case_reason: toStr(selectedCase.caseReason),
                        opposing_party: toStr(selectedCase.opposingParty),
                        court: toStr(selectedCase.court),
                        division: toStr(selectedCase.division),
                        progress: toStr(selectedCase.progress),
                        progress_date: normalizeDate(selectedCase.progressDate),
                      };

                      setCaseFormMode('edit');
                      setEditingCase(formData);
                      setShowCaseForm(true);
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
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
                        const diffDays = Math.ceil(
                          (stageDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
                        );
                        if (stage.completed) return 'bg-green-500 text-white';
                        if (diffDays < 0) return 'bg-red-500 text-white';
                        if (diffDays <= 3) return 'bg-yellow-400 text-black';
                        return isCurrent ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white';
                      };

                      return (
                        <div
                          key={`${stage.name}-${stageIndex}`}
                          className="flex flex-col space-y-2 p-3 rounded-lg hover:bg-gray-50 group border border-gray-100 mb-2"
                        >
                          {/* 標題與操作區 */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div
                                className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${getStageColor(
                                  stage,
                                  isCurrent
                                )}`}
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
                                  onClick={() =>
                                    handleDeleteStage(stage.id, stage.name, stageIndex)
                                  }
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all p-1 rounded"
                                  title="刪除階段"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* ✅ 檔案清單區塊 */}
                          <div className="ml-4 mt-2 w-full">
                            {stage.files && stage.files.length > 0 ? (
                              <ul className="space-y-1">
                                {stage.files.map((f: any) => (
                                  <li
                                    key={f.id}
                                    className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-2 py-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-gray-600" />
                                      <span>{f.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handlePreview(f.id)}
                                        className="text-indigo-600 hover:underline text-xs flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" />
                                        預覽
                                      </button>
                                      <button
                                        onClick={() => handleDownload(f.id)}
                                        className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                      >
                                        <Download className="w-3 h-3" />
                                        下載
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-400">此階段尚無檔案</p>
                            )}
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


      {/* ✅ 新增：警告對話框 */}
      {warningDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">部分案件缺少「結案階段」</h3>
            <p className="text-sm text-gray-700 mb-4">
              以下案件沒有結案階段，確定要強制轉移嗎？
            </p>
            <ul className="text-sm text-red-600 mb-4 list-disc pl-5 space-y-1">
              {warningList.map((c) => (
                <li key={c.id}>
                  {c.caseNumber} - {c.client}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
                onClick={() => setWarningDialogOpen(false)}
              >
                取消
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                onClick={() => {
                  setWarningDialogOpen(false);
                  doTransferToClosed(selectedCaseIds); // ✅ 強制轉移
                }}
              >
                強制轉移
              </button>
            </div>
          </div>
        </div>
      )}


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
        onUploadComplete={async () => {
          setShowFileUpload(false);
          if (selectedCase) {
            window.dispatchEvent(new CustomEvent("folders:refresh", { detail: { caseId: selectedCase.id } }));
            window.dispatchEvent(new CustomEvent("caseDetail:refresh", { detail: { caseId: selectedCase.id } }));
          }

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

      {/* 撰寫文件對話框 */}
      <WriteDocument
        isOpen={showWriteDocument}
        onClose={() => {
          setShowWriteDocument(false);
          setWriteDocumentCaseId('');
          setWriteDocumentClientName('');
        }}
        caseId={writeDocumentCaseId}
        clientName={writeDocumentClientName}
      />

      <FilePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={previewFiles}
      />
    </div>
  );}
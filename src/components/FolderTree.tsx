// src/components/FolderTree.tsx
import React, { useState, useEffect } from 'react';
import FilePreviewDialog from './FilePreviewDialog';  // ✅ 新增 import
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, Trash2 } from 'lucide-react';
import { getFirmCodeOrThrow, hasAuthToken, clearLoginAndRedirect, apiFetch } from '../utils/api';


interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: FolderNode[];
  size?: number;
  modified?: string;
  folderType?: string;   // ← 方便除錯，非必須
}

interface FolderTreeProps {
  caseId: string;
  readOnly?: boolean;
  clientName: string;
  isExpanded: boolean;
  onToggle: () => void;
  onFileUpload?: (folderPath: string) => void;
  onFolderCreate?: (parentPath: string) => void;
  onDelete?: (path: string, type: 'folder' | 'file') => void;
  onCaseDetailRefresh?: (caseId: string) => void;
  s3Config?: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
  };
}

// 預設空的資料夾結構
const defaultFolderStructure: FolderNode = {
  id: 'root',
  name: '案件資料夾',
  type: 'folder',
  path: '/',
  children: []
};

const FolderTreeNode: React.FC<{
  node: FolderNode;
  level: number;
  onFileUpload?: (opts: { folderId?: string; folderPath: string }) => void;
  onFolderCreate?: (parentPath: string) => void;
  onDelete?: (path: string, type: 'folder' | 'file') => void;
  onPreview?: (fileId: string) => void;
  readOnly?: boolean;
}> = ({
  node,
  level,
  onFileUpload,
  onFolderCreate,
  onDelete,
  onPreview,
  readOnly = false
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showActions, setShowActions] = useState(false);

  const handleToggle = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // FolderTreeNode 裡
  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder' && onFileUpload) {
      onFileUpload({ folderId: node.id, folderPath: node.path }); // ✅ 傳 id
    }
  };

  const handleFolderCreateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder' && onFolderCreate) {
      onFolderCreate(node.path);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(node.path, node.type);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer rounded group ${
          level === 0 ? 'font-semibold' : ''
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => {
          console.log("👉 點擊節點:", node);  // <-- 檢查有沒有進來
          if (node.type === 'file' && onPreview) {
            console.log("👉 準備呼叫 onPreview, fileId:", node.id);
            onPreview(node.id);
          } else if (node.type === 'folder') {
            handleToggle();
          }
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* 展開/收合圖示 */}
        {node.type === 'folder' && node.children && node.children.length > 0 && (
          <div className="w-4 h-4 mr-1 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-600" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-600" />
            )}
          </div>
        )}

        {/* 資料夾/檔案圖示 */}
        <div className="w-4 h-4 mr-2 flex items-center justify-center">
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-600" />
            ) : (
              <Folder className="w-4 h-4 text-blue-600" />
            )
          ) : (
            <File className="w-4 h-4 text-gray-600" />
          )}
        </div>

        {/* 名稱 */}
        <span className="flex-1 text-sm text-gray-800 truncate">
          {node.name}
        </span>

        {/* 檔案資訊 */}
        {node.type === 'file' && (
          <div className="flex items-center space-x-2 text-xs text-gray-500 ml-2">
            {typeof node.size === 'number' && <span>{formatFileSize(node.size)}</span>}
            {node.modified && <span>{node.modified}</span>}
          </div>
        )}

        {/* 操作按鈕 */}
        {showActions && !readOnly && (
          <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.type === 'folder' && (
              <>
                <button
                  onClick={handleUploadClick}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="上傳檔案"
                >
                  <Plus className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={handleFolderCreateClick}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="新增資料夾"
                >
                  <Folder className="w-3 h-3 text-blue-600" />
                </button>
              </>
            )}
            <button
              onClick={handleDeleteClick}
              className="p-1 hover:bg-gray-200 rounded"
              title="刪除"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </button>
          </div>
        )}

      </div>

      {/* 子節點 */}
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onFileUpload={onFileUpload}
              onFolderCreate={onFolderCreate}
              onDelete={onDelete}
              onPreview={onPreview}
              readOnly={readOnly}   // ✅ 傳下去
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FolderTree({
  caseId,
  clientName,
  isExpanded,
  onToggle,
  onFileUpload,
  onFolderCreate,
  onDelete,
  onCaseDetailRefresh,   // ✅ 加這行
  s3Config,
  readOnly = false
}: FolderTreeProps) {
{
  const [folderData, setFolderData] = useState<FolderNode>(defaultFolderStructure);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  const handleOpenPreview = async (fileId: string) => {
    try {
      const firmCode = getFirmCodeOrThrow();
      console.log("👉 handleOpenPreview 被呼叫, fileId:", fileId);
      const res = await fetch(`/api/files/${fileId}/url?firm_code=${firmCode}`);
      console.log("👉 API 回應狀態:", res.status);
      const data = await res.json();
      console.log("👉 API 回應資料:", data);
      setSelectedFiles([data]);
      setPreviewOpen(true);
    } catch (err) {
      console.error("讀取檔案失敗", err);
    }
  };

  // 從 API 載入真實的資料夾結構
  useEffect(() => {
    if (isExpanded) {
      // 檢查登入狀態後再載入
      if (hasAuthToken()) {
        loadFolderStructure();
      } else {
        console.warn('登入狀態不完整，顯示預設資料夾');
        // 設定預設資料夾結構
        setFolderData({
          id: 'root',
          name: '案件資料夾',
          type: 'folder',
          path: '/',
          children: [
            { id: 'pleadings', name: '狀紙', type: 'folder', path: '/狀紙', children: [] },
            { id: 'info', name: '案件資訊', type: 'folder', path: '/案件資訊', children: [] },
            { id: 'progress', name: '案件進度', type: 'folder', path: '/案件進度', children: [] }
          ]
        });
      }
    }
  }, [caseId, isExpanded]);

  // 🔔 監聽外部事件：刪除階段後刷新資料夾
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.caseId === caseId) {
        loadFolderStructure(); // 重新抓最新結構
      }
    };
    window.addEventListener('folders:refresh', handler);
    return () => window.removeEventListener('folders:refresh', handler);
  }, [caseId]);

  const loadFolderStructure = async () => {
    // 再次檢查登入狀態
    if (!hasAuthToken()) {
      console.warn('登入狀態不完整，無法載入資料夾');
      return;
    }

    try {
      let firmCode;
      try {
        firmCode = getFirmCodeOrThrow();
      } catch (error) {
        console.warn('找不到事務所代碼，使用預設資料夾結構');
        setFolderData({
          id: 'root',
          name: '案件資料夾',
          type: 'folder',
          path: '/',
          children: [
            { id: 'pleadings', name: '狀紙', type: 'folder', path: '/狀紙', children: [] },
            { id: 'info', name: '案件資訊', type: 'folder', path: '/案件資訊', children: [] },
            { id: 'progress', name: '案件進度', type: 'folder', path: '/案件進度', children: [] }
          ]
        });
        return;
      }

      const response = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);

      console.log('API 回應狀態:', response.status, response.statusText);

      if (response.ok) {
        const responseText = await response.text();
        console.log('API 原始回應:', responseText);

        let filesData: any;
        try {
          filesData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('解析 API 回應失敗:', parseError);
          // 設定預設資料夾結構
          setFolderData({
            id: 'root',
            name: '案件資料夾',
            type: 'folder',
            path: '/',
            children: [
              { id: 'pleadings', name: '狀紙', type: 'folder', path: '/狀紙', children: [] },
              { id: 'info', name: '案件資訊', type: 'folder', path: '/案件資訊', children: [] },
              { id: 'progress', name: '案件進度', type: 'folder', path: '/案件進度', children: [] }
            ]
          });
          return;
        }

        console.log('解析後的檔案資料:', filesData);

        // 轉換檔案列表為樹狀結構
        const treeData = buildFolderTree(filesData);
        setFolderData(treeData);
      } else {
        const errorText = await response.text();
        console.error('載入檔案列表失敗:', response.status, errorText);

        // 如果是 401 或 403 錯誤，可能是登入狀態問題
        if (response.status === 401 || response.status === 403) {
          console.warn('可能是登入狀態過期，設定預設資料夾');
        }

        // 設定預設資料夾結構
        setFolderData({
          id: 'root',
          name: '案件資料夾',
          type: 'folder',
          path: '/',
          children: [
            { id: 'pleadings', name: '狀紙', type: 'folder', path: '/狀紙', children: [] },
            { id: 'info', name: '案件資訊', type: 'folder', path: '/案件資訊', children: [] },
            { id: 'progress', name: '案件進度', type: 'folder', path: '/案件進度', children: [] }
          ]
        });
      }
    } catch (error) {
      console.error('載入資料夾結構失敗:', error);

      // 設定預設資料夾結構作為備援
      setFolderData({
        id: 'root',
        name: '案件資料夾',
        type: 'folder',
        path: '/',
        children: [
          { id: 'pleadings', name: '狀紙', type: 'folder', path: '/狀紙', children: [] },
          { id: 'info', name: '案件資訊', type: 'folder', path: '/案件資訊', children: [] },
          { id: 'progress', name: '案件進度', type: 'folder', path: '/案件進度', children: [] }
        ]
      });
    }
  };

  const buildFolderTree = (filesData: any): FolderNode => {
    const rootNode: FolderNode = {
      id: 'root',
      name: '案件資料夾',
      type: 'folder',
      path: '/',
      children: []
    };

    const folderMap: Record<string, FolderNode> = {};

    // 1) 先把所有資料夾實體化
    if (Array.isArray(filesData.folders)) {
      filesData.folders.forEach((f: any) => {
        folderMap[f.id] = {
          id: f.id,
          name: f.folder_name,
          type: 'folder',
          path: f.folder_path,
          children: [],
          folderType: f.folder_type,
        };
      });

      // 2) 依 parent_id 掛樹；沒有 parent_id 的就掛在 root
      filesData.folders.forEach((f: any) => {
        const node = folderMap[f.id];
        if (f.parent_id && folderMap[f.parent_id]) {
          (folderMap[f.parent_id].children ||= []).push(node);
        } else {
          rootNode.children!.push(node);
        }
      });
    }

    // 3) 檔案一律依 folder_id 掛到對應資料夾（含 stage/pleadings/info/progress）
    const attachByFolderId = (file: any) => {
      const parent = file.folder_id && folderMap[file.folder_id];
      if (!parent) return;
      parent.children!.push({
        id: file.id,
        name: file.name,
        type: 'file',
        path: `${parent.path}/${file.name}`,
        size: file.size_bytes,
        modified: file.created_at,
      });
    };

    ['pleadings', 'info', 'progress', 'stage'].forEach((key) => {
      const arr = filesData[key];
      if (Array.isArray(arr)) arr.forEach(attachByFolderId);
    });

    return rootNode;
  };

  // 單檔上傳
  const uploadFileToS3 = async (file: File, folderPath: string, folderId?: string) => {
    // 檢查登入狀態
    if (!hasAuthToken()) throw new Error('登入狀態已過期，請重新登入');

    let firmCode: string;
    try {
      firmCode = getFirmCodeOrThrow();
    } catch {
      throw new Error('找不到事務所代碼，請重新登入');
    }

    // 從路徑推導資料夾名稱（僅用於 log/除錯）
    let folderName = '';
    if (folderPath.includes('/')) {
      const parts = folderPath.split('/').filter(Boolean);
      folderName = parts[parts.length - 1] || parts[0] || '';
    } else {
      folderName = folderPath;
    }

    if (!folderId) {
      console.error('❌ 缺少 folder_id，檔案無法上傳');
      throw new Error('缺少 folder_id，請先選擇一個資料夾再上傳檔案');
    }

    try {
      // 直接 POST 檔案與 folder_id（與 FileUploadDialog 完全一致）
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_id', folderId);

      const res = await apiFetch(
        `/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        const text = await res.text();
        let msg = '檔案上傳失敗';
        try {
          const obj = JSON.parse(text);
          msg = obj.detail || msg;
        } catch {
          msg = `${msg}: ${res.status} ${text.slice(0, 100)}`;
        }
        throw new Error(msg);
      }

      const result = await res.json();
      console.log(`✅ 檔案 ${file.name} 上傳成功:`, result);
      return result;

    } catch (error: any) {
      console.error(`檔案 ${file.name} 上傳失敗:`, error);
      alert(`檔案 ${file.name} 上傳失敗: ${error?.message || error}`);
    }
  };

  // 由當前樹搜尋 path 對應的節點
  const findNodeByPath = (root: FolderNode, targetPath: string): FolderNode | null => {
    if (root.path === targetPath) return root;
    if (root.children) {
      for (const c of root.children) {
        const r = findNodeByPath(c, targetPath);
        if (r) return r;
      }
    }
    return null;
  };

  // 檔案挑選器（多檔）＋逐一上傳
  const handleFileUpload = (opts: { folderId?: string; folderPath: string }) => {
    const { folderId, folderPath } = opts;

    // 檢查登入狀態
    if (!hasAuthToken()) {
      alert('請先登入系統');
      clearLoginAndRedirect();
      return;
    }

    if (!s3Config) {
      console.warn('S3 設定未提供，但仍允許上傳（由後端處理）');
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          await uploadFileToS3(files[i], folderPath, folderId);
        }
        // 上傳後重新載入資料夾
        if (hasAuthToken()) {
          await loadFolderStructure();

          // ✅ 通知 CaseOverview 刷新右側詳情
          window.dispatchEvent(new CustomEvent("caseDetail:refresh", {
            detail: { caseId }
          }));
        }
      }
    };
    input.click();

    if (onFileUpload) {
      onFileUpload(folderPath);
    }
  };

  const handleFolderCreate = async (parentPath: string) => {
    const folderName = prompt('請輸入資料夾名稱（可中文）：')?.trim();
    if (!folderName) return;

    try {
      const firmCode = getFirmCodeOrThrow();
      const parentNode = findNodeByPath(folderData, parentPath);
      const parentId = parentNode?.id ?? null;

      const payload: any = {
        folder_name: folderName,
        folder_type: 'custom',
        parent_id: parentId || undefined, // 沒有就不帶
      };

      const res = await apiFetch(
        `/api/cases/${caseId}/folders?firm_code=${encodeURIComponent(firmCode)}`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      if (!res.ok) throw new Error((await res.json()).detail || '建立資料夾失敗');

      // 重新抓樹
      await loadFolderStructure();

      // 通知右側詳情一起刷新
      window.dispatchEvent(new CustomEvent('caseDetail:refresh', { detail: { caseId } }));
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '建立資料夾失敗');
    }
  };


  const handleDelete = async (path: string, type: 'folder' | 'file') => {
    const node = findNodeByPath(folderData, path);

    if (type === 'file') {
      if (!confirm(`確定要刪除檔案「${path}」嗎？`)) return;
      await deleteFile(path);
      await loadFolderStructure();
      return;
    }

    // 僅支援刪除「階段」類型的資料夾（會連動刪階段）
    if (!node || node.type !== 'folder') return;
    if (node.folderType !== 'stage') {
      alert('目前僅支援刪除「階段」資料夾；預設資料夾與自訂資料夾先保留。');
      return;
    }

    try {
      const firmCode = getFirmCodeOrThrow();

      // 1) 先抓案件的所有階段，找名稱對應（FolderTree 的 stage folder_name = stage_name）
      const stagesResp = await apiFetch(`/api/cases/${caseId}/stages?firm_code=${encodeURIComponent(firmCode)}`);
      if (!stagesResp.ok) throw new Error('無法取得階段列表');
      const stages = await stagesResp.json();
      const target = (stages || []).find((s: any) => s.stage_name === node.name);
      if (!target?.id) throw new Error('找不到對應的階段（名稱可能不一致）');

      // 2) 檢查該階段資料夾是否有檔案
      const cntResp = await apiFetch(
        `/api/cases/${caseId}/stages/${target.id}/files/count?firm_code=${encodeURIComponent(firmCode)}`
      );
      const { count } = await cntResp.json();

      // 3) 二次確認
      const ok = confirm(
        count > 0
          ? `階段「${node.name}」底下有 ${count} 個檔案，確定要刪除？（會一併刪除此階段與該資料夾）`
          : `確定要刪除階段「${node.name}」？（會一併刪除此階段與資料夾）`
      );
      if (!ok) return;

      // 4) 刪除階段（後端會連動刪該階段資料夾）
      const del = await apiFetch(
        `/api/cases/${caseId}/stages/${target.id}?firm_code=${encodeURIComponent(firmCode)}`,
        { method: 'DELETE' }
      );
      if (!del.ok) throw new Error((await del.json()).detail || '刪除階段失敗');

      await loadFolderStructure();
      // 一併通知右側詳情刷新
      window.dispatchEvent(new CustomEvent('caseDetail:refresh', { detail: { caseId } }));
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '刪除階段失敗');
    }
  };


  // 刪除檔案的實現
  const deleteFile = async (filePath: string) => {
    try {
      // 從路徑中提取檔案名稱，找到對應的檔案 ID
      const fileName = filePath.split('/').pop();
      if (!fileName) {
        alert('無法識別檔案名稱');
        return;
      }

      // 從當前的資料夾結構中找到檔案 ID
      const fileId = await findFileIdByPath(filePath);
      if (!fileId) {
        alert('找不到檔案 ID，無法刪除');
        return;
      }

      const firmCode = getFirmCodeOrThrow();
      const response = await apiFetch(
        `/api/files/${fileId}?firm_code=${encodeURIComponent(firmCode)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        alert('檔案刪除成功');
        // ✅ 左邊資料夾樹刷新
        await loadFolderStructure();

        // ✅ 右邊案件詳情同步刷新
        window.dispatchEvent(
          new CustomEvent("caseDetail:refresh", { detail: { caseId } })
        );
        onCaseDetailRefresh?.(caseId);
      } else {
        const errorText = await response.text();
        console.error('刪除檔案失敗:', errorText);
        alert('刪除檔案失敗');
      }
    } catch (error) {
      console.error('刪除檔案錯誤:', error);
      alert('刪除檔案時發生錯誤');
    }
  };


  // 根據檔案路徑找到檔案 ID
  const findFileIdByPath = async (filePath: string, folderId?: string): Promise<string | null> => {
    try {
      const firmCode = getFirmCodeOrThrow();
      const response = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);

      if (!response.ok) return null;

      const filesData = await response.json();

      const allFiles: any[] = [];
      if (filesData.pleadings) allFiles.push(...filesData.pleadings);
      if (filesData.info) allFiles.push(...filesData.info);
      if (filesData.progress) allFiles.push(...filesData.progress);
      if (filesData.stage) allFiles.push(...filesData.stage); // ✅ stage 檔案

      const fileName = filePath.split('/').pop();

      const file = allFiles.find(f =>
        f.name === fileName && (!folderId || f.folder_id === folderId)
      );

      return file ? file.id : null;
    } catch (error) {
      console.error('查找檔案 ID 失敗:', error);
      return null;
    }
  };

  if (!isExpanded) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-full">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <h4 className="font-medium text-gray-800 text-sm lg:text-base truncate">案件資料夾</h4>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700 p-1 lg:p-0"
        >
          <ChevronDown className="w-4 h-4 lg:w-5 lg:h-5" />
        </button>
      </div>
      <div className="p-2 max-h-64 lg:max-h-96 overflow-y-auto">
        <FolderTreeNode
          node={folderData}
          level={0}
          onFileUpload={handleFileUpload}
          onFolderCreate={handleFolderCreate}
          onDelete={handleDelete}
          onPreview={handleOpenPreview}
          readOnly={readOnly}   // ✅ 傳給子節點
        />
      </div>

      <FilePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={selectedFiles}
      />
    </div>
  );
}}
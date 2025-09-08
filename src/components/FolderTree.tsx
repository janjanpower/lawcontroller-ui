import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, Trash2 } from 'lucide-react';
import { FolderManager } from '../utils/folderManager';

interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: FolderNode[];
  size?: number;
  modified?: string;
}

interface FolderTreeProps {
  caseId: string;
  clientName: string;
  isExpanded: boolean;
  onToggle: () => void;
  onFileUpload?: (folderPath: string) => void;
  onFolderCreate?: (parentPath: string) => void;
  onDelete?: (path: string, type: 'folder' | 'file') => void;
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
  onFileUpload?: (folderPath: string) => void;
  onFolderCreate?: (parentPath: string) => void;
  onDelete?: (path: string, type: 'folder' | 'file') => void;
}> = ({ node, level, onFileUpload, onFolderCreate, onDelete }) => {
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

  const handleFileUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder' && onFileUpload) {
      onFileUpload(node.path);
    }
  };

  const handleFolderCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder' && onFolderCreate) {
      onFolderCreate(node.path);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
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
        onClick={handleToggle}
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
            {node.size && <span>{formatFileSize(node.size)}</span>}
            {node.modified && <span>{node.modified}</span>}
          </div>
        )}

        {/* 操作按鈕 */}
        {showActions && (
          <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.type === 'folder' && (
              <>
                <button
                  onClick={handleFileUpload}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="上傳檔案"
                >
                  <Plus className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={handleFolderCreate}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="新增資料夾"
                >
                  <Folder className="w-3 h-3 text-blue-600" />
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
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
  s3Config
}: FolderTreeProps) {
  const [folderData, setFolderData] = useState<FolderNode>(defaultFolderStructure);

  // 從 API 載入真實的資料夾結構
  useEffect(() => {
    if (isExpanded && s3Config) {
      loadFolderStructure();
    }
  }, [caseId, isExpanded]);

  const loadFolderStructure = async () => {
    try {
      const firmCode = localStorage.getItem('law_firm_code');
      if (!firmCode) {
        console.error('找不到事務所代碼');
        return;
      }

      const response = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);

      console.log('API 回應狀態:', response.status, response.statusText);

      if (response.ok) {
        const responseText = await response.text();
        console.log('API 原始回應:', responseText);

        let filesData;
        try {
          filesData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('解析 API 回應失敗:', parseError);
          return;
        }

        console.log('解析後的檔案資料:', filesData);

        // 轉換檔案列表為樹狀結構
        const treeData = buildFolderTree(filesData);
        setFolderData(treeData);
      } else {
        const errorText = await response.text();
        console.error('載入檔案列表失敗:', response.status, errorText);
      }
    } catch (error) {
      console.error('載入資料夾結構失敗:', error);
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

    console.log('開始建構資料夾樹，filesData 類型:', typeof filesData, Array.isArray(filesData));

    // 處理 API 回傳的資料
    if (typeof filesData === 'object' && !Array.isArray(filesData)) {
      // 檢查是否有 folders 資訊
      if (filesData.folders && Array.isArray(filesData.folders)) {
        console.log('找到資料夾資訊:', filesData.folders);

        // 建立資料夾結構
        rootNode.children = filesData.folders.map((folder: any) => ({
          id: folder.id,
          name: folder.folder_name,
          type: 'folder' as const,
          path: folder.folder_path,
          children: []
        }));
      } else {
        // 如果沒有 folders 資訊，建立預設資料夾
        rootNode.children = [
          {
            id: 'pleadings',
            name: '狀紙',
            type: 'folder' as const,
            path: '/狀紙',
            children: []
          },
          {
            id: 'info',
            name: '案件資訊',
            type: 'folder' as const,
            path: '/案件資訊',
            children: []
          },
          {
            id: 'progress',
            name: '案件進度',
            type: 'folder' as const,
            path: '/案件進度',
            children: []
          }
        ];
      }

      // 處理檔案資料：{ pleadings: [...], info: [...], progress: [...] }
      const folderMapping: Record<string, string> = {
        'pleadings': '狀紙',
        'info': '案件資訊',
        'progress': '案件進度'
      };

      Object.entries(filesData).forEach(([folderType, files]) => {
        if (folderType === 'folders') return; // 跳過 folders 欄位

        const folderName = folderMapping[folderType];
        if (folderName && Array.isArray(files)) {
          console.log(`處理 ${folderType} 資料夾，檔案數量:`, files.length);

          const targetFolder = rootNode.children?.find(f => f.name === folderName);
          if (targetFolder) {
            files.forEach((file: any) => {
              const fileNode: FolderNode = {
                id: file.id,
                name: file.name,
                type: 'file',
                path: `${targetFolder.path}/${file.name}`,
                size: file.size_bytes,
                modified: file.created_at
              };
              if (!targetFolder.children) targetFolder.children = [];
              targetFolder.children.push(fileNode);
            });
          } else {
            console.warn(`找不到對應的資料夾: ${folderName}`);
          }
        }
      });
    } else if (Array.isArray(filesData)) {
      // 舊版 API 回傳格式：檔案陣列
      console.log('處理陣列格式的檔案資料，數量:', filesData.length);

      // 建立預設資料夾
      rootNode.children = [
        {
          id: 'pleadings',
          name: '狀紙',
          type: 'folder' as const,
          path: '/狀紙',
          children: []
        },
        {
          id: 'info',
          name: '案件資訊',
          type: 'folder' as const,
          path: '/案件資訊',
          children: []
        },
        {
          id: 'progress',
          name: '案件進度',
          type: 'folder' as const,
          path: '/案件進度',
          children: []
        }
      ];

      filesData.forEach(file => {
        const fileNode: FolderNode = {
          id: file.id,
          name: file.name,
          type: 'file',
          path: file.path || `/${file.name}`,
          size: file.size_bytes,
          modified: file.created_at
        };

        // 預設放在第一個資料夾
        if (rootNode.children && rootNode.children[0]) {
          if (!rootNode.children[0].children) rootNode.children[0].children = [];
          rootNode.children[0].children.push(fileNode);
        }
      });
    } else {
      console.log('未知的檔案資料格式，建立預設資料夾');

      // 建立預設資料夾結構
      rootNode.children = [
        {
          id: 'pleadings',
          name: '狀紙',
          type: 'folder' as const,
          path: '/狀紙',
          children: []
        },
        {
          id: 'info',
          name: '案件資訊',
          type: 'folder' as const,
          path: '/案件資訊',
          children: []
        },
        {
          id: 'progress',
          name: '案件進度',
          type: 'folder' as const,
          path: '/案件進度',
          children: []
        }
      ];
    }

    console.log('最終建構的資料夾樹:', rootNode);
    return rootNode;
  };

  const uploadFileToS3 = async (file: File, folderPath: string) => {
    try {
      const firmCode = localStorage.getItem('law_firm_code');
      if (!firmCode) {
        throw new Error('找不到事務所代碼');
      }

      // 將資料夾路徑轉換為 folder_type
      const folderTypeMapping: Record<string, string> = {
        '/狀紙': 'pleadings',
        '/案件資訊': 'info',
        '/案件進度': 'progress'
      };

      const folderType = Object.keys(folderTypeMapping).find(key =>
        folderPath.includes(key)
      );

      const mappedType = folderType ? folderTypeMapping[folderType] : 'progress';

      console.log('資料夾路徑對應:', { folderPath, folderType, mappedType });

  const handleFileUpload = (folderPath: string) => {
    if (!s3Config) {
      alert('S3 設定未提供，無法上傳檔案');
      return;
    }

    // 建立檔案選擇器
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          await uploadFileToS3(files[i], folderPath);
        }
        // 重新載入資料夾結構
        loadFolderStructure();
      }
    };
    input.click();

    if (onFileUpload) {
      onFileUpload(folderPath);
    }
  };

      const finalFolderType = mappedType ?? folderType;

      // 建立 FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_type', finalFolderType);

      console.log('準備上傳檔案:', {
        fileName: file.name,
        folderPath,
        folderType,
        caseId
      });

      // 直接上傳檔案
      const uploadResponse = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`, {
        method: 'POST',
        body: formData
      });

      console.log('上傳回應狀態:', uploadResponse.status, uploadResponse.statusText);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('上傳失敗回應:', errorText);

        let errorMessage = '檔案上傳失敗';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `上傳失敗: ${uploadResponse.status} ${errorText.substring(0, 100)}`;
        }

        throw new Error(errorMessage);
      }

      const result = await uploadResponse.json();
      console.log(`檔案 ${file.name} 上傳成功:`, result);

    } catch (error) {
      console.error(`檔案 ${file.name} 上傳失敗:`, error);
      alert(`檔案 ${file.name} 上傳失敗: ${error.message || error}`);
    }
  };

  const handleFolderCreate = (parentPath: string) => {
    const folderName = prompt('請輸入資料夾名稱:');
    if (folderName) {
      console.log(`在 ${parentPath} 建立資料夾: ${folderName}`);
      if (onFolderCreate) {
        onFolderCreate(parentPath);
      }
      // TODO: 實現資料夾建立邏輯
    }
  };

  const handleDelete = (path: string, type: 'folder' | 'file') => {
    const confirmMessage = type === 'folder'
      ? `確定要刪除資料夾「${path}」及其所有內容嗎？`
      : `確定要刪除檔案「${path}」嗎？`;

    if (confirm(confirmMessage)) {
      console.log(`刪除 ${type}: ${path}`);
      if (onDelete) {
        onDelete(path, type);
      }
      // 這裡可以實現刪除邏輯
    }
  };

  if (!isExpanded) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-full">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <h4 className="font-medium text-gray-800 text-sm lg:text-base truncate">
          {caseId}_{clientName} 資料夾
        </h4>
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
        />
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Plus, Trash2 } from 'lucide-react';

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
  }, [caseId]);

  const loadFolderStructure = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/files`);
      if (response.ok) {
        const files = await response.json();
        // 轉換檔案列表為樹狀結構
        const treeData = buildFolderTree(files);
        setFolderData(treeData);
      }
    } catch (error) {
      console.error('載入資料夾結構失敗:', error);
    }
  };

  const buildFolderTree = (files: any[]): FolderNode => {
    // 建立基本的資料夾結構
    const rootNode: FolderNode = {
      id: 'root',
      name: '案件資料夾',
      type: 'folder',
      path: '/',
      children: [
        {
          id: 'pleadings',
          name: '狀紙',
          type: 'folder',
          path: '/狀紙',
          children: []
        },
        {
          id: 'evidence',
          name: '證據',
          type: 'folder',
          path: '/證據',
          children: []
        },
        {
          id: 'correspondence',
          name: '往來函件',
          type: 'folder',
          path: '/往來函件',
          children: []
        }
      ]
    };

    // 將檔案加入對應的資料夾
    files.forEach(file => {
      const fileNode: FolderNode = {
        id: file.id,
        name: file.name,
        type: 'file',
        path: file.path || `/${file.name}`,
        size: file.size_bytes,
        modified: file.created_at
      };

      // 根據檔案路徑決定放在哪個資料夾
      // 這裡可以根據實際需求調整邏輯
      if (rootNode.children && rootNode.children[0].children) {
        rootNode.children[0].children.push(fileNode);
      }
    });

    return rootNode;
  };

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

  const uploadFileToS3 = async (file: File, folderPath: string) => {
    try {
      // 1. 取得預簽名 URL
      const presignResponse = await fetch(`/api/cases/${caseId}/files/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          folder_slug: folderPath.replace('/', ''),
          content_type: file.type
        })
      });

      if (!presignResponse.ok) {
        throw new Error('取得上傳 URL 失敗');
      }

      const presignData = await presignResponse.json();

      // 2. 上傳檔案到 S3
      const uploadResponse = await fetch(presignData.upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('檔案上傳失敗');
      }

      // 3. 確認上傳
      const confirmResponse = await fetch('/api/files/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: presignData.key
        })
      });

      if (confirmResponse.ok) {
        console.log(`檔案 ${file.name} 上傳成功`);
      }

    } catch (error) {
      console.error(`檔案 ${file.name} 上傳失敗:`, error);
      alert(`檔案 ${file.name} 上傳失敗: ${error.message}`);
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
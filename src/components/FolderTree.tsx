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
}

// 模擬資料夾結構
const mockFolderStructure: FolderNode = {
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
      children: [
        {
          id: 'complaint',
          name: '起訴狀.pdf',
          type: 'file',
          path: '/狀紙/起訴狀.pdf',
          size: 1024000,
          modified: '2024-01-15'
        },
        {
          id: 'response',
          name: '答辯狀.pdf',
          type: 'file',
          path: '/狀紙/答辯狀.pdf',
          size: 856000,
          modified: '2024-01-20'
        }
      ]
    },
    {
      id: 'case-info',
      name: '案件資訊',
      type: 'folder',
      path: '/案件資訊',
      children: [
        {
          id: 'case-excel',
          name: '案件資訊.xlsx',
          type: 'file',
          path: '/案件資訊/案件資訊.xlsx',
          size: 45000,
          modified: '2024-01-10'
        }
      ]
    },
    {
      id: 'progress',
      name: '進度追蹤',
      type: 'folder',
      path: '/進度追蹤',
      children: [
        {
          id: 'appointment',
          name: '委任',
          type: 'folder',
          path: '/進度追蹤/委任',
          children: [
            {
              id: 'contract',
              name: '委任契約書.pdf',
              type: 'file',
              path: '/進度追蹤/委任/委任契約書.pdf',
              size: 234000,
              modified: '2024-01-05'
            }
          ]
        },
        {
          id: 'filing',
          name: '起訴',
          type: 'folder',
          path: '/進度追蹤/起訴',
          children: []
        },
        {
          id: 'hearing',
          name: '開庭',
          type: 'folder',
          path: '/進度追蹤/開庭',
          children: [
            {
              id: 'court-record',
              name: '開庭筆錄.pdf',
              type: 'file',
              path: '/進度追蹤/開庭/開庭筆錄.pdf',
              size: 567000,
              modified: '2024-02-01'
            }
          ]
        }
      ]
    }
  ]
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
  onDelete
}: FolderTreeProps) {
  const [folderData, setFolderData] = useState<FolderNode>(mockFolderStructure);

  const handleFileUpload = (folderPath: string) => {
    console.log(`上傳檔案到: ${folderPath}`);
    if (onFileUpload) {
      onFileUpload(folderPath);
    }
    // 這裡可以實現檔案上傳邏輯
  };

  const handleFolderCreate = (parentPath: string) => {
    const folderName = prompt('請輸入資料夾名稱:');
    if (folderName) {
      console.log(`在 ${parentPath} 建立資料夾: ${folderName}`);
      if (onFolderCreate) {
        onFolderCreate(parentPath);
      }
      // 這裡可以實現資料夾建立邏輯
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
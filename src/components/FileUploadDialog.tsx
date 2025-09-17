import React, { useState, useRef, useMemo, useEffect } from 'react';
import { X, Upload, AlertCircle, Folder } from 'lucide-react';
import { getFirmCodeOrThrow } from '../utils/api';

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  selectedCaseIds: string[];
  cases: Array<{ id: string; client: string; caseNumber: string }>;
}

type AvFolder = { name: string; path: string };

export default function FileUploadDialog({
  isOpen,
  onClose,
  onUploadComplete,
  selectedCaseIds,
  cases
}: FileUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [availableFolders, setAvailableFolders] = useState<AvFolder[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCaseWarning, setShowCaseWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uniqByNamePath = (items: AvFolder[]) =>
    Array.from(new Map(items.map(i => [`${i.name}::${i.path}`, i])).values());

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  // ✅ 改為從後端 API 取得資料夾
  const handleCaseSelect = async (caseId: string) => {
    setSelectedCase(caseId);
    setSelectedFolder('');

    try {
      const firmCode = getFirmCodeOrThrow();
      const res = await fetch(`/api/cases/${caseId}/files?firm_code=${encodeURIComponent(firmCode)}`);
      if (!res.ok) throw new Error("讀取資料夾失敗");
      const data = await res.json();

      const folders = (data.folders || [])
        .filter((f: any) => f.folder_name !== '進度追蹤') // 🚫 過濾掉不要的資料夾
        .map((f: any) => ({
          name: f.folder_name,
          path: f.folder_path
        }));

      setAvailableFolders(uniqByNamePath(folders));
    } catch (err) {
      console.error("讀取案件資料夾失敗", err);
      setAvailableFolders([]);
    }
  };

  const selectedCaseData = useMemo(
    () => cases.find(c => c.id === selectedCase),
    [cases, selectedCase]
  );

  // ✅ 監聽 folders:refresh → 即時更新
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.caseId === selectedCase) {
        handleCaseSelect(selectedCase);
      }
    };
    window.addEventListener('folders:refresh', handler);
    return () => window.removeEventListener('folders:refresh', handler);
  }, [selectedCase]);

  const handleUpload = async () => {
    if (selectedCaseIds.length === 0) { setShowCaseWarning(true); return; }
    if (!selectedCase) { alert('請選擇要上傳的案件'); return; }
    if (!selectedFolder) { alert('請選擇要存放的資料夾'); return; }
    if (selectedFiles.length === 0) { alert('請選擇要上傳的檔案'); return; }

    setIsUploading(true);
    try {
      let firmCode;
      try {
        firmCode = getFirmCodeOrThrow();
      } catch (error) {
        alert('找不到事務所代碼，請重新登入');
        return;
      }

      const folder = availableFolders.find(f => f.path === selectedFolder);
      if (!folder) throw new Error('找不到指定的資料夾');

      for (const file of selectedFiles) {
        const form = new FormData();
        form.append('file', file);

        const headers: Record<string, string> = {};
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/cases/${selectedCase}/files?firm_code=${encodeURIComponent(firmCode)}`,
          { method: 'POST', body: form, headers }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `上傳 ${file.name} 失敗`);
        }
      }

      alert(`成功上傳 ${selectedFiles.length} 個檔案`);
      onUploadComplete();
      handleClose();
    } catch (err: any) {
      console.error('檔案上傳失敗:', err);
      alert(`上傳失敗：${err?.message || '請稍後再試'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleClose = () => {
    setSelectedFiles([]);
    setSelectedCase('');
    setSelectedFolder('');
    setAvailableFolders([]);
    setIsUploading(false);
    setShowCaseWarning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <Upload className="w-5 h-5 mr-2" /> 上傳檔案
          </h2>
          <button onClick={handleClose} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 案件選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇案件 <span className="text-red-500">*</span>
            </label>
            {selectedCaseIds.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">請先在案件列表中勾選要上傳檔案的案件</span>
                </div>
              </div>
            ) : (
              <select
                value={selectedCase}
                onChange={(e) => handleCaseSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
              >
                <option value="">請選擇案件</option>
                {selectedCaseIds.map(caseId => {
                  const c = cases.find(x => x.id === caseId);
                  if (!c) return null; // 🚫 過濾掉沒有對應資料的 caseId
                  return (
                    <option key={caseId} value={caseId}>
                      {`${c.client || '未命名當事人'}${c.caseNumber ? ` - ${c.caseNumber}` : ''}`}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* 資料夾選擇 */}
          {selectedCase && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                選擇存放資料夾 <span className="text-red-500">*</span>
              </label>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                <div className="text-sm text-blue-800">
                  案件：{selectedCaseData?.client} - {selectedCaseData?.caseNumber}
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {availableFolders.map(f => (
                  <label key={f.path} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="folder"
                      value={f.path}
                      checked={selectedFolder === f.path}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="mr-3"
                    />
                    <Folder className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-sm">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 檔案選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇檔案 <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    已選擇 {selectedFiles.length} 個檔案：
                  </p>
                  <div className="max-h-24 overflow-y-auto">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 mb-1">
                        <span className="truncate">{file.name}</span>
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-2">點擊選擇檔案或拖拽檔案到此處</p>
              )}
              <button
                type="button"
                onClick={handleBrowseClick}
                className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors text-sm"
              >
                瀏覽檔案
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
            </div>
          </div>

          {/* 按鈕 */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isUploading}
            >取消</button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedCase || !selectedFolder || selectedFiles.length === 0 || isUploading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isUploading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>上傳中...</>)
               : '開始上傳'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

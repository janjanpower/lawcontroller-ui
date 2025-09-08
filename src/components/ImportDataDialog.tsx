import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  selectedCaseIds?: string[];
}

interface AnalysisResult {
  success: boolean;
  message: string;
  civilCount?: number;
  criminalCount?: number;
  unknownCount?: number;
}

export default function ImportDataDialog({ isOpen, onClose, onImportComplete, selectedCaseIds = [] }: ImportDataDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCaseWarning, setShowCaseWarning] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };


  const handleImport = async () => {
    if (!selectedFile) return;
    
    if (selectedCaseIds.length === 0) {
      setShowCaseWarning(true);
      return;
    }
    
    if (!selectedFolder) {
      alert('請選擇要存放的資料夾');
      return;
    }

    setIsImporting(true);

    try {
      // TODO: 實現真實的檔案上傳 API 呼叫
      console.log('上傳檔案:', {
        file: selectedFile.name,
        cases: selectedCaseIds,
        folder: selectedFolder
      });
      alert(`檔案 ${selectedFile.name} 已上傳到 ${selectedFolder} 資料夾`);
      onImportComplete();
      handleClose();
    } catch {
      alert('上傳失敗，請稍後再試');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setSelectedFolder('');
    setIsImporting(false);
    setShowCaseWarning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            上傳檔案
          </h2>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6">
          {/* 說明文字 */}
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium text-blue-900 mb-2">檔案上傳功能說明：</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 請先勾選要上傳檔案的案件</li>
                <li>• 選擇要存放的資料夾位置</li>
                <li>• 支援各種檔案格式</li>
              </ul>
            </div>
          </div>

          {/* 檔案選擇區域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇檔案：
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />

              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    已選擇：{selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    檔案大小：{(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    點擊選擇檔案或拖拽檔案到此處
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleBrowseClick}
                className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors text-sm"
              >
                瀏覽檔案
              </button>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* 資料夾選擇 */}
          {selectedFile && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇存放資料夾：</label>
              <div className="space-y-2">
                {['狀紙', '案件資訊', '案件進度'].map(folder => (
                  <label key={folder} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="folder"
                      value={folder}
                      checked={selectedFolder === folder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{folder}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 按鈕區域 */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isAnalyzing || isImporting}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!selectedFile || isImporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isImporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  上傳中...
                </>
              ) : (
                '開始上傳'
              )}
            </button>
          </div>
        </div>
        
        {/* 案件選擇警告對話框 */}
        {showCaseWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">提醒</h3>
              <p className="text-sm text-gray-600 mb-4">
                請先在案件列表中勾選要上傳檔案的案件
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowCaseWarning(false)}
                  className="px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d]"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

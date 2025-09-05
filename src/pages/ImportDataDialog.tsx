import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface AnalysisResult {
  success: boolean;
  message: string;
  civilCount?: number;
  criminalCount?: number;
  unknownCount?: number;
}

export default function ImportDataDialog({ isOpen, onClose, onImportComplete }: ImportDataDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
      analyzeFile(); // ❌ 不需要 file 參數
    }
  };

  // 模擬檔案分析
  const analyzeFile = async () => {
    setIsAnalyzing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockResult: AnalysisResult = {
        success: true,
        message: '檔案分析完成！',
        civilCount: Math.floor(Math.random() * 10) + 1,
        criminalCount: Math.floor(Math.random() * 8) + 1,
        unknownCount: Math.floor(Math.random() * 3)
      };

      setAnalysisResult(mockResult);
    } catch {
      setAnalysisResult({
        success: false,
        message: '檔案分析失敗，請檢查檔案格式'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !analysisResult?.success) return;

    setIsImporting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const totalImported = (analysisResult.civilCount || 0) + (analysisResult.criminalCount || 0);

      alert(`匯入成功！共匯入 ${totalImported} 筆案件資料`);
      onImportComplete();
      onClose();
    } catch {
      alert('匯入失敗，請稍後再試');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setIsImporting(false);
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
            匯入Excel資料
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
              <h3 className="font-medium text-blue-900 mb-2">Excel匯入功能說明：</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 請確認EXCEL中含有「民事」或「刑事」的分頁</li>
                <li>• 系統會截取相關必要資料自動新增案件</li>
                <li>• 支援 .xlsx 和 .xls 格式</li>
              </ul>
            </div>
          </div>

          {/* 檔案選擇區域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇Excel檔案：
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />

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
                    點擊選擇Excel檔案或拖拽檔案到此處
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
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* 分析結果顯示 */}
          {(isAnalyzing || analysisResult) && (
            <div className="mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                {isAnalyzing ? (
                  <div className="flex items-center text-blue-600">
                    <Loader className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-sm">正在分析Excel檔案...</span>
                  </div>
                ) : analysisResult?.success ? (
                  <div>
                    <div className="flex items-center text-green-600 mb-2">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">檔案分析完成！</span>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>• 民事案件：{analysisResult.civilCount} 筆</p>
                      <p>• 刑事案件：{analysisResult.criminalCount} 筆</p>
                      {analysisResult.unknownCount! > 0 && (
                        <p className="text-yellow-600">• 未識別工作表：{analysisResult.unknownCount} 個</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <span className="text-sm">{analysisResult?.message}</span>
                  </div>
                )}
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
              disabled={!analysisResult?.success || isAnalyzing || isImporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isImporting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  匯入中...
                </>
              ) : (
                '開始匯入'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

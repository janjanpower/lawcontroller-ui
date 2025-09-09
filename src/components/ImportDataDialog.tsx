import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { parseExcelToCases } from '../utils/importers';

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCases: any[]) => void;
}

export default function ImportDataDialog({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: ImportDataDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean;
    message: string;
    civilCount: number;
    criminalCount: number;
    unknownCount: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');
    setAnalysisResult(null);

    // 自動分析檔案
    await analyzeFile(file);
  };

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const importedCases = await parseExcelToCases(file);
      
      // 統計各類型案件數量
      const civilCount = importedCases.filter(c => c.type === '民事').length;
      const criminalCount = importedCases.filter(c => c.type === '刑事').length;
      const unknownCount = importedCases.filter(c => c.type === '未知').length;

      if (civilCount > 0 || criminalCount > 0) {
        setAnalysisResult({
          success: true,
          message: `檔案分析完成！找到 ${civilCount} 筆民事案件、${criminalCount} 筆刑事案件${unknownCount > 0 ? `、${unknownCount} 筆未分類案件` : ''}`,
          civilCount,
          criminalCount,
          unknownCount
        });
      } else {
        setAnalysisResult({
          success: false,
          message: '未找到可匯入的案件資料，請確認Excel檔案包含「民事」或「刑事」相關工作表',
          civilCount: 0,
          criminalCount: 0,
          unknownCount
        });
      }
    } catch (error) {
      console.error('分析檔案失敗:', error);
      setError(`檔案分析失敗: ${error.message || '未知錯誤'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setError('');

    try {
      const importedCases = await parseExcelToCases(selectedFile);
      
      // 過濾出有效案件（民事或刑事）
      const validCases = importedCases.filter(c => c.type === '民事' || c.type === '刑事' || c.type === '未知');
      
      if (validCases.length > 0) {
        console.log('準備匯入的案件:', validCases);
        onImportComplete(validCases);
      } else {
        setError('沒有找到有效的案件資料。請檢查Excel檔案格式是否正確。');
      }
    } catch (error) {
      console.error('匯入失敗:', error);
      setError(`匯入失敗: ${error.message || '未知錯誤'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setError('');
    setIsAnalyzing(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <Download className="w-5 h-5 mr-2" />
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 說明文字 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Excel匯入功能說明：</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 智慧識別：自動偵測「民事」或「刑事」工作表</li>
              <li>• 智慧標題列：自動尋找包含欄位名稱的標題列</li>
              <li>• 智慧欄位對應：自動匹配「當事人」、「案由」、「案號」、「法院」等欄位</li>
              <li>• 支援案號合併：自動合併多個案號相關欄位</li>
            </ul>
          </div>

          {/* 檔案選擇區域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇Excel檔案 <span className="text-red-500">*</span>
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    檔案大小: {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    點擊選擇Excel檔案或拖拽檔案到此處
                  </p>
                  <p className="text-xs text-gray-500">
                    支援格式: .xlsx, .xls
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleBrowseClick}
                className="mt-3 bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors text-sm"
              >
                {selectedFile ? '重新選擇' : '瀏覽檔案'}
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

          {/* 分析中狀態 */}
          {isAnalyzing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
                <span className="text-sm text-yellow-800">🔍 正在分析Excel檔案...</span>
              </div>
            </div>
          )}

          {/* 分析結果 */}
          {analysisResult && (
            <div className={`border rounded-md p-4 mb-6 ${
              analysisResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start">
                {analysisResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    analysisResult.success ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {analysisResult.success ? '✅ 檔案分析完成！' : '⚠️ 分析結果'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    analysisResult.success ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {analysisResult.message}
                  </p>
                  {analysisResult.success && (
                    <div className="mt-2 text-xs text-green-600">
                      民事案件: {analysisResult.civilCount} 筆 | 
                      刑事案件: {analysisResult.criminalCount} 筆
                      {analysisResult.unknownCount > 0 && ` | 未分類: ${analysisResult.unknownCount} 筆`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">匯入錯誤</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 匯入中狀態 */}
          {isImporting && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-sm text-blue-800">🚀 正在匯入資料，請稍候...</span>
              </div>
            </div>
          )}
        </div>

        {/* 按鈕區域 */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
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
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                匯入中...
              </>
            ) : (
              '開始匯入'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
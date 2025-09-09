import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { analyzeExcelFile } from '@/utils/smartExcelAnalyzer';

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCases: any[]) => void; // 交給上層寫入資料庫
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
    total: number;
    preview: any[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setSelectedFile(file);
    setError('');
    setAnalysisResult(null);
    await analyzeFile(file);
  };

  // 以 case_type 判斷民事/刑事（若含「民」/「刑」字樣）
  const classify = (caseType?: string | null) => {
    const s = (caseType || '').trim();
    if (/民/.test(s)) return 'civil';
    if (/刑/.test(s)) return 'criminal';
    return 'unknown';
  };

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const { cases } = await analyzeExcelFile(file);

      const civilCount = cases.filter(c => classify(c.case_type) === 'civil').length;
      const criminalCount = cases.filter(c => classify(c.case_type) === 'criminal').length;
      const unknownCount = cases.length - civilCount - criminalCount;

      setAnalysisResult({
        success: cases.length > 0,
        message: cases.length > 0
          ? `解析完成！共 ${cases.length} 筆（民事 ${civilCount}、刑事 ${criminalCount}${unknownCount > 0 ? `、未分類 ${unknownCount}` : ''}）`
          : '未解析到可匯入資料，請確認欄位列包含：案件類型/案由/案號/當事人…',
        civilCount,
        criminalCount,
        unknownCount,
        total: cases.length,
        preview: cases.slice(0, 50), // 預覽最多 50 筆
      });
    } catch (err: any) {
      console.error('分析檔案失敗:', err);
      setError(`檔案分析失敗：${err?.message || '未知錯誤'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    if (!analysisResult?.success || analysisResult.total === 0) {
      setError('沒有可匯入的資料');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      // 重新解析一次以取得完整 cases（避免只送 preview）
      const { cases } = await analyzeExcelFile(selectedFile);

      // 你可以在這裡做前置過濾或轉換（例如把 client -> client_name）
      onImportComplete(cases);
      handleClose();
    } catch (err: any) {
      console.error('匯入失敗:', err);
      setError(`匯入失敗：${err?.message || '未知錯誤'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleClose = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setError('');
    setIsAnalyzing(false);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <Download className="w-5 h-5 mr-2" />
            匯入 Excel 資料
          </h2>
          <button onClick={handleClose} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Excel 匯入說明</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 解析會自動偵測表頭列，支援欄位：案件類型、案由、案號、當事人、律師、法務、法院、股別、進度、進度日期。</li>
              <li>• 匯入前會先顯示解析預覽，你可以確認資料是否正確。</li>
            </ul>
          </div>

          {/* 檔案選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">選擇 Excel 檔案 <span className="text-red-500">*</span></label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">檔案大小: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">點擊選擇 Excel 檔案或拖拽檔案到此處</p>
                  <p className="text-xs text-gray-500">支援格式: .xlsx, .xls</p>
                </div>
              )}
              <button type="button" onClick={handleBrowseClick} className="mt-3 bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors text-sm">
                {selectedFile ? '重新選擇' : '瀏覽檔案'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>

          {/* 分析中 */}
          {isAnalyzing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
                <span className="text-sm text-yellow-800">🔍 正在分析 Excel 檔案...</span>
              </div>
            </div>
          )}

          {/* 分析結果 */}
          {analysisResult && (
            <div className={`border rounded-md p-4 mb-6 ${analysisResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-start">
                {analysisResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${analysisResult.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    {analysisResult.success ? '✅ 解析完成' : '⚠️ 分析結果'}
                  </p>
                  <p className={`text-sm mt-1 ${analysisResult.success ? 'text-green-700' : 'text-yellow-700'}`}>
                    {analysisResult.message}
                  </p>
                  {analysisResult.success && (
                    <div className="mt-2 text-xs text-green-600">
                      民事: {analysisResult.civilCount} ｜ 刑事: {analysisResult.criminalCount}
                      {analysisResult.unknownCount > 0 && <> ｜ 未分類: {analysisResult.unknownCount}</>}
                      <> ｜ 總計: {analysisResult.total}</>
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

          {/* 預覽（前 50 筆） */}
          {analysisResult?.success && analysisResult.preview.length > 0 && (
            <div className="border rounded-md p-3 h-56 overflow-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th>當事人</th>
                    <th>案件類型</th>
                    <th>案號</th>
                    <th>進度</th>
                    <th>進度日期</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisResult.preview.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td>{c.client ?? ''}</td>
                      <td>{c.case_type ?? ''}</td>
                      <td>{c.case_number ?? ''}</td>
                      <td>{c.progress ?? ''}</td>
                      <td>{c.progress_date ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" disabled={isAnalyzing || isImporting}>
            取消
          </button>
          <button type="button" onClick={handleImport} disabled={!analysisResult?.success || isAnalyzing || isImporting} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
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

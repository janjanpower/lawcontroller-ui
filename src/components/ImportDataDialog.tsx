import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { analyzeExcelFile } from '../utils/smartExcelAnalyzer';

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
    total: number;
    preview: any[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 日期標準化 */
  const normalizeDate = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'number') {
      const epoch = new Date((value - 25569) * 86400 * 1000);
      return epoch.toISOString().slice(0, 10);
    }
    const str = String(value).trim();
    const m = str.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/);
    if (m) {
      const [_, y, mth, d] = m;
      return `${y}-${mth.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str;
  };

  /** 欄位正規化 */
  const normalizeCase = (c: any) => {
    return {
      client: c.client || c['當事人'] || c['委託人'] || '',
      case_type: c.case_type || c['案件類型'] || c['案類'] || '',
      case_reason: c.case_reason || c['案由'] || '',
      case_number: c.case_number || c['案號'] || '',
      progress: c.progress || c['進度'] || '', // ✅ 不帶預設值
      progress_date: normalizeDate(c.progress_date || c['進度日期'] || c['日期']),
      sheet_name: c.sheet_name || ''
    };
  };

  /** 案件類型分類與覆蓋 */
  const classifyAndOverride = (row: any) => {
    const content = `${row.case_type || ''} ${row.case_reason || ''} ${row.case_number || ''}`;
    const sheet = row.sheet_name || '';

    // 先依分頁名稱強制分類
    if (/民/.test(sheet)) {
      row.case_type = '民事';
      return 'civil';
    }
    if (/刑/.test(sheet)) {
      row.case_type = '刑事';
      return 'criminal';
    }

    // 再依內容判斷
    if (/民/.test(content)) {
      row.case_type = '民事';
      return 'civil';
    }
    if (/刑/.test(content)) {
      row.case_type = '刑事';
      return 'criminal';
    }

    return 'unknown';
  };


  /** 選擇檔案 */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setSelectedFile(file);
    setError('');
    setAnalysisResult(null);
    await analyzeFile(file);
  };

  /** 分析檔案 */
  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const { cases } = await analyzeExcelFile(file);
      const normalizedCases = cases.map(normalizeCase).map(c => {
        classifyAndOverride(c);
        delete c.sheet_name;
        return c;
      });

      const civilCount = normalizedCases.filter(c => c.case_type === '民事').length;
      const criminalCount = normalizedCases.filter(c => c.case_type === '刑事').length;
      const unknownCount = normalizedCases.length - civilCount - criminalCount;

      setAnalysisResult({
        success: normalizedCases.length > 0,
        message: normalizedCases.length > 0
          ? `共 ${normalizedCases.length} 筆（民事 ${civilCount}、刑事 ${criminalCount}${unknownCount > 0 ? `、未分類 ${unknownCount}` : ''}）`
          : '未解析到可匯入資料',
        civilCount,
        criminalCount,
        unknownCount,
        total: normalizedCases.length,
        preview: normalizedCases.slice(0, 50),
      });
    } catch (err: any) {
      console.error('分析檔案失敗:', err);
      setError(`檔案分析失敗：${err?.message || '未知錯誤'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /** 匯入 */
  const handleImport = async () => {
    if (!selectedFile) return;
    if (!analysisResult?.success || analysisResult.total === 0) {
      setError('沒有可匯入的資料');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const { cases } = await analyzeExcelFile(selectedFile);
      const normalizedCases = cases.map(normalizeCase).map(c => {
        classifyAndOverride(c);
        delete c.sheet_name;
        return c;
      });
      onImportComplete(normalizedCases);
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
        <div className="bg-[#334d6d] text-white px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <Download className="w-5 h-5 mr-2" />
            匯入 Excel 資料
          </h2>
          <button onClick={handleClose} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-110px)]">
          <p className="text-sm text-gray-600 mb-4">
            請選擇 Excel 檔案，系統會自動解析並顯示預覽。
          </p>

          {/* 檔案選擇 */}
          <div className="mb-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">大小: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">點擊下方按鈕選擇 Excel 檔案</p>
              )}
              <button
                type="button"
                onClick={handleBrowseClick}
                className="mt-2 bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors text-sm"
              >
                {selectedFile ? '重新選擇' : '瀏覽檔案'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>

          {/* 分析中 */}
          {isAnalyzing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 text-sm text-yellow-800 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
              正在分析 Excel 檔案...
            </div>
          )}

          {/* 分析結果 */}
          {analysisResult && (
            <div className={`border rounded-md p-3 mb-4 text-sm ${analysisResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              {analysisResult.success ? (
                <>✅ {analysisResult.message}</>
              ) : (
                <>⚠️ {analysisResult.message}</>
              )}
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
              ⚠ {error}
            </div>
          )}

          {/* 預覽 */}
          {analysisResult?.success && analysisResult.preview.length > 0 && (
            <div className="border rounded-md p-3 h-48 overflow-auto text-sm">
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
        <div className="flex justify-end space-x-3 px-6 py-3 border-t border-gray-200">
          <button type="button" onClick={handleClose} className="px-4 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm" disabled={isAnalyzing || isImporting}>
            取消
          </button>
          <button type="button" onClick={handleImport} disabled={!analysisResult?.success || isAnalyzing || isImporting} className="px-5 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {isImporting ? '匯入中...' : '開始匯入'}
          </button>
        </div>
      </div>
    </div>
  );
}

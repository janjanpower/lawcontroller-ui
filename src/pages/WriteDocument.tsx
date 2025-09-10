import React, { useState, useEffect, useRef } from 'react';
import { Save, Download, FileText, X, Folder, User, Calendar, Clock } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { saveAs } from 'file-saver';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';

interface WriteDocumentProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  clientName?: string;
}

interface CaseOption {
  id: string;
  client: string;
  caseNumber: string;
  caseType: string;
}

interface FolderOption {
  name: string;
  path: string;
  type: string;
}

export default function WriteDocument({ isOpen, onClose, caseId, clientName }: WriteDocumentProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [selectedCase, setSelectedCase] = useState(caseId || '');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const quillRef = useRef<ReactQuill>(null);

  // Quill 編輯器配置
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'align', 'list', 'bullet',
    'blockquote', 'code-block', 'link'
  ];

  // 載入案件列表
  const loadCases = async () => {
    try {
      const response = await apiFetch('/api/cases');
      const data = await response.json();
      
      if (response.ok) {
        const transformedCases = (data.items || []).map((item: any) => ({
          id: item.id,
          client: item.client_name || item.client?.name || '',
          caseNumber: item.case_number || '',
          caseType: item.case_type || ''
        }));
        setCases(transformedCases);
      }
    } catch (error) {
      console.error('載入案件列表失敗:', error);
    }
  };

  // 載入資料夾列表
  const loadFolders = async (caseId: string) => {
    if (!caseId) return;
    
    try {
      const response = await apiFetch(`/api/cases/${caseId}/files`);
      const data = await response.json();
      
      if (response.ok) {
        const folderList: FolderOption[] = [];
        
        // 從 API 回應中提取資料夾
        if (data.folders && Array.isArray(data.folders)) {
          data.folders.forEach((folder: any) => {
            folderList.push({
              name: folder.folder_name,
              path: folder.folder_path,
              type: folder.folder_type
            });
          });
        }
        
        // 確保基本資料夾存在
        const defaultFolders = ['狀紙', '案件資訊', '案件進度'];
        defaultFolders.forEach(folderName => {
          if (!folderList.some(f => f.name === folderName)) {
            folderList.push({
              name: folderName,
              path: `/cases/${caseId}/${folderName}`,
              type: 'default'
            });
          }
        });
        
        setFolders(folderList);
      }
    } catch (error) {
      console.error('載入資料夾列表失敗:', error);
      // 設定預設資料夾
      setFolders([
        { name: '狀紙', path: `/cases/${caseId}/狀紙`, type: 'default' },
        { name: '案件資訊', path: `/cases/${caseId}/案件資訊`, type: 'default' },
        { name: '案件進度', path: `/cases/${caseId}/案件進度`, type: 'default' }
      ]);
    }
  };

  // 初始載入
  useEffect(() => {
    if (isOpen) {
      loadCases();
      if (caseId) {
        setSelectedCase(caseId);
        loadFolders(caseId);
      }
      
      // 載入草稿
      const savedTitle = localStorage.getItem('write_document_title');
      const savedContent = localStorage.getItem('write_document_content');
      if (savedTitle) setTitle(savedTitle);
      if (savedContent) setContent(savedContent);
    }
  }, [isOpen, caseId]);

  // 案件選擇變更時載入資料夾
  useEffect(() => {
    if (selectedCase) {
      loadFolders(selectedCase);
    }
  }, [selectedCase]);

  // 計算字數
  useEffect(() => {
    const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    setWordCount(text.length);
  }, [content]);

  // 自動儲存草稿
  useEffect(() => {
    if (title || content) {
      const timer = setTimeout(() => {
        localStorage.setItem('write_document_title', title);
        localStorage.setItem('write_document_content', content);
        setLastSaved(new Date());
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [title, content]);

  // 儲存到案件資料夾
  const handleSaveToCase = async () => {
    if (!selectedCase || !selectedFolder || !title.trim()) {
      alert('請選擇案件、資料夾並輸入文件標題');
      return;
    }

    setSaving(true);
    try {
      // 將 HTML 內容轉換為 Word 文件
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif; line-height: 1.6; margin: 40px; }
            h1, h2, h3 { color: #334d6d; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #334d6d; padding-bottom: 20px; }
            .content { margin-top: 20px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>建立日期：${new Date().toLocaleDateString('zh-TW')}</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>此文件由法律案件管理系統產生</p>
          </div>
        </body>
        </html>
      `;

      // 創建 Blob 並轉換為 File
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const fileName = `${title}_${new Date().toISOString().split('T')[0]}.doc`;
      const file = new File([blob], fileName, { type: 'application/msword' });

      // 上傳到選定的案件資料夾
      const formData = new FormData();
      formData.append('file', file);
      
      // 根據資料夾名稱決定 folder_type
      const folderTypeMapping: Record<string, string> = {
        '狀紙': 'pleadings',
        '案件資訊': 'info',
        '案件進度': 'progress'
      };
      
      const selectedFolderObj = folders.find(f => f.path === selectedFolder);
      const folderType = selectedFolderObj ? folderTypeMapping[selectedFolderObj.name] || 'progress' : 'progress';
      
      formData.append('folder_type', folderType);

      const firmCode = getFirmCodeOrThrow();
      const uploadResponse = await fetch(
        `/api/cases/${selectedCase}/files?firm_code=${encodeURIComponent(firmCode)}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (uploadResponse.ok) {
        alert('文件已成功儲存到案件資料夾！');
        // 清除草稿
        localStorage.removeItem('write_document_title');
        localStorage.removeItem('write_document_content');
        setTitle('');
        setContent('');
        onClose();
      } else {
        const errorText = await uploadResponse.text();
        console.error('上傳失敗:', errorText);
        alert('儲存失敗，請稍後再試');
      }
    } catch (error) {
      console.error('儲存文件失敗:', error);
      alert('儲存失敗，請檢查網路連線');
    } finally {
      setSaving(false);
    }
  };

  // 匯出為 Word 文件
  const handleExportWord = () => {
    if (!title.trim()) {
      alert('請輸入文件標題');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif; line-height: 1.6; margin: 40px; }
          h1, h2, h3 { color: #334d6d; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #334d6d; padding-bottom: 20px; }
          .content { margin-top: 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>建立日期：${new Date().toLocaleDateString('zh-TW')}</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>此文件由法律案件管理系統產生</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const fileName = `${title}_${new Date().toISOString().split('T')[0]}.doc`;
    saveAs(blob, fileName);
  };

  if (!isOpen) return null;

  const selectedCaseData = cases.find(c => c.id === selectedCase);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            撰寫文件
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 工具列 */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* 文件資訊 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="請輸入文件標題..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                />
              </div>
              
              {/* 案件選擇 */}
              <div className="flex-1">
                <select
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                >
                  <option value="">選擇案件（儲存用）</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.client} - {c.caseNumber || c.caseType}
                    </option>
                  ))}
                </select>
              </div>

              {/* 資料夾選擇 */}
              {selectedCase && (
                <div className="flex-1">
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                  >
                    <option value="">選擇資料夾</option>
                    {folders.map(f => (
                      <option key={f.path} value={f.path}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 操作按鈕 */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveToCase}
                disabled={!selectedCase || !selectedFolder || !title.trim() || saving}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>儲存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>儲存到案件</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleExportWord}
                disabled={!title.trim()}
                className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>匯出Word</span>
              </button>
            </div>
          </div>

          {/* 狀態列 */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <FileText className="w-4 h-4" />
                <span>字數: {wordCount}</span>
              </div>
              {selectedCaseData && (
                <div className="flex items-center space-x-1">
                  <User className="w-4 h-4" />
                  <span>案件: {selectedCaseData.client}</span>
                </div>
              )}
            </div>
            
            {lastSaved && (
              <div className="flex items-center space-x-1 text-green-600">
                <Clock className="w-4 h-4" />
                <span>草稿已儲存: {lastSaved.toLocaleTimeString('zh-TW')}</span>
              </div>
            )}
          </div>
        </div>

        {/* 編輯器 */}
        <div className="flex-1 overflow-hidden">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            placeholder="開始撰寫您的文件..."
            style={{
              height: 'calc(95vh - 200px)',
              display: 'flex',
              flexDirection: 'column'
            }}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
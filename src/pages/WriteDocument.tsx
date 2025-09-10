import React, { useState, useRef, useEffect } from 'react';
import { Save, Download, FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Undo, Redo, Type, Palette } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function WriteDocument() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const quillRef = useRef<ReactQuill>(null);

  // 自動儲存功能
  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (content || title) {
        handleAutoSave();
      }
    }, 5000); // 5秒後自動儲存

    return () => clearTimeout(autoSave);
  }, [content, title]);

  const handleAutoSave = async () => {
    if (!content && !title) return;
    
    try {
      // 儲存到 localStorage 作為草稿
      const draft = {
        title,
        content,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('document_draft', JSON.stringify(draft));
      setLastSaved(new Date());
    } catch (error) {
      console.error('自動儲存失敗:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await handleAutoSave();
      alert('文件已儲存！');
    } catch (error) {
      alert('儲存失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportWord = () => {
    // 建立 HTML 內容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title || '未命名文件'}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; margin: 40px; }
          h1 { color: #334d6d; border-bottom: 2px solid #334d6d; padding-bottom: 10px; }
          p { margin: 10px 0; }
          .ql-align-center { text-align: center; }
          .ql-align-right { text-align: right; }
          .ql-align-justify { text-align: justify; }
        </style>
      </head>
      <body>
        <h1>${title || '未命名文件'}</h1>
        <div>${content}</div>
        <hr style="margin-top: 40px;">
        <p style="font-size: 12px; color: #666;">
          建立時間：${new Date().toLocaleString('zh-TW')}<br>
          法律案件管理系統
        </p>
      </body>
      </html>
    `;

    // 建立並下載檔案
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || '未命名文件'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNewDocument = () => {
    if (content || title) {
      if (confirm('確定要建立新文件嗎？未儲存的內容將會遺失。')) {
        setContent('');
        setTitle('');
        setLastSaved(null);
        localStorage.removeItem('document_draft');
      }
    } else {
      setContent('');
      setTitle('');
      setLastSaved(null);
    }
  };

  // 載入草稿
  useEffect(() => {
    try {
      const draft = localStorage.getItem('document_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setTitle(parsed.title || '');
        setContent(parsed.content || '');
        setLastSaved(new Date(parsed.lastSaved));
      }
    } catch (error) {
      console.error('載入草稿失敗:', error);
    }
  }, []);

  // Quill 編輯器配置
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'align', 'list', 'bullet', 'indent',
    'link', 'image'
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* 工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="請輸入文件標題..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold text-[#334d6d] bg-transparent border-none outline-none placeholder-gray-400"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-gray-500 hidden lg:inline">
                上次儲存：{lastSaved.toLocaleTimeString('zh-TW')}
              </span>
            )}
            
            <button
              onClick={handleNewDocument}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center space-x-1"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">新文件</span>
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 flex items-center space-x-2 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '儲存中...' : '儲存'}</span>
            </button>
            
            <button
              onClick={handleExportWord}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">匯出Word</span>
              <span className="sm:hidden">匯出</span>
            </button>
          </div>
        </div>
      </div>

      {/* 編輯器區域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-white mx-4 lg:mx-8 my-4 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* 編輯器 */}
          <div className="h-full flex flex-col">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={content}
              onChange={setContent}
              modules={modules}
              formats={formats}
              placeholder="開始撰寫您的文件..."
              className="flex-1 h-full"
              style={{
                height: 'calc(100% - 42px)', // 減去工具列高度
              }}
            />
          </div>
        </div>
      </div>

      {/* 底部狀態列 */}
      <div className="bg-white border-t border-gray-200 px-4 lg:px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>字數：{content.replace(/<[^>]*>/g, '').length}</span>
            <span>段落：{content.split('</p>').length - 1 || 1}</span>
          </div>
          {lastSaved && (
            <span className="lg:hidden">
              上次儲存：{lastSaved.toLocaleTimeString('zh-TW')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
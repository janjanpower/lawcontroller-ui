import React, { useState, useEffect, useRef } from 'react';
import { Save, Download, FileText, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, List, ListOrdered, Undo, Redo } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function WriteDocument() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  // 自動儲存功能
  useEffect(() => {
    const timer = setInterval(() => {
      if (content || title) {
        handleAutoSave();
      }
    }, 5000); // 每5秒自動儲存

    return () => clearInterval(timer);
  }, [content, title]);

  // 載入草稿
  useEffect(() => {
    const savedTitle = localStorage.getItem('draft_title');
    const savedContent = localStorage.getItem('draft_content');
    
    if (savedTitle) setTitle(savedTitle);
    if (savedContent) setContent(savedContent);
  }, []);

  // 計算字數
  useEffect(() => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    setWordCount(text.length);
  }, [content]);

  const handleAutoSave = () => {
    localStorage.setItem('draft_title', title);
    localStorage.setItem('draft_content', content);
    setLastSaved(new Date());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 這裡可以串接後端API儲存文件
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬儲存
      handleAutoSave();
      alert('文件儲存成功！');
    } catch (error) {
      alert('儲存失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportWord = () => {
    // 建立Word文件內容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title || '未命名文件'}</title>
        <style>
          body { font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; margin: 40px; }
          h1 { color: #334d6d; border-bottom: 2px solid #334d6d; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>${title || '未命名文件'}</h1>
        ${content}
      </body>
      </html>
    `;

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

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <FileText className="w-6 h-6 text-[#334d6d]" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請輸入文件標題..."
              className="text-xl font-semibold text-[#334d6d] bg-transparent border-none outline-none placeholder-gray-400 flex-1"
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              字數: {wordCount}
            </div>
            {lastSaved && (
              <div className="text-xs text-gray-400">
                上次儲存: {lastSaved.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '儲存中...' : '儲存'}</span>
            </button>
            <button
              onClick={handleExportWord}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>匯出Word</span>
            </button>
          </div>
        </div>
      </div>

      {/* 編輯器區域 */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
          <div className="flex-1 p-4">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={content}
              onChange={setContent}
              modules={modules}
              formats={formats}
              placeholder="開始撰寫您的文件..."
              style={{ height: 'calc(100vh - 300px)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
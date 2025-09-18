import React from 'react';
import { X, FileText, Download } from 'lucide-react';

interface FilePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  files: { id: string; name: string; created_at?: string; url?: string }[];
}

export default function FilePreviewDialog({ open, onClose, files }: FilePreviewDialogProps) {
  console.log("👉 FilePreviewDialog render, open=", open, "files=", files);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-[600px] max-h-[80vh] overflow-y-auto p-6">
        {/* 標題列 */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">檔案預覽</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* 檔案列表 */}
        {files.length === 0 ? (
          <p className="text-gray-500 text-center py-10">此資料夾內尚無檔案</p>
        ) : (
          <ul className="space-y-3">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  <span className="text-gray-800">{file.name}</span>
                  {file.created_at && (
                    <span className="text-sm text-gray-400">({new Date(file.created_at).toLocaleDateString()})</span>
                  )}
                </div>
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Download size={16} /> 下載
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

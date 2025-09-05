// src/pages/UnifiedDialog.tsx
import React from 'react';

interface UnifiedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  showCancel?: boolean;
  onConfirm?: () => void;
}

export default function UnifiedDialog({
  isOpen,
  onClose,
  title,
  message,
  type,
  showCancel = false,
  onConfirm,
}: UnifiedDialogProps) {
  if (!isOpen) return null;

  // 顏色樣式對應
  const typeClasses = {
    info: 'bg-blue-600 hover:bg-blue-700',
    success: 'bg-green-600 hover:bg-green-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    error: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6">
          <p className="text-sm text-gray-800">{message}</p>
        </div>

        {/* 按鈕區域 */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={`px-6 py-2 rounded-md text-white ${typeClasses[type]} transition-colors`}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}

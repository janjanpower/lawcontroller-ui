// src/components/ClosedTransferDialog.tsx
import { useState, useEffect } from 'react';

interface ClosedTransferDialogProps {
  isOpen: boolean;
  cases: Array<{ id: string; caseNo?: string; title?: string }>;
  onClose: () => void;
  onConfirm: (payload?: { targetPath?: string }) => Promise<void> | void;
}

export default function ClosedTransferDialog({
  isOpen, cases, onClose, onConfirm
}: ClosedTransferDialogProps) {
  const [targetPath, setTargetPath] = useState('');

  useEffect(() => {
    if (isOpen) setTargetPath('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-3 rounded-t-xl bg-[#334d6d] text-white">
          <h3 className="text-lg font-semibold">轉移至結案案件</h3>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            將以下 {cases.length} 筆案件轉移到「結案案件」。此動作會將案件狀態標記為已結案，
            並（若後端有實作）移動相關資料夾。
          </p>

          <div className="rounded-md border border-gray-200 p-3 bg-gray-50 max-h-40 overflow-auto text-sm">
            {cases.map(c => (
              <div key={c.id} className="py-0.5">#{c.id} {c.caseNo ?? c.title ?? ''}</div>
            ))}
          </div>

          {/* 如果你的後端需要目標路徑，保留這欄；不需要可刪除 */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">目標路徑（選填，交由後端處理）</label>
            <input
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="例：/Closed/2025"
              className="w-full h-10 rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-[#334d6d]"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700">
            取消
          </button>
          <button
            onClick={() => onConfirm({ targetPath: targetPath.trim() || undefined })}
            className="px-4 py-2 rounded-md bg-[#f39c12] hover:bg-[#d68910] text-white"
          >
            確認轉移
          </button>
        </div>
      </div>
    </div>
  );
}
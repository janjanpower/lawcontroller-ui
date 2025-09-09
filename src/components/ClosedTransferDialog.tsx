// src/components/ClosedTransferDialog.tsx
import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { hasClosedStage } from '../utils/caseStage';

interface ClosedTransferDialogProps {
  isOpen: boolean;
  cases: Array<{ id: string; caseNo?: string; title?: string; stages?: Array<{ name: string }> }>;
  onClose: () => void;
  onConfirm: (payload?: { targetPath?: string; forceTransfer?: boolean }) => Promise<void> | void;
}

// 自訂確認對話框組件
interface CustomConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'error';
}

const CustomConfirmDialog: React.FC<CustomConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'error':
        return 'bg-red-600';
      case 'info':
        return 'bg-blue-600';
      default:
        return 'bg-yellow-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className={`${getTypeColor()} text-white px-6 py-4 flex items-center justify-between rounded-t-lg`}>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-800 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 ${getTypeColor()} text-white rounded-md hover:opacity-90 transition-colors`}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};
export default function ClosedTransferDialog({
  isOpen, cases, onClose, onConfirm
}: ClosedTransferDialogProps) {
  const [targetPath, setTargetPath] = useState('');
  const [forceTransfer, setForceTransfer] = useState(false);
  const [casesWithoutClosedStage, setCasesWithoutClosedStage] = useState<Array<{ id: string; caseNo?: string; title?: string }>>([]);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetPath('');
      setForceTransfer(false);
      setShowForceConfirm(false);
      
      // 檢查哪些案件沒有「已結案」階段
      const casesWithoutClosed = cases.filter(c => !hasClosedStage(c.stages || []));
      setCasesWithoutClosedStage(casesWithoutClosed);
    }
  }, [isOpen, cases]);

  const handleTransferAttempt = () => {
    // 如果有案件沒有結案階段且沒有勾選強制轉移
    if (casesWithoutClosedStage.length > 0 && !forceTransfer) {
      const caseList = casesWithoutClosedStage.map(c => `• ${c.title} - ${c.caseNo}`).join('\n');
      setShowForceConfirm(true);
      return;
    }
    
    // 直接轉移
    onConfirm({ 
      targetPath: targetPath.trim() || undefined,
      forceTransfer: forceTransfer
    });
  };

  const handleForceConfirm = () => {
    setForceTransfer(true);
    setShowForceConfirm(false);
    onConfirm({ 
      targetPath: targetPath.trim() || undefined,
      forceTransfer: true
    });
  };
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
          <div className="px-5 py-3 rounded-t-xl bg-[#334d6d] text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">轉移至結案案件</h3>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              將以下 {cases.length} 筆案件轉移到「結案案件」。
            </p>

            {/* 案件狀態檢查 */}
            {casesWithoutClosedStage.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">
                      以下 {casesWithoutClosedStage.length} 筆案件尚未有「已結案」階段：
                    </h4>
                    <div className="text-xs text-yellow-700 space-y-1 max-h-24 overflow-y-auto">
                      {casesWithoutClosedStage.map(c => (
                        <div key={c.id}>• {c.title} - {c.caseNo}</div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={forceTransfer}
                          onChange={(e) => setForceTransfer(e.target.checked)}
                          className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-yellow-800">我確認要強制轉移這些案件</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 可以轉移的案件列表 */}
            <div className="rounded-md border border-gray-200 p-3 bg-gray-50 max-h-40 overflow-auto text-sm">
              {cases.map(c => {
                const hasClosedStageFlag = hasClosedStage(c.stages || []);
                return (
                  <div key={c.id} className="py-0.5 flex items-center space-x-2">
                    {hasClosedStageFlag ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    )}
                    <span className={hasClosedStageFlag ? 'text-gray-900' : 'text-yellow-700'}>
                      {c.title} - {c.caseNo}
                    </span>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">目標路徑（選填）</label>
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
              onClick={handleTransferAttempt}
              className="px-4 py-2 rounded-md bg-[#f39c12] hover:bg-[#d68910] text-white"
            >
              確認轉移
            </button>
          </div>
        </div>
      </div>
      
      {/* 強制轉移確認對話框 */}
      <CustomConfirmDialog
        isOpen={showForceConfirm}
        title="確認強制轉移"
        message={`以下案件尚未有「已結案」階段：\n\n${casesWithoutClosedStage.map(c => `• ${c.title} - ${c.caseNo}`).join('\n')}\n\n確定要強制轉移這些案件嗎？`}
        onConfirm={handleForceConfirm}
        onCancel={() => setShowForceConfirm(false)}
        type="warning"
      />
    </>
  );
}
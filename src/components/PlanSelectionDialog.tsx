import React, { useState } from 'react';
import { X, CreditCard, Banknote, Loader } from 'lucide-react';
import { PLANS } from '../types';
import type { PlanType, Firm } from '../types';

interface PlanSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  firm: Firm & { hasPlan: boolean };
  onComplete: () => void;
}

export default function PlanSelectionDialog({ isOpen, onClose, firm, onComplete }: PlanSelectionDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('basic');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'credit_card'>('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 調試日誌
  console.log('PlanSelectionDialog render:', { 
    isOpen, 
    firm: !!firm, 
    firmName: firm?.firmName,
    hasPlan: firm?.hasPlan 
  });

  const handlePlanSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firm_id: firm.id,
          plan_type: selectedPlan,
          payment_method: paymentMethod
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onComplete();
      } else {
        setError(data.detail || data.message || '方案選擇失敗');
      }
      
    } catch {
      console.error('方案選擇失敗:', error);
      setError(`網路錯誤: ${error.message || '無法連接到伺服器'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!firm) {
    console.log('PlanSelectionDialog: firm is null, closing dialog');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            選擇方案
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6">
          {/* 事務所資訊 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-6">
            <h3 className="font-medium text-yellow-900 mb-1">{firm.firmName}</h3>
            <p className="text-sm text-yellow-700">
              請選擇方案以開始使用系統
            </p>
          </div>

          <form onSubmit={handlePlanSelection} className="space-y-4">
            {/* 方案選擇 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">選擇方案</label>
              <div className="space-y-2">
                {Object.entries(PLANS).map(([key, plan]) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPlan === key
                        ? 'border-[#334d6d] bg-blue-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="plan"
                        value={key}
                        checked={selectedPlan === key}
                        onChange={(e) => setSelectedPlan(e.target.value as PlanType)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{plan.name}</div>
                        <div className="text-xs text-gray-500">最多 {plan.maxUsers} 人</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#334d6d]">
                        {key === 'basic' ? '月付1999' : 
                         key === 'advanced' ? '月付 $1,999' :
                         key === 'premium' ? '月付 $3,999' : '月付 $6,999'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 付費方式 */}
            {selectedPlan !== 'basic' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">付費方式</label>
                <div className="space-y-2">
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mr-2"
                    />
                    <Banknote className="w-4 h-4 mr-2" />
                    <span className="text-sm">銀行轉帳</span>
                  </label>
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credit_card"
                      checked={paymentMethod === 'credit_card'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mr-2"
                    />
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span className="text-sm">信用卡</span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    處理中...
                  </>
                ) : (
                  selectedPlan === 'basic' ? '啟用免費方案' : '確認付費'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { X, Building, User, Lock, Loader, Eye, EyeOff } from 'lucide-react';
import type { RegisterData, PlanType, PLANS } from '../types';

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (result: { success: boolean; firmCode: string }) => void;
  apiBaseUrl: string;
}

export default function RegisterDialog({ isOpen, onClose, onRegisterSuccess, apiBaseUrl }: RegisterDialogProps) {
  const [formData, setFormData] = useState<RegisterData>({
    firmName: '',
    firmCode: '',
    adminUsername: '',
    adminPassword: '',
    confirmPassword: '',
    plan: 'basic'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 事務所名稱驗證
    if (!formData.firmName.trim()) {
      newErrors.firmName = '請輸入事務所名稱';
    }

    // 事務所代碼驗證 (8-16位)
    if (!formData.firmCode.trim()) {
      newErrors.firmCode = '請輸入事務所代碼';
    } else if (formData.firmCode.length < 8 || formData.firmCode.length > 16) {
      newErrors.firmCode = '事務所代碼需為 8~16 個字元';
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.firmCode)) {
      newErrors.firmCode = '事務所代碼僅允許英數字、_ 與 -';
    }

    // 管理員帳號驗證 (8-16位)
    if (!formData.adminUsername.trim()) {
      newErrors.adminUsername = '請輸入管理員帳號';
    } else if (formData.adminUsername.length < 8 || formData.adminUsername.length > 16) {
      newErrors.adminUsername = '管理員帳號需為 8~16 個字元';
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.adminUsername)) {
      newErrors.adminUsername = '管理員帳號僅允許英數字、_ 與 -';
    }

    // 密碼驗證 (8碼+大小寫英文至少各一個)
    if (!formData.adminPassword) {
      newErrors.adminPassword = '請輸入管理員密碼';
    } else if (formData.adminPassword.length < 8) {
      newErrors.adminPassword = '密碼需至少 8 個字元';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])/.test(formData.adminPassword)) {
      newErrors.adminPassword = '密碼需包含至少一個大寫和一個小寫英文字母';
    }

    // 確認密碼驗證
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '請確認管理員密碼';
    } else if (formData.adminPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = '兩次輸入的密碼不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 模擬 API 呼叫
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模擬註冊成功
      const result = {
        success: true,
        firmCode: formData.firmCode,
        message: '事務所註冊成功！'
      };

      onRegisterSuccess(result);
      onClose();

      // 顯示成功訊息
      alert(`註冊成功！\n\n事務所：${formData.firmName}\n代碼：${formData.firmCode}\n方案：${PLANS[formData.plan].name}\n\n請使用事務所代碼和管理員帳密登入系統。`);

    } catch (error) {
      console.error('註冊請求失敗:', error);
      setErrors({ submit: '註冊失敗，請稍後重試' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterData, value: string | PlanType) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // 清除該欄位的錯誤
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleClose = () => {
    setFormData({
      firmName: '',
      firmCode: '',
      adminUsername: '',
      adminPassword: '',
      confirmPassword: '',
      plan: 'basic'
    });
    setErrors({});
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <Building className="w-5 h-5 mr-2" />
            註冊事務所
          </h2>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* 事務所名稱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building className="w-4 h-4 inline mr-1" />
                事務所名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firmName}
                onChange={(e) => handleInputChange('firmName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.firmName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入事務所名稱"
                disabled={loading}
              />
              {errors.firmName && (
                <p className="text-red-500 text-xs mt-1">{errors.firmName}</p>
              )}
            </div>

            {/* 事務所代碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                事務所代碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firmCode}
                onChange={(e) => handleInputChange('firmCode', e.target.value.toUpperCase())}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.firmCode ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="8~16個字元，英數字、_ 與 -"
                disabled={loading}
                maxLength={16}
              />
              {errors.firmCode && (
                <p className="text-red-500 text-xs mt-1">{errors.firmCode}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                此代碼將作為登入時的事務所識別碼
              </p>
            </div>

            {/* 管理員帳號 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                管理員帳號 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.adminUsername}
                onChange={(e) => handleInputChange('adminUsername', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.adminUsername ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="8~16個字元，英數字、_ 與 -"
                disabled={loading}
                maxLength={16}
              />
              {errors.adminUsername && (
                <p className="text-red-500 text-xs mt-1">{errors.adminUsername}</p>
              )}
            </div>

            {/* 管理員密碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-1" />
                管理員密碼 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.adminPassword}
                  onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                    errors.adminPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="至少8碼，包含大小寫英文"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.adminPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.adminPassword}</p>
              )}
            </div>

            {/* 確認密碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-1" />
                確認管理員密碼 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="請再次輸入密碼"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 方案選擇 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                選擇方案 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(PLANS).map(([key, plan]) => (
                  <label
                    key={key}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.plan === key
                        ? 'border-[#334d6d] bg-blue-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={key}
                      checked={formData.plan === key}
                      onChange={(e) => handleInputChange('plan', e.target.value as PlanType)}
                      className="mr-3"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{plan.name}</span>
                        <span className="text-sm text-gray-600">最多 {plan.maxUsers} 人</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {plan.features.slice(0, 2).join('、')}
                        {plan.features.length > 2 && '...'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 提交錯誤 */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* 按鈕區域 */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#334d6d] text-white rounded-md hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  註冊中...
                </>
              ) : (
                '完成註冊'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
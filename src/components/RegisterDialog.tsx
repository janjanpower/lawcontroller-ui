import React, { useState } from 'react';
import { X, Building, User, Lock, Loader, Eye, EyeOff } from 'lucide-react';

interface SimpleRegisterData {
  firmName: string;
  account: string;
  password: string;
  confirmPassword: string;
}

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (result: { success: boolean; username: string }) => void;
}

export default function RegisterDialog({ isOpen, onClose, onRegisterSuccess }: RegisterDialogProps) {
  const [formData, setFormData] = useState<SimpleRegisterData>({
    firmName: '',
    account: '',
    password: '',
    confirmPassword: ''
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

    // 帳號驗證 (8-16位)
    if (!formData.account.trim()) {
      newErrors.account = '請輸入帳號';
    } else if (formData.account.length < 8 || formData.account.length > 16) {
      newErrors.account = '帳號需為 8~16 個字元';
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.account)) {
      newErrors.account = '帳號僅允許英數字、_ 與 -';
    }

    // 管理員密碼驗證 (8碼+大小寫英文至少各一個)
    if (!formData.password) {
      newErrors.password = '請輸入密碼';
    } else if (formData.password.length < 8) {
      newErrors.password = '密碼需至少 8 個字元';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = '密碼需包含至少一個大寫和一個小寫英文字母';
    }

    // 確認密碼驗證
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '請確認密碼';
    } else if (formData.password !== formData.confirmPassword) {
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
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firm_name: formData.firmName,
          account: formData.account,
          password: formData.password,
          confirm_password: formData.confirmPassword
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.requires_admin_setup) {
        onRegisterSuccess({ 
          success: true, 
          account: formData.account,
          firmId: data.firm_id,
          firmName: formData.firmName
        });
        handleClose();
      } else {
        setErrors({ submit: data.detail || data.message || '註冊失敗' });
      }

    } catch (error) {
      console.error('註冊請求失敗:', error);
      setErrors({ submit: `網路錯誤: ${error.message || '無法連接到伺服器，請確認後端服務是否啟動'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SimpleRegisterData, value: string) => {
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
      account: '',
      password: '',
      confirmPassword: ''
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

            {/* 帳號 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                帳號 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.account}
                onChange={(e) => handleInputChange('account', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.account ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="8~16個字元，英數字、_ 與 -"
                disabled={loading}
                maxLength={16}
              />
              {errors.account && (
                <p className="text-red-500 text-xs mt-1">{errors.account}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                此帳號將作為登入時的識別碼
              </p>
            </div>

            {/* 密碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-1" />
                事務所密碼 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
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
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* 確認密碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-1" />
                確認密碼 <span className="text-red-500">*</span>
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
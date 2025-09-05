import React, { useState } from 'react';
import { X, Building, User, Lock, Loader } from 'lucide-react';

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (result: RegisterResult) => void;
  apiBaseUrl: string;
}

interface RegisterResult {
  success: boolean;
  client_id: string;
  secret_code?: string;
  password: string;
}

export default function RegisterDialog({ isOpen, onClose, onRegisterSuccess, apiBaseUrl }: RegisterDialogProps) {
  const [formData, setFormData] = useState({
    client_name: '',
    client_id: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_name.trim()) {
      newErrors.client_name = '請輸入事務所名稱';
    }

    if (!formData.client_id.trim()) {
      newErrors.client_id = '請輸入 client_id';
    } else if (formData.client_id.length < 3 || formData.client_id.length > 32) {
      newErrors.client_id = 'client_id 需為 3~32 個字元';
    } else if (!/^[a-z0-9_\-]+$/.test(formData.client_id)) {
      newErrors.client_id = 'client_id 僅允許小寫英數字、_ 與 -';
    }

    if (formData.password.length < 6) {
      newErrors.password = '密碼需至少 6 個字元';
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
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_name: formData.client_name,
          client_id: formData.client_id.toLowerCase(),
          password: formData.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result: RegisterResult = {
          success: true,
          client_id: data.client_id || formData.client_id,
          secret_code: data.secret_code,
          password: formData.password,
        };

        onRegisterSuccess(result);
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `註冊失敗 (HTTP ${response.status})`;
        setErrors({ submit: errorMessage });
      }
    } catch (error) {
      console.error('註冊請求失敗:', error);
      setErrors({ submit: '網路錯誤，請檢查連線後重試' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'client_id' ? value.toLowerCase() : value
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
    setFormData({ client_name: '', client_id: '', password: '' });
    setErrors({});
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <User className="w-5 h-5 mr-2" />
            註冊用戶
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
                事務所名稱
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => handleInputChange('client_name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.client_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入事務所名稱"
                disabled={loading}
              />
              {errors.client_name && (
                <p className="text-red-500 text-xs mt-1">{errors.client_name}</p>
              )}
            </div>

            {/* 帳號 (client_id) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                帳號（client_id）
              </label>
              <input
                type="text"
                value={formData.client_id}
                onChange={(e) => handleInputChange('client_id', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.client_id ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="3~32個字元，僅限小寫英數字、_ 與 -"
                disabled={loading}
              />
              {errors.client_id && (
                <p className="text-red-500 text-xs mt-1">{errors.client_id}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                僅允許小寫英數字、底線(_) 與連字號(-)
              </p>
            </div>

            {/* 密碼 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4 inline mr-1" />
                密碼
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入密碼（至少6個字元）"
                disabled={loading}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
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
                '送出註冊'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
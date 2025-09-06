import React, { useState } from 'react';
import { X, User, Mail, Phone, Loader } from 'lucide-react';

interface AdminSetupData {
  adminName: string;
  adminEmail: string;
  adminPhone: string;
}

interface AdminSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  firmId: string;
  firmName: string;
  onSetupComplete: (adminUserId: string) => void;
}

export default function AdminSetupDialog({ 
  isOpen, 
  onClose, 
  firmId, 
  firmName, 
  onSetupComplete 
}: AdminSetupDialogProps) {
  const [formData, setFormData] = useState<AdminSetupData>({
    adminName: '',
    adminEmail: '',
    adminPhone: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.adminName.trim()) {
      newErrors.adminName = '請輸入管理員姓名';
    }

    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = '請輸入Email';
    } else if (!/^[^@]+@[^@]+\.[^@]+$/.test(formData.adminEmail)) {
      newErrors.adminEmail = 'Email格式不正確';
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
      const response = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firm_id: firmId,
          admin_name: formData.adminName,
          admin_email: formData.adminEmail,
          admin_phone: formData.adminPhone || undefined
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSetupComplete(data.admin_user_id);
        handleClose();
      } else {
        setErrors({ submit: data.detail || data.message || '設定管理員失敗' });
      }

    } catch (error) {
      console.error('設定管理員請求失敗:', error);
      setErrors({ submit: `網路錯誤: ${error.message || '無法連接到伺服器'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AdminSetupData, value: string) => {
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
      adminName: '',
      adminEmail: '',
      adminPhone: ''
    });
    setErrors({});
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold flex items-center">
            <User className="w-5 h-5 mr-2" />
            設定管理員
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
          {/* 事務所資訊 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6">
            <h3 className="font-medium text-blue-900 mb-1">{firmName}</h3>
            <p className="text-sm text-blue-700">
              請設定事務所的管理員資訊
            </p>
          </div>

          <div className="space-y-4">
            {/* 管理員姓名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                管理員姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.adminName}
                onChange={(e) => handleInputChange('adminName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.adminName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入管理員姓名"
                disabled={loading}
              />
              {errors.adminName && (
                <p className="text-red-500 text-xs mt-1">{errors.adminName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.adminEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入Email"
                disabled={loading}
              />
              {errors.adminEmail && (
                <p className="text-red-500 text-xs mt-1">{errors.adminEmail}</p>
              )}
            </div>

            {/* 電話（選填） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                電話 <span className="text-gray-400 text-xs">（選填）</span>
              </label>
              <input
                type="tel"
                value={formData.adminPhone}
                onChange={(e) => handleInputChange('adminPhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入電話號碼"
                disabled={loading}
              />
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
                  設定中...
                </>
              ) : (
                '完成設定'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
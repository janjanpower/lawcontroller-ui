import React, { useState, useEffect } from 'react';
import { User, FileText, X } from 'lucide-react';


interface CaseData {
  case_id?: string;
  case_type: string;
  client: string;
  lawyer?: string;
  legal_affairs?: string;
  case_reason?: string;
  case_number?: string;
  opposing_party?: string;
  court?: string;
  division?: string;
  progress?: string;
  progress_date?: string;
  created_date?: string;
}

interface CaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caseData: CaseData) => Promise<boolean>;
  caseData?: CaseData | null;
  mode: 'add' | 'edit';
}

const CASE_TYPES = ['民事', '刑事', '行政', '家事', '商事'];

export default function CaseForm({ isOpen, onClose, onSave, caseData, mode }: CaseFormProps) {
  const [formData, setFormData] = useState<CaseData>({
    case_type: '',
    client: '',
    lawyer: '',
    legal_affairs: '',
    case_reason: '',
    case_number: '',
    opposing_party: '',
    court: '',
    division: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && caseData) {
        setFormData({
          case_id: caseData.case_id,
          case_type: caseData.case_type || '',
          client: caseData.client || '',
          lawyer: caseData.lawyer || '',
          legal_affairs: caseData.legal_affairs || '',
          case_reason: caseData.case_reason || '',
          case_number: caseData.case_number || '',
          opposing_party: caseData.opposing_party || '',
          court: caseData.court || '',
          division: caseData.division || ''
        });
      } else {
        setFormData({
          case_type: '',
          client: '',
          lawyer: '',
          legal_affairs: '',
          case_reason: '',
          case_number: '',
          opposing_party: '',
          court: '',
          division: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, caseData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.case_type.trim()) {
      newErrors.case_type = '請選擇案件類型';
    }

    if (!formData.client.trim()) {
      newErrors.client = '請輸入當事人姓名';
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
      const firmCode = localStorage.getItem('law_firm_code') || 'default';
      
      // 準備要發送到後端的資料
      const caseDataForAPI = {
        firm_code: firmCode,
        case_type: formData.case_type,
        client_name: formData.client, // 暫時使用客戶名稱，後續可改為客戶ID
        case_reason: formData.case_reason,
        case_number: formData.case_number,
        opposing_party: formData.opposing_party,
        court: formData.court,
        division: formData.division,
        progress: formData.progress || '委任',
        progress_date: formData.progress_date || new Date().toISOString().split('T')[0],
        lawyer_name: formData.lawyer,
        legal_affairs_name: formData.legal_affairs
      };

      console.log('發送到後端的資料:', caseDataForAPI);

      if (mode === 'add') {
        // 新增案件 - 呼叫後端 API
        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(caseDataForAPI),
        });

        const data = await response.json();

        if (response.ok) {
          // 成功後呼叫前端的 onSave 回調
          const success = await onSave(formData);
          if (success) {
            onClose();
          }
        } else {
          throw new Error(data.detail || data.message || '新增案件失敗');
        }
      } else {
        // 編輯案件 - 呼叫後端 API
        const response = await fetch(`/api/cases/${formData.case_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            case_type: formData.case_type,
            case_reason: formData.case_reason,
            case_number: formData.case_number,
            opposing_party: formData.opposing_party,
            court: formData.court,
            division: formData.division,
            progress: formData.progress,
            progress_date: formData.progress_date
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // 成功後呼叫前端的 onSave 回調
          const success = await onSave(formData);
          if (success) {
            onClose();
          }
        } else {
          throw new Error(data.detail || data.message || '更新案件失敗');
        }
      }
    } catch (error) {
      console.error('保存案件失敗:', error);
      alert(`操作失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CaseData, value: string) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            {mode === 'add' ? '新增案件' : '編輯案件'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* 基本資訊區塊 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-[#334d6d]" />
                基本資訊
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 案件類型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    案件類型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.case_type}
                    onChange={(e) => handleInputChange('case_type', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                      errors.case_type ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">請選擇案件類型</option>
                    {CASE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.case_type && (
                    <p className="text-red-500 text-xs mt-1">{errors.case_type}</p>
                  )}
                </div>

                {/* 當事人 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    當事人 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.client}
                    onChange={(e) => handleInputChange('client', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                      errors.client ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="請輸入當事人姓名"
                  />
                  {errors.client && (
                    <p className="text-red-500 text-xs mt-1">{errors.client}</p>
                  )}
                </div>

                {/* 委任律師 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    委任律師
                  </label>
                  <input
                    type="text"
                    value={formData.lawyer}
                    onChange={(e) => handleInputChange('lawyer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入委任律師"
                  />
                </div>

                {/* 法務 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    法務
                  </label>
                  <input
                    type="text"
                    value={formData.legal_affairs}
                    onChange={(e) => handleInputChange('legal_affairs', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入法務"
                  />
                </div>
              </div>
            </div>

            {/* 詳細資訊區塊 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-[#334d6d]" />
                詳細資訊
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 案由 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    案由
                  </label>
                  <input
                    type="text"
                    value={formData.case_reason}
                    onChange={(e) => handleInputChange('case_reason', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入案由"
                  />
                </div>

                {/* 案號 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    案號
                  </label>
                  <input
                    type="text"
                    value={formData.case_number}
                    onChange={(e) => handleInputChange('case_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入案號"
                  />
                </div>

                {/* 對造 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    對造
                  </label>
                  <input
                    type="text"
                    value={formData.opposing_party}
                    onChange={(e) => handleInputChange('opposing_party', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入對造"
                  />
                </div>

                {/* 負責法院 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    負責法院
                  </label>
                  <input
                    type="text"
                    value={formData.court}
                    onChange={(e) => handleInputChange('court', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入負責法院"
                  />
                </div>

                {/* 負責股別 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    負責股別
                  </label>
                  <input
                    type="text"
                    value={formData.division}
                    onChange={(e) => handleInputChange('division', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入負責股別"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 按鈕區域 */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
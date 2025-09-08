import React, { useState, useEffect } from 'react';
import { User, FileText, X } from 'lucide-react';
import { getFirmCodeOrThrow } from '../utils/firm';

interface CaseData {
  case_id?: string;
  case_type: string;
  client: string;
  client_id_number?: string;
  client_phone?: string;
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
    division: '',
    progress: '委任',
    progress_date: new Date().toISOString().split('T')[0]
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
          division: caseData.division || '',
          progress: caseData.progress || '委任',
          progress_date: caseData.progress_date || new Date().toISOString().split('T')[0]
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
          division: '',
          progress: '委任',
          progress_date: new Date().toISOString().split('T')[0]
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
      const firmCode = getFirmCodeOrThrow();
      
      if (mode === 'add') {
        // 健康檢查
        const healthResponse = await fetch('/api/healthz', { method: 'GET' });
        if (!healthResponse.ok) throw new Error('後端服務不可用');
        const health = await healthResponse.json();
        if (!health?.ok) throw new Error(`服務異常（db=${health?.db ?? 'unknown'}）`);

        // 新增案件 - 呼叫後端 API
        const caseDataForAPI = {
          firm_code: firmCode,
          case_type: formData.case_type,
          client_name: formData.client,
          case_reason: formData.case_reason || '',
          case_number: formData.case_number || '',
          opposing_party: formData.opposing_party || '',
          court: formData.court || '',
          division: formData.division || '',
          progress: formData.progress || '委任',
          progress_date: formData.progress_date || new Date().toISOString().split('T')[0],
          lawyer_name: formData.lawyer || '',
          legal_affairs_name: formData.legal_affairs || ''
        };

        console.log('發送到後端的新增案件資料:', caseDataForAPI);

        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(caseDataForAPI),
        });

        console.log('後端回應狀態:', response.status, response.statusText);

        if (!response.ok) {
          let errorMessage = '新增案件失敗';
          let errorText = '';
          
          try {
            errorText = await response.text();
            console.error('後端錯誤回應內容:', errorText);
            
            if (errorText.trim().startsWith('<')) {
              errorMessage = `伺服器錯誤 (${response.status}): API 端點可能不存在或伺服器內部錯誤`;
            } else {
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.detail || errorData.message || errorMessage;
              } catch (parseError) {
                errorMessage = `伺服器錯誤 (${response.status}): ${errorText.substring(0, 100)}`;
              }
            }
          } catch (textError) {
            console.error('無法讀取錯誤回應:', textError);
            errorMessage = `伺服器錯誤 (${response.status}): 無法讀取錯誤詳情`;
          }
          
          throw new Error(errorMessage);
        }

        let responseData;
        try {
          const responseText = await response.text();
          console.log('後端成功回應原始內容:', responseText);
          
          if (!responseText.trim()) {
            throw new Error('後端回應為空');
          }
          
          if (responseText.trim().startsWith('<')) {
            throw new Error('後端回應了 HTML 而不是 JSON，可能是路由配置問題');
          }
          
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('解析後端回應失敗:', parseError);
          throw new Error('後端回應格式錯誤，無法解析 JSON');
        }
        
        console.log('後端回應成功:', responseData);

        // 將後端回應的資料轉換為前端格式
        const savedCaseData: CaseData = {
          case_id: responseData.id,
          case_type: responseData.case_type || formData.case_type,
          client: responseData.client?.name || formData.client,
          lawyer: responseData.lawyer?.full_name || formData.lawyer,
          legal_affairs: responseData.legal_affairs?.full_name || formData.legal_affairs,
          case_reason: responseData.case_reason || formData.case_reason,
          case_number: responseData.case_number || formData.case_number,
          opposing_party: responseData.opposing_party || formData.opposing_party,
          court: responseData.court || formData.court,
          division: responseData.division || formData.division,
          progress: responseData.progress || formData.progress,
          progress_date: responseData.progress_date || formData.progress_date
        };

        console.log('DEBUG: 準備呼叫 onSave，資料:', savedCaseData);
        
        // 呼叫前端的 onSave 回調
        const success = await onSave(savedCaseData);
        if (success) {
          console.log('DEBUG: onSave 成功，關閉對話框');
          onClose();
        } else {
          console.log('DEBUG: onSave 失敗');
        }
      } else {
        // 編輯案件 - 呼叫後端 API
        const updateData = {
          case_type: formData.case_type,
          case_reason: formData.case_reason,
          case_number: formData.case_number,
          opposing_party: formData.opposing_party,
          court: formData.court,
          division: formData.division,
          progress: formData.progress,
          progress_date: formData.progress_date
        };

        console.log('發送到後端的更新案件資料:', updateData);

        const firmCode = getFirmCodeOrThrow();
        const response = await fetch(`/api/cases/${formData.case_id}?firm_code=${encodeURIComponent(firmCode)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('後端回應錯誤:', errorText);
          let errorMessage = '更新案件失敗';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            errorMessage = `伺服器錯誤: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log('後端更新回應成功:', responseData);

        console.log('DEBUG: 準備呼叫 onSave (編輯模式)，資料:', formData);
        
        // 呼叫前端的 onSave 回調
        const success = await onSave(formData);
        if (success) {
          console.log('DEBUG: onSave (編輯模式) 成功，關閉對話框');
          onClose();
        } else {
          console.log('DEBUG: onSave (編輯模式) 失敗');
        }
      }
    } catch (error) {
      console.error('保存案件失敗:', error);
      setErrors({ submit: error.message || '操作失敗，請稍後再試' });
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
                <div>
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

                {/* 進度 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    目前進度
                  </label>
                  <input
                    type="text"
                    value={formData.progress}
                    onChange={(e) => handleInputChange('progress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入目前進度"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {errors.submit && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

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
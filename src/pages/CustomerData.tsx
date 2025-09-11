import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, Mail, MessageCircle, Calendar, Edit, X, Trash2, Plus } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';
import MobileCardList from '../components/MobileCardList';

// 編輯客戶對話框
interface EditCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  onSave: (customerData: any) => Promise<boolean>;
}

const EditCustomerDialog: React.FC<EditCustomerDialogProps> = ({
  isOpen,
  onClose,
  customer,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        notes: customer.notes || ''
      });
      setErrors({});
    }
  }, [isOpen, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrors({ name: '請輸入客戶姓名' });
      return;
    }

    setLoading(true);
    try {
      const success = await onSave(formData);
      if (success) {
        onClose();
      }
    } catch (error) {
      setErrors({ submit: error.message || '更新失敗' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">編輯客戶資料</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                客戶姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入客戶姓名"
                required
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入電話號碼"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入Email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入地址"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入備註"
              />
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{errors.submit}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
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
                  更新中...
                </>
              ) : (
                '更新'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function CustomerData() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // 載入客戶資料列表
  const loadCustomers = React.useCallback(async () => {
    try {
      const response = await apiFetch('/api/clients');
      const data = await response.json();

      if (response.ok) {
        setCustomers(data.items || []);
      } else {
        console.error('載入客戶資料失敗:', data.detail);
      }
    } catch (error) {
      console.error('載入客戶資料錯誤:', error);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // 搜尋和過濾功能
  useEffect(() => {
    let filtered = customers;

    // 狀態過濾
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // 搜尋過濾
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
        [c.name, c.phone, c.email, c.notes]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, customers, statusFilter]);

  // 編輯客戶
  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setShowEditDialog(true);
  };

  // 儲存客戶編輯
  const handleSaveCustomer = async (customerData) => {
    try {
      const response = await apiFetch(`/api/clients/${editingCustomer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(customerData)
      });

      if (response.ok) {
        await loadCustomers();
        return true;
      } else {
        const data = await response.json();
        throw new Error(data.detail || '更新客戶失敗');
      }
    } catch (error) {
      console.error('更新客戶失敗:', error);
      throw error;
    }
  };

  // 刪除客戶
  const handleDeleteCustomer = async (customer) => {
    if (confirm(`確定要刪除客戶「${customer.name}」嗎？\n\n注意：如果該客戶有關聯的案件，將無法刪除。`)) {
      try {
        const response = await apiFetch(`/api/clients/${customer.id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          await loadCustomers();
          if (selectedCustomer?.id === customer.id) {
            setSelectedCustomer(null);
          }
          alert('客戶已刪除');
        } else {
          const data = await response.json();
          alert(data.detail || '刪除客戶失敗');
        }
      } catch (error) {
        console.error('刪除客戶失敗:', error);
        alert('刪除失敗，請稍後再試');
      }
    }
  };

  const getStatusColor = React.useCallback((status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  }, []);

  const getStatusText = React.useCallback((status) => {
    switch (status) {
      case 'active':
        return '活躍';
      case 'inactive':
        return '非活躍';
      default:
        return '未知';
    }
  }, []);

  // 手機版卡片配置
  const mobileCardFields = [
    {
      key: 'phone',
      label: '電話',
      icon: Phone,
      show: (item) => !!item.phone
    },
    {
      key: 'email',
      label: 'Email',
      icon: Mail,
      show: (item) => !!item.email
    },
    {
      key: 'caseCount',
      label: '案件數',
      icon: FileText,
      render: (value) => `${value || 0} 件`
    },
    {
      key: 'created_at',
      label: '加入日期',
      icon: Calendar,
      render: (value) => value ? new Date(value).toLocaleDateString('zh-TW') : ''
    }
  ];

  const mobileCardActions = [
    {
      icon: Edit,
      label: '編輯',
      onClick: handleEditCustomer,
      color: 'text-blue-600 hover:text-blue-800'
    },
    {
      icon: Trash2,
      label: '刪除',
      onClick: handleDeleteCustomer,
      color: 'text-red-600 hover:text-red-800'
    }
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={() => {/* TODO: 實現新增客戶功能 */}}
              className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2 justify-center sm:justify-start"
            >
              <Plus className="w-4 h-4" />
              <span>新增客戶</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* 搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋客戶..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-sm w-full sm:w-64"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors self-center sm:self-auto"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 過濾器 */}
        {showFilters && (
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-700">狀態篩選：</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">全部</option>
              <option value="active">活躍</option>
              <option value="inactive">非活躍</option>
            </select>
          </div>
        )}

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCustomers.length}/{customers.length} 位客戶
          </div>
        )}
      </div>

      {/* 客戶列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCustomer ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            {/* 桌面版表格 */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      電話
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      案件數量
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      加入日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedCustomer?.id === customer.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.caseCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(customer.status)}`}>
                          {getStatusText(customer.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString('zh-TW') : ''}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機版卡片列表 - 使用新的 MobileCardList 組件 */}
            <div className="lg:hidden">
              <MobileCardList
                items={filteredCustomers}
                selectedItem={selectedCustomer}
                onSelectItem={setSelectedCustomer}
                title={(item) => item.name}
                badge={(item) => item.status ? {
                  text: getStatusText(item.status),
                  color: getStatusColor(item.status)
                } : null}
                fields={mobileCardFields}
                actions={mobileCardActions}
                emptyMessage="暫無客戶資料"
              />
            </div>
          </div>
        </div>

        {/* 右側詳情 */}
        {selectedCustomer && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">客戶詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditCustomer(selectedCustomer)}
                    className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>編輯</span>
                  </button>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 基本資訊 */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">姓名</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCustomer.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">電話</label>
                    <p className="text-sm text-gray-900 mt-1 flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      {selectedCustomer.phone || '未設定'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900 mt-1 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {selectedCustomer.email || '未設定'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">地址</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCustomer.address || '未設定'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">加入日期</label>
                    <p className="text-sm text-gray-900 mt-1 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString('zh-TW') : ''}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">案件數量</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCustomer.caseCount || 0} 件</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">狀態</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(selectedCustomer.status)}`}>
                    {getStatusText(selectedCustomer.status)}
                  </span>
                </div>
              </div>

              <hr className="my-6" />

              {/* 備註 */}
              <div>
                <label className="text-sm font-medium text-gray-500">備註</label>
                <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedCustomer.notes || '無備註'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 編輯客戶對話框 */}
      <EditCustomerDialog
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
      />
    </div>
  );
}
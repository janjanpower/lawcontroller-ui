import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, Mail, MessageCircle, Calendar, Edit, X, Trash2, Plus } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';

export default function CustomerData() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 全選狀態
  const allSelected =
    selectedCustomerIds.length > 0 &&
    selectedCustomerIds.length === filteredCustomers.length &&
    filteredCustomers.length > 0;

  // 載入客戶資料列表
  const loadCustomers = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/clients');
      const data = await response.json();

      if (response.ok) {
        setCustomers(data.items || []);
      } else {
        console.error('載入客戶資料失敗:', data.detail);
        setError('載入客戶資料失敗');
      }
    } catch (error) {
      console.error('載入客戶資料錯誤:', error);
      setError('無法連接到伺服器');
    } finally {
      setLoading(false);
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
        [c.name, c.phone, c.email, c.lineId, c.notes]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, customers, statusFilter]);

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

  // 勾選客戶
  const handleCustomerSelect = (customerId, checked) => {
    setSelectedCustomerIds(prev =>
      checked
        ? [...prev, customerId]
        : prev.filter(id => id !== customerId)
    );
  };

  // 全選/取消全選
  const handleSelectAll = (checked) => {
    setSelectedCustomerIds(checked ? filteredCustomers.map(c => c.id) : []);
  };

  // 刪除客戶
  const handleDeleteCustomer = async (customerId) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      if (confirm(`確定要刪除客戶「${customer.name}」嗎？此操作無法復原。`)) {
        const response = await apiFetch(`/api/clients/${customerId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setCustomers(prev => prev.filter(c => c.id !== customerId));
          setSelectedCustomerIds(prev => prev.filter(id => id !== customerId));
          if (selectedCustomer?.id === customerId) {
            setSelectedCustomer(null);
          }
          alert('客戶已刪除');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.detail || '刪除客戶失敗');
        }
      }
    } catch (error) {
      console.error('刪除客戶失敗:', error);
      alert(error.message || '刪除客戶失敗');
    }
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedCustomerIds.length === 0) return;

    const confirmMessage = `確定要刪除選中的 ${selectedCustomerIds.length} 位客戶嗎？此操作無法復原。`;
    if (!confirm(confirmMessage)) return;

    try {
      setLoading(true);
      for (const customerId of selectedCustomerIds) {
        const response = await apiFetch(`/api/clients/${customerId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `刪除客戶 ${customerId} 失敗`);
        }
      }

      setCustomers(prev => prev.filter(c => !selectedCustomerIds.includes(c.id)));
      setSelectedCustomerIds([]);
      setSelectedCustomer(null);
      alert(`成功刪除 ${selectedCustomerIds.length} 位客戶`);
    } catch (error) {
      console.error('批量刪除失敗:', error);
      alert(error.message || '批量刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <button
                className="bg-[#3498db] text-white px-3 py-3 sm:py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>新增客戶</span>
              </button>
            </div>
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
          </div>
        </div>

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredCustomers.length}/{customers.length} 位客戶
          </div>
        )}

        {/* 分界線上的篩選按鈕 - 懸停顯示 */}
        <div className="group absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 z-50">
          <div className="relative">
            {/* 觸發區域 */}
            <div className="w-16 h-4 bg-transparent cursor-pointer"></div>

            {/* 滑出的篩選按鈕 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                         opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100
                         transition-all duration-300 ease-out
                         p-2 bg-white border border-gray-300 rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 ${
                showFilters ? 'opacity-100 scale-100 bg-gray-100 border-gray-400' : ''
              }`}
            >
              <Filter className="w-4 h-4 text-gray-600" />
            </button>

            {/* 下拉選單 */}
            {showFilters && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilters(false)}
                />
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">狀態篩選</h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="statusFilter"
                        checked={statusFilter === 'all'}
                        onChange={() => setStatusFilter('all')}
                        className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                      />
                      <span className="text-gray-600">全部</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="statusFilter"
                        checked={statusFilter === 'active'}
                        onChange={() => setStatusFilter('active')}
                        className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                      />
                      <span className="text-gray-600">活躍</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="statusFilter"
                        checked={statusFilter === 'inactive'}
                        onChange={() => setStatusFilter('inactive')}
                        className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                      />
                      <span className="text-gray-600">非活躍</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 批量操作工具列 */}
        {selectedCustomerIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 px-4">
            <div className="animate-slide-up">
              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4">
                {/* 頂部：選中數量 */}
                <div className="text-center mb-3">
                  <span className="text-sm text-gray-700 font-medium">
                    已選擇 {selectedCustomerIds.length} 位客戶
                  </span>
                </div>

                {/* 手機版：垂直排列按鈕 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                    <button
                      onClick={() => handleSelectAll(true)}
                      disabled={allSelected}
                      className={`w-full sm:w-auto px-4 py-2 text-sm underline transition-colors rounded-md ${
                        allSelected
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      title="全選目前清單"
                    >
                      {allSelected ? '已全選' : '全選'}
                    </button>

                    <button
                      onClick={() => handleSelectAll(false)}
                      className="w-full sm:w-auto px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm underline transition-colors rounded-md"
                    >
                      取消選擇
                    </button>
                  </div>

                  {/* 分隔線 - 手機版隱藏 */}
                  <div className="hidden sm:block w-px h-5 bg-gray-300"></div>

                  <button
                    onClick={handleBatchDelete}
                    className="w-full sm:w-auto bg-red-500 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-red-600 flex items-center justify-center space-x-2 transition-all hover:shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>刪除</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 客戶列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedCustomer ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    選擇
                  </th>
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
                    LINE ID
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
                    onClick={(e) => {
                      // 防止在勾選時觸發詳情
                      if (e.target.type === 'checkbox' || e.target.closest('input[type="checkbox"]')) {
                        return;
                      }
                      setSelectedCustomer(customer);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
                        checked={selectedCustomerIds.includes(customer.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCustomerSelect(customer.id, e.target.checked);
                        }}
                      />
                    </td>
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
                      {customer.lineId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.caseCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(customer.status)}`}>
                        {getStatusText(customer.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.joinDate}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            // 編輯客戶邏輯
                            alert('編輯客戶功能開發中...');
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
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
        </div>

        {/* 右側詳情 */}
        {selectedCustomer && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">客戶詳情</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      // 編輯客戶邏輯
                      alert('編輯客戶功能開發中...');
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
                  </button>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-2 transition-colors"
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
                      {selectedCustomer.phone}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900 mt-1 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {selectedCustomer.email}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">LINE ID</label>
                  <p className="text-sm text-gray-900 mt-1 flex items-center">
                    <MessageCircle className="w-4 h-4 mr-1" />
                    {selectedCustomer.lineId}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">加入日期</label>
                    <p className="text-sm text-gray-900 mt-1 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {selectedCustomer.joinDate}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">案件數量</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedCustomer.caseCount} 件</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">最後聯繫</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedCustomer.lastContact || '無'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">狀態</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedCustomer.status)}`}>
                      {getStatusText(selectedCustomer.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
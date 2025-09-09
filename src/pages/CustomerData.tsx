import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, Mail, MessageCircle, Calendar, Eye, Edit, X } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow } from '../utils/api';

export default function CustomerData() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // 載入客戶資料列表
  const loadCustomers = async () => {
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
  };

  // 初始載入
  useEffect(() => {
    loadCustomers();
  }, []);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return '活躍';
      case 'inactive':
        return '非活躍';
      default:
        return '未知';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-[#334d6d]">客戶資料</h2>
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
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    電話
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
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {customer.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.phone}
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
                          onClick={() => setSelectedCustomer(customer)}
                          className="text-gray-400 hover:text-[#334d6d] transition-colors"
                          title="檢視"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
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
                  <button className="bg-[#334d6d] text-white px-4 py-2 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-2">
                    <Edit className="w-4 h-4" />
                    <span>編輯</span>
                  </button>
                  {/* 只保留手機版關閉按鈕 */}
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
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
                  <p className="text-sm text-gray-900 mt-1">{selectedCustomer.lastContact}</p>
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
                  {selectedCustomer.notes}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
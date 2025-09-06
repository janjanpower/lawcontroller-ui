import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, Mail, MessageCircle, Calendar, Eye, Edit, Trash2, Shield, UserCheck, UserX, X, Plus } from 'lucide-react';

// 模擬用戶資料
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    fullName: '系統管理員',
    role: 'admin',
    email: 'admin@testlaw.com.tw',
    phone: '02-1234-5678',
    department: '管理部',
    position: '系統管理員',
    isActive: true,
    createdAt: '2024-01-01',
    lastLogin: '2024-01-20 14:30'
  },
  {
    id: '2',
    username: 'lawyer01',
    fullName: '張律師',
    role: 'lawyer',
    email: 'zhang@testlaw.com.tw',
    phone: '02-1234-5679',
    department: '法務部',
    position: '資深律師',
    isActive: true,
    createdAt: '2024-01-02',
    lastLogin: '2024-01-19 16:45'
  },
  {
    id: '3',
    username: 'legal01',
    fullName: '李法務',
    role: 'legal_affairs',
    email: 'li@testlaw.com.tw',
    phone: '02-1234-5680',
    department: '法務部',
    position: '法務專員',
    isActive: true,
    createdAt: '2024-01-03',
    lastLogin: '2024-01-18 10:20'
  },
  {
    id: '4',
    username: 'assistant01',
    fullName: '王助理',
    role: 'assistant',
    email: 'wang@testlaw.com.tw',
    phone: '02-1234-5681',
    department: '行政部',
    position: '行政助理',
    isActive: false,
    createdAt: '2024-01-04',
    lastLogin: '2024-01-15 09:15'
  }
];

export default function UserManagement() {
  const [users, setUsers] = useState(mockUsers);
  const [filteredUsers, setFilteredUsers] = useState(mockUsers);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);

  // 搜尋和過濾功能
  useEffect(() => {
    let filtered = users;

    // 角色過濾
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // 狀態過濾
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.isActive === (statusFilter === 'active'));
    }

    // 搜尋過濾
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((u) =>
        [u.username, u.fullName, u.email, u.department, u.position]
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(term))
      );
    }

    setFilteredUsers(filtered);
  }, [searchTerm, users, roleFilter, statusFilter]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'lawyer':
        return 'bg-blue-100 text-blue-800';
      case 'legal_affairs':
        return 'bg-green-100 text-green-800';
      case 'assistant':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role) => {
    switch (role) {
      case 'admin':
        return '管理員';
      case 'lawyer':
        return '律師';
      case 'legal_affairs':
        return '法務';
      case 'assistant':
        return '助理';
      default:
        return '未知';
    }
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (isActive) => {
    return isActive ? '啟用' : '停用';
  };

  const handleToggleStatus = (userId) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    ));
  };

  const handleDeleteUser = (userId) => {
    if (confirm('確定要刪除此用戶嗎？此操作無法復原。')) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 頂部工具列 */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-[#334d6d]">人員權限</h2>
            <button
              onClick={() => setShowCreateUser(true)}
              className="bg-[#3498db] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#2980b9] transition-colors flex items-center space-x-2 justify-center sm:justify-start"
            >
              <Plus className="w-4 h-4" />
              <span>新增用戶</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* 搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜尋用戶..."
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
            <span className="text-sm font-medium text-gray-700">篩選條件：</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有角色</option>
              <option value="admin">管理員</option>
              <option value="lawyer">律師</option>
              <option value="legal_affairs">法務</option>
              <option value="assistant">助理</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
            >
              <option value="all">所有狀態</option>
              <option value="active">啟用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        )}

        {/* 搜尋結果統計 */}
        {searchTerm && (
          <div className="mt-2 text-sm text-green-600">
            找到 {filteredUsers.length}/{users.length} 位用戶
          </div>
        )}
      </div>

      {/* 用戶列表 + 右側詳情 */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* 列表 */}
        <div className={`flex-1 overflow-hidden ${selectedUser ? 'hidden lg:block' : ''}`}>
          <div className="h-full overflow-auto">
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用戶
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      角色
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      部門/職位
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最後登入
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-[#334d6d]' : ''
                      } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {user.fullName.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                            <div className="text-sm text-gray-500">{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {getRoleText(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{user.department}</div>
                        <div className="text-gray-500">{user.position}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.isActive)}`}>
                          {getStatusText(user.isActive)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin || '從未登入'}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="text-gray-400 hover:text-[#334d6d] transition-colors"
                            title="檢視"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditUser(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className={`transition-colors ${
                              user.isActive 
                                ? 'text-gray-400 hover:text-red-600' 
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                            title={user.isActive ? '停用' : '啟用'}
                          >
                            {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="刪除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手機版卡片列表 */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedUser?.id === user.id ? 'border-[#334d6d] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.fullName.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                        <div className="text-xs text-gray-500">{user.username}</div>
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {getRoleText(user.role)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {user.department} - {user.position}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.isActive)}`}>
                      {getStatusText(user.isActive)}
                    </span>
                    <div className="text-xs text-gray-500">
                      {user.lastLogin || '從未登入'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右側詳情 */}
        {selectedUser && (
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">用戶詳情</h3>
                <div className="flex items-center space-x-2">
                  {/* 手機版關閉按鈕 */}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setShowEditUser(true);
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <Edit className="w-3 h-3" />
                    <span>編輯</span>
                  </button>
                </div>
              </div>

              {/* 用戶頭像和基本資訊 */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#334d6d] rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                  {selectedUser.fullName.charAt(0)}
                </div>
                <h4 className="text-lg font-semibold text-gray-900">{selectedUser.fullName}</h4>
                <p className="text-sm text-gray-500">{selectedUser.username}</p>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(selectedUser.role)}`}>
                    {getRoleText(selectedUser.role)}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedUser.isActive)}`}>
                    {getStatusText(selectedUser.isActive)}
                  </span>
                </div>
              </div>

              {/* 詳細資訊 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">電話</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedUser.phone}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">部門</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.department}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">職位</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.position}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">建立日期</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.createdAt}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">最後登入</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedUser.lastLogin || '從未登入'}</p>
                  </div>
                </div>
              </div>

              {/* 權限管理 */}
              <hr className="my-6" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  權限設定
                </h4>
                <div className="space-y-2 text-sm">
                  {selectedUser.role === 'admin' && (
                    <>
                      <div className="flex items-center text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        系統管理權限
                      </div>
                      <div className="flex items-center text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        用戶管理權限
                      </div>
                    </>
                  )}
                  <div className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    案件管理權限
                  </div>
                  <div className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    客戶資料權限
                  </div>
                  {(selectedUser.role === 'lawyer' || selectedUser.role === 'legal_affairs') && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      檔案管理權限
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
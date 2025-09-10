import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, Mail, MessageCircle, Calendar, Eye, Edit, Trash2, Shield, UserCheck, UserX, X, Plus } from 'lucide-react';
import { apiFetch, getFirmCodeOrThrow, hasAuthToken, clearLoginAndRedirect } from '../utils/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUserData, setEditUserData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'lawyer'
  });
  const [createUserData, setCreateUserData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 取得當前用戶角色
  const getCurrentUserRole = () => {
    // 這裡應該從 localStorage 或其他地方取得當前用戶的角色
    // 暫時返回 'admin'，實際應用中需要正確實現
    return localStorage.getItem('law_user_role') || 'admin';
  };

  // 載入用戶列表
  const loadUsers = async () => {
    try {
      setLoading(true);
      const firmCode = getFirmCodeOrThrow();
      const response = await fetch(`/api/users?firm_code=${firmCode}`);
      const data = await response.json();

      if (response.ok) {
        // 轉換 API 資料格式
        const transformedUsers = (data.items || []).map((apiUser: any) => ({
          id: apiUser.id,
          username: apiUser.username,
          fullName: apiUser.full_name,
          email: apiUser.email,
          phone: apiUser.phone,
          role: apiUser.role,
          isActive: apiUser.is_active,
          createdAt: apiUser.created_at,
          lastLogin: apiUser.last_login,
          department: '法務部', // 預設值
          position: apiUser.role === 'admin' ? '管理員' :
                   apiUser.role === 'lawyer' ? '律師' :
                   apiUser.role === 'legal_affairs' ? '法務' : '助理'
        }));
        setUsers(transformedUsers);
      } else {
        console.error('載入用戶列表失敗:', data.detail);
        setError('載入用戶列表失敗');
      }
    } catch (error) {
      console.error('載入用戶列表錯誤:', error);
      setError('無法連接到伺服器');
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    loadUsers();
  }, []);

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

  const handleToggleStatus = async (userId) => {
    try {
      const response = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 更新本地狀態
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, isActive: data.is_active } : u
        ));
      } else {
        setError(data.detail || data.message || '切換用戶狀態失敗');
      }
    } catch (error) {
      console.error('切換用戶狀態錯誤:', error);
      setError('無法連接到伺服器');
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const adminPassword = prompt('請輸入管理員密碼以確認刪除：');
    if (!adminPassword) return;

    if (confirm(`確定要刪除用戶「${user.fullName}」嗎？此操作無法復原。`)) {
      try {
        const response = await fetch(`/api/users/${userId}?admin_password=${encodeURIComponent(adminPassword)}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setUsers(prev => prev.filter(u => u.id !== userId));
          if (selectedUser?.id === userId) {
            setSelectedUser(null);
          }
          alert('用戶已刪除');
        } else {
          setError(data.detail || data.message || '刪除用戶失敗');
        }
      } catch (error) {
        console.error('刪除用戶錯誤:', error);
        setError('無法連接到伺服器');
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 驗證表單
    if (!createUserData.username || !createUserData.fullName ||
        !createUserData.personalPassword ||
        !createUserData.confirmPersonalPassword) {
      setError('請填寫所有必填欄位');
      setLoading(false);
      return;
    }

    if (createUserData.personalPassword !== createUserData.confirmPersonalPassword) {
      setError('個人密碼確認不一致');
      setLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(createUserData.personalPassword)) {
      setError('個人密碼必須為6位數字');
      setLoading(false);
      return;
    }

    // 檢查用戶名是否重複
    if (users.some(u => u.username === createUserData.username)) {
      setError('用戶名已存在');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: createUserData.username,
          full_name: createUserData.fullName,
          email: createUserData.email,
          phone: createUserData.phone || null,
          role: createUserData.role,
          personal_password: createUserData.personalPassword,
          confirm_personal_password: createUserData.confirmPersonalPassword
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // 如果回應不是JSON格式，嘗試取得文字內容
        const text = await response.text();
        console.error('非JSON回應:', text);
        setError(`伺服器錯誤: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      if (response.ok) {
        // 重新載入用戶列表
        await loadUsers();

        // 重置表單
        setCreateUserData({
          username: '',
          fullName: '',
          email: '',
          phone: '',
          role: 'lawyer',
          personalPassword: '',
          confirmPersonalPassword: ''
        });
        setShowCreateUser(false);
        setError('');

        alert('用戶新增成功！');
      } else {
        setError(data.detail || data.message || '新增用戶失敗');
      }

    } catch (error) {
      console.error('新增用戶錯誤:', error);
      setError(`網路錯誤: ${error.message || '無法連接到伺服器'}`);
    } finally {
      setLoading(false);
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
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '從未登入'}
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
                              setEditUserData({
                                fullName: user.fullName,
                                email: user.email,
                                phone: user.phone || '',
                                role: user.role
                              });
                              setShowEditUser(true);
                              setSelectedUser(user);
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
                            style={{ display: getCurrentUserRole() === 'admin' ? 'block' : 'none' }}
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
                  className={`bg-white rounded-lg border p-4 transition-colors space-y-3 ${
                    selectedUser?.id === user.id ? 'border-[#334d6d] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <div
                      className="flex items-center cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="w-8 h-8 bg-[#334d6d] rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.fullName.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                        <div className="text-xs text-gray-500">{user.username}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="text-gray-500">角色：</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {getRoleText(user.role)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">狀態：</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.isActive)}`}>
                          {getStatusText(user.isActive)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600">
                      <div><span className="text-gray-500">部門：</span>{user.department}</div>
                      <div><span className="text-gray-500">職位：</span>{user.position}</div>
                      <div><span className="text-gray-500">Email：</span>{user.email}</div>
                      <div><span className="text-gray-500">電話：</span>{user.phone || '未設定'}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 border-t pt-2">
                      <div><span className="text-gray-500">最後登入：</span>{user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '從未登入'}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-end space-x-2 border-t pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditUserData({
                            fullName: user.fullName,
                            email: user.email,
                            phone: user.phone || '',
                            role: user.role
                          });
                          setShowEditUser(true);
                          setSelectedUser(user);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        編輯
                      </button>
                      {getCurrentUserRole() === 'admin' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(user.id);
                          }}
                          className={`text-xs ${
                            user.isActive
                              ? 'text-red-600 hover:text-red-800'
                              : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          {user.isActive ? '停用' : '啟用'}
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          刪除
                        </button>
                      )}
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
                  <button
                    onClick={() => {
                      setEditUserData({
                        fullName: selectedUser.fullName,
                        email: selectedUser.email,
                        phone: selectedUser.phone || '',
                        role: selectedUser.role
                      });
                      setShowEditUser(true);
                    }}
                    className="bg-[#334d6d] text-white px-3 py-1.5 rounded-md hover:bg-[#3f5a7d] transition-colors flex items-center space-x-1 text-sm"
                  >
                    <>
                      <Edit className="w-3 h-3" />
                      <span>編輯</span>
                    </>
                  </button>
                  {/* 統一的關閉按鈕 - 手機和桌面都在右邊 */}
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="關閉詳情"
                  >
                    <X className="w-4 h-4" />
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
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('zh-TW') : '從未登入'}
                    </p>
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
                  {selectedUser.role === 'admin' && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          // TODO: 實現轉讓管理員功能
                          alert('轉讓管理員功能開發中');
                        }}
                        className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700"
                      >
                        轉讓管理員
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 新增用戶對話框 */}
        {showCreateUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
                <h2 className="text-lg font-semibold">新增用戶</h2>
                <button
                  onClick={() => {
                    setShowCreateUser(false);
                    setError('');
                    setCreateUserData({
                      username: '',
                      fullName: '',
                      email: '',
                      phone: '',
                      role: 'lawyer',
                      personalPassword: '',
                      confirmPersonalPassword: ''
                    });
                  }}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用戶名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createUserData.username}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      placeholder="請輸入用戶名"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createUserData.fullName}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      placeholder="請輸入真實姓名"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-gray-400 text-xs">（選填）</span>
                    </label>
                    <input
                      type="email"
                      value={createUserData.email}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      placeholder="請輸入Email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話
                    </label>
                    <input
                      type="tel"
                      value={createUserData.phone}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      placeholder="請輸入電話號碼"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      角色 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createUserData.role}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    >
                      <option value="lawyer">律師</option>
                      <option value="legal_affairs">法務</option>
                      <option value="assistant">助理</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      個人密碼 (6位數字) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={createUserData.personalPassword}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, personalPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-center tracking-widest"
                      placeholder="請輸入6位數字密碼"
                      pattern="\d{6}"
                      maxLength={6}
                      minLength={6}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      確認個人密碼 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={createUserData.confirmPersonalPassword}
                      onChange={(e) => setCreateUserData(prev => ({ ...prev, confirmPersonalPassword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-center tracking-widest"
                      placeholder="請再次輸入密碼"
                      pattern="\d{6}"
                      maxLength={6}
                      minLength={6}
                      required
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateUser(false);
                      setError('');
                      setCreateUserData({
                        username: '',
                        fullName: '',
                        email: '',
                        phone: '',
                        role: 'lawyer',
                        personalPassword: '',
                        confirmPersonalPassword: ''
                      });
                    }}
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
                        新增中...
                      </>
                    ) : (
                      '新增用戶'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 編輯用戶對話框 */}
        {showEditUser && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
                <h2 className="text-lg font-semibold">編輯用戶</h2>
                <button
                  onClick={() => {
                    setShowEditUser(false);
                    setError('');
                  }}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setLoading(true);

                try {
                  const response = await fetch(`/api/users/${selectedUser.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      full_name: editUserData.fullName,
                      email: editUserData.email,
                      phone: editUserData.phone,
                      role: editUserData.role
                    }),
                  });

                  const data = await response.json();

                  if (response.ok) {
                    await loadUsers();
                    setShowEditUser(false);
                    setError('');
                    alert('用戶資料更新成功！');
                  } else {
                    setError(data.detail || data.message || '更新用戶失敗');
                  }
                } catch (error) {
                  console.error('更新用戶錯誤:', error);
                  setError(`網路錯誤: ${error.message || '無法連接到伺服器'}`);
                } finally {
                  setLoading(false);
                }
              }} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editUserData.fullName}
                      onChange={(e) => setEditUserData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-gray-400 text-xs">（選填）</span>
                    </label>
                    <input
                      type="email"
                      value={editUserData.email}
                      onChange={(e) => setEditUserData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話
                    </label>
                    <input
                      type="tel"
                      value={editUserData.phone}
                      onChange={(e) => setEditUserData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      角色 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editUserData.role}
                      onChange={(e) => setEditUserData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      disabled={selectedUser.role === 'admin'} // 管理員角色不能更改
                    >
                      <option value="admin">管理員</option>
                      <option value="lawyer">律師</option>
                      <option value="legal_affairs">法務</option>
                      <option value="assistant">助理</option>
                    </select>
                    {selectedUser.role === 'admin' && (
                      <p className="text-xs text-gray-500 mt-1">管理員角色無法更改</p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUser(false);
                      setError('');
                    }}
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
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { X, Users as UsersIcon, Plus, Trash2, Loader, Eye, EyeOff } from 'lucide-react';
import type { User as UserType, Firm, CreateUserData } from '../types';
import { PLANS } from '../types';
import { apiFetch } from '../utils/api';

interface UserSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  firm: Firm & { users: UserType[]; adminPassword: string };
  userPasswords: Record<string, string>;
  onComplete: () => void;
}

export default function UserSelectionDialog({
  isOpen,
  onClose,
  firm,
  onComplete,
}: UserSelectionDialogProps) {
  // 本地 users 狀態（用它來渲染）
  const [users, setUsers] = useState<UserType[]>([]);

  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [personalPassword, setPersonalPassword] = useState('');
  const [showPersonalPassword, setShowPersonalPassword] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordType, setDeletePasswordType] = useState<'admin' | 'personal'>('admin');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 新增用戶表單
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    fullName: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });

  // 載入用戶列表（僅顯示 is_active=true 由後端控制；DB 預設已改為 true）
  const loadUsers = async () => {
    if (!firm?.firmCode) return;
    try {
      setLoading(true);
      setError('');

      console.log('DEBUG: 開始載入用戶列表，firm_code:', firm.firmCode);

      const res = await fetch(`/api/users?firm_code=${encodeURIComponent(firm.firmCode)}`, {
        method: 'GET'
      });

      console.log('DEBUG: API 回應狀態:', res.status, res.statusText);

      const raw = await res.text();
      console.log('DEBUG: API 原始回應:', raw);

      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
        console.log('DEBUG: 解析後的資料:', data);
      } catch {
        console.error('Users API 非 JSON 回應：', raw);
      }
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
      }

      console.log('DEBUG: 開始轉換用戶資料，items 數量:', data?.items?.length || 0);

      const mapped: UserType[] = (data?.items ?? []).map((u: any, index: number) => {
        console.log(`DEBUG: 轉換用戶 ${index}:`, u);
        return {
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        role: u.role,
        isActive: Boolean(u.is_active),
        email: u.email,
        phone: u.phone,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        };
      });

      console.log('DEBUG: 轉換完成的用戶列表:', mapped);
      setUsers(mapped);
    } catch (e: any) {
      console.error('載入用戶列表失敗：', e);
      setUsers([]);
      setError(e?.message || '載入用戶列表失敗');
    } finally {
      setLoading(false);
    }
  };

  // 對話框打開時刷新清單
  useEffect(() => {
    if (isOpen && firm) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, firm]);

  // 選擇用戶
  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user);
    setPersonalPassword('');
    setError('');
  };

  // 個人密碼驗證
  const handlePersonalPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // 驗證密碼格式
    if (!/^\d{6}$/.test(personalPassword)) {
      setError('個人密碼必須為 6 位數字');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/verify-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          personal_password: personalPassword
        }),
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // 非 JSON 回應
        console.error('Verify API 非 JSON 回應：', raw);
      }

      if (!res.ok || (data && data.success === false)) {
        const msg =
          data?.detail || data?.message || data?.error ||
          (raw && raw.slice(0, 200)) ||
          `登入失敗：${res.status}`;
        throw new Error(msg);
      }

      // 成功：寫入 localStorage 並完成登入
      localStorage.setItem('law_user_id', selectedUser.id);
      localStorage.setItem('law_user_name', selectedUser.fullName || selectedUser.username);
      localStorage.setItem('law_user_role', selectedUser.role);
      localStorage.setItem('law_last_login', new Date().toISOString());
      
      console.log('登入資訊已儲存到 localStorage:', {
        user_id: selectedUser.id,
        user_name: selectedUser.fullName || selectedUser.username,
        user_role: selectedUser.role,
        firm_code: localStorage.getItem('law_firm_code') // 使用已存在的
      });

      onComplete();
    } catch (e: any) {
      console.error('個人密碼驗證失敗：', e);
      setError(e?.message || '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 新增用戶
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 驗證表單
    if (
      !createUserData.username ||
      !createUserData.fullName ||
      !createUserData.personalPassword ||
      !createUserData.confirmPersonalPassword
    ) {
      setError('請填寫所有必填欄位');
      return;
    }
    if (createUserData.personalPassword !== createUserData.confirmPersonalPassword) {
      setError('個人密碼確認不一致');
      return;
    }
    if (!/^\d{6}$/.test(createUserData.personalPassword)) {
      setError('個人密碼必須為 6 位數字');
      return;
    }
    if (users.length >= firm.maxUsers) {
      setError(`已達到方案用戶上限 (${firm.maxUsers} 人)`);
      return;
    }
    if (users.some(u => u.username === createUserData.username)) {
      setError('用戶名已存在');
      return;
    }

    setLoading(true);
    try {

      // 檢查是否為第一個用戶，如果是則設為管理員
      const existingUsersResponse = await fetch(`/api/users?firm_code=${firm.firmCode}`);
      const existingUsersData = await existingUsersResponse.json();
      const isFirstUser = !existingUsersData.items || existingUsersData.items.length === 0;

      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_code: firm.firmCode,
          username: createUserData.username,
          full_name: createUserData.fullName,
          email: `${createUserData.username}@${firm.firmName}.com`,
          role: isFirstUser ? 'admin' : createUserData.role,
          personal_password: createUserData.personalPassword,
          confirm_personal_password: createUserData.confirmPersonalPassword
        })
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('Create User 非 JSON 回應：', raw);
      }

      if (!res.ok || (data && data.success === false)) {
        const msg =
          data?.detail || data?.message || data?.error ||
          (raw && raw.slice(0, 200)) ||
          `伺服器錯誤: ${res.status}`;
        throw new Error(msg);
      }

      // 重新載入清單（避免欄位對齊問題）
      await loadUsers();

      // 重置表單 & UI
      setCreateUserData({
        username: '',
        fullName: '',
        role: 'lawyer',
        personalPassword: '',
        confirmPersonalPassword: ''
      });
      setShowCreateUser(false);
      setError('');
      alert('用戶新增成功！');

      if (isFirstUser) {
        alert('第一個用戶已設為管理員！');
      }
    } catch (e: any) {
      console.error('新增用戶失敗：', e);
      setError(e?.message || '新增用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  // 刪除用戶確認
  const handleDeleteUserConfirm = async () => {
    if (!deleteUserId) return;

    if (deletePasswordType === 'personal') {
      // 使用個人密碼刪除
      await handleDeleteWithPersonalPassword();
      return;
    }

    // 使用管理員密碼刪除
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(deleteUserId)}?admin_password=${encodeURIComponent(deletePassword)}`,
        { method: 'DELETE' }
      );

      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('Delete User 非 JSON 回應：', raw);
      }

      const ok = res.ok && (data?.success === true || data?.deleted === true || !data);
      if (!ok) {
        const msg =
          data?.detail || data?.message || data?.error ||
          (raw && raw.slice(0, 200)) ||
          `刪除用戶失敗: ${res.status}`;
        throw new Error(msg);
      }

      await loadUsers();

      setDeleteUserId(null);
      setDeletePassword('');
      setError('');
      alert('用戶已刪除');
    } catch (e: any) {
      console.error('刪除用戶請求失敗：', e);
      setError(e?.message || '刪除用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  // 使用個人密碼刪除用戶
  const handleDeleteWithPersonalPassword = async () => {
    if (!deleteUserId) return;
    setLoading(true);
    setError('');
    try {
      // 先驗證個人密碼
      const verifyRes = await apiFetch('/api/auth/verify-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: deleteUserId,
          personal_password: deletePassword
        }),
      });

      if (!verifyRes.ok) {
        throw new Error('個人密碼錯誤');
      }

      // 密碼驗證成功，執行刪除
      const deleteRes = await fetch(`/api/users/${encodeURIComponent(deleteUserId)}/delete-self`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal_password: deletePassword })
      });

      const raw = await deleteRes.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('Delete User 非 JSON 回應：', raw);
      }

      const ok = deleteRes.ok && (data?.success === true || data?.deleted === true || !data);
      if (!ok) {
        const msg = data?.detail || data?.message || data?.error || `刪除用戶失敗: ${deleteRes.status}`;
        throw new Error(msg);
      }

      await loadUsers();
      setDeleteUserId(null);
      setDeletePassword('');
      setError('');
      alert('用戶已刪除');
    } catch (e: any) {
      console.error('使用個人密碼刪除用戶失敗：', e);
      setError(e?.message || '刪除用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !firm) return null;

  const activeUsers = users.filter(u => u.isActive);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <UsersIcon className="w-5 h-5 mr-2" />
            {selectedUser ? '個人密碼驗證' : '選擇用戶'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {selectedUser ? (
            // 個人密碼驗證
            <div className="space-y-4 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-center space-y-2">
                  <h3 className="font-medium text-blue-900 text-lg">{selectedUser.fullName || selectedUser.username}</h3>
                  <div className="space-y-1">
                    <p className="text-sm text-blue-700">暱稱：{selectedUser.username}</p>
                    <p className="text-sm text-blue-700">部門：法務部</p>
                    <p className="text-sm text-blue-700">職位：{selectedUser.role === 'admin' ? '管理員' : selectedUser.role === 'lawyer' ? '律師' : '法務'}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePersonalPasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-center">個人密碼</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={personalPassword}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPersonalPassword(value);
                      }}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none text-center tracking-widest"
                      style={{
                        WebkitTextSecurity: showPersonalPassword ? 'none' : 'disc',
                        MozAppearance: 'textfield'
                      }}
                      placeholder="請輸入 6 位數字密碼"
                      maxLength={6}
                      required
                      onWheel={(e) => e.preventDefault()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPersonalPassword(!showPersonalPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    >
                      {showPersonalPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400 text-center"
                  >
                    返回上一步
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 flex items-center justify-center text-center"
                  >
                    {loading ? (<><Loader className="w-4 h-4 mr-2 animate-spin" />登入中...</>) : '登入系統'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // 用戶選擇
            <div className="space-y-4 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h3 className="font-medium text-blue-900 mb-1 text-center">{firm.firmName}</h3>
                <p className="text-sm text-blue-700 text-center">
                  {PLANS[firm.plan].name} - {users.length}/{firm.maxUsers} 用戶
                </p>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-900 text-center flex-1">選擇登入用戶</h3>
                <button
                  onClick={() => setShowCreateUser(true)}
                  disabled={users.length >= firm.maxUsers}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  新增用戶
                </button>
              </div>

              {showCreateUser && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                  <h4 className="font-medium text-gray-900">新增用戶</h4>
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">用戶名</label>
                      <input
                        type="text"
                        value={createUserData.username}
                        onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none"
                        placeholder="請輸入用戶名"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">姓名</label>
                      <input
                        type="text"
                        value={createUserData.fullName}
                        onChange={(e) => setCreateUserData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none"
                        placeholder="請輸入真實姓名"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">角色</label>
                      <select
                        value={createUserData.role}
                        onChange={(e) => setCreateUserData(prev => ({ ...prev, role: e.target.value as any }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none"
                      >
                        <option value="lawyer">律師</option>
                        <option value="legal_affairs">法務</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">個人密碼 (6位數字)</label>
                      <input
                        type="text"
                        value={createUserData.personalPassword}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setCreateUserData(prev => ({ ...prev, personalPassword: value }));
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none text-center tracking-widest"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                        placeholder="請輸入 6 位數字密碼"
                        maxLength={6}
                        onWheel={(e) => e.preventDefault()}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">確認個人密碼</label>
                      <input
                        type="text"
                        value={createUserData.confirmPersonalPassword}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setCreateUserData(prev => ({ ...prev, confirmPersonalPassword: value }));
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none text-center tracking-widest"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                        placeholder="請再次輸入密碼"
                        maxLength={6}
                        onWheel={(e) => e.preventDefault()}
                        required
                      />
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateUser(false)}
                        className="flex-1 bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-[#334d6d] text-white px-3 py-1 rounded text-sm hover:bg-[#3f5a7d] disabled:opacity-50"
                      >
                        {loading ? '新增中...' : '新增'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 用戶列表（使用本地 users state） */}
              <div className="space-y-2">
                {loading && users.length === 0 ? (
                  <div className="text-sm text-gray-500">載入中...</div>
                ) : activeUsers.length === 0 ? (
                  <div className="text-sm text-gray-400">尚無啟用中的使用者</div>
                ) : (
                  <div className="space-y-2">
                    {activeUsers.map(user => (
                      <div key={user.id} className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50">
                        <button onClick={() => handleUserSelect(user)} className="flex-1 text-center">
                          <div className="font-medium text-gray-900 text-center">{user.fullName || user.username}</div>
                          <div className="text-sm text-gray-500 text-center">
                            {user.username} - {user.role === 'admin' ? '管理員' : user.role === 'lawyer' ? '律師' : '法務'}
                          </div>
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => setDeleteUserId(user.id)}
                            className="text-red-600 hover:text-red-800 p-1 ml-2"
                            title="刪除用戶"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 顯示用戶數量限制 */}
                {users.length >= firm.maxUsers && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="text-sm text-red-700 text-center">
                      已達到方案用戶上限 ({users.length}/{firm.maxUsers} 人)
                    </div>
                  </div>
                )}
              </div>

              {error && !selectedUser && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-700 text-center">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 刪除用戶確認對話框 */}
        {deleteUserId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">確認刪除用戶</h3>

              {/* 密碼類型選擇 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">驗證方式</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="admin"
                      checked={deletePasswordType === 'admin'}
                      onChange={(e) => {
                        setDeletePasswordType(e.target.value as 'admin' | 'personal');
                        setDeletePassword('');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">管理員密碼</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="personal"
                      checked={deletePasswordType === 'personal'}
                      onChange={(e) => {
                        setDeletePasswordType(e.target.value as 'admin' | 'personal');
                        setDeletePassword('');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">個人密碼</span>
                  </label>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                請輸入{deletePasswordType === 'admin' ? '管理員' : '個人'}密碼以確認刪除用戶：
                <strong className="ml-1">
                  {users.find(u => u.id === deleteUserId)?.fullName || users.find(u => u.id === deleteUserId)?.username}
                </strong>
              </p>

              <div className="relative mb-4">
                <input
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => {
                    if (deletePasswordType === 'personal') {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setDeletePassword(value);
                    } else {
                      setDeletePassword(e.target.value);
                    }
                  }}
                  className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none ${
                    deletePasswordType === 'personal' ? 'text-center tracking-widest' : ''
                  }`}
                  placeholder={deletePasswordType === 'admin' ? '請輸入管理員密碼' : '請輸入 6 位數字密碼'}
                  maxLength={deletePasswordType === 'personal' ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                >
                  {showDeletePassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setDeleteUserId(null);
                    setDeletePassword('');
                    setDeletePasswordType('admin');
                    setShowDeletePassword(false);
                    setError('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteUserConfirm}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
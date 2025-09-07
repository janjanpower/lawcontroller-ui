import React, { useState } from 'react';
import { X, Users, Plus, Trash2, User, Eye, EyeOff, Loader } from 'lucide-react';
import type { User as UserType, Firm, CreateUserData } from '../types';
import { PLANS } from '../types';

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
  userPasswords,
  onComplete
}: UserSelectionDialogProps) {
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [personalPassword, setPersonalPassword] = useState('');
  const [showPersonalPassword, setShowPersonalPassword] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 調試日誌
  useEffect(() => {
    console.log('UserSelectionDialog render:', {
      isOpen,
      firm: !!firm,
      firmName: firm?.firmName,
      usersCount: firm?.users?.length,
      hasPlan: firm?.hasPlan,
      canUseFree: firm?.canUseFree
    });
  }, [isOpen, firm]);

  // 新增用戶表單
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    fullName: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });

  // 載入用戶列表的函數
  const loadUsers = async () => {
    if (!firm?.firmCode) return;
    
    try {
      console.log('載入用戶列表，事務所代碼:', firm.firmCode);
      const response = await fetch(`/api/users?firm_code=${firm.firmCode}`);
      
      console.log('用戶列表 API 回應狀態:', response.status);
      
      const responseText = await response.text();
      console.log('用戶列表 API 原始回應:', responseText);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('用戶列表載入成功:', data);
        
        // 更新 firm 中的用戶列表
        if (firm && data.items) {
          console.log('轉換用戶資料，原始數量:', data.items.length);
          firm.users = data.items.map((apiUser: any) => ({
            id: apiUser.id,
            username: apiUser.username,
            fullName: apiUser.full_name,
            role: apiUser.role,
            isActive: apiUser.is_active
          }));
          firm.currentUsers = data.items.length;
          console.log('轉換後用戶數量:', firm.users.length);
          console.log('用戶列表:', firm.users);
        }
      } else {
        console.error('載入用戶列表失敗:', response.status, response.statusText, responseText);
      }
    } catch (error) {
      console.error('載入用戶列表錯誤:', error);
    }
  };

  // 當對話框開啟時載入用戶列表
  useEffect(() => {
    if (isOpen && firm) {
      loadUsers();
    }
  }, [isOpen, firm?.firmCode]);

  // 選擇用戶
  const handleUserSelect = (user: UserType) => {
    console.log('選擇用戶:', user.fullName);
    setSelectedUser(user);
    setPersonalPassword('');
    setError('');
  };

  // 個人密碼驗證
  const handlePersonalPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setError('');
    setLoading(true);

    console.log('開始個人密碼驗證:', {
      userId: selectedUser.id,
      username: selectedUser.username,
      passwordLength: personalPassword.length
    });
    try {
      const response = await fetch('/api/auth/verify-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          personal_password: personalPassword
        }),
      });

      console.log('密碼驗證 API 回應狀態:', response.status);
      
      const responseText = await response.text();
      console.log('密碼驗證 API 原始回應:', responseText);
      
      const data = await response.json();
      console.log('密碼驗證解析後資料:', data);
    } catch {
      setError('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 新增用戶
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 驗證表單
    if (
      !createUserData.username ||
      !createUserData.fullName ||
      !createUserData.personalPassword ||
      !createUserData.confirmPersonalPassword
    ) {
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

    // 檢查用戶數量限制
    if (firm.currentUsers >= firm.maxUsers) {
      setError(`已達到方案用戶上限 (${firm.maxUsers} 人)`);
      setLoading(false);
      return;
    }

    // 檢查用戶名是否重複
    if (firm.users.some((u) => u.username === createUserData.username)) {
      setError('用戶名已存在');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_code: firm.firmCode,
          username: createUserData.username,
          full_name: createUserData.fullName,
          email: `${createUserData.username}@${firm.firmName}.com`,
          role: createUserData.role,
          personal_password: createUserData.personalPassword,
          confirm_personal_password: createUserData.confirmPersonalPassword
        })
      });

      // 只讀一次 body：先拿文字，再嘗試 parse JSON
      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // 非 JSON 回應時，raw 會保留給除錯用
        console.error('非JSON回應:', raw);
      }

      // 成功條件：HTTP 2xx 且（若 data 存在）沒有顯示的失敗旗標
      const isSuccess = response.ok && (!data || data.success !== false);

      if (!isSuccess) {
        const msg =
          (data && (data.detail || data.message || data.error)) ||
          (raw && raw.slice(0, 200)) ||
          `伺服器錯誤: ${response.status} ${response.statusText}`;
        setError(msg);
        setLoading(false);
        return;
      }

      // 新增成功：從 data 取回使用者欄位
      const newUser: UserType = {
        id: data.id,
        username: data.username,
        fullName: data.full_name,
        role: data.role,
        isActive: data.is_active,
        email: data.email,
        phone: data.phone,
        createdAt: data.created_at,
        lastLogin: data.last_login
      };

      // 更新本地狀態
      if (firm.users) {
        firm.users.push(newUser);
        firm.currentUsers += 1;
      }

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
    } catch (err) {
      console.error('新增用戶請求失敗:', err);
      setError(`網路錯誤: ${err instanceof Error ? err.message : '無法連接到伺服器'}`);
    } finally {
      setLoading(false);
    }
  };

      if (response.ok && data.success) {
        console.log('個人密碼驗證成功，準備登入系統');
        
        // 儲存登入資訊
        localStorage.setItem('law_token', data.token || 'dummy_token');
        localStorage.setItem('law_user_id', selectedUser.id);
        localStorage.setItem('law_user_name', selectedUser.fullName);
        localStorage.setItem('law_firm_id', firm.id);
        localStorage.setItem('law_firm_code', firm.firmCode);
        
        console.log('登入資訊已儲存到 localStorage');
        
        onComplete();
        // 個人密碼驗證成功，完成登入流程
        localStorage.setItem('law_token', data.token || 'dummy_token');
        localStorage.setItem('law_user_id', selectedUser.id);
        localStorage.setItem('law_firm_id', firm.id);
        
        onComplete();
      } else {
        console.error('密碼驗證失敗:', data);
        setError(data.detail || data.message || '個人密碼錯誤');
      }

      console.error('密碼驗證請求錯誤:', error);
  // 刪除用戶確認
  const handleDeleteUserConfirm = async () => {
    if (!deleteUserId) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/users/${deleteUserId}?admin_password=${encodeURIComponent(deletePassword)}`,
        { method: 'DELETE' }
      );

      // 只讀一次 body
      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('非JSON回應:', raw);
      }

      const isSuccess =
        response.ok &&
        ((data && (data.success === true || data.deleted === true)) || !data); // 盡量相容不同後端回應

      if (!isSuccess) {
        const msg =
          (data && (data.detail || data.message || data.error)) ||
          (raw && raw.slice(0, 200)) ||
          `刪除用戶失敗: ${response.status} ${response.statusText}`;
        setError(msg);
        setLoading(false);
        return;
      }

      // 刪除成功，更新本地狀態
      await loadUsers();

      setDeleteUserId(null);
      setDeletePassword('');
      setError('');

      alert('用戶已刪除');
    } catch (err) {
      console.error('刪除用戶請求失敗:', err);
      setError(`網路錯誤: ${err instanceof Error ? err.message : '無法連接到伺服器'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!firm) {
    console.log('UserSelectionDialog: firm is null, closing dialog');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 標題列 */}
        <div className="bg-[#334d6d] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <Users className="w-5 h-5 mr-2" />
            {selectedUser ? '個人密碼驗證' : '選擇用戶'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* 個人密碼驗證視窗 */}
          {selectedUser ? (
            <div className="space-y-4">
              {/* 用戶資訊 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h3 className="font-medium text-blue-900">{selectedUser.fullName}</h3>
                <p className="text-sm text-blue-700">{selectedUser.username}</p>
              </div>

              <form onSubmit={handlePersonalPasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">個人密碼</label>
                  <div className="relative">
                    <input
                      type={showPersonalPassword ? 'text' : 'password'}
                      value={personalPassword}
                      onChange={(e) => setPersonalPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                      placeholder="請輸入6位數字密碼"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                    />
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
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
                  >
                    返回上一步
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        登入中...
                      </>
                    ) : (
                      '登入系統'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* 用戶選擇視窗 */
            <div className="space-y-4">
              {/* 事務所資訊 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h3 className="font-medium text-blue-900 mb-1">{firm.firmName}</h3>
                <p className="text-sm text-blue-700">
                  {PLANS[firm.plan].name} - {firm.currentUsers}/{firm.maxUsers} 用戶
                </p>
              </div>

              {/* 用戶管理按鈕 */}
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-900">選擇登入用戶</h3>
                <button
                  onClick={() => setShowCreateUser(true)}
                  disabled={firm.currentUsers >= firm.maxUsers}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  新增用戶
                </button>
              </div>

              {/* 新增用戶表單 */}
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
                        type="password"
                        value={createUserData.personalPassword}
                        onChange={(e) => setCreateUserData(prev => ({ ...prev, personalPassword: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none"
                        placeholder="請輸入6位數字密碼"
                        pattern="\d{6}"
                        maxLength={6}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">確認個人密碼</label>
                      <input
                        type="password"
                        value={createUserData.confirmPersonalPassword}
                        onChange={(e) => setCreateUserData(prev => ({ ...prev, confirmPersonalPassword: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#334d6d] outline-none"
                        placeholder="請再次輸入密碼"
                        pattern="\d{6}"
                        maxLength={6}
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

              {/* 用戶列表 */}
              <div className="space-y-2">
                {firm.users.filter(u => u.isActive).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50">
                    <button
                      onClick={() => handleUserSelect(user)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-sm text-gray-500">{user.username} - {
                        user.role === 'admin' ? '管理員' :
                        user.role === 'lawyer' ? '律師' : '法務'
                      }</div>
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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-700">{error}</div>
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
              <p className="text-sm text-gray-600 mb-4">
                請輸入管理員密碼以確認刪除用戶：
                <strong>{firm.users.find(u => u.id === deleteUserId)?.fullName}</strong>
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none mb-4"
                placeholder="請輸入管理員密碼"
              />
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
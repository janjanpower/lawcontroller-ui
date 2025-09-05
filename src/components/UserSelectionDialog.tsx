import React, { useState } from 'react';
import { X, Users, Plus, Trash2, Loader } from 'lucide-react';
import { PLANS } from '../types';
import type { User as UserType, Firm, CreateUserData } from '../types';

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
  console.log('UserSelectionDialog render:', { isOpen, firm: !!firm });

  // 新增用戶表單
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    fullName: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });

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

    setError('');
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const correctPassword = userPasswords[selectedUser.id];
      if (personalPassword !== correctPassword) {
        setError('個人密碼錯誤');
        return;
      }

      // 登入成功
      localStorage.setItem('law_token', 'demo_token');
      localStorage.setItem('law_user', JSON.stringify(selectedUser));
      localStorage.setItem('law_firm', JSON.stringify(firm));

      window.location.assign('/cases');

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

    // 驗證表單
    if (!createUserData.username || !createUserData.fullName ||
        !createUserData.personalPassword || !createUserData.confirmPersonalPassword) {
      setError('請填寫所有必填欄位');
      return;
    }

    if (createUserData.personalPassword !== createUserData.confirmPersonalPassword) {
      setError('個人密碼確認不一致');
      return;
    }

    if (!/^\d{6}$/.test(createUserData.personalPassword)) {
      setError('個人密碼必須為6位數字');
      return;
    }

    // 檢查用戶數量限制
    if (firm.currentUsers >= firm.maxUsers) {
      setError(`已達到方案用戶上限 (${firm.maxUsers} 人)`);
      return;
    }

    // 檢查用戶名是否重複
    if (firm.users.some(u => u.username === createUserData.username)) {
      setError('用戶名已存在');
      return;
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模擬新增用戶
      const newUser: UserType = {
        id: String(Date.now()),
        firmId: firm.id,
        username: createUserData.username,
        fullName: createUserData.fullName,
        role: createUserData.role,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // 更新模擬資料
      firm.users.push(newUser);
      firm.currentUsers++;
      userPasswords[newUser.id] = createUserData.personalPassword;

      // 重置表單
      setCreateUserData({
        username: '',
        fullName: '',
        role: 'lawyer',
        personalPassword: '',
        confirmPersonalPassword: ''
      });

      setShowCreateUser(false);
      alert('用戶新增成功！');

    } catch {
      setError('新增用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  // 刪除用戶確認
  const handleDeleteUserConfirm = async () => {
    if (!deleteUserId) return;

    // 驗證管理員密碼
    if (deletePassword !== firm.adminPassword) {
      setError('管理員密碼錯誤');
      return;
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新模擬資料
      firm.users = firm.users.filter(u => u.id !== deleteUserId);
      firm.currentUsers--;
      delete userPasswords[deleteUserId];

      setDeleteUserId(null);
      setDeletePassword('');
      alert('用戶已刪除');

    } catch {
      setError('刪除用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!firm) {
    console.log('UserSelectionDialog: firm is null');
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
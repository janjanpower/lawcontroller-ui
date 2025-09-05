import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Building, Users, Plus, Trash2, Loader } from 'lucide-react';
import type {
  LoginCredentials,
  UserLoginCredentials,
  User as UserType,
  Firm,
  CreateUserData,
  PlanType,
  PLANS
} from '../types';

const API_BASE = import.meta.env.VITE_NEXT_PUBLIC_API_BASE || 'https://api.128-199-65-122.sslip.io';

// 模擬資料
const mockFirms: Record<string, Firm & { users: UserType[]; adminPassword: string }> = {
  'TEST001': {
    id: '1',
    firmName: '測試法律事務所',
    firmCode: 'TEST001',
    plan: 'basic',
    currentUsers: 3,
    maxUsers: 5,
    createdAt: '2024-01-01',
    isActive: true,
    adminPassword: 'Admin123!',
    users: [
      {
        id: '1',
        firmId: '1',
        username: 'admin',
        fullName: '系統管理員',
        role: 'admin',
        isActive: true,
        createdAt: '2024-01-01'
      },
      {
        id: '2',
        firmId: '1',
        username: 'lawyer01',
        fullName: '張律師',
        role: 'lawyer',
        isActive: true,
        createdAt: '2024-01-02'
      },
      {
        id: '3',
        firmId: '1',
        username: 'legal01',
        fullName: '李法務',
        role: 'legal_affairs',
        isActive: true,
        createdAt: '2024-01-03'
      }
    ]
  }
};

// 模擬用戶個人密碼
const mockUserPasswords: Record<string, string> = {
  '1': '123456',
  '2': '234567',
  '3': '345678'
};

export default function LoginPage() {
  // 登入流程狀態
  const [loginStep, setLoginStep] = useState<'firm' | 'user' | 'password'>('firm');
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // 表單資料
  const [firmCredentials, setFirmCredentials] = useState<LoginCredentials>({
    firmCode: '',
    username: '',
    password: ''
  });

  const [userCredentials, setUserCredentials] = useState<UserLoginCredentials>({
    userId: '',
    personalPassword: ''
  });

  // UI 狀態
  const [showPassword, setShowPassword] = useState(false);
  const [showPersonalPassword, setShowPersonalPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 用戶管理狀態
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    fullName: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('law_token');
    if (token) {
      window.location.replace('/cases');
    }
  }, []);

  // 第一步：事務所登入
  const handleFirmLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 內建測試帳密
      if (firmCredentials.firmCode === 'TEST001' &&
          firmCredentials.username === 'admin' &&
          firmCredentials.password === 'Admin123!') {

        const firm = mockFirms['TEST001'];
        setSelectedFirm(firm);
        setLoginStep('user');
        setLoading(false);
        return;
      }

      // 模擬 API 呼叫
      await new Promise(resolve => setTimeout(resolve, 1000));

      const firm = mockFirms[firmCredentials.firmCode];
      if (!firm || firm.adminPassword !== firmCredentials.password) {
        setError('事務所代碼、帳號或密碼錯誤');
        setLoading(false);
        return;
      }

      setSelectedFirm(firm);
      setLoginStep('user');

    } catch {
      setError('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 第二步：選擇用戶
  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user);
    setUserCredentials({ userId: user.id, personalPassword: '' });
    setLoginStep('password');
  };

  // 第三步：個人密碼驗證
  const handlePersonalPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const correctPassword = mockUserPasswords[userCredentials.userId];
      if (userCredentials.personalPassword !== correctPassword) {
        setError('個人密碼錯誤');
        setLoading(false);
        return;
      }

      // 登入成功
      localStorage.setItem('law_token', 'demo_token');
      localStorage.setItem('law_user', JSON.stringify(selectedUser));
      localStorage.setItem('law_firm', JSON.stringify(selectedFirm));

      window.location.assign('/cases');

    } catch {
      setError('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 用戶管理功能
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

    if (!selectedFirm) return;

    // 檢查用戶數量限制
    if (selectedFirm.currentUsers >= selectedFirm.maxUsers) {
      setError(`已達到方案用戶上限 (${selectedFirm.maxUsers} 人)`);
      return;
    }

    // 檢查用戶名是否重複
    if (selectedFirm.users.some(u => u.username === createUserData.username)) {
      setError('用戶名已存在');
      return;
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模擬新增用戶
      const newUser: UserType = {
        id: String(Date.now()),
        firmId: selectedFirm.id,
        username: createUserData.username,
        fullName: createUserData.fullName,
        role: createUserData.role,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // 更新模擬資料
      selectedFirm.users.push(newUser);
      selectedFirm.currentUsers++;
      mockUserPasswords[newUser.id] = createUserData.personalPassword;

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

  const handleDeleteUser = async (userId: string) => {
    if (!selectedFirm) return;

    const user = selectedFirm.users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`確定要刪除用戶「${user.fullName}」嗎？`)) return;

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新模擬資料
      selectedFirm.users = selectedFirm.users.filter(u => u.id !== userId);
      selectedFirm.currentUsers--;
      delete mockUserPasswords[userId];

      alert('用戶已刪除');

    } catch {
      setError('刪除用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  const resetLogin = () => {
    setLoginStep('firm');
    setSelectedFirm(null);
    setSelectedUser(null);
    setFirmCredentials({ firmCode: '', username: '', password: '' });
    setUserCredentials({ userId: '', personalPassword: '' });
    setError('');
    setShowUserManagement(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        {/* 標題區 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-[#334d6d] rounded-full flex items-center justify-center mb-3">
            {loginStep === 'firm' ? <Building className="w-6 h-6 text-white" /> :
             loginStep === 'user' ? <Users className="w-6 h-6 text-white" /> :
             <User className="w-6 h-6 text-white" />}
          </div>
          <h1 className="text-xl font-bold text-[#334d6d]">案件管理系統</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loginStep === 'firm' ? '請輸入事務所資訊' :
             loginStep === 'user' ? '請選擇登入用戶' :
             '請輸入個人密碼'}
          </p>
        </div>

        {/* 步驟指示器 */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              loginStep === 'firm' ? 'bg-[#334d6d] text-white' : 'bg-green-500 text-white'
            }`}>1</div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              loginStep === 'user' ? 'bg-[#334d6d] text-white' :
              loginStep === 'password' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
            }`}>2</div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              loginStep === 'password' ? 'bg-[#334d6d] text-white' : 'bg-gray-300 text-gray-600'
            }`}>3</div>
          </div>
        </div>

        {/* 第一步：事務所登入 */}
        {loginStep === 'firm' && (
          <form onSubmit={handleFirmLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">事務所代碼</label>
              <input
                type="text"
                value={firmCredentials.firmCode}
                onChange={(e) => setFirmCredentials(prev => ({ ...prev, firmCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入事務所代碼"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">管理員帳號</label>
              <input
                type="text"
                value={firmCredentials.username}
                onChange={(e) => setFirmCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入管理員帳號"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">管理員密碼</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={firmCredentials.password}
                  onChange={(e) => setFirmCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                  placeholder="請輸入管理員密碼"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  驗證中...
                </>
              ) : (
                '下一步'
              )}
            </button>
          </form>
        )}

        {/* 第二步：選擇用戶 */}
        {loginStep === 'user' && selectedFirm && (
          <div className="space-y-4">
            {/* 事務所資訊 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h3 className="font-medium text-blue-900 mb-1">{selectedFirm.firmName}</h3>
              <p className="text-sm text-blue-700">
                {PLANS[selectedFirm.plan].name} - {selectedFirm.currentUsers}/{selectedFirm.maxUsers} 用戶
              </p>
            </div>

            {/* 用戶管理按鈕 */}
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900">選擇登入用戶</h3>
              <button
                onClick={() => setShowUserManagement(!showUserManagement)}
                className="text-sm text-[#334d6d] hover:underline flex items-center"
              >
                <Users className="w-4 h-4 mr-1" />
                管理用戶
              </button>
            </div>

            {/* 用戶管理面板 */}
            {showUserManagement && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">用戶管理</span>
                  <button
                    onClick={() => setShowCreateUser(true)}
                    disabled={selectedFirm.currentUsers >= selectedFirm.maxUsers}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    新增用戶
                  </button>
                </div>

                {selectedFirm.users.map(user => (
                  <div key={user.id} className="flex items-center justify-between bg-white p-2 rounded border">
                    <div>
                      <div className="font-medium text-sm">{user.fullName}</div>
                      <div className="text-xs text-gray-500">{user.username} - {user.role}</div>
                    </div>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="刪除用戶"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

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
              {selectedFirm.users.filter(u => u.isActive).map(user => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="w-full p-3 border border-gray-300 rounded-md hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="font-medium text-gray-900">{user.fullName}</div>
                  <div className="text-sm text-gray-500">{user.username} - {
                    user.role === 'admin' ? '管理員' :
                    user.role === 'lawyer' ? '律師' : '法務'
                  }</div>
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={resetLogin}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
              >
                返回上一步
              </button>
            </div>
          </div>
        )}

        {/* 第三步：個人密碼 */}
        {loginStep === 'password' && selectedUser && (
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
                    value={userCredentials.personalPassword}
                    onChange={(e) => setUserCredentials(prev => ({ ...prev, personalPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                    placeholder="請輸入6位數字密碼"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPersonalPassword(!showPersonalPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                  >
                    {showPersonalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  onClick={() => setLoginStep('user')}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
                >
                  返回上一步
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 flex items-center justify-center"
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
        )}
      </div>
    </main>
  );
}
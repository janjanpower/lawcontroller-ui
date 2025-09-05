import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Building, Users, Plus, Trash2, Loader, CreditCard, Banknote } from 'lucide-react';
import RegisterDialog from '../components/RegisterDialog';
import type {
  LoginCredentials,
  UserLoginCredentials,
  User as UserType,
  Firm,
  CreateUserData,
  PlanType,
  PLANS,
  PlanSelectionData
} from '../types';

const API_BASE = import.meta.env.VITE_NEXT_PUBLIC_API_BASE || 'https://api.128-199-65-122.sslip.io';

// 模擬資料
const mockFirms: Record<string, Firm & { users: UserType[]; adminPassword: string; hasPlan: boolean }> = {
  'admin': {
    id: '1',
    firmName: '測試法律事務所',
    firmCode: 'TEST001',
    plan: 'basic',
    currentUsers: 3,
    maxUsers: 5,
    createdAt: '2024-01-01',
    isActive: true,
    adminPassword: 'Admin123!',
    hasPlan: true,
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
  },
  'testfirm': {
    id: '2',
    firmName: '新註冊事務所',
    firmCode: 'NEWFIRM',
    plan: 'basic',
    currentUsers: 1,
    maxUsers: 0, // 未付費
    createdAt: '2024-01-15',
    isActive: true,
    adminPassword: 'Test123!',
    hasPlan: false, // 未選擇方案
    users: [
      {
        id: '4',
        firmId: '2',
        username: 'testfirm',
        fullName: '測試管理員',
        role: 'admin',
        isActive: true,
        createdAt: '2024-01-15'
      }
    ]
  }
};

// 模擬用戶個人密碼
const mockUserPasswords: Record<string, string> = {
  '1': '123456',
  '2': '234567',
  '3': '345678',
  '4': '111111'
};

export default function LoginPage() {
  // 登入流程狀態
  const [loginStep, setLoginStep] = useState<'login' | 'planSelection' | 'userSelect' | 'personalPassword'>('login');
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // 表單資料
  const [loginCredentials, setLoginCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });

  const [userCredentials, setUserCredentials] = useState<UserLoginCredentials>({
    userId: '',
    personalPassword: ''
  });

  // 方案選擇
  const [planSelection, setPlanSelection] = useState<PlanSelectionData>({
    selectedPlan: 'basic',
    paymentMethod: 'bank_transfer'
  });

  // UI 狀態
  const [showPassword, setShowPassword] = useState(false);
  const [showPersonalPassword, setShowPersonalPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 註冊對話框
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);

  // 用戶管理狀態
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    fullName: '',
    role: 'lawyer',
    personalPassword: '',
    confirmPersonalPassword: ''
  });

  // 刪除用戶確認
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('law_token');
    if (token) {
      window.location.replace('/cases');
    }
  }, []);

  // 第一步：管理員登入
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 模擬 API 呼叫
      await new Promise(resolve => setTimeout(resolve, 1000));

      const firm = mockFirms[loginCredentials.username];
      if (!firm || firm.adminPassword !== loginCredentials.password) {
        setError('帳號或密碼錯誤');
        return;
      }

      setSelectedFirm(firm);

      // 檢查是否有方案
      if (!firm.hasPlan) {
        setLoginStep('planSelection');
      } else {
        setLoginStep('userSelect');
      }

    } catch {
      setError('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 方案選擇和付費
  const handlePlanSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模擬付費成功，更新事務所方案
      if (selectedFirm) {
        selectedFirm.plan = planSelection.selectedPlan;
        selectedFirm.maxUsers = PLANS[planSelection.selectedPlan].maxUsers;
        selectedFirm.hasPlan = true;
      }

      alert('付費成功！方案已啟用。');
      setLoginStep('userSelect');

    } catch {
      setError('付費處理失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 第二步：選擇用戶
  const handleUserSelect = (user: UserType) => {
    setSelectedUser(user);
    setUserCredentials({ userId: user.id, personalPassword: '' });
    setLoginStep('personalPassword');
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

  // 刪除用戶確認
  const handleDeleteUserConfirm = async () => {
    if (!selectedFirm || !deleteUserId) return;

    // 驗證管理員密碼
    if (deletePassword !== selectedFirm.adminPassword) {
      setError('管理員密碼錯誤');
      return;
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 更新模擬資料
      selectedFirm.users = selectedFirm.users.filter(u => u.id !== deleteUserId);
      selectedFirm.currentUsers--;
      delete mockUserPasswords[deleteUserId];

      setDeleteUserId(null);
      setDeletePassword('');
      alert('用戶已刪除');

    } catch {
      setError('刪除用戶失敗');
    } finally {
      setLoading(false);
    }
  };

  const resetLogin = () => {
    setLoginStep('login');
    setSelectedFirm(null);
    setSelectedUser(null);
    setLoginCredentials({ username: '', password: '' });
    setUserCredentials({ userId: '', personalPassword: '' });
    setError('');
  };

  const handleRegisterSuccess = (result: { success: boolean; firmCode: string }) => {
    if (result.success) {
      // 可以自動填入帳號
      setLoginCredentials(prev => ({ ...prev, username: result.firmCode.toLowerCase() }));
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        {/* 標題區 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-[#334d6d] rounded-full flex items-center justify-center mb-3">
            {loginStep === 'login' && <Building className="w-6 h-6 text-white" />}
            {loginStep === 'planSelection' && <CreditCard className="w-6 h-6 text-white" />}
            {loginStep === 'userSelect' && <Users className="w-6 h-6 text-white" />}
            {loginStep === 'personalPassword' && <User className="w-6 h-6 text-white" />}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {loginStep === 'login' && '管理員登入'}
            {loginStep === 'planSelection' && '選擇方案'}
            {loginStep === 'userSelect' && '選擇用戶'}
            {loginStep === 'personalPassword' && '個人密碼驗證'}
          </h1>
        </div>

        {/* 登入表單 */}
        {loginStep === 'login' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
              <input
                type="text"
                value={loginCredentials.username}
                onChange={(e) => setLoginCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入帳號"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginCredentials.password}
                  onChange={(e) => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                  placeholder="請輸入密碼"
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

            <div className="flex space-x-3">
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
                  '登入'
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowRegisterDialog(true)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                註冊
              </button>
            </div>
          </form>
        )}

        {/* 方案選擇和付費 */}
        {loginStep === 'planSelection' && selectedFirm && (
          <div className="space-y-4">
            {/* 事務所資訊 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <h3 className="font-medium text-yellow-900 mb-1">{selectedFirm.firmName}</h3>
              <p className="text-sm text-yellow-700">
                請選擇方案以開始使用系統
              </p>
            </div>

            <form onSubmit={handlePlanSelection} className="space-y-4">
              {/* 方案選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">選擇方案</label>
                <div className="space-y-2">
                  {Object.entries(PLANS).map(([key, plan]) => (
                    <label
                      key={key}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        planSelection.selectedPlan === key
                          ? 'border-[#334d6d] bg-blue-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="plan"
                          value={key}
                          checked={planSelection.selectedPlan === key}
                          onChange={(e) => setPlanSelection(prev => ({ ...prev, selectedPlan: e.target.value as PlanType }))}
                          className="mr-3"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{plan.name}</div>
                          <div className="text-xs text-gray-500">最多 {plan.maxUsers} 人</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#334d6d]">
                          {key === 'basic' ? '免費' :
                           key === 'advanced' ? '月付 $1,999' :
                           key === 'premium' ? '月付 $3,999' : '月付 $9,999'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 付費方式 */}
              {planSelection.selectedPlan !== 'basic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">付費方式</label>
                  <div className="space-y-2">
                    <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bank_transfer"
                        checked={planSelection.paymentMethod === 'bank_transfer'}
                        onChange={(e) => setPlanSelection(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="mr-2"
                      />
                      <Banknote className="w-4 h-4 mr-2" />
                      <span className="text-sm">銀行轉帳</span>
                    </label>
                    <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="credit_card"
                        checked={planSelection.paymentMethod === 'credit_card'}
                        onChange={(e) => setPlanSelection(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="mr-2"
                      />
                      <CreditCard className="w-4 h-4 mr-2" />
                      <span className="text-sm">信用卡</span>
                    </label>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={resetLogin}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
                >
                  返回登入
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    planSelection.selectedPlan === 'basic' ? '啟用免費方案' : '確認付費'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 第二步：選擇用戶 */}
        {loginStep === 'userSelect' && selectedFirm && (
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
                onClick={() => setShowCreateUser(true)}
                disabled={selectedFirm.currentUsers >= selectedFirm.maxUsers}
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
              {selectedFirm.users.filter(u => u.isActive).map(user => (
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

            <button
              onClick={resetLogin}
              className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
            >
              返回登入
            </button>
          </div>
        )}

        {/* 第三步：個人密碼 */}
        {loginStep === 'personalPassword' && selectedUser && (
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
                  onClick={() => setLoginStep('userSelect')}
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

        {/* 刪除用戶確認對話框 */}
        {deleteUserId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">確認刪除用戶</h3>
              <p className="text-sm text-gray-600 mb-4">
                請輸入管理員密碼以確認刪除用戶：
                <strong>{selectedFirm?.users.find(u => u.id === deleteUserId)?.fullName}</strong>
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

      {/* 註冊對話框 */}
      <RegisterDialog
        isOpen={showRegisterDialog}
        onClose={() => setShowRegisterDialog(false)}
        onRegisterSuccess={handleRegisterSuccess}
        apiBaseUrl={API_BASE}
      />
    </main>
  );
}
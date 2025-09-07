import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Building } from 'lucide-react';
import RegisterDialog from '../components/RegisterDialog';
import PlanSelectionDialog from '../components/PlanSelectionDialog';
import UserSelectionDialog from '../components/UserSelectionDialog';
import '../styles/login.css';
import type { LoginCredentials, Firm, User as UserType } from '../types';

export default function LoginPage() {
  // 基本狀態
  const [loginCredentials, setLoginCredentials] = useState<LoginCredentials>({
    account: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 對話框狀態
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showPlanSelectionDialog, setShowPlanSelectionDialog] = useState(false);
  const [showUserSelectionDialog, setShowUserSelectionDialog] = useState(false);

  // 登入後的事務所和用戶資訊
  const [currentFirm, setCurrentFirm] = useState<(Firm & {
    hasPlan: boolean;
    users: UserType[];
    adminPassword: string;
  }) | null>(null);
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem('law_token');
    if (token) {
      window.location.replace('/cases');
    }

    // 載入記住的帳號
    const savedAccount = localStorage.getItem('law_remembered_account');
    const savedRememberMe = localStorage.getItem('law_remember_me') === 'true';

    if (savedRememberMe && savedAccount) {
      setLoginCredentials(prev => ({ ...prev, account: savedAccount }));
      setRememberMe(true);
    }
  }, []);

  // 登入處理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 檢查是否有後端服務
      let response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account: loginCredentials.account,
            password: loginCredentials.password,
          }),
        });
      } catch (networkError) {
        console.error('網路連線錯誤:', networkError);
        setError('無法連接到伺服器，請檢查網路連線或聯繫系統管理員');
        setLoading(false);
        return;
      }

      // 檢查回應狀態
      if (!response.ok) {
        console.error('HTTP錯誤:', response.status, response.statusText);
        
        // 嘗試讀取錯誤訊息
        let errorMessage = `伺服器錯誤 (${response.status})`;
        try {
          const errorText = await response.text();
          console.error('錯誤回應內容:', errorText);
          
          // 嘗試解析為 JSON
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            // 如果不是 JSON，使用原始文字（截取前100字元）
            errorMessage = errorText.length > 100 ? errorText.substring(0, 100) + '...' : errorText;
          }
        } catch {
          // 無法讀取回應內容
        }
        
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // 嘗試解析 JSON 回應
      let data;
      try {
        const responseText = await response.text();
        console.log('登入回應原始內容:', responseText);
        
        if (!responseText.trim()) {
          throw new Error('伺服器回傳空白回應');
        }
        
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 解析錯誤:', parseError);
        setError('伺服器回應格式錯誤，請聯繫系統管理員');
        setLoading(false);
        return;
      }

      console.log('Login Response Data:', data);
      console.log('data.has_plan:', data.has_plan);
      console.log('data.can_use_free_plan:', data.can_use_free_plan);

      if (data.success) {
        // 記住帳號
        if (rememberMe) {
          localStorage.setItem('law_remembered_account', loginCredentials.account);
          localStorage.setItem('law_remember_me', 'true');
        } else {
          localStorage.removeItem('law_remembered_account');
          localStorage.removeItem('law_remember_me');
        }

        console.log('data.has_plan:', data.has_plan);
        console.log('data.can_use_free_plan:', data.can_use_free_plan);
        console.log('data.plan_type:', data.plan_type);
        console.log('data.users:', data.users);

        // 建立事務所資訊
        const firmInfo = {
          id: data.firm_id,
          firmName: data.firm_name,
          firmCode: loginCredentials.account,
          plan: data.plan_type || 'none',
          currentUsers: data.users?.length || 0,
          maxUsers: data.max_users || 1,
          createdAt: new Date().toISOString(),
          isActive: true,
          hasPlan: data.has_plan || data.can_use_free_plan,
          users: (data.users || []).map((apiUser: any) => ({
            id: apiUser.id,
            username: apiUser.username,
            fullName: apiUser.full_name,
            role: apiUser.role,
            isActive: apiUser.is_active,
            email: apiUser.email || '',
            phone: apiUser.phone || '',
            createdAt: apiUser.created_at || new Date().toISOString(),
            lastLogin: apiUser.last_login
          })),
          adminPassword: 'admin123' // 暫時的管理員密碼
        };

        setCurrentFirm(firmInfo);

        console.log('Firm Info:', firmInfo);
        
        // 判斷邏輯：如果有付費方案或免費方案通行證，直接顯示用戶選擇對話框
        if (data.has_plan || data.can_use_free_plan) {
            console.log('Condition met: Showing UserSelectionDialog');
            setShowUserSelectionDialog(true);
        } else {
            console.log('Condition not met: Showing PlanSelectionDialog');
          setShowPlanSelectionDialog(true);
        }
      } else {
        setError(data.detail || data.message || '登入失敗');
      }

    } catch (error) {
      console.error('登入請求失敗:', error);
      
      // 根據錯誤類型提供更具體的錯誤訊息
      let errorMessage = '登入失敗';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = '無法連接到伺服器，請檢查網路連線';
      } else if (error instanceof SyntaxError) {
        errorMessage = '伺服器回應格式錯誤';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 註冊成功回調
  const handleRegisterSuccess = (result: {
    success: boolean;
    account: string;
  }) => {
    if (result.success) {
      setLoginCredentials(prev => ({ ...prev, account: result.account }));
      // 註冊成功後，用戶需要手動登入
    }
  };

  // 方案選擇完成回調
  const handlePlanSelectionComplete = () => {
    setShowPlanSelectionDialog(false);
    // 購買方案後顯示用戶選擇對話框
    setShowUserSelectionDialog(true);
  };

  // 用戶選擇完成回調
  const handleUserSelectionComplete = () => {
    console.log('用戶選擇完成，準備跳轉到案件總覽');
    
    // 跳轉到案件總覽
    window.location.replace('/cases');
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* 品牌區域 */}
        <div className="brand-section">
          <div className="brand-icon">
            <Building />
          </div>
          <h1 className="brand-title">法律案件管理系統</h1>
          <p className="brand-subtitle">專業的案件管理解決方案</p>
        </div>

        {/* 登入卡片 */}
        <div className="login-card">
          <div className="card-accent"></div>
          <div className="card-content">
            <h2 className="form-title">登入系統</h2>

            <form onSubmit={handleLogin} className="form-container">
              {/* 帳號輸入 */}
              <div className="form-group">
                <label htmlFor="account" className="form-label">帳號</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <User />
                  </div>
                  <input
                    id="account"
                    type="text"
                    value={loginCredentials.account}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, account: e.target.value }))}
                    className="form-input"
                    placeholder="請輸入帳號"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 密碼輸入 */}
              <div className="form-group">
                <label htmlFor="password" className="form-label">密碼</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <Lock />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginCredentials.password}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="form-input password-input"
                    placeholder="請輸入密碼"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              {/* 記住我和忘記密碼 */}
              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="remember-checkbox"
                    disabled={loading}
                  />
                  記住帳號
                </label>
                <a href="#" className="forgot-password">忘記密碼？</a>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="error-message">
                  <div className="error-indicator">
                    <div className="error-dot"></div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* 登入和註冊按鈕 */}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="login-button flex-1"
                >
                  {loading ? (
                    <div className="loading-content">
                      <div className="loading-spinner"></div>
                      登入中...
                    </div>
                  ) : (
                    '登入'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRegisterDialog(true)}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                  disabled={loading}
                >
                  註冊
                </button>
              </div>
            </form>

            {/* 頁尾 */}
            <div className="card-footer">
              <p className="footer-text">
                © 2024 法律案件管理系統. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* 額外資訊 */}
        <div className="additional-info">
          <p className="help-text">
            如需技術支援，請聯繫系統管理員
          </p>
        </div>
      </div>

      {/* 註冊對話框 */}
      <RegisterDialog
        isOpen={showRegisterDialog}
        onClose={() => setShowRegisterDialog(false)}
        onRegisterSuccess={handleRegisterSuccess}
      />

      {/* 方案選擇對話框 */}
      {currentFirm && (
        <PlanSelectionDialog
          isOpen={showPlanSelectionDialog}
          onClose={() => {
            setShowPlanSelectionDialog(false);
            setCurrentFirm(null);
          }}
          firm={currentFirm}
          onComplete={handlePlanSelectionComplete}
        />
      )}

      {/* 用戶選擇對話框 */}
      {currentFirm && (
        <UserSelectionDialog
          isOpen={showUserSelectionDialog}
          onClose={() => {
            setShowUserSelectionDialog(false);
            setCurrentFirm(null);
          }}
          firm={currentFirm}
          userPasswords={userPasswords}
          onComplete={handleUserSelectionComplete}
        />
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Building } from 'lucide-react';
import RegisterDialog from '../components/RegisterDialog';
import PlanSelectionDialog from '../components/PlanSelectionDialog';
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
      // 暫時使用模擬 API 回應，直到後端服務啟動
      console.log('登入請求:', {
        account: loginCredentials.account,
        password: loginCredentials.password
      });
      
      // 模擬 API 回應
      await new Promise(resolve => setTimeout(resolve, 800)); // 模擬網路延遲
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: loginCredentials.account,
          password: loginCredentials.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 記住帳號
        if (rememberMe) {
          localStorage.setItem('law_remembered_account', loginCredentials.account);
          localStorage.setItem('law_remember_me', 'true');
        } else {
          localStorage.removeItem('law_remembered_account');
          localStorage.removeItem('law_remember_me');
        }

        // 模擬取得事務所詳細資訊（包含方案和用戶）
        const firmInfo = await fetchFirmInfo(data.firm_id);
        
        if (firmInfo.hasPlan) {
          // 有付費方案，顯示用戶選擇對話框
          setCurrentFirm(firmInfo);
          setShowUserSelectionDialog(true);
        } else {
          // 沒有付費方案，顯示方案選擇對話框
          setCurrentFirm(firmInfo);
          setShowPlanSelectionDialog(true);
        }
      } else {
        setError(data.detail || data.message || '登入失敗');
      }

    } catch (error) {
      console.error('登入請求失敗:', error);
      setError(`網路錯誤: ${error.message || '無法連接到伺服器'}`);
    } finally {
      setLoading(false);
    }
  };

  // 模擬取得事務所資訊的函數
  const fetchFirmInfo = async (firmId: string) => {
    // TODO: 實際應該呼叫 API 取得事務所詳細資訊
    // 這裡先返回模擬資料
    return {
      id: firmId,
      firmName: loginCredentials.account, // 暫時使用帳號作為名稱
      firmCode: loginCredentials.account,
      plan: 'basic' as const,
      currentUsers: 1,
      maxUsers: 5,
      createdAt: new Date().toISOString(),
      isActive: true,
      hasPlan: Math.random() > 0.5, // 隨機決定是否有方案（測試用）
      users: [
        {
          id: '1',
          firmId: firmId,
          username: 'admin',
          fullName: '系統管理員',
          role: 'admin' as const,
          isActive: true,
          createdAt: new Date().toISOString(),
        }
      ],
      adminPassword: 'admin123'
    };
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
  // 用戶選擇完成回調
  const handleUserSelectionComplete = () => {
    // 儲存登入資訊
    localStorage.setItem('law_token', 'dummy_token');
    localStorage.setItem('law_user_id', 'selected_user_id');
    localStorage.setItem('law_firm_id', currentFirm?.id || '');
    
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
    </div>
  );
}
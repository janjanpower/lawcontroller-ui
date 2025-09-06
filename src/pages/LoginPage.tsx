import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Building } from 'lucide-react';
import RegisterDialog from '../components/RegisterDialog';
import UserSelectionDialog from '../components/UserSelectionDialog';
import PlanSelectionDialog from '../components/PlanSelectionDialog';
import '../styles/login.css';
import type { 
  LoginCredentials, 
  User as UserType, 
  Firm
} from '../types';

export default function LoginPage() {
  // 基本狀態
  const [loginCredentials, setLoginCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 對話框狀態
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showUserSelectionDialog, setShowUserSelectionDialog] = useState(false);
  const [showPlanSelectionDialog, setShowPlanSelectionDialog] = useState(false);
  
  // 選中的事務所
  const [selectedFirm, setSelectedFirm] = useState<(Firm & { users: UserType[]; adminPassword: string; hasPlan: boolean }) | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('law_token');
    if (token) {
      window.location.replace('/cases');
    }

    // 載入記住的帳號
    const savedUsername = localStorage.getItem('law_remembered_username');
    const savedRememberMe = localStorage.getItem('law_remember_me') === 'true';
    
    if (savedRememberMe && savedUsername) {
      setLoginCredentials(prev => ({ ...prev, username: savedUsername }));
      setRememberMe(true);
    }
  }, []);

  // 登入處理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `${loginCredentials.username}@example.com`, // 暫時生成 email
          password: loginCredentials.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 記住帳號
        if (rememberMe) {
          localStorage.setItem('law_remembered_username', loginCredentials.username);
          localStorage.setItem('law_remember_me', 'true');
        } else {
          localStorage.removeItem('law_remembered_username');
          localStorage.removeItem('law_remember_me');
        }

        // 儲存登入資訊
        localStorage.setItem('law_token', 'dummy_token'); // 暫時使用假 token
        localStorage.setItem('law_user_id', data.user_id);
        localStorage.setItem('law_firm_id', data.firm_id);

        // 跳轉到案件總覽
        window.location.replace('/cases');
      } else {
        setError(data.detail || '登入失敗');
      }
    } catch (error) {
      console.error('登入請求失敗:', error);
      setError('網路錯誤，請稍後重試');
    } finally {
      setLoading(false);
    }

    // 原本的登入邏輯已移除，需要整合真實的後端 API
  };

  // 方案選擇完成後的回調
  const handlePlanSelectionComplete = () => {
    console.log('方案選擇完成，準備顯示用戶選擇對話框');
    setShowPlanSelectionDialog(false);
    // 稍微延遲以確保狀態更新完成
    setTimeout(() => {
      setShowUserSelectionDialog(true);
    }, 100);
    setShowUserSelectionDialog(true);
  };

  // 用戶選擇完成後的回調
  const handleUserSelectionComplete = () => {
    console.log('用戶選擇完成');
    setShowUserSelectionDialog(false);
    // 這裡會在 UserSelectionDialog 內部處理最終登入
  };

  // 註冊成功回調
  const handleRegisterSuccess = (result: { success: boolean; username: string }) => {
    if (result.success) {
      setLoginCredentials(prev => ({ ...prev, username: result.username }));
    }
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
                <label htmlFor="username" className="form-label">帳號</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <User />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={loginCredentials.username}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, username: e.target.value }))}
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
        apiBaseUrl=""
      />

      {/* 方案選擇對話框 */}
      <PlanSelectionDialog
        isOpen={showPlanSelectionDialog}
        onClose={() => setShowPlanSelectionDialog(false)}
        firm={selectedFirm!}
        onComplete={handlePlanSelectionComplete}
      />

      {/* 用戶選擇對話框 */}
      {selectedFirm && (
        <UserSelectionDialog
          isOpen={showUserSelectionDialog}
          onClose={() => setShowUserSelectionDialog(false)}
          firm={selectedFirm}
          userPasswords={{}}
          onComplete={handleUserSelectionComplete}
        />
      )}
    </div>
  );
}
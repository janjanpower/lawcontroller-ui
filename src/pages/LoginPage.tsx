import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import axios from 'axios';
import CaseOverview from '../pages/CaseOverview';
import '../styles/login.css';

const API_BASE =
  import.meta.env.VITE_NEXT_PUBLIC_API_BASE || "https://api.128-199-65-122.sslip.io";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 測試帳號密碼驗證
      if (username === "admin" && password === "123456") {
        if (remember) {
          localStorage.setItem("law_username", username);
        }
        localStorage.setItem("law_token", "demo_token_12345");
        setIsLoggedIn(true);
        setLoading(false);
        return;
      }

      // 實際 API 呼叫（如果測試帳號不符合）
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password,
      });
      const token = res.data?.access_token || res.data?.token;
      if (token) {
        if (remember) {
          localStorage.setItem("law_username", username);
        }
        localStorage.setItem("law_token", token);
        setIsLoggedIn(true);
      } else {
        setError("登入成功，但未收到 token。請稍後再試。");
      }
    } catch {
      setError("帳號或密碼錯誤，或伺服器無法連線。");
    } finally {
      setLoading(false);
    }
  };

  // 如果已登入，顯示案件管理系統
  if (isLoggedIn) {
    return <CaseOverview />;
  }

  // 顯示登入介面
  return (
    <main className="login-container">
      <div className="login-wrapper">
        {/* 品牌區域 */}
        <div className="brand-section">
          <div className="brand-icon">
            <User />
          </div>
          <h1 className="brand-title">
            案件管理系統
          </h1>
          <p className="brand-subtitle">
            請登入您的帳戶以繼續
          </p>
        </div>

        {/* 登入卡片 */}
        <div className="login-card">
          {/* 頂部裝飾條 */}
          <div className="card-accent" />

          <div className="card-content">
            <h2 className="form-title">
              系統登入
            </h2>

            <form onSubmit={handleLogin} className="form-container">
              {/* 帳號欄位 */}
              <div className="form-group">
                <label className="form-label">
                  帳號
                </label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <User />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                    placeholder="請輸入您的帳號"
                    required
                  />
                </div>
              </div>

              {/* 密碼欄位 */}
              <div className="form-group">
                <label className="form-label">
                  密碼
                </label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <Lock />
                  </div>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input password-input"
                    placeholder="請輸入您的密碼"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="password-toggle"
                  >
                    {showPwd ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              {/* 記住我 & 忘記密碼 */}
              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    className="remember-checkbox"
                  />
                  <span>記住我</span>
                </label>
                <a href="#" className="forgot-password">
                  忘記密碼？
                </a>
              </div>

              {/* 測試帳號提示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5 flex-shrink-0"></div>
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">測試帳號</p>
                    <p>帳號：<span className="font-mono bg-blue-100 px-1 rounded">admin</span></p>
                    <p>密碼：<span className="font-mono bg-blue-100 px-1 rounded">123456</span></p>
                  </div>
                </div>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="error-message">
                  <div className="error-indicator">
                    <div className="error-dot" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* 登入按鈕 */}
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="login-button"
              >
                {loading ? (
                  <div className="loading-content">
                    <div className="loading-spinner" />
                    <span>登入中...</span>
                  </div>
                ) : (
                  "登入系統"
                )}
              </button>
            </form>

            {/* 頁尾 */}
            <div className="card-footer">
              <p className="footer-text">
                © 2025 案件管理系統. 版權所有
              </p>
            </div>
          </div>
        </div>

        {/* 額外資訊 */}
        <div className="additional-info">
          <p className="help-text">
            需要協助？請聯繫系統管理員
          </p>
        </div>
      </div>
    </main>
  );
}

export default App;
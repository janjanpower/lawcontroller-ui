// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import { Eye, EyeOff, User, Lock, Loader } from 'lucide-react';
import axios from 'axios';
import RegisterDialog from '../components/RegisterDialog';

const API_BASE =
  import.meta.env.VITE_NEXT_PUBLIC_API_BASE || 'https://api.128-199-65-122.sslip.io';

export default function LoginPage() {
  const [username, setUsername] = useState(() => localStorage.getItem('law_username') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!localStorage.getItem('law_username'));
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    // 若已存在 token，直接導到案件頁
    const token = localStorage.getItem('law_token');
    if (token) {
      window.location.replace('/cases');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 內建測試帳密（✅ 拿掉硬塞 token，每次必須輸入 admin / 123456）
      if (username === 'admin' && password === '123456') {
        if (remember) localStorage.setItem('law_username', username);
        else localStorage.removeItem('law_username');

        // 不再存 demo_token，直接進入系統
        window.location.assign('/cases');
        return;
      }

      // 真實 API
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password,
      });

      const token: string | undefined =
        res.data?.access_token || res.data?.token || res.data?.data?.token;

      if (!token) {
        setError('登入成功，但未收到 token。請稍後再試。');
        return;
      }

      if (remember) localStorage.setItem('law_username', username);
      else localStorage.removeItem('law_username');

      localStorage.setItem('law_token', token);
      window.location.assign('/cases');
    } catch {
      setError('帳號或密碼錯誤，或伺服器無法連線。');
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        {/* 標題區 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-[#334d6d] rounded-full flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#334d6d]">案件管理系統</h1>
          <p className="text-gray-500 text-sm mt-1">請登入帳戶以繼續</p>
        </div>

        {/* 表單 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 帳號 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入您的帳號"
                required
              />
            </div>
          </div>

          {/* 密碼 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#334d6d] focus:border-[#334d6d] outline-none"
                placeholder="請輸入您的密碼"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                aria-label="切換顯示密碼"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 記住我 / 忘記密碼 */}
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={() => setRemember((v) => !v)}
                className="rounded border-gray-300 text-[#334d6d] focus:ring-[#334d6d]"
              />
              <span>記住我</span>
            </label>
            <button
              type="button"
              className="text-sm text-[#334d6d] hover:underline"
              onClick={() => alert('請聯繫系統管理員重設密碼')}
            >
              忘記密碼？
            </button>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* 登入 / 註冊按鈕 */}
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="flex-1 inline-flex items-center justify-center bg-[#334d6d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#3f5a7d] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  登入中…
                </>
              ) : (
                '登入系統'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="flex-1 inline-flex items-center justify-center border border-[#334d6d] text-[#334d6d] px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              註冊
            </button>
          </div>
        </form>
      </div>

      {/* 註冊對話框 */}
      <RegisterDialog
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onRegisterSuccess={(r) => {
          console.log('註冊成功', r);
        }}
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8100'}
      />
    </main>
  );
}

// src/pages/LoginPage.tsx
import { useEffect, useRef, useState } from 'react';
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
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
      if (username === 'admin' && password === '123456') {
        if (remember) localStorage.setItem('law_username', username);
        else localStorage.removeItem('law_username');

        localStorage.setItem('law_token', 'demo_token_12345');
        window.location.assign('/cases');
        return;
      }

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
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        {/* 品牌區 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-[#334d6d] rounded-full flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#334d6d]">案件管理系統</h1>
          <p className="text-gray-500 text-sm mt-1">請登入您的帳戶以繼續</p>
        </div>

        {/* 卡片 */}
        <div className="bg-white rounded-xl shadow border border-gray-200">
          <div className="h-1.5 bg-gradient-to-r from-[#334d6d] via-[#4f6b8e] to-[#8fb3ff] rounded-t-xl" />
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">系統登入</h2>

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
                    ref={passwordRef}
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

              {/* 測試帳號提示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700">
                測試帳號：admin / 123456
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* 登入 / 註冊 */}
              <div className="flex items-center space-x-3">
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
                  className="px-4 py-2 rounded-md border text-[#334d6d] hover:bg-gray-50"
                >
                  註冊
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-xs text-gray-500">
              © {new Date().getFullYear()} 案件管理系統. 版權所有
            </div>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">需要協助？請聯繫系統管理員</p>
      </div>

      {/* 註冊對話框 */}
      <RegisterDialog
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onRegisterSuccess={(r) => {
          // 註冊成功 → 自動填入帳號並 focus 密碼
          setUsername(r.client_id);
          setShowRegister(false);
          setTimeout(() => passwordRef.current?.focus(), 100);
        }}
        apiBaseUrl={API_BASE}
      />
    </main>
  );
}

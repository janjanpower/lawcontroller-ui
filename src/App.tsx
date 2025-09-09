import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import CaseOverview from './pages/CaseOverview';
import ClosedCases from './pages/ClosedCases';
import CustomerData from './pages/CustomerData';
import UserManagement from './pages/UserManagement';
import { initializeAppState, tryGetFirmCode, hasAuthToken } from './utils/api';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1) 轉換舊 key 並盡力補 firm_code（localStorage / URL / .env）
    initializeAppState();

    // 2) 判斷登入與 firm_code 狀態
    const fc = tryGetFirmCode();
    const authed = hasAuthToken();

    // 未登入：不做導轉，交給路由顯示 LoginPage
    if (!authed) {
      setIsInitialized(false);
      setIsLoading(false);
      return;
    }

    // 已登入但沒 firm_code：導回登入（帶回跳）
    if (!fc) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?returnTo=${returnTo}`;
      return;
    }

    // 都 OK
    setIsInitialized(true);
    setIsLoading(false);
  }, []);

  // 載入中顯示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#334d6d] mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 未登入預設就是登入頁 */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* 登入後的頁面 */}
        <Route
          path="/cases"
          element={
            <MainLayout>
              <CaseOverview />
            </MainLayout>
          }
        />
        <Route
          path="/closed-cases"
          element={
            <MainLayout>
              <ClosedCases />
            </MainLayout>
          }
        />
        <Route
          path="/customers"
          element={
            <MainLayout>
              <CustomerData />
            </MainLayout>
          }
        />
        <Route
          path="/users"
          element={
            <MainLayout>
              <UserManagement />
            </MainLayout>
          }
        />

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

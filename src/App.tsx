import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, PropsWithChildren } from 'react';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import CaseOverview from './pages/CaseOverview';
import ClosedCases from './pages/ClosedCases';
import CustomerData from './pages/CustomerData';
import UserManagement from './pages/UserManagement';
import { initializeAppState, tryGetFirmCode, hasAuthToken } from './utils/api';

// 路由守衛：需要「已登入 + 有 firm_code」才放行
function RequireAuthFirm({ children }: PropsWithChildren) {
  const location = useLocation();
  const authed = hasAuthToken();
  const fc = tryGetFirmCode();

  // 未登入 → 送去登入（帶回跳）
  if (!authed) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // 已登入但沒有 firm_code → 送去登入（帶回跳）
  if (!fc) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // 條件都齊 → 放行
  return <>{children}</>;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 做一次 key 搬遷與自動帶入 firm_code（localStorage / URL / .env）
    initializeAppState();
    setReady(true);
  }, []);

  if (!ready) {
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
        {/* 未登入預設是登入頁 */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* 需要登入 + firm_code 的頁面都包上守衛，避免還沒準備好就掛載子頁 */}
        <Route
          path="/cases"
          element={
            <RequireAuthFirm>
              <MainLayout>
                <CaseOverview />
              </MainLayout>
            </RequireAuthFirm>
          }
        />
        <Route
          path="/closed-cases"
          element={
            <RequireAuthFirm>
              <MainLayout>
                <ClosedCases />
              </MainLayout>
            </RequireAuthFirm>
          }
        />
        <Route
          path="/customers"
          element={
            <RequireAuthFirm>
              <MainLayout>
                <CustomerData />
              </MainLayout>
            </RequireAuthFirm>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuthFirm>
              <MainLayout>
                <UserManagement />
              </MainLayout>
            </RequireAuthFirm>
          }
        />

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

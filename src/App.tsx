import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense, PropsWithChildren } from 'react';
import LoginPage from './pages/LoginPage';
import { initializeAppState, tryGetFirmCode, hasAuthToken } from './utils/api';

// 👉 受保護頁面用 lazy，避免在守衛放行前就執行到模組頂層
const MainLayout     = lazy(() => import('./components/MainLayout'));
const CaseOverview   = lazy(() => import('./pages/CaseOverview'));
const ClosedCases    = lazy(() => import('./pages/ClosedCases'));
const CustomerData   = lazy(() => import('./pages/CustomerData'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

// 路由守衛：需要「已登入 + 有 firm_code」才放行
function RequireAuthFirm({ children }: PropsWithChildren) {
  const location = useLocation();
  const authed = hasAuthToken();
  const fc = tryGetFirmCode();

  if (!authed) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (!fc) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 先做 key 搬遷與自動帶入 firm_code（localStorage / URL / .env）
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
      {/* 懶載入中的過場畫面 */}
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#334d6d] mx-auto mb-4"></div>
              <p className="text-gray-600">載入中...</p>
            </div>
          </div>
        }
      >
        <Routes>
          {/* 未登入預設是登入頁 */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* 需要登入 + firm_code 的頁面 → 先過守衛，通過後才會真正 import 子頁模組 */}
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
      </Suspense>
    </BrowserRouter>
  );
}

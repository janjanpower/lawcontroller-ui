import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import CaseOverview from './pages/CaseOverview';
import ClosedCases from './pages/ClosedCases';
import CustomerData from './pages/CustomerData';
import UserManagement from './pages/UserManagement';
import { initializeAppState, hasAuthToken } from './utils/api';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 如果沒有任何登入資訊，直接完成初始化
        if (!hasAuthToken()) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // 嘗試初始化應用狀態
        const success = await initializeAppState();
        setIsInitialized(success);
      } catch (error) {
        console.error('應用初始化失敗:', error);
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
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
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cases" element={<MainLayout><CaseOverview /></MainLayout>} />
        <Route path="/closed-cases" element={<MainLayout><ClosedCases /></MainLayout>} />
        <Route path="/customers" element={<MainLayout><CustomerData /></MainLayout>} />
        <Route path="/users" element={<MainLayout><UserManagement /></MainLayout>} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}
